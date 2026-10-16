import { z } from "zod";
import { isValidDate, todayLocal } from "./dates";
import { validateFinancialState } from "./integrity";
import type { AllowancePeriod, Reserve, WalletTransaction } from "./models";
const id = z.string().uuid();
const categoryId = z.string().min(1).max(100);
const name = z.string().trim().min(1).max(60);
const amount = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const zeroAmount = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const stamp = z.string().datetime();
const date = z.string().refine(isValidDate, "Invalid calendar date");
const period = z
  .object({
    id,
    name,
    startDate: date,
    endDate: date,
    initialAmountCentavos: amount,
    createdAt: stamp,
    updatedAt: stamp,
  })
  .strict();
const transaction = z
  .object({
    id,
    periodId: id,
    type: z.enum(["expense", "top_up"]),
    amountCentavos: amount,
    categoryId: categoryId.nullable(),
    reserveId: id.nullable(),
    occurredOn: date,
    note: z.string().max(500).nullable(),
    createdAt: stamp,
    updatedAt: stamp,
  })
  .strict();
const reserve = z
  .object({
    id,
    periodId: id,
    name,
    allocatedCentavos: amount,
    releasedCentavos: zeroAmount,
    archivedAt: stamp.nullable(),
    createdAt: stamp,
    updatedAt: stamp,
  })
  .strict();
const category = z
  .object({
    id: categoryId,
    name,
    iconKey: z.string().min(1).max(60),
    archived: z.boolean(),
  })
  .strict();
