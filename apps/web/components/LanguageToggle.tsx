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
      className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted hover:border-primary hover:text-foreground transition-colors disabled:opacity-50"
      aria-label={locale === 'de' ? 'Switch to English' : 'Zu Deutsch wechseln'}
    >
      <span className="text-base">{locale === 'de' ? '🇩🇪' : '🇬🇧'}</span>
    </button>
  );
}
