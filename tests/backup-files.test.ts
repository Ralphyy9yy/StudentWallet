import { prepareBackup, pickAndValidate } from "@/features/backup/backup";
import { markBackupSaved } from "@/db/database";
import * as Picker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import * as Legacy from "expo-file-system/legacy";
import { File } from "expo-file-system";
jest.mock("@/db/database", () => ({
  exportData: jest.fn(async () => ({
    format: "studentwallet.backup",
    backupSchemaVersion: 1,
    appVersion: "1.0.0",
    exportedAt: "2020-01-01T00:00:00.000Z",
    data: {
      allowancePeriods: [],
      transactions: [],
      reserves: [],
      categories: [],
      settings: { onboarding_complete: 0, display_name: null },
    },
  })),
  markBackupSaved: jest.fn(async () => {}),
  replaceFromBackup: jest.fn(),
}));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => {}),
}));
jest.mock("expo-file-system/legacy", () => ({
  EncodingType: { UTF8: "utf8" },
  writeAsStringAsync: jest.fn(async () => {}),
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: jest.fn(),
    createFileAsync: jest.fn(async () => "content://backup"),
  },
}));
jest.mock("expo-file-system", () => ({
  Paths: { cache: "file://cache" },
  File: jest.fn().mockImplementation(() => ({
    exists: true,
    size: 0,
    create: jest.fn(),
    write: jest.fn(async () => {}),
    text: jest.fn(async () => "{invalid"),
    delete: jest.fn(),
  })),
}));
beforeEach(() => jest.clearAllMocks());
test("canceling destination selection does not mark a backup saved", async () => {
  jest
    .mocked(Legacy.StorageAccessFramework.requestDirectoryPermissionsAsync)
    .mockResolvedValue({ granted: false } as any);
  expect(await prepareBackup()).toBe("canceled");
  expect(markBackupSaved).not.toHaveBeenCalled();
});
test("failed destination write does not mark a backup saved", async () => {
  jest
    .mocked(Legacy.StorageAccessFramework.requestDirectoryPermissionsAsync)
    .mockResolvedValue({ granted: true, directoryUri: "content://folder" });
  jest
    .mocked(Legacy.writeAsStringAsync)
    .mockRejectedValueOnce(new Error("Disk full"));
  await expect(prepareBackup()).rejects.toThrow("Disk full");
  expect(markBackupSaved).not.toHaveBeenCalled();
});
test("successful destination write records saved status after completion", async () => {
  jest
    .mocked(Legacy.StorageAccessFramework.requestDirectoryPermissionsAsync)
    .mockResolvedValue({ granted: true, directoryUri: "content://folder" });
  expect(await prepareBackup()).toBe("saved");
  expect(markBackupSaved).toHaveBeenCalledTimes(1);
  expect(
    jest.mocked(Legacy.writeAsStringAsync).mock.invocationCallOrder[0],
  ).toBeLessThan(jest.mocked(markBackupSaved).mock.invocationCallOrder[0]);
});
test("sharing does not mark saved status and cleans the temporary file", async () => {
  expect(await prepareBackup(true)).toBe("shared");
  expect(Sharing.shareAsync).toHaveBeenCalled();
  expect(markBackupSaved).not.toHaveBeenCalled();
  const file = jest.mocked(File).mock.results[0].value;
  expect(file.delete).toHaveBeenCalled();
});
test("canceling import is safe", async () => {
  jest
    .mocked(Picker.getDocumentAsync)
    .mockResolvedValue({ canceled: true, assets: null });
  expect(await pickAndValidate()).toBeNull();
});
test("oversized import is rejected before reading and cache is removed", async () => {
  jest.mocked(Picker.getDocumentAsync).mockResolvedValue({
    canceled: false,
    assets: [
      {
        uri: "file://import",
        name: "backup.json",
        size: 10_000_001,
        lastModified: 0,
      },
    ],
  });
  await expect(pickAndValidate()).rejects.toThrow("10 MB");
  const file = jest.mocked(File).mock.results[0].value;
  expect(file.text).not.toHaveBeenCalled();
  expect(file.delete).toHaveBeenCalled();
});
test("malformed import is rejected and cache is removed", async () => {
  jest.mocked(Picker.getDocumentAsync).mockResolvedValue({
    canceled: false,
    assets: [
      { uri: "file://import", name: "backup.json", size: 8, lastModified: 0 },
    ],
  });
  await expect(pickAndValidate()).rejects.toThrow();
  expect(jest.mocked(File).mock.results[0].value.delete).toHaveBeenCalled();
});
