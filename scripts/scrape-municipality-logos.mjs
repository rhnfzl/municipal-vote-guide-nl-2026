#!/usr/bin/env node
/**
 * Scrape Municipality Coats of Arms (Gemeentewapens)
 * Downloads proper heraldic coats of arms from Wikimedia Commons.
 *
 * Source: Wikimedia Commons SVG coats of arms → PNG thumbnails at 256px.
 * All Dutch municipal coats of arms are public domain (PD-NL-gemeentewapen).
 *
 * Naming patterns tried (in order):
 *   1. {Name} wapen.svg
 *   2. Coat of arms of {Name}.svg
 *   3. Gemeentewapen {Name}.svg
 *   4. Wapen van {Name}.svg
 *   5. Search API fallback
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

// Manual overrides for municipalities with non-standard Wikimedia filenames
const FILE_OVERRIDES = {
  "'s-Gravenhage": ["'s-Gravenhage wapen.svg", "Coat of arms of The Hague.svg", "Den Haag wapen.svg"],
  "'s-Hertogenbosch": ["'s-Hertogenbosch wapen.svg", "Coat of arms of 's-Hertogenbosch.svg"],
  "Hengelo (O.)": ["Hengelo wapen.svg", "Coat of arms of Hengelo.svg"],
  "Rijswijk (ZH.)": ["Rijswijk wapen.svg", "Coat of arms of Rijswijk.svg"],
  "Middelburg (Z.)": ["Middelburg wapen.svg", "Coat of arms of Middelburg.svg"],
  "Beek (L.)": ["Beek (Limburg) wapen.svg", "Coat of arms of Beek.svg"],
  "Stein (L.)": ["Stein wapen.svg", "Coat of arms of Stein (Limburg).svg"],
  "Noardeast-Fryslân": ["Noardeast-Fryslan wapen.svg"],
  "Súdwest-Fryslân": ["Sudwest-Fryslan wapen.svg"],
};

// ── Helpers ──────────────────────────────────────────────────────────

function fetchUrl(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error("too many redirects"));
    https.get(url, {
      headers: { "User-Agent": "VoteGuideBot/2.0 (municipal-vote-guide-nl-2026; contact: github.com/rhnfzl)" },
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

// ── Rate-limited fetch with retry ────────────────────────────────────

async function fetchWithRetry(url, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetchUrl(url);
    const text = res.data.toString("utf-8");
    if (res.status === 429 || text.includes("too many requests")) {
      const backoff = (attempt + 1) * 3000;
      console.log(`    Rate limited, waiting ${backoff / 1000}s...`);
      await sleep(backoff);
      continue;
    }
    return res;
  }
  throw new Error("rate limited after retries");
}

// ── Wikimedia Commons API ────────────────────────────────────────────

/**
 * Query Wikimedia Commons for image info of specific file titles.
 * Queries one title at a time to avoid encoding issues with pipes.
 */
async function queryFileInfo(fileTitles) {
  for (const title of fileTitles) {
    const encodedTitle = encodeURIComponent(`File:${title}`);
    const url = `${COMMONS_API}?action=query&titles=${encodedTitle}&prop=imageinfo&iiprop=url%7Csize&iiurlwidth=${THUMB_WIDTH}&format=json`;

    try {
      const res = await fetchWithRetry(url);
      if (res.status !== 200) { await sleep(500); continue; }

      const json = JSON.parse(res.data.toString("utf-8"));
      const pages = json?.query?.pages;
      if (!pages) { await sleep(500); continue; }

      for (const page of Object.values(pages)) {
        if (!page.missing && page.imageinfo?.[0]?.thumburl) {
          return {
            title: page.title,
            thumburl: page.imageinfo[0].thumburl,
            width: page.imageinfo[0].thumbwidth,
            height: page.imageinfo[0].thumbheight,
            size: page.imageinfo[0].size,
          };
        }
      }
    } catch {
      // continue to next title
    }
    await sleep(500);
  }
  return null;
}

/**
 * Search Wikimedia Commons for coat of arms files.
 */
async function searchForCoatOfArms(municipalityName) {
  const cleanName = municipalityName
    .replace(/\s*\([^)]*\)/g, "") // strip parenthetical suffixes
    .trim();

  const queries = [
    `wapen ${cleanName}`,
    `coat of arms ${cleanName}`,
    `gemeentewapen ${cleanName}`,
  ];

  for (const query of queries) {
    const url = `${COMMONS_API}?action=query&list=search&srnamespace=6&srsearch=${encodeURIComponent(query)}&srlimit=5&format=json`;

    try {
      const res = await fetchWithRetry(url);
      if (res.status !== 200) continue;

      const json = JSON.parse(res.data.toString("utf-8"));
      const results = json?.query?.search || [];

      // Find the first SVG result that looks like a coat of arms
      for (const result of results) {
        const title = result.title;
        if (title.endsWith(".svg") &&
            (title.toLowerCase().includes("wapen") ||
             title.toLowerCase().includes("coat of arms") ||
             title.toLowerCase().includes("gemeentewapen"))) {
          // Get the thumbnail for this file
          const fileTitle = title.replace("File:", "");
          const info = await queryFileInfo([fileTitle]);
          if (info) return info;
        }
      }
    } catch {
      // ignore search errors
    }
    await sleep(100);
  }

  return null;
}

