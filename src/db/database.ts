import * as SQLite from "expo-sqlite";
import * as Crypto from "expo-crypto";
import type {
  AllowancePeriod,
  Category,
  Reserve,
  WalletTransaction,
  BudgetSummary,
} from "@/domain/models";
import {
  validateFinancialState,
  validateName,
  validateAmount,
  validatePeriod,
} from "@/domain/integrity";
import { todayLocal } from "@/domain/dates";
import { createOperationQueue } from "./queue";
import { transactionCommandSchema } from "@/domain/commands";

type Row = Record<string, any>;
const enqueue = createOperationQueue();
let connection: SQLite.SQLiteDatabase | undefined;
const mapPeriod = (r: Row): AllowancePeriod => ({
  id: r.id,
  name: r.name,
  startDate: r.start_date,
  endDate: r.end_date,
  initialAmountCentavos: r.initial_amount_centavos,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const mapTx = (r: Row): WalletTransaction => ({
  id: r.id,
  periodId: r.period_id,
  type: r.type,
  amountCentavos: r.amount_centavos,
  categoryId: r.category_id,
  categoryName: r.category_name,
  reserveId: r.reserve_id,
  reserveName: r.reserve_name,
  occurredOn: r.occurred_on,
  note: r.note,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const mapReserve = (r: Row): Reserve => ({
  id: r.id,
  periodId: r.period_id,
  name: r.name,
  allocatedCentavos: r.allocated_centavos,
  releasedCentavos: r.released_centavos,
  spentCentavos: r.spent ?? 0,
  archivedAt: r.archived_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

async function db() {
  if (connection) return connection;
  const opened = await SQLite.openDatabaseAsync("studentwallet.db");
  try {
    await migrate(opened);
    connection = opened;
    return opened;
  } catch (error) {
    await opened.closeAsync();
    throw error;
  }
}
async function atomic<T>(
  database: SQLite.SQLiteDatabase,
  work: () => Promise<T>,
): Promise<T> {
  await database.execAsync("BEGIN IMMEDIATE");
  try {
    const result = await work();
    await database.execAsync("COMMIT");
    return result;
  } catch (error) {
    await database.execAsync("ROLLBACK");
    throw error;
  }
}
export async function migrate(database: SQLite.SQLiteDatabase) {
  await database.execAsync(
    "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=1500;",
  );
  const version = (await database.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  ))!.user_version;
  if (version > 2)
    throw new Error(
      "This database requires a newer version of StudentWallet. Update the app; your data has not been reset.",
    );
  await atomic(database, async () => {
    if (version < 1)
      await database.execAsync(`
      CREATE TABLE allowance_periods(id TEXT PRIMARY KEY,name TEXT NOT NULL,start_date TEXT NOT NULL,end_date TEXT NOT NULL,initial_amount_centavos INTEGER NOT NULL CHECK(typeof(initial_amount_centavos)='integer' AND initial_amount_centavos>0),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,CHECK(start_date<=end_date));
      CREATE TABLE categories(id TEXT PRIMARY KEY,name TEXT NOT NULL,icon_key TEXT NOT NULL,archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN(0,1)));
      CREATE TABLE reserves(id TEXT PRIMARY KEY,period_id TEXT NOT NULL,name TEXT NOT NULL,allocated_centavos INTEGER NOT NULL CHECK(allocated_centavos>0),released_centavos INTEGER NOT NULL DEFAULT 0 CHECK(released_centavos>=0 AND released_centavos<=allocated_centavos),archived_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(id,period_id),FOREIGN KEY(period_id) REFERENCES allowance_periods(id) ON DELETE RESTRICT);
      CREATE TABLE transactions(id TEXT PRIMARY KEY,period_id TEXT NOT NULL,type TEXT NOT NULL CHECK(type IN('expense','top_up')),amount_centavos INTEGER NOT NULL CHECK(amount_centavos>0),category_id TEXT,reserve_id TEXT,occurred_on TEXT NOT NULL,note TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,FOREIGN KEY(period_id) REFERENCES allowance_periods(id) ON DELETE RESTRICT,FOREIGN KEY(category_id) REFERENCES categories(id),FOREIGN KEY(reserve_id,period_id) REFERENCES reserves(id,period_id));
      CREATE TABLE settings(id INTEGER PRIMARY KEY CHECK(id=1),onboarding_complete INTEGER NOT NULL DEFAULT 0,display_name TEXT,last_backup_export_at TEXT);
      CREATE INDEX idx_tx_period_date ON transactions(period_id,occurred_on DESC,id DESC);
      CREATE INDEX idx_tx_reserve ON transactions(reserve_id);
      CREATE INDEX idx_reserve_period ON reserves(period_id);
      INSERT INTO settings(id,onboarding_complete) VALUES(1,0);`);
    if (version < 2) {
      // Add guards without rebuilding or discarding existing financial records.
      await database.execAsync(`CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(period_id,category_id,occurred_on);
        CREATE TABLE IF NOT EXISTS commands(id TEXT PRIMARY KEY,payload TEXT NOT NULL);
        CREATE TRIGGER IF NOT EXISTS tx_guard_insert BEFORE INSERT ON transactions BEGIN
          SELECT CASE WHEN typeof(NEW.amount_centavos)<>'integer' OR NEW.amount_centavos>9007199254740991 OR
          (NEW.type='expense' AND NEW.category_id IS NULL) OR (NEW.type='top_up' AND (NEW.category_id IS NOT NULL OR NEW.reserve_id IS NOT NULL)) THEN RAISE(ABORT,'Invalid transaction fields') END;
        END;
        CREATE TRIGGER IF NOT EXISTS tx_guard_update BEFORE UPDATE ON transactions BEGIN
          SELECT CASE WHEN typeof(NEW.amount_centavos)<>'integer' OR NEW.amount_centavos>9007199254740991 OR
          (NEW.type='expense' AND NEW.category_id IS NULL) OR (NEW.type='top_up' AND (NEW.category_id IS NOT NULL OR NEW.reserve_id IS NOT NULL)) THEN RAISE(ABORT,'Invalid transaction fields') END;
        END;
        PRAGMA user_version=2;`);
      for (const table of ["allowance_periods", "reserves"] as const) {
        const fields =
          table === "reserves"
            ? ["allocated_centavos", "released_centavos"]
            : ["initial_amount_centavos"];
        const invalid = fields
          .map(
            (f) => `typeof(NEW.${f})<>'integer' OR NEW.${f}>9007199254740991`,
          )
          .join(" OR ");
        for (const action of ["INSERT", "UPDATE"])
          await database.execAsync(
            `CREATE TRIGGER IF NOT EXISTS ${table}_safe_${action} BEFORE ${action} ON ${table} BEGIN SELECT CASE WHEN ${invalid} THEN RAISE(ABORT,'Unsafe monetary amount') END; END;`,
          );
      }
    }
    for (const c of [
      ["food", "Food", "restaurant"],
      ["transport", "Transport", "bus"],
      ["school", "School", "book"],
      ["personal", "Personal", "person"],
      ["other", "Other", "ellipsis"],
    ])
      await database.runAsync(
        "INSERT OR IGNORE INTO categories VALUES(?,?,?,0)",
        ...c,
      );
    if ((await database.getAllAsync("PRAGMA foreign_key_check")).length)
      throw new Error(
        "Database has broken references. Your data has not been reset.",
      );
    const ordered = (await periods(database)).reverse();
    for (let i = 1; i < ordered.length; i++)
      if (ordered[i - 1].endDate >= ordered[i].startDate)
        throw new Error(
          "Database has overlapping allowance periods. Your data has not been reset.",
        );
    for (const period of ordered) {
      const s = await snapshot(database, period.id);
      validateFinancialState(s.period, s.transactions, s.reserves);
    }
  });
}
async function periods(database: SQLite.SQLiteDatabase) {
  return (
    await database.getAllAsync<Row>(
      "SELECT * FROM allowance_periods ORDER BY start_date DESC",
    )
  ).map(mapPeriod);
}
async function transactions(
  database: SQLite.SQLiteDatabase,
  periodId?: string,
) {
  return (
    await database.getAllAsync<Row>(
      `SELECT t.*,c.name category_name,r.name reserve_name FROM transactions t LEFT JOIN categories c ON c.id=t.category_id LEFT JOIN reserves r ON r.id=t.reserve_id ${periodId ? "WHERE t.period_id=?" : ""} ORDER BY t.occurred_on DESC,t.id DESC`,
      ...(periodId ? [periodId] : []),
    )
  ).map(mapTx);
}
async function reserves(database: SQLite.SQLiteDatabase, periodId: string) {
  return (
    await database.getAllAsync<Row>(
      `SELECT r.*,COALESCE((SELECT SUM(t.amount_centavos) FROM transactions t WHERE t.reserve_id=r.id),0) spent FROM reserves r WHERE period_id=? ORDER BY created_at`,
      periodId,
    )
  ).map(mapReserve);
}
async function snapshot(database: SQLite.SQLiteDatabase, id: string) {
  const row = await database.getFirstAsync<Row>(
    "SELECT * FROM allowance_periods WHERE id=?",
    id,
  );
  if (!row) throw new Error("Allowance period no longer exists.");
  return {
    period: mapPeriod(row),
    transactions: await transactions(database, id),
    reserves: await reserves(database, id),
  };
}
export const listPeriods = () => enqueue(async () => periods(await db()));
export const listTransactions = (periodId?: string) =>
  enqueue(async () => transactions(await db(), periodId));
export const listReserves = (periodId: string) =>
  enqueue(async () => reserves(await db(), periodId));
export const isOnboarded = () =>
  enqueue(
    async () =>
      !!(
        await (
          await db()
        ).getFirstAsync<Row>(
          "SELECT onboarding_complete FROM settings WHERE id=1",
        )
      )?.onboarding_complete,
  );
export const listCategories = () =>
  enqueue(async (): Promise<Category[]> =>
    (
      await (
        await db()
      ).getAllAsync<Row>(
        "SELECT * FROM categories WHERE archived=0 ORDER BY rowid",
      )
    ).map((r) => ({
      id: r.id,
      name: r.name,
      iconKey: r.icon_key,
      archived: !!r.archived,
    })),
  );
export const activePeriod = (today: string) =>
  enqueue(
    async () =>
      (await periods(await db())).find(
        (p) => p.startDate <= today && p.endDate >= today,
      ) ?? null,
  );
export const latestPeriod = () =>
  enqueue(async () => (await periods(await db()))[0] ?? null);
export const getWalletSnapshot = (selectedId?: string) =>
  enqueue(async () => {
    const database = await db();
    const all = await periods(database);
    const today = todayLocal();
    const selected =
      all.find((p) => p.id === selectedId) ??
      all.find((p) => p.startDate <= today && p.endDate >= today) ??
      [...all].reverse().find((p) => p.startDate > today) ??
      all[0] ??
      null;
    const settings = await database.getFirstAsync<Row>(
      "SELECT * FROM settings WHERE id=1",
    );
    return {
      periods: all,
      period: selected,
      transactions: selected ? await transactions(database, selected.id) : [],
      reserves: selected ? await reserves(database, selected.id) : [],
      onboarded: !!settings?.onboarding_complete,
      lastBackupExportAt: settings?.last_backup_export_at as string | null,
    };
  });
export const createPeriod = (
  input: {
    name: string;
    startDate: string;
    endDate: string;
    amount: number;
    displayName?: string;
    id?: string;
  },
  confirmation?: string,
) =>
  enqueue(async () => {
    const database = await db();
    return atomic(database, async () => {
      const now = new Date().toISOString();
      const period: AllowancePeriod = {
        id: input.id ?? Crypto.randomUUID(),
        name: input.name.trim(),
        startDate: input.startDate,
        endDate: input.endDate,
        initialAmountCentavos: input.amount,
        createdAt: now,
        updatedAt: now,
      };
      validatePeriod(period);
      if (
        !(await database.getFirstAsync("SELECT id FROM categories LIMIT 1"))
      ) {
        for (const c of [
          ["food", "Food", "restaurant"],
          ["transport", "Transport", "bus"],
          ["school", "School", "book"],
          ["personal", "Personal", "person"],
          ["other", "Other", "ellipsis"],
        ])
          await database.runAsync(
            "INSERT INTO categories VALUES(?,?,?,0)",
            ...c,
          );
      }
      if (
        await database.getFirstAsync(
          "SELECT id FROM allowance_periods WHERE start_date<=? AND end_date>=? AND id<>?",
          period.endDate,
          period.startDate,
          period.id,
        )
      )
        throw new Error("Allowance periods cannot overlap.");
      const existing = await database.getFirstAsync<Row>(
        "SELECT * FROM allowance_periods WHERE id=?",
        period.id,
      );
      if (input.id && !existing)
        throw new Error("Allowance period no longer exists.");
      if (
        input.displayName !== undefined &&
        input.displayName.trim().length > 60
      )
        throw new Error("Display name cannot exceed 60 characters.");
      if (existing) {
        const s = await snapshot(database, period.id);
        const before = validateFinancialState(
          s.period,
          s.transactions,
          s.reserves,
        );
        const after = validateFinancialState(
          period,
          s.transactions,
          s.reserves,
        );
        confirmDeficit(before, after, s, confirmation);
        await database.runAsync(
          "UPDATE allowance_periods SET name=?,start_date=?,end_date=?,initial_amount_centavos=?,updated_at=? WHERE id=?",
          period.name,
          period.startDate,
          period.endDate,
          period.initialAmountCentavos,
          now,
          period.id,
        );
      } else
        await database.runAsync(
          "INSERT INTO allowance_periods VALUES(?,?,?,?,?,?,?)",
          period.id,
          period.name,
          period.startDate,
          period.endDate,
          period.initialAmountCentavos,
          now,
          now,
        );
      await database.runAsync(
        "UPDATE settings SET onboarding_complete=1,display_name=COALESCE(?,display_name) WHERE id=1",
        input.displayName?.trim() || null,
      );
    });
  });

export class NeedsConfirmation extends Error {
  constructor(
    public fingerprint: string,
    public before: BudgetSummary,
    public after: BudgetSummary,
  ) {
    super("This change creates or increases a shortfall.");
  }
}
function confirmDeficit(
  before: BudgetSummary,
  after: BudgetSummary,
  state: unknown,
  token?: string,
) {
  const fingerprint = JSON.stringify(state);
  if (
    (after.balanceCentavos < Math.min(0, before.balanceCentavos) ||
      after.flexibleCentavos < Math.min(0, before.flexibleCentavos)) &&
    token !== fingerprint
  )
    throw new NeedsConfirmation(fingerprint, before, after);
}
export interface TransactionInput {
  id?: string;
  commandId?: string;
  periodId: string;
  type: "expense" | "top_up";
  amount: number;
  categoryId?: string | null;
  reserveId?: string | null;
  occurredOn: string;
  note?: string;
}
export const saveTransaction = (
  input: TransactionInput,
  confirmation?: string,
) =>
  enqueue(async () => {
    transactionCommandSchema.parse(input);
    const database = await db();
    return atomic(database, async () => {
      const commandId = input.commandId ?? Crypto.randomUUID();
      const payload = JSON.stringify(input);
      const prior = await database.getFirstAsync<{ payload: string }>(
        "SELECT payload FROM commands WHERE id=?",
        commandId,
      );
      if (prior) {
        if (prior.payload !== payload)
          throw new Error("This save was already used for different values.");
        return;
      }
      const s = await snapshot(database, input.periodId);
      const existing = input.id
        ? await database.getFirstAsync<Row>(
            "SELECT * FROM transactions WHERE id=?",
            input.id,
          )
        : null;
      if (input.id && (!existing || existing.period_id !== input.periodId))
        throw new Error("Transactions cannot move between periods.");
      const now = new Date().toISOString();
      const next: WalletTransaction = {
        id: input.id ?? commandId,
        periodId: input.periodId,
        type: input.type,
        amountCentavos: input.amount,
        categoryId: input.categoryId ?? null,
        reserveId: input.reserveId ?? null,
        occurredOn: input.occurredOn,
        note: input.note?.trim() || null,
        createdAt: existing?.created_at ?? now,
        updatedAt: now,
      };
      if (
        next.categoryId &&
        !(await database.getFirstAsync(
          "SELECT id FROM categories WHERE id=?",
          next.categoryId,
        ))
      )
        throw new Error("Category no longer exists.");
      const r = s.reserves.find((x) => x.id === next.reserveId);
      if (r?.archivedAt && existing?.reserve_id !== r.id)
        throw new Error("Archived reserves cannot receive new expenses.");
      const before = validateFinancialState(
        s.period,
        s.transactions,
        s.reserves,
      );
      const proposed = [
        ...s.transactions.filter((t) => t.id !== next.id),
        next,
      ];
      const after = validateFinancialState(s.period, proposed, s.reserves);
      confirmDeficit(before, after, s, confirmation);
      if (existing)
        await database.runAsync(
          "UPDATE transactions SET type=?,amount_centavos=?,category_id=?,reserve_id=?,occurred_on=?,note=?,updated_at=? WHERE id=?",
          next.type,
          next.amountCentavos,
          next.categoryId,
          next.reserveId,
          next.occurredOn,
          next.note,
          now,
          next.id,
        );
      else
        await database.runAsync(
          "INSERT INTO transactions VALUES(?,?,?,?,?,?,?,?,?,?)",
          next.id,
          next.periodId,
          next.type,
          next.amountCentavos,
          next.categoryId,
          next.reserveId,
          next.occurredOn,
          next.note,
          now,
          now,
        );
      await database.runAsync(
        "INSERT INTO commands VALUES(?,?)",
        commandId,
        payload,
      );
    });
  });
export const deleteTransaction = (id: string, confirmation?: string) =>
  enqueue(async () => {
    const database = await db();
    return atomic(database, async () => {
      const t = await database.getFirstAsync<Row>(
        "SELECT * FROM transactions WHERE id=?",
        id,
      );
      if (!t) return;
      const s = await snapshot(database, t.period_id);
      const before = validateFinancialState(
        s.period,
        s.transactions,
        s.reserves,
      );
      const after = validateFinancialState(
        s.period,
        s.transactions.filter((x) => x.id !== id),
        s.reserves,
      );
      confirmDeficit(before, after, s, confirmation);
      await database.runAsync("DELETE FROM transactions WHERE id=?", id);
    });
  });
export const createReserve = (
  periodId: string,
  name: string,
  amount: number,
  id?: string,
) =>
  enqueue(async () => {
    const database = await db();
    return atomic(database, async () => {
      validateName(name);
      validateAmount(amount);
      const s = await snapshot(database, periodId);
      const before = validateFinancialState(
        s.period,
        s.transactions,
        s.reserves,
      );
      const old = s.reserves.find((r) => r.id === id);
      if (id && !old)
        throw new Error("Reserve no longer exists in this period.");
      if (old?.archivedAt)
        throw new Error("Archived reserve cannot be changed.");
      const now = new Date().toISOString();
      const next: Reserve = {
        id: id ?? Crypto.randomUUID(),
        periodId,
        name: name.trim(),
        allocatedCentavos: amount,
        releasedCentavos: old?.releasedCentavos ?? 0,
        spentCentavos: old?.spentCentavos ?? 0,
        archivedAt: null,
        createdAt: old?.createdAt ?? now,
        updatedAt: now,
      };
      const after = validateFinancialState(s.period, s.transactions, [
        ...s.reserves.filter((r) => r.id !== next.id),
        next,
      ]);
      if (
        after.reservedCentavos > before.reservedCentavos &&
        after.reservedCentavos > Math.max(0, after.balanceCentavos)
      )
        throw new Error("Reserve exceeds available flexible funds.");
      if (old)
        await database.runAsync(
          "UPDATE reserves SET name=?,allocated_centavos=?,updated_at=? WHERE id=?",
          next.name,
          amount,
          now,
          next.id,
        );
      else
        await database.runAsync(
          "INSERT INTO reserves VALUES(?,?,?,?,?,?,?,?)",
          next.id,
          periodId,
          next.name,
          amount,
          0,
          null,
          now,
          now,
        );
    });
  });
export const releaseReserve = (id: string, amount?: number) =>
  enqueue(async () => {
    const database = await db();
    return atomic(database, async () => {
      const row = await database.getFirstAsync<Row>(
        "SELECT * FROM reserves WHERE id=?",
        id,
      );
      if (!row) throw new Error("Reserve not found.");
      const s = await snapshot(database, row.period_id);
      const r = s.reserves.find((x) => x.id === id)!;
      const outstanding =
        r.allocatedCentavos - r.releasedCentavos - r.spentCentavos;
      const released = amount ?? outstanding;
      validateAmount(released, true);
      if (released > outstanding)
        throw new Error("Release exceeds remaining reserve.");
      const now = new Date().toISOString();
      await database.runAsync(
        "UPDATE reserves SET released_centavos=released_centavos+?,archived_at=?,updated_at=? WHERE id=?",
        released,
        amount === undefined ? now : r.archivedAt,
        now,
        id,
      );
    });
  });
export const resetAll = () =>
  enqueue(async () => {
    const database = await db();
    return atomic(database, async () => {
      await database.execAsync(
        "DELETE FROM commands;DELETE FROM transactions;DELETE FROM reserves;DELETE FROM allowance_periods;DELETE FROM categories;",
      );
      await database.runAsync(
        "UPDATE settings SET onboarding_complete=0,display_name=NULL,last_backup_export_at=NULL WHERE id=1",
      );
      for (const c of [
        ["food", "Food", "restaurant"],
        ["transport", "Transport", "bus"],
        ["school", "School", "book"],
        ["personal", "Personal", "person"],
        ["other", "Other", "ellipsis"],
      ])
        await database.runAsync("INSERT INTO categories VALUES(?,?,?,0)", ...c);
    });
  });
export const markBackupSaved = (at: string) =>
  enqueue(async () => {
    await (
      await db()
    ).runAsync("UPDATE settings SET last_backup_export_at=? WHERE id=1", at);
  });
export const exportData = () =>
  enqueue(async () => {
    const database = await db();
    return atomic(database, async () => {
      for (const p of await periods(database)) {
        const s = await snapshot(database, p.id);
        validateFinancialState(s.period, s.transactions, s.reserves);
      }
      const settings = await database.getFirstAsync<Row>(
        "SELECT onboarding_complete,display_name FROM settings WHERE id=1",
      );
      return {
        format: "studentwallet.backup",
        backupSchemaVersion: 1,
        appVersion: "1.0.0",
        exportedAt: new Date().toISOString(),
        data: {
          allowancePeriods: await database.getAllAsync<Row>(
            "SELECT * FROM allowance_periods",
          ),
          transactions: await database.getAllAsync<Row>(
            "SELECT * FROM transactions",
          ),
          reserves: await database.getAllAsync<Row>("SELECT * FROM reserves"),
          categories: await database.getAllAsync<Row>(
            "SELECT * FROM categories",
          ),
          settings,
        },
      };
    });
  });
export const replaceFromBackup = (data: Row) =>
  enqueue(async () => {
    const database = await db();
    return atomic(database, async () => {
      await database.execAsync(
        "DELETE FROM commands;DELETE FROM transactions;DELETE FROM reserves;DELETE FROM allowance_periods;DELETE FROM categories;",
      );
      for (const c of data.categories)
        await database.runAsync(
          "INSERT INTO categories VALUES(?,?,?,?)",
          c.id,
          c.name,
          c.icon_key,
          c.archived,
        );
      for (const p of data.allowancePeriods)
        await database.runAsync(
          "INSERT INTO allowance_periods VALUES(?,?,?,?,?,?,?)",
          p.id,
          p.name,
          p.start_date,
          p.end_date,
          p.initial_amount_centavos,
          p.created_at,
          p.updated_at,
        );
      for (const r of data.reserves)
        await database.runAsync(
          "INSERT INTO reserves VALUES(?,?,?,?,?,?,?,?)",
          r.id,
          r.period_id,
          r.name,
          r.allocated_centavos,
          r.released_centavos,
          r.archived_at,
          r.created_at,
          r.updated_at,
        );
      for (const t of data.transactions)
        await database.runAsync(
          "INSERT INTO transactions VALUES(?,?,?,?,?,?,?,?,?,?)",
          t.id,
          t.period_id,
          t.type,
          t.amount_centavos,
          t.category_id,
          t.reserve_id,
          t.occurred_on,
          t.note,
          t.created_at,
          t.updated_at,
        );
      await database.runAsync(
        "UPDATE settings SET onboarding_complete=?,display_name=?,last_backup_export_at=NULL WHERE id=1",
        data.settings.onboarding_complete,
        data.settings.display_name,
      );
      if ((await database.getAllAsync("PRAGMA foreign_key_check")).length)
        throw new Error("Backup contains broken references.");
      for (const p of await periods(database)) {
        const s = await snapshot(database, p.id);
        validateFinancialState(s.period, s.transactions, s.reserves);
      }
    });
  });
export const listHistory = (filter: {
  periodId?: string;
  categoryId?: string;
  type?: string;
  cursor?: { occurredOn: string; id: string };
  limit?: number;
}) =>
  enqueue(async () => {
    const clauses: string[] = [];
    const params: (string | number)[] = [];
    if (filter.periodId) {
      clauses.push("t.period_id=?");
      params.push(filter.periodId);
    }
    if (filter.categoryId) {
      clauses.push("t.category_id=?");
      params.push(filter.categoryId);
    }
    if (filter.type) {
      clauses.push("t.type=?");
      params.push(filter.type);
    }
    if (filter.cursor) {
      clauses.push("(t.occurred_on<? OR (t.occurred_on=? AND t.id<?))");
      params.push(
        filter.cursor.occurredOn,
        filter.cursor.occurredOn,
        filter.cursor.id,
      );
    }
    params.push(Math.max(1, Math.min(100, filter.limit ?? 50)));
    return (
      await (
        await db()
      ).getAllAsync<Row>(
        `SELECT t.*,c.name category_name,r.name reserve_name FROM transactions t LEFT JOIN categories c ON c.id=t.category_id LEFT JOIN reserves r ON r.id=t.reserve_id ${clauses.length ? "WHERE " + clauses.join(" AND ") : ""} ORDER BY t.occurred_on DESC,t.id DESC LIMIT ?`,
        ...params,
      )
    ).map(mapTx);
  });
