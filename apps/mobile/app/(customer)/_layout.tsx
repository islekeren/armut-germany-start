import { Redirect, Slot } from "expo-router";
import { LoadingScreen } from "@/components";
import { useAuth } from "@/providers/AuthProvider";

export default function CustomerLayout() {
  const { isLoading, isAuthenticated, user } = useAuth();

  if (isLoading) {
    return <LoadingScreen label="Opening your customer workspace..." />;
  }

  if (!isAuthenticated || user?.userType !== "customer") {
    return <Redirect href="/(auth)/login" />;
  }

  return <Slot />;
}
