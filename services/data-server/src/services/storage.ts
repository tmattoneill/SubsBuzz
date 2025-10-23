/**
 * Storage Service - Database Operations
 * 
 * Wraps the existing storage implementation for use in the data server
 */

import { 
  monitoredEmails, 
  emailDigests, 
  digestEmails,
  userSettings,
  oauthTokens,
  thematicDigests,
  thematicSections,
  themeSourceEmails,
  type MonitoredEmail,
  type InsertMonitoredEmail,
  type EmailDigest,
  type InsertEmailDigest,
  type DigestEmail,
  type InsertDigestEmail,
  type UserSettings,
  type InsertUserSettings,
  type OAuthToken,
  type InsertOAuthToken,
  type ThematicDigest,
  type InsertThematicDigest,
  type ThematicSection,
  type InsertThematicSection,
  type ThemeSourceEmail,
  type InsertThemeSourceEmail,
  type FullThematicDigest
} from '../db/schema.js';
import { db } from '../db';
import { eq, desc, and, sql } from 'drizzle-orm';
import { createHash } from 'crypto';

// Helper function to generate userId from email
export function getUserId(email: string): string {
  return createHash('sha256').update(email.toLowerCase()).digest('hex');
}

export interface IStorage {
  // Monitored emails
  getMonitoredEmails(userId: string): Promise<MonitoredEmail[]>;
  getMonitoredEmail(id: number): Promise<MonitoredEmail | undefined>;
  addMonitoredEmail(email: InsertMonitoredEmail): Promise<MonitoredEmail>;
  removeMonitoredEmail(userId: string, id: number): Promise<void>;
  
  // Email digests
  getEmailDigests(userId: string): Promise<EmailDigest[]>;
  getEmailDigest(userId: string, id: number): Promise<EmailDigest | undefined>;
  getLatestEmailDigest(userId: string): Promise<EmailDigest | undefined>;
  getDigestByDate(userId: string, date: string): Promise<EmailDigest | undefined>;
  getDigestByDateRange(userId: string, startDate: Date, endDate: Date): Promise<EmailDigest | undefined>;
  hasDigestForDate(userId: string, date: Date): Promise<boolean>;
  getAvailableDigestDates(userId: string): Promise<string[]>;
  createEmailDigest(digest: InsertEmailDigest): Promise<EmailDigest>;
  
  // Digest emails
  getDigestEmails(digestId: number): Promise<DigestEmail[]>;
  addDigestEmail(email: InsertDigestEmail): Promise<DigestEmail>;
  
  // User settings
  getUserSettings(userId: string): Promise<UserSettings>;
  updateUserSettings(userId: string, settings: Partial<UserSettings>): Promise<UserSettings>;
  
  // OAuth tokens
  storeOAuthToken(token: InsertOAuthToken): Promise<OAuthToken>;
  getOAuthTokenByUid(uid: string): Promise<OAuthToken | undefined>;
  getOAuthTokenByEmail(email: string): Promise<OAuthToken | undefined>;
  updateOAuthToken(uid: string, updates: Partial<OAuthToken>): Promise<OAuthToken | undefined>;
  getExpiringOAuthTokens(beforeDate: Date): Promise<OAuthToken[]>;
  getUsersWithMonitoredEmails(): Promise<{ id: string; email: string; }[]>;
  
  // Thematic digests
  getThematicDigests(userId: string): Promise<ThematicDigest[]>;
  getThematicDigest(userId: string, id: number): Promise<FullThematicDigest | undefined>;
  getLatestThematicDigest(userId: string): Promise<FullThematicDigest | undefined>;
  hasThematicDigestForDate(userId: string, date: Date): Promise<boolean>;
  createThematicDigest(digest: InsertThematicDigest): Promise<ThematicDigest>;
  
  // Thematic sections
  createThematicSection(section: InsertThematicSection): Promise<ThematicSection>;
  getThematicSections(thematicDigestId: number): Promise<ThematicSection[]>;
  
  // Theme source emails
  createThemeSourceEmail(link: InsertThemeSourceEmail): Promise<ThemeSourceEmail>;
  getThemeSourceEmails(thematicSectionId: number): Promise<ThemeSourceEmail[]>;
}

export class DatabaseStorage implements IStorage {
  // Check if database is available
  private ensureDb() {
    if (!db) {
      throw new Error('Database not configured. DATABASE_URL is required for DatabaseStorage.');
    }
    return db;
  }

