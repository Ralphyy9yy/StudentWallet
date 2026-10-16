import { useRef, useState } from "react";
import { Alert, View } from "react-native";
import * as Crypto from "expo-crypto";
import { router } from "expo-router";
import { saveTransaction, type TransactionInput } from "@/db/database";
import { todayLocal } from "@/domain/dates";
import { parseMoney, moneyInput } from "@/domain/money";
import { DateField } from "@/ui/DateField";
import type { WalletTransaction } from "@/domain/models";
import { useWallet } from "@/features/wallet/WalletContext";
import { AppText, Button, Card, Field, Screen } from "@/ui/components";
import { withDeficitConfirmation } from "@/ui/confirmation";
export function TransactionForm({
  existing,
  type = "expense",
  initialReserveId,
}: {
  existing?: WalletTransaction;
  type?: "expense" | "top_up";
  initialReserveId?: string;
}) {
  const { period, categories, reserves, refresh } = useWallet();
  const [amount, setAmount] = useState(
    existing ? moneyInput(existing.amountCentavos) : "",
  );
  const [category, setCategory] = useState(
    existing?.categoryId ?? categories[0]?.id ?? "food",
  );
  const [reserve, setReserve] = useState<string | null>(
    existing?.reserveId ?? initialReserveId ?? null,
  );
  const [date, setDate] = useState(existing?.occurredOn ?? todayLocal());
  const [note, setNote] = useState(existing?.note ?? "");
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const command = useRef<{ payload: string; id: string } | null>(null);
  const kind = existing?.type ?? type;
  async function submit() {
    if (!period || pending.current) return;
    pending.current = true;
    setSaving(true);
    try {
      const values: TransactionInput = {
        id: existing?.id,
        periodId: existing?.periodId ?? period.id,
        type: kind,
        amount: parseMoney(amount),
        categoryId: kind === "expense" ? category : null,
        reserveId: kind === "expense" ? reserve : null,
        occurredOn: date,
        note,
      };
      const payload = JSON.stringify(values);
      if (command.current?.payload !== payload)
        command.current = { payload, id: Crypto.randomUUID() };
      const input = { ...values, commandId: command.current.id };
      if (
        await withDeficitConfirmation((token) => saveTransaction(input, token))
      ) {
        await refresh();
        router.back();
      }
    } catch (e) {
      Alert.alert(
        "Not saved",
        e instanceof Error
          ? e.message
          : "Try again. Your entries are still here.",
      );
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }
  if (!period)
    return (
      <Screen>
        <AppText>Create an allowance period first.</AppText>
        <Button title="Go back" onPress={() => router.back()} />
      </Screen>
    );
  return (
    <Screen>
      <AppText variant="title">
        {existing
          ? "Edit transaction"
          : kind === "expense"
            ? "Add expense"
            : "Add top-up"}
      </AppText>
      <Card>
        <Field
          autoFocus
          label="Amount (PHP)"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
          editable={!saving}
        />
        {kind === "expense" && (
          <>
            <AppText variant="label">Category</AppText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {categories.map((c) => (
                <Button
                  key={c.id}
                  title={`${category === c.id ? "Selected: " : ""}${c.name}`}
                  variant={category === c.id ? "primary" : "secondary"}
                  disabled={saving}
                  onPress={() => setCategory(c.id)}
                />
              ))}
            </View>
            <AppText variant="label">Pay from</AppText>
            <Button
              title={`${reserve === null ? "Selected: " : ""}Flexible funds`}
              variant={reserve === null ? "primary" : "secondary"}
              disabled={saving}
              onPress={() => setReserve(null)}
            />
            {reserves
              .filter((r) => !r.archivedAt || r.id === existing?.reserveId)
              .map((r) => (
                <Button
                  key={r.id}
                  title={`${reserve === r.id ? "Selected: " : ""}${r.name}${r.archivedAt ? " (archived)" : ""}`}
                  variant={reserve === r.id ? "primary" : "secondary"}
                  disabled={saving}
                  onPress={() => setReserve(r.id)}
                />
              ))}
          </>
        )}
        <DateField
          label="Transaction date"
          value={date}
          onChange={setDate}
          disabled={saving}
          maximumDate={new Date()}
        />
        <Field
          label="Note (optional)"
          value={note}
          onChangeText={setNote}
          maxLength={500}
          multiline
          editable={!saving}
        />
        <Button
          title={saving ? "Saving..." : "Save transaction"}
          disabled={saving}
          onPress={submit}
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
