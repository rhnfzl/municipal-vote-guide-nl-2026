#!/usr/bin/env node
/**
 * Translate Party Explanations (Dutch -> English)
 *
 * Translates all party position explanations across 258 municipalities.
 * Uses async concurrency (8 parallel API calls by default) for speed.
 * Deduplicates globally first, then translates once and applies everywhere.
 *
 * Usage:
 *   node scripts/translate-explanations.mjs                    # defaults
 *   node scripts/translate-explanations.mjs --model gpt-4.1    # different model
 *   node scripts/translate-explanations.mjs --concurrency 4    # fewer parallel calls
 *   node scripts/translate-explanations.mjs --dry-run          # stats only
 */

import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import OpenAI from "openai";

// ── Paths ──────────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const MUNI_DIR = path.join(ROOT, "public", "data", "municipalities");
const INDEX_PATH = path.join(ROOT, "public", "data", "index.json");
const CACHE_PATH = path.join(ROOT, "data", "translation-cache.json");

// ── CLI Args ───────────────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    model: "gpt-4.1-mini",
    concurrency: os.cpus().length || 8,
    batchSize: 40,
    dryRun: false,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--model" && args[i + 1]) opts.model = args[++i];
    else if (args[i] === "--concurrency" && args[i + 1]) opts.concurrency = parseInt(args[++i], 10);
    else if (args[i] === "--batch-size" && args[i + 1]) opts.batchSize = parseInt(args[++i], 10);
    else if (args[i] === "--dry-run") opts.dryRun = true;
    else if (args[i] === "--help") {
      console.log(`Usage: node scripts/translate-explanations.mjs [options]
Options:
  --model <name>        OpenAI model (default: gpt-4.1-mini)
  --concurrency <n>     Parallel API calls (default: ${os.cpus().length || 8})
  --batch-size <n>      Texts per API call (default: 40)
  --dry-run             Show stats and cost estimate, don't translate
  --help                Show this help`);
      process.exit(0);
    }
  }
  return opts;
}

// ── OpenAI Setup ───────────────────────────────────────────────────────────────
const envContent = fs.readFileSync(path.join(ROOT, ".env_openai"), "utf-8");
const apiKey = envContent.match(/OPENAI_API_KEY=(.+)/)?.[1]?.trim();
if (!apiKey) throw new Error("OPENAI_API_KEY not found in .env_openai");
const openai = new OpenAI({ apiKey });

// ── Cache ──────────────────────────────────────────────────────────────────────
let cache = {};

function loadCache() {
  if (fs.existsSync(CACHE_PATH)) {
    cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
    console.log(`  Cache loaded: ${Object.keys(cache).length} entries`);
  }
}

function saveCache() {
  // Atomic write: write to temp file, then rename
  const tmpPath = CACHE_PATH + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(cache), "utf-8");
  fs.renameSync(tmpPath, CACHE_PATH);
}

// ── Shared State ───────────────────────────────────────────────────────────────
let shuttingDown = false;
let apiCalls = 0;
let completedBatches = 0;
let rateLimitUntil = 0;
const startTime = Date.now();

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n  Shutting down gracefully (finishing current batches)...");
  shuttingDown = true;
});
process.on("SIGTERM", () => {
  console.log("\n  Shutting down gracefully (finishing current batches)...");
  shuttingDown = true;
});

// ── Phase 1: Collect & Deduplicate ─────────────────────────────────────────────
function collectExplanations() {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8"));
  const unique = new Set();
  let total = 0;

  for (const entry of index) {
    const nlPath = path.join(MUNI_DIR, entry.slug, "nl.json");
    if (!fs.existsSync(nlPath)) continue;
    const data = JSON.parse(fs.readFileSync(nlPath, "utf-8"));

    for (const party of data.parties) {
      for (const pos of Object.values(party.positions)) {
        const expl = pos.explanation;
        if (expl && expl.trim()) {
          total++;
          unique.add(expl);
        }
      }
    }
  }

  // Filter out already cached
  const needTranslation = [...unique].filter((t) => !cache[t]);
  const alreadyCached = unique.size - needTranslation.length;

  console.log(`  Total explanations: ${total.toLocaleString()}`);
  console.log(`  Unique: ${unique.size.toLocaleString()} (${((1 - unique.size / total) * 100).toFixed(1)}% duplicates)`);
  console.log(`  Already cached: ${alreadyCached.toLocaleString()}`);
  console.log(`  Need translation: ${needTranslation.length.toLocaleString()}`);

  const totalChars = needTranslation.reduce((sum, t) => sum + t.length, 0);
  console.log(`  Total characters: ${totalChars.toLocaleString()}`);

  return { needTranslation, totalChars, total, unique: unique.size };
}

