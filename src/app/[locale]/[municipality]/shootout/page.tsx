"use client";

import { useTranslations, useLocale } from "next-intl";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PartyAvatar } from "@/components/party-avatar";
import { MdThumbUp, MdThumbDown, MdRemove, MdArrowBack } from "@/components/icons";
import type { MunicipalityData, UserAnswer, Statement } from "@/lib/types";

export default function ShootoutPage() {
  const t = useTranslations("flow");
  const tq = useTranslations("questionnaire");
  const locale = useLocale();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.municipality as string;

  const party1Id = parseInt(searchParams.get("party1") || "0");
  const party2Id = parseInt(searchParams.get("party2") || "0");

  const [data, setData] = useState<MunicipalityData | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [shootoutAnswers, setShootoutAnswers] = useState<Record<number, UserAnswer>>({});
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    fetch(`/data/municipalities/${slug}/${locale === "en" ? "en" : "nl"}.json`)
      .then((r) => (r.ok ? r : fetch(`/data/municipalities/${slug}/nl.json`)))
      .then((r) => r.json())
      .then(setData);
  }, [slug, locale]);

  if (!data || !data.shootoutStatements?.length) {
    return (
      <div className="mx-auto max-w-2xl space-y-6" aria-live="polite">
        <Skeleton className="h-10 w-80 mx-auto" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const party1 = data.parties.find((p) => p.id === party1Id);
  const party2 = data.parties.find((p) => p.id === party2Id);

  // Filter shootout questions: only show where the two parties DISAGREE
  const allShootout = data.shootoutStatements || [];
  const disagreementStmts = allShootout.filter((stmt) => {
    const pos1 = party1?.positions[stmt.id];
    const pos2 = party2?.positions[stmt.id];
    if (!pos1 || !pos2) return true; // Include if we can't determine
    return pos1.position !== pos2.position; // Only where they differ
  });

  // Use disagreement questions, cap at 5 (odd number for clear winner)
  const maxQuestions = 5;
  const filtered = disagreementStmts.length > 0 ? disagreementStmts : allShootout; // Fallback to all if none disagree
  const shootoutStmts = filtered.slice(0, maxQuestions % 2 === 0 ? maxQuestions - 1 : maxQuestions);
  const current = shootoutStmts[currentIdx];

  const allAgree = disagreementStmts.length === 0;

  if (!party1 || !party2) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p>Invalid party selection</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push(`/${locale}/${slug}/results`)}>
          {t("backToResults")}
        </Button>
      </div>
    );
  }

  // Calculate shootout scores
  const party1Score = Object.entries(shootoutAnswers).filter(([stmtId, answer]) => {
    const pos = party1.positions[parseInt(stmtId)];
    return pos && answer === pos.position;
  }).length;

  const party2Score = Object.entries(shootoutAnswers).filter(([stmtId, answer]) => {
    const pos = party2.positions[parseInt(stmtId)];
    return pos && answer === pos.position;
  }).length;

  function answer(value: UserAnswer) {
    if (!current) return;
    setShootoutAnswers((prev) => ({ ...prev, [current.id]: value }));
    if (currentIdx < shootoutStmts.length - 1) {
      setCurrentIdx((i) => i + 1);
    } else {
      setCompleted(true);
    }
  }

  if (completed) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Button
          variant="ghost"
          onClick={() => router.push(`/${locale}/${slug}/results`)}
          className="gap-2"
        >
          <MdArrowBack className="h-4 w-4" /> {t("backToResults")}
        </Button>

        {/* Shootout result */}
        <Card className="rounded-2xl overflow-hidden">
          <CardContent className="p-6 text-center space-y-6">
            <div className="flex items-center justify-center gap-8">
              <div className="text-center">
                <PartyAvatar name={party1.name} size="lg" />
                <p className="mt-2 text-sm font-medium">{party1.name}</p>
                <p className="text-3xl font-black text-blue-600 mt-1">{party1Score}</p>
              </div>
              <span className="text-2xl font-bold text-gray-300">vs</span>
              <div className="text-center">
                <PartyAvatar name={party2.name} size="lg" />
                <p className="mt-2 text-sm font-medium">{party2.name}</p>
                <p className="text-3xl font-black text-blue-600 mt-1">{party2Score}</p>
              </div>
            </div>

            {/* Bar chart */}
            <div className="flex items-center gap-2">
              <div
                className="h-8 rounded-l-full bg-blue-600 transition-all"
                style={{ width: `${(party1Score / Math.max(party1Score + party2Score, 1)) * 100}%`, minWidth: party1Score > 0 ? "20px" : "0" }}
              />
              <div
                className="h-8 rounded-r-full bg-gray-300 transition-all dark:bg-gray-600"
                style={{ width: `${(party2Score / Math.max(party1Score + party2Score, 1)) * 100}%`, minWidth: party2Score > 0 ? "20px" : "0" }}
              />
            </div>

            <Button
              onClick={() => router.push(`/${locale}/${slug}/results`)}
              className="rounded-xl bg-blue-600 text-white hover:bg-blue-700"
            >
              {t("backToResults")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Back button */}
      <Button
        variant="ghost"
        onClick={() => router.push(`/${locale}/${slug}/results`)}
        className="gap-2"
      >
        <MdArrowBack className="h-4 w-4" /> {t("backToResults")}
      </Button>

      {/* Warning if both parties agree on everything */}
      {allAgree && (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30">
          <CardContent className="p-4 text-center text-sm text-amber-800 dark:text-amber-200">
            {locale === "en"
              ? "These two parties agree on all extra questions, so comparing them here won't help differentiate. All questions are shown below."
              : "Deze twee partijen zijn het eens over alle extra stellingen, dus vergelijken helpt hier niet. Alle stellingen worden hieronder getoond."}
          </CardContent>
        </Card>
      )}

      {/* Header with party logos */}
      <div className="flex items-center justify-center gap-4">
        <PartyAvatar name={party1.name} size="md" />
        <span className="text-gray-400">↔</span>
        <PartyAvatar name={party2.name} size="md" />
      </div>

      {/* Question card */}
      <Card className="rounded-2xl border-0 shadow-lg">
        <CardContent className="p-6 space-y-4">
          <h3 className="text-sm font-bold text-blue-600">
            {t("extraQuestion", { number: currentIdx + 1 })}
          </h3>
          <h2 className="text-lg font-semibold leading-relaxed">{current.title}</h2>

          {/* Show what both parties think */}
          <div className="rounded-xl bg-gray-50 p-4 space-y-3 dark:bg-gray-800/50">
            <p className="text-xs font-semibold text-gray-500">
              {t("whatDoesPartyThink", { party: `${party1.name} & ${party2.name}` })}
            </p>
            {/* Party explanations now fully translated */}
            {[party1, party2].map((party) => {
              const pos = party.positions[current.id];
              if (!pos) return null;
              return (
                <div key={party.id} className="flex items-start gap-2">
                  <PartyAvatar name={party.name} size="sm" />
                  <div>
                    <p className="text-xs font-medium">{party.name}: <span className={pos.position === "agree" ? "text-green-600" : pos.position === "disagree" ? "text-red-600" : "text-gray-500"}>{pos.position === "agree" ? tq("agree") : pos.position === "disagree" ? tq("disagree") : tq("neither")}</span></p>
                    {pos.explanation && (
                      <p className="text-xs text-gray-500 mt-0.5">{pos.explanation}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Answer buttons */}
      <div className="grid grid-cols-3 gap-3">
        <Button onClick={() => answer("agree")} className="h-14 rounded-xl bg-green-600 text-white hover:bg-green-700">
          <MdThumbUp className="h-5 w-5 mr-1" /> {tq("agree")}
        </Button>
        <Button onClick={() => answer("neither")} variant="outline" className="h-14 rounded-xl">
          <MdRemove className="h-5 w-5 mr-1" /> {tq("neither")}
        </Button>
        <Button onClick={() => answer("disagree")} className="h-14 rounded-xl bg-red-600 text-white hover:bg-red-700">
          <MdThumbDown className="h-5 w-5 mr-1" /> {tq("disagree")}
        </Button>
      </div>

      <p className="text-center text-xs text-gray-400">
        {currentIdx + 1} / {shootoutStmts.length}
      </p>
    </div>
  );
}
