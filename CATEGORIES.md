# Categories — Design Doc

> **Status:** In progress on branch `features/categories`.
> **Parent Linear issue:** [TEEPER-105](https://linear.app/teemo-personal-projects/issue/TEEPER-105)
> **Delete this file when the feature ships** (or move to `docs/` as reference).

---

## Context

SubsBuzz currently lets users add email senders to a `monitored_emails` list, but offers no way to classify those senders. A daily Celery job pulls messages from each sender, OpenAI summarizes each one, and a thematic processor clusters the day's emails into AI-derived themes. Themes are emergent and non-deterministic; users have no stable "collections" view.

This feature adds a single user-assigned **category** per sender (e.g. Finance, Tech, Travel). Categories act as:

- **Collections** — a stable sidebar nav, spanning all historical digests.
- **Filter chips** — an in-digest filter row above the article grid.
- **Badges** — a Fast Company-style eyebrow label on each article card / article view.

Categories are user-scoped and lazy-seeded with 10 defaults:

1. General News
2. Culture & Entertainment
3. Industry News
4. Finance
5. Retail & Commerce
6. Travel
7. Science & Technology
8. Programming & Software
9. Consumer Electronics
10. Food & Dining

Users can rename, recolor, reorder, add, and delete. AI / thematic processing is **not changed in v1** — categories are purely metadata/UX.

---

## Scope decisions

| # | Decision |
|---|---|
| 1 | **Categories are user-scoped**; lazy-seeded on first `GET /api/email-categories`. |
| 2 | **Add-sender flow** = single modal: email + category dropdown with inline "+ Create new category". Category required for new senders. |
| 3 | **Filtering** = BOTH in-digest client-side chip filter AND dedicated `/category/:slug` collection route. |
| 4 | **AI interaction** = none in v1. Thematic processor untouched. |
| 5 | **Migration** = `category_id` nullable; existing senders keep NULL; dismissible in-app banner nudges categorization. |
| 6 | **Nav** = new "Collections" sidebar section listing user's categories; new top-level "Email Handling" section with Senders + Categories sub-views. |

### Opinionated decisions (push back if wrong)

- **Slugs are immutable after creation.** Renaming "Finance" → "Money" keeps slug `finance`, so `/category/finance` never 404s. Display name updates everywhere via FK join; URL is a stable key. Slug collisions on create return 409 → user picks a distinct name.
- **Hybrid storage on `digest_emails`**: both `category_id` FK (`ON DELETE SET NULL`) *and* denormalized `category_name_snapshot` + `category_slug_snapshot` text columns. Rationale: a deleted sender shouldn't orphan historical articles from the collection view; renames propagate via FK; deletes fall back to the snapshot. Cost is two cheap text columns per row.
- **Banner dismissal via `localStorage`**, not a new `userSettings` column. Soft nudge, not critical state.

---

## Phased implementation checklist

### Phase 0 — Setup

- [x] Branch `features/categories` from `main`
- [x] This design doc (`CATEGORIES.md`)
- [ ] Linear sub-issues linked under TEEPER-105
- [ ] devctx todos mirroring Linear

### Phase 1 — Schema + migration
*Linear: [TEEPER-115](https://linear.app/teemo-personal-projects/issue/TEEPER-115)*

- [ ] Add `emailCategories` table to `services/data-server/src/db/schema.ts`
- [ ] Add `categoryId` FK + index to `monitoredEmails`
- [ ] Add `categoryId` FK + `categoryNameSnapshot` + `categorySlugSnapshot` to `digestEmails`
- [ ] Raw SQL in `infrastructure/postgres/migrate.sql` (ALTER TABLE approach, not drizzle-kit)
- [ ] Mirror DDL to `infrastructure/postgres/init.sql` for fresh environments
- [ ] Apply locally: `psql -d subsbuzz_dev -f infrastructure/postgres/migrate.sql`

### Phase 2 — Data-server API
*Linear: [TEEPER-116](https://linear.app/teemo-personal-projects/issue/TEEPER-116)*

- [ ] New `services/data-server/src/services/category-defaults.ts` with 10-category constant
- [ ] New `services/data-server/src/routes/email-categories.ts` — CRUD with lazy seed
- [ ] Register routes in `services/data-server/src/index.ts`
- [ ] Extend `POST /api/storage/monitored-emails` to accept `categoryId` (validate ownership)
- [ ] Add `PATCH /api/storage/monitored-emails/:id` (currently missing; required)
- [ ] Add `GET /api/storage/digests/by-category/:userId/:categorySlug` with FK + snapshot OR'd lookup
- [ ] Extend `EmailInput` type in `services/data-server/src/services/openai.ts` with `categoryId`
- [ ] In digest create path, bulk-resolve `categoryId → {name, slug}` once per digest and populate snapshots

### Phase 3 — API Gateway
*Linear: [TEEPER-117](https://linear.app/teemo-personal-projects/issue/TEEPER-117)*

- [ ] New `services/api-gateway/routes/email_categories.py` — mirror data-server routes with `get_current_user` + ownership checks
- [ ] Register at `/api/email-categories` in `services/api-gateway/main.py`
- [ ] Extend `MonitoredEmailRequest` in `services/api-gateway/routes/monitored_emails.py` with `category_id: Optional[int]`
- [ ] Add PATCH endpoint to `services/api-gateway/routes/monitored_emails.py`
- [ ] Add `GET /api/digests/by-category/{slug}` (new `collections.py` or extend `digest.py`)

### Phase 4 — Email worker
*Linear: [TEEPER-118](https://linear.app/teemo-personal-projects/issue/TEEPER-118)*

- [ ] Build `sender → category_id` dict at `services/email-worker/tasks.py:208`
- [ ] Extract bare-address normalization helper (reuse from `content_extractor.py` / `gmail_client.py` if present; otherwise write one with a unit test)
- [ ] Attach `category_id` per email in `email_dict` (around line 258–266)
- [ ] Forward `category_id` in digest-create payload (line 306)

### Phase 5 — Frontend: Email Handling
*Linear: [TEEPER-119](https://linear.app/teemo-personal-projects/issue/TEEPER-119)*

- [ ] New route `/email-handling` in `services/frontend/src/App.tsx` with child `/senders` (default) and `/categories`
- [ ] New `services/frontend/src/pages/email-handling.tsx` (tab container)
- [ ] New `services/frontend/src/pages/email-handling-senders.tsx` — list with category badge column + inline reassignment Select. **Keep today's table style; TEEPER-40 full redesign is out of scope** (leave `// TEEPER-40` comment).
- [ ] New `services/frontend/src/pages/email-handling-categories.tsx` — CRUD with inline rename, color picker, delete-confirm. Drag-to-reorder deferred (sortOrder is in schema for v2).
- [ ] New `services/frontend/src/components/categories/CategoryBadge.tsx`
- [ ] New `services/frontend/src/components/categories/CategorySelect.tsx`
- [ ] New `services/frontend/src/components/settings/add-sender-modal.tsx` — replaces add-sender portion of `config-modal.tsx`. Email + CategorySelect + inline "+ Create new category" mini-dialog.
- [ ] New `services/frontend/src/hooks/useCategories.ts` — React Query wrapper around `/api/email-categories`
- [ ] Extend `services/frontend/src/lib/types.ts` with `EmailCategory` + extend `MonitoredEmail` and article types with `categoryId?`, `categoryName?`, `categorySlug?`

### Phase 6 — Frontend: Digest + Collection + Sidebar
*Linear: [TEEPER-120](https://linear.app/teemo-personal-projects/issue/TEEPER-120)*

- [ ] Add "Email Handling" top-level nav entry in `services/frontend/src/components/layout/Sidebar.tsx`
- [ ] Add "Collections" section in Sidebar rendering `useCategories()` as NavLinks to `/category/:slug`
- [ ] New `services/frontend/src/pages/category-collection.tsx` — fetches `/api/digests/by-category/:slug`, renders ArticleCard grid
- [ ] Add `/category/:slug` route in `App.tsx`
- [ ] Insert chip-filter row in `services/frontend/src/pages/digest.tsx` above article grid (around 312–346)
- [ ] Add category badge (Fast Company eyebrow) to `services/frontend/src/components/digest/ArticleCard.tsx`
- [ ] Add category label to `services/frontend/src/components/digest/ArticleView.tsx` metadata row

### Phase 7 — Banner + QA + tests
*Linear: [TEEPER-121](https://linear.app/teemo-personal-projects/issue/TEEPER-121)*

- [ ] One-time categorization banner in top-level layout (shown when any monitored email has null `categoryId`; dismissal via `localStorage['subsbuzz.categorizationBannerDismissed']`)
- [ ] Integration tests added to `tests/test-data-server.js` (see Verification below)
- [ ] End-to-end manual QA locally + on dev.subsbuzz.com
- [ ] Remove `CATEGORIES.md` (or move to `docs/`)

---

## Schema (reference)

### DDL — raw SQL for `infrastructure/postgres/migrate.sql`

```sql
CREATE TABLE IF NOT EXISTS email_categories (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  color TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT email_categories_user_name_unique UNIQUE (user_id, name),
  CONSTRAINT email_categories_user_slug_unique UNIQUE (user_id, slug)
);
CREATE INDEX IF NOT EXISTS email_categories_user_idx ON email_categories(user_id);

ALTER TABLE monitored_emails
  ADD COLUMN IF NOT EXISTS category_id INTEGER
  REFERENCES email_categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS monitored_emails_category_idx ON monitored_emails(category_id);

ALTER TABLE digest_emails
  ADD COLUMN IF NOT EXISTS category_id INTEGER
    REFERENCES email_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category_name_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS category_slug_snapshot TEXT;
CREATE INDEX IF NOT EXISTS digest_emails_category_slug_idx
  ON digest_emails(category_slug_snapshot);
```

### Drizzle shape — `services/data-server/src/db/schema.ts`

```ts
export const emailCategories = pgTable("email_categories", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  color: text("color"),
  isDefault: boolean("is_default").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  unique("email_categories_user_name_unique").on(t.userId, t.name),
  unique("email_categories_user_slug_unique").on(t.userId, t.slug),
]);
```

Plus:
- `monitoredEmails` → add `categoryId: integer("category_id").references(() => emailCategories.id, { onDelete: "set null" })`
- `digestEmails` → add `categoryId` (same FK), `categoryNameSnapshot: text("category_name_snapshot")`, `categorySlugSnapshot: text("category_slug_snapshot")`

### `by-category` query shape

```sql
SELECT de.* FROM digest_emails de
JOIN email_digests ed ON ed.id = de.digest_id
WHERE ed.user_id = $1
  AND (de.category_slug_snapshot = $2
       OR de.category_id IN (SELECT id FROM email_categories WHERE user_id=$1 AND slug=$2))
ORDER BY de.received_at DESC LIMIT $3;
```

---

## Verification

### Manual end-to-end (local via `./start-all.sh`)

1. Apply migration: `psql -d subsbuzz_dev -f infrastructure/postgres/migrate.sql`. Verify the three tables/columns.
2. `GET /api/email-categories` (authed) → 10 defaults. Call again → still 10 (idempotency).
3. Create "Indie Zines" via POST. PATCH to "Zines" → name updates, slug stays `indie-zines`.
4. Add a sender via modal with category "Finance" → `monitored_emails.category_id` populated.
5. Trigger manual digest → inspect `digest_emails` — `category_id` + snapshot fields set.
6. Open `/digest` → chip row shows in-digest categories → click "Finance" → only matching cards visible.
7. Sidebar "Finance" → `/category/finance` → historical list populated.
8. **Rename test:** "Finance" → "Money". New rows snapshot "Money"; old rows still snapshot "Finance"; `/category/finance` still resolves (slug immutability).
9. **Delete test:** delete "Money" → `monitored_emails.category_id` → NULL; old `digest_emails` snapshots retained; collection route still works.
10. Banner appears for any user with null-category senders; dismissal persists across reloads.

### Integration tests (`tests/test-data-server.js`)

- Lazy seed idempotency (two GETs → 10 rows, not 20).
- POST duplicate name → 409.
- Cross-user isolation: user A cannot read/modify user B's categories or assign user B's category to their own sender.
- DELETE → `SET NULL` on `monitored_emails.category_id` and `digest_emails.category_id`; snapshot columns retained on `digest_emails`.

### Deploy verification

After `./deploy.sh`, run the remote test suite per CLAUDE.md's "Remote (dev server)" block to catch env-drift regressions.

---

## Known risks / follow-ups

- **Sender normalization.** Gmail sends `"Name <addr>"`; `monitored_emails` stores bare addresses. The worker's sender → category lookup depends on correct normalization on both sides. Reuse existing parsing if available; otherwise write a focused helper with a unit test — don't inline.
- **New senders require a category; legacy senders don't.** Edit flow should prompt (not block) when opening an uncategorized sender. Banner stays until all senders are categorized.
- **Thematic processor divergence.** AI themes and user categories will visibly differ on the digest page. Acceptable for v1; worth a v2 follow-up to inject category as a clustering hint.
- **No URL state for chip filter in v1.** Filter resets on reload. Promote to URL query param if users ask.

---

## File manifest (critical paths)

**Data layer**
- `services/data-server/src/db/schema.ts`
- `infrastructure/postgres/migrate.sql` (+ `init.sql`)
- `services/data-server/src/services/category-defaults.ts` (new)
- `services/data-server/src/services/openai.ts`

**API**
- `services/data-server/src/routes/email-categories.ts` (new)
- `services/data-server/src/routes/storage.ts`
- `services/api-gateway/routes/email_categories.py` (new)
- `services/api-gateway/routes/monitored_emails.py`
- `services/api-gateway/routes/collections.py` (new) + `main.py`

**Worker**
- `services/email-worker/tasks.py`

**Frontend**
- `services/frontend/src/App.tsx`
- `services/frontend/src/components/layout/Sidebar.tsx`
- `services/frontend/src/pages/email-handling.tsx` + `email-handling-senders.tsx` + `email-handling-categories.tsx` (new)
- `services/frontend/src/pages/category-collection.tsx` (new)
- `services/frontend/src/pages/digest.tsx`
- `services/frontend/src/components/settings/add-sender-modal.tsx` (new)
- `services/frontend/src/components/categories/CategoryBadge.tsx` + `CategorySelect.tsx` (new)
- `services/frontend/src/components/digest/ArticleCard.tsx` + `ArticleView.tsx`
- `services/frontend/src/hooks/useCategories.ts` (new)
- `services/frontend/src/lib/types.ts`
