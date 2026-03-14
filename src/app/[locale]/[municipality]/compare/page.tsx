"use client";

import { useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { MunicipalityData, Party } from "@/lib/types";

export default function ComparePage() {
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

  if (!data) return <p className="text-center py-20 text-gray-500">Loading...</p>;

  const selectedParties = data.parties.filter((p) => selected.includes(p.id));
  const themes = [...new Set(data.statements.map((s) => s.theme))];
  const filteredStatements = themeFilter
    ? data.statements.filter((s) => s.theme === themeFilter)
    : data.statements;

  const posColor = (pos: string) =>
    pos === "agree"
      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
      : pos === "disagree"
        ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";

  const posLabel = (pos: string) =>
    pos === "agree" ? (locale === "en" ? "Agree" : "Eens") :
    pos === "disagree" ? (locale === "en" ? "Disagree" : "Oneens") :
    (locale === "en" ? "Neither" : "Geen");

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">
          {locale === "en" ? "Compare Parties" : "Vergelijk Partijen"}
        </h1>
        <p className="text-gray-500">{data.name}</p>
      </div>

      {/* Party Selection */}
      {selected.length < 4 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">
            {locale === "en"
              ? `Select up to 4 parties (${selected.length}/4):`
              : `Selecteer tot 4 partijen (${selected.length}/4):`}
          </p>
          <div className="flex flex-wrap gap-2">
            {data.parties
              .filter((p) => p.participates && !selected.includes(p.id))
              .map((p) => (
                <Button
                  key={p.id}
                  variant="outline"
                  size="sm"
                  onClick={() => setSelected((s) => [...s, p.id])}
                >
                  + {p.name}
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
              className="cursor-pointer text-sm px-3 py-1"
              onClick={() => setSelected((s) => s.filter((id) => id !== p.id))}
            >
              {p.name} ✕
            </Badge>
          ))}
        </div>
      )}

      {/* Theme filter */}
      {selected.length >= 2 && (
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={themeFilter === "" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setThemeFilter("")}
          >
            {locale === "en" ? "All themes" : "Alle thema's"}
          </Badge>
          {themes.map((theme) => (
            <Badge
              key={theme}
              variant={themeFilter === theme ? "default" : "outline"}
              className="cursor-pointer"
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
            const title =
              locale === "en" && stmt.titleEn ? stmt.titleEn : stmt.title;
            const theme =
              locale === "en" && stmt.themeEn ? stmt.themeEn : stmt.theme;

            // Check if parties disagree with each other
            const positions = selectedParties.map(
              (p) => p.positions[stmt.id]?.position || "neither"
            );
            const allSame = positions.every((p) => p === positions[0]);

            return (
              <Card
                key={stmt.id}
                className={!allSame ? "border-amber-300 dark:border-amber-700" : ""}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Badge variant="outline" className="text-xs mb-1">
                        {theme}
                      </Badge>
                      <p className="font-medium text-sm leading-snug">
                        {title}
                      </p>
                    </div>
                    {!allSame && (
                      <Badge variant="outline" className="shrink-0 text-amber-600 border-amber-400 text-xs">
                        {locale === "en" ? "Divided" : "Verdeeld"}
                      </Badge>
                    )}
                  </div>
                  <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${selectedParties.length}, 1fr)` }}>
                    {selectedParties.map((party) => {
                      const pos = party.positions[stmt.id];
                      const position = pos?.position || "neither";
                      return (
                        <div
                          key={party.id}
                          className={`rounded-md p-2 text-center text-xs ${posColor(position)}`}
                        >
                          <p className="font-medium truncate">{party.name}</p>
                          <p className="mt-1 font-bold">{posLabel(position)}</p>
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
    </div>
  );
}
