/**
 * Database Schema - SubsBuzz Data Server
 * PostgreSQL schema definitions using Drizzle ORM
 */

import { pgTable, text, serial, integer, smallint, real, boolean, timestamp, jsonb, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Schema for user-scoped sender categories (TEEPER-105).
// Lazy-seeded with 10 defaults on first GET. Slugs are immutable after create
// (renames update `name` only) so /category/:slug URLs never 404.
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

export const insertEmailCategorySchema = createInsertSchema(emailCategories).pick({
  userId: true,
  name: true,
  slug: true,
  color: true,
  isDefault: true,
  sortOrder: true,
});

export type InsertEmailCategory = z.infer<typeof insertEmailCategorySchema>;
export type EmailCategory = typeof emailCategories.$inferSelect;

// Schema for monitored email addresses
export const monitoredEmails = pgTable("monitored_emails", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  email: text("email").notNull(),
  active: boolean("active").notNull().default(true),
  // Nullable for pre-feature rows; new senders set via the add-sender modal.
  // Subscription-level category takes precedence; this is the fallback default.
  categoryId: integer("category_id").references(() => emailCategories.id, { onDelete: "set null" }),
  // Split-detection banner dismissal timestamp (smart sender parsing). NULL =
  // banner eligible when sender has ≥2 subscriptions. Set by "Looks good" /
  // "Adjust" / explicit close / 48h auto-dismiss.
  splitBannerDismissedAt: timestamp("split_banner_dismissed_at", { withTimezone: true }),
  // splitLocked: user collapsed this sender's subscriptions via "Keep as one"
  // — resolveSubscription forces Tier 5 for any future inbound message,
  // ignoring List-Id, so a noisy publisher can't re-split the same newsletter.
  splitLocked: boolean("split_locked").notNull().default(false),
}, (t) => [unique("monitored_emails_user_email_unique").on(t.userId, t.email)]);

export const insertMonitoredEmailSchema = createInsertSchema(monitoredEmails).pick({
  userId: true,
  email: true,
  active: true,
  categoryId: true,
});

export type InsertMonitoredEmail = z.infer<typeof insertMonitoredEmailSchema>;
export type MonitoredEmail = typeof monitoredEmails.$inferSelect;

// Subscriptions: derived newsletter identities under a monitored_emails parent.
// subscription_key is List-Id (Tier 1) when present, else the raw from address
// (Tier 5). One sender can own many subscriptions, each with its own category.
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  senderId: integer("sender_id").notNull().references(() => monitoredEmails.id, { onDelete: "cascade" }),
  subscriptionKey: text("subscription_key").notNull(),
  subscriptionKeyTier: smallint("subscription_key_tier").notNull(),
  displayName: text("display_name").notNull(),
  displayNameSource: text("display_name_source").notNull(),
  categoryId: integer("category_id").references(() => emailCategories.id, { onDelete: "set null" }),
  categorySource: text("category_source").notNull(),
  categoryConfidence: real("category_confidence"),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  messageCount: integer("message_count").notNull().default(0),
  userConfirmed: boolean("user_confirmed").notNull().default(false),
}, (t) => [unique("subscriptions_user_key_unique").on(t.userId, t.subscriptionKey)]);

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  firstSeenAt: true,
  lastSeenAt: true,
});

export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;

// Schema for email digests
export const emailDigests = pgTable("email_digests", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: timestamp("date").notNull().defaultNow(),
  emailsProcessed: integer("emails_processed").notNull(),
  topicsIdentified: integer("topics_identified").notNull(),
});

export const insertEmailDigestSchema = createInsertSchema(emailDigests).pick({
  userId: true,
  date: true,
  emailsProcessed: true,
  topicsIdentified: true,
});

export type InsertEmailDigest = z.infer<typeof insertEmailDigestSchema>;
export type EmailDigest = typeof emailDigests.$inferSelect;

