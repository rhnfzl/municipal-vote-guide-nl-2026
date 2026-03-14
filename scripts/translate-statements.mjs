#!/usr/bin/env node
/**
 * Translate Statements Script
 * Uses OpenAI gpt-5-mini Responses API to translate Dutch municipality data to English.
 * Deduplicates identical texts before translating to minimize API calls.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const MUNI_DIR = path.join(ROOT, "public", "data", "municipalities");
const INDEX_PATH = path.join(ROOT, "public", "data", "index.json");
const CACHE_PATH = path.join(ROOT, "data", "translation-cache.json");

// Load API key
const envContent = fs.readFileSync(path.join(ROOT, ".env_openai"), "utf-8");
const apiKey = envContent.match(/OPENAI_API_KEY=(.+)/)?.[1]?.trim();
if (!apiKey) throw new Error("OPENAI_API_KEY not found");

const openai = new OpenAI({ apiKey });
const MODEL = "gpt-5-mini";
const BATCH_SIZE = 25;
const DELAY_MS = 300;

let cache = {};
let apiCalls = 0;
let cacheHits = 0;

function loadCache() {
  if (fs.existsSync(CACHE_PATH)) {
    cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
    console.log(`  Loaded ${Object.keys(cache).length} cached translations`);
  }
}

function saveCache() {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache), "utf-8");
}

async function translateBatch(texts) {
  const results = new Array(texts.length).fill("");
  const uncached = [];

  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    if (!t || t.trim() === "") continue;
    if (cache[t]) {
      results[i] = cache[t];
      cacheHits++;
    } else {
      uncached.push({ index: i, text: t });
    }
  }

  if (uncached.length === 0) return results;

  for (let bStart = 0; bStart < uncached.length; bStart += BATCH_SIZE) {
    const batch = uncached.slice(bStart, bStart + BATCH_SIZE);
    const numbered = batch.map((item, i) => `[${i + 1}] ${item.text}`).join("\n\n");

    try {
      const response = await openai.responses.create({
        model: MODEL,
        input: [
          {
            role: "system",
            content: "You are a Dutch-to-English translator for a municipal election guide. Translate each numbered Dutch text to clear, natural English. Output only the translations with the same [number] prefix. Keep it concise.",
          },
          {
            role: "user",
            content: `Translate these Dutch texts to English:\n\n${numbered}`,
          },
        ],
      });

      apiCalls++;
      const outputText = response.output_text || "";
      const translations = {};

      for (const line of outputText.split("\n")) {
        const match = line.match(/^\[(\d+)\]\s*(.+)$/);
        if (match) translations[parseInt(match[1])] = match[2].trim();
      }

      for (let i = 0; i < batch.length; i++) {
        const translated = translations[i + 1] || batch[i].text;
        results[batch[i].index] = translated;
        cache[batch[i].text] = translated;
      }
    } catch (err) {
      console.error(`    API error: ${err.message}`);
      for (const item of batch) results[item.index] = item.text;
    }

    if (bStart + BATCH_SIZE < uncached.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  return results;
}

async function translateMunicipality(slug) {
  const nlPath = path.join(MUNI_DIR, slug, "nl.json");
  const enPath = path.join(MUNI_DIR, slug, "en.json");

  if (fs.existsSync(enPath)) return; // skip official English

  const data = JSON.parse(fs.readFileSync(nlPath, "utf-8"));

  // Translate statements in parallel
  const [titlesEn, themesEn, moreInfoEn, proEn, conEn] = await Promise.all([
    translateBatch(data.statements.map((s) => s.title || "")),
    translateBatch(data.statements.map((s) => s.theme || "")),
    translateBatch(data.statements.map((s) => s.moreInfo || "")),
    translateBatch(data.statements.map((s) => s.pro || "")),
    translateBatch(data.statements.map((s) => s.con || "")),
  ]);

  // Collect party explanations
  const allExplanations = [];
  const explMap = [];
  for (let pi = 0; pi < data.parties.length; pi++) {
    for (const stmtId of Object.keys(data.parties[pi].positions)) {
      allExplanations.push(data.parties[pi].positions[stmtId].explanation || "");
      explMap.push({ pi, stmtId });
    }
  }

  const explanationsEn = await translateBatch(allExplanations);

  // Build en.json (English as primary)
  const enData = JSON.parse(JSON.stringify(data));
  for (let i = 0; i < enData.statements.length; i++) {
    enData.statements[i].title = titlesEn[i];
    enData.statements[i].theme = themesEn[i];
    enData.statements[i].moreInfo = moreInfoEn[i];
    enData.statements[i].pro = proEn[i];
    enData.statements[i].con = conEn[i];
  }
  for (let i = 0; i < explanationsEn.length; i++) {
    const { pi, stmtId } = explMap[i];
    if (enData.parties[pi]?.positions?.[stmtId]) {
      enData.parties[pi].positions[stmtId].explanation = explanationsEn[i];
    }
  }

  // Update nl.json with _en fields for bilingual display
  for (let i = 0; i < data.statements.length; i++) {
    data.statements[i].titleEn = titlesEn[i];
    data.statements[i].themeEn = themesEn[i];
  }
  for (let i = 0; i < explanationsEn.length; i++) {
    const { pi, stmtId } = explMap[i];
    if (data.parties[pi]?.positions?.[stmtId]) {
      data.parties[pi].positions[stmtId].explanationEn = explanationsEn[i];
    }
  }

  fs.writeFileSync(nlPath, JSON.stringify(data, null, 2), "utf-8");
  fs.writeFileSync(enPath, JSON.stringify(enData, null, 2), "utf-8");
}

async function main() {
  console.log("=== Translating municipality data (Dutch → English) ===");
  console.log(`Model: ${MODEL} | Batch: ${BATCH_SIZE}\n`);
  loadCache();

  const index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8"));

  for (let i = 0; i < index.length; i++) {
    const entry = index[i];
    const enExists = fs.existsSync(path.join(MUNI_DIR, entry.slug, "en.json"));

    if (enExists) {
      console.log(`  [${i + 1}/${index.length}] ${entry.slug} — English exists, skipping`);
      continue;
    }

    process.stdout.write(`  [${i + 1}/${index.length}] ${entry.slug} — translating...`);
    await translateMunicipality(entry.slug);
    console.log(` done (${apiCalls} API calls, ${cacheHits} cache hits)`);

    if ((i + 1) % 10 === 0) saveCache();
  }

  saveCache();
  console.log(`\n${"=".repeat(60)}`);
  console.log(`TRANSLATION COMPLETE: ${apiCalls} API calls, ${cacheHits} cache hits`);
  console.log(`Cache: ${Object.keys(cache).length} entries saved`);
  console.log(`${"=".repeat(60)}`);
}

main().catch(console.error);
