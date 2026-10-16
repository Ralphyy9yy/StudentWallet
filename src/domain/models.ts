export type LocalDate = `${number}-${number}-${number}`;
export type TransactionType = "expense" | "top_up";

export interface AllowancePeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  initialAmountCentavos: number;
  createdAt: string;
  updatedAt: string;
}
export interface Category {
  id: string;
  name: string;
  iconKey: string;
  archived: boolean;
}
export interface Reserve {
  id: string;
  periodId: string;
  name: string;
  allocatedCentavos: number;
  releasedCentavos: number;
  spentCentavos: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface WalletTransaction {
  id: string;
  periodId: string;
  type: TransactionType;
  amountCentavos: number;
  categoryId: string | null;
  categoryName?: string | null;
  reserveId: string | null;
  reserveName?: string | null;
  occurredOn: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface BudgetSummary {
  totalFundsCentavos: number;
  balanceCentavos: number;
  reservedCentavos: number;
  flexibleCentavos: number;
  remainingDays: number;
  dailyGuideCentavos: number | null;
  status: "upcoming" | "active" | "ended";
  shortfallCentavos: number;
}
