import {
  validateBackup,
  databaseBackup,
  portableBackup,
  parseBackup,
  type Backup,
} from "@/domain/backup";
const p = "11111111-1111-4111-8111-111111111111",
  t = "22222222-2222-4222-8222-222222222222",
  r = "33333333-3333-4333-8333-333333333333";
const stamp = "2020-01-01T00:00:00.000Z";
function fixture(): Backup {
  return {
    format: "studentwallet.backup",
    backupSchemaVersion: 1,
    appVersion: "1.0.0",
    exportedAt: stamp,
    data: {
      allowancePeriods: [
        {
          id: p,
          name: "Week",
          startDate: "2020-01-01",
          endDate: "2020-01-10",
          initialAmountCentavos: 150000,
          createdAt: stamp,
          updatedAt: stamp,
        },
      ],
      transactions: [
        {
          id: t,
          periodId: p,
          type: "expense",
          amountCentavos: 5000,
          categoryId: "food",
          reserveId: r,
          occurredOn: "2020-01-01",
          note: null,
          createdAt: stamp,
          updatedAt: stamp,
        },
      ],
      reserves: [
        {
          id: r,
          periodId: p,
          name: "Transport",
          allocatedCentavos: 30000,
          releasedCentavos: 0,
          archivedAt: null,
          createdAt: stamp,
          updatedAt: stamp,
        },
      ],
      categories: [
        { id: "food", name: "Food", iconKey: "food", archived: false },
      ],
      settings: { onboardingComplete: true, displayName: null },
    },
  };
}
test("canonical backup round-trips database rows", () => {
  const b = fixture();
  expect(portableBackup({ ...b, data: databaseBackup(b) })).toEqual(b);
});
test('fictional demo backup validates on its reference date',()=>{expect(()=>validateBackup(require('./fixtures/demo-backup.json'),'2026-10-16')).not.toThrow();});
test("initial development snake_case backup upgrades explicitly", () => {
  const b = fixture();
  expect(parseBackup({ ...b, data: databaseBackup(b) })).toEqual(b);
});
test.each([
  "date",
  "reference",
  "reserve",
  "duplicate",
  "version",
  "overflow",
  "extra",
  "cross-period",
])("rejects invalid %s", (kind) => {
  const b: any = fixture();
  if (kind === "date") b.data.transactions[0].occurredOn = "2020-02-30";
  if (kind === "reference") b.data.transactions[0].categoryId = "missing";
  if (kind === "reserve") b.data.transactions[0].amountCentavos = 30001;
  if (kind === "duplicate")
    b.data.transactions.push({ ...b.data.transactions[0] });
  if (kind === "version") b.backupSchemaVersion = 2;
  if (kind === "overflow") {
    b.data.allowancePeriods[0].initialAmountCentavos = Number.MAX_SAFE_INTEGER;
    b.data.transactions[0] = {
      ...b.data.transactions[0],
      type: "top_up",
      categoryId: null,
      reserveId: null,
    };
  }
  if (kind === "extra") b.data.settings.user_version = 99;
  if (kind === "cross-period")
    b.data.reserves[0].periodId = "44444444-4444-4444-8444-444444444444";
  expect(() => validateBackup(b)).toThrow();
});
test("budget deficit is valid in a backup", () => {
  const b = fixture();
  b.data.transactions[0].reserveId = null;
  b.data.transactions[0].amountCentavos = 200000;
  expect(() => validateBackup(b)).not.toThrow();
});
