"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Header } from "@/components";
import { useAuth } from "@/contexts";
import {
  getStoredAccessToken,
  notificationsApi,
  type NotificationItem,
} from "@/lib/api";
import { getNotificationTemplate } from "@/lib/notifications";
import { useApiErrorMessage } from "@/lib/api-errors";

export default function NotificationsPage() {
  const t = useTranslations("notifications");
  const describeError = useApiErrorMessage();
  const locale = useLocale();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const unreadCount = useMemo(
    () => items.filter((item) => !item.isRead).length,
    [items],
  );

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace("/login?redirect=/notifications");
      return;
    }

    const fetchNotifications = async () => {
      const token = getStoredAccessToken();
      if (!token) {
        setError(t("errors.noToken"));
        setLoading(false);
        return;
      }

      try {
        const data = await notificationsApi.getAll(token, { limit: 100 });
        setItems(data);
      } catch (err) {
        setError(describeError(err, t("errors.loadFailed")));
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [authLoading, isAuthenticated, router, t, describeError]);

  const markAsRead = async (id: string) => {
    const token = getStoredAccessToken();
    if (!token) return;
    try {
      await notificationsApi.markAsRead(token, id);
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
      );
    } catch {
      // no-op
    }
  };

  const markAllAsRead = async () => {
    const token = getStoredAccessToken();
    if (!token) return;
    try {
      await notificationsApi.markAllAsRead(token);
      setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
    } catch {
      // no-op
    }
  };

  // Render in the user's language from the notification type; the stored
  // (English) text is only used for types the web app does not know.
  const getText = (item: NotificationItem) => {
    const template = getNotificationTemplate(item);
    if (!template) return { title: item.title, message: item.message };
    const values = { title: template.requestTitle };
    return {
      title: t(`types.${template.key}.title`, values),
      message: t(`types.${template.key}.message`, values),
    };
  };

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
            <p className="text-muted">
              {t("subtitle", { count: unreadCount })}
            </p>
          </div>
          <button
            type="button"
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("markAllRead")}
          </button>
        </div>

        {loading && <p className="text-sm text-muted">{t("loading")}</p>}

        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-700">
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="rounded-xl bg-white p-10 text-center shadow-sm">
            <p className="text-muted">{t("empty")}</p>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="space-y-3">
            {items.map((item) => {
              const text = getText(item);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => markAsRead(item.id)}
                  className={`w-full rounded-xl border p-4 text-left shadow-sm transition ${
                    item.isRead
                      ? "border-border bg-white"
                      : "border-primary/30 bg-primary/5"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-foreground">
                      {text.title}
                    </h3>
                    <span className="text-xs text-muted">
                      {formatDate(item.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-muted">{text.message}</p>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
