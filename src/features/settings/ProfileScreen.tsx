import { useRef, useState } from "react";
import { router } from "expo-router";
import { updateDisplayName } from "@/db/database";
import { displayNameSchema } from "@/domain/settings";
import { useWallet } from "@/features/wallet/WalletContext";
import { AppText, Button, Card, Field, Screen } from "@/ui/components";
import { colors } from "@/ui/tokens";
export default function ProfileScreen() {
  const { displayName, refresh } = useWallet();
  const [name, setName] = useState(displayName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  async function save() {
    if (pending.current) return;
    const parsed = displayNameSchema.safeParse(name);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    pending.current = true;
    setSaving(true);
    setError(null);
    try {
      await updateDisplayName(name);
      await refresh();
      router.back();
    } catch {
      setError(
        "Your name was not saved. Please try again. Your spending records have not changed.",
      );
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }
  return (
    <Screen
      footer={
        <Button
          title={saving ? "Saving..." : "Save name"}
          disabled={saving}
          onPress={save}
        />
      }
    >
      <AppText variant="title">Your display name</AppText>
      <AppText style={{ color: colors.muted }}>
        Optional, and stored only on this device. Leave it blank to remove your
        name.
      </AppText>
      <Card>
        <Field
          label="Display name"
          value={name}
          onChangeText={(value) => {
            setName(value);
            setError(null);
          }}
          maxLength={60}
          autoCapitalize="words"
          autoComplete="name"
          returnKeyType="done"
          editable={!saving}
          onSubmitEditing={save}
        />
        {error && <AppText style={{ color: colors.danger }}>{error}</AppText>}
      </Card>
      <Button
        title="Cancel"
        variant="ghost"
        disabled={saving}
        onPress={() => router.back()}
      />
    </Screen>
  );
}
