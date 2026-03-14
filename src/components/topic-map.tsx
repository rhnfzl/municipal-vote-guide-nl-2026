"use client";

import { useEffect, useState, useMemo } from "react";
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

const COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#ca8a04", "#7c3aed", "#db2777",
  "#0891b2", "#ea580c", "#0d9488", "#4f46e5", "#65a30d", "#be123c",
  "#0284c7", "#9333ea", "#c026d3", "#4d7c0f", "#115e59", "#b91c1c",
];

export function TopicMap({ locale }: { locale: string }) {
  const [coords, setCoords] = useState<Coordinate[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState<number | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<Coordinate | null>(null);
  const [viewBox, setViewBox] = useState({ x: -8, y: -10, w: 28, h: 32 });

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
    if (selectedTopic === null) return coords.filter(c => c.topic !== -1);
    return coords.filter((c) => c.topic === selectedTopic);
  }, [coords, selectedTopic]);

  const topTopics = useMemo(() =>
    [...topics].sort((a, b) => b.count - a.count).slice(0, 10),
    [topics]
  );

  if (loading) return <Skeleton className="h-96 rounded-xl" />;
  if (!coords.length) return null;

  // Map coordinates to SVG space
  const mapX = (x: number) => ((x - viewBox.x) / viewBox.w) * 800;
  const mapY = (y: number) => ((y - viewBox.y) / viewBox.h) * 500;

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        {locale === "en"
          ? "Each dot = a political statement. Colors = topic clusters. Click a topic to filter. Hover dots for details."
          : "Elke stip = een politieke stelling. Kleuren = thema-clusters. Klik een thema om te filteren."}
      </p>

      {/* Topic legend */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setSelectedTopic(null)}
          className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
            selectedTopic === null ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "bg-gray-100 text-gray-600 dark:bg-gray-800"
          }`}
        >
          {locale === "en" ? "All" : "Alle"} ({coords.filter(c => c.topic !== -1).length})
        </button>
        {topTopics.map((topic, i) => (
          <button
            key={topic.id}
            onClick={() => setSelectedTopic(selectedTopic === topic.id ? null : topic.id)}
            className="rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors flex items-center gap-1"
            style={{
              backgroundColor: selectedTopic === topic.id ? COLORS[i % COLORS.length] : undefined,
              color: selectedTopic === topic.id ? "white" : undefined,
            }}
          >
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            {topic.label.split(" | ")[0]} ({topic.count})
          </button>
        ))}
      </div>

      {/* Interactive SVG scatter plot */}
      <div className="relative rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950 overflow-hidden">
        <svg viewBox="0 0 800 500" className="w-full h-auto" style={{ maxHeight: "500px" }}>
          {/* Grid lines */}
          {[0, 200, 400, 600, 800].map(x => (
            <line key={`gx${x}`} x1={x} y1={0} x2={x} y2={500} stroke="#f3f4f6" strokeWidth={0.5} />
          ))}
          {[0, 125, 250, 375, 500].map(y => (
            <line key={`gy${y}`} x1={0} y1={y} x2={800} y2={y} stroke="#f3f4f6" strokeWidth={0.5} />
          ))}

          {/* Points */}
          {filteredCoords.map((point, i) => {
            const topicIdx = topTopics.findIndex(t => t.id === point.topic);
            const color = topicIdx >= 0 ? COLORS[topicIdx % COLORS.length] : "#94a3b8";
            return (
              <circle
                key={i}
                cx={mapX(point.x)}
                cy={mapY(point.y)}
                r={hoveredPoint === point ? 6 : 3.5}
                fill={color}
                fillOpacity={0.7}
                stroke={hoveredPoint === point ? "#000" : "none"}
                strokeWidth={1}
                onMouseEnter={() => setHoveredPoint(point)}
                onMouseLeave={() => setHoveredPoint(null)}
                style={{ cursor: "pointer" }}
              />
            );
          })}

          {/* Hover tooltip */}
          {hoveredPoint && (
            <foreignObject
              x={Math.min(mapX(hoveredPoint.x) + 10, 550)}
              y={Math.max(mapY(hoveredPoint.y) - 60, 5)}
              width={240}
              height={55}
            >
              <div className="rounded-md border bg-white p-2 text-[10px] shadow-md dark:bg-gray-900 dark:border-gray-700">
                <p className="font-semibold leading-tight line-clamp-2">{hoveredPoint.title}</p>
                <p className="text-gray-400 mt-0.5">{hoveredPoint.theme}</p>
              </div>
            </foreignObject>
          )}
        </svg>
      </div>
    </div>
  );
}
