import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { listHistory } from "@/db/database";
import type { WalletTransaction } from "@/domain/models";
import { TransactionRow } from "@/features/transactions/TransactionRow";
import { useWallet } from "@/features/wallet/WalletContext";
import { AppText, Button, EmptyState, Screen } from "@/ui/components";
export default function Transactions() {
  const { periods, categories, selectPeriod, revision } = useWallet();
  const [filter, setFilter] = useState<"all" | "expense" | "top_up">("all"),
    [periodId, setPeriodId] = useState<string | undefined>(),
    [categoryId, setCategoryId] = useState<string | undefined>(),
    [rows, setRows] = useState<WalletTransaction[]>([]),
    [busy, setBusy] = useState(false),
    [more, setMore] = useState(false);
  const generation = useRef(0);
  const load = useCallback(
    async (cursor?: { occurredOn: string; id: string }) => {
      const request = ++generation.current;
      setBusy(true);
      try {
        const next = await listHistory({
          periodId,
          categoryId,
          type: filter === "all" ? undefined : filter,
          cursor,
        });
        if (request !== generation.current) return;
        setRows((old) => (cursor ? [...old, ...next] : next));
        setMore(next.length === 50);
      } catch (e) {
        Alert.alert(
          "Could not load history",
          e instanceof Error ? e.message : "Try again.",
        );
      } finally {
        if (request === generation.current) setBusy(false);
      }
    },
    [periodId, categoryId, filter],
  );
  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load, revision]);
  async function open(t: WalletTransaction) {
    await selectPeriod(t.periodId);
    router.push(`/transactions/${t.id}`);
  }
  return (
    <Screen>
      <AppText variant="title">Transactions</AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(["all", "expense", "top_up"] as const).map((x) => (
          <Button
            key={x}
            title={
              x === "all" ? "All" : x === "expense" ? "Expenses" : "Top-ups"
            }
            variant={filter === x ? "primary" : "secondary"}
            onPress={() => setFilter(x)}
          />
        ))}
      </View>
      <AppText variant="label">Allowance period</AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button
          title="All periods"
          variant={!periodId ? "primary" : "secondary"}
          onPress={() => setPeriodId(undefined)}
        />
        {periods.map((p) => (
          <Button
            key={p.id}
            title={p.name}
            variant={periodId === p.id ? "primary" : "secondary"}
            onPress={() => setPeriodId(p.id)}
          />
        ))}
      </View>
      <AppText variant="label">Category</AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button
          title="All categories"
          variant={!categoryId ? "primary" : "secondary"}
          onPress={() => setCategoryId(undefined)}
        />
        {categories.map((c) => (
          <Button
            key={c.id}
            title={c.name}
            variant={categoryId === c.id ? "primary" : "secondary"}
            onPress={() => setCategoryId(c.id)}
          />
        ))}
      </View>
      <Button
        title="Add expense"
        onPress={() => router.push("/transactions/new")}
      />
      <Button
        title="Add allowance top-up"
        variant="secondary"
        onPress={() => router.push("/transactions/new?type=top_up")}
      />
      {rows.map((t, i) => (
        <View key={t.id}>
          {(i === 0 || rows[i - 1].occurredOn !== t.occurredOn) && (
            <AppText variant="label">{t.occurredOn}</AppText>
          )}
          <TransactionRow item={t} onPress={() => open(t)} />
        </View>
      ))}
      {!rows.length && !busy && (
        <EmptyState
          title="No matching transactions"
          body="Try another filter or add an expense."
        />
      )}
      {busy && <AppText>Loading history...</AppText>}
      {more && (
        <Button
          title="Load more"
          disabled={busy}
          variant="secondary"
          onPress={() => {
            const t = rows[rows.length - 1];
            void load({ occurredOn: t.occurredOn, id: t.id });
          }}
        />
      )}
    </Screen>
  );
}
