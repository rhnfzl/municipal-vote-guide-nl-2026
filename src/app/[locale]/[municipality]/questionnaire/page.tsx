"use client";

import { useTranslations, useLocale } from "next-intl";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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

  useEffect(() => {
    const saved = localStorage.getItem(`vg-${slug}-answers`);
    const savedDb = localStorage.getItem(`vg-${slug}-dealbreakers`);
    const savedIdx = localStorage.getItem(`vg-${slug}-index`);

    fetch(`/data/municipalities/${slug}/${locale === "en" ? "en" : "nl"}.json`)
      .then((r) => {
        if (!r.ok) return fetch(`/data/municipalities/${slug}/nl.json`);
        return r;
      })
      .then((r) => r.json())
      .then((d: MunicipalityData) => {
        setData(d);
        if (saved) setAnswers(JSON.parse(saved));
        if (savedDb) setDealbreakers(new Set(JSON.parse(savedDb)));
        if (savedIdx) setCurrentIdx(parseInt(savedIdx));
        setLoading(false);
      });
  }, [slug, locale]);

  // Auto-save
  useEffect(() => {
    if (!data) return;
    localStorage.setItem(`vg-${slug}-answers`, JSON.stringify(answers));
    localStorage.setItem(
      `vg-${slug}-dealbreakers`,
      JSON.stringify([...dealbreakers])
    );
    localStorage.setItem(`vg-${slug}-index`, String(currentIdx));
  }, [answers, dealbreakers, currentIdx, slug, data]);

  const statements = data?.statements || [];
  const current: Statement | undefined = statements[currentIdx];
  const answeredCount = Object.keys(answers).length;
  const progress = statements.length
    ? (answeredCount / statements.length) * 100
    : 0;

  const answer = useCallback(
    (value: UserAnswer) => {
      if (!current) return;
      setAnswers((prev) => ({ ...prev, [current.id]: value }));
      setShowInfo(false);
      if (currentIdx < statements.length - 1) {
        setCurrentIdx((i) => i + 1);
      }
    },
    [current, currentIdx, statements.length]
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
    // Store answers in sessionStorage for the results page
    sessionStorage.setItem(`vg-${slug}-answers`, JSON.stringify(answers));
    sessionStorage.setItem(
      `vg-${slug}-dealbreakers`,
      JSON.stringify([...dealbreakers])
    );
    router.push(`/${locale}/${slug}/results`);
  }, [answers, dealbreakers, slug, locale, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">{t("title")}...</p>
      </div>
    );
  }

  if (!data || !current) return null;

  const isDealbreaker = dealbreakers.has(current.id);
  const title =
    locale === "en" && current.titleEn ? current.titleEn : current.title;
  const theme =
    locale === "en" && current.themeEn ? current.themeEn : current.theme;
  const moreInfo =
    locale === "en" && current.moreInfoEn
      ? current.moreInfoEn
      : current.moreInfo;
  const pro = locale === "en" && current.proEn ? current.proEn : current.pro;
  const con = locale === "en" && current.conEn ? current.conEn : current.con;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{data.name}</span>
          <span>
            {t("questionOf", {
              current: currentIdx + 1,
              total: statements.length,
            })}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
        <p className="text-xs text-gray-400">
          {t("progress", {
            answered: answeredCount,
            total: statements.length,
          })}
        </p>
      </div>

      {/* Question Card */}
      <Card className="overflow-hidden">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <Badge variant="outline" className="shrink-0">
              {theme}
            </Badge>
            <button
              onClick={toggleDealbreaker}
              className={`shrink-0 text-2xl transition-transform hover:scale-110 ${
                isDealbreaker ? "text-red-500" : "text-gray-300"
              }`}
              title={t("dealBreakerTooltip")}
            >
              {isDealbreaker ? "⚑" : "⚐"}
            </button>
          </div>

          <h2 className="text-xl font-semibold leading-snug sm:text-2xl">
            {title}
          </h2>

          {isDealbreaker && (
            <Badge variant="destructive" className="text-xs">
              ⚑ {t("dealbreaker")}
            </Badge>
          )}

          {/* More Info Toggle */}
          {(moreInfo || pro || con) && (
            <div>
              <button
                onClick={() => setShowInfo(!showInfo)}
                className="text-sm text-blue-600 hover:underline dark:text-blue-400"
              >
                {showInfo ? "▾" : "▸"} {t("moreInfo")}
              </button>
              {showInfo && (
                <div className="mt-3 space-y-3 rounded-lg bg-gray-50 p-4 text-sm dark:bg-gray-900">
                  {moreInfo && <p className="text-gray-600 dark:text-gray-400">{moreInfo}</p>}
                  {pro && (
                    <div>
                      <p className="font-medium text-green-700 dark:text-green-400">
                        ✓ {t("proArguments")}
                      </p>
                      <p className="text-gray-600 dark:text-gray-400">{pro}</p>
                    </div>
                  )}
                  {con && (
                    <div>
                      <p className="font-medium text-red-700 dark:text-red-400">
                        ✗ {t("conArguments")}
                      </p>
                      <p className="text-gray-600 dark:text-gray-400">{con}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Answer Buttons */}
      <div className="grid grid-cols-3 gap-3">
        <Button
          onClick={() => answer("agree")}
          className="h-14 text-base bg-green-600 hover:bg-green-700 text-white"
          size="lg"
        >
          {t("agree")}
        </Button>
        <Button
          onClick={() => answer("neither")}
          variant="outline"
          className="h-14 text-base"
          size="lg"
        >
          {t("neither")}
        </Button>
        <Button
          onClick={() => answer("disagree")}
          className="h-14 text-base bg-red-600 hover:bg-red-700 text-white"
          size="lg"
        >
          {t("disagree")}
        </Button>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => {
            setShowInfo(false);
            setCurrentIdx((i) => Math.max(0, i - 1));
          }}
          disabled={currentIdx === 0}
        >
          ← {t("skip")}
        </Button>

        <Button
          variant="ghost"
          onClick={() => answer("skip")}
          className="text-gray-400"
        >
          {t("skip")} →
        </Button>
      </div>

      {/* View Results */}
      {answeredCount >= 5 && (
        <div className="text-center pt-4">
          <Button onClick={goToResults} size="lg" className="px-8">
            {t("viewResults")} →
          </Button>
        </div>
      )}
    </div>
  );
}
