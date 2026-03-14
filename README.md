# 🗳️ Municipal Vote Guide NL 2026

[![Live Site](https://img.shields.io/badge/Live-municipal--vote--guide--nl--2026.vercel.app-2563eb?style=for-the-badge&logo=vercel&logoColor=white)](https://municipal-vote-guide-nl-2026.vercel.app)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![Municipalities](https://img.shields.io/badge/Municipalities-258-green?style=flat-square)](https://municipal-vote-guide-nl-2026.vercel.app/en/explore)
[![Bilingual](https://img.shields.io/badge/Languages-NL%20%7C%20EN-orange?style=flat-square)](https://municipal-vote-guide-nl-2026.vercel.app)
![Repo Visitors](https://api.visitorbadge.io/api/visitors?path=rhnfzl%2Fmunicipal-vote-guide-nl-2026&label=Repo%20Visitors&countColor=%232563eb&style=flat-square)

An open-source, **fully bilingual (Dutch/English)** vote matching tool for the **2026 Dutch municipal elections** (Gemeenteraadsverkiezingen, March 18, 2026).

Covers **all 258 municipalities** in the Netherlands with **79,000+ translated party explanations** across **7,742 policy statements**.

🌐 **Live:** [municipal-vote-guide-nl-2026.vercel.app](https://municipal-vote-guide-nl-2026.vercel.app)

---

## Features

### Core Questionnaire
- **Interactive Questionnaire** - Answer agree/disagree/neither on your municipality's policy statements
- **3-Tab Info System** - "What do parties think?" / "Learn more" / "Arguments" (matching StemWijzer)
- **Glossary Tooltips** - Inline definitions for political terms (ombudsman, referendum, etc.)
- **Bilingual Display** - Primary language large, alternate language shown below
- **Speed Check** - Warning if questionnaire completed too quickly

### Post-Questionnaire Flow
- **Important Topics** - Select up to 3 themes for 2x scoring weight
- **Party Filter** - Choose which parties to include (all / incumbent / custom)
- **Tie-breaker Shootout** - Extra questions when top parties are within 5%

### Results & Analysis
- **Party Match Results** - Ranked matches with party logos + progress bars
- **Political Profile Summary** - AI-generated description of your political stance
- **Per-Party Comparison** - Side-by-side view with party tab bar (matches StemWijzer)
- **Political Compass** - 2D scatter plot showing your position vs. parties
- **Consensus Meter** - Which topics divide parties most vs. consensus
- **"Why do I match?"** - Theme-based explanation of alignment

### Sharing & Social
- **Share Results** - Generate images for Twitter/X, Instagram Stories, LinkedIn, Square
- **Friends Comparison** - Shareable URL to compare results with friends (viral feature)
- **Print/PDF Export** - Save results for offline reference

### Explore & Data Analysis
- **National Theme Statistics** - Bar charts of most common political themes
- **BERTopic ML Analysis** - AI-powered topic modeling of 3,531 political statements
  - Topic Map (interactive scatter plot)
  - Topic Clusters (treemap visualization)
  - Topic Network (similarity graph)
- **Municipality Browser** - Search all 258 municipalities with alias support

### Design & Accessibility
- **Bilingual** - Full Dutch + English with SVG flag toggle
- **Dark Mode** - Light default with system-aware toggle
- **Mobile-first** - Responsive design for all devices
- **Party Logos** - 600+ party favicons + color initials fallback
- **Municipality Aliases** - "Den Bosch" → 's-Hertogenbosch, "The Hague" → 's-Gravenhage

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 15 (App Router) |
| **UI** | shadcn/ui + Tailwind CSS |
| **Charts** | Recharts |
| **i18n** | next-intl (NL/EN) |
| **ML** | BERTopic + OpenAI text-embedding-3-large |
| **Translation** | OpenAI gpt-5-mini + gpt-4.1-mini |
| **Hosting** | Vercel (Frankfurt fra1) |

## Data

All data scraped from the official [StemWijzer](https://stemwijzer.nl) (ProDemos) using [`nl-voting-data-scraper`](https://github.com/rhnfzl/nl-voting-data-scraper), an open-source Python package for extracting Dutch voting advice data.

| Metric | Count |
|--------|-------|
| Municipalities | 258 |
| Party entries | 2,446 (864 unique names) |
| Policy statements | 7,742 |
| Party-statement positions | 71,136 |
| Translated explanations | 79,000+ |
| Topic model clusters | 103 (via BERTopic) |
| Translation cache | 87,000+ entries |

Top parties nationally: CDA (257), VVD (245), D66 (193), GroenLinks-PvdA (143), ChristenUnie (105).

### Data Pipeline

The full data pipeline uses [`nl-voting-data-scraper`](https://github.com/rhnfzl/nl-voting-data-scraper) to fetch raw data from StemWijzer, then transforms, translates, and enriches it:

```
nl-voting-data-scraper       prepare-data.ts         translate-*.mjs
   (scrape StemWijzer)  -->  (transform & index)  -->  (NL -> EN)
        data/raw/           public/data/municipalities/
```

```bash
# 1. Install the scraper
pip install nl-voting-data-scraper

# 2. Scrape all 258 municipalities from StemWijzer
npm run data:scrape

# 3. Transform raw data into optimized per-municipality JSON
npm run data:prepare

# Or run both steps together:
npm run data:pipeline
```

The scraper supports scraping specific municipalities, resuming interrupted runs, and multiple election types:

```bash
# Scrape specific municipalities
python scripts/scrape-stemwijzer.py -m GM0014 -m GM0363

# Resume an interrupted scrape
python scripts/scrape-stemwijzer.py --resume

# List available elections
python scripts/scrape-stemwijzer.py --list-elections
```

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Production build
npm test             # Run unit tests
npm run test:e2e     # Run Playwright E2E tests
npm run lint         # Lint code

# Data pipeline
npm run data:scrape    # Scrape StemWijzer via nl-voting-data-scraper
npm run data:prepare   # Transform raw data for the app
npm run data:pipeline  # Run full pipeline (scrape + prepare)
```

## Privacy

**We do not store any personal data.** All questionnaire answers are kept in your browser's session storage and are never sent to any server. The app works entirely client-side after loading the municipality data.

## Disclaimer

This is an independent open-source project. It is **not affiliated** with ProDemos, StemWijzer, or any political party. The data is sourced from publicly available municipal election information.

## License

[MIT](LICENSE)
