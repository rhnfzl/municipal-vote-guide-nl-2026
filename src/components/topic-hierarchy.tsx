"use client";

import { useEffect, useState, useMemo } from "react";
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface Topic {
  id: number;
  label: string;
  count: number;
  keywords: { word: string; score: number }[];
  topThemes: { theme: string; count: number }[];
}

const COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899",
  "#06b6d4", "#f97316", "#14b8a6", "#6366f1", "#84cc16", "#e11d48",
  "#0891b2", "#a855f7", "#d946ef", "#65a30d", "#0d9488", "#dc2626",
];

export function TopicHierarchy({ locale }: { locale: string }) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/data/topics/${locale === "en" ? "topics_en" : "topics"}.json`)
      .then((r) => r.json())
      .then(setTopics)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locale]);

  const treemapData = useMemo(() => {
    if (!topics.length) return [];
    return topics
      .filter((t) => t.count >= 5)
      .sort((a, b) => b.count - a.count)
      .slice(0, 30)
      .map((topic, i) => ({
        name: topic.label.split(" | ")[0],
        size: topic.count,
        fill: COLORS[i % COLORS.length],
        keywords: topic.keywords.slice(0, 5).map((k) => k.word).join(", "),
        themes: topic.topThemes.slice(0, 3).map((t) => t.theme).join(", "),
      }));
  }, [topics]);

  if (loading) return <Skeleton className="h-96 rounded-xl" />;
  if (!treemapData.length) return <p className="text-sm text-gray-400 text-center py-8">No hierarchy data available.</p>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        {locale === "en"
          ? "Top 30 topic clusters sized by number of statements. Larger blocks = more common topics across municipalities."
          : "Top 30 thema-clusters op grootte van het aantal stellingen. Grotere blokken = vaker voorkomende thema's."}
      </p>

      <div className="h-96">
        <ResponsiveContainer>
          <Treemap
            data={treemapData}
            dataKey="size"
            nameKey="name"
            stroke="#fff"
            content={({ x, y, width, height, name, fill }) => (
              <g>
                <rect x={x} y={y} width={width} height={height} fill={fill as string} rx={4} opacity={0.85} />
                {width > 40 && height > 25 && (
                  <text x={x + 6} y={y + 16} fontSize={11} fontWeight="bold" fill="#fff">
                    {(name as string)?.substring(0, Math.floor(width / 7)) || ""}
                  </text>
                )}
              </g>
            )}
          >
            <Tooltip
              content={({ payload }) => {
                if (!payload?.[0]) return null;
                const d = payload[0].payload;
                return (
                  <div className="max-w-xs rounded-lg border bg-white p-3 text-xs shadow-lg dark:bg-gray-900 dark:border-gray-700">
                    <p className="font-bold">{d.name}</p>
                    <p className="text-gray-500 mt-1">{d.size} {locale === "en" ? "statements" : "stellingen"}</p>
                    <p className="text-gray-400 mt-1 italic">{d.keywords}</p>
                    <p className="text-gray-400 mt-0.5">{d.themes}</p>
                  </div>
                );
              }}
            />
          </Treemap>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