/**
 * Download an image from a URL to a file path.
 */
async function downloadImage(imageUrl, outPath) {
  const res = await fetchUrl(imageUrl);
  if (res.status === 200 && res.data.length > 500) {
    fs.writeFileSync(outPath, res.data);
    return res.data.length;
  }
  return 0;
}

// ── Name Variant Generation ──────────────────────────────────────────

function getFilenameCandidates(name) {
  // Check manual overrides first
  if (FILE_OVERRIDES[name]) {
    return FILE_OVERRIDES[name];
  }

  const candidates = [];

  // Clean name: strip parenthetical suffixes like "(O.)" or "(ZH.)"
  const cleanName = name.replace(/\s*\([^)]*\)/g, "").trim();

  // Primary patterns
  candidates.push(`${cleanName} wapen.svg`);
  candidates.push(`Coat of arms of ${cleanName}.svg`);
  candidates.push(`Gemeentewapen ${cleanName}.svg`);
  candidates.push(`Wapen van ${cleanName}.svg`);

  // If name has special characters, also try ASCII-ified versions
  const asciiName = cleanName
    .replace(/â/g, "a")
    .replace(/ú/g, "u")
    .replace(/ë/g, "e")
    .replace(/ï/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u");

  if (asciiName !== cleanName) {
    candidates.push(`${asciiName} wapen.svg`);
    candidates.push(`Coat of arms of ${asciiName}.svg`);
  }

  // For names starting with "'s-", also try without the prefix
  if (cleanName.startsWith("'s-")) {
    const shortName = cleanName.substring(3);
    candidates.push(`${shortName} wapen.svg`);
  }

  return candidates;
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log("  SCRAPE MUNICIPALITY COATS OF ARMS (Gemeentewapens)");
  console.log("  Source: Wikimedia Commons (public domain SVG → PNG)");
  console.log("=".repeat(60) + "\n");

  fs.mkdirSync(LOGOS_DIR, { recursive: true });

  const index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8"));
  console.log(`Processing ${index.length} municipalities...\n`);

  const logoMap = {};
  let stats = { direct: 0, search: 0, existing: 0, failed: 0 };

  for (let i = 0; i < index.length; i++) {
    const muni = index[i];
    const outPath = path.join(LOGOS_DIR, `${muni.slug}.png`);
    const logoPath = `/images/municipalities/${muni.slug}.png`;

    // Skip if already exists and is a proper image (> 3KB, not a favicon)
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 3000) {
      logoMap[muni.slug] = logoPath;
      stats.existing++;
      continue;
    }

    let found = false;

    // Try direct file name patterns (one at a time with rate limiting)
    const candidates = getFilenameCandidates(muni.name);

    try {
      const info = await queryFileInfo(candidates);
      if (info) {
        const size = await downloadImage(info.thumburl, outPath);
        if (size > 500) {
          logoMap[muni.slug] = logoPath;
          stats.direct++;
          found = true;
          console.log(`  [${i + 1}/${index.length}] OK: ${muni.name} → ${info.title.replace("File:", "")} (${size}b)`);
        }
      }
    } catch (err) {
      // ignore individual errors
    }

    // Fallback: search API
    if (!found) {
      await sleep(500);
      try {
        const info = await searchForCoatOfArms(muni.name);
        if (info) {
          const size = await downloadImage(info.thumburl, outPath);
          if (size > 500) {
            logoMap[muni.slug] = logoPath;
            stats.search++;
            found = true;
            console.log(`  [${i + 1}/${index.length}] OK (search): ${muni.name} → ${info.title.replace("File:", "")} (${size}b)`);
          }
        }
      } catch {
        // ignore
      }
    }

    if (!found) {
      stats.failed++;
      console.log(`  [${i + 1}/${index.length}] FAIL: ${muni.name}`);
    }
  }

  // Write logo mapping
  const sorted = Object.fromEntries(
    Object.entries(logoMap).sort(([a], [b]) => a.localeCompare(b))
  );
  fs.writeFileSync(LOGOS_JSON, JSON.stringify(sorted, null, 2) + "\n", "utf-8");

  console.log(`\n${"=".repeat(60)}`);
  console.log("  DONE");
  console.log(`  Direct: ${stats.direct}, Search: ${stats.search}, Existing: ${stats.existing}, Failed: ${stats.failed}`);
  console.log(`  ${Object.keys(sorted).length} coats of arms saved to ${LOGOS_JSON}`);
  console.log("=".repeat(60));
}

main().catch(console.error);
