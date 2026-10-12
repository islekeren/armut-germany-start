"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PanelCard, ProviderSubpageShell } from "@/components";
import { getStoredAccessToken, quotesApi, type Quote } from "@/lib/api";
import { useApiErrorMessage } from "@/lib/api-errors";
import { formatEuroAmount } from "@/lib/bookings";

export default function ProviderOffersPage() {
  const tDashboard = useTranslations("provider.dashboard");
  const describeError = useApiErrorMessage();
  const tNavigation = useTranslations("provider.dashboard.navigation");
  const tOffers = useTranslations("provider.offers");
  const locale = useLocale();
  const [offers, setOffers] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadOffers = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = getStoredAccessToken();
        if (!token) return;
        const data = await quotesApi.getMyQuotes(token);
        setOffers(data);
      } catch (err) {
        console.error("Failed to load offers:", err);
        setError(describeError(err, tOffers("loadError")));
      } finally {
        setLoading(false);
      }
    };

    loadOffers();
    const interval = window.setInterval(loadOffers, 15000);
    window.addEventListener("focus", loadOffers);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", loadOffers);
    };
  }, [tOffers, describeError]);

  const visibleOffers = useMemo(
    () =>
      offers
        .filter(
          (offer) => offer.status === "pending" || offer.status === "accepted",
        )
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    [offers],
  );

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-US", {
      dateStyle: "medium",
    }).format(new Date(value));

  return (
    <ProviderSubpageShell
      title={tNavigation("pendingOffers")}
      backLabel={tNavigation("overview")}
    >
      {error && (
        <PanelCard className="mb-4 border border-rose-200 bg-rose-50 text-rose-700">
          {error}
        </PanelCard>
      )}

      <PanelCard>
        {loading ? (
          <p className="text-sm text-muted">{tDashboard("loading")}</p>
        ) : visibleOffers.length === 0 ? (
          <p className="text-sm text-muted">{tOffers("empty")}</p>
        ) : (
          <div className="space-y-4">
            {visibleOffers.map((offer) => {
              const customerName = offer.request?.customer
                ? `${offer.request.customer.firstName} ${offer.request.customer.lastName}`
                : tDashboard("pendingOffersUnknownCustomer");

              const requestTitle =
                offer.request?.title || tDashboard("pendingOffersUntitled");
              const location = [offer.request?.postalCode, offer.request?.city]
                .filter(Boolean)
                .join(" ");

              return (
                <div
                  key={offer.id}
                  className="rounded-lg border border-border p-4 transition hover:border-primary"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{requestTitle}</h3>
                      <p className="text-sm text-muted">{customerName}</p>
                      {location && (
                        <p className="text-sm text-muted">{location}</p>
                      )}
                    </div>
                    <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700">
                      {offer.status === "pending"
                        ? tDashboard("status.pending")
                        : offer.booking
                          ? tOffers("bookingCreated")
                          : tOffers("awaitingBooking")}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted">
                    <span className="font-medium text-secondary">
                      {formatEuroAmount(offer.price, locale)}
                    </span>
                    <span>{formatDate(offer.createdAt)}</span>
                    <span>
                      {tDashboard("pendingOfferValidUntil", {
                        date: formatDate(offer.validUntil),
                      })}
                    </span>
                  </div>
                  {offer.booking && (
                    <Link
                      href={`/dashboard/orders?booking=${offer.booking.id}`}
                      className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
                    >
                      {tOffers("viewOrder")}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </PanelCard>
    </ProviderSubpageShell>
  );
}