export const backupSchema = z
  .object({
    format: z.literal("studentwallet.backup"),
    backupSchemaVersion: z.literal(1),
    appVersion: z.string().min(1).max(60),
    exportedAt: stamp,
    data: z
      .object({
        allowancePeriods: z.array(period),
        transactions: z.array(transaction),
        reserves: z.array(reserve),
        categories: z.array(category),
        settings: z
          .object({
            onboardingComplete: z.boolean(),
            displayName: z.string().max(60).nullable(),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();
export type Backup = z.infer<typeof backupSchema>;
const legacySchema = backupSchema
  .extend({
    data: z
      .object({
        allowancePeriods: z.array(
          z
            .object({
              id,
              name,
              start_date: date,
              end_date: date,
              initial_amount_centavos: amount,
              created_at: stamp,
              updated_at: stamp,
            })
            .strict(),
        ),
        transactions: z.array(
          z
            .object({
              id,
              period_id: id,
              type: z.enum(["expense", "top_up"]),
              amount_centavos: amount,
              category_id: categoryId.nullable(),
              reserve_id: id.nullable(),
              occurred_on: date,
              note: z.string().max(500).nullable(),
              created_at: stamp,
              updated_at: stamp,
            })
            .strict(),
        ),
        reserves: z.array(
          z
            .object({
              id,
              period_id: id,
              name,
              allocated_centavos: amount,
              released_centavos: zeroAmount,
              archived_at: stamp.nullable(),
              created_at: stamp,
              updated_at: stamp,
            })
            .strict(),
        ),
        categories: z.array(
          z
            .object({
              id: categoryId,
              name,
              icon_key: z.string().min(1).max(60),
              archived: z.union([z.literal(0), z.literal(1)]),
            })
            .strict(),
        ),
        settings: z
          .object({
            onboarding_complete: z.union([z.literal(0), z.literal(1)]),
            display_name: z.string().max(60).nullable(),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();
/** Explicit adapter for the initial development build's snake_case v1 exports. */
export function parseBackup(input: unknown): Backup {
  const canonical = backupSchema.safeParse(input);
  if (canonical.success) return validateBackup(canonical.data);
  const legacy = legacySchema.safeParse(input);
  if (legacy.success) return portableBackup(legacy.data);
  throw new Error(
    "Invalid or unsupported StudentWallet backup. Check the format, schema version, and record fields.",
  );
}
export function validateBackup(input: unknown, today = todayLocal()): Backup {
  const b = backupSchema.parse(input);
  const d = b.data;
  if (
    d.allowancePeriods.length +
      d.transactions.length +
      d.reserves.length +
      d.categories.length >
    50_000
  )
    throw new Error("Backup exceeds 50,000 records.");
  for (const rows of [
    d.allowancePeriods,
    d.transactions,
    d.reserves,
    d.categories,
  ])
    if (new Set(rows.map((r) => r.id)).size !== rows.length)
      throw new Error("Backup contains duplicate IDs.");
  const periods = new Map(d.allowancePeriods.map((p) => [p.id, p]));
  const reserves = new Map(d.reserves.map((r) => [r.id, r]));
  const categories = new Set(d.categories.map((c) => c.id));
  if (d.settings.onboardingComplete && !d.categories.some((c) => !c.archived))
    throw new Error("An onboarded wallet needs an available expense category.");
  for (const r of d.reserves)
    if (!periods.has(r.periodId))
      throw new Error("Reserve references a missing period.");
  for (const t of d.transactions) {
    if (
      !periods.has(t.periodId) ||
      (t.categoryId && !categories.has(t.categoryId)) ||
      (t.reserveId && reserves.get(t.reserveId)?.periodId !== t.periodId)
    )
      throw new Error(
        "Transaction contains a missing or cross-period reference.",
      );
  }
  const ordered = [...d.allowancePeriods].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );
  for (let i = 1; i < ordered.length; i++)
    if (ordered[i - 1].endDate >= ordered[i].startDate)
      throw new Error("Backup contains overlapping periods.");
  for (const p of d.allowancePeriods)
    validateFinancialState(
      p as AllowancePeriod,
      d.transactions.filter((t) => t.periodId === p.id) as WalletTransaction[],
      d.reserves
        .filter((r) => r.periodId === p.id)
        .map((r) => ({ ...r, spentCentavos: 0 })) as Reserve[],
      today,
    );
  if (d.settings.onboardingComplete && !d.allowancePeriods.length)
    throw new Error("An onboarded wallet must contain an allowance period.");
  return b;
}
/** Database rows stay internal; portable v1 fields use the specified camelCase contract. */
export function portableBackup(raw: any): Backup {
  return validateBackup({
    format: raw.format,
    backupSchemaVersion: raw.backupSchemaVersion,
    appVersion: raw.appVersion,
    exportedAt: raw.exportedAt,
    data: {
      allowancePeriods: raw.data.allowancePeriods.map((p: any) => ({
        id: p.id,
        name: p.name,
        startDate: p.start_date,
        endDate: p.end_date,
        initialAmountCentavos: p.initial_amount_centavos,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      })),
      transactions: raw.data.transactions.map((t: any) => ({
        id: t.id,
        periodId: t.period_id,
        type: t.type,
        amountCentavos: t.amount_centavos,
        categoryId: t.category_id,
        reserveId: t.reserve_id,
        occurredOn: t.occurred_on,
        note: t.note,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      })),
      reserves: raw.data.reserves.map((r: any) => ({
        id: r.id,
        periodId: r.period_id,
        name: r.name,
        allocatedCentavos: r.allocated_centavos,
        releasedCentavos: r.released_centavos,
        archivedAt: r.archived_at,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
      categories: raw.data.categories.map((c: any) => ({
        id: c.id,
        name: c.name,
        iconKey: c.icon_key,
        archived: !!c.archived,
      })),
      settings: {
        onboardingComplete: !!raw.data.settings.onboarding_complete,
        displayName: raw.data.settings.display_name,
      },
    },
  });
}
export function databaseBackup(b: Backup) {
  return {
    allowancePeriods: b.data.allowancePeriods.map((p) => ({
      id: p.id,
      name: p.name,
      start_date: p.startDate,
      end_date: p.endDate,
      initial_amount_centavos: p.initialAmountCentavos,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
    })),
    transactions: b.data.transactions.map((t) => ({
      id: t.id,
      period_id: t.periodId,
      type: t.type,
      amount_centavos: t.amountCentavos,
      category_id: t.categoryId,
      reserve_id: t.reserveId,
      occurred_on: t.occurredOn,
      note: t.note,
      created_at: t.createdAt,
      updated_at: t.updatedAt,
    })),
    reserves: b.data.reserves.map((r) => ({
      id: r.id,
      period_id: r.periodId,
      name: r.name,
      allocated_centavos: r.allocatedCentavos,
      released_centavos: r.releasedCentavos,
      archived_at: r.archivedAt,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
    })),
    categories: b.data.categories.map((c) => ({
      id: c.id,
      name: c.name,
      icon_key: c.iconKey,
      archived: c.archived ? 1 : 0,
    })),
    settings: {
      onboarding_complete: b.data.settings.onboardingComplete ? 1 : 0,
      display_name: b.data.settings.displayName,
    },
  };
}
