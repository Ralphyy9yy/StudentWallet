import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import * as LegacyFileSystem from "expo-file-system/legacy";
import { File, Paths } from "expo-file-system";
import { exportData, replaceFromBackup, markBackupSaved } from "@/db/database";
import {
  databaseBackup,
  portableBackup,
  validateBackup,
  parseBackup,
  type Backup,
} from "@/domain/backup";
export async function prepareBackup(
  share = false,
): Promise<"saved" | "shared" | "canceled"> {
  const payload = portableBackup(await exportData());
  const json = JSON.stringify(payload, null, 2);
  if (new TextEncoder().encode(json).byteLength > 10_000_000)
    throw new Error(
      "This wallet exceeds the 10 MB backup limit. No records were removed.",
    );
  const filename = `StudentWallet-${Date.now()}.json`;
  if (!share) {
    const permission =
      await LegacyFileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permission.granted) return "canceled";
    const uri = await LegacyFileSystem.StorageAccessFramework.createFileAsync(
      permission.directoryUri,
      filename,
      "application/json",
    );
    await LegacyFileSystem.writeAsStringAsync(uri, json, {
      encoding: LegacyFileSystem.EncodingType.UTF8,
    });
    await markBackupSaved(new Date().toISOString());
    return "saved";
  }
  if (!(await Sharing.isAvailableAsync()))
    throw new Error(
      "Sharing is unavailable on this device. Use Save backup instead.",
    );
  const file = new File(Paths.cache, filename);
  file.create();
  try {
    await file.write(json);
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/json",
      dialogTitle: "Share StudentWallet backup",
    });
    return "shared";
  } finally {
    if (file.exists) file.delete();
  }
}
export async function pickAndValidate(): Promise<Backup | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "text/plain"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const file = new File(asset.uri);
  try {
    if ((asset.size ?? file.size ?? 0) > 10_000_000)
      throw new Error("Backup exceeds the 10 MB limit.");
    const raw = await file.text();
    if (new TextEncoder().encode(raw).byteLength > 10_000_000)
      throw new Error("Backup exceeds the 10 MB limit.");
    return parseBackup(JSON.parse(raw));
  } finally {
    if (file.exists) file.delete();
  }
}
export async function restoreBackup(backup: Backup) {
  const validated = validateBackup(backup);
  await replaceFromBackup(databaseBackup(validated));
}
