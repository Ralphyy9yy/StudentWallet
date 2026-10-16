import { calculateBudget } from "@/domain/budget";
import { inclusiveDays, isValidDate } from "@/domain/dates";
import { parseMoney, formatMoney, moneyInput } from "@/domain/money";
import type {
  AllowancePeriod,
  Reserve,
  WalletTransaction,
} from "@/domain/models";
const period: AllowancePeriod = {
  id: "p",
  name: "Allowance",
  startDate: "2026-10-07",
  endDate: "2026-10-16",
  initialAmountCentavos: 150000,
  createdAt: "",
  updatedAt: "",
};
const reserve: Reserve = {
  id: "r",
  periodId: "p",
  name: "Transport",
  allocatedCentavos: 30000,
  releasedCentavos: 0,
  spentCentavos: 0,
  archivedAt: null,
  createdAt: "",
  updatedAt: "",
};
const expense = (
  amount: number,
  reserveId: string | null = null,
): WalletTransaction => ({
  id: `x${amount}`,
  periodId: "p",
  type: "expense",
  amountCentavos: amount,
  categoryId: "food",
  reserveId,
  occurredOn: "2026-10-16",
  note: null,
  createdAt: "",
  updatedAt: "",
});
describe("money", () => {
  test("safe upper bound round-trips without losing centavos", () => {
    const amount = Number.MAX_SAFE_INTEGER;
    expect(parseMoney(moneyInput(amount))).toBe(amount);
    expect(formatMoney(amount)).toBe("₱90,071,992,547,409.91");
    expect(() => parseMoney("90071992547409.92")).toThrow();
  });
  test.each([
    ["0.01", 1],
    ["1", 100],
    ["1500.00", 150000],
  ])("parses %s exactly", (v, w) => expect(parseMoney(v)).toBe(w));
  test.each(["0", "-1", "1.005", "1e3", "1,000", "₱1"])("rejects %s", (v) =>
    expect(() => parseMoney(v)).toThrow(),
  );
});
describe("calendar dates", () => {
  test("uses inclusive days across leap day", () =>
    expect(inclusiveDays("2024-02-28", "2024-03-01")).toBe(3));
  test("rejects impossible dates", () =>
    expect(isValidDate("2026-02-30")).toBe(false));
});
describe("budget", () => {
  test("upcoming periods use the full inclusive length", () => {
    const b = calculateBudget(period, [], [reserve], "2026-10-01");
    expect(b.status).toBe("upcoming");
    expect(b.remainingDays).toBe(10);
    expect(b.dailyGuideCentavos).toBe(12000);
  });
  test("one-day periods do not divide by zero", () => {
    const b = calculateBudget(
      { ...period, startDate: "2026-10-16" },
      [],
      [],
      "2026-10-16",
    );
    expect(b.remainingDays).toBe(1);
    expect(b.dailyGuideCentavos).toBe(150000);
  });
  test("aggregate overflow and negative outstanding reserves are rejected", () => {
    expect(() =>
      calculateBudget(
        { ...period, initialAmountCentavos: Number.MAX_SAFE_INTEGER },
        [{ ...expense(1), type: "top_up", categoryId: null }],
        [],
        "2026-10-16",
      ),
    ).toThrow();
    expect(() =>
      calculateBudget(
        period,
        [],
        [{ ...reserve, spentCentavos: 30001 }],
        "2026-10-16",
      ),
    ).toThrow();
  });
  test("matches the worked flexible-spending example", () => {
    const b = calculateBudget(period, [expense(5000)], [reserve], "2026-10-07");
    expect(b.balanceCentavos).toBe(145000);
    expect(b.flexibleCentavos).toBe(115000);
    expect(b.dailyGuideCentavos).toBe(11500);
  });
  test("reserved spending does not reduce flexible funds twice", () => {
    const b = calculateBudget(
      period,
      [expense(5000, "r")],
      [{ ...reserve, spentCentavos: 5000 }],
      "2026-10-07",
    );
    expect(b.balanceCentavos).toBe(145000);
    expect(b.reservedCentavos).toBe(25000);
    expect(b.flexibleCentavos).toBe(120000);
    expect(b.dailyGuideCentavos).toBe(12000);
  });
  test("ended periods have no guide", () =>
    expect(
      calculateBudget(period, [], [], "2026-10-17").dailyGuideCentavos,
    ).toBeNull());
});
