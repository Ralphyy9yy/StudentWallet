import { useRef, useState } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import {
  prepareBackup,
  pickAndValidate,
  restoreBackup,
} from "@/features/backup/backup";
import { resetAll } from "@/db/database";
import { useWallet } from "@/features/wallet/WalletContext";
import { AppText, Button, Card, Screen } from "@/ui/components";
import { askConfirmation } from "@/ui/confirmation";
import { colors } from "@/ui/tokens";
export default function Settings() {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const { refresh, lastBackupExportAt } = useWallet();
  async function run(work: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await work();
    } catch (e) {
      Alert.alert(
        "Action not completed",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function backup(share = false) {
    await run(async () => {
      const outcome = await prepareBackup(share);
      await refresh();
      if (outcome === "saved")
        Alert.alert(
          "Backup saved",
          "The file was written to the folder you selected.",
        );
      if (outcome === "shared")
        Alert.alert(
          "Share opened",
          "Check your destination to confirm the file was saved. This action does not update the last saved backup time.",
        );
    });
  }
  async function restore() {
    await run(async () => {
      const parsed = await pickAndValidate();
      if (!parsed) return;
      const agreed = await askConfirmation(
        "Replace all local data?",
        `Backup from ${new Date(parsed.exportedAt).toLocaleString()}\n${parsed.data.allowancePeriods.length} periods, ${parsed.data.transactions.length} transactions, ${parsed.data.reserves.length} reserves.\n\nThis permanently replaces current data. Cancel to export your current wallet first.`,
      );
      if (!agreed) return;
      await restoreBackup(parsed);
      await refresh();
      if (!parsed.data.settings.onboardingComplete)
        router.replace("/onboarding");
      else
        Alert.alert("Restore complete", "Your wallet now matches the backup.");
    });
  }
  async function reset() {
    await run(async () => {
      if (
        !(await askConfirmation(
          "Delete everything?",
          "Export a backup first if you may need these records. Cancel to return to backup options.",
        ))
      )
        return;
      if (
        !(await askConfirmation(
          "Final confirmation",
          "Permanently delete all periods, transactions, reserves, and preferences?",
        ))
      )
        return;
      await resetAll();
      await refresh();
      router.replace("/onboarding");
    });
  }
  return (
    <Screen>
      <AppText variant="title">Settings</AppText>
      <Card>
        <AppText variant="heading">Your data stays local</AppText>
        <AppText style={{ color: colors.muted }}>
          App data may be lost if you uninstall the app, clear its storage, or
          lose this device. SQLite storage is not encrypted.
        </AppText>
      </Card>
      <Card>
        <AppText variant="heading">Backup & restore</AppText>
        <AppText>
          Backups are unencrypted files containing personal spending details.
          Choose a trusted local folder for offline access.
        </AppText>
        <AppText variant="caption">
          Last saved backup:{" "}
          {lastBackupExportAt
            ? new Date(lastBackupExportAt).toLocaleString()
            : "Not yet saved"}
        </AppText>
        <Button
          title={busy ? "Working..." : "Save backup to folder"}
          disabled={busy}
          onPress={() => backup()}
        />
        <Button
          title="Share backup"
          variant="secondary"
          disabled={busy}
          onPress={() => backup(true)}
        />
        <Button
          title="Restore from backup"
          variant="secondary"
          disabled={busy}
          onPress={restore}
        />
      </Card>
      <Card>
        <AppText variant="heading" style={{ color: colors.danger }}>
          Reset StudentWallet
        </AppText>
        <AppText>
          This permanently removes all local financial records and preferences.
        </AppText>
        <Button
          title="Delete all local data"
          variant="danger"
          disabled={busy}
          onPress={reset}
        />
      </Card>
      <AppText variant="caption">StudentWallet 1.0.0</AppText>
    </Screen>
  );
}
