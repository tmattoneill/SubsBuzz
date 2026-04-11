-- SubsBuzz incremental schema migrations
-- All statements MUST be idempotent (IF NOT EXISTS / IF EXISTS).
-- This file is re-run on every deploy — it must never drop data.
-- Append new migrations at the bottom with a comment indicating when they were added.

-- ── 2025-Q4: OAuth session token persistence ─────────────────────────────────
ALTER TABLE oauth_tokens
  ADD COLUMN IF NOT EXISTS session_token      TEXT,
  ADD COLUMN IF NOT EXISTS session_expires_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_session_token
  ON oauth_tokens (session_token);

-- ── 2026-Q1: user_settings profile fields ────────────────────────────────────
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name  TEXT,
  ADD COLUMN IF NOT EXISTS location   TEXT;

-- ── 2026-Q1: thematic_digests daily summary field ─────────────────────────────
ALTER TABLE thematic_digests
  ADD COLUMN IF NOT EXISTS daily_summary TEXT;

-- ── 2026-Q1: digest_emails enrichment fields ──────────────────────────────────
ALTER TABLE digest_emails
  ADD COLUMN IF NOT EXISTS source  TEXT,
  ADD COLUMN IF NOT EXISTS snippet TEXT;
