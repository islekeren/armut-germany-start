"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LanguageToggle } from "./LanguageToggle";
import { useAuth } from "@/contexts";
import { useEffect, useMemo, useRef, useState } from "react";
import { getStoredAccessToken, notificationsApi } from "@/lib/api";

type NavLink = {
  href: string;
  label: string;
};

export function Header() {
  const t = useTranslations();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const messagesHref =
    user?.userType === "provider" ? "/dashboard/messages" : "/messages";
  const notificationsHref = "/notifications";
  const logoHref =
    isAuthenticated && user?.userType === "customer"
      ? "/customer-dashboard"
      : "/";

  const desktopMainLinks = useMemo<NavLink[]>(() => {
    if (isAuthenticated && user?.userType === "provider") {
      return [
        {
          href: "/dashboard/listings",
          label: t("nav.offers"),
        },
        {
          href: "/how-it-works",
          label: t("nav.howItWorks"),
        },
      ];
    }

    if (isAuthenticated && user?.userType === "customer") {
      return [
        {
          href: "/find-providers",
          label: t("nav.findProvider"),
        },
        {
          href: "/requests",
          label: t("nav.requests"),
        },
        {
          href: "/create-request",
          label: t("nav.createRequest"),
        },
        {
          href: "/how-it-works",
          label: t("nav.howItWorks"),
        },
      ];
    }

    return [
      {
        href: "/categories",
        label: t("nav.categories"),
      },
      {
        href: "/how-it-works",
        label: t("nav.howItWorks"),
      },
    ];
  }, [isAuthenticated, t, user?.userType]);

  const mobileLinks = useMemo<NavLink[]>(() => {
    if (isAuthenticated && user?.userType === "provider") {
      return [
        { href: "/dashboard", label: t("nav.dashboard") },
        { href: "/dashboard/listings", label: t("nav.offers") },
        { href: "/dashboard/profile", label: t("nav.profile") },
        { href: messagesHref, label: t("nav.messages") },
        { href: notificationsHref, label: t("nav.notifications") },
        { href: "/dashboard/settings", label: t("provider.dashboard.navigation.settings") },
        { href: "/how-it-works", label: t("nav.howItWorks") },
      ];
    }

    if (isAuthenticated && user?.userType === "customer") {
      return [
        { href: "/find-providers", label: t("nav.findProvider") },
        { href: "/requests", label: t("nav.requests") },
        { href: "/create-request", label: t("nav.createRequest") },
        { href: "/my-requests", label: t("nav.myRequests") },
        { href: "/bookings", label: t("nav.bookings") },
        { href: messagesHref, label: t("nav.messages") },
        { href: notificationsHref, label: t("nav.notifications") },
        { href: "/settings", label: t("provider.dashboard.navigation.settings") },
        { href: "/how-it-works", label: t("nav.howItWorks") },
      ];
    }

    return [
      { href: "/categories", label: t("nav.categories") },
      { href: "/how-it-works", label: t("nav.howItWorks") },
      { href: "/login", label: t("common.login") },
      { href: "/register", label: t("common.register") },
    ];
  }, [
    isAuthenticated,
    messagesHref,
    notificationsHref,
    t,
    user?.userType,
  ]);

  useEffect(() => {
    setShowMobileMenu(false);
    setShowDropdown(false);
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!showMobileMenu) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showMobileMenu]);

  const handleLogout = async () => {
    await logout();
    setShowDropdown(false);
    setShowMobileMenu(false);
    window.location.href = "/";
  };

  useEffect(() => {
    const loadUnread = async () => {
      if (!isAuthenticated) {
        setUnreadNotifications(0);
        return;
      }

      const token = getStoredAccessToken();
      if (!token) return;

      try {
        const result = await notificationsApi.getUnreadCount(token);
        setUnreadNotifications(result.unreadCount || 0);
      } catch {
        setUnreadNotifications(0);
      }
    };

    loadUnread();
  }, [isAuthenticated]);

  return (
    <header className="relative z-50 bg-primary text-white">
      <div className="mx-auto max-w-7xl border-b-4 border-amber-500 px-3 py-3 sm:px-6 sm:py-4 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <Link href={logoHref} className="flex min-w-0 items-center gap-2">
            <span className="truncate text-xl font-extrabold tracking-tight text-white sm:text-2xl">Armut</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-200 sm:text-sm">Germany</span>
          </Link>

          <nav className="hidden min-w-0 items-center gap-5 md:flex">
            {desktopMainLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="truncate text-white/90 hover:scale-105 hover:text-amber-300"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageToggle />

            {isLoading ? (
              <div className="h-8 w-16 animate-pulse rounded-md bg-gray-200 sm:w-20" />
            ) : isAuthenticated && user ? (
              <>
                <div className="hidden items-center gap-3 md:flex">
                  <Link
                    href={notificationsHref}
                    className="relative inline-flex h-11 items-center gap-2 rounded-md border-2 border-amber-400 bg-white px-3 text-sm font-semibold uppercase tracking-wide text-primary hover:bg-amber-50"
                  >
                    <span>{t("nav.notifications")}</span>
                    {unreadNotifications > 0 && (
                      <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">
                        {unreadNotifications > 99 ? "99+" : unreadNotifications}
                      </span>
                    )}
                  </Link>

                  <Link
                    href={messagesHref}
                    className="inline-flex h-11 items-center gap-2 rounded-md bg-amber-500 px-3 text-sm font-semibold uppercase tracking-wide text-white hover:bg-amber-600"
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
                    <span>{t("nav.messages")}</span>
                  </Link>

                  <div className="relative z-50" ref={dropdownRef}>
                    <button
                      onClick={() => setShowDropdown(!showDropdown)}
                      className="flex h-11 items-center gap-2 rounded-md px-3 hover:bg-blue-600"
                      aria-expanded={showDropdown}
                      aria-haspopup="menu"
                      aria-label={t("nav.profile")}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-white">
                        {user.firstName.charAt(0)}
                        {user.lastName.charAt(0)}
                      </div>
                      <span className="hidden text-sm font-medium lg:block">
                        {user.firstName}
                      </span>
                      <svg
                        className={`h-4 w-4 transition-transform ${showDropdown ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {showDropdown && (
                      <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border-2 border-amber-300 bg-white py-2 text-foreground">
                        <div className="border-b-2 border-amber-200 px-4 py-2">
                          <p className="text-sm font-medium">{user.firstName} {user.lastName}</p>
                          <p className="truncate text-xs text-muted">{user.email}</p>
                        </div>
                        {user.userType === "provider" ? (
                          <>
                            <Link href="/dashboard/listings" className="block px-4 py-2 text-sm hover:bg-gray-100">
                              {t("nav.offers")}
                            </Link>
                            <Link href="/dashboard" className="block px-4 py-2 text-sm hover:bg-gray-100">
                              {t("nav.dashboard")}
                            </Link>
                            <Link href="/dashboard/profile" className="block px-4 py-2 text-sm hover:bg-gray-100">
                              {t("nav.profile")}
                            </Link>
                            <Link href="/notifications" className="block px-4 py-2 text-sm hover:bg-gray-100">
                              {t("nav.notifications")}
                            </Link>
                            <Link href="/dashboard/settings" className="block px-4 py-2 text-sm hover:bg-gray-100">
                              {t("provider.dashboard.navigation.settings")}
                            </Link>
                          </>
                        ) : (
                          <>
                            <Link href="/find-providers" className="block px-4 py-2 text-sm hover:bg-gray-100">
                              {t("nav.findProvider")}
                            </Link>
                            <Link href="/requests" className="block px-4 py-2 text-sm hover:bg-gray-100">
                              {t("nav.requests")}
                            </Link>
                            <Link href="/create-request" className="block px-4 py-2 text-sm hover:bg-gray-100">
                              {t("nav.createRequest")}
                            </Link>
                            <Link href="/my-requests" className="block px-4 py-2 text-sm hover:bg-gray-100">
                              {t("nav.myRequests")}
                            </Link>
                            <Link href="/bookings" className="block px-4 py-2 text-sm hover:bg-gray-100">
                              {t("nav.bookings")}
                            </Link>
                            <Link href="/messages" className="block px-4 py-2 text-sm hover:bg-gray-100">
                              {t("nav.messages")}
                            </Link>
                            <Link href="/notifications" className="block px-4 py-2 text-sm hover:bg-gray-100">
                              {t("nav.notifications")}
                            </Link>
                            <Link href="/settings" className="block px-4 py-2 text-sm hover:bg-gray-100">
                              {t("provider.dashboard.navigation.settings")}
                            </Link>
                          </>
                        )}
                        <button
                          onClick={handleLogout}
                          className="block w-full px-4 py-2 text-left text-sm font-semibold text-error hover:bg-gray-100"
                        >
                          {t("common.logout")}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setShowMobileMenu((prev) => !prev)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-white/30 text-white md:hidden"
                  aria-expanded={showMobileMenu}
                  aria-label={showMobileMenu ? "Close menu" : "Open menu"}
                >
                  {showMobileMenu ? (
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M3 5a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Zm0 5a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Zm1 4a1 1 0 1 0 0 2h12a1 1 0 1 0 0-2H4Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              </>
            ) : (
              <>
                <div className="hidden items-center gap-3 md:flex">
                  <Link href="/login" className="text-white/90 hover:text-amber-300">
                    {t("common.login")}
                  </Link>
                  <Link
                    href="/register"
                    className="inline-flex h-11 items-center rounded-md bg-amber-500 px-4 text-sm font-semibold uppercase tracking-wide text-white hover:bg-amber-600"
                  >
                    {t("common.register")}
                  </Link>
                </div>
                <button
                  onClick={() => setShowMobileMenu((prev) => !prev)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-white/30 text-white md:hidden"
                  aria-expanded={showMobileMenu}
                  aria-label={showMobileMenu ? "Close menu" : "Open menu"}
                >
                  {showMobileMenu ? (
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M3 5a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Zm0 5a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Zm1 4a1 1 0 1 0 0 2h12a1 1 0 1 0 0-2H4Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {showMobileMenu && (
        <>
          <button
            className="fixed inset-0 z-40 bg-black/35 md:hidden"
            onClick={() => setShowMobileMenu(false)}
            aria-label="Close menu"
          />
          <div className="fixed inset-x-0 top-[68px] z-50 max-h-[calc(100dvh-68px)] overflow-y-auto border-t border-border bg-white text-foreground shadow-xl md:hidden">
            {isAuthenticated && user ? (
              <div className="border-b border-border px-4 py-3">
                <p className="font-semibold">{user.firstName} {user.lastName}</p>
                <p className="truncate text-sm text-muted">{user.email}</p>
              </div>
            ) : null}
            <nav className="grid gap-1 px-3 py-3">
              {mobileLinks.map((item) => (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  className="rounded-lg px-3 py-3 text-sm font-medium hover:bg-background"
                  onClick={() => setShowMobileMenu(false)}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            {isAuthenticated && (
              <div className="border-t border-border p-3">
                <button
                  onClick={handleLogout}
                  className="w-full rounded-lg border border-red-200 px-4 py-3 text-left text-sm font-semibold text-error hover:bg-red-50"
                >
                  {t("common.logout")}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </header>
  );
}