  // Monitored emails methods
  async getMonitoredEmails(userId: string): Promise<MonitoredEmail[]> {
    const database = this.ensureDb();
    return await database.select().from(monitoredEmails).where(eq(monitoredEmails.userId, userId));
  }
  
  async getMonitoredEmail(id: number): Promise<MonitoredEmail | undefined> {
    const results = await db.select().from(monitoredEmails).where(eq(monitoredEmails.id, id));
    return results.length > 0 ? results[0] : undefined;
  }
  
  async addMonitoredEmail(email: InsertMonitoredEmail): Promise<MonitoredEmail> {
    // Ensure active is set (required by the schema)
    const emailToInsert = {
      ...email,
      active: email.active !== undefined ? email.active : true
    };
    
    const results = await db.insert(monitoredEmails).values(emailToInsert).returning();
    return results[0];
  }
  
  async removeMonitoredEmail(userId: string, id: number): Promise<void> {
    const database = this.ensureDb();
    await database.delete(monitoredEmails)
      .where(and(eq(monitoredEmails.id, id), eq(monitoredEmails.userId, userId)));
  }
  
  // Email digests methods
  async getEmailDigests(userId: string): Promise<EmailDigest[]> {
    return await db.select().from(emailDigests)
      .where(eq(emailDigests.userId, userId))
      .orderBy(desc(emailDigests.date));
  }
  
  async getEmailDigest(userId: string, id: number): Promise<EmailDigest | undefined> {
    const results = await db.select().from(emailDigests)
      .where(and(eq(emailDigests.id, id), eq(emailDigests.userId, userId)));
    return results.length > 0 ? results[0] : undefined;
  }
  
  async getLatestEmailDigest(userId: string): Promise<EmailDigest | undefined> {
    const results = await db.select().from(emailDigests)
      .where(eq(emailDigests.userId, userId))
      .orderBy(desc(emailDigests.date))
      .limit(1);
    return results.length > 0 ? results[0] : undefined;
  }

  async getDigestByDate(userId: string, date: string): Promise<EmailDigest | undefined> {
    console.log(`🔍 Storage.getDigestByDate - userId: ${userId}, date: ${date}`);
    
    // Parse the date and create start/end of day boundaries
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    console.log(`🔍 Date range: ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`);

    // Try a simpler DATE() approach first
    const results = await db.select().from(emailDigests)
      .where(and(
        eq(emailDigests.userId, userId),
        sql`DATE(${emailDigests.date}) = ${date}`
      ))
      .orderBy(desc(emailDigests.date))
      .limit(1);
    
    // If that doesn't work, fall back to range query
    if (results.length === 0) {
      console.log(`🔍 No results with DATE() approach, trying range query...`);
      const rangeResults = await db.select().from(emailDigests)
        .where(and(
          eq(emailDigests.userId, userId),
          sql`${emailDigests.date} >= ${startOfDay.toISOString()}`,
          sql`${emailDigests.date} <= ${endOfDay.toISOString()}`
        ))
        .orderBy(desc(emailDigests.date))
        .limit(1);
      
      console.log(`🔍 Range query found ${rangeResults.length} result(s)`);
      return rangeResults.length > 0 ? rangeResults[0] : undefined;
    }
    
    console.log(`🔍 Found ${results.length} digest(s) in date range`);
    if (results.length > 0) {
      console.log(`🔍 Digest found: ID=${results[0].id}, date=${results[0].date}`);
    }
    
    return results.length > 0 ? results[0] : undefined;
  }

  async getDigestByDateRange(userId: string, startDate: Date, endDate: Date): Promise<EmailDigest | undefined> {
    const results = await db.select().from(emailDigests)
      .where(and(
        eq(emailDigests.userId, userId),
        sql`${emailDigests.date} >= ${startDate.toISOString()}`,
        sql`${emailDigests.date} <= ${endDate.toISOString()}`
      ))
      .orderBy(desc(emailDigests.date))
      .limit(1);
    
    return results.length > 0 ? results[0] : undefined;
  }

  async hasDigestForDate(userId: string, date: Date): Promise<boolean> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const results = await db.select().from(emailDigests)
      .where(and(
        eq(emailDigests.userId, userId),
        sql`${emailDigests.date} >= ${startOfDay.toISOString()}`,
        sql`${emailDigests.date} <= ${endOfDay.toISOString()}`
      ))
      .limit(1);
    
