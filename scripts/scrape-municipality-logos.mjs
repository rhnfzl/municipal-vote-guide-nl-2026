#!/usr/bin/env node
/**
 * Scrape Municipality Coats of Arms (Gemeentewapens)
 *
 * Downloads proper heraldic coats of arms for all Dutch municipalities
 * from Wikimedia Commons. All gemeentewapens are public domain
 * (PD-NL-gemeentewapen).
 *
 * Strategy (two passes):
 *   Pass 1 - Try known filename patterns via thumb.php:
 *     "{Name} wapen.svg", "Coat of arms of {Name}.svg",
 *     "Gemeentewapen {Name}.svg", "Wapen van {Name}.svg"
 *   Pass 2 - Search API fallback for any that failed:
 *     Query Wikimedia Commons search for "wapen {Name}" / "coat of arms {Name}"
 *     and download the first matching SVG coat of arms.
 *
 * Output:
 *   - PNG thumbnails (256px) in public/images/municipalities/{slug}.png
 *   - JSON mapping in src/lib/municipality-logos.json
 *
 * Usage:
 *   node scripts/scrape-municipality-logos.mjs           # skip existing files
 *   node scripts/scrape-municipality-logos.mjs --force    # re-download all
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const INDEX_PATH = path.join(ROOT, "public", "data", "index.json");
const LOGOS_DIR = path.join(ROOT, "public", "images", "municipalities");
const LOGOS_JSON = path.join(ROOT, "src", "lib", "municipality-logos.json");

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const THUMB_WIDTH = 256;
const USER_AGENT = "VoteGuideBot/2.0 (https://github.com/rhnfzl/municipal-vote-guide-nl-2026)";
const FORCE = process.argv.includes("--force");

// ── Helpers ──────────────────────────────────────────────────────────

function fetchUrl(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error("too many redirects"));
    https.get(url, {
      headers: { "User-Agent": USER_AGENT },
      timeout: 20000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirect = res.headers.location;
        if (redirect.startsWith("/")) {
          const u = new URL(url);
          redirect = `${u.protocol}//${u.host}${redirect}`;
        }
        fetchUrl(redirect, maxRedirects - 1).then(resolve).catch(reject);
        return;
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({
        status: res.statusCode,
        data: Buffer.concat(chunks),
        contentType: res.headers["content-type"] || "",
      }));
    }).on("error", reject).on("timeout", function () { this.destroy(); reject(new Error("timeout")); });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Download via thumb.php ───────────────────────────────────────────

/**
 * Download a PNG thumbnail of a Wikimedia Commons file via thumb.php.
 * This endpoint converts SVG → PNG server-side at the requested width.
 * Returns the file size on success, 0 on failure.
 */
async function downloadThumbPHP(filename, outPath) {
  const wikiFilename = filename.replace(/ /g, "_");
  const url = `https://commons.wikimedia.org/w/thumb.php?f=${encodeURIComponent(wikiFilename)}&w=${THUMB_WIDTH}`;
  try {
    const res = await fetchUrl(url);
    if (res.status === 200 && res.contentType?.startsWith("image") && res.data.length > 1000) {
      fs.writeFileSync(outPath, res.data);
      return res.data.length;
    }
    if (res.status === 429) {
      console.log("    Rate limited on thumb.php, waiting 15s...");
      await sleep(15000);
    }
  } catch {
    // ignore
  }
  return 0;
}

// ── Wikimedia Commons Search API ─────────────────────────────────────

/**
 * Search Wikimedia Commons for a coat of arms SVG file matching the query.
 * Returns the File: title on success, null on failure.
 */
async function searchCoatOfArms(searchTerms) {
  for (const term of searchTerms) {
    const url = `${COMMONS_API}?action=query&list=search&srnamespace=6&srsearch=${encodeURIComponent(term)}&srlimit=5&format=json`;
    try {
      const res = await fetchUrl(url);
      if (res.status === 429) {
        console.log("    Rate limited on search API, waiting 15s...");
        await sleep(15000);
        continue;
      }
      if (res.status !== 200) { await sleep(2000); continue; }

      const json = JSON.parse(res.data.toString("utf-8"));
      const results = json?.query?.search || [];

      for (const r of results) {
        const title = r.title;
        if (!title.endsWith(".svg")) continue;
        const tl = title.toLowerCase();
        if (!tl.includes("wapen") && !tl.includes("coat of arms") && !tl.includes("gemeentewapen")) continue;
        // Skip province-level or royal coat of arms
        if (tl.includes("provincie") || tl.includes("province") || tl.includes("kingdom") || tl.includes("royal")) continue;
        return title.replace("File:", "");
      }
    } catch {
      // ignore
    }
    await sleep(2000);
  }
  return null;
}

// ── Filename Candidates ──────────────────────────────────────────────

// Manual overrides for municipalities with non-standard Wikimedia filenames
const FILE_OVERRIDES = {
  "'s-Gravenhage": ["Den Haag wapen.svg", "'s-Gravenhage wapen.svg"],
  "'s-Hertogenbosch": ["'s-Hertogenbosch wapen.svg"],
  "Hengelo (O.)": ["Hengelo wapen.svg"],
  "Rijswijk (ZH.)": ["Rijswijk wapen.svg"],
  "Middelburg (Z.)": ["Middelburg wapen.svg", "Coat of arms of Middelburg.svg"],
  "Beek (L.)": ["Beek (Limburg) wapen.svg"],
  "Stein (L.)": ["Stein wapen.svg"],
  "Noardeast-Fryslân": ["Noardeast-Fryslan wapen.svg"],
  "Dijk en Waard": ["Gemeentewapen Dijk en Waard.svg"],
};

