import { useRef, useState } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import { createPeriod } from "@/db/database";
import { parseMoney } from "@/domain/money";
import { todayLocal } from "@/domain/dates";
import { useWallet } from "@/features/wallet/WalletContext";
import { AppText, Button, Card, Field, Screen } from "@/ui/components";
import { DateField } from "@/ui/DateField";
export default function Onboarding() {
  const [displayName, setDisplayName] = useState(""),
    [periodName, setPeriodName] = useState("Weekly allowance"),
    [amount, setAmount] = useState(""),
    [start, setStart] = useState(todayLocal()),
    [end, setEnd] = useState(todayLocal()),
    [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const { refresh } = useWallet();
  async function save() {
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    try {
      await createPeriod({
        name: periodName.trim(),
        startDate: start,
        endDate: end,
        amount: parseMoney(amount),
        displayName,
      });
      await refresh();
      router.replace("/(tabs)");
    } catch (e) {
      Alert.alert(
        "Could not create allowance",
        e instanceof Error ? e.message : "Try again.",
      );
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }
  return (
    <Screen>
      <AppText variant="title">A calmer way to stretch your allowance.</AppText>
      <AppText>
        StudentWallet stays on this device and works without an account or
        internet. Data can be lost if the app is uninstalled or the device is
        lost. Save backups regularly.
      </AppText>
      <Card>
        <AppText variant="heading">Set up your first allowance</AppText>
        <Field
          label="Your name (optional)"
          value={displayName}
          onChangeText={setDisplayName}
          maxLength={60}
          editable={!saving}
        />
        <Field
          label="Period name"
          value={periodName}
          onChangeText={setPeriodName}
          maxLength={60}
          editable={!saving}
        />
        <Field
          label="Allowance amount (PHP)"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="1500.00"
          editable={!saving}
        />
        <DateField
          label="Starts on"
          value={start}
          onChange={setStart}
          disabled={saving}
        />
        <DateField
          label="Ends on"
          value={end}
          onChange={setEnd}
          disabled={saving}
        />
        <Button
          title={saving ? "Saving..." : "Create allowance"}
          disabled={saving}
          onPress={save}
        />
      </Card>
    </Screen>
  );
}
