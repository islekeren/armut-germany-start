import { Redirect, Stack } from "expo-router";
import { FullScreenLoader } from "../../src/components/FullScreenLoader";
import { useSession } from "../../src/providers/SessionProvider";

export default function AppLayout() {
  const { session, isLoading } = useSession();

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
