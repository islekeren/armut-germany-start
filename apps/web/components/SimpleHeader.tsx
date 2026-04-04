"use client";

import Link from "next/link";
import { LanguageToggle } from "./LanguageToggle";

export function SimpleHeader() {
  return (
    <header className="absolute left-0 right-0 top-0 z-10 bg-primary text-white">
      <div className="mx-auto max-w-7xl border-b-4 border-amber-500 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xl font-extrabold text-white sm:text-2xl">
            Armut
          </Link>
          <LanguageToggle />
        </div>
      </div>
    </header>
  );
}
