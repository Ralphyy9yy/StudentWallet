import { useRef, useState } from "react";
import { Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { createPeriod } from "@/db/database";
import { todayLocal } from "@/domain/dates";
import { parseMoney, moneyInput } from "@/domain/money";
import { useWallet } from "@/features/wallet/WalletContext";
import { AppText, Button, Card, Field, Screen } from "@/ui/components";
import { withDeficitConfirmation } from "@/ui/confirmation";
import { DateField } from "@/ui/DateField";
export default function NewPeriod() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { periods, refresh } = useWallet();
  const existing = periods.find((p) => p.id === id);
  const [name, setName] = useState(existing?.name ?? "New allowance"),
    [amount, setAmount] = useState(
      existing ? moneyInput(existing.initialAmountCentavos) : "",
    ),
    [start, setStart] = useState(existing?.startDate ?? todayLocal()),
    [end, setEnd] = useState(existing?.endDate ?? todayLocal()),
    [saving, setSaving] = useState(false);
  const pending = useRef(false);
  async function save() {
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    try {
      const input = {
        id,
        name,
        startDate: start,
        endDate: end,
        amount: parseMoney(amount),
      };
      if (
        await withDeficitConfirmation((token) => createPeriod(input, token))
      ) {
        await refresh();
        router.back();
      }
    } catch (e) {
      Alert.alert(
        "Could not save period",
        e instanceof Error ? e.message : "Try again.",
      );
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }
  return (
    <Screen>
      <AppText variant="title">
        {id ? "Edit allowance" : "New allowance period"}
      </AppText>
      <AppText>
        Dates include both the first and last day. Balances do not carry over
        automatically.
      </AppText>
      <Card>
        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          maxLength={60}
          editable={!saving}
        />
        <Field
          label="Initial funds (PHP)"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
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
          title={saving ? "Saving..." : "Save period"}
          disabled={saving}
          onPress={save}
        />
        <Button
          title="Cancel"
          variant="ghost"
          disabled={saving}
          onPress={() => router.back()}
        />
      </Card>
    </Screen>
  );
}
