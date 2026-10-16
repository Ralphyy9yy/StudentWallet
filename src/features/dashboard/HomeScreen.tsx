import { router } from "expo-router";
import { View } from "react-native";
import { useWallet } from "@/features/wallet/WalletContext";
import { TransactionRow } from "@/features/transactions/TransactionRow";
import { todayLocal } from "@/domain/dates";
import { formatMoney } from "@/domain/money";
import {
  AppText,
  Button,
  Card,
  EmptyState,
  MoneyText,
  Screen,
} from "@/ui/components";
import { colors } from "@/ui/tokens";
export default function Home() {
  const { period, budget, transactions } = useWallet();
  if (!period || !budget)
    return (
      <Screen>
        <EmptyState
          title="No allowance yet"
          body="Create an allowance period to get your daily spending guide."
          action={
            <Button
              title="Set up allowance"
              onPress={() => router.push("/period/new")}
            />
          }
        />
      </Screen>
    );
  const label =
    budget.status === "upcoming"
      ? "Planned daily guide"
      : budget.status === "ended"
        ? "Period ended"
        : "Daily spending guide";
  const spentToday = transactions
    .filter(
      (t) =>
        t.type === "expense" && !t.reserveId && t.occurredOn === todayLocal(),
    )
    .reduce((s, t) => s + t.amountCentavos, 0);
  return (
    <Screen>
      <View>
        <AppText
          variant="caption"
          style={{ color: colors.muted, textTransform: "uppercase" }}
        >
          {period.name}
        </AppText>
        <AppText variant="title">Your money, clearly.</AppText>
      </View>
      {budget.shortfallCentavos > 0 && (
        <Card style={{ backgroundColor: colors.dangerSoft }}>
          <AppText variant="heading">Flexible funds shortfall</AppText>
          <AppText>
            You are {formatMoney(budget.shortfallCentavos)} short after
            reserves.
            {budget.balanceCentavos < 0
              ? " Total balance is also below zero."
              : ""}{" "}
            Add a top-up or review your reserves.
          </AppText>
        </Card>
      )}
      <Card style={{ backgroundColor: colors.primary }}>
        <AppText variant="label" style={{ color: "#D7F5DF" }}>
          Flexible spending money
        </AppText>
        <MoneyText value={budget.flexibleCentavos} style={{ color: "white" }} />
        <AppText variant="caption" style={{ color: "#D7F5DF" }}>
          Balance after outstanding reserves
        </AppText>
      </Card>
      <Card>
        <AppText variant="caption">Total balance</AppText>
        <MoneyText value={budget.balanceCentavos} />
        <AppText variant="caption">Outstanding reserves</AppText>
        <MoneyText value={budget.reservedCentavos} />
      </Card>
      <Card>
        <AppText variant="label">{label}</AppText>
        {budget.dailyGuideCentavos === null ? (
          <Button
            title="Start a new period"
            onPress={() => router.push("/period/new")}
          />
        ) : (
          <MoneyText value={budget.dailyGuideCentavos} />
        )}
        <AppText variant="caption">
          {budget.status === "active"
            ? `Spread across ${budget.remainingDays} days, including today. It adjusts after each expense.`
            : budget.status === "upcoming"
              ? `Upcoming: based on the full ${budget.remainingDays}-day period.`
              : "Your records remain available in Transactions."}
        </AppText>
        <AppText variant="caption">
          Flexible spending recorded today: {formatMoney(spentToday)}
        </AppText>
      </Card>
      <Button
        title="Add expense"
        onPress={() => router.push("/transactions/new")}
      />
      <View style={{ gap: 4 }}>
        <AppText variant="heading">Recent activity</AppText>
        {transactions.length ? (
          transactions
            .slice(0, 5)
            .map((t) => (
              <TransactionRow
                key={t.id}
                item={t}
                onPress={() => router.push(`/transactions/${t.id}`)}
              />
            ))
        ) : (
          <EmptyState
            title="Nothing recorded yet"
            body="Your expenses and top-ups will appear here."
          />
        )}
      </View>
    </Screen>
  );
}
