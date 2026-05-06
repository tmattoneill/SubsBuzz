"""
Re-evaluate every digest_emails.hero_image_url against the byte-level
text-dominant heuristic and NULL out the ones that look like screenshots,
title cards, code snippets, etc.

One-shot operational script. Run after rolling out the Path B / extended
alt-blacklist work to clean the existing data — text-detect runs at
worker extraction time, not at render, so legacy rows otherwise keep
their bad heroes forever.

Run from your LOCAL machine (or via SSH on the server) with the target
DATABASE_URL exported. Requires:

    pip3 install --user psycopg2-binary aiohttp Pillow

Usage:

    # Dry run (default) — prints what WOULD be nulled, doesn't write:
    DATABASE_URL=$(grep '^DATABASE_URL=' ../../.env.local | cut -d= -f2-) \\
        python3 scripts/backfill_text_dominant_heroes.py

    # Apply changes:
    DATABASE_URL=... python3 scripts/backfill_text_dominant_heroes.py --apply

Run from `services/email-worker/` so the `content_extractor` import resolves.

Failure policy mirrors the live verifier: fetch errors keep the candidate
(no NULL written). Better to leave a maybe-bad hero than to nuke a row
because the publisher CDN was momentarily flaky.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from typing import List, Optional, Tuple

import aiohttp
import psycopg2
import psycopg2.extras

# Resolve content_extractor whether invoked as a module or a script.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from content_extractor import ContentExtractor  # noqa: E402

FETCH_TIMEOUT_SECONDS = 5
FETCH_MAX_BYTES = 512 * 1024
FETCH_CONCURRENCY = 8  # bounded — don't hammer publisher CDNs


async def _fetch_bytes(session: aiohttp.ClientSession, url: str) -> Optional[bytes]:
    try:
        async with session.get(url) as resp:
            if resp.status != 200:
                return None
            body = await resp.content.read(FETCH_MAX_BYTES + 1)
            if len(body) > FETCH_MAX_BYTES:
                return None
            return body
    except Exception:
        return None


async def _evaluate_one(
    session: aiohttp.ClientSession,
    sem: asyncio.Semaphore,
    row_id: int,
    url: str,
) -> Tuple[int, str, str]:
    """Return (id, verdict, url) where verdict is 'text', 'keep', or 'fetch_failed'."""
    async with sem:
        body = await _fetch_bytes(session, url)
    if body is None:
        return row_id, 'fetch_failed', url
    if ContentExtractor._is_text_dominant_image(body):
        return row_id, 'text', url
    return row_id, 'keep', url


async def _evaluate_all(rows: List[Tuple[int, str]]) -> List[Tuple[int, str, str]]:
    timeout = aiohttp.ClientTimeout(total=FETCH_TIMEOUT_SECONDS)
    headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; SubsBuzz/2.0; +https://subsbuzz.com)',
        'Accept': 'image/*,*/*;q=0.5',
    }
    sem = asyncio.Semaphore(FETCH_CONCURRENCY)
    async with aiohttp.ClientSession(timeout=timeout, headers=headers) as session:
        return await asyncio.gather(*(
            _evaluate_one(session, sem, row_id, url) for row_id, url in rows
        ))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        '--apply',
        action='store_true',
        help='Actually UPDATE rows. Default is a dry-run that just prints verdicts.',
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=None,
        help='Cap rows examined (useful for smoke-testing on prod before the full run).',
    )
    args = parser.parse_args()

    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        print('ERROR: DATABASE_URL not set', file=sys.stderr)
        sys.exit(1)

    conn = psycopg2.connect(database_url)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            sql = (
                "SELECT id, hero_image_url FROM digest_emails "
                "WHERE hero_image_url IS NOT NULL "
                "ORDER BY id ASC"
            )
            if args.limit:
                sql += f" LIMIT {int(args.limit)}"
            cur.execute(sql)
            rows = [(r['id'], r['hero_image_url']) for r in cur.fetchall()]

        print(f"Examining {len(rows)} rows with hero_image_url …")
        results = asyncio.run(_evaluate_all(rows))

        text_ids = [rid for rid, verdict, _ in results if verdict == 'text']
        kept = sum(1 for _, verdict, _ in results if verdict == 'keep')
        failed = sum(1 for _, verdict, _ in results if verdict == 'fetch_failed')

        print(f"  text-dominant (would null): {len(text_ids)}")
        print(f"  kept                      : {kept}")
        print(f"  fetch-failed (kept)       : {failed}")

        if text_ids:
            print('\nText-dominant rows:')
            for rid, verdict, url in results:
                if verdict == 'text':
                    print(f"  id={rid}  {url[:120]}")

        if not args.apply:
            print('\n(dry-run; rerun with --apply to UPDATE)')
            return

        if not text_ids:
            print('\nNothing to update.')
            return

        with conn.cursor() as cur:
            cur.execute(
                "UPDATE digest_emails SET hero_image_url = NULL "
                "WHERE id = ANY(%s)",
                (text_ids,),
            )
            conn.commit()
            print(f"\nUPDATEd {cur.rowcount} rows (hero_image_url set to NULL).")
    finally:
        conn.close()


if __name__ == '__main__':
    main()
