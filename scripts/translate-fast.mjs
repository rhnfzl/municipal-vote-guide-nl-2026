#!/usr/bin/env node
/**
 * Fast Translation Script — Statements Only
 * Translates statement titles, themes, pro/con arguments using gpt-5-mini.
 * Skips party explanations (they're secondary and can be translated later).
 * Deduplicates across all municipalities first, then translates once.
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

const envContent = fs.readFileSync(path.join(ROOT, ".env_openai"), "utf-8");
const apiKey = envContent.match(/OPENAI_API_KEY=(.+)/)?.[1]?.trim();
const openai = new OpenAI({ apiKey });
const MODEL = "gpt-5-mini";
const BATCH_SIZE = 40;

let cache = {};
let apiCalls = 0;
let cacheHits = 0;

function loadCache() {
  if (fs.existsSync(CACHE_PATH)) {
    cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
    console.log(`  Cache loaded: ${Object.keys(cache).length} entries`);
  }
}

function saveCache() {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache), "utf-8");
}

async function translateTexts(texts) {
  // Filter out empty and cached
  const toTranslate = [];
  for (const t of texts) {
    if (!t || t.trim() === "" || cache[t]) continue;
    if (!toTranslate.includes(t)) toTranslate.push(t);
  }

  if (toTranslate.length === 0) return;

  console.log(`    Translating ${toTranslate.length} unique texts...`);

  for (let i = 0; i < toTranslate.length; i += BATCH_SIZE) {
    const batch = toTranslate.slice(i, i + BATCH_SIZE);
    const numbered = batch.map((t, j) => `[${j + 1}] ${t}`).join("\n\n");

    let retries = 0;
    while (retries < 3) {
      try {
        const response = await openai.responses.create({
          model: MODEL,
          input: [
            {
              role: "system",
              content: "Translate each numbered Dutch text to clear English. Output ONLY the translations with [number] prefix. No extra text.",
            },
            { role: "user", content: numbered },
          ],
        });

        apiCalls++;
        const output = response.output_text || "";
        let parsed = 0;

        for (const line of output.split("\n")) {
          const match = line.match(/^\[(\d+)\]\s*(.+)$/);
          if (match) {
            const idx = parseInt(match[1]) - 1;
            if (idx >= 0 && idx < batch.length) {
              cache[batch[idx]] = match[2].trim();
              parsed++;
            }
          }
        }

        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(toTranslate.length / BATCH_SIZE);
        process.stdout.write(`      Batch ${batchNum}/${totalBatches}: ${parsed}/${batch.length} translated (cache: ${Object.keys(cache).length})\n`);

        // Save cache after every batch
        saveCache();
        break; // success, exit retry loop
      } catch (err) {
        retries++;
        console.error(`    API error at batch ${i} (attempt ${retries}): ${err.message}`);
        if (retries < 3) {
          const delay = retries * 2000;
          console.log(`    Retrying in ${delay}ms...`);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    // Delay between batches
    if (i + BATCH_SIZE < toTranslate.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}

async function main() {
  console.log("=== Fast Translation (Statements Only) ===");
  console.log(`Model: ${MODEL} | Batch: ${BATCH_SIZE}\n`);
  loadCache();

  const index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8"));

  // Phase 1: Collect ALL unique texts across all municipalities
  console.log("Phase 1: Collecting all unique texts...");
  const allTitles = new Set();
  const allThemes = new Set();
  const allMoreInfo = new Set();
  const allPro = new Set();
  const allCon = new Set();

  for (const entry of index) {
    const data = JSON.parse(fs.readFileSync(path.join(MUNI_DIR, entry.slug, "nl.json"), "utf-8"));
    for (const s of data.statements) {
      if (s.title) allTitles.add(s.title);
      if (s.theme) allThemes.add(s.theme);
      if (s.moreInfo) allMoreInfo.add(s.moreInfo);
      if (s.pro) allPro.add(s.pro);
      if (s.con) allCon.add(s.con);
    }
    // Also collect shootout statement texts
    for (const s of (data.shootoutStatements || [])) {
      if (s.title) allTitles.add(s.title);
      if (s.theme) allThemes.add(s.theme);
    }
  }

  console.log(`  Unique titles: ${allTitles.size}`);
  console.log(`  Unique themes: ${allThemes.size}`);
  console.log(`  Unique moreInfo: ${allMoreInfo.size}`);
  console.log(`  Unique pro: ${allPro.size}`);
  console.log(`  Unique con: ${allCon.size}`);
  const totalUnique = allTitles.size + allThemes.size + allMoreInfo.size + allPro.size + allCon.size;
  console.log(`  Total unique texts: ${totalUnique}`);
  console.log(`  Already cached: ${[...allTitles, ...allThemes, ...allMoreInfo, ...allPro, ...allCon].filter(t => cache[t]).length}`);

  // Phase 2: Translate all unique texts
  console.log("\nPhase 2: Translating...");

  console.log("  [1/5] Themes...");
  await translateTexts([...allThemes]);
  saveCache();

  console.log("  [2/5] Titles...");
  await translateTexts([...allTitles]);
  saveCache();

  console.log("  [3/5] More info...");
  await translateTexts([...allMoreInfo]);
  saveCache();

  console.log("  [4/5] Pro arguments...");
  await translateTexts([...allPro]);
  saveCache();

  console.log("  [5/5] Con arguments...");
  await translateTexts([...allCon]);
  saveCache();

  // Phase 3: Apply translations to each municipality
  console.log("\nPhase 3: Generating en.json files...");
  let generated = 0;

  for (const entry of index) {
    const enPath = path.join(MUNI_DIR, entry.slug, "en.json");
    // Always regenerate en.json (overwrite existing)
    const nlPath = path.join(MUNI_DIR, entry.slug, "nl.json");
    const data = JSON.parse(fs.readFileSync(nlPath, "utf-8"));
    const enData = JSON.parse(JSON.stringify(data));

    // Apply translations to en.json — regular statements
    for (let i = 0; i < enData.statements.length; i++) {
      const s = enData.statements[i];
      s.title = cache[s.title] || s.title;
      s.theme = cache[s.theme] || s.theme;
      s.moreInfo = cache[s.moreInfo] || s.moreInfo;
      s.pro = cache[s.pro] || s.pro;
      s.con = cache[s.con] || s.con;
    }

    // Apply translations to shootout statements
    if (enData.shootoutStatements) {
      for (let i = 0; i < enData.shootoutStatements.length; i++) {
        const s = enData.shootoutStatements[i];
        s.title = cache[s.title] || s.title;
        s.theme = cache[s.theme] || s.theme;
      }
    }

    // Also add titleEn/themeEn to nl.json for bilingual display
    for (let i = 0; i < data.statements.length; i++) {
      data.statements[i].titleEn = cache[data.statements[i].title] || "";
      data.statements[i].themeEn = cache[data.statements[i].theme] || "";
    }

    fs.writeFileSync(nlPath, JSON.stringify(data, null, 2), "utf-8");
    fs.writeFileSync(enPath, JSON.stringify(enData, null, 2), "utf-8");
    generated++;
  }

  console.log(`  Generated ${generated} en.json files`);

  console.log(`\n${"=".repeat(60)}`);
  console.log(`DONE: ${apiCalls} API calls, ${Object.keys(cache).length} cached translations`);
  console.log(`${"=".repeat(60)}`);
}

main().catch(console.error);
