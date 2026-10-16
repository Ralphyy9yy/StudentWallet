import { Pressable, View, useWindowDimensions } from "react-native";
import type { WalletTransaction } from "@/domain/models";
import { AppText, MoneyText } from "@/ui/components";
import { colors } from "@/ui/tokens";
export function TransactionRow({
  item,
  onPress,
}: {
  item: WalletTransaction;
  onPress?: () => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale > 1.3;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      style={{
        minHeight: 64,
        flexDirection: stacked ? "column" : "row",
        alignItems: stacked ? "stretch" : "center",
        justifyContent: "space-between",
        gap: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{ flex: 1 }}>
        <AppText variant="label">
          {item.type === "top_up"
            ? "Allowance top-up"
            : (item.categoryName ?? "Expense")}
        </AppText>
        <AppText variant="caption" style={{ color: colors.muted }}>
          {item.occurredOn}
          {item.reserveName ? ` · ${item.reserveName}` : ""}
          {item.note ? ` · ${item.note}` : ""}
        </AppText>
      </View>
      <MoneyText
        value={
          item.type === "expense" ? -item.amountCentavos : item.amountCentavos
        }
        style={{ fontSize: 17, lineHeight: 22 }}
      />
    </Pressable>
  );
}
