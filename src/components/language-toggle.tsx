"use client";

import { usePathname } from "next/navigation";

export function LanguageToggle({ locale }: { locale: string }) {
  const pathname = usePathname();

  // Replace the locale prefix in the current path
  // /en/s-hertogenbosch/questionnaire → /nl/s-hertogenbosch/questionnaire
  function getLocalePath(targetLocale: string) {
    if (!pathname) return `/${targetLocale}`;
    // Remove current locale prefix and add new one
    const pathWithoutLocale = pathname.replace(/^\/(en|nl)/, "");
    return `/${targetLocale}${pathWithoutLocale}`;
  }

  return (
    <div
      className="flex rounded-lg border border-gray-200 overflow-hidden dark:border-gray-700"
      role="group"
      aria-label="Language"
    >
      <a
        href={getLocalePath("en")}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold transition-colors ${
          locale === "en"
            ? "bg-blue-600 text-white"
            : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
        }`}
        aria-current={locale === "en" ? "true" : undefined}
        aria-label="English"
      >
        <svg className="h-4 w-5 rounded-sm" viewBox="0 0 60 30" aria-hidden="true">
          <rect width="60" height="30" fill="#012169" />
          <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
          <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="4" />
          <path d="M30,0v30M0,15h60" stroke="#fff" strokeWidth="10" />
          <path d="M30,0v30M0,15h60" stroke="#C8102E" strokeWidth="6" />
        </svg>
        EN
      </a>
      <a
        href={getLocalePath("nl")}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold transition-colors border-l border-gray-200 dark:border-gray-700 ${
          locale === "nl"
            ? "bg-blue-600 text-white"
            : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
        }`}
        aria-current={locale === "nl" ? "true" : undefined}
        aria-label="Nederlands"
      >
        <svg className="h-4 w-5 rounded-sm" viewBox="0 0 9 6" aria-hidden="true">
          <rect width="9" height="2" fill="#AE1C28" />
          <rect y="2" width="9" height="2" fill="#FFF" />
          <rect y="4" width="9" height="2" fill="#21468B" />
        </svg>
        NL
      </a>
    </div>
  );
}
