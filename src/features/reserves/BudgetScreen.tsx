import { router } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { releaseReserve } from "@/db/database";
import { formatMoney } from "@/domain/money";
import { useWallet } from "@/features/wallet/WalletContext";
import {
  AppText,
  Button,
  Card,
  EmptyState,
  MoneyText,
  Screen,
} from "@/ui/components";
import { askConfirmation } from "@/ui/confirmation";
export default function Budget() {
  const { period, periods, reserves, refresh, selectPeriod, budget } =
    useWallet();
  const [busy, setBusy] = useState(false);
  async function release(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      if (
        await askConfirmation(
          "Release and archive reserve?",
          "Only the unspent amount returns to flexible funds. Linked expense history stays intact.",
        )
      ) {
        await releaseReserve(id);
        await refresh();
      }
    } catch (e) {
      Alert.alert(
        "Could not release reserve",
        e instanceof Error ? e.message : "Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <AppText variant="title">Budget</AppText>
      {period ? (
        <Card>
          <AppText variant="heading">{period.name}</AppText>
          <AppText>
            {period.startDate} to {period.endDate}
          </AppText>
          <AppText variant="caption">Initial allowance</AppText>
          <MoneyText value={period.initialAmountCentavos} />
          {budget && (
            <>
              <AppText variant="caption">Total funds including top-ups</AppText>
              <MoneyText value={budget.totalFundsCentavos} />
            </>
          )}
          <Button
            title="Edit period"
            variant="secondary"
            onPress={() => router.push(`/period/new?id=${period.id}`)}
          />
        </Card>
      ) : (
        <EmptyState title="No allowance period" body="Create one to begin." />
      )}
      <Button
        title="Start another period"
        onPress={() => router.push("/period/new")}
      />
      <AppText variant="heading">Reserved essentials</AppText>
      {period && (
        <Button
          title="Create reserve"
          variant="secondary"
          onPress={() => router.push("/reserve/new")}
        />
      )}
      {reserves.map((r) => {
        const remaining =
          r.allocatedCentavos - r.releasedCentavos - r.spentCentavos;
        return (
          <Card key={r.id}>
            <AppText variant="heading">
              {r.name}
              {r.archivedAt ? " (archived)" : ""}
            </AppText>
            <MoneyText value={remaining} />
            <AppText variant="caption">
              {formatMoney(r.spentCentavos)} spent;{" "}
              {formatMoney(r.releasedCentavos)} released
            </AppText>
            {!r.archivedAt && (
              <>
                <Button
                  title="Spend from reserve"
                  disabled={remaining === 0}
                  onPress={() =>
                    router.push(`/transactions/new?reserveId=${r.id}`)
                  }
                />
                <Button
                  title="Edit reserve"
                  variant="secondary"
                  onPress={() => router.push(`/reserve/new?id=${r.id}`)}
                />
                <Button
                  title="Release some funds"
                  variant="secondary"
                  onPress={() =>
                    router.push(`/reserve/new?id=${r.id}&release=1`)
                  }
                />
              </>
            )}
            {(!r.archivedAt || remaining > 0) && (
              <Button
                title="Release remaining & archive"
                variant="ghost"
                disabled={busy}
                onPress={() => release(r.id)}
              />
            )}
          </Card>
        );
      })}
      {!reserves.length && (
        <EmptyState
          title="No reserves"
          body="Set money aside for transport, supplies, or another essential."
        />
      )}
      <AppText variant="heading">Allowance history</AppText>
      {periods.map((p) => (
        <View key={p.id}>
          <Button
            title={`${p.name}${p.id === period?.id ? " (selected)" : ""}: ${p.startDate} to ${p.endDate}`}
            variant="secondary"
            onPress={() => selectPeriod(p.id)}
          />
        </View>
      ))}
    </Screen>
  );
}
