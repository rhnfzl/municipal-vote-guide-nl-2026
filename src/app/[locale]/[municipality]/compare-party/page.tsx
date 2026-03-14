"use client";

import { useTranslations, useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PartyAvatar } from "@/components/party-avatar";
import { MdArrowBack, MdThumbUp, MdThumbDown, MdRemove } from "@/components/icons";
import type { MunicipalityData, UserAnswer } from "@/lib/types";

export default function ComparePartyPage() {
  const t = useTranslations("flow");
  const locale = useLocale();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.municipality as string;
  const partyIdParam = searchParams.get("party");

  const [data, setData] = useState<MunicipalityData | null>(null);
  const [answers, setAnswers] = useState<Record<number, UserAnswer>>({});
  const [activePartyId, setActivePartyId] = useState<number | null>(null);

  useEffect(() => {
    const savedAnswers =
      sessionStorage.getItem(`vg-${slug}-answers`) ||
      localStorage.getItem(`vg-${slug}-answers`);
    if (savedAnswers) setAnswers(JSON.parse(savedAnswers));

    fetch(`/data/municipalities/${slug}/${locale === "en" ? "en" : "nl"}.json`)
      .then((r) => (r.ok ? r : fetch(`/data/municipalities/${slug}/nl.json`)))
      .then((r) => r.json())
      .then((d: MunicipalityData) => {
        setData(d);
        if (partyIdParam) setActivePartyId(parseInt(partyIdParam));
        else if (d.parties.length > 0) setActivePartyId(d.parties[0].id);
      });
  }, [slug, locale, partyIdParam]);

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl space-y-6" aria-live="polite">
        <Skeleton className="h-10 w-80 mx-auto" />
        <div className="flex gap-2 overflow-x-auto pb-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-14 rounded-xl shrink-0" />
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    );
  }

  const activeParty = data.parties.find((p) => p.id === activePartyId);
  const participatingParties = data.parties.filter((p) => p.participates);

  const AnswerIcon = ({ answer, size = "h-8 w-8" }: { answer: string; size?: string }) => {
    if (answer === "agree") return <div className={`${size} rounded-full bg-green-500 text-white flex items-center justify-center`}><MdThumbUp className="h-4 w-4" /></div>;
    if (answer === "disagree") return <div className={`${size} rounded-full bg-red-500 text-white flex items-center justify-center`}><MdThumbDown className="h-4 w-4" /></div>;
    return <div className={`${size} rounded-full bg-gray-300 text-gray-600 flex items-center justify-center dark:bg-gray-700 dark:text-gray-400`}><MdRemove className="h-4 w-4" /></div>;
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        onClick={() => router.push(`/${locale}/${slug}/results`)}
        className="gap-2"
      >
        <MdArrowBack className="h-4 w-4" /> {t("backToResults")}
      </Button>

      {/* Party tab bar - horizontal scrollable */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {participatingParties.map((party, idx) => (
          <button
            key={party.id}
            onClick={() => setActivePartyId(party.id)}
            className={`flex flex-col items-center gap-1 rounded-xl p-2 min-w-[60px] transition-all shrink-0 ${
              party.id === activePartyId
                ? "bg-blue-50 ring-2 ring-blue-500 dark:bg-blue-950/30"
                : "hover:bg-gray-50 dark:hover:bg-gray-800"
            }`}
          >
            <PartyAvatar name={party.name} size="md" />
            <span className="text-[10px] font-medium text-gray-500">{idx + 1}</span>
          </button>
        ))}
      </div>

      {/* Title */}
      {activeParty && (
        <h2 className="text-xl font-bold text-center">
          {t("compareWith", { party: activeParty.name })}
        </h2>
      )}

      {/* Party Deep Dive - website + council status */}
      {activeParty && (
        <div className="flex items-center justify-center gap-4 text-sm">
          {activeParty.hasSeats && (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-300">
              {locale === "en" ? "Currently in council" : "Zit in de gemeenteraad"}
            </span>
          )}
          {!activeParty.hasSeats && (
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              {locale === "en" ? "Not currently in council" : "Niet in de gemeenteraad"}
            </span>
          )}
          {activeParty.website && (
            <a
              href={activeParty.website.startsWith("http") ? activeParty.website : `https://${activeParty.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-300"
            >
              {locale === "en" ? "Visit website →" : "Bezoek website →"}
            </a>
          )}
        </div>
      )}

      {/* Per-question comparison */}
      {activeParty && (
        <div className="space-y-4">
          {data.statements.map((stmt) => {
            const userAnswer = answers[stmt.id] || "skip";
            const partyPos = activeParty.positions[stmt.id];
            if (!partyPos) return null;

            return (
              <Card key={stmt.id} className="rounded-xl overflow-hidden">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start gap-4">
                    {/* Statement */}
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-blue-600 dark:text-blue-400 mb-1">
                        {stmt.theme}
                      </h3>
                      <p className="font-medium text-sm leading-relaxed">{stmt.title}</p>

                      {/* Party explanation */}
                      {partyPos.explanation && (
                        <div className="mt-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                            {t("whatDoesPartyThink", { party: activeParty.name })}
                          </p>
                          <p className="text-xs text-gray-500 leading-relaxed">
                            {partyPos.explanation}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Answer indicators */}
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-400">
                          {locale === "en" ? "You" : "Jij"}
                        </span>
                        <AnswerIcon answer={userAnswer} size="h-8 w-8" />
                      </div>
                      <MdRemove className="h-3 w-3 text-gray-300" />
                      <div className="flex items-center gap-1">
                        <PartyAvatar name={activeParty.name} size="sm" />
                        <AnswerIcon answer={partyPos.position} size="h-8 w-8" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
