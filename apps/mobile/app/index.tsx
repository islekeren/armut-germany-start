import { Redirect } from "expo-router";
import { FullScreenLoader } from "../src/components/FullScreenLoader";
import { getDefaultWebPath } from "../src/lib/routing";
import { useSession } from "../src/providers/SessionProvider";

export default function IndexScreen() {
  const { session, isLoading } = useSession();

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Redirect
      href={{
        pathname: "/(app)/web",
        params: { path: getDefaultWebPath(session.user.userType) },
      }}
    />
  );
}
