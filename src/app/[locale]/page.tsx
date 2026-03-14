"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";

interface Municipality {
  id: string;
  name: string;
  slug: string;
  numParties: number;
  numStatements: number;
}

export default function HomePage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [query, setQuery] = useState("");
  const [filtered, setFiltered] = useState<Municipality[]>([]);

  useEffect(() => {
    fetch("/data/index.json")
      .then((r) => r.json())
      .then((data: Municipality[]) => {
        setMunicipalities(data);
        setFiltered(data);
      });
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setFiltered(municipalities);
    } else {
      const q = query.toLowerCase();
      setFiltered(
        municipalities.filter(
          (m) => m.name.toLowerCase().includes(q) || m.slug.includes(q)
        )
      );
    }
  }, [query, municipalities]);

  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t("home.title")}
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          {t("home.subtitle")}
        </p>
        <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
          {t("home.electionDate")}
        </p>
      </div>

      <div className="mx-auto max-w-md">
        <Input
          type="search"
          placeholder={t("home.searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="text-lg h-12"
          autoFocus
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.slice(0, query ? 258 : 30).map((m) => (
          <Card
            key={m.slug}
            className="cursor-pointer transition-shadow hover:shadow-md"
            onClick={() =>
              router.push(`/${locale}/${m.slug}/questionnaire`)
            }
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-base">{m.name}</h2>
                <Button variant="ghost" size="sm" className="text-xs">
                  {t("home.startQuestionnaire")} →
                </Button>
              </div>
              <div className="mt-2 flex gap-2">
                <Badge variant="secondary">
                  {m.numParties} {t("home.parties")}
                </Badge>
                <Badge variant="outline">
                  {m.numStatements} {t("home.questions")}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!query && filtered.length > 30 && (
        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => setQuery(" ")}
            className="text-sm"
          >
            {t("home.browseAll")} ({municipalities.length})
          </Button>
        </div>
      )}
    </div>
  );
}
