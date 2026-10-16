import { useLocalSearchParams } from "expo-router";
import { TransactionForm } from "@/features/transactions/TransactionForm";
export default function NewTransaction() {
  const { type, reserveId } = useLocalSearchParams<{
    type?: string;
    reserveId?: string;
  }>();
  return (
    <TransactionForm
      type={type === "top_up" ? "top_up" : "expense"}
      initialReserveId={reserveId}
    />
  );
}
