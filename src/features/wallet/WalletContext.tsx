import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { AppState } from "react-native";
import { calculateBudget } from "@/domain/budget";
import { todayLocal } from "@/domain/dates";
import type {
  AllowancePeriod,
  BudgetSummary,
  Category,
  Reserve,
  WalletTransaction,
} from "@/domain/models";
import * as repo from "@/db/database";
type State = {
  loading: boolean;
  onboarded: boolean;
  period: AllowancePeriod | null;
  periods: AllowancePeriod[];
  transactions: WalletTransaction[];
  reserves: Reserve[];
  categories: Category[];
  budget: BudgetSummary | null;
  error: string | null;
  lastBackupExportAt: string | null;
  revision: number;
  refresh: () => Promise<void>;
  selectPeriod: (id: string) => Promise<void>;
};
const C = createContext<State | null>(null);
export function WalletProvider({ children }: PropsWithChildren) {
  const [loading, setLoading] = useState(true),
    [onboarded, setOnboarded] = useState(false),
    [period, setPeriod] = useState<AllowancePeriod | null>(null),
    [periods, setPeriods] = useState<AllowancePeriod[]>([]),
    [transactions, setTransactions] = useState<WalletTransaction[]>([]),
    [reserves, setReserves] = useState<Reserve[]>([]),
    [categories, setCategories] = useState<Category[]>([]),
    [error, setError] = useState<string | null>(null),
    [lastBackupExportAt, setLastExport] = useState<string | null>(null),
    [revision, setRevision] = useState(0),
    [today, setToday] = useState(todayLocal());
  const selectedId = useRef<string | undefined>(undefined);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    try {
      const data = await repo.getWalletSnapshot(selectedId.current);
      const cats = await repo.listCategories();
      if (request !== generation.current) return;
      setError(null);
      setToday(todayLocal());
      setOnboarded(data.onboarded);
      setPeriods(data.periods);
      setPeriod(data.period);
      setTransactions(data.transactions);
      setReserves(data.reserves);
      setCategories(cats);
      setLastExport(data.lastBackupExportAt);
      setRevision((v) => v + 1);
    } catch (e) {
      if (request === generation.current)
        setError(
          e instanceof Error ? e.message : "Unable to open the local database.",
        );
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, []);
  const selectPeriod = useCallback(
    async (id: string) => {
      selectedId.current = id;
      await refresh();
    },
    [refresh],
  );
  useEffect(() => {
    void Promise.resolve().then(refresh);
    let observed = todayLocal();
    let offset = new Date().getTimezoneOffset();
    const timer = setInterval(() => {
      if (AppState.currentState !== "active") return;
      const day = todayLocal();
      const nextOffset = new Date().getTimezoneOffset();
      if (day !== observed || offset !== nextOffset) {
        observed = day;
        offset = nextOffset;
        void refresh();
      }
    }, 1000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [refresh]);
  const budget = useMemo(
    () =>
      period ? calculateBudget(period, transactions, reserves, today) : null,
    [period, transactions, reserves, today],
  );
  return (
    <C.Provider
      value={{
        loading,
        onboarded,
        period,
        periods,
        transactions,
        reserves,
        categories,
        budget,
        error,
        lastBackupExportAt,
        revision,
        refresh,
        selectPeriod,
      }}
    >
      {children}
    </C.Provider>
  );
}
export function useWallet() {
  const v = useContext(C);
  if (!v) throw new Error("WalletProvider missing");
  return v;
}
