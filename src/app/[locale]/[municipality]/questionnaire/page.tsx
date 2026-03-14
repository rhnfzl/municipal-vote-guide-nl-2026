"use client";

import { useTranslations, useLocale } from "next-intl";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import type { MunicipalityData, UserAnswer, Statement } from "@/lib/types";

export default function QuestionnairePage() {
  const t = useTranslations("questionnaire");
  const locale = useLocale();
  const params = useParams();
  const router = useRouter();
  const slug = params.municipality as string;

  const [data, setData] = useState<MunicipalityData | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, UserAnswer>>({});
  const [dealbreakers, setDealbreakers] = useState<Set<number>>(new Set());
  const [showInfo, setShowInfo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(`vg-${slug}-answers`);
    const savedDb = localStorage.getItem(`vg-${slug}-dealbreakers`);
    const savedIdx = localStorage.getItem(`vg-${slug}-index`);

    fetch(`/data/municipalities/${slug}/${locale === "en" ? "en" : "nl"}.json`)
      .then((r) => (r.ok ? r : fetch(`/data/municipalities/${slug}/nl.json`)))
      .then((r) => r.json())
      .then((d: MunicipalityData) => {
        setData(d);
        if (saved) setAnswers(JSON.parse(saved));
        if (savedDb) setDealbreakers(new Set(JSON.parse(savedDb)));
        if (savedIdx) setCurrentIdx(parseInt(savedIdx));
        setLoading(false);
      });
  }, [slug, locale]);

  useEffect(() => {
    if (!data) return;
    localStorage.setItem(`vg-${slug}-answers`, JSON.stringify(answers));
    localStorage.setItem(`vg-${slug}-dealbreakers`, JSON.stringify([...dealbreakers]));
    localStorage.setItem(`vg-${slug}-index`, String(currentIdx));
  }, [answers, dealbreakers, currentIdx, slug, data]);

  const statements = data?.statements || [];
  const current: Statement | undefined = statements[currentIdx];
  const answeredCount = Object.keys(answers).length;
  const progress = statements.length ? Math.round((answeredCount / statements.length) * 100) : 0;

  const goNext = useCallback(() => {
    setAnimating(true);
    setShowInfo(false);
    setTimeout(() => {
      if (currentIdx < statements.length - 1) setCurrentIdx((i) => i + 1);
      setAnimating(false);
    }, 150);
  }, [currentIdx, statements.length]);

  const answer = useCallback(
    (value: UserAnswer) => {
      if (!current) return;
      setAnswers((prev) => ({ ...prev, [current.id]: value }));
      goNext();
    },
    [current, goNext]
  );

  const toggleDealbreaker = useCallback(() => {
    if (!current) return;
    setDealbreakers((prev) => {
      const next = new Set(prev);
      if (next.has(current.id)) next.delete(current.id);
      else next.add(current.id);
      return next;
    });
  }, [current]);

  const goToResults = useCallback(() => {
    sessionStorage.setItem(`vg-${slug}-answers`, JSON.stringify(answers));
    sessionStorage.setItem(`vg-${slug}-dealbreakers`, JSON.stringify([...dealbreakers]));
    router.push(`/${locale}/${slug}/results`);
  }, [answers, dealbreakers, slug, locale, router]);

  if (loading) {
    return (
      <div className="mx-auto max-w-xl space-y-6" aria-live="polite">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-64 rounded-2xl" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data || !current) return null;

  const isDealbreaker = dealbreakers.has(current.id);
  const title = locale === "en" && current.titleEn ? current.titleEn : current.title;
  const theme = locale === "en" && current.themeEn ? current.themeEn : current.theme;
  const moreInfo = locale === "en" && current.moreInfoEn ? current.moreInfoEn : current.moreInfo;
  const pro = locale === "en" && current.proEn ? current.proEn : current.pro;
  const con = locale === "en" && current.conEn ? current.conEn : current.con;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-900 dark:text-gray-100">{data.name}</span>
          <span className="text-gray-500">
            {t("questionOf", { current: currentIdx + 1, total: statements.length })}
          </span>
        </div>

        {/* Progress bar */}
        <div className="relative h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-blue-600 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-400">
          {t("progress", { answered: answeredCount, total: statements.length })}
        </p>
      </div>

      {/* Question Card */}
      <Card
        className={`overflow-hidden rounded-2xl border-0 bg-white shadow-lg transition-all duration-200 dark:bg-gray-900 ${
          animating ? "scale-[0.98] opacity-80" : "scale-100 opacity-100"
        }`}
      >
        <CardContent className="space-y-5 p-6 sm:p-8">
          {/* Theme + Dealbreaker */}
          <div className="flex items-center justify-between gap-4">
            <Badge variant="secondary" className="text-xs font-medium">
              {theme}
            </Badge>
            <label className="flex items-center gap-2 cursor-pointer" aria-label={t("markDealbreaker")}>
              <span className="text-xs text-gray-500">{t("dealbreaker")}</span>
              <Switch
                checked={isDealbreaker}
                onCheckedChange={toggleDealbreaker}
                aria-label={t("markDealbreaker")}
              />
            </label>
          </div>

          {/* Statement */}
          <h2 className="text-lg font-semibold leading-relaxed text-gray-900 dark:text-gray-100 sm:text-xl">
            {title}
          </h2>

          {isDealbreaker && (
            <Badge variant="destructive" className="text-xs">
              ⚑ {t("dealbreaker")}
            </Badge>
          )}

          {/* More Info */}
          {(moreInfo || pro || con) && (
            <div>
              <button
                onClick={() => setShowInfo(!showInfo)}
                className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors dark:text-blue-400"
                aria-expanded={showInfo}
              >
                <svg className={`h-4 w-4 transition-transform ${showInfo ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                {t("moreInfo")}
              </button>

              {showInfo && (
                <div className="mt-3 space-y-3 rounded-xl bg-gray-50 p-4 text-sm dark:bg-gray-800/50">
                  {moreInfo && (
                    <p className="text-gray-600 dark:text-gray-400">{moreInfo}</p>
                  )}
                  {pro && (
                    <div className="rounded-lg bg-green-50 p-3 dark:bg-green-950/30">
                      <p className="mb-1 text-xs font-semibold text-green-700 dark:text-green-400">
                        ✓ {t("proArguments")}
                      </p>
                      <p className="text-green-800 dark:text-green-300">{pro}</p>
                    </div>
                  )}
                  {con && (
                    <div className="rounded-lg bg-red-50 p-3 dark:bg-red-950/30">
                      <p className="mb-1 text-xs font-semibold text-red-700 dark:text-red-400">
                        ✗ {t("conArguments")}
                      </p>
                      <p className="text-red-800 dark:text-red-300">{con}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Answer Buttons — stack on mobile */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Button
          onClick={() => answer("agree")}
          className="h-14 text-base font-semibold rounded-xl bg-green-600 text-white shadow-sm transition-all hover:bg-green-700 hover:shadow-md active:scale-[0.98] sm:h-14"
          size="lg"
        >
          ✓ {t("agree")}
        </Button>
        <Button
          onClick={() => answer("neither")}
          variant="outline"
          className="h-14 text-base font-semibold rounded-xl shadow-sm transition-all hover:shadow-md active:scale-[0.98] sm:h-14"
          size="lg"
        >
          {t("neither")}
        </Button>
        <Button
          onClick={() => answer("disagree")}
          className="h-14 text-base font-semibold rounded-xl bg-red-600 text-white shadow-sm transition-all hover:bg-red-700 hover:shadow-md active:scale-[0.98] sm:h-14"
          size="lg"
        >
          ✗ {t("disagree")}
        </Button>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => {
            setShowInfo(false);
            setAnimating(true);
            setTimeout(() => {
              setCurrentIdx((i) => Math.max(0, i - 1));
              setAnimating(false);
            }, 150);
          }}
          disabled={currentIdx === 0}
          className="text-gray-500"
          aria-label={t("previous")}
        >
          ← {t("previous")}
        </Button>

        <Button
          variant="ghost"
          onClick={() => answer("skip")}
          className="text-gray-400"
          aria-label={t("skip")}
        >
          {t("skip")} →
        </Button>
      </div>

      {/* View Results */}
      {answeredCount >= 5 && (
        <div className="pt-2 text-center">
          <Button
            onClick={goToResults}
            size="lg"
            className="h-14 w-full rounded-xl bg-blue-600 px-8 text-base font-semibold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg active:scale-[0.98] sm:w-auto"
          >
            {t("viewResults")} →
          </Button>
        </div>
      )}
    </div>
  );
}
