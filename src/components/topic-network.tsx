"use client";

import { useEffect, useState, useMemo } from "react";
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
  "#0891b2", "#a855f7", "#d946ef", "#65a30d",
];

export function TopicNetwork({ locale }: { locale: string }) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [similarity, setSimilarity] = useState<Similarity | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredTopic, setHoveredTopic] = useState<number | null>(null);

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

  const networkData = useMemo(() => {
    if (!topics.length || !similarity?.matrix?.length) return { nodes: [], edges: [] };

    const topN = [...topics].sort((a, b) => b.count - a.count).slice(0, 16);
    const cx = 350, cy = 280, radius = 200;

    const nodes = topN.map((topic, i) => {
      const angle = (2 * Math.PI * i) / topN.length - Math.PI / 2;
      const r = Math.max(12, Math.min(35, Math.sqrt(topic.count) * 2.5));
      return {
        id: topic.id, label: topic.label.split(" | ")[0],
        x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle),
        r, count: topic.count, color: COLORS[i % COLORS.length],
      };
    });

    // Only show edges with similarity > 0.6 (stronger connections only)
    const edges: { src: number; tgt: number; weight: number }[] = [];
    const idToIdx = new Map(similarity.topicIds.map((id, i) => [id, i]));

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const si = idToIdx.get(nodes[i].id);
        const sj = idToIdx.get(nodes[j].id);
        if (si === undefined || sj === undefined) continue;
        if (si >= similarity.matrix.length || sj >= similarity.matrix.length) continue;

        const sim = similarity.matrix[si][sj];
        if (sim > 0.6) {  // Higher threshold = fewer, more meaningful connections
          edges.push({ src: i, tgt: j, weight: sim });
        }
      }
    }

    return { nodes, edges };
  }, [topics, similarity]);

  if (loading) return <Skeleton className="h-[500px] rounded-xl" />;
  if (!networkData.nodes.length) return null;

  // Get edges connected to hovered node
  const hoveredEdges = hoveredTopic !== null
    ? networkData.edges.filter(e =>
        networkData.nodes[e.src].id === hoveredTopic ||
        networkData.nodes[e.tgt].id === hoveredTopic
      )
    : [];

  const connectedNodeIds = new Set(
    hoveredEdges.flatMap(e => [networkData.nodes[e.src].id, networkData.nodes[e.tgt].id])
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        {locale === "en"
          ? "Top 16 topics as a network. Hover a node to see connections. Thicker lines = stronger similarity. Only strong connections shown (>60%)."
          : "Top 16 thema's als netwerk. Hover over een knooppunt om verbindingen te zien. Dikkere lijnen = sterkere overeenkomst."}
      </p>

      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950 overflow-hidden">
        <svg viewBox="0 0 700 560" className="w-full h-auto" style={{ maxHeight: "560px" }}>
          {/* Edges — only show when hovering or always show faintly */}
          {networkData.edges.map((edge, i) => {
            const src = networkData.nodes[edge.src];
            const tgt = networkData.nodes[edge.tgt];
            const isConnected = hoveredTopic !== null && (src.id === hoveredTopic || tgt.id === hoveredTopic);
            const opacity = hoveredTopic === null ? 0.15 : isConnected ? 0.6 : 0.05;
            const width = isConnected ? Math.max(1.5, (edge.weight - 0.5) * 8) : 0.5;

            return (
              <g key={`edge-${i}`}>
                <line
                  x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                  stroke={isConnected ? "#3b82f6" : "#d1d5db"}
                  strokeWidth={width}
                  strokeOpacity={opacity}
                />
                {/* Show similarity % on hovered edges */}
                {isConnected && (
                  <text
                    x={(src.x + tgt.x) / 2}
                    y={(src.y + tgt.y) / 2 - 5}
                    textAnchor="middle"
                    fontSize={9}
                    fill="#3b82f6"
                    fontWeight="bold"
                  >
                    {Math.round(edge.weight * 100)}%
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {networkData.nodes.map((node) => {
            const isHovered = hoveredTopic === node.id;
            const isConnected = connectedNodeIds.has(node.id);
            const dimmed = hoveredTopic !== null && !isHovered && !isConnected;

            return (
              <g
                key={node.id}
                onMouseEnter={() => setHoveredTopic(node.id)}
                onMouseLeave={() => setHoveredTopic(null)}
                style={{ cursor: "pointer" }}
                opacity={dimmed ? 0.3 : 1}
              >
                <circle
                  cx={node.x} cy={node.y}
                  r={isHovered ? node.r + 4 : node.r}
                  fill={node.color}
                  fillOpacity={isHovered ? 1 : 0.8}
                  stroke={isHovered ? "#000" : "white"}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                />
                {/* Label */}
                <text
                  x={node.x}
                  y={node.y + node.r + 14}
                  textAnchor="middle"
                  fontSize={isHovered ? 11 : 9}
                  fill={isHovered ? "#111" : "#9ca3af"}
                  fontWeight={isHovered ? "bold" : "normal"}
                >
                  {node.label.substring(0, 18)}
                </text>
                {/* Count inside circle */}
                {node.r > 18 && (
                  <text
                    x={node.x}
                    y={node.y + 4}
                    textAnchor="middle"
                    fontSize={10}
                    fill="white"
                    fontWeight="bold"
                  >
                    {node.count}
                  </text>
                )}
              </g>
            );
          })}

          {/* Hover detail card */}
          {hoveredTopic !== null && (() => {
            const node = networkData.nodes.find(n => n.id === hoveredTopic);
            if (!node) return null;
            const connections = hoveredEdges.length;
            return (
              <foreignObject x={10} y={10} width={220} height={60}>
                <div className="rounded-lg border bg-white p-2 text-[10px] shadow-md dark:bg-gray-900 dark:border-gray-700">
                  <p className="font-bold">{node.label}</p>
                  <p className="text-gray-500">
                    {node.count} {locale === "en" ? "statements" : "stellingen"} · {connections} {locale === "en" ? "connections" : "verbindingen"}
                  </p>
                </div>
              </foreignObject>
            );
          })()}
        </svg>
      </div>
    </div>
  );
}
