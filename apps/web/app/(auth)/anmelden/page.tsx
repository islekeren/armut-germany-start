"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { SimpleHeader } from "@/components";
import { useAuth } from "@/contexts";

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await login({ email, password });
      router.push("/");
    } catch (err: any) {
      setError(err.message || t("auth.login.errorDefault"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <SimpleHeader />
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white p-8 shadow-lg">
          <div className="mb-8 text-center">
            <Link href="/" className="text-2xl font-bold text-primary">
              Armut
            </Link>
            <h1 className="mt-4 text-2xl font-bold text-foreground">
              {t("auth.login.title")}
            </h1>
            <p className="mt-2 text-muted">
              {t("auth.login.subtitle")}
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-error/10 p-3 text-sm text-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                {t("auth.login.email")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-border px-4 py-3 focus:border-primary focus:outline-none"
                placeholder="ihre@email.de"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                {t("auth.login.password")}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-border px-4 py-3 focus:border-primary focus:outline-none"
                placeholder="••••••••"
                required
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded border-border" />
                <span className="text-sm text-muted">{t("auth.login.rememberMe")}</span>
              </label>
              <Link
                href="/passwort-vergessen"
                className="text-sm text-primary hover:underline"
              >
                {t("auth.login.forgotPassword")}
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-primary py-3 font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {isLoading ? t("auth.login.loading") : t("auth.login.submit")}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-muted">
            {t("auth.login.noAccount")}{" "}
            <Link href="/registrieren" className="text-primary hover:underline">
              {t("auth.login.registerNow")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
