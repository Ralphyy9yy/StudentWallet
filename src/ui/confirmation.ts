import { Alert } from "react-native";
import { NeedsConfirmation } from "@/db/database";
import { formatMoney } from "@/domain/money";
export function askConfirmation(
  title: string,
  message: string,
): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(
      title,
      message,
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}
export async function withDeficitConfirmation(
  operation: (token?: string) => Promise<void>,
): Promise<boolean> {
  let token: string | undefined;
  for (;;) {
    try {
      await operation(token);
      return true;
    } catch (error) {
      if (!(error instanceof NeedsConfirmation)) throw error;
      const agreed = await askConfirmation(
        "Confirm projected shortfall",
        `After this change:\nTotal balance: ${formatMoney(error.after.balanceCentavos)}\nFlexible funds: ${formatMoney(error.after.flexibleCentavos)}\nShortfall: ${formatMoney(error.after.shortfallCentavos)}\n\nReserves will stay unchanged. Continue?`,
      );
      if (!agreed) return false;
      token = error.fingerprint;
    }
  }
}
