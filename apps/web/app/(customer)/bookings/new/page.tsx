"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertBanner, Header, PanelCard } from "@/components";
import {
  bookingsApi,
  getStoredAccessToken,
  messagesApi,
  quotesApi,
  type CustomerBooking,
  type Quote,
} from "@/lib/api";
import {
  formatEuroAmount,
  getDefaultScheduledDateValue,
  getProviderContactName,
  getProviderDisplayName,
  getRequestLocation,
  getRequestTitle,
  toDateTimeLocalValue,
} from "@/lib/bookings";

export default function NewBookingPage() {
  const t = useTranslations("customer.bookings.create");
  const tBookings = useTranslations("customer.bookings");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const quoteId = searchParams.get("quote") || "";
  const showAcceptedBanner = searchParams.get("accepted") === "1";

  const [quote, setQuote] = useState<Quote | null>(null);
  const [existingBooking, setExistingBooking] = useState<CustomerBooking | null>(null);
  const [scheduledDate, setScheduledDate] = useState(getDefaultScheduledDateValue());
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const localeTag = locale === "de" ? "de-DE" : "en-US";
  const requestHref = quote?.request?.id ? `/my-requests/${quote.request.id}` : "/my-requests";

  useEffect(() => {
    const fetchQuote = async () => {
      if (!quoteId) {
        setError(t("quoteRequired"));
        setIsLoading(false);
        return;
      }

      const token = getStoredAccessToken();
      if (!token) {
        setError(tBookings("loginRequired"));
        setIsLoading(false);
        return;
      }

      try {
        const [quoteData, customerBookings] = await Promise.all([
          quotesApi.getById(token, quoteId),
          bookingsApi.getCustomerBookings(token, { page: 1, limit: 100 }),
        ]);

        setQuote(quoteData);

        const matchingBooking =
          customerBookings.data.find((booking) => booking.quoteId === quoteData.id) || null;
        setExistingBooking(matchingBooking);

        if (quoteData.request?.preferredDate) {
          setScheduledDate(toDateTimeLocalValue(quoteData.request.preferredDate));
        }
      } catch (err) {
        console.error("Failed to load accepted quote:", err);
        setError(err instanceof Error ? err.message : t("loadError"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuote();
  }, [quoteId, t, tBookings]);

  const handleMessageProvider = async () => {
    const token = getStoredAccessToken();
    if (!token || !quote?.provider?.user.id) {
      setError(tBookings("messageError"));
      return;
    }

    try {
      const conversation = await messagesApi.createConversation(token, {
        participantId: quote.provider.user.id,
        requestId: quote.request?.id,
      });

      router.push(`/messages?conversation=${conversation.id}`);
    } catch (err) {
      console.error("Failed to start booking conversation:", err);
      setError(err instanceof Error ? err.message : tBookings("messageError"));
    }
  };

  const handleCreateBooking = async () => {
    const token = getStoredAccessToken();
    if (!token || !quote) {
      setError(tBookings("loginRequired"));
      return;
    }

    const selectedDate = new Date(scheduledDate);
    if (Number.isNaN(selectedDate.getTime()) || selectedDate <= new Date()) {
      setError(t("invalidDate"));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const booking = await bookingsApi.create(token, {
        quoteId: quote.id,
        scheduledDate: selectedDate.toISOString(),
      });

      router.replace(`/bookings/${booking.id}`);
    } catch (err) {
      console.error("Failed to create booking:", err);
      setError(err instanceof Error ? err.message : t("createError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDateTime = (value: string) =>
    new Intl.DateTimeFormat(localeTag, {
      dateStyle: "long",
      timeStyle: "short",
    }).format(new Date(value));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <PanelCard className="text-center text-muted">{tBookings("loading")}</PanelCard>
        </div>
      </div>
    );
  }

  const acceptedQuote = quote?.status === "accepted";

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <nav className="mb-6 text-sm text-muted">
          <Link href="/bookings" className="hover:text-primary">
            {tBookings("title")}
          </Link>
          {" / "}
          <span>{t("title")}</span>
        </nav>

        <div className="mb-8">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted">{t("subtitle")}</p>
        </div>

        {showAcceptedBanner && (
          <AlertBanner variant="success" className="mb-6">
            {t("acceptedBanner")}
          </AlertBanner>
        )}

        {error && (
          <AlertBanner variant="warning" className="mb-6">
            {error}
          </AlertBanner>
        )}

        {existingBooking ? (
          <PanelCard className="border border-emerald-100 bg-emerald-50/60">
            <h2 className="text-lg font-semibold">{t("existingTitle")}</h2>
            <p className="mt-2 text-muted">{t("existingDescription")}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={`/bookings/${existingBooking.id}`}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
              >
                {t("viewExisting")}
              </Link>
              <Link
                href={requestHref}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-white"
              >
                {t("backToRequest")}
              </Link>
            </div>
          </PanelCard>
        ) : !quote ? (
          <PanelCard className="text-center text-muted">{t("quoteRequired")}</PanelCard>
        ) : !acceptedQuote ? (
          <PanelCard className="border border-amber-200 bg-amber-50">
            <h2 className="text-lg font-semibold">{t("acceptedOnlyTitle")}</h2>
            <p className="mt-2 text-muted">{t("acceptedOnlyText")}</p>
            <Link
              href={requestHref}
              className="mt-4 inline-flex rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-white"
            >
              {t("backToRequest")}
            </Link>
          </PanelCard>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <PanelCard>
              <h2 className="text-lg font-semibold">{t("scheduleTitle")}</h2>
              <p className="mt-2 text-sm text-muted">{t("scheduleHint")}</p>

              <label className="mt-6 block text-sm font-medium text-foreground">
                {t("scheduledDate")}
              </label>
              <input
                type="datetime-local"
                value={scheduledDate}
                min={getDefaultScheduledDateValue()}
                onChange={(event) => setScheduledDate(event.target.value)}
                className="mt-2 w-full rounded-lg border border-border px-4 py-3 outline-none transition focus:border-primary"
              />

              <p className="mt-2 text-sm text-muted">{t("scheduledDateHint")}</p>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  onClick={handleCreateBooking}
                  disabled={isSubmitting}
                  className="rounded-lg bg-primary px-5 py-3 text-sm font-medium text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? t("creating") : t("createBooking")}
                </button>
                <button
                  onClick={handleMessageProvider}
                  className="rounded-lg border border-border px-5 py-3 text-sm font-medium hover:bg-background"
                >
                  {t("messageProvider")}
                </button>
              </div>
            </PanelCard>

            <PanelCard className="h-fit">
              <div className="rounded-xl bg-primary/5 p-4">
                <p className="text-sm font-medium uppercase tracking-[0.16em] text-primary">
                  {t("quoteSummary")}
                </p>
                <h2 className="mt-2 text-xl font-semibold">
                  {getRequestTitle(quote.request)}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {quote.request?.category?.nameEn || t("serviceFallback")}
                </p>
              </div>

              <div className="mt-6 space-y-4 text-sm">
                <div>
                  <div className="font-medium text-foreground">{t("provider")}</div>
                  <div className="mt-1">{getProviderDisplayName(quote.provider)}</div>
                  <div className="text-muted">
                    {getProviderContactName(quote.provider)}
                  </div>
                </div>

                <div>
                  <div className="font-medium text-foreground">{t("location")}</div>
                  <div className="mt-1 text-muted">
                    {getRequestLocation(quote.request)}
                  </div>
                </div>

                <div>
                  <div className="font-medium text-foreground">{t("price")}</div>
                  <div className="mt-1 text-xl font-semibold text-primary">
                    {formatEuroAmount(quote.price, locale)}
                  </div>
                </div>

                <div>
                  <div className="font-medium text-foreground">{t("validUntil")}</div>
                  <div className="mt-1 text-muted">{formatDateTime(quote.validUntil)}</div>
                </div>

                <div>
                  <div className="font-medium text-foreground">{t("message")}</div>
                  <p className="mt-1 rounded-lg bg-background p-4 text-muted">
                    {quote.message}
                  </p>
                </div>
              </div>

              <Link
                href={requestHref}
                className="mt-6 inline-flex rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-background"
              >
                {t("backToRequest")}
              </Link>
            </PanelCard>
          </div>
        )}
      </div>
    </div>
  );
}
