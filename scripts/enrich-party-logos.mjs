#!/usr/bin/env node
/**
 * Enrich Party Logos
 * Multi-source logo fetcher for Dutch political parties.
 * Sources (in priority order):
 *   1. StemWijzer CDN (actual party logos from raw data)
 *   2. Google Favicon API (128px favicons)
 *   3. Clearbit Logo API (company logos)
 *   4. Direct website favicon
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";
import http from "http";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const RAW_DIR = path.join(ROOT, "data", "raw");
const INDEX_PATH = path.join(ROOT, "data", "index.json");
const PUBLIC_INDEX = path.join(ROOT, "public", "data", "index.json");
const LOGOS_DIR = path.join(ROOT, "public", "images", "parties");
const LOGOS_JSON = path.join(ROOT, "src", "lib", "party-logos.json");

// Known national party names that should share logos with suffixed variants
const NATIONAL_PARTIES = [
  "CDA", "VVD", "D66", "PVV", "SP", "SGP", "FvD", "FVD", "BBB", "NSC",
  "DENK", "Denk", "BVNL", "BIJ1", "JA21", "Volt", "VOLT",
  "ChristenUnie", "GroenLinks", "PvdA", "PvdD",
  "50PLUS", "50Plus", "FNP", "Piratenpartij", "LEF",
];

// ── Helpers ──────────────────────────────────────────────────────────

function fetchUrl(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error("too many redirects"));
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; VoteGuideBot/1.0)" }, timeout: 15000 }, (res) => {
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

function getDomain(website) {
  try {
    let url = website.trim();
    if (!url.startsWith("http")) url = "https://" + url;
    return new URL(url).hostname;
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Hash to detect Google's generic globe favicon
let genericGlobeHash = null;

function isGenericGlobe(data) {
  if (!genericGlobeHash) return false;
  const hash = crypto.createHash("md5").update(data).digest("hex");
  return hash === genericGlobeHash;
}

// ── Phase 1: Build Party Registry ────────────────────────────────────

function buildPartyRegistry() {
  console.log("Phase 1: Building party registry from raw data...\n");

  const index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8"));
  const parties = new Map(); // name -> { id, logoFile, website, count, slug }

  for (const entry of index) {
    const rawPath = path.join(RAW_DIR, `${entry.source}.json`);
    if (!fs.existsSync(rawPath)) continue;

    const data = JSON.parse(fs.readFileSync(rawPath, "utf-8"));
    if (!data.parties) continue;

    for (const p of data.parties) {
      if (parties.has(p.name)) {
        parties.get(p.name).count++;
      } else {
        parties.set(p.name, {
          id: p.id,
          logoFile: p.logo || null,
          website: p.website || "",
          count: 1,
          slug: slugifyParty(p.name),
        });
      }
    }
  }

  // Sort by count descending
  const sorted = [...parties.entries()].sort((a, b) => b[1].count - a[1].count);
  console.log(`  Found ${sorted.length} unique parties`);
  console.log(`  Top 10: ${sorted.slice(0, 10).map(([n, d]) => `${n}(${d.count})`).join(", ")}\n`);

  return new Map(sorted);
}

// ── Phase 2: Probe StemWijzer CDN ────────────────────────────────────

async function probeStemWijzerCDN(parties) {
  console.log("Phase 2: Probing for StemWijzer CDN...\n");

  // Get a few known party entries to test
  const testParties = [];
  for (const [name, data] of parties) {
    if (data.logoFile && testParties.length < 5) {
      testParties.push({ name, ...data });
    }
  }

  const cdnPatterns = [
    "https://stemwijzer.nl/media/",
    "https://gr2026-data.stemwijzer.nl/media/",
    "https://data.stemwijzer.nl/gr2026/media/",
    "https://api.stemwijzer.nl/media/",
    "https://stemwijzer.nl/app/uploads/",
    "https://cdn.stemwijzer.nl/",
    "https://stemwijzer.nl/assets/",
    "https://gr2026.stemwijzer.nl/media/",
    "https://prodemos.nl/media/",
  ];

  for (const baseUrl of cdnPatterns) {
    for (const party of testParties) {
      const url = `${baseUrl}${party.logoFile}`;
      try {
        const res = await fetchUrl(url);
        if (res.status === 200 && res.contentType.startsWith("image") && res.data.length > 200) {
          console.log(`  CDN FOUND: ${baseUrl} (tested with ${party.name})\n`);
          return baseUrl;
        }
      } catch {
        // ignore
      }
    }
  }

  console.log("  No StemWijzer CDN URL found, skipping CDN source\n");
  return null;
}

// ── Phase 3: Fetch Logos ─────────────────────────────────────────────

async function fetchFromCDN(baseUrl, logoFile, outPath) {
  try {
    const res = await fetchUrl(`${baseUrl}${logoFile}`);
    if (res.status === 200 && res.contentType.startsWith("image") && res.data.length > 200) {
      fs.writeFileSync(outPath, res.data);
      return { ok: true, source: "CDN", size: res.data.length };
    }
  } catch { /* ignore */ }
  return { ok: false };
}

