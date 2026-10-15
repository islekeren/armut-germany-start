import { RecoveryForm } from "@/components/auth/RecoveryForm";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };

export default function ResetPasswordPage() {
  const messages = {
    de: { auth: { recovery: de.auth.recovery }, apiErrors: de.apiErrors },
    en: { auth: { recovery: en.auth.recovery }, apiErrors: en.apiErrors },
  };
  return <RecoveryForm mode="reset" messages={messages} />;
}
