import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getLocale } from 'next-intl/server';
import { AuthProvider } from "@/contexts";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Armut Germany - Finden Sie die besten Dienstleister",
  description:
    "Armut Germany verbindet Sie mit qualifizierten Fachleuten für Reinigung, Umzug, Renovierung und mehr. Erhalten Sie kostenlose Angebote von verifizierten Dienstleistern.",
  keywords: [
    "Dienstleister",
    "Handwerker",
    "Reinigung",
    "Umzug",
    "Renovierung",
    "Deutschland",
  ],
  openGraph: {
    title: "Armut Germany - Finden Sie die besten Dienstleister",
    description:
      "Verbinden Sie sich mit qualifizierten Fachleuten für alle Ihre Dienstleistungsbedürfnisse.",
    locale: "de_DE",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            {children}
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
