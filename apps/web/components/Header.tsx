"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { LanguageToggle } from "./LanguageToggle";
import { useAuth } from "@/contexts";
import { useState, useRef, useEffect } from "react";

export function Header() {
  const t = useTranslations();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  return (
    <header className="bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold text-primary">Armut</span>
            <span className="text-sm text-muted">Germany</span>
          </Link>
          <div className="flex items-center gap-4">
            <LanguageToggle />
            {isLoading ? (
              <div className="h-8 w-20 animate-pulse rounded bg-gray-200" />
            ) : isAuthenticated && user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-gray-100"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-white">
                    {user.firstName.charAt(0)}{user.lastName.charAt(0)}
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
                  <div className="absolute right-0 mt-2 w-48 rounded-lg bg-white py-2 shadow-lg ring-1 ring-black ring-opacity-5">
                    <div className="border-b px-4 py-2">
                      <p className="text-sm font-medium">{user.firstName} {user.lastName}</p>
                      <p className="text-xs text-muted">{user.email}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="block w-full px-4 py-2 text-left text-sm text-error hover:bg-gray-100"
                    >
                      {t("common.logout")}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link href="/anmelden" className="text-muted hover:text-foreground">
                  {t("common.login")}
                </Link>
                <Link
                  href="/registrieren"
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