/**
 * Generate candidate Wikimedia Commons filenames for a municipality.
 */
function getFilenameCandidates(name) {
  if (FILE_OVERRIDES[name]) return FILE_OVERRIDES[name];

  const cleanName = name.replace(/\s*\([^)]*\)/g, "").trim();
  const candidates = [
    `${cleanName} wapen.svg`,
    `Coat of arms of ${cleanName}.svg`,
    `Gemeentewapen ${cleanName}.svg`,
    `Wapen van ${cleanName}.svg`,
  ];

  // ASCII variants for names with diacritics
  const asciiName = cleanName
    .replace(/â/g, "a").replace(/ú/g, "u").replace(/ë/g, "e")
    .replace(/ï/g, "i").replace(/ö/g, "o").replace(/ü/g, "u");
  if (asciiName !== cleanName) {
    candidates.push(`${asciiName} wapen.svg`);
  }

  return candidates;
}

/**
 * Generate search queries for the Wikimedia Commons search API.
 */
function getSearchQueries(name) {
  const cleanName = name.replace(/\s*\([^)]*\)/g, "").trim();
  return [
    `wapen ${cleanName} gemeente`,
    `coat of arms ${cleanName}`,
    `gemeentewapen ${cleanName}`,
  ];
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log("  SCRAPE MUNICIPALITY COATS OF ARMS (Gemeentewapens)");
  console.log("  Source: Wikimedia Commons (public domain SVG → PNG)");
  console.log("=".repeat(60) + "\n");

  fs.mkdirSync(LOGOS_DIR, { recursive: true });

  const index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8"));
  console.log(`Processing ${index.length} municipalities...`);
  if (FORCE) console.log("  (--force: re-downloading all)");
  console.log();

  const logoMap = {};
  let stats = { pass1: 0, pass2: 0, existing: 0, failed: 0 };
  const pass2Queue = []; // municipalities that failed pass 1

  // ── Pass 1: Try known filename patterns via thumb.php ──────────────

  console.log("── Pass 1: Known filename patterns ──\n");

  for (let i = 0; i < index.length; i++) {
    const muni = index[i];
    const outPath = path.join(LOGOS_DIR, `${muni.slug}.png`);
    const logoPath = `/images/municipalities/${muni.slug}.png`;

    // Skip if already exists and is a proper coat of arms (> 3KB)
    if (!FORCE && fs.existsSync(outPath) && fs.statSync(outPath).size > 3000) {
      logoMap[muni.slug] = logoPath;
      stats.existing++;
      continue;
    }

    const candidates = getFilenameCandidates(muni.name);
    let found = false;

    for (const filename of candidates) {
      const size = await downloadThumbPHP(filename, outPath);
      if (size > 1000) {
        logoMap[muni.slug] = logoPath;
        stats.pass1++;
        found = true;
        console.log(`  [${i + 1}/${index.length}] OK: ${muni.name} → ${filename} (${size}b)`);
        break;
      }
      await sleep(1500);
    }

    if (!found) {
      pass2Queue.push({ index: i, muni });
      console.log(`  [${i + 1}/${index.length}] MISS: ${muni.name} (queued for search)`);
    }
  }

  console.log(`\n  Pass 1 complete: ${stats.pass1} downloaded, ${stats.existing} existing, ${pass2Queue.length} queued for search\n`);

  // ── Pass 2: Search API fallback for remaining ──────────────────────

  if (pass2Queue.length > 0) {
    console.log("── Pass 2: Wikimedia Commons search API ──\n");

    for (const { index: idx, muni } of pass2Queue) {
      const outPath = path.join(LOGOS_DIR, `${muni.slug}.png`);
      const logoPath = `/images/municipalities/${muni.slug}.png`;

      const queries = getSearchQueries(muni.name);
      const foundFile = await searchCoatOfArms(queries);

      if (foundFile) {
        await sleep(1500);
        const size = await downloadThumbPHP(foundFile, outPath);
        if (size > 1000) {
          logoMap[muni.slug] = logoPath;
          stats.pass2++;
          console.log(`  [${idx + 1}/${index.length}] OK: ${muni.name} → ${foundFile} (${size}b)`);
          continue;
        }
      }

      stats.failed++;
      console.log(`  [${idx + 1}/${index.length}] FAIL: ${muni.name}`);
      await sleep(1500);
    }
  }

  // ── Write results ──────────────────────────────────────────────────

  const sorted = Object.fromEntries(
    Object.entries(logoMap).sort(([a], [b]) => a.localeCompare(b))
  );
  fs.writeFileSync(LOGOS_JSON, JSON.stringify(sorted, null, 2) + "\n", "utf-8");

  const total = stats.pass1 + stats.pass2 + stats.existing;
  console.log(`\n${"=".repeat(60)}`);
  console.log("  DONE");
  console.log(`  Pass 1 (filename patterns): ${stats.pass1}`);
  console.log(`  Pass 2 (search fallback):   ${stats.pass2}`);
  console.log(`  Existing (skipped):         ${stats.existing}`);
  console.log(`  Failed:                     ${stats.failed}`);
  console.log(`  Total:                      ${total} / ${index.length}`);
  console.log(`\n  Logo map: ${LOGOS_JSON}`);
  console.log(`  Images:   ${LOGOS_DIR}/`);
  console.log("=".repeat(60));
}

main().catch(console.error);
