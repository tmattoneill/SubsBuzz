/**
 * Database Schema - SubsBuzz Data Server
 * PostgreSQL schema definitions using Drizzle ORM
 */

import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
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

// Schema for monitored email addresses
export const monitoredEmails = pgTable("monitored_emails", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  email: text("email").notNull(),
  active: boolean("active").notNull().default(true),
});

export const insertMonitoredEmailSchema = createInsertSchema(monitoredEmails).pick({
  userId: true,
  email: true,
  active: true,
});

export type InsertMonitoredEmail = z.infer<typeof insertMonitoredEmailSchema>;
export type MonitoredEmail = typeof monitoredEmails.$inferSelect;

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
  subject: text("subject").notNull(),
  receivedAt: timestamp("received_at").notNull(),
  summary: text("summary").notNull(),
  fullContent: text("full_content").notNull(),
  topics: text("topics").array().notNull(),
  keywords: text("keywords").array().notNull(),
  originalLink: text("original_link"),
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
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).pick({
  userId: true,
  dailyDigestEnabled: true,
  topicClusteringEnabled: true,
  emailNotificationsEnabled: true,
  themeMode: true,
  themeColor: true,
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
