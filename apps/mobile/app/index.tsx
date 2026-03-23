import { Redirect } from "expo-router";
import { LoadingScreen } from "@/components";
import { useAuth } from "@/providers/AuthProvider";

export default function IndexRoute() {
  const { isLoading, isAuthenticated, user } = useAuth();

  if (isLoading) {
    return <LoadingScreen label="Preparing your workspace..." />;
  }

  if (!isAuthenticated || !user) {
    return <Redirect href="/(public)/(tabs)" />;
  }

  if (user.userType === "provider") {
    return <Redirect href="/(provider)/(tabs)" />;
  }

  return <Redirect href="/(customer)/(tabs)" />;
}
