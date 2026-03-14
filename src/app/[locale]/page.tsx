"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { searchWithAliases } from "@/lib/municipality-aliases";
import { MdSearch, MdChevronRight } from "@/components/icons";
import { MunicipalityAvatar } from "@/components/municipality-avatar";

interface Municipality {
  id: string;
  name: string;
  slug: string;
  numParties: number;
  numStatements: number;
}

const POPULAR_SLUGS = [
  "amsterdam", "rotterdam", "s-gravenhage", "utrecht", "eindhoven", "groningen",
  "s-hertogenbosch", "tilburg", "almere", "breda", "nijmegen", "haarlem",
];

export default function HomePage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/data/index.json")
      .then((r) => r.json())
      .then((data: Municipality[]) => {
        setMunicipalities(data);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    return searchWithAliases(municipalities, query);
  }, [query, municipalities]);

  const popular = useMemo(
    () => municipalities.filter((m) => POPULAR_SLUGS.includes(m.slug)),
    [municipalities]
  );

  const showResults = query.trim().length > 0;
  const displayList = showResults
    ? filtered
    : showAll
      ? municipalities
      : popular;

  // Days until election
  const electionDate = new Date("2026-03-18");
  const today = new Date();
  const daysUntil = Math.max(0, Math.ceil((electionDate.getTime() - today.getTime()) / 86400000));

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-6 py-10 text-center dark:from-blue-950/30 dark:via-gray-950 dark:to-indigo-950/30 sm:py-14">
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100 sm:text-4xl">
          {t("home.title")}
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-base text-gray-500 dark:text-gray-400 sm:text-lg">
          {t("home.subtitle")}
        </p>

        {daysUntil > 0 && daysUntil <= 14 && (
          <div className="mt-4">
            <Badge className="bg-blue-600 text-white px-4 py-1.5 text-sm font-semibold">
              {t("home.daysUntil", { days: daysUntil })}
            </Badge>
          </div>
        )}

        {/* Search */}
        <div className="relative mx-auto mt-6 max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <MdSearch className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </div>
          <input
            type="search"
            placeholder={t("home.searchPlaceholder")}
            aria-label={t("home.searchAriaLabel")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-14 w-full rounded-xl border border-gray-300 bg-white pl-12 pr-4 text-lg shadow-sm transition-all placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
            autoFocus
          />
        </div>
      </div>

      {/* Section header */}
      {!loading && (
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
            {showResults
              ? `${filtered.length} ${filtered.length === 1 ? "result" : "results"}`
              : showAll
                ? `${locale === "en" ? "All" : "Alle"} ${municipalities.length} ${locale === "en" ? "municipalities" : "gemeenten"}`
                : t("home.popularCities")}
          </h2>
          {!showResults && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              {t("home.browseAll", { count: municipalities.length })}
            </button>
          )}
          {showAll && !showResults && (
            <button
              onClick={() => setShowAll(false)}
              className="text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              {locale === "en" ? "Show popular only" : "Toon alleen populaire"}
            </button>
          )}
        </div>
      )}

      {/* No results */}
      {showResults && filtered.length === 0 && (
        <p className="py-8 text-center text-gray-400">
          {t("home.noResults", { query })}
        </p>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      )}

      {/* Municipality cards */}
      {!loading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {displayList.map((m) => (
            <Card
              key={m.slug}
              className="group cursor-pointer border border-gray-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900"
              onClick={() => router.push(`/${locale}/${m.slug}/questionnaire`)}
              role="button"
              tabIndex={0}
              aria-label={`${m.name}: ${m.numParties} ${t("home.parties")}, ${m.numStatements} ${t("home.questions")}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(`/${locale}/${m.slug}/questionnaire`);
                }
              }}
            >
              <CardContent className="flex items-center justify-between p-5">
                <div className="flex items-center gap-3">
                  <MunicipalityAvatar slug={m.slug} name={m.name} size="lg" />
                  <div>
                  <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors dark:text-gray-100 dark:group-hover:text-blue-400">
                    {m.name}
                  </h3>
                  <div className="mt-1.5 flex gap-2">
                    <Badge variant="secondary" className="text-xs font-normal">
                      {m.numParties} {t("home.parties")}
                    </Badge>
                    <Badge variant="outline" className="text-xs font-normal">
                      {m.numStatements} {t("home.questions")}
                    </Badge>
                  </div>
                  </div>
                </div>
                <MdChevronRight className="h-5 w-5 text-gray-300 transition-transform group-hover:translate-x-1 group-hover:text-blue-500 dark:text-gray-600" aria-hidden="true" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Election date */}
      <p className="text-center text-sm text-gray-400">
        {t("home.electionDate")}
      </p>
    </div>
  );
}
