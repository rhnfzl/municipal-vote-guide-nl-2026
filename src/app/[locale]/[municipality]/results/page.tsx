"use client";

import { useTranslations, useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { calculateMatches, generateMatchSummary } from "@/lib/scoring";
import { ShareResults } from "@/components/share-results";
import { PartyAvatar } from "@/components/party-avatar";
import { MdCheckCircle, MdCancel, MdExpandMore, MdInfo } from "@/components/icons";
import type { MunicipalityData, UserAnswer, PartyMatch } from "@/lib/types";

export default function ResultsPage() {
  const t = useTranslations("results");
  const tf = useTranslations("flow");
  const tq = useTranslations("questionnaire");
  const locale = useLocale();
  const params = useParams();
  const router = useRouter();
  const slug = params.municipality as string;

  const [data, setData] = useState<MunicipalityData | null>(null);
  const [matches, setMatches] = useState<PartyMatch[]>([]);
  const [answers, setAnswers] = useState<Record<number, UserAnswer>>({});
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    const savedAnswers =
      sessionStorage.getItem(`vg-${slug}-answers`) ||
      localStorage.getItem(`vg-${slug}-answers`);
    const savedPriorities = sessionStorage.getItem(`vg-${slug}-priorities`);
    const savedPartyIds = sessionStorage.getItem(`vg-${slug}-selectedParties`);

    if (!savedAnswers) {
      router.push(`/${locale}/${slug}/questionnaire`);
      return;
    }

    const parsedAnswers = JSON.parse(savedAnswers);
    const priorities: number[] = savedPriorities ? JSON.parse(savedPriorities) : [];
    const selectedPartyIds: number[] | null = savedPartyIds ? JSON.parse(savedPartyIds) : null;

    setAnswers(parsedAnswers);

    fetch(`/data/municipalities/${slug}/${locale === "en" ? "en" : "nl"}.json`)
      .then((r) => (r.ok ? r : fetch(`/data/municipalities/${slug}/nl.json`)))
      .then((r) => r.json())
      .then((d: MunicipalityData) => {
        setData(d);
        setMatches(calculateMatches(d, parsedAnswers, priorities, selectedPartyIds));
      });
  }, [slug, locale, router]);

  if (!data || matches.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-6" aria-live="polite">
        <Skeleton className="h-8 w-64 mx-auto" />
        <Skeleton className="h-4 w-48 mx-auto" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  // Tie-breaker detection: top 2 parties within 5%
  const showTieBreaker =
    matches.length >= 2 &&
    matches[0].matchPercentage - matches[1].matchPercentage <= 5 &&
    data.shootoutStatements &&
    data.shootoutStatements.length > 0;

  const matchColor = (pct: number) =>
    pct >= 70 ? "text-green-600 dark:text-green-400" :
    pct >= 40 ? "text-amber-600 dark:text-amber-400" :
    "text-red-600 dark:text-red-400";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {tf("resultTitle")}
        </h1>
        <p className="text-gray-500">
          {tf("resultSubtitle")}
        </p>
      </div>

      {/* Share — prominent at top */}
      <div className="flex justify-center">
        <ShareResults matches={matches} municipality={data.name} locale={locale} />
      </div>

      {/* Tie-breaker banner */}
      {showTieBreaker && (
        <Card className="border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30">
          <CardContent className="p-5 text-center space-y-3">
            <p className="font-semibold text-blue-800 dark:text-blue-200">
              {tf("tieBreaker")}
            </p>
            <p className="text-sm text-blue-600 dark:text-blue-300">
              {tf("tieBreakerDesc")}
            </p>
            <Button
              onClick={() => router.push(`/${locale}/${slug}/shootout?party1=${matches[0].partyId}&party2=${matches[1].partyId}`)}
              className="rounded-xl bg-blue-600 text-white hover:bg-blue-700"
            >
              {tf("startExtraQuestions")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Ranked Results List — clean, StemWijzer-style */}
      <div className="space-y-3">
        {matches.map((match, idx) => {
          const isTop = idx === 0;
          const isExpanded = expanded === match.partyId;
          const summary = isExpanded
            ? generateMatchSummary(data, answers, match.partyId, locale)
            : null;

          return (
            <Card
              key={match.partyId}
              className={`overflow-hidden rounded-xl transition-all duration-200 cursor-pointer ${
                isTop
                  ? "ring-2 ring-amber-400 shadow-lg bg-gradient-to-r from-amber-50/50 to-white dark:from-amber-950/20 dark:to-gray-900"
                  : "hover:shadow-md"
              }`}
              onClick={() => router.push(`/${locale}/${slug}/compare-party?party=${match.partyId}`)}
            >
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <PartyAvatar name={match.partyName} size="lg" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{match.partyName}</h3>
                      {isTop && (
                        <Badge className="bg-amber-100 text-amber-800 text-xs dark:bg-amber-900 dark:text-amber-200">
                          {t("topMatch")}
                        </Badge>
                      )}
                    </div>
                    {/* Progress bar */}
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${
                          match.matchPercentage >= 70 ? "bg-green-500" :
                          match.matchPercentage >= 40 ? "bg-amber-500" : "bg-red-500"
                        }`}
                        style={{ width: `${match.matchPercentage}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-500">
                      <span className="text-green-600 flex items-center gap-0.5">
                        <MdCheckCircle className="h-3 w-3" /> {match.agreeCount} {t("agreed")}
                      </span>
                      <span className="text-red-600 flex items-center gap-0.5">
                        <MdCancel className="h-3 w-3" /> {match.disagreeCount} {t("disagreed")}
                      </span>
                    </div>
                  </div>
                  <span className={`text-2xl font-black shrink-0 sm:text-3xl ${matchColor(match.matchPercentage)}`}>
                    {match.matchPercentage}%
                  </span>
                </div>
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
            localStorage.removeItem(`vg-${slug}-index`);
            sessionStorage.removeItem(`vg-${slug}-answers`);
            sessionStorage.removeItem(`vg-${slug}-priorities`);
            sessionStorage.removeItem(`vg-${slug}-selectedParties`);
            sessionStorage.removeItem(`vg-${slug}-startTime`);
            router.push(`/${locale}/${slug}/questionnaire`);
          }}
        >
          {t("startOver")}
        </Button>
      </div>
    </div>
  );
}
