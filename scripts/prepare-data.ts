#!/usr/bin/env npx ts-node
/**
 * Prepare Data Script
 * Transforms raw municipality JSON files into optimized per-municipality format
 * for the public/data/ directory.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const RAW_DIR = path.join(ROOT, "data", "raw");
const INDEX_PATH = path.join(ROOT, "data", "index.json");
const OUT_DIR = path.join(ROOT, "public", "data");
const MUNI_OUT_DIR = path.join(OUT_DIR, "municipalities");

interface RawIndexEntry {
  id: number;
  name: string;
  source: string;
  remoteId: string;
  language: string;
  decrypt: boolean;
}

function stripHtml(text: string | undefined | null): string {
  if (!text) return "";
  return text.replace(/<[^>]+>/g, "").trim();
}

function getPlainText(title: unknown): string {
  if (typeof title === "string") return title.trim();
  if (Array.isArray(title)) {
    return title
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part === "object" && part !== null && "text" in part)
          return (part as { text: string }).text;
        return "";
      })
      .join("")
      .trim();
  }
  return String(title || "");
}

/**
 * Extract title parts with glossary tooltips from structured title arrays.
 * Returns null if no glossary terms exist (plain string title).
 */
function getTitleParts(
  title: unknown
): Array<{ text: string; glossary?: string }> | null {
  if (!Array.isArray(title)) return null;

  const parts: Array<{ text: string; glossary?: string }> = [];
  let hasGlossary = false;

  for (const part of title) {
    if (typeof part === "string") {
      parts.push({ text: part });
    } else if (
      typeof part === "object" &&
      part !== null &&
      "text" in part
    ) {
      const obj = part as { text: string; information?: string };
      if (obj.information) {
        hasGlossary = true;
        parts.push({ text: obj.text, glossary: obj.information });
      } else {
        parts.push({ text: obj.text });
      }
    }
  }

  return hasGlossary ? parts : null;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[''\u2018\u2019]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function processMunicipality(
  rawData: Record<string, unknown>,
  entry: RawIndexEntry
) {
  const parties = (rawData.parties as Array<Record<string, unknown>>) || [];
  const statements =
    (rawData.statements as Array<Record<string, unknown>>) || [];

  const stmtLookup: Record<number, Record<string, unknown>> = {};
  for (const s of statements) {
    stmtLookup[s.id as number] = s;
  }

  const processedStatements = statements
    .filter((s) => !(s.isShootout as boolean))
    .map((s) => {
      const moreInfo = (s.moreInfo as Record<string, string>) || {};
      const titleParts = getTitleParts(s.title);
      return {
        id: s.id as number,
        index: s.index as number,
        theme: (s.theme as string) || "",
        themeId: (s.themeId as string) || "",
        title: getPlainText(s.title),
        ...(titleParts ? { titleParts } : {}),
        moreInfo: stripHtml(moreInfo.text),
        pro: stripHtml(moreInfo.pro),
        con: stripHtml(moreInfo.con),
        isShootout: false,
      };
    })
    .sort((a, b) => a.index - b.index);

  // Shootout statements (for tie-breaking) - stored in separate array in raw data
  const rawShootouts =
    (rawData.shootoutStatements as Array<Record<string, unknown>>) || [];
  const shootoutStatements = rawShootouts.map((s) => {
    const moreInfo = (s.moreInfo as Record<string, string>) || {};
    // Add to stmtLookup for party position mapping
    stmtLookup[s.id as number] = s;
    return {
      id: s.id as number,
      index: s.index as number,
      theme: (s.theme as string) || "",
      themeId: (s.themeId as string) || "",
      title: getPlainText(s.title),
      moreInfo: stripHtml(moreInfo.text),
      pro: stripHtml(moreInfo.pro),
      con: stripHtml(moreInfo.con),
      isShootout: true,
    };
  });

  const processedParties = parties.map((p) => {
    const partyStatements =
      (p.statements as Array<Record<string, unknown>>) || [];
    const positions: Record<
      number,
      { position: string; explanation: string }
    > = {};

    // Include ALL positions (regular + shootout)
    for (const ps of partyStatements) {
      const stmtId = ps.id as number;
      if (stmtLookup[stmtId]) {
        positions[stmtId] = {
          position: (ps.position as string) || "neither",
          explanation: (ps.explanation as string) || "",
        };
      }
    }

    // Also include shootout statement positions
    const partyShootouts = (p.shootoutStatements as Array<Record<string, unknown>>) || [];
    for (const ps of partyShootouts) {
      const stmtId = ps.id as number;
      positions[stmtId] = {
        position: (ps.position as string) || "neither",
        explanation: (ps.explanation as string) || "",
      };
    }

    return {
      id: p.id as number,
      name: (p.name as string) || "",
      fullName: (p.fullName as string) || (p.name as string) || "",
      website: (p.website as string) || "",
      hasSeats: (p.hasSeats as boolean) || false,
      participates: (p.participates as boolean) || true,
      positions,
    };
  });

  const slug = slugify(entry.name);

  return {
    id: entry.remoteId,
    name: entry.name,
    slug,
    parties: processedParties,
    statements: processedStatements,
    shootoutStatements,
  };
}

function main() {
  console.log("Preparing data...\n");

  const index: RawIndexEntry[] = JSON.parse(
    fs.readFileSync(INDEX_PATH, "utf-8")
  );

  // Only process Dutch (nl) entries - skip Frisian (fy) and English (en) handled separately
  const nlEntries = index.filter((e) => e.language === "nl");
  const enEntries = index.filter((e) => e.language === "en");

  console.log(
    `  ${index.length} total entries, ${nlEntries.length} Dutch, ${enEntries.length} English\n`
  );

  fs.mkdirSync(MUNI_OUT_DIR, { recursive: true });

  const municipalityIndex: Array<{
    id: string;
    name: string;
    slug: string;
    numParties: number;
    numStatements: number;
    hasOfficialEnglish: boolean;
  }> = [];

  // Process Dutch entries
  for (const entry of nlEntries) {
    const rawPath = path.join(RAW_DIR, `${entry.source}.json`);
    if (!fs.existsSync(rawPath)) {
      console.log(`  SKIP: ${entry.source} (file not found)`);
      continue;
    }

    const rawData = JSON.parse(fs.readFileSync(rawPath, "utf-8"));
    const processed = processMunicipality(rawData, entry);
    const slug = processed.slug;

    // Check if official English exists
    const enEntry = enEntries.find((e) => e.remoteId === entry.remoteId);
    const hasOfficialEnglish = !!enEntry;

    // Save Dutch version
    const muniDir = path.join(MUNI_OUT_DIR, slug);
    fs.mkdirSync(muniDir, { recursive: true });
    fs.writeFileSync(
      path.join(muniDir, "nl.json"),
      JSON.stringify(processed, null, 2),
      "utf-8"
    );

    // If official English exists, process it too
    if (enEntry) {
      const enRawPath = path.join(RAW_DIR, `${enEntry.source}.json`);
      if (fs.existsSync(enRawPath)) {
        const enRawData = JSON.parse(fs.readFileSync(enRawPath, "utf-8"));
        const enProcessed = processMunicipality(enRawData, {
          ...enEntry,
          name: entry.name,
        });
        fs.writeFileSync(
          path.join(muniDir, "en.json"),
          JSON.stringify(enProcessed, null, 2),
          "utf-8"
        );
      }
    }

    municipalityIndex.push({
      id: entry.remoteId,
      name: entry.name,
      slug,
      numParties: processed.parties.length,
      numStatements: processed.statements.length,
      hasOfficialEnglish,
    });

    process.stdout.write(
      `  [${municipalityIndex.length}/${nlEntries.length}] ${slug} - ${processed.parties.length} parties, ${processed.statements.length} statements${hasOfficialEnglish ? " +EN" : ""}\n`
    );
  }

  // Write index
  fs.writeFileSync(
    path.join(OUT_DIR, "index.json"),
    JSON.stringify(municipalityIndex, null, 2),
    "utf-8"
  );

  // National stats - Pass 1: basic counts
  const themeCount: Record<string, number> = {};
  const partyCount: Record<string, number> = {};
  const uniquePartyNames = new Set<string>();
  let totalIncumbents = 0;
  let totalParties = 0;
  let maxChallengers = { name: "", slug: "", count: 0 };

  // Pass 2: deep analysis accumulators
  // Theme -> municipality name (for finding unique themes)
  const themeMunicipality: Record<string, string[]> = {};
  // Per-theme position tallies across all municipalities
  const themePositions: Record<string, { agree: number; disagree: number; neither: number }> = {};
  // Track best fence-sitter, political twins, harmonious/divided municipalities
  let biggestFenceSitter = { party: "", municipality: "", neitherPct: 0 };
  let neverNeutralCount = 0;
  let politicalTwins = { municipality: "", partyA: "", partyB: "", agreePct: 0 };
  let mostHarmonious = { name: "", avgAgreePct: 0 };
  let mostDivided = { name: "", avgAgreePct: 100 };
  let unanimousExample = { municipality: "", theme: "", partyCount: 0 };
  let wordiestParty = { party: "", municipality: "", avgWords: 0 };
  let mostThemesCovered = { name: "", themeCount: 0 };

  for (const entry of municipalityIndex) {
    const nlPath = path.join(MUNI_OUT_DIR, entry.slug, "nl.json");
    const data = JSON.parse(fs.readFileSync(nlPath, "utf-8"));

    // Basic counts
    const themes = new Set<string>();
    for (const s of data.statements) {
      themeCount[s.theme] = (themeCount[s.theme] || 0) + 1;
      if (!themeMunicipality[s.theme]) themeMunicipality[s.theme] = [];
      themeMunicipality[s.theme].push(entry.name);
      themes.add(s.theme);
    }

    // Most themes covered
    if (themes.size > mostThemesCovered.themeCount) {
      mostThemesCovered = { name: entry.name, themeCount: themes.size };
    }

    let muniIncumbents = 0;
    for (const p of data.parties) {
      partyCount[p.name] = (partyCount[p.name] || 0) + 1;
      uniquePartyNames.add(p.name);
      totalParties++;
      if (p.hasSeats) {
        muniIncumbents++;
        totalIncumbents++;
      }
    }
    const challengers = data.parties.length - muniIncumbents;
    if (challengers > maxChallengers.count) {
      maxChallengers = { name: entry.name, slug: entry.slug, count: challengers };
    }

    // Deep analysis: party positions
    const partyPositionVectors: Array<{ name: string; positions: Record<number, string> }> = [];

    for (const p of data.parties) {
      const positions = p.positions as Record<string, { position: string; explanation: string }>;
      let agreeCount = 0, disagreeCount = 0, neitherCount = 0;
      let totalWords = 0;
      let explanationCount = 0;
      const posVector: Record<number, string> = {};

      for (const [stmtId, pos] of Object.entries(positions)) {
        posVector[Number(stmtId)] = pos.position;
        if (pos.position === "agree") agreeCount++;
        else if (pos.position === "disagree") disagreeCount++;
        else neitherCount++;
        if (pos.explanation) {
          totalWords += pos.explanation.split(/\s+/).length;
          explanationCount++;
        }
      }

      partyPositionVectors.push({ name: p.name, positions: posVector });

      // Fence-sitter: highest neither % (require 15+ positions, exclude all-neither)
      const totalPos = agreeCount + disagreeCount + neitherCount;
      if (totalPos >= 15) {
        const neitherPct = Math.round((neitherCount / totalPos) * 100);
        if (neitherPct > biggestFenceSitter.neitherPct && neitherPct < 100) {
          biggestFenceSitter = { party: p.name, municipality: entry.name, neitherPct };
        }
        // Never neutral
        if (neitherCount === 0) {
          neverNeutralCount++;
        }
      }

      // Wordiest party
      if (explanationCount > 0) {
        const avgWords = Math.round(totalWords / explanationCount);
        if (avgWords > wordiestParty.avgWords) {
          wordiestParty = { party: p.name, municipality: entry.name, avgWords };
        }
      }
    }

    // Per-statement analysis: unanimity + theme positions
    for (const s of data.statements) {
      let sAgree = 0, sDisagree = 0, sNeither = 0;
      for (const p of data.parties) {
        const pos = (p.positions as Record<string, { position: string }>)[String(s.id)];
        if (!pos) continue;
        if (pos.position === "agree") sAgree++;
        else if (pos.position === "disagree") sDisagree++;
        else sNeither++;
      }

      // Accumulate theme-level positions
      if (!themePositions[s.theme]) themePositions[s.theme] = { agree: 0, disagree: 0, neither: 0 };
      themePositions[s.theme].agree += sAgree;
      themePositions[s.theme].disagree += sDisagree;
      themePositions[s.theme].neither += sNeither;

      // Check unanimity (all parties agree or all disagree, require 6+ parties)
      const total = sAgree + sDisagree + sNeither;
      if (total >= 6 && (sAgree === total || sDisagree === total)) {
        if (total > unanimousExample.partyCount) {
          unanimousExample = { municipality: entry.name, theme: s.theme, partyCount: total };
        }
      }
    }

    // Pairwise agreement analysis
    if (partyPositionVectors.length >= 2) {
      let totalPairAgreement = 0;
      let pairCount = 0;

      for (let i = 0; i < partyPositionVectors.length; i++) {
        for (let j = i + 1; j < partyPositionVectors.length; j++) {
          const a = partyPositionVectors[i];
          const b = partyPositionVectors[j];
          let matches = 0, compared = 0;

          // Only compare statements both parties answered
          for (const stmtId of Object.keys(a.positions)) {
            if (b.positions[Number(stmtId)]) {
              compared++;
              if (a.positions[Number(stmtId)] === b.positions[Number(stmtId)]) matches++;
            }
          }

          if (compared >= 20) {
            const agreePct = Math.round((matches / compared) * 100);
            totalPairAgreement += agreePct;
            pairCount++;

            // Political twins (skip perfect 100% which are usually edge cases)
            if (agreePct > politicalTwins.agreePct && agreePct < 100) {
              politicalTwins = { municipality: entry.name, partyA: a.name, partyB: b.name, agreePct };
            }
          }
        }
      }

      if (pairCount > 0) {
        const avgPairAgreement = Math.round(totalPairAgreement / pairCount);
        if (avgPairAgreement > mostHarmonious.avgAgreePct) {
          mostHarmonious = { name: entry.name, avgAgreePct: avgPairAgreement };
        }
        if (avgPairAgreement < mostDivided.avgAgreePct) {
          mostDivided = { name: entry.name, avgAgreePct: avgPairAgreement };
        }
      }
    }
  }

  // Post-processing: find unique themes (appear in only 1 municipality)
  const uniqueThemes = Object.entries(themeMunicipality)
    .filter(([, munis]) => munis.length === 1)
    .map(([theme, munis]) => ({ theme, municipality: munis[0] }))
    .slice(0, 5);

  // Most divisive topic: closest to 50/50 agree/disagree split
  let mostDivisiveTopic = { theme: "", agreePct: 0, disagreePct: 0 };
  let smallestDivisiveGap = 100;
  for (const [theme, pos] of Object.entries(themePositions)) {
    const total = pos.agree + pos.disagree + pos.neither;
    if (total < 50) continue; // skip rare themes
    const aPct = Math.round((pos.agree / total) * 100);
    const dPct = Math.round((pos.disagree / total) * 100);
    const gap = Math.abs(aPct - dPct);
    if (gap < smallestDivisiveGap) {
      smallestDivisiveGap = gap;
      mostDivisiveTopic = { theme, agreePct: aPct, disagreePct: dPct };
    }
  }

  // Top party missing: find municipalities without the #1 party
  const topPartyEntries = Object.entries(partyCount).sort((a, b) => b[1] - a[1]);
  const topPartyName = topPartyEntries[0]?.[0] || "";
  const topPartyPresentIn = topPartyEntries[0]?.[1] || 0;
  const allMuniNames = new Set(municipalityIndex.map((m) => m.name));
  const muniWithTopParty = new Set<string>();
  for (const entry of municipalityIndex) {
    const nlPath = path.join(MUNI_OUT_DIR, entry.slug, "nl.json");
    const data = JSON.parse(fs.readFileSync(nlPath, "utf-8"));
    for (const p of data.parties) {
      if (p.name === topPartyName) muniWithTopParty.add(entry.name);
    }
  }
  const topPartyMissingIn = [...allMuniNames].filter((n) => !muniWithTopParty.has(n));

  // Local parties: appear in only 1 municipality
  const localPartyCount = Object.values(partyCount).filter((c) => c === 1).length;

  const nationalStats = {
    totalMunicipalities: municipalityIndex.length,
    withOfficialEnglish: municipalityIndex.filter((m) => m.hasOfficialEnglish)
      .length,
    totalUniqueParties: uniquePartyNames.size,
    totalPartyEntries: totalParties,
    totalIncumbents,
    avgIncumbencyPct: Math.round((totalIncumbents / totalParties) * 100),
    maxChallengers,
    // Deep analysis results
    unanimousExample,
    mostDivisiveTopic,
    biggestFenceSitter,
    neverNeutralCount,
    politicalTwins,
    mostHarmonious,
    mostDivided,
    uniqueThemes,
    topPartyMissing: { party: topPartyName, presentIn: topPartyPresentIn, missingIn: topPartyMissingIn },
    localPartyCount,
    wordiestParty,
    mostThemesCovered,
    topThemes: Object.entries(themeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30),
    topParties: Object.entries(partyCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30),
  };

  fs.mkdirSync(path.join(OUT_DIR, "national"), { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, "national", "stats.json"),
    JSON.stringify(nationalStats, null, 2),
    "utf-8"
  );

  console.log(`\n${"=".repeat(60)}`);
  console.log(`DATA PREPARATION COMPLETE`);
  console.log(`  Municipalities: ${municipalityIndex.length}`);
  console.log(
    `  With official English: ${nationalStats.withOfficialEnglish}`
  );
  console.log(`  Index: ${path.join(OUT_DIR, "index.json")}`);
  console.log(`${"=".repeat(60)}`);
}

main();
