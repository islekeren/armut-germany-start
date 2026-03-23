import { Redirect, Slot } from "expo-router";
import { LoadingScreen } from "@/components";
import { useAuth } from "@/providers/AuthProvider";

export default function ProviderLayout() {
  const { isLoading, isAuthenticated, user } = useAuth();

  if (isLoading) {
    return <LoadingScreen label="Opening your provider dashboard..." />;
  }

  if (!isAuthenticated || user?.userType !== "provider") {
    return <Redirect href="/(auth)/login" />;
  }

  return <Slot />;
}
