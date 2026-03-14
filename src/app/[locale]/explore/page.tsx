"use client";

import { useTranslations, useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

interface NationalStats {
  totalMunicipalities: number;
  withOfficialEnglish: number;
  topThemes: [string, number][];
  topParties: [string, number][];
}

const COLORS = [
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#14b8a6", "#06b6d4", "#0ea5e9", "#6366f1",
];

export default function ExplorePage() {
  const t = useTranslations("explore");
  const locale = useLocale();
  const [stats, setStats] = useState<NationalStats | null>(null);

  useEffect(() => {
    fetch("/data/national/stats.json")
      .then((r) => r.json())
      .then(setStats);
  }, []);

  if (!stats) {
    return (
      <div className="space-y-6" aria-live="polite">
        <Skeleton className="h-10 w-80 mx-auto" />
        <Skeleton className="h-6 w-60 mx-auto" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  const themeData = stats.topThemes.slice(0, 12).map(([name, count]) => ({ name, count }));
  const partyData = stats.topParties.slice(0, 12).map(([name, count]) => ({ name, count }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {t("title")}
        </h1>
        <p className="text-gray-500">
          {t("subtitle", { count: stats.totalMunicipalities })}
        </p>
        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
          {t("stats", {
            municipalities: stats.totalMunicipalities,
            parties: "2,446",
            statements: "7,742",
          })}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Themes Chart */}
        <Card className="overflow-hidden rounded-2xl border-0 shadow-md">
          <CardContent className="p-5">
            <h2 className="mb-4 text-lg font-semibold">{t("topThemes")}</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={themeData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => [`${value} municipalities`, "Appears in"]}
                    contentStyle={{ borderRadius: 8, fontSize: 13 }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {themeData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Parties Chart */}
        <Card className="overflow-hidden rounded-2xl border-0 shadow-md">
          <CardContent className="p-5">
            <h2 className="mb-4 text-lg font-semibold">{t("topParties")}</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={partyData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => [
                      `${value}/${stats.totalMunicipalities} municipalities`,
                      "Present in",
                    ]}
                    contentStyle={{ borderRadius: 8, fontSize: 13 }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {partyData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
