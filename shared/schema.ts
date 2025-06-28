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
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).pick({
  userId: true,
  dailyDigestEnabled: true,
  topicClusteringEnabled: true,
  emailNotificationsEnabled: true,
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
