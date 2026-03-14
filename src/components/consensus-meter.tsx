"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { MdCheckCircle, MdWarning } from "@/components/icons";
import type { MunicipalityData } from "@/lib/types";

interface ConsensusMeterProps {
  data: MunicipalityData;
  locale: string;
}

interface TopicConsensus {
  theme: string;
  statementTitle: string;
  agreeCount: number;
  disagreeCount: number;
  neitherCount: number;
  totalParties: number;
  consensusScore: number; // 0-100, higher = more consensus
  dominantPosition: "agree" | "disagree" | "mixed";
}

export function ConsensusMeter({ data, locale }: ConsensusMeterProps) {
  const topics = useMemo(() => {
    const results: TopicConsensus[] = [];
    const participatingParties = data.parties.filter((p) => p.participates);

    for (const stmt of data.statements) {
      let agreeCount = 0;
      let disagreeCount = 0;
      let neitherCount = 0;

      for (const party of participatingParties) {
        const pos = party.positions[stmt.id];
        if (!pos) continue;
        if (pos.position === "agree") agreeCount++;
        else if (pos.position === "disagree") disagreeCount++;
        else neitherCount++;
      }

      const total = agreeCount + disagreeCount + neitherCount;
      if (total === 0) continue;

      const maxSide = Math.max(agreeCount, disagreeCount);
      const consensusScore = Math.round((maxSide / total) * 100);
      const dominantPosition = agreeCount > disagreeCount ? "agree" as const :
        disagreeCount > agreeCount ? "disagree" as const : "mixed" as const;

      results.push({
        theme: stmt.theme,
        statementTitle: stmt.title,
        agreeCount,
        disagreeCount,
        neitherCount,
        totalParties: total,
        consensusScore,
        dominantPosition,
      });
    }

    return results.sort((a, b) => b.consensusScore - a.consensusScore);
  }, [data]);

  const mostConsensus = topics.slice(0, 3);
  const mostDivisive = [...topics].sort((a, b) => a.consensusScore - b.consensusScore).slice(0, 3);

  return (
    <details className="rounded-xl border border-gray-200 dark:border-gray-800">
      <summary className="cursor-pointer p-4 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 flex items-center gap-2">
        <MdWarning className="h-5 w-5" />
        {locale === "en" ? "Topic Insights: Consensus vs. Divisive" : "Thema-inzichten: Consensus vs. Verdeeld"}
      </summary>
      <div className="px-4 pb-4 space-y-4">
        <p className="text-xs text-gray-500">
          {locale === "en"
            ? "See which topics most parties agree on and which ones divide them the most."
            : "Bekijk over welke onderwerpen de meeste partijen het eens zijn en welke het meest verdeeld zijn."}
        </p>

        {/* Most Consensus */}
        <div>
          <h4 className="text-xs font-semibold text-green-700 dark:text-green-400 mb-2 flex items-center gap-1">
            <MdCheckCircle className="h-3.5 w-3.5" />
            {locale === "en" ? "Most Consensus" : "Meeste Consensus"}
          </h4>
          <div className="space-y-2">
            {mostConsensus.map((topic) => (
              <div key={topic.theme} className="flex items-center gap-3 rounded-lg bg-green-50 p-2.5 dark:bg-green-950/20">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{topic.theme}</p>
                  <p className="text-[10px] text-gray-500">
                    {topic.agreeCount} {locale === "en" ? "agree" : "eens"} · {topic.disagreeCount} {locale === "en" ? "disagree" : "oneens"}
                  </p>
                </div>
                <span className="text-sm font-bold text-green-600 shrink-0">{topic.consensusScore}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Most Divisive */}
        <div>
          <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1">
            <MdWarning className="h-3.5 w-3.5" />
            {locale === "en" ? "Most Divisive" : "Meest Verdeeld"}
          </h4>
          <div className="space-y-2">
            {mostDivisive.map((topic) => (
              <div key={topic.theme} className="flex items-center gap-3 rounded-lg bg-amber-50 p-2.5 dark:bg-amber-950/20">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{topic.theme}</p>
                  <p className="text-[10px] text-gray-500">
                    {topic.agreeCount} {locale === "en" ? "agree" : "eens"} · {topic.disagreeCount} {locale === "en" ? "disagree" : "oneens"}
                  </p>
                </div>
                <span className="text-sm font-bold text-amber-600 shrink-0">{topic.consensusScore}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </details>
  );
}
