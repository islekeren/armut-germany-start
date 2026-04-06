'use client';

import { useTransition } from 'react';
import { useLocale } from 'next-intl';
import { setLocale } from '@/lib/locale';
import { type Locale } from '@/i18n/request';

export function LanguageToggle() {
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  const toggleLanguage = () => {
    const newLocale: Locale = locale === 'de' ? 'en' : 'de';
    startTransition(async () => {
      await setLocale(newLocale);
      window.location.reload();
    });
  };

  return (
    <button
      onClick={toggleLanguage}
      disabled={isPending}
      className="flex h-12 items-center gap-2 rounded-md border-2 border-border px-4 text-sm font-semibold tracking-wide text-foreground hover:scale-105 hover:border-primary hover:bg-gray-100 disabled:opacity-50"
      aria-label={locale === 'de' ? 'Switch to English' : 'Zu Deutsch wechseln'}
    >
      <span className="text-base">{locale === 'de' ? '🇩🇪' : '🇬🇧'}</span>
    </button>
  );
}
