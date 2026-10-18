import { router } from "expo-router";
import { AppText, Button, Card, Screen } from "@/ui/components";
export default function HelpScreen() {
  return (
    <Screen>
      <AppText variant="title">How it works</AppText>
      <Card>
        <AppText variant="heading">1. Start with your allowance</AppText>
        <AppText>
          Choose how much you have and the first and last days it needs to
          cover. Both days count. Top-ups add funds to that period. When a
          period ends, its records stay in history; money does not carry over
          automatically.
        </AppText>
      </Card>
      <Card>
        <AppText variant="heading">2. Set aside your essentials</AppText>
        <AppText>
          A reserve holds money for things like transport or supplies. It is
          still part of your total balance, but excluded from your flexible
          spending money—the amount available after reserves.
        </AppText>
        <AppText>
          When you record an expense paid from a reserve, both your balance and
          that reserve go down once. Releasing unspent reserve money makes it
          available again.
        </AppText>
      </Card>
      <Card>
        <AppText variant="heading">3. Use the daily spending guide</AppText>
        <AppText>
          The guide spreads your remaining flexible money across the days left,
          including today. It adjusts after every change; it is not a fixed
          daily limit.
        </AppText>
        <AppText>
          Example: ₱1,500 with ₱300 reserved and 10 days left gives ₱120 per
          day. A ₱50 expense from flexible funds changes the guide to ₱115. A
          ₱50 reserve expense keeps it at ₱120.
        </AppText>
        <AppText>
          Upcoming periods show a planned guide. Ended periods have no daily
          guide. A shortfall shows a warning and a zero guide; it does not erase
          your expenses or reserves.
        </AppText>
      </Card>
      <Card>
        <AppText variant="heading">4. Keep a backup</AppText>
        <AppText>
          In Settings, choose Save backup to folder and select a trusted local
          folder. Uninstalling the app, clearing storage, or losing your device
          can lose your wallet.
        </AppText>
        <AppText>
          Backups are unencrypted files containing your spending details.
          Sharing a backup does not prove it was saved. Restore checks the
          selected file, shows a preview, and asks before replacing all current
          records.
        </AppText>
      </Card>
      <Button title="Back to Settings" onPress={() => router.back()} />
    </Screen>
  );
}