async function fetchFromGoogle(domain, outPath) {
  try {
    const url = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    const res = await fetchUrl(url);
    if (res.status === 200 && res.data.length > 200) {
      // Fingerprint the first generic globe we see
      if (genericGlobeHash === null && res.data.length >= 700 && res.data.length <= 800) {
        // This might be the generic globe. We'll check if it looks like a default.
        // We'll set it after seeing a "known good" domain first.
      }
      if (isGenericGlobe(res.data)) {
        return { ok: false, reason: "generic globe" };
      }
      fs.writeFileSync(outPath, res.data);
      return { ok: true, source: "Google", size: res.data.length };
    }
  } catch { /* ignore */ }
  return { ok: false };
}

async function fetchFromClearbit(domain, outPath) {
  try {
    const url = `https://logo.clearbit.com/${domain}`;
    const res = await fetchUrl(url);
    if (res.status === 200 && res.contentType.startsWith("image") && res.data.length > 500) {
      fs.writeFileSync(outPath, res.data);
      return { ok: true, source: "Clearbit", size: res.data.length };
    }
  } catch { /* ignore */ }
  return { ok: false };
}

async function fetchDirectFavicon(domain, outPath) {
  try {
    const url = `https://${domain}/favicon.ico`;
    const res = await fetchUrl(url);
    if (res.status === 200 && res.data.length > 200) {
      fs.writeFileSync(outPath, res.data);
      return { ok: true, source: "Direct", size: res.data.length };
    }
  } catch { /* ignore */ }
  return { ok: false };
}

async function fetchLogos(parties, cdnBaseUrl) {
  console.log("Phase 3: Fetching logos...\n");

  fs.mkdirSync(LOGOS_DIR, { recursive: true });

  // Capture the generic globe hash from a domain we know has no favicon
  try {
    const res = await fetchUrl("https://www.google.com/s2/favicons?domain=this-domain-does-not-exist-12345.example&sz=128");
    if (res.status === 200 && res.data.length > 0) {
      genericGlobeHash = crypto.createHash("md5").update(res.data).digest("hex");
      console.log(`  Generic globe hash: ${genericGlobeHash} (${res.data.length} bytes)\n`);
    }
  } catch { /* ignore */ }

  const logoMap = {};
  let stats = { cdn: 0, google: 0, clearbit: 0, direct: 0, existing: 0, failed: 0 };
  let processed = 0;
  const total = parties.size;

  for (const [name, data] of parties) {
    processed++;
    const slug = data.slug;
    const outPath = path.join(LOGOS_DIR, `${slug}.png`);
    const logoPath = `/images/parties/${slug}.png`;

    // Skip if already exists
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 100) {
      logoMap[name] = logoPath;
      stats.existing++;
      continue;
    }

    const domain = getDomain(data.website);
    let result = { ok: false };

    // Source 1: StemWijzer CDN
    if (!result.ok && cdnBaseUrl && data.logoFile) {
      result = await fetchFromCDN(cdnBaseUrl, data.logoFile, outPath);
      if (result.ok) stats.cdn++;
    }

    // Source 2: Google Favicon API
    if (!result.ok && domain) {
      result = await fetchFromGoogle(domain, outPath);
      if (result.ok) stats.google++;
    }

    // Source 3: Clearbit Logo API
    if (!result.ok && domain) {
      result = await fetchFromClearbit(domain, outPath);
      if (result.ok) stats.clearbit++;
    }

    // Source 4: Direct favicon
    if (!result.ok && domain) {
      result = await fetchDirectFavicon(domain, outPath);
      if (result.ok) stats.direct++;
    }

    if (result.ok) {
      logoMap[name] = logoPath;
      if (processed % 50 === 0 || data.count >= 5) {
        console.log(`  [${processed}/${total}] OK: ${name} (${result.source}, ${result.size}b, ${data.count} municipalities)`);
      }
    } else {
      stats.failed++;
      if (data.count >= 3) {
        console.log(`  [${processed}/${total}] FAIL: ${name} (${data.count} municipalities, domain: ${domain || "none"})`);
      }
    }

    // Rate limit
    if (!result.ok || result.source !== "existing") {
      await sleep(150);
    }
  }

  console.log(`\n  Results: ${Object.keys(logoMap).length} logos total`);
  console.log(`    CDN: ${stats.cdn}, Google: ${stats.google}, Clearbit: ${stats.clearbit}, Direct: ${stats.direct}`);
  console.log(`    Existing: ${stats.existing}, Failed: ${stats.failed}\n`);

  return logoMap;
}

// ── Phase 4: Build Aliases ───────────────────────────────────────────

