"use client";

import { useTranslations, useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MdCheckCircle, MdWarning } from "@/components/icons";
import type { MunicipalityData } from "@/lib/types";

export default function ImportantTopicsPage() {
  const t = useTranslations("flow");
  const locale = useLocale();
  const params = useParams();
  const router = useRouter();
  const slug = params.municipality as string;

  const [data, setData] = useState<MunicipalityData | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [tooFast, setTooFast] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const MAX_TOPICS = 3;

  useEffect(() => {
    fetch(`/data/municipalities/${slug}/${locale === "en" ? "en" : "nl"}.json`)
      .then((r) => (r.ok ? r : fetch(`/data/municipalities/${slug}/nl.json`)))
      .then((r) => r.json())
      .then(setData);

    // Speed check
    const startTime = sessionStorage.getItem(`vg-${slug}-startTime`);
    if (startTime) {
      const elapsed = (Date.now() - parseInt(startTime)) / 1000;
      const numStatements = parseInt(sessionStorage.getItem(`vg-${slug}-numStatements`) || "30");
      if (elapsed < 1.5 * numStatements) {
        setTooFast(true);
      }
    }
  }, [slug, locale]);

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl space-y-6" aria-live="polite">
        <Skeleton className="h-10 w-80 mx-auto" />
        <Skeleton className="h-6 w-60 mx-auto" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // Get unique themes with their statement IDs (1:1 mapping)
  const themes = data.statements.map((s) => ({
    id: s.id,
    theme: s.theme,
    themeEn: s.titleEn ? s.theme : undefined, // theme name already translated in en.json
  }));

  // Deduplicate by theme name (some themes might repeat if multiple statements share a theme)
  const uniqueThemes = Array.from(
    new Map(themes.map((t) => [t.theme, t])).values()
  );

  function toggleTopic(statementId: number) {
    setSelected((prev) => {
      if (prev.includes(statementId)) {
        return prev.filter((id) => id !== statementId);
      }
      if (prev.length >= MAX_TOPICS) return prev;
      return [...prev, statementId];
    });
  }

  function proceed() {
    sessionStorage.setItem(`vg-${slug}-priorities`, JSON.stringify(selected));
    router.push(`/${locale}/${slug}/party-filter`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Speed check warning */}
      {tooFast && !dismissed && (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-start gap-3">
              <MdWarning className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                  {t("speedWarning")}
                </h3>
                <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                  {t("speedWarningDesc")}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                className="border-amber-400"
                onClick={() => router.push(`/${locale}/${slug}/questionnaire`)}
              >
                {t("goBack")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDismissed(true)}
              >
                {t("continueAnyway")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {t("importantTopics")}
        </h1>
        <p className="text-gray-500">{t("importantTopicsDesc")}</p>
        <Badge variant="secondary" className="text-sm px-4 py-1">
          {t("topicsSelected", { count: selected.length })}
        </Badge>
      </div>

      {/* Theme grid */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {uniqueThemes.map(({ id, theme }) => {
          const isSelected = selected.includes(id);
          const isDisabled = !isSelected && selected.length >= MAX_TOPICS;

          return (
            <button
              key={id}
              onClick={() => toggleTopic(id)}
              disabled={isDisabled}
              className={`flex items-center gap-3 rounded-xl border p-3.5 text-left text-sm font-medium transition-all ${
                isSelected
                  ? "border-blue-500 bg-blue-50 text-blue-800 dark:border-blue-400 dark:bg-blue-950/30 dark:text-blue-300"
                  : isDisabled
                    ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed dark:border-gray-800 dark:bg-gray-900"
                    : "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50/50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              }`}
              aria-pressed={isSelected}
            >
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-md border shrink-0 ${
                  isSelected
                    ? "border-blue-500 bg-blue-500 text-white"
                    : "border-gray-300 dark:border-gray-600"
                }`}
              >
                {isSelected && <MdCheckCircle className="h-3.5 w-3.5" />}
              </div>
              <span>{theme}</span>
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="ghost"
          onClick={() => {
            sessionStorage.setItem(`vg-${slug}-priorities`, "[]");
            router.push(`/${locale}/${slug}/party-filter`);
          }}
        >
          {t("skip")} →
        </Button>
        <Button
          onClick={proceed}
          className="rounded-xl bg-blue-600 px-6 text-white hover:bg-blue-700"
        >
          {t("nextStep")} →
        </Button>
      </div>
    </div>
  );
}
