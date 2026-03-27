"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Header, PanelCard } from "@/components";
import {
  bookingsApi,
  getStoredAccessToken,
  messagesApi,
  notificationsApi,
  quotesApi,
  requestsApi,
  type CustomerBooking,
  type Quote,
  type ServiceRequest,
} from "@/lib/api";

export default function CustomerDashboardPage() {
  const t = useTranslations();
  const [loading, setLoading] = useState(true);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<CustomerBooking[]>([]);
  const [receivedQuotes, setReceivedQuotes] = useState<Quote[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const token = getStoredAccessToken();
        if (!token) return;

        const [messagesData, notificationsData, myRequests, upcoming, quotes] =
          await Promise.all([
            messagesApi.getUnreadCount(token),
            notificationsApi.getUnreadCount(token),
            requestsApi.getMyRequests(token),
            bookingsApi.getUpcomingCustomer(token),
            quotesApi.getReceivedQuotes(token),
          ]);

        setUnreadMessages(messagesData.unreadCount || 0);
        setUnreadNotifications(notificationsData.unreadCount || 0);
        setRequests(myRequests.slice(0, 5));
        setUpcomingBookings(upcoming.slice(0, 5));
        setReceivedQuotes(quotes.slice(0, 5));
      } catch (error) {
        console.error("Failed to load customer dashboard", error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const openRequestsCount = useMemo(
    () => requests.filter((request) => request.status === "open").length,
    [requests],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <PanelCard className="text-center text-muted">{t("customer.bookings.loading")}</PanelCard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{t("nav.dashboard")}</h1>
          <p className="mt-2 text-muted">{t("customer.requests.subtitle")}</p>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PanelCard>
            <p className="text-sm text-muted">{t("nav.notifications")}</p>
            <p className="mt-2 text-3xl font-bold">{unreadNotifications}</p>
          </PanelCard>
          <PanelCard>
            <p className="text-sm text-muted">{t("nav.messages")}</p>
            <p className="mt-2 text-3xl font-bold">{unreadMessages}</p>
          </PanelCard>
          <PanelCard>
            <p className="text-sm text-muted">{t("nav.myRequests")}</p>
            <p className="mt-2 text-3xl font-bold">{requests.length}</p>
          </PanelCard>
          <PanelCard>
            <p className="text-sm text-muted">{t("customer.requests.filters.active")}</p>
            <p className="mt-2 text-3xl font-bold">{openRequestsCount}</p>
          </PanelCard>
        </div>

        <div className="mb-8 grid gap-6 lg:grid-cols-3">
          <PanelCard className="lg:col-span-1">
            <h2 className="text-lg font-semibold">{t("nav.notifications")}</h2>
            <p className="mt-2 text-sm text-muted">{t("notifications.subtitle", { count: unreadNotifications })}</p>
            <Link
              href="/notifications"
              className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
            >
              {t("nav.notifications")}
            </Link>
          </PanelCard>

          <PanelCard className="lg:col-span-1">
            <h2 className="text-lg font-semibold">{t("nav.messages")}</h2>
            <p className="mt-2 text-sm text-muted">{t("customer.messages.title")}</p>
            <Link
              href="/messages"
              className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
            >
              {t("nav.messages")}
            </Link>
          </PanelCard>

          <PanelCard className="lg:col-span-1">
            <h2 className="text-lg font-semibold">{t("customer.bookings.nextBooking")}</h2>
            <p className="mt-2 text-sm text-muted">{upcomingBookings.length ? upcomingBookings[0]?.quote?.request?.title : t("customer.bookings.noUpcoming")}</p>
            <Link
              href="/bookings"
              className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
            >
              {t("nav.bookings")}
            </Link>
          </PanelCard>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <PanelCard>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("nav.myRequests")}</h2>
              <Link href="/my-requests" className="text-sm text-primary hover:underline">
                {t("common.learnMore")}
              </Link>
            </div>
            <div className="space-y-3">
              {requests.length === 0 ? (
                <p className="text-sm text-muted">{t("customer.requests.noRequests")}</p>
              ) : (
                requests.map((request) => (
                  <div key={request.id} className="rounded-lg border border-border p-3">
                    <p className="font-medium">{request.title}</p>
                    <p className="text-sm text-muted">
                      {request.postalCode} {request.city}
                    </p>
                  </div>
                ))
              )}
            </div>
          </PanelCard>

          <PanelCard>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("customer.requestDetail.quotesReceived", { count: receivedQuotes.length })}</h2>
              <Link href="/my-requests" className="text-sm text-primary hover:underline">
                {t("common.learnMore")}
              </Link>
            </div>
            <div className="space-y-3">
              {receivedQuotes.length === 0 ? (
                <p className="text-sm text-muted">{t("customer.requestDetail.noQuotes")}</p>
              ) : (
                receivedQuotes.map((quote) => (
                  <div key={quote.id} className="rounded-lg border border-border p-3">
                    <p className="font-medium">{quote.request?.title || t("provider.offers.untitledRequest")}</p>
                    <p className="text-sm text-muted">€{quote.price}</p>
                  </div>
                ))
              )}
            </div>
          </PanelCard>
        </div>
      </div>
    </div>
  );
}
