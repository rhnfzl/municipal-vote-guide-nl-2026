"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface Topic {
  id: number;
  label: string;
  count: number;
}

interface Similarity {
  topicIds: number[];
  matrix: number[][];
}

const COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899",
  "#06b6d4", "#f97316", "#14b8a6", "#6366f1", "#84cc16", "#e11d48",
];

export function TopicNetwork({ locale }: { locale: string }) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [similarity, setSimilarity] = useState<Similarity | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredTopic, setHoveredTopic] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/data/topics/${locale === "en" ? "topics_en" : "topics"}.json`).then((r) => r.json()),
      fetch("/data/topics/similarity.json").then((r) => r.json()),
    ]).then(([t, s]) => {
      setTopics(t);
      setSimilarity(s);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [locale]);

  // Layout: arrange top N topics in a circle
  const networkData = useMemo(() => {
    if (!topics.length || !similarity?.matrix?.length) return { nodes: [], edges: [] };

    const topN = topics
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const centerX = 300;
    const centerY = 250;
    const radius = 180;

    const nodes = topN.map((topic, i) => {
      const angle = (2 * Math.PI * i) / topN.length - Math.PI / 2;
      const nodeRadius = Math.max(8, Math.min(30, Math.sqrt(topic.count) * 2));
      return {
        id: topic.id,
        label: topic.label.split(" | ")[0],
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        r: nodeRadius,
        count: topic.count,
        color: COLORS[i % COLORS.length],
      };
    });

    // Build edges from similarity matrix
    const edges: { source: number; target: number; weight: number }[] = [];
    const idToIndex = new Map(similarity.topicIds.map((id, i) => [id, i]));

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const srcIdx = idToIndex.get(nodes[i].id);
        const tgtIdx = idToIndex.get(nodes[j].id);
        if (srcIdx === undefined || tgtIdx === undefined) continue;
        if (srcIdx >= similarity.matrix.length || tgtIdx >= similarity.matrix.length) continue;

        const sim = similarity.matrix[srcIdx][tgtIdx];
        if (sim > 0.4) {
          edges.push({
            source: i,
            target: j,
            weight: sim,
          });
        }
      }
    }

    return { nodes, edges };
  }, [topics, similarity]);

  if (loading) return <Skeleton className="h-96 rounded-xl" />;
  if (!networkData.nodes.length) return <p className="text-sm text-gray-400 text-center py-8">No network data available.</p>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        {locale === "en"
          ? "Top 20 topic clusters shown as a network. Connected nodes share similar political themes. Larger circles = more statements."
          : "Top 20 thema-clusters als netwerk. Verbonden knooppunten delen vergelijkbare politieke thema's. Grotere cirkels = meer stellingen."}
      </p>

      <div className="rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
        <svg
          ref={svgRef}
          viewBox="0 0 600 500"
          className="w-full h-auto"
          style={{ maxHeight: "500px" }}
        >
          {/* Edges */}
          {networkData.edges.map((edge, i) => {
            const src = networkData.nodes[edge.source];
            const tgt = networkData.nodes[edge.target];
            const isHighlighted =
              hoveredTopic === src.id || hoveredTopic === tgt.id;
            return (
              <line
                key={`edge-${i}`}
                x1={src.x}
                y1={src.y}
                x2={tgt.x}
                y2={tgt.y}
                stroke={isHighlighted ? "#3b82f6" : "#d1d5db"}
                strokeWidth={isHighlighted ? 2 : Math.max(0.5, edge.weight * 2)}
                strokeOpacity={isHighlighted ? 0.8 : 0.3}
              />
            );
          })}

          {/* Nodes */}
          {networkData.nodes.map((node) => {
            const isHovered = hoveredTopic === node.id;
            return (
              <g
                key={node.id}
                onMouseEnter={() => setHoveredTopic(node.id)}
                onMouseLeave={() => setHoveredTopic(null)}
                style={{ cursor: "pointer" }}
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isHovered ? node.r + 3 : node.r}
                  fill={node.color}
                  fillOpacity={isHovered ? 1 : 0.75}
                  stroke={isHovered ? "#1e40af" : "white"}
                  strokeWidth={isHovered ? 2 : 1}
                />
                {node.r > 12 && (
                  <text
                    x={node.x}
                    y={node.y + node.r + 14}
                    textAnchor="middle"
                    fontSize={9}
                    fill={isHovered ? "#1e40af" : "#6b7280"}
                    fontWeight={isHovered ? "bold" : "normal"}
                  >
                    {node.label.substring(0, 15)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Hover tooltip */}
          {hoveredTopic !== null && (() => {
            const node = networkData.nodes.find((n) => n.id === hoveredTopic);
            if (!node) return null;
            return (
              <g>
                <rect
                  x={node.x + node.r + 8}
                  y={node.y - 20}
                  width={160}
                  height={40}
                  rx={6}
                  fill="white"
                  stroke="#e5e7eb"
                  strokeWidth={1}
                />
                <text x={node.x + node.r + 14} y={node.y - 4} fontSize={11} fontWeight="bold" fill="#111">
                  {node.label}
                </text>
                <text x={node.x + node.r + 14} y={node.y + 12} fontSize={10} fill="#6b7280">
                  {node.count} {locale === "en" ? "statements" : "stellingen"}
                </text>
              </g>
            );
          })()}
        </svg>
      </div>
    </div>
  );
}
