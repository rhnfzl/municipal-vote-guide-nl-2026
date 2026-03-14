"use client";

import { useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface NationalStats {
  totalMunicipalities: number;
  withOfficialEnglish: number;
  topThemes: [string, number][];
  topParties: [string, number][];
}

export default function ExplorePage() {
  const locale = useLocale();
  const [stats, setStats] = useState<NationalStats | null>(null);

  useEffect(() => {
    fetch("/data/national/stats.json")
      .then((r) => r.json())
      .then(setStats);
  }, []);

  if (!stats) return <p className="text-center py-20 text-gray-500">Loading...</p>;

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold sm:text-3xl">
          {locale === "en" ? "Explore All Municipalities" : "Verken Alle Gemeenten"}
        </h1>
        <p className="text-gray-500">
          {locale === "en"
            ? `Data from ${stats.totalMunicipalities} Dutch municipalities`
            : `Gegevens van ${stats.totalMunicipalities} Nederlandse gemeenten`}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Themes */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4">
              {locale === "en" ? "Most Common Themes" : "Meest Voorkomende Thema's"}
            </h2>
            <div className="space-y-2">
              {stats.topThemes.slice(0, 15).map(([theme, count], i) => (
                <div key={theme} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-gray-400 w-6">{i + 1}.</span>
                    <span className="text-sm">{theme}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {count}x
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Parties */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4">
              {locale === "en" ? "Most Common Parties Nationally" : "Meest Voorkomende Partijen Landelijk"}
            </h2>
            <div className="space-y-2">
              {stats.topParties.slice(0, 15).map(([party, count], i) => (
                <div key={party} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-gray-400 w-6">{i + 1}.</span>
                    <span className="text-sm">{party}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {count}/{stats.totalMunicipalities}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
