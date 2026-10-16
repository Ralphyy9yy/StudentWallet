import { isValidDate, todayLocal } from "./dates";
import { calculateBudget } from "./budget";
import type { AllowancePeriod, Reserve, WalletTransaction } from "./models";

export function checkedSum(values: number[]): number {
  let sum = 0;
  for (const value of values) {
    if (
      !Number.isSafeInteger(value) ||
      value < 0 ||
      sum > Number.MAX_SAFE_INTEGER - value
    )
      throw new Error("Financial total exceeds the supported monetary limit.");
    sum += value;
  }
  return sum;
}
export function validateAmount(value: number, allowZero = false) {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1))
    throw new Error("Enter a valid centavo amount within the supported limit.");
}
export function validateName(value: string) {
  if (!value.trim() || value.trim().length > 60)
    throw new Error("Names must contain 1 to 60 characters.");
}
export function validatePeriod(period: AllowancePeriod) {
  validateName(period.name);
  validateAmount(period.initialAmountCentavos);
  if (
    !isValidDate(period.startDate) ||
    !isValidDate(period.endDate) ||
    period.startDate > period.endDate
  )
    throw new Error("Enter a valid inclusive date range.");
}
export function validateFinancialState(
  period: AllowancePeriod,
  transactions: WalletTransaction[],
  reserves: Reserve[],
  today = todayLocal(),
) {
  validatePeriod(period);
  const reserveMap = new Map(reserves.map((r) => [r.id, r]));
  const spent = new Map<string, number[]>();
  for (const t of transactions) {
    validateAmount(t.amountCentavos);
    if (
      t.periodId !== period.id ||
      !isValidDate(t.occurredOn) ||
      t.occurredOn < period.startDate ||
      t.occurredOn > period.endDate ||
      t.occurredOn > today
    )
      throw new Error(
        "Transaction date must be inside its period and no later than today.",
      );
    if (t.type === "top_up" && (t.categoryId || t.reserveId))
      throw new Error("Top-ups cannot have a category or reserve.");
    if (t.type === "expense" && !t.categoryId)
      throw new Error("Choose an expense category.");
    if ((t.note?.length ?? 0) > 500)
      throw new Error("Notes cannot exceed 500 characters.");
    if (t.reserveId) {
      if (!reserveMap.has(t.reserveId))
        throw new Error("Reserve must belong to this allowance period.");
      const amounts = spent.get(t.reserveId) ?? [];
      amounts.push(t.amountCentavos);
      spent.set(t.reserveId, amounts);
    }
  }
  const derived = reserves.map((r) => {
    validateName(r.name);
    validateAmount(r.allocatedCentavos);
    validateAmount(r.releasedCentavos, true);
    if (r.periodId !== period.id)
      throw new Error("Reserve belongs to another period.");
    const spentCentavos = checkedSum(spent.get(r.id) ?? []);
    if (checkedSum([r.releasedCentavos, spentCentavos]) > r.allocatedCentavos)
      throw new Error("Expense exceeds the reserve remaining amount.");
    return { ...r, spentCentavos };
  });
  checkedSum([
    period.initialAmountCentavos,
    ...transactions
      .filter((t) => t.type === "top_up")
      .map((t) => t.amountCentavos),
  ]);
  checkedSum(
    transactions
      .filter((t) => t.type === "expense")
      .map((t) => t.amountCentavos),
  );
  checkedSum(
    derived.map(
      (r) => r.allocatedCentavos - r.releasedCentavos - r.spentCentavos,
    ),
  );
  return calculateBudget(period, transactions, derived, today);
}
