"use client";

import { useTranslations, useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PartyAvatar } from "@/components/party-avatar";
import { MdCheckCircle } from "@/components/icons";
import type { MunicipalityData, Party } from "@/lib/types";

type FilterMode = "all" | "incumbent";

export default function PartyFilterPage() {
  const t = useTranslations("flow");
  const locale = useLocale();
  const params = useParams();
  const router = useRouter();
  const slug = params.municipality as string;

  const [data, setData] = useState<MunicipalityData | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [filterMode, setFilterMode] = useState<FilterMode>("all");

  useEffect(() => {
    fetch(`/data/municipalities/${slug}/${locale === "en" ? "en" : "nl"}.json`)
      .then((r) => (r.ok ? r : fetch(`/data/municipalities/${slug}/nl.json`)))
      .then((r) => r.json())
      .then((d: MunicipalityData) => {
        setData(d);
        // Select all by default
        setSelectedIds(new Set(d.parties.filter((p) => p.participates).map((p) => p.id)));
      });
  }, [slug, locale]);

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl space-y-6" aria-live="polite">
        <Skeleton className="h-10 w-80 mx-auto" />
        <Skeleton className="h-6 w-60 mx-auto" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const parties = data.parties.filter((p) => p.participates);
  const incumbentParties = parties.filter((p) => p.hasSeats);

  function toggleParty(partyId: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(partyId)) next.delete(partyId);
      else next.add(partyId);
      return next;
    });
  }

  function setAllParties() {
    setFilterMode("all");
    setSelectedIds(new Set(parties.map((p) => p.id)));
  }

  function setIncumbentParties() {
    setFilterMode("incumbent");
    setSelectedIds(new Set(incumbentParties.map((p) => p.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function proceed() {
    sessionStorage.setItem(`vg-${slug}-selectedParties`, JSON.stringify([...selectedIds]));
    // Forward friend comparison ref if present
    const friendRef = sessionStorage.getItem(`vg-${slug}-friendRef`);
    const refParam = friendRef ? `?ref=${friendRef}` : "";
    router.push(`/${locale}/${slug}/results${refParam}`);
  }

  const isValid = selectedIds.size >= 3;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {t("partyFilter")}
        </h1>
        <p className="text-gray-500 text-sm">{t("partyFilterDesc")}</p>
      </div>

      {/* Filter toggles */}
      <div className="flex items-center justify-between">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden dark:border-gray-700">
          <button
            onClick={setAllParties}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              filterMode === "all"
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:bg-gray-50 dark:text-gray-400"
            }`}
          >
            {t("allParties")}
          </button>
          <button
            onClick={setIncumbentParties}
            className={`px-4 py-2 text-sm font-medium transition-colors border-l border-gray-200 dark:border-gray-700 ${
              filterMode === "incumbent"
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:bg-gray-50 dark:text-gray-400"
            }`}
          >
            {t("incumbentParties")}
          </button>
        </div>
        <button
          onClick={clearSelection}
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          {t("clearSelection")}
        </button>
      </div>

      {/* Party grid */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {parties.map((party) => {
          const isSelected = selectedIds.has(party.id);
          return (
            <button
              key={party.id}
              onClick={() => toggleParty(party.id)}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                isSelected
                  ? "border-blue-500 bg-blue-50/50 dark:border-blue-400 dark:bg-blue-950/20"
                  : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900"
              }`}
            >
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full shrink-0 ${
                  isSelected
                    ? "bg-blue-500 text-white"
                    : "border-2 border-gray-300 dark:border-gray-600"
                }`}
              >
                {isSelected && <MdCheckCircle className="h-4 w-4" />}
              </div>
              <PartyAvatar name={party.name} size="sm" />
              <span className="text-sm font-medium truncate">{party.name}</span>
            </button>
          );
        })}
      </div>

      {/* Validation + proceed */}
      <div className="flex items-center justify-between pt-2">
        {!isValid && (
          <p className="text-sm text-red-500">{t("selectAtLeast")}</p>
        )}
        <div className="ml-auto">
          <Button
            onClick={proceed}
            disabled={!isValid}
            className="rounded-xl bg-blue-600 px-6 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {t("nextStep")} →
          </Button>
        </div>
      </div>
    </div>
  );
}
