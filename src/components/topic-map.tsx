"use client";

import { useEffect, useState, useMemo } from "react";
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface Coordinate {
  x: number;
  y: number;
  topic: number;
  title: string;
  theme: string;
}

interface Topic {
  id: number;
  label: string;
  count: number;
}

const TOPIC_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899",
  "#06b6d4", "#f97316", "#14b8a6", "#6366f1", "#84cc16", "#e11d48",
  "#0891b2", "#a855f7", "#d946ef", "#65a30d", "#0d9488", "#dc2626",
  "#7c3aed", "#059669", "#ca8a04", "#9333ea", "#2563eb", "#16a34a",
];

export function TopicMap({ locale }: { locale: string }) {
  const [coords, setCoords] = useState<Coordinate[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/data/topics/coordinates.json").then((r) => r.json()),
      fetch(`/data/topics/${locale === "en" ? "topics_en" : "topics"}.json`).then((r) => r.json()),
    ]).then(([c, t]) => {
      setCoords(c);
      setTopics(t);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [locale]);

  const filteredCoords = useMemo(() => {
    if (selectedTopic === null) return coords;
    return coords.filter((c) => c.topic === selectedTopic);
  }, [coords, selectedTopic]);

  // Top 12 topics for legend
  const topTopics = useMemo(() =>
    [...topics].sort((a, b) => b.count - a.count).slice(0, 12),
    [topics]
  );

  if (loading) return <Skeleton className="h-96 rounded-xl" />;
  if (!coords.length) return <p className="text-sm text-gray-400 text-center py-8">No topic data available.</p>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        {locale === "en"
          ? "Each dot represents a political statement. Colors show discovered topic clusters. Hover to see details."
          : "Elke stip vertegenwoordigt een politieke stelling. Kleuren tonen ontdekte thema-clusters. Hover voor details."}
      </p>

      {/* Topic legend / filter */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setSelectedTopic(null)}
          className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
            selectedTopic === null
              ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
          }`}
        >
          {locale === "en" ? "All topics" : "Alle thema's"} ({coords.length})
        </button>
        {topTopics.map((topic, i) => (
          <button
            key={topic.id}
            onClick={() => setSelectedTopic(selectedTopic === topic.id ? null : topic.id)}
            className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
              selectedTopic === topic.id
                ? "text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
            }`}
            style={selectedTopic === topic.id ? { backgroundColor: TOPIC_COLORS[i % TOPIC_COLORS.length] } : {}}
          >
            {topic.label.split(" | ")[0]} ({topic.count})
          </button>
        ))}
      </div>

      {/* Scatter plot */}
      <div className="h-96">
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <XAxis type="number" dataKey="x" tick={false} axisLine={false} />
            <YAxis type="number" dataKey="y" tick={false} axisLine={false} />
            <Tooltip
              content={({ payload }) => {
                if (!payload?.[0]) return null;
                const d = payload[0].payload as Coordinate;
                return (
                  <div className="max-w-xs rounded-lg border bg-white p-3 text-xs shadow-lg dark:bg-gray-900 dark:border-gray-700">
                    <p className="font-semibold leading-snug">{d.title}</p>
                    <p className="mt-1 text-gray-500">{d.theme}</p>
                  </div>
                );
              }}
            />
            <Scatter data={filteredCoords} r={3} fillOpacity={0.7}>
              {filteredCoords.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.topic === -1 ? "#d1d5db" : TOPIC_COLORS[(entry.topic) % TOPIC_COLORS.length]}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
