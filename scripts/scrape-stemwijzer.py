#!/usr/bin/env python3
"""
Scrape StemWijzer data using nl-voting-data-scraper.

Downloads all municipality voting data from the official StemWijzer platform
and saves it in the format expected by prepare-data.ts.

Usage:
    # Scrape all municipalities (default: gr2026)
    python scripts/scrape-stemwijzer.py

    # Scrape a specific election
    python scripts/scrape-stemwijzer.py --election gr2026

    # Scrape specific municipalities
    python scripts/scrape-stemwijzer.py -m GM0014 -m GM0363

    # Resume interrupted scrape (uses cache)
    python scripts/scrape-stemwijzer.py --resume

    # List available elections
    python scripts/scrape-stemwijzer.py --list-elections

Requires: pip install nl-voting-data-scraper
"""

import argparse
import asyncio
import json
import sys
from collections import defaultdict
from pathlib import Path

try:
    from nl_voting_data_scraper import KNOWN_ELECTIONS, StemwijzerScraper
except ImportError:
    print(
        "Error: nl-voting-data-scraper is not installed.\n"
        "Install it with: pip install nl-voting-data-scraper\n"
        "See: https://github.com/rhnfzl/nl-voting-data-scraper",
        file=sys.stderr,
    )
    sys.exit(1)


ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"
INDEX_PATH = ROOT / "data" / "index.json"
CACHE_DIR = ROOT / ".cache" / "nl-voting-data-scraper"


def save_raw_data(data, remote_id: str, language: str) -> str:
    """Save scraped data to data/raw/ in the format expected by prepare-data.ts.

    Returns the source key for the index entry (filename without .json).
    """
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    source = f"{remote_id}-{language}"
    filename = f"{source}.json"

    # Convert Pydantic model to dict, keeping only the fields prepare-data.ts needs
    raw_dict = data.model_dump(by_alias=True)
    raw_output = {
        "parties": raw_dict.get("parties", []),
        "statements": raw_dict.get("statements", []),
        "shootoutStatements": raw_dict.get("shootoutStatements", []),
    }

    out_path = RAW_DIR / filename
    out_path.write_text(
        json.dumps(raw_output, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    return source


def build_index(entries: list[dict]) -> None:
    """Generate data/index.json from scraped metadata."""
    existing = []
    if INDEX_PATH.exists():
        try:
            existing = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            existing = []

    # Build lookup of existing entries by (remoteId, language)
    existing_map = {(e["remoteId"], e["language"]): e for e in existing}

    # Update with new entries
    for entry in entries:
        key = (entry["remoteId"], entry["language"])
        existing_map[key] = entry

    # Sort by remoteId then language for stable output
    merged = sorted(
        existing_map.values(), key=lambda e: (e["remoteId"], e["language"])
    )

    INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
    INDEX_PATH.write_text(
        json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"\n  Index written: {INDEX_PATH} ({len(merged)} entries)")


async def scrape_election(
    election: str,
    municipalities: list[str] | None = None,
    resume: bool = False,
) -> None:
    """Scrape all municipality data for the given election."""
    index_entries = []
    success_count = 0
    skip_count = 0
    fail_count = 0

    # Enable file cache when resuming, disable otherwise
    cache_dir = CACHE_DIR if resume else None

    async with StemwijzerScraper(election, cache_dir=cache_dir) as scraper:
        # Fetch the index to discover all municipalities and their available languages
        full_index = await scraper.fetch_index()

        # Build a map: remoteId -> list of available languages
        lang_map: dict[str, list[str]] = defaultdict(list)
        for entry in full_index:
            lang_map[entry.remoteId].append(entry.language)

        # Determine which municipalities to scrape
        if municipalities:
            targets = municipalities
        else:
            # Deduplicate: unique remoteIds preserving order
            seen: set[str] = set()
            targets = []
            for entry in full_index:
                if entry.remoteId not in seen:
                    seen.add(entry.remoteId)
                    targets.append(entry.remoteId)

        total = len(targets)
        print(f"  Scraping {total} municipalities for election '{election}'...")
        print(f"  Available languages in index: {dict(lang_map)}\n" if len(targets) <= 5 else "")

        for i, remote_id in enumerate(targets, 1):
            available_langs = lang_map.get(remote_id, ["nl"])

            for lang in available_langs:
                try:
                    data = await scraper.scrape_one(remote_id, language=lang)

                    if data is None:
                        skip_count += 1
                        continue

                    # Extract metadata from votematch field
                    votematch = data.votematch
                    name = votematch.name if votematch else remote_id
                    vm_id = votematch.id if votematch else 0

                    source = save_raw_data(data, remote_id, lang)

                    index_entries.append(
                        {
                            "id": vm_id,
                            "name": name,
                            "source": source,
                            "remoteId": remote_id,
                            "language": lang,
                            "decrypt": True,
                        }
                    )

                    if lang == available_langs[0]:
                        lang_info = (
                            f" [{', '.join(available_langs)}]"
                            if len(available_langs) > 1
                            else ""
                        )
                        parties = len(data.parties)
                        stmts = len(data.statements)
                        print(
                            f"  [{i}/{total}] {name} ({remote_id})"
                            f" - {parties} parties, {stmts} statements{lang_info}"
                        )

                    success_count += 1

                except Exception as e:
                    if lang == available_langs[0]:
                        print(
                            f"  [{i}/{total}] {remote_id}-{lang} - FAILED: {e}",
                            file=sys.stderr,
                        )
                    fail_count += 1

    if index_entries:
        build_index(index_entries)

    print(f"\n{'=' * 60}")
    print("SCRAPING COMPLETE")
    print(f"  Succeeded: {success_count}")
    print(f"  Skipped:   {skip_count} (language not available)")
    print(f"  Failed:    {fail_count}")
    print(f"  Raw data:  {RAW_DIR}")
    print(f"{'=' * 60}")


def list_elections() -> None:
    """List available elections."""
    print("Available elections:\n")
    for slug, config in KNOWN_ELECTIONS.items():
        print(f"  {slug:<12} {config.description}")


def main():
    parser = argparse.ArgumentParser(
        description="Scrape StemWijzer data using nl-voting-data-scraper",
    )
    parser.add_argument(
        "--election",
        "-e",
        default="gr2026",
        help="Election slug (default: gr2026). Use --list-elections to see options.",
    )
    parser.add_argument(
        "-m",
        "--municipality",
        action="append",
        dest="municipalities",
        help="Specific municipality GM code (repeatable, e.g. -m GM0014 -m GM0363)",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume interrupted scrape (uses file cache)",
    )
    parser.add_argument(
        "--list-elections",
        action="store_true",
        help="List available elections and exit",
    )

    args = parser.parse_args()

    print("nl-voting-data-scraper - StemWijzer Data Pipeline\n")

    if args.list_elections:
        list_elections()
        return

    asyncio.run(
        scrape_election(
            election=args.election,
            municipalities=args.municipalities,
            resume=args.resume,
        )
    )

    print("\nNext step: npx ts-node scripts/prepare-data.ts")


if __name__ == "__main__":
    main()
