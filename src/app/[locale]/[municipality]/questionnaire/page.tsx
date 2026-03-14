"use client";

import { useTranslations, useLocale } from "next-intl";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import type { MunicipalityData, UserAnswer, Statement } from "@/lib/types";

type InfoTab = "parties" | "moreInfo" | "arguments" | null;

export default function QuestionnairePage() {
  const t = useTranslations("questionnaire");
  const tc = useTranslations("common");
  const locale = useLocale();
  const params = useParams();
  const router = useRouter();
  const slug = params.municipality as string;

  const [data, setData] = useState<MunicipalityData | null>(null);
  const [altData, setAltData] = useState<MunicipalityData | null>(null); // alternate language
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, UserAnswer>>({});
  const [dealbreakers, setDealbreakers] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<InfoTab>(null);
  const [loading, setLoading] = useState(true);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(`vg-${slug}-answers`);
    const savedDb = localStorage.getItem(`vg-${slug}-dealbreakers`);
    const savedIdx = localStorage.getItem(`vg-${slug}-index`);

    const primary = locale === "en" ? "en" : "nl";
    const alt = locale === "en" ? "nl" : "en";

    // Load primary language
    fetch(`/data/municipalities/${slug}/${primary}.json`)
      .then((r) => (r.ok ? r : fetch(`/data/municipalities/${slug}/nl.json`)))
      .then((r) => r.json())
      .then((d: MunicipalityData) => {
        setData(d);
        if (saved) setAnswers(JSON.parse(saved));
        if (savedDb) setDealbreakers(new Set(JSON.parse(savedDb)));
        if (savedIdx) setCurrentIdx(parseInt(savedIdx));
        setLoading(false);
      });

    // Load alternate language (for bilingual display)
    fetch(`/data/municipalities/${slug}/${alt}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setAltData(d); })
      .catch(() => {}); // silently fail if no translation available
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

  // Party positions for current statement
  const partyPositions = useMemo(() => {
    if (!data || !current) return { agree: [], disagree: [], neither: [] };
    const agree: { name: string; explanation: string }[] = [];
    const disagree: { name: string; explanation: string }[] = [];
    const neither: { name: string; explanation: string }[] = [];
    for (const party of data.parties) {
      if (!party.participates) continue;
      const pos = party.positions[current.id];
      if (!pos) continue;
      const entry = { name: party.name, explanation: pos.explanation || "" };
      if (pos.position === "agree") agree.push(entry);
      else if (pos.position === "disagree") disagree.push(entry);
      else neither.push(entry);
    }
    return { agree, disagree, neither };
  }, [data, current]);

  const goNext = useCallback(() => {
    setAnimating(true);
    setActiveTab(null);
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
      <div className="mx-auto max-w-2xl space-y-6" aria-live="polite">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-64 rounded-2xl" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
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

  // Alternate language text (for bilingual display)
  const altStmt = altData?.statements?.find((s) => s.id === current.id);
  const altTitle = altStmt?.title || (locale === "en" ? current.title : current.titleEn) || "";
  const altTheme = altStmt?.theme || (locale === "en" ? current.theme : current.themeEn) || "";

  const tabs = [
    { id: "parties" as const, label: t("tabParties"), icon: "💬" },
    { id: "moreInfo" as const, label: t("tabMoreInfo"), icon: "📖" },
    { id: "arguments" as const, label: t("tabArguments"), icon: "⚖️" },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            if (currentIdx > 0) {
              setAnimating(true);
              setActiveTab(null);
              setTimeout(() => { setCurrentIdx((i) => i - 1); setAnimating(false); }, 150);
            } else {
              router.push(`/${locale}`);
            }
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
          aria-label={t("previous")}
        >
          ←
        </button>
        <span className="rounded-full border border-gray-200 px-3 py-1 text-sm font-semibold dark:border-gray-700">
          {currentIdx + 1}/{statements.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-blue-600 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Question Card */}
      <Card
        className={`overflow-hidden rounded-2xl border-0 bg-white shadow-lg transition-all duration-200 dark:bg-gray-900 ${
          animating ? "scale-[0.97] opacity-70" : "scale-100 opacity-100"
        }`}
      >
        <CardContent className="space-y-4 p-6 sm:p-8">
          {/* Theme */}
          <div>
            <h3 className="text-lg font-bold text-blue-600 dark:text-blue-400">{theme}</h3>
            {altTheme && altTheme !== theme && (
              <p className="text-xs text-gray-400 italic mt-0.5">{altTheme}</p>
            )}
          </div>

          {/* Statement */}
          <div>
            <h2 className="text-lg font-semibold leading-relaxed text-gray-900 dark:text-gray-100 sm:text-xl">
              {title}
            </h2>
            {altTitle && altTitle !== title && (
              <p className="mt-1.5 text-sm text-gray-400 italic leading-relaxed">
                {altTitle}
              </p>
            )}
          </div>

          {/* Dealbreaker */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer" aria-label={t("markDealbreaker")}>
              <span className="text-sm text-gray-500">{t("dealbreaker")}</span>
              <Switch checked={isDealbreaker} onCheckedChange={toggleDealbreaker} />
            </label>
            {isDealbreaker && (
              <Badge variant="destructive" className="text-xs">⚑ {t("dealbreaker")}</Badge>
            )}
          </div>

          {/* Three Tabs — matching StemWijzer */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden dark:border-gray-700">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(activeTab === tab.id ? null : tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-medium transition-colors sm:text-sm ${
                  activeTab === tab.id
                    ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                    : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800/50"
                }`}
                aria-expanded={activeTab === tab.id}
              >
                <span aria-hidden="true">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(" ").slice(-1)[0]}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab && (
            <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => setActiveTab(null)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
  {tc("close")} ✕
                </button>
              </div>

              {/* Parties Tab */}
              {activeTab === "parties" && (
                <div className="space-y-4">
                  {partyPositions.agree.length > 0 && (
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-bold text-green-700 dark:text-green-400 mb-2">
                        👍 {t("partiesAgree")}
                        <span className="text-xs font-normal text-gray-500">
                          ({t("partiesAgreeDesc")})
                        </span>
                      </h4>
                      <div className="space-y-1.5">
                        {partyPositions.agree.map((p) => (
                          <details key={p.name} className="rounded-lg bg-white p-3 dark:bg-gray-900">
                            <summary className="cursor-pointer text-sm font-medium">{p.name}</summary>
                            {p.explanation && (
                              <p className="mt-2 text-xs text-gray-500 leading-relaxed">{p.explanation}</p>
                            )}
                          </details>
                        ))}
                      </div>
                    </div>
                  )}

                  {partyPositions.neither.length > 0 && (
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-bold text-gray-600 dark:text-gray-400 mb-2">
                        〰️ {t("partiesNeither")}
                        <span className="text-xs font-normal text-gray-500">({t("partiesNeitherDesc")})</span>
                      </h4>
                      <div className="space-y-1.5">
                        {partyPositions.neither.map((p) => (
                          <details key={p.name} className="rounded-lg bg-white p-3 dark:bg-gray-900">
                            <summary className="cursor-pointer text-sm font-medium">{p.name}</summary>
                            {p.explanation && (
                              <p className="mt-2 text-xs text-gray-500 leading-relaxed">{p.explanation}</p>
                            )}
                          </details>
                        ))}
                      </div>
                    </div>
                  )}

                  {partyPositions.disagree.length > 0 && (
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-bold text-red-700 dark:text-red-400 mb-2">
                        👎 {t("partiesDisagree")}
                        <span className="text-xs font-normal text-gray-500">
                          ({t("partiesDisagreeDesc")})
                        </span>
                      </h4>
                      <div className="space-y-1.5">
                        {partyPositions.disagree.map((p) => (
                          <details key={p.name} className="rounded-lg bg-white p-3 dark:bg-gray-900">
                            <summary className="cursor-pointer text-sm font-medium">{p.name}</summary>
                            {p.explanation && (
                              <p className="mt-2 text-xs text-gray-500 leading-relaxed">{p.explanation}</p>
                            )}
                          </details>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* More Info Tab */}
              {activeTab === "moreInfo" && (
                <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {moreInfo || t("noInfoAvailable")}
                </div>
              )}

              {/* Arguments Tab */}
              {activeTab === "arguments" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg bg-green-50 p-4 dark:bg-green-950/30">
                    <h4 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-green-700 dark:text-green-400">
                      ✓ {t("argumentsFor")}
                    </h4>
                    <p className="text-sm text-green-800 dark:text-green-300 leading-relaxed">
                      {pro || t("noArguments")}
                    </p>
                  </div>
                  <div className="rounded-lg bg-red-50 p-4 dark:bg-red-950/30">
                    <h4 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-red-700 dark:text-red-400">
                      ✗ {t("argumentsAgainst")}
                    </h4>
                    <p className="text-sm text-red-800 dark:text-red-300 leading-relaxed">
                      {con || t("noArguments")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Answer Buttons */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Button
          onClick={() => answer("agree")}
          className="h-14 text-sm font-bold rounded-xl bg-green-600 text-white shadow-sm transition-all hover:bg-green-700 hover:shadow-md active:scale-[0.97] sm:text-base"
          size="lg"
        >
          👍 {t("agree")}
        </Button>
        <Button
          onClick={() => answer("neither")}
          variant="outline"
          className="h-14 text-sm font-bold rounded-xl shadow-sm transition-all hover:shadow-md active:scale-[0.97] sm:text-base"
          size="lg"
        >
          〰️ {t("neither")}
        </Button>
        <Button
          onClick={() => answer("disagree")}
          className="h-14 text-sm font-bold rounded-xl bg-red-600 text-white shadow-sm transition-all hover:bg-red-700 hover:shadow-md active:scale-[0.97] sm:text-base"
          size="lg"
        >
          👎 {t("disagree")}
        </Button>
      </div>

      {/* Skip */}
      <div className="text-center">
        <Button variant="ghost" onClick={() => answer("skip")} className="text-gray-400 text-sm">
          {t("skip")} →
        </Button>
      </div>

      {/* View Results */}
      {answeredCount >= 5 && (
        <div className="text-center">
          <Button
            onClick={goToResults}
            size="lg"
            className="h-14 w-full rounded-xl bg-blue-600 px-8 text-base font-semibold text-white shadow-md hover:bg-blue-700 hover:shadow-lg active:scale-[0.98] sm:w-auto"
          >
            {t("viewResults")} →
          </Button>
        </div>
      )}

      {/* Progress info */}
      <p className="text-center text-xs text-gray-400">
        {t("progress", { answered: answeredCount, total: statements.length })}
      </p>
    </div>
  );
}
