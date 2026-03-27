"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { LanguageToggle } from "./LanguageToggle";
import { useAuth } from "@/contexts";
import { useState, useRef, useEffect } from "react";
import { getStoredAccessToken, notificationsApi } from "@/lib/api";

export function Header() {
  const t = useTranslations();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const messagesHref =
    user?.userType === "provider" ? "/dashboard/messages" : "/messages";
  const notificationsHref = "/notifications";

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    setShowDropdown(false);
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
    <header className="relative z-50 bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold text-primary">Armut</span>
            <span className="text-sm text-muted">Germany</span>
          </Link>
          <nav className="hidden gap-6 md:flex">
            {isAuthenticated && user?.userType === "provider" ? (
              <Link href="/dashboard/listings" className="text-muted hover:text-foreground">
                {t("nav.offers")}
              </Link>
            ) : isAuthenticated && user?.userType === "customer" ? (
              <>
                <Link href="/find-providers" className="text-muted hover:text-foreground">
                  {t("nav.findProvider")}
                </Link>
                <Link href="/requests" className="text-muted hover:text-foreground">
                  {t("nav.requests")}
                </Link>
                <Link href="/create-request" className="text-muted hover:text-foreground">
                  {t("nav.createRequest")}
                </Link>
              </>
            ) : (
              <Link href="/categories" className="text-muted hover:text-foreground">
                {t("nav.categories")}
              </Link>
            )}
            <Link href="/how-it-works" className="text-muted hover:text-foreground">
              {t("nav.howItWorks")}
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <LanguageToggle />
            {isLoading ? (
              <div className="h-8 w-20 animate-pulse rounded bg-gray-200" />
            ) : isAuthenticated && user ? (
              <div className="flex items-center gap-3">
                <Link
                  href={notificationsHref}
                  className="relative inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-foreground hover:bg-background"
                >
                  <span>{t("nav.notifications")}</span>
                  {unreadNotifications > 0 && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-white">
                      {unreadNotifications > 99 ? "99+" : unreadNotifications}
                    </span>
                  )}
                </Link>
                <Link
                  href={messagesHref}
                  className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
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
                    className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-gray-100"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-white">
                      {user.firstName.charAt(0)}
                      {user.lastName.charAt(0)}
                    </div>
                    <span className="hidden text-sm font-medium md:block">
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
                    <div className="absolute right-0 z-50 mt-2 w-48 rounded-lg bg-white py-2 shadow-lg ring-1 ring-black ring-opacity-5">
                    <div className="border-b px-4 py-2">
                      <p className="text-sm font-medium">{user.firstName} {user.lastName}</p>
                      <p className="text-xs text-muted">{user.email}</p>
                    </div>
                    {user.userType === "provider" ? (
                      <>
                        <Link
                          href="/dashboard/listings"
                          className="block px-4 py-2 text-sm hover:bg-gray-100"
                          onClick={() => setShowDropdown(false)}
                        >
                          {t("nav.offers")}
                        </Link>
                        <Link
                          href="/dashboard"
                          className="block px-4 py-2 text-sm hover:bg-gray-100"
                          onClick={() => setShowDropdown(false)}
                        >
                          {t("nav.dashboard")}
                        </Link>
                        <Link
                          href="/dashboard/profile"
                          className="block px-4 py-2 text-sm hover:bg-gray-100"
                          onClick={() => setShowDropdown(false)}
                        >
                          {t("nav.profile")}
                        </Link>
                        <Link
                          href="/notifications"
                          className="block px-4 py-2 text-sm hover:bg-gray-100"
                          onClick={() => setShowDropdown(false)}
                        >
                          {t("nav.notifications")}
                        </Link>
                      </>
                    ) : (
                      <>
                        <Link
                          href="/find-providers"
                          className="block px-4 py-2 text-sm hover:bg-gray-100"
                          onClick={() => setShowDropdown(false)}
                        >
                          {t("nav.findProvider")}
                        </Link>
                        <Link
                          href="/requests"
                          className="block px-4 py-2 text-sm hover:bg-gray-100"
                          onClick={() => setShowDropdown(false)}
                        >
                          {t("nav.requests")}
                        </Link>
                        <Link
                          href="/create-request"
                          className="block px-4 py-2 text-sm hover:bg-gray-100"
                          onClick={() => setShowDropdown(false)}
                        >
                          {t("nav.createRequest")}
                        </Link>
                        <Link
                          href="/my-requests"
                          className="block px-4 py-2 text-sm hover:bg-gray-100"
                          onClick={() => setShowDropdown(false)}
                        >
                          {t("nav.myRequests")}
                        </Link>
                        <Link
                          href="/bookings"
                          className="block px-4 py-2 text-sm hover:bg-gray-100"
                          onClick={() => setShowDropdown(false)}
                        >
                          {t("nav.bookings")}
                        </Link>
                        <Link
                          href="/messages"
                          className="block px-4 py-2 text-sm hover:bg-gray-100"
                          onClick={() => setShowDropdown(false)}
                        >
                          {t("nav.messages")}
                        </Link>
                        <Link
                          href="/notifications"
                          className="block px-4 py-2 text-sm hover:bg-gray-100"
                          onClick={() => setShowDropdown(false)}
                        >
                          {t("nav.notifications")}
                        </Link>
                      </>
                    )}
                    <button
                      onClick={handleLogout}
                      className="block w-full px-4 py-2 text-left text-sm text-error hover:bg-gray-100"
                    >
                      {t("common.logout")}
                    </button>
                  </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <Link href="/login" className="text-muted hover:text-foreground">
                  {t("common.login")}
                </Link>
                <Link
                  href="/register"
                  className="rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary-dark"
                >
                  {t("common.register")}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
