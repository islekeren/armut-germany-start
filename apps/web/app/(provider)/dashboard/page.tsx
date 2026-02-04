"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useEffect, useState } from "react";
import { providerApi, DashboardData } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

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

export default function ProviderDashboard() {
  const t = useTranslations("provider.dashboard");
  const locale = useLocale();
  const { user } = useAuth(); // Assuming useAuth exists and provides user context
  const [data, setData] = useState<DashboardData>(initialData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const token = localStorage.getItem("armut_access_token");
        if (token) {
          const dashboardData = await providerApi.getDashboard(token);
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
          setData(formattedData);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const stats = [
    { labelKey: "newRequests", value: data.stats.newRequests, icon: "📬", color: "bg-blue-500" },
    { labelKey: "activeOrders", value: data.stats.activeOrders, icon: "🔧", color: "bg-secondary" },
    { labelKey: "completed", value: data.stats.completed, icon: "✅", color: "bg-green-500" },
    { labelKey: "rating", value: data.stats.rating.toFixed(1), icon: "⭐", color: "bg-yellow-500" },
  ];

  if (loading) {
    return <div className="flex h-screen items-center justify-center">{t("loading")}</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl font-bold text-primary">Armut</span>
              <span className="text-sm text-muted">Pro</span>
            </Link>
            <div className="flex items-center gap-4">
              <LanguageToggle />
              <Link
                href="/dashboard/messages"
                className="relative text-muted hover:text-foreground"
              >
                <span className="text-xl">💬</span>
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-error text-xs text-white">
                  3
                </span>
              </Link>
              <Link
                href="/dashboard/profile"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-white"
              >
                {user?.firstName?.charAt(0) || "P"}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Sidebar */}
          <aside className="w-full lg:w-64">
            <nav className="rounded-xl bg-white p-4 shadow-sm">
              <ul className="space-y-1">
                <li>
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-3 rounded-lg bg-primary/10 px-4 py-3 font-medium text-primary"
                  >
                    <span>📊</span> {t("navigation.overview")}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dashboard/requests"
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-muted hover:bg-background"
                  >
                    <span>📬</span> {t("navigation.requests")}
                    {data.stats.newRequests > 0 && (
                      <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs text-white">
                        {data.stats.newRequests}
                      </span>
                    )}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dashboard/orders"
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-muted hover:bg-background"
                  >
                    <span>📋</span> {t("navigation.orders")}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dashboard/calendar"
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-muted hover:bg-background"
                  >
                    <span>📅</span> {t("navigation.calendar")}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dashboard/messages"
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-muted hover:bg-background"
                  >
                    <span>💬</span> {t("navigation.messages")}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dashboard/reviews"
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-muted hover:bg-background"
                  >
                    <span>⭐</span> {t("navigation.reviews")}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dashboard/finances"
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-muted hover:bg-background"
                  >
                    <span>💰</span> {t("navigation.finances")}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dashboard/profile"
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-muted hover:bg-background"
                  >
                    <span>👤</span> {t("navigation.profile")}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dashboard/settings"
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-muted hover:bg-background"
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
              <h1 className="text-2xl font-bold">
                {t("welcomeBack", { name: user?.firstName || "Provider" })}
              </h1>
              <p className="text-muted">
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

            <div className="grid gap-8 lg:grid-cols-2">
              {/* Recent Requests */}
              <div className="rounded-xl bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{t("sections.newRequests")}</h2>
                  <Link
                    href="/dashboard/requests"
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
                        <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">
                          {t("sendOffer")}
                        </button>
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
                    data.activeBookings.map((booking) => (
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
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            booking.status === "confirmed"
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {t(`status.${booking.status}`)}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-4 text-sm text-muted">
                        <span>📅 {booking.date}</span>
                        <span>🕐 {booking.time}</span>
                      </div>
                    </div>
                  ))
                  )}
                </div>
                <Link
                  href="/dashboard/orders"
                  className="mt-4 block text-center text-sm text-primary hover:underline"
                >
                  {t("allOrders")}
                </Link>
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
