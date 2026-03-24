"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertBanner, Header, PanelCard } from "@/components";
import { bookingsApi, getStoredAccessToken, type CustomerBooking } from "@/lib/api";
import {
  formatEuroAmount,
  getBookingLocation,
  getBookingServiceTitle,
  getProviderDisplayName,
} from "@/lib/bookings";

type BookingFilter = "all" | "upcoming" | "completed" | "cancelled";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  in_progress: "bg-blue-100 text-blue-800",
  completion_pending: "bg-purple-100 text-purple-800",
  completed: "bg-slate-100 text-slate-700",
  cancelled: "bg-rose-100 text-rose-700",
};

function canLeaveReview(booking: CustomerBooking) {
  if (booking.status === "cancelled" || booking.review) return false;
  const reviewUnlockAt = new Date(booking.scheduledDate);
  return new Date() >= reviewUnlockAt;
}

export default function CustomerBookingsPage() {
  const t = useTranslations("customer.bookings");
  const locale = useLocale();
  const [bookings, setBookings] = useState<CustomerBooking[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<CustomerBooking[]>([]);
  const [filter, setFilter] = useState<BookingFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const localeTag = locale === "de" ? "de-DE" : "en-US";

  useEffect(() => {
    const fetchBookings = async () => {
      const token = getStoredAccessToken();
      if (!token) {
        setError(t("loginRequired"));
        setIsLoading(false);
        return;
      }

      try {
        const [allBookings, upcoming] = await Promise.all([
          bookingsApi.getCustomerBookings(token, { page: 1, limit: 100 }),
          bookingsApi.getUpcomingCustomer(token),
        ]);

        setBookings(allBookings.data);
        setUpcomingBookings(upcoming);
      } catch (err) {
        console.error("Failed to load customer bookings:", err);
        setError(err instanceof Error ? err.message : t("loadError"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchBookings();
  }, [t]);

  const filteredBookings = useMemo(() => {
    if (filter === "all") {
      return bookings;
    }

    if (filter === "upcoming") {
      return bookings.filter((booking) =>
        ["pending", "confirmed", "in_progress", "completion_pending"].includes(
          booking.status,
        ),
      );
    }

    return bookings.filter((booking) => booking.status === filter);
  }, [bookings, filter]);

  const nextBooking = upcomingBookings[0] || null;

  const formatDateTime = (value: string) =>
    new Intl.DateTimeFormat(localeTag, {
      dateStyle: "long",
      timeStyle: "short",
    }).format(new Date(value));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <PanelCard className="text-center text-muted">{t("loading")}</PanelCard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("title")}</h1>
            <p className="text-muted">{t("subtitle")}</p>
          </div>
          <Link
            href="/my-requests"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-background"
          >
            {t("viewRequests")}
          </Link>
        </div>

        {error && (
          <AlertBanner variant="warning" className="mb-6">
            {error}
          </AlertBanner>
        )}

        <PanelCard className="mb-6 border border-primary/10 bg-primary/5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-primary">
                {t("nextBooking")}
              </p>
              {nextBooking ? (
                <>
                  <h2 className="mt-2 text-xl font-semibold">
                    {getBookingServiceTitle(nextBooking)}
                  </h2>
                  <p className="mt-1 text-muted">
                    {getProviderDisplayName(nextBooking.provider)} |{" "}
                    {formatDateTime(nextBooking.scheduledDate)}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-muted">{t("noUpcoming")}</p>
              )}
            </div>

            {nextBooking && (
              <Link
                href={`/bookings/${nextBooking.id}`}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
              >
                {t("actions.viewDetails")}
              </Link>
            )}
          </div>
        </PanelCard>

        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {([
            { id: "all", label: t("filters.all") },
            { id: "upcoming", label: t("filters.upcoming") },
            { id: "completed", label: t("filters.completed") },
            { id: "cancelled", label: t("filters.cancelled") },
          ] as const).map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
                filter === item.id
                  ? "bg-primary text-white"
                  : "bg-white text-muted hover:bg-background"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {filteredBookings.length > 0 ? (
          <div className="space-y-4">
            {filteredBookings.map((booking) => {
              const actionLabel =
                canLeaveReview(booking)
                  ? t("actions.leaveReview")
                  : t("actions.viewDetails");
              const categoryLabel =
                locale === "de"
                  ? booking.quote?.request?.category?.nameDe
                  : booking.quote?.request?.category?.nameEn;

              return (
                <PanelCard key={booking.id}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1">
                      <div className="mb-3 flex flex-wrap items-center gap-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[booking.status] || "bg-slate-100 text-slate-700"}`}
                        >
                          {t(`status.${booking.status}`)}
                        </span>
                        <span className="text-sm text-muted">
                          {t(`paymentStatus.${booking.paymentStatus}`)}
                        </span>
                      </div>

                      <h2 className="text-lg font-semibold">
                        {getBookingServiceTitle(booking)}
                      </h2>
                      <p className="mt-1 text-sm text-muted">
                        {getProviderDisplayName(booking.provider)}
                      </p>

                      <div className="mt-4 grid gap-3 text-sm text-muted sm:grid-cols-2">
                        <div>
                          <div className="font-medium text-foreground">
                            {t("labels.scheduledFor")}
                          </div>
                          <div>{formatDateTime(booking.scheduledDate)}</div>
                        </div>
                        <div>
                          <div className="font-medium text-foreground">
                            {t("labels.location")}
                          </div>
                          <div>{getBookingLocation(booking)}</div>
                        </div>
                        <div>
                          <div className="font-medium text-foreground">
                            {t("labels.total")}
                          </div>
                          <div>{formatEuroAmount(booking.totalPrice, locale)}</div>
                        </div>
                        <div>
                          <div className="font-medium text-foreground">
                            {t("labels.request")}
                          </div>
                          <div>{categoryLabel || t("labels.requestFallback")}</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 lg:items-end">
                      <Link
                        href={`/bookings/${booking.id}`}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
                      >
                        {actionLabel}
                      </Link>
                      {booking.quote?.request?.id && (
                        <Link
                          href={`/my-requests/${booking.quote.request.id}`}
                          className="rounded-lg border border-border px-4 py-2 text-center text-sm font-medium hover:bg-background"
                        >
                          {t("actions.viewRequest")}
                        </Link>
                      )}
                    </div>
                  </div>
                </PanelCard>
              );
            })}
          </div>
        ) : (
          <PanelCard className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
              BK
            </div>
            <h2 className="text-lg font-semibold">{t("noBookings")}</h2>
            <p className="mt-2 text-muted">{t("noBookingsHint")}</p>
            <Link
              href="/my-requests"
              className="mt-4 inline-flex rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-dark"
            >
              {t("viewRequests")}
            </Link>
          </PanelCard>
        )}
      </div>
    </div>
  );
}
