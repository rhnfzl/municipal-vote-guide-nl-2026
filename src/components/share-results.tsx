"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { PartyMatch } from "@/lib/types";

interface ShareResultsProps {
  matches: PartyMatch[];
  municipality: string;
  locale: string;
}

const formats = [
  { key: "twitter", label: "Twitter/X (16:9)", ratio: "1200x675" },
  { key: "story", label: "Stories (9:16)", ratio: "1080x1920" },
  { key: "square", label: "Square (1:1)", ratio: "1080x1080" },
  { key: "linkedin", label: "LinkedIn (1.91:1)", ratio: "1200x628" },
] as const;

export function ShareResults({ matches, municipality, locale }: ShareResultsProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const top5 = matches.filter((m) => !m.isEliminated).slice(0, 5);
  const matchParam = top5
    .map((m) => `${encodeURIComponent(m.partyName)}:${m.matchPercentage}`)
    .join(",");

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  function getImageUrl(format: string) {
    return `${baseUrl}/api/og?municipality=${encodeURIComponent(municipality)}&matches=${matchParam}&format=${format}`;
  }

  async function copyLink() {
    const url = `${baseUrl}/${locale}/${municipality.toLowerCase().replace(/\s+/g, "-")}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function shareNative() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `My Vote Match - ${municipality}`,
          text: `My top match is ${top5[0]?.partyName} (${top5[0]?.matchPercentage}%)!`,
          url: window.location.href,
        });
      } catch {}
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2">
        {locale === "en" ? "Share Results" : "Deel Resultaten"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {locale === "en" ? "Share Your Results" : "Deel Jouw Resultaten"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              {locale === "en"
                ? "Download an image for your preferred platform:"
                : "Download een afbeelding voor jouw platform:"}
            </p>

            <div className="grid grid-cols-2 gap-2">
              {formats.map((fmt) => (
                <a
                  key={fmt.key}
                  href={getImageUrl(fmt.key)}
                  target="_blank"
                  rel="noopener"
                  className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                >
                  <span className="font-medium">{fmt.label}</span>
                  <Badge variant="outline" className="text-xs">
                    {fmt.ratio}
                  </Badge>
                </a>
              ))}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={copyLink}>
                {copied
                  ? locale === "en" ? "Copied!" : "Gekopieerd!"
                  : locale === "en" ? "Copy Link" : "Kopieer Link"}
              </Button>
              {typeof navigator !== "undefined" && "share" in navigator && (
                <Button variant="outline" className="flex-1" onClick={shareNative}>
                  {locale === "en" ? "Share..." : "Delen..."}
                </Button>
              )}
            </div>

            <p className="text-xs text-center text-gray-400">
              municipal-vote-guide-nl-2026
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
