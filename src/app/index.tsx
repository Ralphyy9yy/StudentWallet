import { Redirect } from "expo-router";
import { useWallet } from "@/features/wallet/WalletContext";
import { Loading } from "@/ui/components";
export default function Index() {
  const { loading, onboarded } = useWallet();
  if (loading) return <Loading />;
  return <Redirect href={onboarded ? "/(tabs)" : "/onboarding"} />;
}
