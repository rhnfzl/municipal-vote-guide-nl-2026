"use client";

import { useEffect, useState, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface Topic {
  id: number;
  label: string;
  count: number;
  keywords: { word: string; score: number }[];
  topThemes: { theme: string; count: number }[];
}

// Muted, accessible color palette
const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899",
  "#06b6d4", "#f97316", "#6366f1", "#84cc16", "#ef4444",
  "#14b8a6", "#a855f7", "#d946ef", "#22c55e", "#e11d48",
  "#0891b2", "#65a30d", "#7c3aed", "#0d9488", "#dc2626",
];

export function TopicHierarchy({ locale }: { locale: string }) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredTopic, setHoveredTopic] = useState<Topic | null>(null);

  useEffect(() => {
    fetch(`/data/topics/${locale === "en" ? "topics_en" : "topics"}.json`)
      .then((r) => r.json())
      .then(setTopics)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locale]);

  const sortedTopics = useMemo(() =>
    [...topics].filter(t => t.count >= 10).sort((a, b) => b.count - a.count).slice(0, 25),
    [topics]
  );

  if (loading) return <Skeleton className="h-96 rounded-xl" />;
  if (!sortedTopics.length) return null;

  const maxCount = sortedTopics[0]?.count || 1;

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        {locale === "en"
          ? "Top 25 topic clusters. Wider bars = more statements. Click for details."
          : "Top 25 thema-clusters. Bredere balken = meer stellingen. Klik voor details."}
      </p>

      {/* Horizontal bar chart — cleaner than treemap */}
      <div className="space-y-1.5">
        {sortedTopics.map((topic, i) => {
          const widthPct = (topic.count / maxCount) * 100;
          const label = topic.label.split(" | ")[0];
          const isHovered = hoveredTopic?.id === topic.id;

          return (
            <div
              key={topic.id}
              className="group cursor-pointer"
              onMouseEnter={() => setHoveredTopic(topic)}
              onMouseLeave={() => setHoveredTopic(null)}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 w-5 text-right shrink-0">{i + 1}</span>
                <div className="flex-1 relative">
                  <div
                    className="h-7 rounded-md transition-all duration-300 flex items-center px-2"
                    style={{
                      width: `${Math.max(widthPct, 8)}%`,
                      backgroundColor: COLORS[i % COLORS.length],
                      opacity: isHovered ? 1 : 0.8,
                    }}
                  >
                    <span className="text-[11px] font-medium text-white truncate">
                      {label}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-gray-500 w-10 text-right shrink-0">{topic.count}</span>
              </div>

              {/* Expanded details on hover */}
              {isHovered && (
                <div className="ml-7 mt-1 mb-2 rounded-md bg-gray-50 p-2.5 text-[10px] dark:bg-gray-900">
                  <p className="font-semibold">{topic.label}</p>
                  <p className="text-gray-500 mt-0.5">
                    {topic.count} {locale === "en" ? "statements" : "stellingen"} ·{" "}
                    {locale === "en" ? "Keywords" : "Trefwoorden"}: {topic.keywords.slice(0, 5).map(k => k.word).join(", ")}
                  </p>
                  {topic.topThemes.length > 0 && (
                    <p className="text-gray-400 mt-0.5">
                      {locale === "en" ? "Related themes" : "Gerelateerde thema's"}: {topic.topThemes.slice(0, 3).map(t => t.theme).join(", ")}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
