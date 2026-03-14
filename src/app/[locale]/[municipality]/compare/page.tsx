"use client";

import { useTranslations, useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { MunicipalityData } from "@/lib/types";
import { PartyAvatar } from "@/components/party-avatar";
import { MdWarning } from "@/components/icons";

export default function ComparePage() {
  const t = useTranslations("compare");
  const tq = useTranslations("questionnaire");
  const tc = useTranslations("common");
  const locale = useLocale();
  const params = useParams();
  const slug = params.municipality as string;

  const [data, setData] = useState<MunicipalityData | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [themeFilter, setThemeFilter] = useState<string>("");

  useEffect(() => {
    fetch(`/data/municipalities/${slug}/${locale === "en" ? "en" : "nl"}.json`)
      .then((r) => (r.ok ? r : fetch(`/data/municipalities/${slug}/nl.json`)))
      .then((r) => r.json())
      .then(setData);
  }, [slug, locale]);

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl space-y-6" aria-live="polite">
        <Skeleton className="h-10 w-64 mx-auto" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-32 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  const selectedParties = data.parties.filter((p) => selected.includes(p.id));
  const themes = [...new Set(data.statements.map((s) => s.theme))];
  const filteredStatements = themeFilter
    ? data.statements.filter((s) => s.theme === themeFilter)
    : data.statements;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="text-gray-500">{data.name}</p>
      </div>

      {/* Party Selection */}
      {selected.length < 4 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">
            {t("selectParties", { count: selected.length })}
          </p>
          <div className="flex flex-wrap gap-2">
            {data.parties
              .filter((p) => p.participates && !selected.includes(p.id))
              .map((p) => (
                <Button
                  key={p.id}
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => setSelected((s) => [...s, p.id])}
                >
                  <PartyAvatar name={p.name} size="sm" /> {p.name}
                </Button>
              ))}
          </div>
        </div>
      )}

      {/* Selected parties chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedParties.map((p) => (
            <Badge
              key={p.id}
              variant="secondary"
              className="cursor-pointer text-sm px-3 py-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900"
              onClick={() => setSelected((s) => s.filter((id) => id !== p.id))}
            >
              {p.name} ✕
            </Badge>
          ))}
        </div>
      )}

      {/* Theme filter */}
      {selected.length >= 2 && (
        <div className="flex flex-wrap gap-2 overflow-x-auto pb-2">
          <Badge
            variant={themeFilter === "" ? "default" : "outline"}
            className="cursor-pointer shrink-0 rounded-lg"
            onClick={() => setThemeFilter("")}
          >
            {t("allThemes")}
          </Badge>
          {themes.map((theme) => (
            <Badge
              key={theme}
              variant={themeFilter === theme ? "default" : "outline"}
              className="cursor-pointer shrink-0 rounded-lg"
              onClick={() => setThemeFilter(themeFilter === theme ? "" : theme)}
            >
              {theme}
            </Badge>
          ))}
        </div>
      )}

      {/* Comparison Table */}
      {selected.length >= 2 && (
        <div className="space-y-3">
          {filteredStatements.map((stmt) => {
            const title = locale === "en" && stmt.titleEn ? stmt.titleEn : stmt.title;
            const theme = locale === "en" && stmt.themeEn ? stmt.themeEn : stmt.theme;

            const positions = selectedParties.map(
              (p) => p.positions[stmt.id]?.position || "neither"
            );
            const allSame = positions.every((p) => p === positions[0]);

            return (
              <Card
                key={stmt.id}
                className={`overflow-hidden rounded-xl transition-all ${
                  !allSame ? "border-amber-300 dark:border-amber-700" : ""
                }`}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Badge variant="outline" className="text-xs mb-1 rounded-md">
                        {theme}
                      </Badge>
                      <p className="font-medium text-sm leading-snug">{title}</p>
                    </div>
                    {!allSame && (
                      <Badge
                        variant="outline"
                        className="shrink-0 text-amber-600 border-amber-400 text-xs rounded-md"
                      >
                        <MdWarning className="h-3.5 w-3.5" /> {t("divided")}
                      </Badge>
                    )}
                  </div>
                  <div
                    className="grid gap-2"
                    style={{ gridTemplateColumns: `repeat(${selectedParties.length}, 1fr)` }}
                  >
                    {selectedParties.map((party) => {
                      const pos = party.positions[stmt.id];
                      const position = pos?.position || "neither";
                      const colorClass =
                        position === "agree"
                          ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                          : position === "disagree"
                            ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";

                      return (
                        <div
                          key={party.id}
                          className={`rounded-lg p-2.5 text-center text-xs ${colorClass}`}
                        >
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <PartyAvatar name={party.name} size="sm" />
                          </div>
                          <p className="font-medium truncate text-[10px]">{party.name}</p>
                          <p className="mt-1 font-bold">
                            {position === "agree"
                              ? t("agree")
                              : position === "disagree"
                                ? t("disagree")
                                : t("neither")}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {selected.length < 2 && (
        <div className="py-12 text-center text-gray-400">
          <p className="text-lg">
            {t("selectParties", { count: selected.length })}
          </p>
        </div>
      )}
    </div>
  );
}
