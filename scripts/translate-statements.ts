#!/usr/bin/env npx ts-node
/**
 * Translate Statements Script
 * Uses OpenAI gpt-5-mini Responses API to translate Dutch municipality data to English.
 * Deduplicates identical texts before translating to minimize API calls.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const MUNI_DIR = path.join(ROOT, "public", "data", "municipalities");
const INDEX_PATH = path.join(ROOT, "public", "data", "index.json");
const CACHE_PATH = path.join(ROOT, "data", "translation-cache.json");

// Load API key from .env_openai
const envPath = path.join(ROOT, ".env_openai");
const envContent = fs.readFileSync(envPath, "utf-8");
const apiKey = envContent.match(/OPENAI_API_KEY=(.+)/)?.[1]?.trim();
if (!apiKey) throw new Error("OPENAI_API_KEY not found in .env_openai");

const openai = new OpenAI({ apiKey });
const MODEL = "gpt-5-mini";
const BATCH_SIZE = 30; // texts per API call
const DELAY_MS = 200; // between API calls

interface TranslationCache {
  [dutchText: string]: string;
}

let cache: TranslationCache = {};
let apiCalls = 0;
let cacheHits = 0;

function loadCache(): void {
  if (fs.existsSync(CACHE_PATH)) {
    cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
    console.log(`  Loaded ${Object.keys(cache).length} cached translations`);
  }
}

function saveCache(): void {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf-8");
}

async function translateBatch(texts: string[]): Promise<string[]> {
  const uncached: { index: number; text: string }[] = [];
  const results: string[] = new Array(texts.length);

  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    if (!t || t.trim() === "") {
      results[i] = "";
      continue;
    }
    if (cache[t]) {
      results[i] = cache[t];
      cacheHits++;
    } else {
      uncached.push({ index: i, text: t });
    }
  }

  if (uncached.length === 0) return results;

  // Batch uncached texts into groups
  for (let batchStart = 0; batchStart < uncached.length; batchStart += BATCH_SIZE) {
    const batch = uncached.slice(batchStart, batchStart + BATCH_SIZE);
    const numberedTexts = batch
      .map((item, i) => `[${i + 1}] ${item.text}`)
      .join("\n\n");

    try {
      const response = await openai.responses.create({
        model: MODEL,
        input: [
          {
            role: "system",
            content:
              "You are a professional Dutch-to-English translator for a municipal election guide. Translate the numbered Dutch texts to English. Keep translations natural and clear for non-Dutch speakers. Maintain the same numbering format. Only output the translations, nothing else.",
          },
          {
            role: "user",
            content: `Translate the following Dutch texts to English. Return each translation on its own line with the same [number] prefix:\n\n${numberedTexts}`,
          },
        ],
      });

      apiCalls++;

      const outputText =
        response.output_text || "";

      // Parse numbered translations
      const lines = outputText.split("\n").filter((l: string) => l.trim());
      const translations: Record<number, string> = {};

      for (const line of lines) {
        const match = line.match(/^\[(\d+)\]\s*(.+)$/);
        if (match) {
          translations[parseInt(match[1])] = match[2].trim();
        }
      }

      // Map back to results
      for (let i = 0; i < batch.length; i++) {
        const translated = translations[i + 1] || batch[i].text;
        results[batch[i].index] = translated;
        cache[batch[i].text] = translated;
      }
    } catch (err) {
      console.error(`    API error: ${err}`);
      // Fallback: use original text
      for (const item of batch) {
        results[item.index] = item.text;
      }
    }

    if (batchStart + BATCH_SIZE < uncached.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  return results;
}

async function translateMunicipality(slug: string): Promise<void> {
  const nlPath = path.join(MUNI_DIR, slug, "nl.json");
  const enPath = path.join(MUNI_DIR, slug, "en.json");

  // Skip if English already exists (official translation)
  if (fs.existsSync(enPath)) return;

  const data = JSON.parse(fs.readFileSync(nlPath, "utf-8"));

  // Collect all texts to translate
  const statementTitles = data.statements.map((s: Record<string, string>) => s.title || "");
  const statementThemes = data.statements.map((s: Record<string, string>) => s.theme || "");
  const statementMoreInfo = data.statements.map((s: Record<string, string>) => s.moreInfo || "");
  const statementPro = data.statements.map((s: Record<string, string>) => s.pro || "");
  const statementCon = data.statements.map((s: Record<string, string>) => s.con || "");

  // Translate statements
  const [titlesEn, themesEn, moreInfoEn, proEn, conEn] = await Promise.all([
    translateBatch(statementTitles),
    translateBatch(statementThemes),
    translateBatch(statementMoreInfo),
    translateBatch(statementPro),
    translateBatch(statementCon),
  ]);

  // Collect party explanations
  const allExplanations: string[] = [];
  const explanationMap: { partyIdx: number; stmtId: number }[] = [];

  for (let pi = 0; pi < data.parties.length; pi++) {
    const party = data.parties[pi];
    for (const stmtId of Object.keys(party.positions)) {
      const pos = party.positions[stmtId];
      allExplanations.push(pos.explanation || "");
      explanationMap.push({ partyIdx: pi, stmtId: parseInt(stmtId) });
    }
  }

  const explanationsEn = await translateBatch(allExplanations);

  // Build English version
  const enData = JSON.parse(JSON.stringify(data)); // deep clone

  for (let i = 0; i < enData.statements.length; i++) {
    enData.statements[i].titleEn = titlesEn[i];
    enData.statements[i].themeEn = themesEn[i];
    enData.statements[i].moreInfoEn = moreInfoEn[i];
    enData.statements[i].proEn = proEn[i];
    enData.statements[i].conEn = conEn[i];
    // Also set the main fields to English for the en.json
    enData.statements[i].title = titlesEn[i];
    enData.statements[i].theme = themesEn[i];
    enData.statements[i].moreInfo = moreInfoEn[i];
    enData.statements[i].pro = proEn[i];
    enData.statements[i].con = conEn[i];
  }

  for (let i = 0; i < explanationsEn.length; i++) {
    const { partyIdx, stmtId } = explanationMap[i];
    if (enData.parties[partyIdx]?.positions?.[stmtId]) {
      enData.parties[partyIdx].positions[stmtId].explanationEn = explanationsEn[i];
      enData.parties[partyIdx].positions[stmtId].explanation = explanationsEn[i];
    }
  }

  // Also add English translations back to the NL file for bilingual display
  const nlData = JSON.parse(fs.readFileSync(nlPath, "utf-8"));
  for (let i = 0; i < nlData.statements.length; i++) {
    nlData.statements[i].titleEn = titlesEn[i];
    nlData.statements[i].themeEn = themesEn[i];
    nlData.statements[i].moreInfoEn = moreInfoEn[i];
    nlData.statements[i].proEn = proEn[i];
    nlData.statements[i].conEn = conEn[i];
  }
  for (let i = 0; i < explanationsEn.length; i++) {
    const { partyIdx, stmtId } = explanationMap[i];
    if (nlData.parties[partyIdx]?.positions?.[stmtId]) {
      nlData.parties[partyIdx].positions[stmtId].explanationEn = explanationsEn[i];
    }
  }

  fs.writeFileSync(nlPath, JSON.stringify(nlData, null, 2), "utf-8");
  fs.writeFileSync(enPath, JSON.stringify(enData, null, 2), "utf-8");
}

async function main() {
  console.log("Translating municipality data (Dutch → English)...");
  console.log(`  Model: ${MODEL}`);
  console.log(`  Batch size: ${BATCH_SIZE}\n`);

  loadCache();

  const index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8"));
  const total = index.length;

  for (let i = 0; i < total; i++) {
    const entry = index[i];
    const enPath = path.join(MUNI_DIR, entry.slug, "en.json");
    const hasEnglish = fs.existsSync(enPath);

    if (hasEnglish) {
      console.log(
        `  [${i + 1}/${total}] ${entry.slug} - already has English, skipping`
      );
      continue;
    }

    console.log(
      `  [${i + 1}/${total}] ${entry.slug} - translating (${entry.numStatements} statements, ${entry.numParties} parties)...`
    );

    await translateMunicipality(entry.slug);

    // Save cache periodically
    if ((i + 1) % 10 === 0) {
      saveCache();
      console.log(
        `    Cache saved (${Object.keys(cache).length} entries, ${apiCalls} API calls, ${cacheHits} cache hits)`
      );
    }
  }

  saveCache();
  console.log(`\n${"=".repeat(60)}`);
  console.log(`TRANSLATION COMPLETE`);
  console.log(`  API calls: ${apiCalls}`);
  console.log(`  Cache hits: ${cacheHits}`);
  console.log(`  Cached translations: ${Object.keys(cache).length}`);
  console.log(`${"=".repeat(60)}`);
}

main().catch(console.error);