// ── Phase 2: Translation ───────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a Dutch-to-English translator for a Dutch municipal election guide (Gemeenteraadsverkiezingen 2026). Translate each numbered Dutch text to clear, natural English. These are party position explanations — keep the political context and meaning accurate. Output a JSON object where keys are the numbers (as strings) and values are the English translations. Output ONLY valid JSON, no markdown fences or extra text.`;

async function translateBatch(batch, model) {
  const numbered = batch
    .map((text, i) => `[${i + 1}] ${text.replace(/\n/g, " ")}`)
    .join("\n\n");

  let retries = 0;
  while (retries < 3) {
    try {
      // Wait for rate limit cooldown if needed
      const waitMs = rateLimitUntil - Date.now();
      if (waitMs > 0) {
        await new Promise((r) => setTimeout(r, waitMs));
      }

      const response = await openai.responses.create({
        model,
        input: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Translate these ${batch.length} Dutch texts to English:\n\n${numbered}` },
        ],
      });

      apiCalls++;
      const output = response.output_text || "";
      let parsed = 0;

      // Try JSON parse first (preferred — handles multiline)
      try {
        // Strip markdown fences if model added them
        const cleaned = output.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "").trim();
        const translations = JSON.parse(cleaned);
        for (let i = 0; i < batch.length; i++) {
          const key = String(i + 1);
          if (translations[key]) {
            cache[batch[i]] = translations[key];
            parsed++;
          }
        }
      } catch {
        // Fallback: line-by-line regex parsing
        for (const line of output.split("\n")) {
          const match = line.match(/^\[(\d+)\]\s*(.+)$/);
          if (match) {
            const idx = parseInt(match[1]) - 1;
            if (idx >= 0 && idx < batch.length && match[2].trim()) {
              cache[batch[idx]] = match[2].trim();
              parsed++;
            }
          }
        }
      }

      return parsed;
    } catch (err) {
      retries++;
      // Handle rate limiting
      if (err.status === 429) {
        const retryAfter = parseInt(err.headers?.["retry-after"] || "5", 10) * 1000;
        rateLimitUntil = Math.max(rateLimitUntil, Date.now() + retryAfter);
        console.error(`    Rate limited — all workers pausing ${retryAfter / 1000}s`);
        await new Promise((r) => setTimeout(r, retryAfter));
        continue;
      }
      console.error(`    API error (attempt ${retries}/3): ${err.message}`);
      if (retries < 3) {
        const delay = retries * 2000;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  return 0; // All retries failed — texts stay uncached for next run
}

async function workerLoop(workerId, queue, totalBatches, opts) {
  while (!shuttingDown) {
    const batchIndex = queue.next++;
    if (batchIndex >= queue.batches.length) break;

    const batch = queue.batches[batchIndex];
    const parsed = await translateBatch(batch, opts.model);

    completedBatches++;

    // Progress reporting
    const elapsed = (Date.now() - startTime) / 1000;
    const pct = (completedBatches / totalBatches) * 100;
    const textsCompleted = completedBatches * opts.batchSize;
    const etaSeconds = pct > 0 ? (elapsed / pct) * (100 - pct) : 0;
    const etaMin = Math.floor(etaSeconds / 60);
    const etaSec = Math.floor(etaSeconds % 60);

    process.stdout.write(
      `\r  Progress: ${completedBatches.toLocaleString()}/${totalBatches.toLocaleString()} batches (${pct.toFixed(1)}%) | ` +
        `${parsed}/${batch.length} parsed | Cache: ${Object.keys(cache).length.toLocaleString()} | ` +
        `ETA: ${etaMin}m ${etaSec}s    `
    );

    // Save cache periodically
    if (completedBatches % 50 === 0) {
      saveCache();
    }
  }
}

async function runTranslation(uniqueTexts, opts) {
  const totalBatches = Math.ceil(uniqueTexts.length / opts.batchSize);
  console.log(`  Batches: ${totalBatches.toLocaleString()} (${opts.batchSize} texts each)`);
  console.log(`  Concurrency: ${opts.concurrency} parallel API calls`);
  console.log(`  Model: ${opts.model}\n`);

  // Build batch queue
  const batches = [];
  for (let i = 0; i < uniqueTexts.length; i += opts.batchSize) {
    batches.push(uniqueTexts.slice(i, i + opts.batchSize));
  }

  const queue = { batches, next: 0 };

  // Spawn concurrent workers
  const workers = [];
  for (let i = 0; i < opts.concurrency; i++) {
    workers.push(workerLoop(i, queue, totalBatches, opts));
  }

  await Promise.all(workers);
  console.log(""); // newline after progress line

  // Final cache save
  saveCache();
}

// ── Phase 3: Apply Translations ────────────────────────────────────────────────
function applyTranslations() {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8"));
  let updated = 0;
  let translatedCount = 0;
  let untranslatedCount = 0;

  for (const entry of index) {
    const nlPath = path.join(MUNI_DIR, entry.slug, "nl.json");
    const enPath = path.join(MUNI_DIR, entry.slug, "en.json");
    if (!fs.existsSync(nlPath)) continue;

    const nlData = JSON.parse(fs.readFileSync(nlPath, "utf-8"));
    const enData = fs.existsSync(enPath)
      ? JSON.parse(fs.readFileSync(enPath, "utf-8"))
      : JSON.parse(JSON.stringify(nlData));

    // Apply to both nl.json (explanationEn) and en.json (explanation)
    for (const party of nlData.parties) {
      for (const [stmtId, pos] of Object.entries(party.positions)) {
        const translated = cache[pos.explanation];
        if (translated) {
          pos.explanationEn = translated;
          translatedCount++;
        } else {
          untranslatedCount++;
        }
      }
    }

    for (const party of enData.parties) {
      for (const [stmtId, pos] of Object.entries(party.positions)) {
        const translated = cache[pos.explanation];
        if (translated) {
          pos.explanation = translated;
        }
      }
    }

    fs.writeFileSync(nlPath, JSON.stringify(nlData, null, 2), "utf-8");
    fs.writeFileSync(enPath, JSON.stringify(enData, null, 2), "utf-8");
    updated++;
  }

  console.log(`  Updated ${updated} municipalities`);
  console.log(`  Translated explanations: ${translatedCount.toLocaleString()}`);
  console.log(`  Still untranslated: ${untranslatedCount.toLocaleString()}`);
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();

  console.log("=== Translate Party Explanations (Dutch -> English) ===\n");
  loadCache();

  // Phase 1
  console.log("Phase 1: Collecting unique explanations...");
  const { needTranslation, totalChars, total, unique } = collectExplanations();

  if (opts.dryRun) {
    // Cost estimates (approximate token count: ~4 chars per token for Dutch/English)
    const estInputTokens = totalChars / 4;
    const estOutputTokens = estInputTokens; // output ~same length
    const costs = {
      "gpt-4.1-mini": { input: 0.4, output: 1.6 },
      "gpt-4.1-nano": { input: 0.1, output: 0.4 },
      "gpt-4.1": { input: 2.0, output: 8.0 },
    };

    console.log(`\n=== Dry Run Summary ===`);
    console.log(`  Estimated tokens (input):  ~${(estInputTokens / 1e6).toFixed(1)}M`);
    console.log(`  Estimated tokens (output): ~${(estOutputTokens / 1e6).toFixed(1)}M`);
    console.log(`  Estimated API calls: ${Math.ceil(needTranslation.length / opts.batchSize).toLocaleString()}`);

    for (const [model, rates] of Object.entries(costs)) {
      const cost = (estInputTokens * rates.input + estOutputTokens * rates.output) / 1e6;
      console.log(`  Cost (${model}): ~$${cost.toFixed(2)}`);
    }
    const batches = Math.ceil(needTranslation.length / opts.batchSize);
    const estMinutes = Math.ceil((batches / opts.concurrency) * 1.5 / 60);
    console.log(`  Estimated time (${opts.concurrency} concurrent): ~${estMinutes} minutes`);
    return;
  }

  if (needTranslation.length === 0) {
    console.log("\n  All explanations already cached! Skipping to Phase 3...");
  } else {
    // Phase 2
    console.log("\nPhase 2: Translating...");
    await runTranslation(needTranslation, opts);
  }

  // Phase 3
  console.log("\nPhase 3: Applying translations to municipality files...");
  applyTranslations();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${"=".repeat(60)}`);
  console.log(`DONE in ${elapsed}s | ${apiCalls} API calls | Cache: ${Object.keys(cache).length.toLocaleString()} entries`);
  console.log(`${"=".repeat(60)}`);
}

main().catch(console.error);
