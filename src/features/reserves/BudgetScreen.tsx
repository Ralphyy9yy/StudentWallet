import { router } from "expo-router";
import { useState } from "react";
import { Alert, View, Pressable } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { Reserve } from "@/domain/models";
import { Sheet } from "@/ui/Sheet";
import { colors } from "@/ui/tokens";
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
  const [menu, setMenu] = useState<Reserve | null>(null);
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
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <AppText variant="label" style={{ flex: 1 }}>
                {r.name}
                {r.archivedAt ? " (archived)" : ""}
              </AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Options for ${r.name}`}
                disabled={busy}
                onPress={() => setMenu(r)}
                style={{
                  minHeight: 48,
                  minWidth: 48,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name="ellipsis-horizontal"
                  size={22}
                  color={colors.text}
                />
              </Pressable>
            </View>
            <MoneyText
              value={remaining}
              style={{ fontSize: 24, lineHeight: 30 }}
            />
            <AppText variant="caption" style={{ color: colors.muted }}>
              Remaining for this essential
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
              </>
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
      {menu && (
        <Sheet title={menu.name} onClose={() => setMenu(null)}>
          <AppText>
            {formatMoney(menu.spentCentavos)} spent ·{" "}
            {formatMoney(menu.releasedCentavos)} released
          </AppText>
          {!menu.archivedAt && (
            <>
              <Button
                title="Edit reserve"
                variant="secondary"
                onPress={() => {
                  setMenu(null);
                  router.push(`/reserve/new?id=${menu.id}`);
                }}
              />
              <Button
                title="Release some funds"
                variant="secondary"
                onPress={() => {
                  setMenu(null);
                  router.push(`/reserve/new?id=${menu.id}&release=1`);
                }}
              />
            </>
          )}
          {(!menu.archivedAt ||
            menu.allocatedCentavos -
              menu.releasedCentavos -
              menu.spentCentavos >
              0) && (
            <Button
              title="Release remaining & archive"
              variant="secondary"
              onPress={() => {
                setMenu(null);
                void release(menu.id);
              }}
            />
          )}
        </Sheet>
      )}
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