function buildAliases(logoMap) {
  console.log("Phase 4: Building name variant aliases...\n");

  let aliasCount = 0;

  // For each national party, if we have its logo, alias suffixed variants
  for (const nationalName of NATIONAL_PARTIES) {
    const nationalSlug = slugifyParty(nationalName);
    const nationalPath = `/images/parties/${nationalSlug}.png`;
    const nationalFile = path.join(LOGOS_DIR, `${nationalSlug}.png`);

    if (!fs.existsSync(nationalFile)) continue;

    // Add the canonical name if not already there
    if (!logoMap[nationalName]) {
      logoMap[nationalName] = nationalPath;
      aliasCount++;
    }

    // Scan all parties for suffixed variants like "CDA Montferland"
    for (const [name] of Object.entries(logoMap)) {
      // Already mapped
    }
  }

  // Cross-reference: find parties whose names start with a known national party
  // and map them to the national party logo if they don't have their own
  const allPartyNames = Object.keys(logoMap);
  for (const nationalName of NATIONAL_PARTIES) {
    const nationalSlug = slugifyParty(nationalName);
    const nationalPath = `/images/parties/${nationalSlug}.png`;
    const nationalFile = path.join(LOGOS_DIR, `${nationalSlug}.png`);
    if (!fs.existsSync(nationalFile)) continue;

    // We don't add aliases for all possible suffixes here since we already
    // downloaded logos for all parties. The aliases are mainly for variant names
    // that appear differently but are the same party.
  }

  // Known manual aliases - same party, different name formats
  const manualAliases = {
    "Forum voor Democratie": "fvd",
    "FVD": "fvd",
    "FvD": "fvd",
    "VOLT": "volt",
    "Volt": "volt",
    "50Plus": "50plus",
    "50PLUS": "50plus",
    "Denk": "denk",
    "DENK": "denk",
    "CU": "christenunie",
    "Partij voor de Dieren": "pvdd",
    "PvdD": "pvdd",
    "PvdA": "pvda",
    "Partij van de Arbeid (PvdA)": "pvda",
    "SP (Socialistische Partij)": "sp",
    "PVV (Partij voor de Vrijheid)": "pvv",
    "Staatkundig Gereformeerde Partij (SGP)": "sgp",
    "SGP-ChristenUnie": "sgp-christenunie",
    "ChristenUnie-SGP": "christenunie-sgp",
    "Nieuw Sociaal Contract": "nsc",
    "NSC": "nsc",
    "GroenLinks-PvdA": "groenlinks-pvda",
    "GL/PvdA": "gl-pvda",
    "GL-PvdA": "gl-pvda",
    "PvdA-GroenLinks": "pvda-groenlinks",
    "GROENLINKS / Partij van de Arbeid (PvdA)": "groenlinks-pvda",
    "GemeenteBelangen": "gemeentebelangen",
    "Gemeentebelang": "gemeentebelangen",
    "BIJ1": "bij1",
    "BVNL": "bvnl",
    "BBB": "bbb",
    "BurgerBelangen": "burgerbelangen",
    "Lokaal Belang": "lokaal-belang",
    "Lokaal Liberaal": "lokaal-liberaal",
    "LEF": "lef",
    "ELLECT": "ellect",
    "Piratenpartij": "piratenpartij",
    "FNP": "fnp",
  };

  for (const [alias, slug] of Object.entries(manualAliases)) {
    const logoPath = `/images/parties/${slug}.png`;
    const logoFile = path.join(LOGOS_DIR, `${slug}.png`);
    if (fs.existsSync(logoFile) && !logoMap[alias]) {
      logoMap[alias] = logoPath;
      aliasCount++;
    }
  }

  console.log(`  Added ${aliasCount} aliases\n`);
  return logoMap;
}

// ── Phase 5: Write Results ───────────────────────────────────────────

function writeResults(logoMap) {
  console.log("Phase 5: Writing party-logos.json...\n");

  // Sort by key
  const sorted = Object.fromEntries(
    Object.entries(logoMap).sort(([a], [b]) => a.localeCompare(b))
  );

  fs.writeFileSync(LOGOS_JSON, JSON.stringify(sorted, null, 2) + "\n", "utf-8");
  console.log(`  Written ${Object.keys(sorted).length} entries to ${LOGOS_JSON}\n`);
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log("=" .repeat(60));
  console.log("  ENRICH PARTY LOGOS");
  console.log("=".repeat(60) + "\n");

  const parties = buildPartyRegistry();
  const cdnBaseUrl = await probeStemWijzerCDN(parties);
  const logoMap = await fetchLogos(parties, cdnBaseUrl);
  const enrichedMap = buildAliases(logoMap);
  writeResults(enrichedMap);

  // Summary
  const totalParties = parties.size;
  const withLogos = Object.keys(enrichedMap).length;
  const uniqueFiles = new Set(Object.values(enrichedMap)).size;

  console.log("=".repeat(60));
  console.log("  DONE");
  console.log(`  ${withLogos} logo entries (${uniqueFiles} unique files)`);
  console.log(`  ${totalParties} unique parties in dataset`);
  console.log("=".repeat(60));
}

main().catch(console.error);
