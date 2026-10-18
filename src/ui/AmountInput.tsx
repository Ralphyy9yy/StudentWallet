import { Field } from "./components";
import { colors } from "./tokens";
export function AmountInput({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Field
      autoFocus
      label="Amount (PHP)"
      value={value}
      onChangeText={onChange}
      keyboardType="decimal-pad"
      placeholder="0.00"
      editable={!disabled}
      selectTextOnFocus
      style={{
        fontSize: 36,
        fontWeight: "700",
        minHeight: 80,
        color: colors.primary,
        fontVariant: ["tabular-nums"],
      }}
    />
  );
}
