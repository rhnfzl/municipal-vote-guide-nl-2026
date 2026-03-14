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
      return {
        id: s.id as number,
        index: s.index as number,
        theme: (s.theme as string) || "",
        themeId: (s.themeId as string) || "",
        title: getPlainText(s.title),
        moreInfo: stripHtml(moreInfo.text),
        pro: stripHtml(moreInfo.pro),
        con: stripHtml(moreInfo.con),
        isShootout: false,
      };
    })
    .sort((a, b) => a.index - b.index);

  // Shootout statements (for tie-breaking) — stored in separate array in raw data
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

  // Only process Dutch (nl) entries — skip Frisian (fy) and English (en) handled separately
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
      `  [${municipalityIndex.length}/${nlEntries.length}] ${slug} — ${processed.parties.length} parties, ${processed.statements.length} statements${hasOfficialEnglish ? " +EN" : ""}\n`
    );
  }

  // Write index
  fs.writeFileSync(
    path.join(OUT_DIR, "index.json"),
    JSON.stringify(municipalityIndex, null, 2),
    "utf-8"
  );

  // National stats
  const themeCount: Record<string, number> = {};
  const partyCount: Record<string, number> = {};
  for (const entry of municipalityIndex) {
    const nlPath = path.join(MUNI_OUT_DIR, entry.slug, "nl.json");
    const data = JSON.parse(fs.readFileSync(nlPath, "utf-8"));
    for (const s of data.statements) {
      themeCount[s.theme] = (themeCount[s.theme] || 0) + 1;
    }
    for (const p of data.parties) {
      partyCount[p.name] = (partyCount[p.name] || 0) + 1;
    }
  }

  const nationalStats = {
    totalMunicipalities: municipalityIndex.length,
    withOfficialEnglish: municipalityIndex.filter((m) => m.hasOfficialEnglish)
      .length,
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
