"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NextIntlClientProvider, useLocale, useTranslations, type AbstractIntlMessages } from "next-intl";
import { SimpleHeader } from "@/components/SimpleHeader";
import { FormInput } from "@/components/forms/FormInput";
import { authApi, ApiError } from "@/lib/api";
import { useApiErrorMessage } from "@/lib/api-errors";

type Locale = "de" | "en";
export function RecoveryForm({ mode, messages }: {
  mode: "request" | "reset";
  messages?: Record<Locale, AbstractIntlMessages>;
}) {
  const currentLocale = useLocale();
  const [link, setLink] = useState<{ ready: boolean; token: string; locale: Locale }>({
    ready: mode === "request", token: "", locale: currentLocale === "en" ? "en" : "de",
  });
  useEffect(() => {
    if (mode !== "reset") return;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const token = fragment.get("token") || "";
    const locale = fragment.get("locale");
    setLink(previous => ({
      ready: true, token: /^[A-Za-z0-9_-]{43}$/.test(token) ? token : "",
      locale: locale === "en" || locale === "de" ? locale : previous.locale,
    }));
    // Keep secrets out of copied URLs, history and analytics after reading.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    if (locale === "de" || locale === "en") {
      document.cookie = `locale=${locale};path=/;max-age=31536000;SameSite=Lax`;
    }
  }, [mode]);

  const form = <Form mode={mode} token={link.token} ready={link.ready} />;
  return messages
    ? <NextIntlClientProvider locale={link.locale} messages={messages[link.locale]}>{form}</NextIntlClientProvider>
    : form;
}

function Form({ mode, token, ready }: { mode: "request" | "reset"; token: string; ready: boolean }) {
  const t = useTranslations("auth.recovery");
  const locale = useLocale();
  const describeError = useApiErrorMessage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState("");
  const invalidLink = mode === "reset" && ready && (!token || invalid);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (mode === "reset") {
      if (password.length < 8) { setError(t("tooShort")); return; }
      if (password !== confirm) { setError(t("mismatch")); return; }
    }
    setBusy(true);
    try {
      if (mode === "request") await authApi.forgotPassword(email, locale);
      else await authApi.resetPassword(token, password);
      setPassword(""); setConfirm("");
      setSuccess(true);
    } catch (cause) {
      if (mode === "reset" && cause instanceof ApiError && cause.status === 400) setInvalid(true);
      else setError(describeError(cause, t("error")));
    } finally { setBusy(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 pb-10 pt-28">
      <SimpleHeader />
      <main className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg sm:p-8">
        <h1 className="text-center text-2xl font-bold text-foreground">{t(mode === "request" ? "requestTitle" : "resetTitle")}</h1>
        <p className="mb-6 mt-3 text-center text-muted">{t(mode === "request" ? "requestIntro" : "resetIntro")}</p>
        {success ? (
          <p role="status" className="rounded-lg bg-primary/10 p-4">{t(mode === "request" ? "requestSuccess" : "resetSuccess")}</p>
        ) : invalidLink ? (
          <div role="alert"><p>{t("invalidLink")}</p><Link className="mt-4 block text-primary underline" href="/forgot-password">{t("requestAgain")}</Link></div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {error ? <p role="alert" className="rounded-lg bg-error/10 p-3 text-error">{error}</p> : null}
            {mode === "request" ? (
              <div><label htmlFor="recovery-email" className="mb-2 block font-medium">{t("email")}</label>
                <FormInput id="recovery-email" type="email" autoComplete="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} required disabled={busy} />
              </div>
            ) : (
              <>
                <div><label htmlFor="recovery-password" className="mb-2 block font-medium">{t("password")}</label>
                  <FormInput id="recovery-password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required disabled={!ready || busy} />
                </div>
                <div><label htmlFor="recovery-confirm" className="mb-2 block font-medium">{t("confirm")}</label>
                  <FormInput id="recovery-confirm" type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)} required disabled={!ready || busy} />
                </div>
              </>
            )}
            <button type="submit" disabled={!ready || busy} className="w-full rounded-lg bg-primary py-3 font-semibold text-white hover:bg-primary-dark disabled:opacity-50">
              {busy ? t("loading") : t(mode === "request" ? "requestSubmit" : "resetSubmit")}
            </button>
          </form>
        )}
        <Link href="/login" className="mt-6 block text-center text-primary underline">{t("login")}</Link>
      </main>
    </div>
  );
}
