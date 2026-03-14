#!/usr/bin/env node
/**
 * Scrape Municipality Logos (Coats of Arms / Gemeentewapens)
 * Fetches Dutch municipality coats of arms from Wikipedia/Wikimedia Commons.
 *
 * Sources (in priority order):
 *   1. Dutch Wikipedia "Wapen van {name}" pages
 *   2. English Wikipedia "{name}" municipality pages
 *   3. Dutch Wikipedia "{name}" pages (direct)
 *   4. Google Favicon API from gemeente website
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

// ── Helpers ──────────────────────────────────────────────────────────

function fetchUrl(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error("too many redirects"));
    const client = https;
    const req = client.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; VoteGuideBot/1.0)" },
      timeout: 15000,
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
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Wikipedia API Fetcher ────────────────────────────────────────────

async function fetchWikiPageImage(lang, title, thumbSize = 256) {
  const encodedTitle = encodeURIComponent(title);
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodedTitle}&prop=pageimages&format=json&pithumbsize=${thumbSize}&redirects=1`;

  try {
    const res = await fetchUrl(url);
    if (res.status !== 200) return null;

    const json = JSON.parse(res.data.toString("utf-8"));
    const pages = json?.query?.pages;
    if (!pages) return null;

    for (const page of Object.values(pages)) {
      if (page.thumbnail?.source) {
        return page.thumbnail.source;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

async function downloadImage(imageUrl, outPath) {
  try {
    const res = await fetchUrl(imageUrl);
    if (res.status === 200 && res.data.length > 200) {
      fs.writeFileSync(outPath, res.data);
      return res.data.length;
    }
  } catch {
    // ignore
  }
  return 0;
}

// ── Name Variants for Wikipedia Lookup ───────────────────────────────

function getWikiSearchVariants(name) {
  const variants = [];

  // "Wapen van X" on Dutch Wikipedia (coat of arms pages)
  variants.push({ lang: "nl", title: `Wapen van ${name}` });

  // Direct municipality page on Dutch Wikipedia
  variants.push({ lang: "nl", title: `${name} (gemeente)` });
  variants.push({ lang: "nl", title: name });

  // English Wikipedia
  variants.push({ lang: "en", title: `${name} (municipality)` });
  variants.push({ lang: "en", title: name });

  // Special cases for names with apostrophes or special chars
  if (name.startsWith("'s-")) {
    const cleanName = name.replace("'s-", "'s-");
    variants.push({ lang: "nl", title: `Wapen van ${cleanName}` });
  }

  return variants;
}

// ── Google Favicon Fallback ──────────────────────────────────────────

async function fetchGoogleFavicon(municipalityName, outPath) {
  // Try common gemeente website patterns
  const slugged = municipalityName.toLowerCase()
    .replace(/['']/g, "")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9-]/g, "");

  const domains = [
    `gemeente${slugged}.nl`,
    `${slugged}.nl`,
    `www.${slugged}.nl`,
  ];

  for (const domain of domains) {
    try {
      const url = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
      const res = await fetchUrl(url);
      if (res.status === 200 && res.data.length > 300) {
        fs.writeFileSync(outPath, res.data);
        return { ok: true, size: res.data.length, domain };
      }
    } catch {
      // ignore
    }
  }
  return { ok: false };
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log("  SCRAPE MUNICIPALITY LOGOS (Coats of Arms)");
  console.log("=".repeat(60) + "\n");

  fs.mkdirSync(LOGOS_DIR, { recursive: true });

  const index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8"));
  console.log(`Processing ${index.length} municipalities...\n`);

  const logoMap = {};
  let stats = { wiki: 0, google: 0, existing: 0, failed: 0 };

  for (let i = 0; i < index.length; i++) {
    const muni = index[i];
    const outPath = path.join(LOGOS_DIR, `${muni.slug}.png`);
    const logoPath = `/images/municipalities/${muni.slug}.png`;

    // Skip if already exists
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 200) {
      logoMap[muni.slug] = logoPath;
      stats.existing++;
      continue;
    }

    let found = false;

    // Try Wikipedia sources
    const variants = getWikiSearchVariants(muni.name);
    for (const { lang, title } of variants) {
      const imageUrl = await fetchWikiPageImage(lang, title);
      if (imageUrl) {
        const size = await downloadImage(imageUrl, outPath);
        if (size > 200) {
          logoMap[muni.slug] = logoPath;
          stats.wiki++;
          found = true;
          console.log(`  [${i + 1}/${index.length}] OK (Wiki): ${muni.name} (${size}b, ${lang}:${title})`);
          break;
        }
      }
      await sleep(100); // Be nice to Wikipedia API
    }

    // Fallback: Google Favicon from gemeente website
    if (!found) {
      const result = await fetchGoogleFavicon(muni.name, outPath);
      if (result.ok) {
        logoMap[muni.slug] = logoPath;
        stats.google++;
        found = true;
        console.log(`  [${i + 1}/${index.length}] OK (Google): ${muni.name} (${result.size}b, ${result.domain})`);
      }
    }

    if (!found) {
      stats.failed++;
      console.log(`  [${i + 1}/${index.length}] FAIL: ${muni.name}`);
    }

    await sleep(200); // Rate limit
  }

  // Write logo mapping
  const sorted = Object.fromEntries(
    Object.entries(logoMap).sort(([a], [b]) => a.localeCompare(b))
  );
  fs.writeFileSync(LOGOS_JSON, JSON.stringify(sorted, null, 2) + "\n", "utf-8");

  console.log(`\n${"=".repeat(60)}`);
  console.log("  DONE");
  console.log(`  Wiki: ${stats.wiki}, Google: ${stats.google}, Existing: ${stats.existing}, Failed: ${stats.failed}`);
  console.log(`  ${Object.keys(sorted).length} logos saved to ${LOGOS_JSON}`);
  console.log("=".repeat(60));
}

main().catch(console.error);
