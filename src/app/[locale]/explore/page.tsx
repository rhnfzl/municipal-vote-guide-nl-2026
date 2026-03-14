"use client";

import { useTranslations, useLocale } from "next-intl";
import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { searchWithAliases } from "@/lib/municipality-aliases";
import { MdLightbulb, MdChevronRight } from "@/components/icons";
import { translateTheme } from "@/lib/theme-translations";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

interface NationalStats {
  totalMunicipalities: number;
  withOfficialEnglish: number;
  topThemes: [string, number][];
  topParties: [string, number][];
}

interface Municipality {
  id: string;
  name: string;
  slug: string;
  numParties: number;
  numStatements: number;
}

const COLORS = [
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#14b8a6",
];

export default function ExplorePage() {
  const t = useTranslations("explore");
  const thome = useTranslations("home");
  const locale = useLocale();
  const router = useRouter();
  const [stats, setStats] = useState<NationalStats | null>(null);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/data/national/stats.json").then((r) => r.json()),
      fetch("/data/index.json").then((r) => r.json()),
    ]).then(([s, m]) => {
      setStats(s);
      setMunicipalities(m);
    });
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return municipalities;
    return searchWithAliases(municipalities, query);
  }, [query, municipalities]);

  // Fun facts using i18n
  const funFacts = useMemo(() => {
    if (!municipalities.length || !stats) return [];
    const facts: string[] = [];
    const sortedByParties = [...municipalities].sort((a, b) => b.numParties - a.numParties);
    const mostParties = sortedByParties[0];
    const fewestParties = sortedByParties[sortedByParties.length - 1];
    const sortedByStmts = [...municipalities].sort((a, b) => b.numStatements - a.numStatements);
    const mostStatements = sortedByStmts[0];
    const fewestStatements = sortedByStmts[sortedByStmts.length - 1];
    const avgParties = Math.round(municipalities.reduce((s, m) => s + m.numParties, 0) / municipalities.length);
    const avgStatements = Math.round(municipalities.reduce((s, m) => s + m.numStatements, 0) / municipalities.length);

    if (mostParties) facts.push(t("funFactMostParties", { name: mostParties.name, count: mostParties.numParties }));
    if (fewestParties) facts.push(t("funFactFewestParties", { name: fewestParties.name, count: fewestParties.numParties }));
    if (stats.topThemes[0]) facts.push(t("funFactTopTheme", { theme: translateTheme(stats.topThemes[0][0], locale), count: stats.topThemes[0][1] }));
    if (fewestStatements) facts.push(t("funFactFewestStatements", { name: fewestStatements.name, count: fewestStatements.numStatements }));

    // Extra facts
    facts.push(locale === "en"
      ? `Average municipality has ${avgParties} parties and ${avgStatements} statements`
      : `Gemiddelde gemeente heeft ${avgParties} partijen en ${avgStatements} stellingen`);
    if (mostStatements) facts.push(locale === "en"
      ? `${mostStatements.name} has the most statements (${mostStatements.numStatements})`
      : `${mostStatements.name} heeft de meeste stellingen (${mostStatements.numStatements})`);

    return facts;
  }, [municipalities, stats, t, locale]);

  if (!stats) {
    return (
      <div className="space-y-6" aria-live="polite">
        <Skeleton className="h-10 w-80 mx-auto" />
        <Skeleton className="h-6 w-60 mx-auto" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  const themeData = stats.topThemes.slice(0, 20).map(([name, count]) => ({
    name: translateTheme(name, locale),
    count,
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="text-gray-500">{t("subtitle", { count: stats.totalMunicipalities })}</p>
        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
          {t("stats", { municipalities: stats.totalMunicipalities, parties: "2,446", statements: "7,742" })}
        </p>
      </div>

      {/* Fun Facts */}
      {funFacts.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {funFacts.map((fact, i) => (
            <div key={i} className="flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
              <MdLightbulb className="h-5 w-5 shrink-0 text-blue-600" />
              <span>{fact}</span>
            </div>
          ))}
        </div>
      )}

      {/* Themes Chart — full width */}
      <Card className="overflow-hidden rounded-2xl border-0 shadow-md">
        <CardContent className="p-5">
          <h2 className="mb-4 text-lg font-semibold">{t("topThemes")}</h2>
          <div className="h-[500px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={themeData} layout="vertical" margin={{ left: 20, right: 30 }}>
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => [
                    `${value} ${t("municipalities")}`,
                    t("appearsIn")
                  ]}
                  contentStyle={{ borderRadius: 8, fontSize: 13 }}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {themeData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Municipality Browser */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">{t("browseAll")}</h2>
        <input
          type="search"
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-base transition-all placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900"
          aria-label={t("searchAriaLabel")}
        />

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.slice(0, 60).map((m) => (
            <button
              key={m.slug}
              onClick={() => router.push(`/${locale}/${m.slug}/questionnaire`)}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 text-left transition-all hover:border-blue-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-700"
            >
              <div>
                <span className="font-medium text-sm">{m.name}</span>
                <div className="flex gap-2 mt-0.5">
                  <span className="text-xs text-gray-400">{m.numParties} {thome("parties")}</span>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs text-gray-400">{m.numStatements} {thome("questions")}</span>
                </div>
              </div>
              <MdChevronRight className="h-5 w-5 text-gray-300" />
            </button>
          ))}
        </div>

        {filtered.length > 60 && (
          <p className="text-center text-sm text-gray-400">
            {t("showing", { shown: 60, total: filtered.length })}
          </p>
        )}
      </div>
    </div>
  );
}
