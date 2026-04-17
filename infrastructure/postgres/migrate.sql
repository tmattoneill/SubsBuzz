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

-- ── 2026-Q2: inbox cleanup feature (TEEPER-42) ────────────────────────────────
-- digest_emails: persist the Gmail message ID so the worker can act on it post-digest.
-- Nullable: pre-feature rows stay NULL and are skipped by cleanup tasks.
ALTER TABLE digest_emails
  ADD COLUMN IF NOT EXISTS gmail_message_id TEXT;

-- user_settings: per-user choice of what to do with sources after they're digested.
-- Action enum: 'none' | 'mark_read' | 'mark_read_archive' | 'mark_read_label_archive' | 'trash'.
-- Default 'none' preserves existing behaviour for users who never visit settings.
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS inbox_cleanup_action     TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS inbox_cleanup_label_name TEXT DEFAULT 'SubsBuzz';

-- ── 2026-Q2: digest_emails hero image extraction ──────────────────────────────
-- Worker extracts a likely hero image URL from raw email HTML at ingestion time
-- (content_extractor.extract_hero_image). Nullable: when no suitable image
-- survives the filters (logos / tracking / masthead excluded) the field stays
-- NULL and the frontend falls back to keyword-keyed stock imagery.
ALTER TABLE digest_emails
  ADD COLUMN IF NOT EXISTS hero_image_url TEXT;
