import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Geist } from "next/font/google";
import type { Metadata } from "next";
import "../globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "Municipal Vote Guide NL 2026",
  description:
    "Find your best party match for the 2026 Dutch municipal elections. Bilingual (NL/EN) vote matching for all 258 municipalities.",
  openGraph: {
    title: "Municipal Vote Guide NL 2026",
    description:
      "Find your best party match for the 2026 Dutch municipal elections.",
    type: "website",
  },
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const messages = await getMessages();

  return (
    <html lang={locale} className={geist.variable}>
      <body className="min-h-screen bg-white text-gray-900 antialiased dark:bg-gray-950 dark:text-gray-100">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <header className="border-b border-gray-200 dark:border-gray-800">
            <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
              <a href={`/${locale}`} className="text-lg font-semibold tracking-tight">
                🗳️ Vote Guide NL 2026
              </a>
              <div className="flex items-center gap-3">
                <a
                  href={locale === "en" ? "/nl" : "/en"}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  {locale === "en" ? "🇳🇱 NL" : "🇬🇧 EN"}
                </a>
              </div>
            </nav>
          </header>
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
          <footer className="border-t border-gray-200 py-6 text-center text-sm text-gray-500 dark:border-gray-800">
            <p>
              Open source on{" "}
              <a
                href="https://github.com/rhnfzl/municipal-vote-guide-nl-2026"
                className="underline hover:text-gray-900 dark:hover:text-gray-100"
                target="_blank"
                rel="noopener"
              >
                GitHub
              </a>{" "}
              · Gemeenteraadsverkiezingen 18 maart 2026
            </p>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
