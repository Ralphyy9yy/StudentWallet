import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { View } from "react-native";
import { AppText, Button } from "./components";
import { isValidDate, todayLocal } from "@/domain/dates";
export function DateField({
  label,
  value,
  onChange,
  disabled = false,
  maximumDate,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  maximumDate?: Date;
}) {
  function open() {
    const [y, m, d] = (isValidDate(value) ? value : todayLocal())
      .split("-")
      .map(Number);
    DateTimePickerAndroid.open({
      value: new Date(y, m - 1, d, 12),
      mode: "date",
      maximumDate,
      onChange: (event, date) => {
        if (event.type !== "set" || !date) return;
        onChange(
          `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
        );
      },
    });
  }
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="label">{label}</AppText>
      <Button
        title={value}
        variant="secondary"
        disabled={disabled}
        onPress={open}
      />
    </View>
  );
}
