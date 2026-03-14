#!/usr/bin/env node
/**
 * Scrape Party Logos
 * Fetches logos/favicons from party websites.
 * Uses Google Favicon API as reliable source for high-quality favicons.
 * Falls back to direct website favicon if available.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";
import http from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const INDEX_PATH = path.join(ROOT, "public", "data", "index.json");
const LOGOS_DIR = path.join(ROOT, "public", "images", "parties");

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 10000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirect
        fetchUrl(res.headers.location).then(resolve).catch(reject);
        return;
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, data: Buffer.concat(chunks), contentType: res.headers["content-type"] }));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
  });
}

function getDomain(website) {
  try {
    let url = website.trim();
    if (!url.startsWith("http")) url = "https://" + url;
    const u = new URL(url);
    return u.hostname;
  } catch {
    return null;
  }
}

function slugifyParty(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50);
}

async function main() {
  console.log("=== Scraping Party Logos ===\n");

  fs.mkdirSync(LOGOS_DIR, { recursive: true });

  // Collect unique parties with websites
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8"));
  const parties = new Map(); // name -> { website, slug }

  for (const entry of index) {
    const dataPath = path.join(ROOT, "public", "data", "municipalities", entry.slug, "nl.json");
    const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
    for (const p of data.parties) {
      if (p.website && !parties.has(p.name)) {
        parties.set(p.name, { website: p.website, slug: slugifyParty(p.name) });
      }
    }
  }

  console.log(`Found ${parties.size} unique parties with websites\n`);

  // Only process parties that appear in 3+ municipalities (reduces to ~50)
  const counts = {};
  for (const entry of index) {
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, "public", "data", "municipalities", entry.slug, "nl.json"), "utf-8"));
    for (const p of data.parties) {
      counts[p.name] = (counts[p.name] || 0) + 1;
    }
  }

  const toProcess = [...parties.entries()]
    .filter(([name]) => (counts[name] || 0) >= 3)
    .sort((a, b) => (counts[b[0]] || 0) - (counts[a[0]] || 0));

  console.log(`Processing ${toProcess.length} parties (appearing in 3+ municipalities)\n`);

  const logoMap = {};
  let success = 0;
  let failed = 0;

  for (const [name, { website, slug }] of toProcess) {
    const domain = getDomain(website);
    if (!domain) {
      console.log(`  SKIP: ${name} (invalid URL: ${website})`);
      failed++;
      continue;
    }

    const outPath = path.join(LOGOS_DIR, `${slug}.png`);

    // Skip if already downloaded
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 100) {
      logoMap[name] = `/images/parties/${slug}.png`;
      success++;
      continue;
    }

    // Try Google Favicon API (most reliable, returns 128px PNG)
    const googleUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

    try {
      const res = await fetchUrl(googleUrl);
      if (res.status === 200 && res.data.length > 100) {
        fs.writeFileSync(outPath, res.data);
        logoMap[name] = `/images/parties/${slug}.png`;
        console.log(`  OK: ${name} (${domain}) -> ${slug}.png (${res.data.length} bytes)`);
        success++;
      } else {
        console.log(`  FAIL: ${name} (${domain}) -> status ${res.status}`);
        failed++;
      }
    } catch (err) {
      console.log(`  ERROR: ${name} (${domain}) -> ${err.message}`);
      failed++;
    }

    // Small delay
    await new Promise(r => setTimeout(r, 200));
  }

  // Save logo mapping
  const mapPath = path.join(ROOT, "src", "lib", "party-logos.json");
  fs.writeFileSync(mapPath, JSON.stringify(logoMap, null, 2), "utf-8");

  console.log(`\n${"=".repeat(60)}`);
  console.log(`DONE: ${success} logos downloaded, ${failed} failed`);
  console.log(`Logo map saved to ${mapPath}`);
  console.log(`${"=".repeat(60)}`);
}

main().catch(console.error);
