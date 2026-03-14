"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Label,
} from "recharts";
import type { MunicipalityData, UserAnswer } from "@/lib/types";

interface PoliticalCompassProps {
  data: MunicipalityData;
  answers: Record<number, UserAnswer>;
  locale: string;
}

// Simplified 2D scoring: map themes to axes
const ECONOMIC_THEMES = new Set([
  "bedrijventerreinen", "hondenbelasting", "ozb", "toeristenbelasting",
  "belasting", "economie", "ondernemers", "mkb", "bedrijven",
]);

const SOCIAL_THEMES = new Set([
  "cameratoezicht", "handhavers", "vuurwerk", "evenementen",
  "duurzaamheid", "klimaat", "groen", "milieu", "natuur",
  "referendum", "participatie", "inspraak",
]);

function computePosition(
  data: MunicipalityData,
  positionMap: Record<number, string>, // stmtId -> "agree" | "disagree" | "neither"
): { x: number; y: number } {
  let econScore = 0, econTotal = 0;
  let socialScore = 0, socialTotal = 0;

  for (const stmt of data.statements) {
    const pos = positionMap[stmt.id];
    if (!pos || pos === "skip") continue;

    const themeId = stmt.themeId.toLowerCase();
    const score = pos === "agree" ? 1 : pos === "disagree" ? -1 : 0;

    if (ECONOMIC_THEMES.has(themeId)) {
      econScore += score;
      econTotal++;
    } else if (SOCIAL_THEMES.has(themeId)) {
      socialScore += score;
      socialTotal++;
    } else {
      // Split evenly
      econScore += score * 0.5;
      econTotal += 0.5;
      socialScore += score * 0.5;
      socialTotal += 0.5;
    }
  }

  const x = econTotal > 0 ? (econScore / econTotal) * 50 : 0;
  const y = socialTotal > 0 ? (socialScore / socialTotal) * 50 : 0;

  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

export function PoliticalCompass({ data, answers, locale }: PoliticalCompassProps) {
  // Compute user position
  const userPos = computePosition(data, answers as Record<number, string>);

  // Compute party positions
  const partyData = data.parties
    .filter((p) => p.participates)
    .map((p) => {
      const posMap: Record<number, string> = {};
      for (const [sid, pos] of Object.entries(p.positions)) {
        posMap[parseInt(sid)] = pos.position;
      }
      const { x, y } = computePosition(data, posMap);
      return { name: p.name, x, y, fill: "#94a3b8" };
    });

  const userData = [{ name: locale === "en" ? "You" : "Jij", x: userPos.x, y: userPos.y, fill: "#2563eb" }];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">
        {locale === "en" ? "Political Compass" : "Politiek Kompas"}
      </h3>
      <p className="text-xs text-gray-500">
        {locale === "en"
          ? "Your position (blue) compared to parties (gray) based on your answers."
          : "Jouw positie (blauw) vergeleken met partijen (grijs) op basis van je antwoorden."}
      </p>
      <div className="h-80 w-full">
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 20, right: 30, bottom: 30, left: 30 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis type="number" dataKey="x" domain={[-50, 50]} tick={{ fontSize: 11 }}>
              <Label
                value={locale === "en" ? "← Economic Left | Economic Right →" : "← Economisch Links | Economisch Rechts →"}
                offset={-15}
                position="insideBottom"
                style={{ fontSize: 11, fill: "#9ca3af" }}
              />
            </XAxis>
            <YAxis type="number" dataKey="y" domain={[-50, 50]} tick={{ fontSize: 11 }}>
              <Label
                value={locale === "en" ? "← Conservative | Progressive →" : "← Conservatief | Progressief →"}
                angle={-90}
                offset={-15}
                position="insideLeft"
                style={{ fontSize: 11, fill: "#9ca3af" }}
              />
            </YAxis>
            <ReferenceLine x={0} stroke="#e5e7eb" />
            <ReferenceLine y={0} stroke="#e5e7eb" />
            <Tooltip
              content={({ payload }) => {
                if (!payload?.[0]) return null;
                const d = payload[0].payload;
                return (
                  <div className="rounded-md border bg-white px-3 py-2 text-sm shadow-sm dark:bg-gray-900 dark:border-gray-700">
                    <p className="font-semibold">{d.name}</p>
                    <p className="text-xs text-gray-500">
                      ({d.x > 0 ? "Right" : "Left"}: {Math.abs(d.x)}, {d.y > 0 ? "Prog" : "Cons"}: {Math.abs(d.y)})
                    </p>
                  </div>
                );
              }}
            />
            <Scatter name="Parties" data={partyData} fill="#94a3b8" r={6} />
            <Scatter name="You" data={userData} fill="#2563eb" r={10} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