    return results.length > 0;
  }

  async getAvailableDigestDates(userId: string): Promise<string[]> {
    // Get all dates with regular email digests
    const emailDigestDates = await db.select({
      date: sql<string>`DATE(${emailDigests.date})`
    }).from(emailDigests)
      .where(eq(emailDigests.userId, userId))
      .groupBy(sql`DATE(${emailDigests.date})`)
      .orderBy(desc(sql`DATE(${emailDigests.date})`));

    // Get all dates with thematic digests  
    const thematicDigestDates = await db.select({
      date: sql<string>`DATE(${thematicDigests.date})`
    }).from(thematicDigests)
      .where(eq(thematicDigests.userId, userId))
      .groupBy(sql`DATE(${thematicDigests.date})`)
      .orderBy(desc(sql`DATE(${thematicDigests.date})`));

    // Combine and deduplicate the dates
    const allDates = new Set<string>();
    emailDigestDates.forEach(row => allDates.add(row.date));
    thematicDigestDates.forEach(row => allDates.add(row.date));

    return Array.from(allDates).sort().reverse(); // Most recent first
  }
  
  async createEmailDigest(digest: InsertEmailDigest): Promise<EmailDigest> {
    // Ensure date is set (required by the schema)
    const digestToInsert = {
      ...digest,
      date: digest.date || new Date()
    };
    
    // Check if a digest already exists for this user and date
    const targetDate = digestToInsert.date;
    const existingDigest = await this.hasDigestForDate(digestToInsert.userId, targetDate);
    
    if (existingDigest) {
      console.log(`🔄 Overwriting existing digest for user ${digestToInsert.userId} on date ${targetDate.toISOString().split('T')[0]}`);
      
      // Delete existing digests for this date (maintaining one-per-day rule)
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      // Get existing digest IDs to clean up related digest_emails
      const existingDigests = await db.select().from(emailDigests)
        .where(and(
          eq(emailDigests.userId, digestToInsert.userId),
          sql`${emailDigests.date} >= ${startOfDay.toISOString()}`,
          sql`${emailDigests.date} <= ${endOfDay.toISOString()}`
        ));
      
      // Delete related digest emails first
      for (const existingDigest of existingDigests) {
        await db.delete(digestEmails).where(eq(digestEmails.digestId, existingDigest.id));
      }
      
      // Delete existing digests for this date
      await db.delete(emailDigests)
        .where(and(
          eq(emailDigests.userId, digestToInsert.userId),
          sql`${emailDigests.date} >= ${startOfDay.toISOString()}`,
          sql`${emailDigests.date} <= ${endOfDay.toISOString()}`
        ));
      
      console.log(`✅ Cleaned up ${existingDigests.length} existing digest(s) for ${targetDate.toISOString().split('T')[0]}`);
    }
    
    const results = await db.insert(emailDigests).values(digestToInsert).returning();
    console.log(`✅ Created new digest ${results[0].id} for user ${digestToInsert.userId} on ${targetDate.toISOString().split('T')[0]}`);
    return results[0];
  }
  
  // Digest emails methods
  async getDigestEmails(digestId: number): Promise<DigestEmail[]> {
    return await db.select().from(digestEmails).where(eq(digestEmails.digestId, digestId));
  }
  
  async addDigestEmail(email: InsertDigestEmail): Promise<DigestEmail> {
    // Ensure originalLink is not undefined (schema expects string | null)
    const emailToInsert = {
      ...email,
      originalLink: email.originalLink === undefined ? null : email.originalLink
    };
    
    const results = await db.insert(digestEmails).values(emailToInsert).returning();
    return results[0];
  }
  
  // User settings methods
  async getUserSettings(userId: string): Promise<UserSettings> {
    const results = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    
    if (results.length === 0) {
      // Create default settings if none exist
      const defaultSettings: InsertUserSettings = {
        userId,
        dailyDigestEnabled: true,
        topicClusteringEnabled: true,
        emailNotificationsEnabled: false,
        themeMode: "system",
        themeColor: "blue"
      };
      
      const newSettings = await db.insert(userSettings).values(defaultSettings).returning();
      return newSettings[0];
    }
    
    return results[0];
  }
  
  async updateUserSettings(userId: string, settings: Partial<UserSettings>): Promise<UserSettings> {
    // Get current settings first
    const currentSettings = await this.getUserSettings(userId);
    
    // Filter out undefined values and id field to avoid issues
    const filteredSettings = Object.fromEntries(
      Object.entries(settings).filter(([key, value]) => 
        value !== undefined && key !== 'id' && key !== 'userId'
      )
    );
    
    console.log('Updating user settings for userId:', userId);
    console.log('Current settings ID:', currentSettings.id);
    console.log('Settings to update:', filteredSettings);
    
    // Update settings
    const results = await db
      .update(userSettings)
      .set(filteredSettings)
      .where(eq(userSettings.id, currentSettings.id))
      .returning();
    
    return results[0];
  }
  
  // OAuth token methods
  async storeOAuthToken(token: InsertOAuthToken): Promise<OAuthToken> {
    // Check if token already exists for the UID
    const existingToken = await this.getOAuthTokenByUid(token.uid);
    
    if (existingToken) {
      // Update existing token
      return await this.updateOAuthToken(token.uid, token) as OAuthToken;
    }
    
    // Create new token
    const results = await db.insert(oauthTokens).values({
      ...token,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    
    return results[0];
  }
  
  async getOAuthTokenByUid(uid: string): Promise<OAuthToken | undefined> {
    try {
      const results = await db.select().from(oauthTokens).where(eq(oauthTokens.uid, uid));
      return results.length > 0 ? results[0] : undefined;
    } catch (error) {
      console.error('Error getting OAuth token by UID:', error);
      return undefined; // Return undefined instead of throwing
    }
  }
  
  async getOAuthTokenByEmail(email: string): Promise<OAuthToken | undefined> {
    try {
      const results = await db.select().from(oauthTokens).where(eq(oauthTokens.email, email));
      return results.length > 0 ? results[0] : undefined;
    } catch (error) {
      console.error('Error getting OAuth token by email:', error);
      return undefined; // Return undefined instead of throwing
    }
  }
  
  async updateOAuthToken(uid: string, updates: Partial<OAuthToken>): Promise<OAuthToken | undefined> {
    const existingToken = await this.getOAuthTokenByUid(uid);
    if (!existingToken) return undefined;
    
    // Convert date strings to Date objects for database
    const processedUpdates = { ...updates };
    if (processedUpdates.expiresAt && typeof processedUpdates.expiresAt === 'string') {
      processedUpdates.expiresAt = new Date(processedUpdates.expiresAt);
    }
    if (processedUpdates.createdAt && typeof processedUpdates.createdAt === 'string') {
      processedUpdates.createdAt = new Date(processedUpdates.createdAt);
    }
    
    const results = await db
      .update(oauthTokens)
      .set({
        ...processedUpdates,
        updatedAt: new Date()
      })
      .where(eq(oauthTokens.uid, uid))
      .returning();
    
    return results.length > 0 ? results[0] : undefined;
  }

  async getExpiringOAuthTokens(beforeDate: Date): Promise<OAuthToken[]> {
    try {
      const database = this.ensureDb();
      return await database.select()
        .from(oauthTokens)
        .where(and(
          sql`${oauthTokens.expiresAt} IS NOT NULL`,
          sql`${oauthTokens.expiresAt} <= ${beforeDate.toISOString()}`
        ))
        .orderBy(oauthTokens.expiresAt);
    } catch (error) {
      console.error('Error getting expiring OAuth tokens:', error);
      return [];
    }
  }

  async getUsersWithMonitoredEmails(): Promise<{ id: string; email: string; }[]> {
    try {
      const database = this.ensureDb();
      // Get distinct users who have active monitored emails
      const results = await database.select({
        id: users.id,
        email: users.email
      })
      .from(users)
      .innerJoin(monitoredEmails, eq(users.id, monitoredEmails.userId))
      .where(eq(monitoredEmails.active, true))
      .groupBy(users.id, users.email);
      
      return results;
    } catch (error) {
      console.error('Error getting users with monitored emails:', error);
      return [];
    }
  }

  // Thematic digest methods
  async getThematicDigests(userId: string): Promise<ThematicDigest[]> {
    const database = this.ensureDb();
    return await database.select()
      .from(thematicDigests)
      .where(eq(thematicDigests.userId, userId))
      .orderBy(desc(thematicDigests.date));
  }

  async getThematicDigest(userId: string, id: number): Promise<FullThematicDigest | undefined> {
    const database = this.ensureDb();
    
    // Get the main digest
    const digestResults = await database.select()
      .from(thematicDigests)
      .where(and(eq(thematicDigests.id, id), eq(thematicDigests.userId, userId)));
    
    if (digestResults.length === 0) return undefined;
    const digest = digestResults[0];
    
    // Get the sections
    const sections = await this.getThematicSections(id);
    
    // Get source emails for each section
    const sectionsWithEmails = await Promise.all(
      sections.map(async (section) => {
        const sourceEmailLinks = await this.getThemeSourceEmails(section.id);
        
        // Get the actual email data
        const sourceEmails = await Promise.all(
          sourceEmailLinks.map(async (link) => {
            const emailResults = await database.select()
              .from(digestEmails)
              .where(eq(digestEmails.id, link.digestEmailId));
            
            if (emailResults.length === 0) {
              console.warn(`Referenced digest email ${link.digestEmailId} not found`);
              return null;
            }
            
            return {
              ...link,
              email: emailResults[0]
            };
          })
        );
        
        // Filter out any null results
        const validSourceEmails = sourceEmails.filter(email => email !== null);
        
        return {
          ...section,
          sourceEmails: validSourceEmails
        };
      })
    );
    
    return {
      ...digest,
      sections: sectionsWithEmails
    };
  }

  async getLatestThematicDigest(userId: string): Promise<FullThematicDigest | undefined> {
    const database = this.ensureDb();
    
    const results = await database.select()
      .from(thematicDigests)
      .where(eq(thematicDigests.userId, userId))
      .orderBy(desc(thematicDigests.date))
      .limit(1);
    
    if (results.length === 0) return undefined;
    
    return this.getThematicDigest(userId, results[0].id);
  }

  async hasThematicDigestForDate(userId: string, date: Date): Promise<boolean> {
    const database = this.ensureDb();
    
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const results = await database.select().from(thematicDigests)
      .where(and(
        eq(thematicDigests.userId, userId),
        sql`${thematicDigests.date} >= ${startOfDay.toISOString()}`,
        sql`${thematicDigests.date} <= ${endOfDay.toISOString()}`
      ))
      .limit(1);
    
    return results.length > 0;
  }

  async createThematicDigest(digest: InsertThematicDigest): Promise<ThematicDigest> {
    const database = this.ensureDb();
    
    // Check if a thematic digest already exists for this user and date
    const targetDate = digest.date;
    const existingDigest = await this.hasThematicDigestForDate(digest.userId, targetDate);
    
    if (existingDigest) {
      console.log(`Thematic digest already exists for user ${digest.userId} on date ${targetDate.toISOString().split('T')[0]}`);
      // Get the existing digest and return it
      const existingResults = await database.select().from(thematicDigests)
        .where(and(
          eq(thematicDigests.userId, digest.userId),
          sql`${thematicDigests.date} >= ${targetDate.toISOString().split('T')[0]}`,
          sql`${thematicDigests.date} <= ${targetDate.toISOString().split('T')[0]} 23:59:59`
        ))
        .orderBy(desc(thematicDigests.date))
        .limit(1);
      
      return existingResults[0];
    }
    
    const results = await database.insert(thematicDigests)
      .values(digest)
      .returning();
    
    return results[0];
  }

  async createThematicSection(section: InsertThematicSection): Promise<ThematicSection> {
    const database = this.ensureDb();
    
    const results = await database.insert(thematicSections)
      .values(section)
      .returning();
    
    return results[0];
  }

  async getThematicSections(thematicDigestId: number): Promise<ThematicSection[]> {
    const database = this.ensureDb();
    
    return await database.select()
      .from(thematicSections)
      .where(eq(thematicSections.thematicDigestId, thematicDigestId))
      .orderBy(thematicSections.order);
  }

  async createThemeSourceEmail(link: InsertThemeSourceEmail): Promise<ThemeSourceEmail> {
    const database = this.ensureDb();
    
    const results = await database.insert(themeSourceEmails)
      .values(link)
      .returning();
    
    return results[0];
  }

  async getThemeSourceEmails(thematicSectionId: number): Promise<ThemeSourceEmail[]> {
    const database = this.ensureDb();
    
    return await database.select()
      .from(themeSourceEmails)
      .where(eq(themeSourceEmails.thematicSectionId, thematicSectionId));
  }
}

// Export the storage implementation
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required. PostgreSQL is required for all functionality.');
}

console.log(`Storage initialization: NODE_ENV=${process.env.NODE_ENV}, DATABASE_URL=set, using DatabaseStorage`);
export const storage = new DatabaseStorage();