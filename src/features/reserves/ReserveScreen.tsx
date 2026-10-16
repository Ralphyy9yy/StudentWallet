import { useRef, useState } from "react";
import { Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { createReserve, releaseReserve } from "@/db/database";
import { parseMoney, moneyInput } from "@/domain/money";
import { useWallet } from "@/features/wallet/WalletContext";
import { AppText, Button, Card, Field, Screen } from "@/ui/components";
export default function NewReserve() {
  const { id, release } = useLocalSearchParams<{
    id?: string;
    release?: string;
  }>();
  const { period, reserves, refresh } = useWallet();
  const existing = reserves.find((r) => r.id === id);
  const [name, setName] = useState(existing?.name ?? "Transport"),
    [amount, setAmount] = useState(
      existing && !release ? moneyInput(existing.allocatedCentavos) : "",
    ),
    [saving, setSaving] = useState(false);
  const pending = useRef(false);
  async function save() {
    if (!period || pending.current) return;
    pending.current = true;
    setSaving(true);
    try {
      if (release && id) await releaseReserve(id, parseMoney(amount));
      else await createReserve(period.id, name, parseMoney(amount), id);
      await refresh();
      router.back();
    } catch (e) {
      Alert.alert(
        "Could not save reserve",
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
        {release
          ? "Release some funds"
          : id
            ? "Edit reserve"
            : "Reserve essentials"}
      </AppText>
      <AppText>
        Reserving money separates it from flexible funds. Spending from a
        reserve creates one expense.
      </AppText>
      <Card>
        {!release && (
          <Field
            label="Reserve name"
            value={name}
            onChangeText={setName}
            maxLength={60}
            editable={!saving}
          />
        )}
        <Field
          label={release ? "Amount to release (PHP)" : "Total allocation (PHP)"}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          editable={!saving}
        />
        <Button
          title={
            saving ? "Saving..." : release ? "Release funds" : "Save reserve"
          }
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
