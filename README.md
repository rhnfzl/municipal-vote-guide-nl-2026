# 🗳️ Municipal Vote Guide NL 2026

An open-source, bilingual (Dutch/English) vote matching tool for the **2026 Dutch municipal elections** (Gemeenteraadsverkiezingen, March 18, 2026).

Covers **all 258 municipalities** in the Netherlands with **71,136 party positions** across **7,742 policy statements**.

## Features

- **Interactive Questionnaire** — Answer agree/disagree/neither on your municipality's policy statements
- **Dealbreaker Questions** — Mark critical issues; choose strict (eliminate) or weighted (3x) mode
- **Issue Weighting** — Tune results by increasing weight of topics you care most about
- **Party Match Results** — Ranked matches with per-question breakdown and party explanations
- **2D Political Compass** — Visualize your political position relative to all parties
- **Party Comparison** — Side-by-side comparison of 2-4 parties on every statement
- **Share Results** — Generate shareable images for Twitter/X, Instagram Stories, LinkedIn, Square
- **Bilingual** — Full Dutch and English support with language toggle
- **Dark Mode** — System-aware with manual toggle
- **Explore** — Browse national statistics: most common themes and parties across all municipalities
- **Mobile-first** — Responsive design optimized for all devices

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **UI:** shadcn/ui + Tailwind CSS
- **Charts:** Recharts
- **i18n:** next-intl (NL/EN)
- **Hosting:** Vercel
- **Translation:** OpenAI gpt-5-mini (Responses API)

## Data

All data was extracted from the official StemWijzer (ProDemos) for the 2026 municipal elections:
- 258 unique municipalities
- 2,446 party entries (864 unique party names)
- 7,742 policy statements
- 71,136 party-statement positions

Top parties nationally: CDA (257 municipalities), VVD (245), D66 (193), GroenLinks-PvdA (143), ChristenUnie (105).

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Production build
npm test             # Run tests
npm run lint         # Lint code
```

## Disclaimer

This is an independent open-source project. It is **not affiliated** with ProDemos, StemWijzer, or any political party. The data is sourced from publicly available municipal election information.

## License

MIT
