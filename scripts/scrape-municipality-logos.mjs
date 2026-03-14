#!/usr/bin/env node
/**
 * Scrape Municipality Coats of Arms (Gemeentewapens)
 * Downloads heraldic coats of arms from Wikimedia Commons.
 *
 * Uses Wikimedia REST API v1 (api.wikimedia.org) to find files,
 * then downloads PNG thumbnails from the CDN.
 *
 * All Dutch municipal coats of arms are public domain (PD-NL-gemeentewapen).
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

const REST_API = "https://api.wikimedia.org/core/v1/commons/file";
const THUMB_WIDTH = 256;
const USER_AGENT = "VoteGuideBot/2.0 (https://github.com/rhnfzl/municipal-vote-guide-nl-2026; bot-traffic@example.com)";

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

// ── Wikimedia REST API ───────────────────────────────────────────────

/**
 * Query a file via the Wikimedia REST API v1.
 * Returns thumbnail URL if file exists, null otherwise.
 */
async function getFileThumbUrl(filename) {
  const encodedFile = encodeURIComponent(`File:${filename.replace(/ /g, "_")}`);
  const url = `${REST_API}/${encodedFile}`;

  try {
    const res = await fetchUrl(url);
    if (res.status === 200) {
      const json = JSON.parse(res.data.toString("utf-8"));
      const thumbUrl = json?.thumbnail?.url;
      if (thumbUrl) {
        // Replace the default width with our desired width
        return thumbUrl.replace(/\/\d+px-/, `/${THUMB_WIDTH}px-`);
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Download a thumbnail via commons thumb.php (not the CDN).
 * This endpoint is separate from the CDN and has different rate limits.
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
      console.log("    Rate limited, waiting 15s...");
      await sleep(15000);
    }
  } catch {
    // ignore
  }
  return 0;
}

// ── Filename Candidates ──────────────────────────────────────────────

const FILE_OVERRIDES = {
  "'s-Gravenhage": ["'s-Gravenhage wapen.svg", "Coat of arms of The Hague.svg"],
  "'s-Hertogenbosch": ["'s-Hertogenbosch wapen.svg"],
  "Hengelo (O.)": ["Hengelo wapen.svg"],
  "Rijswijk (ZH.)": ["Rijswijk wapen.svg"],
  "Middelburg (Z.)": ["Middelburg wapen.svg"],
  "Beek (L.)": ["Beek (Limburg) wapen.svg"],
  "Stein (L.)": ["Stein wapen.svg"],
  "Noardeast-Fryslân": ["Noardeast-Fryslan wapen.svg"],
  "Dijk en Waard": ["Gemeentewapen Dijk en Waard.svg"],
};

function getFilenameCandidates(name) {
  if (FILE_OVERRIDES[name]) return FILE_OVERRIDES[name];

  const cleanName = name.replace(/\s*\([^)]*\)/g, "").trim();
  const candidates = [
    `${cleanName} wapen.svg`,
    `Coat of arms of ${cleanName}.svg`,
    `Gemeentewapen ${cleanName}.svg`,
    `Wapen van ${cleanName}.svg`,
  ];

  // ASCII variants
  const asciiName = cleanName
    .replace(/â/g, "a").replace(/ú/g, "u").replace(/ë/g, "e")
    .replace(/ï/g, "i").replace(/ö/g, "o").replace(/ü/g, "u");
  if (asciiName !== cleanName) {
    candidates.push(`${asciiName} wapen.svg`);
  }

  return candidates;
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log("  SCRAPE MUNICIPALITY COATS OF ARMS (Gemeentewapens)");
  console.log("  Source: Wikimedia Commons REST API v1 + CDN");
  console.log("=".repeat(60) + "\n");

  fs.mkdirSync(LOGOS_DIR, { recursive: true });

  const index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8"));
  console.log(`Processing ${index.length} municipalities...\n`);

  const logoMap = {};
  let stats = { downloaded: 0, existing: 0, failed: 0 };
  const failures = [];

  for (let i = 0; i < index.length; i++) {
    const muni = index[i];
    const outPath = path.join(LOGOS_DIR, `${muni.slug}.png`);
    const logoPath = `/images/municipalities/${muni.slug}.png`;

    // Skip if already exists and is a proper coat of arms (> 3KB)
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 3000) {
      logoMap[muni.slug] = logoPath;
      stats.existing++;
      continue;
    }

    const candidates = getFilenameCandidates(muni.name);
    let found = false;

    for (const filename of candidates) {
      // Download directly via thumb.php (bypasses CDN rate limits)
      const size = await downloadThumbPHP(filename, outPath);
      if (size > 1000) {
        logoMap[muni.slug] = logoPath;
        stats.downloaded++;
        found = true;
        console.log(`  [${i + 1}/${index.length}] OK: ${muni.name} → ${filename} (${size}b)`);
        break;
      }
      await sleep(1500);
    }

    if (!found) {
      stats.failed++;
      failures.push(muni.name);
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
  console.log(`  Downloaded: ${stats.downloaded}, Existing: ${stats.existing}, Failed: ${stats.failed}`);
  console.log(`  ${Object.keys(sorted).length} coats of arms saved`);
  if (failures.length > 0 && failures.length <= 30) {
    console.log(`\n  Failed municipalities:`);
    failures.forEach((f) => console.log(`    - ${f}`));
  }
  console.log("=".repeat(60));
}

main().catch(console.error);
