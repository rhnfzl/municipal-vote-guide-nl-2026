"use client";

import { useState } from "react";
import type { TitlePart } from "@/lib/types";
import { MdInfo, MdClose } from "@/components/icons";

interface GlossaryTitleProps {
  titleParts: TitlePart[];
  className?: string;
}

export function GlossaryTitle({ titleParts, className = "" }: GlossaryTitleProps) {
  const [activeGlossary, setActiveGlossary] = useState<string | null>(null);

  const activeDefinition = activeGlossary
    ? titleParts.find((p) => p.text === activeGlossary)?.glossary
    : null;

  return (
    <span className={className}>
      {/* Render title with clickable glossary terms */}
      <span>
        {titleParts.map((part, i) => {
          if (!part.glossary) {
            return <span key={i}>{part.text}</span>;
          }

          const isActive = activeGlossary === part.text;

          return (
            <button
              key={i}
              onClick={() =>
                setActiveGlossary(isActive ? null : part.text)
              }
              className={`inline border-b-2 border-dotted cursor-help transition-colors ${
                isActive
                  ? "border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-400"
                  : "border-blue-300 hover:border-blue-500 hover:text-blue-600 dark:border-blue-600 dark:hover:text-blue-400"
              }`}
              aria-label={`${part.text}: ${part.glossary}`}
              aria-expanded={isActive}
            >
              {part.text}
              <sup className="text-blue-400 text-[8px] ml-0.5">
                <MdInfo className="inline h-2.5 w-2.5" />
              </sup>
            </button>
          );
        })}
      </span>

      {/* Definition shown BELOW the title as a clean card - no overlap */}
      {activeDefinition && (
        <span className="block mt-3 rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm font-normal dark:bg-blue-950/30 dark:border-blue-800">
          <span className="flex items-start justify-between gap-2">
            <span className="text-blue-800 dark:text-blue-300 leading-relaxed">
              <span className="font-semibold">{activeGlossary}:</span>{" "}
              {activeDefinition}
            </span>
            <button
              onClick={() => setActiveGlossary(null)}
              className="text-blue-400 hover:text-blue-600 shrink-0 mt-0.5"
              aria-label="Close"
            >
              <MdClose className="h-4 w-4" />
            </button>
          </span>
        </span>
      )}
    </span>
  );
}
