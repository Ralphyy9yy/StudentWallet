import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { WalletProvider, useWallet } from "@/features/wallet/WalletContext";
import { AppText, Button, Card, Loading, Screen } from "@/ui/components";
import { colors } from "@/ui/tokens";
import { useFonts } from "expo-font";
import Ionicons from "@expo/vector-icons/Ionicons";
void SplashScreen.preventAutoHideAsync();
function Boot() {
  const { loading, error, refresh } = useWallet();
  const [fontsLoaded, fontError] = useFonts(Ionicons.font);
  useEffect(() => {
    if (!loading && (fontsLoaded || fontError)) void SplashScreen.hideAsync();
  }, [loading, fontsLoaded, fontError]);
  if (loading || (!fontsLoaded && !fontError)) return <Loading />;
  if (fontError)
    return (
      <Screen>
        <AppText>
          Bundled icons could not load. Close and reopen StudentWallet. Your
          local financial records have not been reset.
        </AppText>
      </Screen>
    );
  if (error)
    return (
      <Screen>
        <Card>
          <AppText variant="heading">Your wallet could not be opened</AppText>
          <AppText>{error}</AppText>
          <AppText>
            Your data has not been reset. Free device storage if needed, retry,
            or update the app. Keep the app installed to preserve its local
            database.
          </AppText>
          <Button title="Retry" onPress={() => refresh()} />
        </Card>
      </Screen>
    );
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "none",
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <WalletProvider>
        <StatusBar style="dark" />
        <Boot />
      </WalletProvider>
    </SafeAreaProvider>
  );
}
