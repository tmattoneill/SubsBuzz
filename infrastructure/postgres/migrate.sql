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

-- ── 2026-Q2: digest_emails rich HTML article body ─────────────────────────────
-- Per-email summaryHtml: ~300–400 words of structured HTML produced by the AI
-- alongside the existing 100-word plain-text `summary`. Rendered as the
-- per-article detail body in place of the raw `full_content` text (which
-- varies wildly across senders and leaked CSS on Substack). Nullable:
-- pre-feature rows fall back to wrapping the plain `summary` in <p>.
ALTER TABLE digest_emails
  ADD COLUMN IF NOT EXISTS summary_html TEXT;

-- ── 2026-Q2: user-assigned sender categories (TEEPER-105) ─────────────────────
-- User-scoped category table. Lazy-seeded with 10 defaults on first GET
-- /api/email-categories. Slugs are immutable after create so /category/:slug
-- URLs never 404 on rename. Unique on (user_id, name) and (user_id, slug).
CREATE TABLE IF NOT EXISTS email_categories (
  id         SERIAL PRIMARY KEY,
  user_id    TEXT NOT NULL,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL,
  color      TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT email_categories_user_name_unique UNIQUE (user_id, name),
  CONSTRAINT email_categories_user_slug_unique UNIQUE (user_id, slug)
);
CREATE INDEX IF NOT EXISTS email_categories_user_idx
  ON email_categories (user_id);

-- monitored_emails: per-sender category. Nullable; existing rows keep NULL
-- until the user categorises them via the banner / edit flow.
ALTER TABLE monitored_emails
  ADD COLUMN IF NOT EXISTS category_id INTEGER
  REFERENCES email_categories (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS monitored_emails_category_idx
  ON monitored_emails (category_id);

-- digest_emails: hybrid storage — FK for live lookups + snapshot text columns
-- so the Collections page keeps working after a category is renamed or deleted.
-- Snapshots are written at digest-create time and never mutated after.
ALTER TABLE digest_emails
  ADD COLUMN IF NOT EXISTS category_id INTEGER
    REFERENCES email_categories (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category_name_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS category_slug_snapshot TEXT;
CREATE INDEX IF NOT EXISTS digest_emails_category_slug_idx
  ON digest_emails (category_slug_snapshot);

-- ── 2026-Q2: LLM provider selection (TEEPER-139) ──────────────────────────────
-- Default 'deepseek' uses the server-side DEEPSEEK_API_KEY. 'openai' uses the
-- per-user key in openai_api_key. Future values: 'anthropic' | 'gemini' |
-- 'grok' | 'ollama'. Legacy openai_api_key column retained for one release.
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS llm_provider TEXT NOT NULL DEFAULT 'deepseek';

-- One-time modal flag so the frontend can show the "we switched default to
-- DeepSeek" notice exactly once per existing user who has an OpenAI key saved.
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS llm_migration_notice_seen BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: users who already saved a personal OpenAI key stay on OpenAI. They
-- chose that deliberately and are paying for those tokens — silently moving
-- them to DeepSeek would change their digest output between deploy and their
-- next login. New users land on 'deepseek' from the column default above.
-- Guard: only touches users who haven't dismissed the modal yet
-- (llm_migration_notice_seen = FALSE). Once they've made a choice, their
-- provider setting is theirs to own — this UPDATE must never override it.
UPDATE user_settings
   SET llm_provider = 'openai'
 WHERE openai_api_key IS NOT NULL
   AND length(openai_api_key) > 0
   AND llm_provider = 'deepseek'
   AND llm_migration_notice_seen = FALSE;

-- ── 2026-Q2: smart sender parsing (subscriptions) ────────────────────────────
-- A single sender address (monitored_emails row) can fan out into multiple
-- newsletters — NYT Cooking, Wirecutter and DealBook all ship from
-- nytdirect@nytimes.com. Subscriptions carry the subscription_key derived from
-- List-Id (Tier 1) or falling back to from_address (Tier 5) and own the
-- category, so siblings under one sender can sit in different categories.
-- Category on monitored_emails becomes a fallback when a subscription has no
-- category of its own.
CREATE TABLE IF NOT EXISTS subscriptions (
  id                     SERIAL PRIMARY KEY,
  user_id                TEXT NOT NULL,
  sender_id              INTEGER NOT NULL REFERENCES monitored_emails(id) ON DELETE CASCADE,
  subscription_key       TEXT NOT NULL,
  subscription_key_tier  SMALLINT NOT NULL,            -- 1 = list_id, 5 = from_address
  display_name           TEXT NOT NULL,
  display_name_source    TEXT NOT NULL,                -- 'list_id' | 'from_name' | 'registry' | 'user_override' | 'from_address'
  category_id            INTEGER REFERENCES email_categories(id) ON DELETE SET NULL,
  category_source        TEXT NOT NULL,                -- 'registry' | 'heuristic' | 'inherited_from_sender' | 'user' | 'none'
  category_confidence    REAL,
  first_seen_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  message_count          INTEGER NOT NULL DEFAULT 0,
  user_confirmed         BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT subscriptions_user_key_unique UNIQUE (user_id, subscription_key)
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_sender
  ON subscriptions (sender_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_category
  ON subscriptions (user_id, category_id);

-- digest_emails: link each row back to its subscription + preserve the raw
-- parsed header signals (List-Id etc.) for future re-derivation, v2 ESP
-- parsers, and debugging. Nullable — pre-feature rows and the backfill script
-- populate subscription_id as a best-effort Tier-5 derivation.
ALTER TABLE digest_emails
  ADD COLUMN IF NOT EXISTS subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signals_json    JSONB;
CREATE INDEX IF NOT EXISTS idx_digest_emails_subscription
  ON digest_emails (subscription_id);

-- monitored_emails: track when the user dismissed the split-detection banner
-- for this sender (either via "Looks good" / "Adjust" buttons, explicit close,
-- or the 48h auto-dismiss). NULL = banner eligible to show.
ALTER TABLE monitored_emails
  ADD COLUMN IF NOT EXISTS split_banner_dismissed_at TIMESTAMPTZ;

-- split_locked: user explicitly collapsed this sender's children via "Keep as
-- one". resolveSubscription forces Tier-5 derivation (from address) for any
-- future inbound message, ignoring List-Id entirely. Protects against noisy
-- publishers whose List-Id varies per message but who always represent the
-- same newsletter (e.g. breakingnews@nytimes.com).
ALTER TABLE monitored_emails
  ADD COLUMN IF NOT EXISTS split_locked BOOLEAN NOT NULL DEFAULT FALSE;
