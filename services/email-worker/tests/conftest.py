"""
Shared fixtures + helpers for email-worker tests.

Runs with `pytest services/email-worker/tests` from the repo root, or
`pytest tests` from services/email-worker. Adds the parent dir to sys.path
so `import content_extractor` works without packaging the worker.
"""

import email
import os
import sys
from email import policy
from pathlib import Path

import pytest

WORKER_DIR = Path(__file__).resolve().parent.parent
FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
SNAPSHOTS_DIR = FIXTURES_DIR / "snapshots"

if str(WORKER_DIR) not in sys.path:
    sys.path.insert(0, str(WORKER_DIR))


def load_eml_html(fixture_name: str) -> str:
    """Load a .eml fixture and return its first text/html part decoded as str.

    Gmail API gives us decoded HTML directly in production, so this mirrors
    that shape — tests should operate on the same input the extractor sees
    at runtime.
    """
    path = FIXTURES_DIR / fixture_name
    with path.open("rb") as f:
        msg = email.message_from_bytes(f.read(), policy=policy.default)

    for part in msg.walk():
        if part.get_content_type() == "text/html":
            return part.get_content()

    for part in msg.walk():
        if part.get_content_type() == "text/plain":
            return part.get_content()

    raise AssertionError(f"No text/html or text/plain part in {fixture_name}")


def assert_snapshot(name: str, actual: str) -> None:
    """Compare `actual` to a stored snapshot. Set UPDATE_SNAPSHOTS=1 to write.

    Snapshots live at fixtures/snapshots/<name>.txt. Missing snapshots are
    written automatically on first run so the first green run establishes
    the baseline. Subsequent runs diff against it.
    """
    SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    path = SNAPSHOTS_DIR / f"{name}.txt"

    if os.environ.get("UPDATE_SNAPSHOTS") == "1" or not path.exists():
        path.write_text(actual, encoding="utf-8")
        if not path.exists():
            pytest.fail(f"Failed to write snapshot {path}")
        return

    expected = path.read_text(encoding="utf-8")
    if actual != expected:
        diff_path = path.with_suffix(".actual.txt")
        diff_path.write_text(actual, encoding="utf-8")
        pytest.fail(
            f"Snapshot mismatch for {name}.\n"
            f"  expected: {path}\n"
            f"  actual:   {diff_path}\n"
            f"  Re-baseline with: UPDATE_SNAPSHOTS=1 pytest"
        )
