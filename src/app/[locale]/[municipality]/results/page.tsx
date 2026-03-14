"use client";

import { useTranslations, useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { calculateMatches, generateMatchSummary, generatePoliticalProfile } from "@/lib/scoring";
import { ShareResults } from "@/components/share-results";
import { PartyAvatar } from "@/components/party-avatar";
import { MunicipalityAvatar } from "@/components/municipality-avatar";
import { MdCheckCircle, MdCancel, MdExpandMore, MdShare } from "@/components/icons";
import { PoliticalCompass } from "@/components/political-compass";
import { ConsensusMeter } from "@/components/consensus-meter";
import { encodeAnswers, decodeAnswers, compareAnswers } from "@/lib/share-answers";
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
  const [friendComparison, setFriendComparison] = useState<{
    agreed: number; disagreed: number; agreementPercentage: number; totalCompared: number;
    friendMatches: PartyMatch[];
  } | null>(null);
  const [friendLinkCopied, setFriendLinkCopied] = useState(false);
  const [waitingForFriend, setWaitingForFriend] = useState(false);

  useEffect(() => {
    const savedAnswers =
      sessionStorage.getItem(`vg-${slug}-answers`) ||
      localStorage.getItem(`vg-${slug}-answers`);
    const savedPriorities = sessionStorage.getItem(`vg-${slug}-priorities`);
    const savedPartyIds = sessionStorage.getItem(`vg-${slug}-selectedParties`);

    // Check for friend comparison ref in URL
    const urlParams = new URLSearchParams(window.location.search);
    const friendRef = urlParams.get("ref");

    if (!savedAnswers && friendRef) {
      // Friend opened the link but hasn't taken the questionnaire yet.
      // Don't show the sharer's results - just prompt them to take the questionnaire.
      sessionStorage.setItem(`vg-${slug}-friendRef`, friendRef);
      // Load municipality data just for the name/header
      fetch(`/data/municipalities/${slug}/${locale === "en" ? "en" : "nl"}.json`)
        .then((r) => (r.ok ? r : fetch(`/data/municipalities/${slug}/nl.json`)))
        .then((r) => r.json())
        .then((d: MunicipalityData) => setData(d));
      setWaitingForFriend(true);
      return;
    }

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
        const myMatches = calculateMatches(d, parsedAnswers, priorities, selectedPartyIds);
        setMatches(myMatches);

        // Compare with friend's answers if ref present
        if (friendRef) {
          const friendAnswers = decodeAnswers(friendRef);
          if (friendAnswers) {
            const comparison = compareAnswers(parsedAnswers, friendAnswers);
            const friendMatches = calculateMatches(d, friendAnswers);
            setFriendComparison({ ...comparison, friendMatches });
          }
        }
      });
  }, [slug, locale, router]);

  // Friend opened the link but hasn't taken the questionnaire yet
  if (waitingForFriend) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          {data && (
            <div className="flex items-center justify-center gap-2">
              <MunicipalityAvatar slug={slug} name={data.name} size="lg" />
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                {data.name}
              </h1>
            </div>
          )}
        </div>
        <Card className="border-purple-300 bg-purple-50 dark:border-purple-700 dark:bg-purple-950/30">
          <CardContent className="p-6 text-center space-y-4">
            <p className="text-lg font-semibold text-purple-800 dark:text-purple-200">
              {locale === "en"
                ? "A friend has shared their party match results with you!"
                : "Een vriend heeft zijn partijmatch-resultaten met je gedeeld!"}
            </p>
            <p className="text-sm text-purple-700 dark:text-purple-300">
              {locale === "en"
                ? "Take the questionnaire yourself and see how your opinions compare."
                : "Doe zelf de vragenlijst en ontdek hoe jullie meningen zich verhouden."}
            </p>
            <Button
              onClick={() => router.push(`/${locale}/${slug}/questionnaire`)}
              className="rounded-xl bg-purple-600 text-white hover:bg-purple-700 text-base px-6 py-2"
            >
              {locale === "en" ? "Take the questionnaire" : "Doe de vragenlijst"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
        <div className="flex items-center justify-center gap-2">
          <MunicipalityAvatar slug={slug} name={data.name} size="lg" />
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {tf("resultTitle")}
          </h1>
        </div>
        <p className="text-gray-500">
          {data.name} - {tf("resultSubtitle")}
        </p>
      </div>

      {/* Friend Comparison Result */}
      {friendComparison && (
        <Card className="rounded-xl border-purple-300 bg-purple-50/50 dark:border-purple-700 dark:bg-purple-950/20">
          <CardContent className="p-5 space-y-4">
            <h3 className="text-center text-sm font-semibold text-purple-800 dark:text-purple-300">
              {locale === "en" ? "Friend Comparison" : "Vergelijking met vriend"}
            </h3>
            <p className="text-center text-3xl font-black text-purple-600">
              {friendComparison.agreementPercentage}%
              <span className="block text-sm font-normal text-purple-700 dark:text-purple-400 mt-1">
                {locale === "en"
                  ? `You agreed on ${friendComparison.agreed} of ${friendComparison.totalCompared} statements`
                  : `Jullie waren het eens over ${friendComparison.agreed} van ${friendComparison.totalCompared} stellingen`}
              </span>
            </p>
            {/* Side-by-side top 3 parties */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-2 text-center">
                  {locale === "en" ? "Your top matches" : "Jouw top matches"}
                </p>
                {matches.slice(0, 3).map((m) => (
                  <div key={m.partyId} className="flex items-center gap-2 py-1">
                    <PartyAvatar name={m.partyName} size="sm" />
                    <span className="text-xs truncate flex-1">{m.partyName}</span>
                    <span className="text-xs font-bold">{m.matchPercentage}%</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-2 text-center">
                  {locale === "en" ? "Friend's top matches" : "Top matches vriend"}
                </p>
                {friendComparison.friendMatches.slice(0, 3).map((m) => (
                  <div key={m.partyId} className="flex items-center gap-2 py-1">
                    <PartyAvatar name={m.partyName} size="sm" />
                    <span className="text-xs truncate flex-1">{m.partyName}</span>
                    <span className="text-xs font-bold">{m.matchPercentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Share - prominent at top */}
      <div className="flex justify-center">
        <ShareResults matches={matches} municipality={data.name} locale={locale} />
      </div>

      {/* Friends Comparison - share link */}
      <div className="flex items-center justify-center gap-3">
        <Button
          variant="outline"
          className="rounded-xl text-sm gap-2"
          onClick={async () => {
            const encoded = encodeAnswers(answers);
            const url = `${window.location.origin}/${locale}/${slug}/results?ref=${encoded}`;
            await navigator.clipboard.writeText(url);
            setFriendLinkCopied(true);
            setTimeout(() => setFriendLinkCopied(false), 3000);
          }}
        >
          <MdShare className="h-4 w-4" />
          {friendLinkCopied
            ? (locale === "en" ? "Link copied!" : "Link gekopieerd!")
            : (locale === "en" ? "Compare with a friend" : "Vergelijk met een vriend")}
        </Button>
      </div>

      {/* Political Profile Summary */}
      {data && Object.keys(answers).length > 0 && (() => {
        const profile = generatePoliticalProfile(data, answers, locale);
        return (
          <Card className="rounded-xl border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                {locale === "en" ? "Your Political Profile" : "Jouw Politiek Profiel"}
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-400 leading-relaxed">
                {profile.summary}
              </p>
            </CardContent>
          </Card>
        );
      })()}

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

      {/* Ranked Results List - clean, StemWijzer-style */}
      <div className="space-y-3">
        {matches.map((match, idx) => {
          const isTop = idx === 0;
          // Cards are clickable → navigate to compare-party (no inline expansion)

          return (
            <Card
              key={match.partyId}
              className={`group overflow-hidden rounded-xl transition-all duration-200 cursor-pointer ${
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
                  <div className="text-right shrink-0">
                    <span className={`text-2xl font-black sm:text-3xl ${matchColor(match.matchPercentage)}`}>
                      {match.matchPercentage}%
                    </span>
                    <p className="text-[10px] text-blue-500 font-medium mt-1 group-hover:underline">
                      {locale === "en" ? "Compare →" : "Vergelijk →"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Political Compass - collapsed at bottom with explanation */}
      {data && (
        <details className="rounded-xl border border-gray-200 dark:border-gray-800">
          <summary className="cursor-pointer p-4 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 flex items-center gap-2">
            <MdExpandMore className="h-5 w-5" />
            {locale === "en" ? "Political Compass" : "Politiek Kompas"}
          </summary>
          <div className="px-4 pb-4 space-y-2">
            <p className="text-xs text-gray-500 leading-relaxed">
              {locale === "en"
                ? "This compass shows where you stand politically compared to parties. Blue dot = you. Gray dots = parties. Parties closer to your dot are more aligned with your views. Left-right shows economic stance, up-down shows social stance."
                : "Dit kompas toont waar jij politiek staat ten opzichte van partijen. Blauwe stip = jij. Grijze stippen = partijen. Partijen dichterbij jouw stip passen beter bij jouw standpunten."}
            </p>
            <PoliticalCompass data={data} answers={answers} locale={locale} />
          </div>
        </details>
      )}

      {/* Consensus Meter - which topics divide parties most */}
      {data && <ConsensusMeter data={data} locale={locale} />}

      {/* Actions */}
      <div className="flex flex-wrap gap-3 justify-center pt-4">
        <Button
          variant="outline"
          className="rounded-xl"
          onClick={() => window.print()}
        >
          {locale === "en" ? "Print / Save PDF" : "Afdrukken / PDF opslaan"}
        </Button>
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
            sessionStorage.removeItem(`vg-${slug}-index`);
            sessionStorage.removeItem(`vg-${slug}-completed`);
            sessionStorage.removeItem(`vg-${slug}-priorities`);
            sessionStorage.removeItem(`vg-${slug}-selectedParties`);
            sessionStorage.removeItem(`vg-${slug}-startTime`);
            sessionStorage.removeItem(`vg-${slug}-numStatements`);
            router.push(`/${locale}/${slug}/questionnaire`);
          }}
        >
          {t("startOver")}
        </Button>
        <Button
          variant="outline"
          className="rounded-xl"
          onClick={() => router.push(`/${locale}/explore`)}
        >
          {locale === "en" ? "Explore All Municipalities" : "Verken Alle Gemeenten"}
        </Button>
      </div>
    </div>
  );
}
