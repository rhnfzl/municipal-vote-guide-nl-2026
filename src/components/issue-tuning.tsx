"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Statement, ThemeWeight } from "@/lib/types";

interface IssueTuningProps {
  statements: Statement[];
  weights: ThemeWeight[];
  onWeightsChange: (weights: ThemeWeight[]) => void;
  locale: string;
}

export function IssueTuning({
  statements,
  weights,
  onWeightsChange,
  locale,
}: IssueTuningProps) {
  const themes = [
    ...new Map(
      statements.map((s) => [
        s.themeId,
        { themeId: s.themeId, theme: locale === "en" && s.themeEn ? s.themeEn : s.theme },
      ])
    ).values(),
  ];

  const weightMap = new Map(weights.map((w) => [w.themeId, w.weight]));

  function cycleWeight(themeId: string) {
    const current = weightMap.get(themeId) || 1;
    const next = current >= 3 ? 1 : current + 1;
    const updated = weights.filter((w) => w.themeId !== themeId);
    if (next > 1) updated.push({ themeId, weight: next });
    onWeightsChange(updated);
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {locale === "en" ? "Tune your results" : "Stem je resultaten af"}
        </h3>
        {weights.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => onWeightsChange([])}
          >
            {locale === "en" ? "Reset" : "Reset"}
          </Button>
        )}
      </div>
      <p className="text-xs text-gray-500">
        {locale === "en"
          ? "Tap a topic to increase its weight (1x → 2x → 3x). Important topics count more in your results."
          : "Tik op een onderwerp om het gewicht te verhogen (1x → 2x → 3x). Belangrijke onderwerpen tellen zwaarder mee."}
      </p>
      <div className="flex flex-wrap gap-2">
        {themes.map(({ themeId, theme }) => {
          const w = weightMap.get(themeId) || 1;
          return (
            <Badge
              key={themeId}
              variant={w > 1 ? "default" : "outline"}
              className={`cursor-pointer transition-all text-xs ${
                w === 3
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : w === 2
                    ? "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
              onClick={() => cycleWeight(themeId)}
            >
              {theme} {w > 1 && `(${w}x)`}
            </Badge>
          );
        })}
      </div>
    </div>
  );
}
