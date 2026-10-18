/** Executes production repository SQL against real SQLite via Node's native binding.
 * This verifies SQL/rollback behavior, not the Android expo-sqlite native bridge. */
import type * as Repository from "@/db/database";
jest.mock("expo-crypto", () => ({
  randomUUID: () => require("node:crypto").randomUUID(),
}));
jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: async () => {
    if ((globalThis as any).__reuseWalletAdapter) {
      const adapter = (globalThis as any).__reuseWalletAdapter;
      delete (globalThis as any).__reuseWalletAdapter;
      return adapter;
    }
    const { DatabaseSync } = process.getBuiltinModule("node:sqlite") as any;
    const sqlite = new DatabaseSync(":memory:");
    const adapter = {
      failInsert: false,
      execAsync: async (sql: string) => sqlite.exec(sql),
      runAsync: async (sql: string, ...params: any[]) => {
        if (adapter.failInsert && sql.startsWith("INSERT INTO transactions"))
          throw new Error("Injected storage failure");
        return sqlite.prepare(sql).run(...params);
      },
      getFirstAsync: async (sql: string, ...params: any[]) =>
        sqlite.prepare(sql).get(...params) ?? null,
      getAllAsync: async (sql: string, ...params: any[]) =>
        sqlite.prepare(sql).all(...params),
      closeAsync: async () => sqlite.close(),
    };
    (globalThis as any).__walletTestAdapter = adapter;
    return adapter;
  },
}));
let repo: typeof Repository;
beforeEach(async () => {
  jest.resetModules();
  repo = require("@/db/database");
  await repo.createPeriod({
    name: "Test allowance",
    startDate: "2020-01-01",
    endDate: "2020-01-10",
    amount: 150000,
  });
});
afterEach(async () => {
  await (globalThis as any).__walletTestAdapter.closeAsync();
});
async function current() {
  const s = await repo.getWalletSnapshot();
  return s.period!.id;
}
async function expense(
  amount = 5000,
  reserveId?: string,
  commandId = "command-1",
) {
  const periodId = await current();
  return {
    periodId,
    type: "expense" as const,
    amount,
    categoryId: "food",
    reserveId: reserveId ?? null,
    occurredOn: "2020-01-01",
    commandId,
  };
}
test("all records contribute to totals beyond the previous 200 row limit", async () => {
  for (let i = 0; i < 205; i++)
    await repo.saveTransaction(await expense(1, undefined, `command-${i}`));
  expect((await repo.getWalletSnapshot()).transactions).toHaveLength(205);
  expect(await repo.listHistory({})).toHaveLength(50);
  const first = await repo.listHistory({});
  const last = first[first.length - 1];
  const second = await repo.listHistory({
    cursor: { occurredOn: last.occurredOn, id: last.id },
  });
  expect(new Set([...first, ...second].map((t) => t.id)).size).toBe(100);
});
test("same command retries once and rejects changed payload", async () => {
  const input = await expense();
  await Promise.all([repo.saveTransaction(input), repo.saveTransaction(input)]);
  expect((await repo.listTransactions()).length).toBe(1);
  await expect(
    repo.saveTransaction({ ...input, amount: 6000 }),
  ).rejects.toThrow("different values");
});
test("reserve expense, edit and deletion preserve reverse effects", async () => {
  const periodId = await current();
  await repo.createReserve(periodId, "Transport", 30000);
  const reserve = (await repo.listReserves(periodId))[0];
  await repo.saveTransaction(await expense(5000, reserve.id));
  expect((await repo.listReserves(periodId))[0].spentCentavos).toBe(5000);
  const tx = (await repo.listTransactions())[0];
  await repo.saveTransaction({
    ...(await expense(7000, reserve.id, "edit-1")),
    id: tx.id,
  });
  expect((await repo.listReserves(periodId))[0].spentCentavos).toBe(7000);
  await repo.releaseReserve(reserve.id);
  await repo.deleteTransaction(tx.id);
  const restored = (await repo.listReserves(periodId))[0];
  expect(
    restored.allocatedCentavos -
      restored.releasedCentavos -
      restored.spentCentavos,
  ).toBe(7000);
});
test("linked overdraw is rejected with no changes", async () => {
  const periodId = await current();
  await repo.createReserve(periodId, "Transport", 30000);
  const r = (await repo.listReserves(periodId))[0];
  await expect(
    repo.saveTransaction(await expense(30001, r.id)),
  ).rejects.toThrow("reserve");
  expect(await repo.listTransactions()).toHaveLength(0);
});
test("injected write failure rolls back and same command can retry", async () => {
  const adapter = (globalThis as any).__walletTestAdapter;
  const input = await expense();
  adapter.failInsert = true;
  await expect(repo.saveTransaction(input)).rejects.toThrow("Injected");
  expect(await repo.listTransactions()).toHaveLength(0);
  adapter.failInsert = false;
  await repo.saveTransaction(input);
  expect(await repo.listTransactions()).toHaveLength(1);
});
test("deficit confirmation expires when snapshot changes", async () => {
  const input = await expense(200000);
  let token = "";
  try {
    await repo.saveTransaction(input);
  } catch (e) {
    expect(e).toBeInstanceOf(repo.NeedsConfirmation);
    token = (e as Repository.NeedsConfirmation).fingerprint;
  }
  expect(await repo.listTransactions()).toHaveLength(0);
  await repo.saveTransaction({
    ...(await expense(1000, undefined, "topup")),
    type: "top_up",
    categoryId: null,
  });
  await expect(repo.saveTransaction(input, token)).rejects.toBeInstanceOf(
    repo.NeedsConfirmation,
  );
  try {
    await repo.saveTransaction(input);
  } catch (e) {
    token = (e as Repository.NeedsConfirmation).fingerprint;
  }
  await repo.saveTransaction(input, token);
  expect(await repo.listTransactions()).toHaveLength(2);
});
test("repeated replacement restore does not duplicate, failed restore rolls back", async () => {
  await repo.saveTransaction(await expense());
  const original = await repo.exportData();
  await repo.replaceFromBackup(original.data);
  await repo.replaceFromBackup(original.data);
  expect(await repo.listTransactions()).toHaveLength(1);
  const invalid = JSON.parse(JSON.stringify(original.data));
  invalid.transactions[0].category_id = "missing";
  await expect(repo.replaceFromBackup(invalid)).rejects.toThrow();
  expect((await repo.exportData()).data.transactions).toEqual(
    original.data.transactions,
  );
});
test("period overlap and dates excluding historical transactions are rejected", async () => {
  await expect(
    repo.createPeriod({
      name: "Overlap",
      startDate: "2020-01-10",
      endDate: "2020-01-20",
      amount: 1000,
    }),
  ).rejects.toThrow("overlap");
  await repo.saveTransaction(await expense());
  await expect(
    repo.createPeriod({
      id: await current(),
      name: "Changed",
      startDate: "2020-01-02",
      endDate: "2020-01-10",
      amount: 150000,
    }),
  ).rejects.toThrow("date");
});
test("display name saves, clears, survives reopening and is included in backup", async () => {
  await repo.updateDisplayName("  Alex  ");
  expect((await repo.getWalletSnapshot()).displayName).toBe("Alex");
  expect((await repo.exportData()).data.settings?.display_name).toBe("Alex");
  const adapter = (globalThis as any).__walletTestAdapter;
  (globalThis as any).__reuseWalletAdapter = adapter;
  jest.resetModules();
  repo = require("@/db/database");
  expect((await repo.getWalletSnapshot()).displayName).toBe("Alex");
  await expect(repo.updateDisplayName("x".repeat(61))).rejects.toThrow();
  expect((await repo.getWalletSnapshot()).displayName).toBe("Alex");
  await repo.updateDisplayName("   ");
  expect((await repo.getWalletSnapshot()).displayName).toBeNull();
});
test("v1 migration preserves financial records and advances version atomically", async () => {
  await repo.saveTransaction(await expense());
  const adapter = (globalThis as any).__walletTestAdapter;
  const triggers = await adapter.getAllAsync(
    "SELECT name FROM sqlite_master WHERE type='trigger'",
  );
  for (const trigger of triggers)
    await adapter.execAsync(`DROP TRIGGER ${trigger.name}`);
  await adapter.execAsync("DROP TABLE commands; PRAGMA user_version=1");
  (globalThis as any).__reuseWalletAdapter = adapter;
  jest.resetModules();
  repo = require("@/db/database");
  expect(await repo.listTransactions()).toHaveLength(1);
  expect(
    (await adapter.getFirstAsync("PRAGMA user_version")).user_version,
  ).toBe(2);
  expect(
    (await adapter.getFirstAsync("PRAGMA foreign_keys")).foreign_keys,
  ).toBe(1);
});
test("deleting a top-up requires confirmation when it creates a deficit", async () => {
  const input = await expense(50000, undefined, "topup");
  await repo.saveTransaction({ ...input, type: "top_up", categoryId: null });
  await repo.saveTransaction(await expense(180000));
  const tx = (await repo.listTransactions()).find((t) => t.type === "top_up")!;
  await expect(repo.deleteTransaction(tx.id)).rejects.toBeInstanceOf(
    repo.NeedsConfirmation,
  );
  expect(await repo.listTransactions()).toHaveLength(2);
});
test("migration failure rolls back version and records without reset", async () => {
  await repo.saveTransaction(await expense());
  const adapter = (globalThis as any).__walletTestAdapter;
  const triggers = await adapter.getAllAsync(
    "SELECT name FROM sqlite_master WHERE type='trigger'",
  );
  for (const trigger of triggers)
    await adapter.execAsync(`DROP TRIGGER ${trigger.name}`);
  await adapter.execAsync("DROP TABLE commands; PRAGMA user_version=1");
  const execute = adapter.execAsync;
  adapter.execAsync = async (sql: string) => {
    if (sql.includes("allowance_periods_safe_INSERT"))
      throw new Error("Injected migration failure");
    return execute(sql);
  };
  await expect(repo.migrate(adapter)).rejects.toThrow("Injected migration");
  expect(
    (await adapter.getFirstAsync("PRAGMA user_version")).user_version,
  ).toBe(1);
  expect(await adapter.getAllAsync("SELECT * FROM transactions")).toHaveLength(
    1,
  );
  expect(
    await adapter.getFirstAsync(
      "SELECT name FROM sqlite_master WHERE name='commands'",
    ),
  ).toBeNull();
});
