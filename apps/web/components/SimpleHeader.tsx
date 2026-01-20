"use client";

import Link from "next/link";
import { LanguageToggle } from "./LanguageToggle";

export function SimpleHeader() {
  return (
    <header className="absolute top-0 left-0 right-0 z-10">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-primary">
            Armut
          </Link>
          <LanguageToggle />
        </div>
      </div>
    </header>
  );
}
