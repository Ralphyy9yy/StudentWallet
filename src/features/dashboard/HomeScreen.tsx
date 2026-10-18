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
    <Screen
      footer={
        <Button
          title="Add expense"
          onPress={() => router.push("/transactions/new")}
        />
      }
    >
      <View>
        <AppText
          variant="caption"
          style={{ color: colors.muted, textTransform: "uppercase" }}
        >
          {period.name}
        </AppText>
        <AppText variant="title">Make today work.</AppText>
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
          {label}
        </AppText>
        {budget.dailyGuideCentavos === null ? (
          <AppText variant="heading" style={{ color: "white" }}>
            Ready for your next allowance?
          </AppText>
        ) : (
          <MoneyText
            value={budget.dailyGuideCentavos}
            style={{ color: "white", fontSize: 40, lineHeight: 48 }}
          />
        )}
        <AppText variant="caption" style={{ color: "#D7F5DF" }}>
          {budget.status === "active"
            ? `For the rest of today · ${budget.remainingDays} days left, including today`
            : budget.status === "upcoming"
              ? `${period.startDate} to ${period.endDate}`
              : "This period has finished. Your records stay in history."}
        </AppText>
      </Card>
      <Card>
        {[
          ["Total balance", budget.balanceCentavos],
          ["Reserved for essentials", budget.reservedCentavos],
          ["Flexible spending money", budget.flexibleCentavos],
        ].map(([name, amount]) => (
          <View key={String(name)} style={{ gap: 2, paddingVertical: 4 }}>
            <AppText variant="caption" style={{ color: colors.muted }}>
              {name}
            </AppText>
            <MoneyText
              value={Number(amount)}
              style={{ fontSize: 22, lineHeight: 28 }}
            />
          </View>
        ))}
      </Card>
      <View style={{ gap: 8 }}>
        <AppText variant="caption">
          {budget.status === "active"
            ? "Your guide spreads flexible funds across the days left. It adjusts after each expense."
            : budget.status === "upcoming"
              ? `Upcoming: based on the full ${budget.remainingDays}-day period.`
              : "Your records remain available in Transactions."}
        </AppText>
        {budget.status === "ended" && (
          <Button
            title="Start a new period"
            variant="secondary"
            onPress={() => router.push("/period/new")}
          />
        )}
        <AppText variant="caption">
          Flexible spending recorded today: {formatMoney(spentToday)}
        </AppText>
      </View>
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
