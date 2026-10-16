import { inclusiveDays } from "./dates";
import type {
  AllowancePeriod,
  BudgetSummary,
  Reserve,
  WalletTransaction,
} from "./models";
export function calculateBudget(
  period: AllowancePeriod,
  transactions: WalletTransaction[],
  reserves: Reserve[],
  today: string,
): BudgetSummary {
  const integer = (value: number) => {
    if (!Number.isSafeInteger(value))
      throw new Error("Unsafe monetary amount.");
    return BigInt(value);
  };
  const safe = (value: bigint) => {
    if (
      value > BigInt(Number.MAX_SAFE_INTEGER) ||
      value < BigInt(Number.MIN_SAFE_INTEGER)
    )
      throw new Error("Financial aggregate exceeds the supported limit.");
    return Number(value);
  };
  const topUps = transactions
    .filter((t) => t.type === "top_up")
    .reduce((s, t) => s + integer(t.amountCentavos), 0n);
  const expenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + integer(t.amountCentavos), 0n);
  const reserveSum = reserves.reduce((s, r) => {
    const outstanding =
      integer(r.allocatedCentavos) -
      integer(r.releasedCentavos) -
      integer(r.spentCentavos);
    if (outstanding < 0n) throw new Error("Reserve is overdrawn.");
    return s + outstanding;
  }, 0n);
  const total = safe(integer(period.initialAmountCentavos) + topUps);
  safe(expenses);
  const reserved = safe(reserveSum);
  const balance = safe(BigInt(total) - expenses);
  const flexible = safe(BigInt(balance) - reserveSum);
  const status =
    today < period.startDate
      ? "upcoming"
      : today > period.endDate
        ? "ended"
        : "active";
  const days =
    status === "ended"
      ? 0
      : status === "upcoming"
        ? inclusiveDays(period.startDate, period.endDate)
        : inclusiveDays(today, period.endDate);
  return {
    totalFundsCentavos: total,
    balanceCentavos: balance,
    reservedCentavos: reserved,
    flexibleCentavos: flexible,
    remainingDays: days,
    dailyGuideCentavos:
      status === "ended"
        ? null
        : Number(BigInt(Math.max(0, flexible)) / BigInt(days)),
    status,
    shortfallCentavos: Math.max(0, -flexible),
  };
}
