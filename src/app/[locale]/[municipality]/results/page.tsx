"use client";

import { useTranslations, useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { calculateMatches, generateMatchSummary } from "@/lib/scoring";
import { ShareResults } from "@/components/share-results";
import { IssueTuning } from "@/components/issue-tuning";
import { PoliticalCompass } from "@/components/political-compass";
import type {
  MunicipalityData,
  UserAnswer,
  PartyMatch,
  DealBreakerMode,
  ThemeWeight,
} from "@/lib/types";

export default function ResultsPage() {
  const t = useTranslations("results");
  const tq = useTranslations("questionnaire");
  const locale = useLocale();
  const params = useParams();
  const router = useRouter();
  const slug = params.municipality as string;

  const [data, setData] = useState<MunicipalityData | null>(null);
  const [matches, setMatches] = useState<PartyMatch[]>([]);
  const [mode, setMode] = useState<DealBreakerMode>("weighted");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, UserAnswer>>({});
  const [dealbreakers, setDealbreakers] = useState<Set<number>>(new Set());
  const [themeWeights, setThemeWeights] = useState<ThemeWeight[]>([]);

  useEffect(() => {
    const savedAnswers =
      sessionStorage.getItem(`vg-${slug}-answers`) ||
      localStorage.getItem(`vg-${slug}-answers`);
    const savedDb =
      sessionStorage.getItem(`vg-${slug}-dealbreakers`) ||
      localStorage.getItem(`vg-${slug}-dealbreakers`);

    if (!savedAnswers) {
      router.push(`/${locale}/${slug}/questionnaire`);
      return;
    }

    const parsedAnswers = JSON.parse(savedAnswers);
    const parsedDb = savedDb ? new Set<number>(JSON.parse(savedDb)) : new Set<number>();

    setAnswers(parsedAnswers);
    setDealbreakers(parsedDb);

    fetch(`/data/municipalities/${slug}/${locale === "en" ? "en" : "nl"}.json`)
      .then((r) => (r.ok ? r : fetch(`/data/municipalities/${slug}/nl.json`)))
      .then((r) => r.json())
      .then((d: MunicipalityData) => {
        setData(d);
        setMatches(calculateMatches(d, parsedAnswers, parsedDb, "weighted", []));
      });
  }, [slug, locale, router]);

  useEffect(() => {
    if (!data) return;
    setMatches(calculateMatches(data, answers, dealbreakers, mode, themeWeights));
  }, [mode, data, answers, dealbreakers, themeWeights]);

  if (!data || matches.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-6" aria-live="polite">
        <Skeleton className="h-8 w-64 mx-auto" />
        <Skeleton className="h-4 w-48 mx-auto" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  const matchColor = (pct: number) =>
    pct >= 70 ? "text-green-600 dark:text-green-400" :
    pct >= 40 ? "text-amber-600 dark:text-amber-400" :
    "text-red-600 dark:text-red-400";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="text-gray-500">{t("subtitle", { municipality: data.name })}</p>
      </div>

      {/* Share — prominent at top */}
      <div className="flex justify-center">
        <ShareResults matches={matches} municipality={data.name} locale={locale} />
      </div>

      {/* Dealbreaker Mode */}
      {dealbreakers.size > 0 && (
        <div className="flex items-center justify-center gap-3 rounded-xl bg-gray-100 p-3 dark:bg-gray-900">
          <span className="text-sm font-medium">{t("dealBreakerMode")}:</span>
          <div className="flex rounded-lg bg-white p-1 shadow-sm dark:bg-gray-800">
            <button
              onClick={() => setMode("weighted")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === "weighted" ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100 dark:text-gray-400"
              }`}
            >
              {t("weighted")}
            </button>
            <button
              onClick={() => setMode("strict")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === "strict" ? "bg-red-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100 dark:text-gray-400"
              }`}
            >
              {t("strict")}
            </button>
          </div>
        </div>
      )}

      {/* Political Compass — visible by default */}
      <Card className="overflow-hidden rounded-2xl border-0 shadow-md">
        <CardContent className="p-5">
          <PoliticalCompass data={data} answers={answers} locale={locale} />
        </CardContent>
      </Card>

      {/* Issue Tuning */}
      <IssueTuning
        statements={data.statements}
        weights={themeWeights}
        onWeightsChange={setThemeWeights}
        locale={locale}
      />

      {/* Results List */}
      <div className="space-y-3">
        {matches.map((match, idx) => {
          const isExpanded = expanded === match.partyId;
          const party = data.parties.find((p) => p.id === match.partyId);
          const isTop = idx === 0 && !match.isEliminated;
          const summary = isExpanded
            ? generateMatchSummary(data, answers, match.partyId, locale)
            : null;

          return (
            <Card
              key={match.partyId}
              className={`overflow-hidden rounded-xl transition-all duration-200 ${
                match.isEliminated
                  ? "opacity-50 border-red-300 dark:border-red-800"
                  : isTop
                    ? "ring-2 ring-amber-400 shadow-lg bg-gradient-to-r from-amber-50/50 to-white dark:from-amber-950/20 dark:to-gray-900"
                    : "hover:shadow-md"
              }`}
            >
              <CardContent className="p-4 sm:p-5">
                <div
                  className="cursor-pointer"
                  onClick={() => setExpanded(isExpanded ? null : match.partyId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setExpanded(isExpanded ? null : match.partyId);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  aria-label={`${match.partyName}: ${match.matchPercentage}% match. ${t("expandDetails")}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-500 dark:bg-gray-800">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{match.partyName}</h3>
                        {isTop && (
                          <Badge className="bg-amber-100 text-amber-800 text-xs dark:bg-amber-900 dark:text-amber-200">
                            {t("topMatch")}
                          </Badge>
                        )}
                      </div>
                      {match.isEliminated && (
                        <Badge variant="destructive" className="text-xs mt-1">{t("eliminated")}</Badge>
                      )}
                      {match.dealbreakersViolated.length > 0 && !match.isEliminated && (
                        <span className="text-xs text-red-500">
                          {t("dealbreakersViolated", { count: match.dealbreakersViolated.length })}
                        </span>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-3xl font-black ${matchColor(match.matchPercentage)}`}>
                        {match.matchPercentage}%
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${
                        match.matchPercentage >= 70
                          ? "bg-green-500"
                          : match.matchPercentage >= 40
                            ? "bg-amber-500"
                            : "bg-red-500"
                      }`}
                      style={{ width: `${match.matchPercentage}%` }}
                    />
                  </div>

                  <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                    <span className="text-green-600">✓ {match.agreeCount} {t("agreed")}</span>
                    <span className="text-red-600">✗ {match.disagreeCount} {t("disagreed")}</span>
                    <span className="ml-auto text-xs">
                      {isExpanded ? "▾" : "▸"} {t("whyMatch")}
                    </span>
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && party && (
                  <div className="mt-4 space-y-3">
                    <Separator />

                    {/* Theme summary */}
                    {summary && summary.agreeThemes.length > 0 && (
                      <div className="rounded-lg bg-green-50 p-3 text-sm dark:bg-green-950/20">
                        <p className="text-green-800 dark:text-green-300">
                          {t("agreeOn", { themes: summary.agreeThemes.join(", ") })}
                        </p>
                      </div>
                    )}
                    {summary && summary.disagreeThemes.length > 0 && (
                      <div className="rounded-lg bg-red-50 p-3 text-sm dark:bg-red-950/20">
                        <p className="text-red-800 dark:text-red-300">
                          {t("differOn", { themes: summary.disagreeThemes.join(", ") })}
                        </p>
                      </div>
                    )}

                    {/* Per-question breakdown */}
                    <div className="space-y-2">
                      {data.statements.map((stmt) => {
                        const userAnswer = answers[stmt.id];
                        if (!userAnswer || userAnswer === "skip") return null;
                        const partyPos = party.positions[stmt.id];
                        if (!partyPos) return null;

                        const isMatch =
                          userAnswer === partyPos.position ||
                          userAnswer === "neither" ||
                          partyPos.position === "neither";
                        const isDealbreakerQ = dealbreakers.has(stmt.id);
                        const stmtTitle = locale === "en" && stmt.titleEn ? stmt.titleEn : stmt.title;

                        return (
                          <div
                            key={stmt.id}
                            className={`rounded-lg p-3 text-sm ${
                              isMatch
                                ? "bg-green-50 dark:bg-green-950/20"
                                : "bg-red-50 dark:bg-red-950/20"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-medium leading-snug flex-1">
                                {isDealbreakerQ && <span className="text-red-500 mr-1">⚑</span>}
                                {stmtTitle}
                              </p>
                              <div className="flex gap-1.5 shrink-0 text-xs">
                                <Badge
                                  className={
                                    userAnswer === "agree"
                                      ? "bg-green-600 text-white"
                                      : userAnswer === "disagree"
                                        ? "bg-red-600 text-white"
                                        : "bg-gray-200 text-gray-700"
                                  }
                                >
                                  {userAnswer === "agree" ? tq("agree") : userAnswer === "disagree" ? tq("disagree") : tq("neither")}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className={
                                    partyPos.position === "agree"
                                      ? "border-green-500 text-green-700"
                                      : partyPos.position === "disagree"
                                        ? "border-red-500 text-red-700"
                                        : ""
                                  }
                                >
                                  {partyPos.position === "agree" ? tq("agree") : partyPos.position === "disagree" ? tq("disagree") : tq("neither")}
                                </Badge>
                              </div>
                            </div>
                            {partyPos.explanation && (
                              <p className="mt-1.5 text-xs text-gray-500 italic leading-relaxed">
                                {locale === "en" && partyPos.explanationEn ? partyPos.explanationEn : partyPos.explanation}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 justify-center pt-4">
        <Button
          variant="outline"
          className="rounded-xl"
          onClick={() => router.push(`/${locale}/${slug}/compare`)}
        >
          {t("compareParties")}
        </Button>
        <Button
          variant="outline"
          className="rounded-xl"
          onClick={() => {
            localStorage.removeItem(`vg-${slug}-answers`);
            localStorage.removeItem(`vg-${slug}-dealbreakers`);
            localStorage.removeItem(`vg-${slug}-index`);
            router.push(`/${locale}/${slug}/questionnaire`);
          }}
        >
          {t("startOver")}
        </Button>
      </div>
    </div>
  );
}