// Schema for digest emails
export const digestEmails = pgTable("digest_emails", {
  id: serial("id").primaryKey(),
  digestId: integer("digest_id").notNull(),
  sender: text("sender").notNull(),
  source: text("source"),             // Display name of sender (e.g. "The Washington Post")
  subject: text("subject").notNull(),
  receivedAt: timestamp("received_at").notNull(),
  snippet: text("snippet"),           // 25-word summary
  summary: text("summary").notNull(),  // ≤100-word plain-text summary — used for cards and excerpts
  summaryHtml: text("summary_html"),   // Rich ~300–400-word HTML body (h3/p/ul/li/strong/em) — rendered as the article. Nullable for pre-feature rows.
  fullContent: text("full_content").notNull(),
  topics: text("topics").array().notNull(),
  keywords: text("keywords").array().notNull(),
  originalLink: text("original_link"),
  gmailMessageId: text("gmail_message_id"),  // Source Gmail message ID — required for post-processing cleanup. Nullable for pre-feature rows.
  heroImageUrl: text("hero_image_url"),      // Extracted hero image URL from email HTML. Nullable — set when worker finds a likely content image.
  // Category attribution (TEEPER-105). FK may be nulled by category delete,
  // but the snapshot columns preserve name/slug for historical /category/:slug
  // lookups even after the underlying category is renamed or removed.
  categoryId: integer("category_id").references(() => emailCategories.id, { onDelete: "set null" }),
  categoryNameSnapshot: text("category_name_snapshot"),
  categorySlugSnapshot: text("category_slug_snapshot"),
  // Smart sender parsing: link to the derived subscription (NYT Cooking vs
  // Wirecutter vs DealBook under nytdirect@nytimes.com) and persist the raw
  // parsed signals (List-Id, from display name, etc.) for re-derivation and
  // future v2 ESP parsers. Nullable for pre-feature rows.
  subscriptionId: integer("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
  signalsJson: jsonb("signals_json"),
});

export const insertDigestEmailSchema = createInsertSchema(digestEmails).omit({
  id: true,
});

export type InsertDigestEmail = z.infer<typeof insertDigestEmailSchema>;
export type DigestEmail = typeof digestEmails.$inferSelect;

// Schema for user settings
export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  dailyDigestEnabled: boolean("daily_digest_enabled").notNull().default(true),
  topicClusteringEnabled: boolean("topic_clustering_enabled").notNull().default(true),
  emailNotificationsEnabled: boolean("email_notifications_enabled").notNull().default(false),
  themeMode: text("theme_mode").default("system"), // "light", "dark", "system"
  themeColor: text("theme_color").default("blue"), // "blue", "green", "purple", "teal", "red", "orange"
  openaiApiKey: text("openai_api_key"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  location: text("location"),
  // Inbox cleanup: what to do with the source Gmail message after it's digested.
  // Enum: "none" | "mark_read" | "mark_read_archive" | "mark_read_label_archive" | "trash".
  // Requires gmail.modify OAuth scope when set to anything other than "none".
  inboxCleanupAction: text("inbox_cleanup_action").notNull().default("none"),
  inboxCleanupLabelName: text("inbox_cleanup_label_name").default("SubsBuzz"),
  // LLM provider selection (TEEPER-139). 'deepseek' (default) uses the server
  // DEEPSEEK_API_KEY; 'openai' uses the user's openai_api_key above. Future:
  // 'anthropic' | 'gemini' | 'grok' | 'ollama'.
  llmProvider: text("llm_provider").notNull().default("deepseek"),
  llmMigrationNoticeSeen: boolean("llm_migration_notice_seen").notNull().default(false),
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).pick({
  userId: true,
  dailyDigestEnabled: true,
  topicClusteringEnabled: true,
  emailNotificationsEnabled: true,
  themeMode: true,
  themeColor: true,
  inboxCleanupAction: true,
  inboxCleanupLabelName: true,
  llmProvider: true,
  llmMigrationNoticeSeen: true,
});

export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettings.$inferSelect;

// Schema for OAuth tokens
export const oauthTokens = pgTable("oauth_tokens", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull(),
  email: text("email").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  scope: text("scope"),
  sessionToken: text("session_token"),       // Long-lived opaque session token (UUID)
  sessionExpiresAt: timestamp("session_expires_at"),  // 30-day expiry
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertOAuthTokenSchema = createInsertSchema(oauthTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOAuthToken = z.infer<typeof insertOAuthTokenSchema>;
export type OAuthToken = typeof oauthTokens.$inferSelect;

// Schema for thematic digests (daily meta-summaries)
export const thematicDigests = pgTable("thematic_digests", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: timestamp("date").notNull().defaultNow(),
  emailDigestId: integer("email_digest_id").notNull(), // Links to the detailed digest
  sectionsCount: integer("sections_count").notNull(),
  totalSourceEmails: integer("total_source_emails").notNull(),
  processingMethod: text("processing_method").notNull(), // "nlp", "llm", "hybrid"
  dailySummary: text("daily_summary"),  // Overall synthesis paragraph for the day
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertThematicDigestSchema = createInsertSchema(thematicDigests).omit({
  id: true,
  createdAt: true,
});

export type InsertThematicDigest = z.infer<typeof insertThematicDigestSchema>;
export type ThematicDigest = typeof thematicDigests.$inferSelect;

// Schema for thematic sections (individual themes within a digest)
export const thematicSections = pgTable("thematic_sections", {
  id: serial("id").primaryKey(),
  thematicDigestId: integer("thematic_digest_id").notNull(),
  theme: text("theme").notNull(), // e.g., "Politics & Legal", "Technology", "Entertainment"
  summary: text("summary").notNull(), // AI-generated narrative summary
  confidence: integer("confidence"), // Confidence score from NLP clustering (0-100)
  keywords: text("keywords").array(), // Extracted keywords for this theme
  entities: jsonb("entities"), // Named entities (people, orgs, places)
  order: integer("order").notNull(), // Display order within the digest
});

export const insertThematicSectionSchema = createInsertSchema(thematicSections).omit({
  id: true,
});

export type InsertThematicSection = z.infer<typeof insertThematicSectionSchema>;
export type ThematicSection = typeof thematicSections.$inferSelect;

// Junction table linking thematic sections to source emails
export const themeSourceEmails = pgTable("theme_source_emails", {
  id: serial("id").primaryKey(),
  thematicSectionId: integer("thematic_section_id").notNull(),
  digestEmailId: integer("digest_email_id").notNull(), // References digestEmails table
  relevanceScore: integer("relevance_score"), // How relevant this email is to the theme (0-100)
});

export const insertThemeSourceEmailSchema = createInsertSchema(themeSourceEmails).omit({
  id: true,
});

export type InsertThemeSourceEmail = z.infer<typeof insertThemeSourceEmailSchema>;
export type ThemeSourceEmail = typeof themeSourceEmails.$inferSelect;

// Composite types for thematic digest with related data
export type ThematicSectionWithSourceEmails = ThematicSection & {
  sourceEmails: (ThemeSourceEmail & { email: DigestEmail })[];
};

export type FullThematicDigest = ThematicDigest & {
  sections: ThematicSectionWithSourceEmails[];
};
