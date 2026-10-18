import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { colors } from "./tokens";
import { formatMoney } from "@/domain/money";
export function Screen({
  children,
  scroll = true,
  footer,
}: {
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const c = scroll ? (
    <ScrollView
      contentContainerStyle={[
        s.content,
        { paddingBottom: Math.max(32, insets.bottom + 16) },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={s.content}>{children}</View>
  );
  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={s.safe}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {c}
        {footer && (
          <View
            style={[s.footer, { paddingBottom: Math.max(16, insets.bottom) }]}
          >
            {footer}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function AppText({
  children,
  variant = "body",
  style,
}: {
  children: ReactNode;
  variant?: "title" | "heading" | "body" | "label" | "caption";
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      allowFontScaling
      accessibilityRole={
        variant === "title" || variant === "heading" ? "header" : undefined
      }
      style={[s.text, s[variant], style]}
    >
      {children}
    </Text>
  );
}
export function MoneyText({
  value,
  style,
}: {
  value: number;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      accessibilityLabel={formatMoney(value)}
      style={[s.money, value < 0 && { color: colors.danger }, style]}
    >
      {formatMoney(value)}
    </Text>
  );
}
export function Button({
  title,
  onPress,
  variant = "primary",
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        s[`button_${variant}`],
        pressed && { opacity: 0.8 },
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text
        style={[
          s.buttonText,
          variant !== "primary" &&
            variant !== "danger" && {
              color: variant === "secondary" ? colors.primary : colors.text,
            },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Field({
  label,
  error,
  style,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#617067"
        style={[
          s.input,
          { paddingVertical: 12 },
          error && { borderColor: colors.danger },
          style,
        ]}
        {...props}
      />
      {error && (
        <AppText variant="caption" style={{ color: colors.danger }}>
          {error}
        </AppText>
      )}
    </View>
  );
}
export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[s.card, style]}>{children}</View>;
}
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Card>
      <AppText variant="heading">{title}</AppText>
      <AppText style={{ color: colors.muted }}>{body}</AppText>
      {action}
    </Card>
  );
}
export function Loading() {
  return (
    <View style={s.center}>
      <ActivityIndicator color={colors.primary} />
      <AppText>Loading your wallet…</AppText>
    </View>
  );
}
export function confirm(title: string, message: string, onConfirm: () => void) {
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: "Confirm", style: "destructive", onPress: onConfirm },
  ]);
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  footer: {
    padding: 16,
    gap: 8,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  text: { color: colors.text, fontSize: 16, lineHeight: 23 },
  body: {},
  title: { fontSize: 30, lineHeight: 36, fontWeight: "800" },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: "700" },
  label: { fontSize: 14, lineHeight: 19, fontWeight: "700" },
  caption: { fontSize: 13, lineHeight: 18 },
  money: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  button: {
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexShrink: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  button_primary: { backgroundColor: colors.primary },
  button_secondary: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: "#A7D7B5",
  },
  button_danger: { backgroundColor: colors.danger },
  button_ghost: { backgroundColor: "transparent" },
  buttonText: { fontSize: 16, fontWeight: "700", color: "white" },
  input: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 17,
    color: colors.text,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
});
