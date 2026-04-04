"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useEffect, useState } from "react";
import {
  providerApi,
  DashboardData,
  messagesApi,
  notificationsApi,
  quotesApi,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  getBookingDisplayStatusClass,
  toBookingDisplayStatus,
} from "@/lib/bookings";

// Initial empty state
const initialData: DashboardData = {
  stats: {
    newRequests: 0,
    activeOrders: 0,
    completed: 0,
    rating: 0,
  },
  recentRequests: [],
  activeBookings: [],
};

interface PendingOfferItem {
  id: string;
  title: string;
  customer: string;
  location: string;
  price: number;
  createdAt: string;
  validUntil: string;
}

export default function ProviderDashboard() {
  const t = useTranslations("provider.dashboard");
  const tOrderStatus = useTranslations("provider.orders.status");
  const locale = useLocale();
  const { user } = useAuth(); // Assuming useAuth exists and provides user context
  const [data, setData] = useState<DashboardData>(initialData);
  const [pendingOffers, setPendingOffers] = useState<PendingOfferItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const token = localStorage.getItem("armut_access_token");
        if (token) {
          const [dashboardData, unreadMessagesData, unreadNotificationsData, quoteData] = await Promise.all([
            providerApi.getDashboard(token),
            messagesApi.getUnreadCount(token),
            notificationsApi.getUnreadCount(token),
            quotesApi.getMyQuotes(token),
          ]);
          // Format dates for display
          const formattedData = {
            ...dashboardData,
            recentRequests: dashboardData.recentRequests.map(r => ({
              ...r,
              date: new Date(r.date).toLocaleDateString(locale),
            })),
            activeBookings: dashboardData.activeBookings.map(b => ({
              ...b,
              date: new Date(b.date).toLocaleDateString(locale),
              time: new Date(b.date).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
            }))
          };
          const formattedPendingOffers = quoteData
            .filter((quote) => quote.status === "pending")
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            )
            .slice(0, 3)
            .map((quote) => ({
              id: quote.id,
              title: quote.request?.title || t("pendingOffersUntitled"),
              customer: quote.request?.customer
                ? `${quote.request.customer.firstName} ${quote.request.customer.lastName}`
                : t("pendingOffersUnknownCustomer"),
              location: [quote.request?.postalCode, quote.request?.city]
                .filter(Boolean)
                .join(" "),
              price: quote.price,
              createdAt: new Date(quote.createdAt).toLocaleDateString(locale),
              validUntil: new Date(quote.validUntil).toLocaleDateString(locale),
            }));
          setData(formattedData);
          setPendingOffers(formattedPendingOffers);
          setUnreadMessages(unreadMessagesData.unreadCount);
          setUnreadNotifications(unreadNotificationsData.unreadCount);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [locale, t]);

  const stats = [
    { labelKey: "newRequests", value: data.stats.newRequests, icon: "📬", color: "bg-blue-500" },
    { labelKey: "activeOrders", value: data.stats.activeOrders, icon: "🔧", color: "bg-secondary" },
    { labelKey: "completed", value: data.stats.completed, icon: "✅", color: "bg-green-500" },
    { labelKey: "rating", value: data.stats.rating.toFixed(1), icon: "⭐", color: "bg-yellow-500" },
  ];

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">{t("loading")}</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-3 py-3 sm:px-6 sm:py-4 lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold text-primary sm:text-2xl">Armut</span>
              <span className="text-sm text-muted">Pro</span>
            </Link>
            <div className="flex items-center gap-2 sm:gap-4">
              <LanguageToggle />
              <Link
                href="/notifications"
                className="relative inline-flex items-center gap-2 rounded-lg border border-border bg-white px-2 py-2 text-sm font-semibold text-foreground hover:bg-background sm:px-3"
              >
                <span className="hidden sm:inline">{t("navigation.notifications")}</span>
                <span className="sm:hidden">🔔</span>
                {unreadNotifications > 0 && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-white">
                    {unreadNotifications > 99 ? "99+" : unreadNotifications}
                  </span>
                )}
              </Link>
              <Link
                href="/dashboard/messages"
                className="relative inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-2 py-2 text-sm font-semibold text-primary hover:bg-primary/10 sm:px-3"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 8h10M7 12h6m-8 8 3.5-3H19a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2v3Z"
                  />
                </svg>
                <span className="hidden sm:inline">{t("navigation.messages")}</span>
                {unreadMessages > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 text-xs text-white">
                    {unreadMessages}
                  </span>
                )}
              </Link>
              <Link
                href="/dashboard/profile"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm text-white sm:h-10 sm:w-10"
              >
                {user?.firstName?.charAt(0) || "P"}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Sidebar */}
          <aside className="w-full lg:w-64">
            <nav className="rounded-xl bg-white p-3 shadow-sm sm:p-4">
              <ul className="flex gap-1 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
                <li className="min-w-max lg:min-w-0">
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary sm:px-4 sm:py-3"
                  >
                    <span>📊</span> {t("navigation.overview")}
                  </Link>
                </li>
                <li className="min-w-max lg:min-w-0">
                  <Link
                    href="/dashboard/listings"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-background sm:px-4 sm:py-3"
                  >
                    <span>📬</span> {t("navigation.requests")}
                    {data.stats.newRequests > 0 && (
                      <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs text-white">
                        {data.stats.newRequests}
                      </span>
                    )}
                  </Link>
                </li>
                <li className="min-w-max lg:min-w-0">
                  <Link
                    href="/dashboard/offers"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-background sm:px-4 sm:py-3"
                  >
                    <span>💶</span> {t("navigation.pendingOffers")}
                  </Link>
                </li>
                <li className="min-w-max lg:min-w-0">
                  <Link
                    href="/dashboard/orders"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-background sm:px-4 sm:py-3"
                  >
                    <span>📋</span> {t("navigation.orders")}
                  </Link>
                </li>
                <li className="min-w-max lg:min-w-0">
                  <Link
                    href="/dashboard/calendar"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-background sm:px-4 sm:py-3"
                  >
                    <span>📅</span> {t("navigation.calendar")}
                  </Link>
                </li>
                <li className="min-w-max lg:min-w-0">
                  <Link
                    href="/dashboard/messages"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-background sm:px-4 sm:py-3"
                  >
                    <span>💬</span> {t("navigation.messages")}
                  </Link>
                </li>
                <li className="min-w-max lg:min-w-0">
                  <Link
                    href="/dashboard/reviews"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-background sm:px-4 sm:py-3"
                  >
                    <span>⭐</span> {t("navigation.reviews")}
                  </Link>
                </li>
                <li className="min-w-max lg:min-w-0">
                  <Link
                    href="/dashboard/finances"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-background sm:px-4 sm:py-3"
                  >
                    <span>💰</span> {t("navigation.finances")}
                  </Link>
                </li>
                <li className="min-w-max lg:min-w-0">
                  <Link
                    href="/dashboard/profile"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-background sm:px-4 sm:py-3"
                  >
                    <span>👤</span> {t("navigation.profile")}
                  </Link>
                </li>
                <li className="min-w-max lg:min-w-0">
                  <Link
                    href="/dashboard/settings"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-background sm:px-4 sm:py-3"
                  >
                    <span>⚙️</span> {t("navigation.settings")}
                  </Link>
                </li>
              </ul>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            {/* Welcome */}
            <div className="mb-8">
              <h1 className="text-xl font-bold sm:text-2xl">
                {t("welcomeBack", { name: user?.firstName || "Provider" })}
              </h1>
              <p className="text-sm text-muted sm:text-base">
                {t("activityOverview")}
              </p>
            </div>

            {/* Stats */}
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat) => (
                <div
                  key={stat.labelKey}
                  className="rounded-xl bg-white p-6 shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-lg ${stat.color} text-2xl text-white`}
                    >
                      {stat.icon}
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{stat.value}</div>
                      <div className="text-sm text-muted">{t(`stats.${stat.labelKey}`)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
              {/* Recent Requests */}
              <div className="rounded-xl bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{t("sections.newRequests")}</h2>
                  <Link
                    href="/dashboard/listings"
                    className="text-sm text-primary hover:underline"
                  >
                    {t("viewAll")}
                  </Link>
                </div>
                <div className="space-y-4">
                  {data.recentRequests.length === 0 ? (
                      <p className="text-muted text-sm">{t("noRequests")}</p>
                  ) : (
                    data.recentRequests.map((request) => (
                    <div
                      key={request.id}
                      className="rounded-lg border border-border p-4 transition hover:border-primary"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium">{request.title}</h3>
                          <p className="text-sm text-muted">
                            {request.category} • {request.location}
                          </p>
                        </div>
                        <span className="text-sm text-muted">{request.date}</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-sm font-medium text-secondary">
                          {request.budget}
                        </span>
                        <span className="text-xs text-muted">#{request.id.slice(0, 8)}</span>
                      </div>
                    </div>
                  ))
                  )}
                </div>
              </div>

              {/* Active Bookings */}
              <div className="rounded-xl bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{t("sections.upcomingAppointments")}</h2>
                  <Link
                    href="/dashboard/calendar"
                    className="text-sm text-primary hover:underline"
                  >
                    {t("calendar")}
                  </Link>
                </div>
                <div className="space-y-4">
                  {data.activeBookings.length === 0 ? (
                    <p className="text-muted text-sm">{t("noAppointments")}</p>
                  ) : (
                    data.activeBookings.map((booking) => {
                      const displayStatus = toBookingDisplayStatus(booking.status);
                      return (
                    <div
                      key={booking.id}
                      className="rounded-lg border border-border p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium">{booking.service}</h3>
                          <p className="text-sm text-muted">
                            {booking.customer}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${getBookingDisplayStatusClass(displayStatus)}`}
                        >
                          {tOrderStatus(displayStatus)}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-4 text-sm text-muted">
                        <span>📅 {booking.date}</span>
                        <span>🕐 {booking.time}</span>
                      </div>
                    </div>
                      );
                    })
                  )}
                </div>
                <Link
                  href="/dashboard/orders"
                  className="mt-4 block text-center text-sm text-primary hover:underline"
                >
                  {t("allOrders")}
                </Link>
              </div>

              {/* Pending Offers */}
              <div className="rounded-xl bg-white p-6 shadow-sm md:col-span-2 xl:col-span-1">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{t("sections.pendingOffers")}</h2>
                  <Link
                    href="/dashboard/offers"
                    className="text-sm text-primary hover:underline"
                  >
                    {t("viewAll")}
                  </Link>
                </div>
                <div className="space-y-4">
                  {pendingOffers.length === 0 ? (
                    <p className="text-sm text-muted">{t("noPendingOffers")}</p>
                  ) : (
                    pendingOffers.map((offer) => (
                      <div
                        key={offer.id}
                        className="rounded-lg border border-border p-4 transition hover:border-primary"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-medium">{offer.title}</h3>
                            <p className="text-sm text-muted">{offer.customer}</p>
                            {offer.location && (
                              <p className="text-sm text-muted">{offer.location}</p>
                            )}
                          </div>
                          <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700">
                            {t("status.pending")}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-sm">
                          <span className="font-medium text-secondary">€{offer.price}</span>
                          <span className="text-muted">{offer.createdAt}</span>
                        </div>
                        <p className="mt-2 text-xs text-muted">
                          {t("pendingOfferValidUntil", { date: offer.validUntil })}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-8 rounded-xl bg-secondary/10 p-6">
              <h2 className="mb-4 text-lg font-semibold">{t("sections.quickActions")}</h2>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/dashboard/profile"
                  className="rounded-lg bg-white px-4 py-2 text-sm font-medium shadow-sm hover:shadow"
                >
                  {t("quickActionButtons.editProfile")}
                </Link>
                <Link
                  href="/dashboard/services"
                  className="rounded-lg bg-white px-4 py-2 text-sm font-medium shadow-sm hover:shadow"
                >
                  {t("quickActionButtons.manageServices")}
                </Link>
                <Link
                  href="/dashboard/calendar"
                  className="rounded-lg bg-white px-4 py-2 text-sm font-medium shadow-sm hover:shadow"
                >
                  {t("quickActionButtons.setAvailability")}
                </Link>
                <Link
                  href="/dashboard/finances"
                  className="rounded-lg bg-white px-4 py-2 text-sm font-medium shadow-sm hover:shadow"
                >
                  {t("quickActionButtons.requestPayout")}
                </Link>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
