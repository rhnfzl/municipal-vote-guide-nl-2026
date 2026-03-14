"use client";

import { useTranslations, useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { calculateMatches } from "@/lib/scoring";
import type {
  MunicipalityData,
  UserAnswer,
  PartyMatch,
  DealBreakerMode,
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
      .then((r) => {
        if (!r.ok) return fetch(`/data/municipalities/${slug}/nl.json`);
        return r;
      })
      .then((r) => r.json())
      .then((d: MunicipalityData) => {
        setData(d);
        const results = calculateMatches(d, parsedAnswers, parsedDb, "weighted", []);
        setMatches(results);
      });
  }, [slug, locale, router]);

  // Recalculate when mode changes
  useEffect(() => {
    if (!data) return;
    const results = calculateMatches(data, answers, dealbreakers, mode, []);
    setMatches(results);
  }, [mode, data, answers, dealbreakers]);

  if (!data || matches.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">Loading results...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold sm:text-3xl">{t("title")}</h1>
        <p className="text-gray-500">
          {t("subtitle", { municipality: data.name })}
        </p>
      </div>

      {/* Dealbreaker Mode Toggle */}
      {dealbreakers.size > 0 && (
        <div className="flex items-center justify-center gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
          <span className="text-sm font-medium">{t("dealBreakerMode")}:</span>
          <div className="flex gap-1 rounded-md bg-white p-1 shadow-sm dark:bg-gray-800">
            <button
              onClick={() => setMode("weighted")}
              className={`rounded px-3 py-1.5 text-sm transition-colors ${
                mode === "weighted"
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-400"
              }`}
            >
              {t("weighted")}
            </button>
            <button
              onClick={() => setMode("strict")}
              className={`rounded px-3 py-1.5 text-sm transition-colors ${
                mode === "strict"
                  ? "bg-red-600 text-white"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-400"
              }`}
            >
              {t("strict")}
            </button>
          </div>
        </div>
      )}

      {/* Results List */}
      <div className="space-y-3">
        {matches.map((match, idx) => {
          const isExpanded = expanded === match.partyId;
          const party = data.parties.find((p) => p.id === match.partyId);

          return (
            <Card
              key={match.partyId}
              className={`transition-shadow ${
                match.isEliminated
                  ? "opacity-50 border-red-300 dark:border-red-800"
                  : idx === 0
                    ? "ring-2 ring-blue-500 shadow-lg"
                    : "hover:shadow-md"
              }`}
            >
              <CardContent className="p-4 space-y-3">
                <div
                  className="cursor-pointer"
                  onClick={() =>
                    setExpanded(isExpanded ? null : match.partyId)
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-gray-400 w-8">
                        #{idx + 1}
                      </span>
                      <div>
                        <h3 className="font-semibold">{match.partyName}</h3>
                        {match.isEliminated && (
                          <Badge variant="destructive" className="text-xs mt-1">
                            {t("eliminated")}
                          </Badge>
                        )}
                        {match.dealbreakersViolated.length > 0 &&
                          !match.isEliminated && (
                            <span className="text-xs text-red-500">
                              {t("dealbreakersViolated", {
                                count: match.dealbreakersViolated.length,
                              })}
                            </span>
                          )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold">
                        {match.matchPercentage}%
                      </span>
                    </div>
                  </div>

                  <div className="mt-2">
                    <Progress
                      value={match.matchPercentage}
                      className="h-3"
                    />
                  </div>

                  <div className="mt-2 flex gap-4 text-sm text-gray-500">
                    <span className="text-green-600">
                      ✓ {match.agreeCount} {t("agreed")}
                    </span>
                    <span className="text-red-600">
                      ✗ {match.disagreeCount} {t("disagreed")}
                    </span>
                    <span className="ml-auto text-xs text-gray-400">
                      {isExpanded ? "▾" : "▸"} {t("whyMatch")}
                    </span>
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && party && (
                  <div className="pt-3 space-y-2">
                    <Separator />
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

                      const stmtTitle =
                        locale === "en" && stmt.titleEn
                          ? stmt.titleEn
                          : stmt.title;

                      return (
                        <div
                          key={stmt.id}
                          className={`rounded-md p-3 text-sm ${
                            isMatch
                              ? "bg-green-50 dark:bg-green-950/30"
                              : "bg-red-50 dark:bg-red-950/30"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium leading-snug flex-1">
                              {isDealbreakerQ && (
                                <span className="text-red-500 mr-1">⚑</span>
                              )}
                              {stmtTitle}
                            </p>
                            <div className="flex gap-2 shrink-0 text-xs">
                              <Badge
                                variant={
                                  userAnswer === "agree"
                                    ? "default"
                                    : "outline"
                                }
                                className={
                                  userAnswer === "agree"
                                    ? "bg-green-600"
                                    : userAnswer === "disagree"
                                      ? "bg-red-600 text-white"
                                      : ""
                                }
                              >
                                You: {userAnswer === "agree" ? tq("agree") : userAnswer === "disagree" ? tq("disagree") : tq("neither")}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={
                                  partyPos.position === "agree"
                                    ? "border-green-600 text-green-700"
                                    : partyPos.position === "disagree"
                                      ? "border-red-600 text-red-700"
                                      : ""
                                }
                              >
                                {partyPos.position === "agree" ? tq("agree") : partyPos.position === "disagree" ? tq("disagree") : tq("neither")}
                              </Badge>
                            </div>
                          </div>
                          {partyPos.explanation && (
                            <p className="mt-1 text-xs text-gray-500 italic">
                              {locale === "en" && partyPos.explanationEn
                                ? partyPos.explanationEn
                                : partyPos.explanation}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-center pt-4">
        <Button
          variant="outline"
          onClick={() => {
            localStorage.removeItem(`vg-${slug}-answers`);
            localStorage.removeItem(`vg-${slug}-dealbreakers`);
            localStorage.removeItem(`vg-${slug}-index`);
            router.push(`/${locale}/${slug}/questionnaire`);
          }}
        >
          {t("startOver")}
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push(`/${locale}`)}
        >
          ← {t("startOver")}
        </Button>
      </div>
    </div>
  );
}
