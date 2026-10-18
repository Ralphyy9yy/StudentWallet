import { Pressable, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppText } from "./components";
import { colors } from "./tokens";
export function ChoiceChip({
  label,
  selected,
  onPress,
  disabled = false,
  icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selected,
        { opacity: disabled ? 0.5 : pressed ? 0.75 : 1 },
      ]}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={18}
          color={selected ? colors.primary : colors.muted}
        />
      )}
      <AppText
        variant="label"
        style={{
          color: selected ? colors.primary : colors.text,
          flexShrink: 1,
        }}
      >
        {label}
      </AppText>
      {selected && (
        <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
      )}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  chip: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  selected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
});
