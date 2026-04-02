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
  const nextBooking = upcomingBookings[0] || null;

  const stats = [
    {
      id: "notifications",
      label: t("nav.notifications"),
      value: unreadNotifications,
      icon: "🔔",
      color: "bg-blue-500",
    },
    {
      id: "messages",
      label: t("nav.messages"),
      value: unreadMessages,
      icon: "💬",
      color: "bg-secondary",
    },
    {
      id: "requests",
      label: t("nav.myRequests"),
      value: requests.length,
      icon: "📄",
      color: "bg-green-500",
    },
    {
      id: "active",
      label: t("customer.requests.filters.active"),
      value: openRequestsCount,
      icon: "✅",
      color: "bg-yellow-500",
    },
  ];

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

      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          <aside className="w-full lg:w-64">
            <nav className="rounded-xl bg-white p-3 shadow-sm sm:p-4">
              <ul className="flex gap-1 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
                <li className="min-w-max lg:min-w-0">
                  <Link
                    href="/customer-dashboard"
                    className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary sm:px-4 sm:py-3"
                  >
                    <span>📊</span> {t("nav.dashboard")}
                  </Link>
                </li>
                <li className="min-w-max lg:min-w-0">
                  <Link href="/my-requests" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-background sm:px-4 sm:py-3">
                    <span>📄</span> {t("nav.myRequests")}
                  </Link>
                </li>
                <li className="min-w-max lg:min-w-0">
                  <Link href="/bookings" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-background sm:px-4 sm:py-3">
                    <span>📅</span> {t("nav.bookings")}
                  </Link>
                </li>
                <li className="min-w-max lg:min-w-0">
                  <Link href="/messages" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-background sm:px-4 sm:py-3">
                    <span>💬</span> {t("nav.messages")}
                  </Link>
                </li>
                <li className="min-w-max lg:min-w-0">
                  <Link href="/notifications" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-background sm:px-4 sm:py-3">
                    <span>🔔</span> {t("nav.notifications")}
                  </Link>
                </li>
                <li className="min-w-max lg:min-w-0">
                  <Link href="/find-providers" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-background sm:px-4 sm:py-3">
                    <span>🔎</span> {t("nav.findProvider")}
                  </Link>
                </li>
                <li className="min-w-max lg:min-w-0">
                  <Link href="/create-request" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-background sm:px-4 sm:py-3">
                    <span>➕</span> {t("nav.createRequest")}
                  </Link>
                </li>
              </ul>
            </nav>
          </aside>

          <main className="flex-1">
            <div className="mb-8">
              <h1 className="text-xl font-bold sm:text-2xl">{t("nav.dashboard")}</h1>
              <p className="text-sm text-muted sm:text-base">{t("customer.requests.subtitle")}</p>
            </div>

            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.id} className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-lg text-2xl text-white ${stat.color}`}>
                      {stat.icon}
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{stat.value}</div>
                      <div className="text-sm text-muted">{stat.label}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
              <PanelCard className="p-5 sm:p-6">
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

              <PanelCard className="p-5 sm:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{t("customer.bookings.nextBooking")}</h2>
                  <Link href="/bookings" className="text-sm text-primary hover:underline">
                    {t("nav.bookings")}
                  </Link>
                </div>
                {nextBooking ? (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-border p-3">
                      <p className="font-medium">{nextBooking.quote?.request?.title || t("customer.bookings.nextBooking")}</p>
                      <p className="text-sm text-muted">{nextBooking.provider?.companyName || nextBooking.provider?.user?.firstName || "-"}</p>
                      <p className="mt-2 text-sm text-muted">{new Date(nextBooking.scheduledDate).toLocaleString()}</p>
                    </div>
                    <div className="space-y-2">
                      {upcomingBookings.slice(1, 4).map((booking) => (
                        <div key={booking.id} className="rounded-lg border border-border p-3">
                          <p className="font-medium">{booking.quote?.request?.title || t("customer.bookings.nextBooking")}</p>
                          <p className="text-xs text-muted">{new Date(booking.scheduledDate).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted">{t("customer.bookings.noUpcoming")}</p>
                )}
              </PanelCard>

              <PanelCard className="p-5 sm:p-6 md:col-span-2 xl:col-span-1">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">
                    {t("customer.requestDetail.quotesReceived", { count: receivedQuotes.length })}
                  </h2>
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
                        <p className="mt-1 text-sm font-medium text-secondary">€{quote.price}</p>
                        <p className="text-xs text-muted">{new Date(quote.createdAt).toLocaleDateString()}</p>
                      </div>
                    ))
                  )}
                </div>
              </PanelCard>
            </div>

            <div className="mt-8 rounded-xl bg-secondary/10 p-6">
              <h2 className="mb-4 text-lg font-semibold">Quick Actions</h2>
              <div className="flex flex-wrap gap-3">
                <Link href="/create-request" className="rounded-lg bg-white px-4 py-2 text-sm font-medium shadow-sm hover:shadow">
                  {t("nav.createRequest")}
                </Link>
                <Link href="/find-providers" className="rounded-lg bg-white px-4 py-2 text-sm font-medium shadow-sm hover:shadow">
                  {t("nav.findProvider")}
                </Link>
                <Link href="/messages" className="rounded-lg bg-white px-4 py-2 text-sm font-medium shadow-sm hover:shadow">
                  {t("nav.messages")}
                </Link>
                <Link href="/bookings" className="rounded-lg bg-white px-4 py-2 text-sm font-medium shadow-sm hover:shadow">
                  {t("nav.bookings")}
                </Link>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
