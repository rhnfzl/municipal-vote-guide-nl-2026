import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Geist } from "next/font/google";
import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { DarkModeToggle } from "@/components/dark-mode-toggle";
import "../globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "Municipal Vote Guide NL 2026",
  description:
    "Find your best party match for the 2026 Dutch municipal elections. Bilingual (NL/EN) vote matching for all 258 municipalities.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "Municipal Vote Guide NL 2026",
    description: "Find your best party match for the 2026 Dutch municipal elections.",
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
  const tNav = await getTranslations("nav");
  const tFooter = await getTranslations("footer");

  return (
    <html lang={locale} className={geist.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/90 backdrop-blur-md dark:border-gray-800/80 dark:bg-gray-950/90">
              <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
                <a
                  href={`/${locale}`}
                  className="flex items-center gap-2 text-base font-bold tracking-tight text-gray-900 hover:text-gray-700 transition-colors dark:text-gray-100 dark:hover:text-gray-300 sm:text-lg"
                  aria-label="Home"
                >
                  <span className="text-xl" aria-hidden="true">🗳️</span>
                  <span className="hidden sm:inline">Municipal Vote Guide NL 2026</span>
                  <span className="sm:hidden">MVG NL 2026</span>
                </a>

                <div className="flex items-center gap-1.5 sm:gap-2">
                  {/* Explore link */}
                  <a
                    href={`/${locale}/explore`}
                    className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                  >
                    {tNav("explore")}
                  </a>

                  {/* Language Toggle with SVG flags */}
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden dark:border-gray-700" role="group" aria-label="Language">
                    <a
                      href="/en"
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold transition-colors ${
                        locale === "en"
                          ? "bg-blue-600 text-white"
                          : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
                      }`}
                      aria-current={locale === "en" ? "true" : undefined}
                      aria-label="English"
                    >
                      <svg className="h-4 w-5 rounded-sm" viewBox="0 0 60 30" aria-hidden="true">
                        <rect width="60" height="30" fill="#012169"/>
                        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6"/>
                        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="4"/>
                        <path d="M30,0v30M0,15h60" stroke="#fff" strokeWidth="10"/>
                        <path d="M30,0v30M0,15h60" stroke="#C8102E" strokeWidth="6"/>
                      </svg>
                      EN
                    </a>
                    <a
                      href="/nl"
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold transition-colors border-l border-gray-200 dark:border-gray-700 ${
                        locale === "nl"
                          ? "bg-blue-600 text-white"
                          : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
                      }`}
                      aria-current={locale === "nl" ? "true" : undefined}
                      aria-label="Nederlands"
                    >
                      <svg className="h-4 w-5 rounded-sm" viewBox="0 0 9 6" aria-hidden="true">
                        <rect width="9" height="2" fill="#AE1C28"/>
                        <rect y="2" width="9" height="2" fill="#FFF"/>
                        <rect y="4" width="9" height="2" fill="#21468B"/>
                      </svg>
                      NL
                    </a>
                  </div>

                  {/* Dark mode */}
                  <DarkModeToggle />
                </div>
              </nav>
            </header>

            {/* Main */}
            <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
              {children}
            </main>

            {/* Footer — fully translated */}
            <footer className="mt-auto border-t border-gray-200/80 bg-white py-8 dark:border-gray-800/80 dark:bg-gray-950">
              <div className="mx-auto max-w-5xl px-4 text-center text-sm text-gray-500">
                <p>
                  {tFooter("openSource")}{" "}
                  <a
                    href="https://github.com/rhnfzl/municipal-vote-guide-nl-2026"
                    className="font-medium underline underline-offset-4 hover:text-gray-900 dark:hover:text-gray-100"
                    target="_blank"
                    rel="noopener"
                  >
                    {tFooter("github")}
                  </a>{" "}
                  · {tFooter("electionInfo")}
                </p>
                <p className="mt-2 text-xs text-gray-400">
                  {tFooter("disclaimer")}
                </p>
              </div>
            </footer>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
