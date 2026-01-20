"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { SimpleHeader } from "@/components";
import { useAuth } from "@/contexts";

export default function RegisterPage() {
  const t = useTranslations();
  const router = useRouter();
  const { register, isAuthenticated, isLoading: authLoading } = useAuth();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    userType: "customer" as "customer" | "provider",
    gdprConsent: false,
  });
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
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError(t("auth.register.errorPasswordMismatch"));
      return;
    }

    if (!formData.gdprConsent) {
      setError(t("auth.register.errorGdpr"));
      return;
    }

    setIsLoading(true);

    try {
      const { confirmPassword, gdprConsent, ...registerData } = formData;
      await register(registerData);
      router.push("/");
    } catch (err: any) {
      setError(err.message || t("auth.register.errorDefault"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <SimpleHeader />
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white p-8 shadow-lg">
          <div className="mb-8 text-center">
            <Link href="/" className="text-2xl font-bold text-primary">
              Armut
            </Link>
            <h1 className="mt-4 text-2xl font-bold text-foreground">
              {t("auth.register.title")}
            </h1>
            <p className="mt-2 text-muted">
              {t("auth.register.subtitle")}
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-error/10 p-3 text-sm text-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  {t("auth.register.firstName")}
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                  className="w-full rounded-lg border border-border px-4 py-3 focus:border-primary focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  {t("auth.register.lastName")}
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                  className="w-full rounded-lg border border-border px-4 py-3 focus:border-primary focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                {t("auth.register.email")}
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full rounded-lg border border-border px-4 py-3 focus:border-primary focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                {t("auth.register.password")}
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className="w-full rounded-lg border border-border px-4 py-3 focus:border-primary focus:outline-none"
                placeholder={t("auth.register.passwordPlaceholder")}
                minLength={8}
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                {t("auth.register.confirmPassword")}
              </label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) =>
                  setFormData({ ...formData, confirmPassword: e.target.value })
                }
                className="w-full rounded-lg border border-border px-4 py-3 focus:border-primary focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                {t("auth.register.registerAs")}
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, userType: "customer" })
                  }
                  className={`rounded-lg border-2 p-4 text-center transition ${
                    formData.userType === "customer"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="text-2xl">👤</div>
                  <div className="mt-2 font-medium">{t("auth.register.customer")}</div>
                  <div className="text-xs text-muted">{t("auth.register.customerDesc")}</div>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, userType: "provider" })
                  }
                  className={`rounded-lg border-2 p-4 text-center transition ${
                    formData.userType === "provider"
                      ? "border-secondary bg-secondary/5"
                      : "border-border hover:border-secondary/50"
                  }`}
                >
                  <div className="text-2xl">🔧</div>
                  <div className="mt-2 font-medium">{t("auth.register.provider")}</div>
                  <div className="text-xs text-muted">{t("auth.register.providerDesc")}</div>
                </button>
              </div>
            </div>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={formData.gdprConsent}
                onChange={(e) =>
                  setFormData({ ...formData, gdprConsent: e.target.checked })
                }
                className="mt-1 rounded border-border"
              />
              <span className="text-sm text-muted">
                {t("auth.register.acceptTerms")}{" "}
                <span className="text-primary">
                  {t("auth.register.privacyPolicy")}
                </span>{" "}
                {t("auth.register.and")}{" "}
                <span className="text-primary">
                  {t("auth.register.terms")}
                </span>
                .
              </span>
            </label>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-primary py-3 font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {isLoading ? t("auth.register.loading") : t("auth.register.submit")}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-muted">
            {t("auth.register.hasAccount")}{" "}
            <Link href="/anmelden" className="text-primary hover:underline">
              {t("auth.register.loginNow")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
