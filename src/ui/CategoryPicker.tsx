import { View } from "react-native";
import type { Category } from "@/domain/models";
import { ChoiceChip } from "./ChoiceChip";
const icons = {
  food: "restaurant-outline",
  transport: "bus-outline",
  school: "book-outline",
  personal: "person-outline",
  other: "ellipsis-horizontal",
} as const;
export function CategoryPicker({
  categories,
  value,
  onChange,
  disabled = false,
}: {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Expense category"
      style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
    >
      {categories.map((c) => (
        <ChoiceChip
          key={c.id}
          label={c.name}
          icon={icons[c.id as keyof typeof icons] ?? "pricetag-outline"}
          selected={value === c.id}
          disabled={disabled}
          onPress={() => onChange(c.id)}
        />
      ))}
    </View>
  );
}
