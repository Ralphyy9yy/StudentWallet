import { useRef, useState } from "react";
import { Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { deleteTransaction } from "@/db/database";
import { useWallet } from "@/features/wallet/WalletContext";
import { TransactionForm } from "@/features/transactions/TransactionForm";
import { AppText, Button, Card, MoneyText, Screen } from "@/ui/components";
import { askConfirmation, withDeficitConfirmation } from "@/ui/confirmation";
export default function TransactionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { transactions, refresh } = useWallet();
  const [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const t = transactions.find((x) => x.id === id);
  if (!t)
    return (
      <Screen>
        <AppText>Transaction not found in this period.</AppText>
        <Button title="Close" onPress={() => router.back()} />
      </Screen>
    );
  async function remove() {
    if (pending.current || !t) return;
    pending.current = true;
    setBusy(true);
    try {
      if (
        await askConfirmation(
          "Delete transaction?",
          "This cannot be undone. Linked reserve spending will return to the reserve.",
        )
      ) {
        if (
          await withDeficitConfirmation((token) => deleteTransaction(id, token))
        ) {
          await refresh();
          router.back();
        }
      }
    } catch (e) {
      Alert.alert(
        "Could not delete",
        e instanceof Error ? e.message : "Try again.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  if (editing) return <TransactionForm existing={t} />;
  return (
    <Screen>
      <AppText variant="title">Transaction</AppText>
      <Card>
        <AppText variant="heading">
          {t.type === "expense" ? t.categoryName : "Allowance top-up"}
        </AppText>
        <MoneyText
          value={t.type === "expense" ? -t.amountCentavos : t.amountCentavos}
        />
        <AppText>{t.occurredOn}</AppText>
        {t.reserveName && <AppText>Paid from {t.reserveName}</AppText>}
        {t.note && <AppText>{t.note}</AppText>}
        <Button
          title="Edit transaction"
          disabled={busy}
          onPress={() => setEditing(true)}
        />
        <Button
          title={busy ? "Deleting..." : "Delete transaction"}
          disabled={busy}
          variant="danger"
          onPress={remove}
        />
        <Button
          title="Close"
          disabled={busy}
          variant="ghost"
          onPress={() => router.back()}
        />
      </Card>
    </Screen>
  );
}
