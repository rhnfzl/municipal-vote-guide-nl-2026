"use client";

import { useState } from "react";
import type { TitlePart } from "@/lib/types";
import { MdInfo } from "@/components/icons";

interface GlossaryTitleProps {
  titleParts: TitlePart[];
  className?: string;
}

export function GlossaryTitle({ titleParts, className = "" }: GlossaryTitleProps) {
  const [activeGlossary, setActiveGlossary] = useState<string | null>(null);

  return (
    <span className={className}>
      {titleParts.map((part, i) => {
        if (!part.glossary) {
          return <span key={i}>{part.text}</span>;
        }

        return (
          <span key={i} className="relative inline">
            <button
              onClick={() =>
                setActiveGlossary(activeGlossary === part.text ? null : part.text)
              }
              className="border-b-2 border-dotted border-blue-400 text-inherit font-inherit cursor-help hover:border-blue-600 hover:text-blue-700 dark:border-blue-500 dark:hover:text-blue-400 transition-colors"
              aria-label={`${part.text}: ${part.glossary}`}
            >
              {part.text}
              <sup className="text-blue-400 text-[8px] ml-0.5">
                <MdInfo className="inline h-3 w-3" />
              </sup>
            </button>

            {/* Tooltip popup */}
            {activeGlossary === part.text && (
              <span className="absolute left-0 bottom-full mb-2 z-50 w-64 rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-900">
                <span className="flex items-start justify-between gap-2">
                  <span className="text-gray-600 dark:text-gray-300 leading-relaxed">
                    {part.glossary}
                  </span>
                  <button
                    onClick={() => setActiveGlossary(null)}
                    className="text-gray-400 hover:text-gray-600 shrink-0"
                  >
                    ✕
                  </button>
                </span>
                {/* Arrow */}
                <span className="absolute left-4 top-full h-0 w-0 border-x-[6px] border-t-[6px] border-x-transparent border-t-gray-200 dark:border-t-gray-700" />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
