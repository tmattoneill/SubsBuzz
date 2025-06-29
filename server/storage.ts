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
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";
import { createHash } from "crypto";

// Helper function to generate userId from email
export function getUserId(email: string): string {
  return createHash('sha256').update(email.toLowerCase()).digest('hex');
}

export interface IStorage {
  // Monitored emails
  getMonitoredEmails(userId: string): Promise<MonitoredEmail[]>;
  getMonitoredEmail(userId: string, id: number): Promise<MonitoredEmail | undefined>;
  addMonitoredEmail(email: InsertMonitoredEmail): Promise<MonitoredEmail>;
  removeMonitoredEmail(userId: string, id: number): Promise<void>;
  
  // Email digests
  getEmailDigests(userId: string): Promise<EmailDigest[]>;
  getEmailDigest(userId: string, id: number): Promise<EmailDigest | undefined>;
  getLatestEmailDigest(userId: string): Promise<EmailDigest | undefined>;
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
  
  // Thematic digests
  getThematicDigests(userId: string): Promise<ThematicDigest[]>;
  getThematicDigest(userId: string, id: number): Promise<FullThematicDigest | undefined>;
  getLatestThematicDigest(userId: string): Promise<FullThematicDigest | undefined>;
  createThematicDigest(digest: InsertThematicDigest): Promise<ThematicDigest>;
  
  // Thematic sections
  createThematicSection(section: InsertThematicSection): Promise<ThematicSection>;
  getThematicSections(thematicDigestId: number): Promise<ThematicSection[]>;
  
  // Theme source emails
  createThemeSourceEmail(link: InsertThemeSourceEmail): Promise<ThemeSourceEmail>;
  getThemeSourceEmails(thematicSectionId: number): Promise<ThemeSourceEmail[]>;
}

export class MemStorage implements IStorage {
  private monitoredEmailsStore: Map<number, MonitoredEmail>;
  private emailDigestsStore: Map<number, EmailDigest>;
  private digestEmailsStore: Map<number, DigestEmail>;
  private userSettingsStore: UserSettings;
  private oauthTokensStore: Map<string, OAuthToken>;
  
  private currentMonitoredEmailId: number;
  private currentEmailDigestId: number;
  private currentDigestEmailId: number;
  private currentOAuthTokenId: number;
  
  constructor() {
    this.monitoredEmailsStore = new Map();
    this.emailDigestsStore = new Map();
    this.digestEmailsStore = new Map();
    this.oauthTokensStore = new Map();
    
    this.currentMonitoredEmailId = 1;
    this.currentEmailDigestId = 1;
    this.currentDigestEmailId = 1;
    this.currentOAuthTokenId = 1;
    
    // Initialize with default settings
    this.userSettingsStore = {
      id: 1,
      userId: 'memory-storage-default',
      dailyDigestEnabled: true,
      topicClusteringEnabled: true,
      emailNotificationsEnabled: false
    };
    
    // New users start with no monitored emails
  }
  
  // Monitored emails methods
  async getMonitoredEmails(): Promise<MonitoredEmail[]> {
    return Array.from(this.monitoredEmailsStore.values());
  }
  
  async getMonitoredEmail(id: number): Promise<MonitoredEmail | undefined> {
    return this.monitoredEmailsStore.get(id);
  }
  
  async addMonitoredEmail(email: InsertMonitoredEmail): Promise<MonitoredEmail> {
    const id = this.currentMonitoredEmailId++;
    const newEmail: MonitoredEmail = { id, ...email };
    this.monitoredEmailsStore.set(id, newEmail);
    return newEmail;
  }
  
  async removeMonitoredEmail(id: number): Promise<void> {
    this.monitoredEmailsStore.delete(id);
  }
  
  // Email digests methods
  async getEmailDigests(): Promise<EmailDigest[]> {
    return Array.from(this.emailDigestsStore.values());
  }
  
  async getEmailDigest(id: number): Promise<EmailDigest | undefined> {
    return this.emailDigestsStore.get(id);
  }
  
  async getLatestEmailDigest(): Promise<EmailDigest | undefined> {
    const digests = Array.from(this.emailDigestsStore.values());
    if (digests.length === 0) return undefined;
    
    // Sort by date, most recent first
    return digests.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];
  }
  
  async createEmailDigest(digest: InsertEmailDigest): Promise<EmailDigest> {
    const id = this.currentEmailDigestId++;
    const newDigest: EmailDigest = { id, ...digest };
    this.emailDigestsStore.set(id, newDigest);
    return newDigest;
  }
  
  // Digest emails methods
  async getDigestEmails(digestId: number): Promise<DigestEmail[]> {
    return Array.from(this.digestEmailsStore.values())
      .filter(email => email.digestId === digestId);
  }
  
  async addDigestEmail(email: InsertDigestEmail): Promise<DigestEmail> {
    const id = this.currentDigestEmailId++;
    const newEmail: DigestEmail = { id, ...email };
    this.digestEmailsStore.set(id, newEmail);
    return newEmail;
  }
  
  // User settings methods
  async getUserSettings(): Promise<UserSettings> {
    return this.userSettingsStore;
  }
  
  async updateUserSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    this.userSettingsStore = { ...this.userSettingsStore, ...settings };
    return this.userSettingsStore;
  }
  
  // OAuth token methods
  async storeOAuthToken(token: InsertOAuthToken): Promise<OAuthToken> {
    const id = this.currentOAuthTokenId++;
    const now = new Date();
    
    const oauthToken: OAuthToken = {
      id,
      uid: token.uid,
      email: token.email,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken || null,
      expiresAt: token.expiresAt || null,
      createdAt: now,
      updatedAt: now
    };
    
    // Use UID as the key to make lookups easier
    this.oauthTokensStore.set(token.uid, oauthToken);
    return oauthToken;
  }
  
  async getOAuthTokenByUid(uid: string): Promise<OAuthToken | undefined> {
    return this.oauthTokensStore.get(uid);
  }
  
  async updateOAuthToken(uid: string, updates: Partial<OAuthToken>): Promise<OAuthToken | undefined> {
    const existingToken = this.oauthTokensStore.get(uid);
    if (!existingToken) return undefined;
    
    const updatedToken: OAuthToken = {
      ...existingToken,
      ...updates,
      updatedAt: new Date()
    };
    
    this.oauthTokensStore.set(uid, updatedToken);
    return updatedToken;
  }

  // Thematic digest methods (placeholder implementations for MemStorage)
  async getThematicDigests(userId: string): Promise<ThematicDigest[]> {
    // TODO: Implement in-memory storage for thematic digests
    return [];
  }

  async getThematicDigest(userId: string, id: number): Promise<FullThematicDigest | undefined> {
    // TODO: Implement in-memory storage for thematic digests
    return undefined;
  }

  async getLatestThematicDigest(userId: string): Promise<FullThematicDigest | undefined> {
    // TODO: Implement in-memory storage for thematic digests
    return undefined;
  }

  async createThematicDigest(digest: InsertThematicDigest): Promise<ThematicDigest> {
    // TODO: Implement in-memory storage for thematic digests
    throw new Error("Thematic digests not implemented for MemStorage");
  }

  async createThematicSection(section: InsertThematicSection): Promise<ThematicSection> {
    // TODO: Implement in-memory storage for thematic sections
    throw new Error("Thematic sections not implemented for MemStorage");
  }

  async getThematicSections(thematicDigestId: number): Promise<ThematicSection[]> {
    // TODO: Implement in-memory storage for thematic sections
    return [];
  }

  async createThemeSourceEmail(link: InsertThemeSourceEmail): Promise<ThemeSourceEmail> {
    // TODO: Implement in-memory storage for theme source emails
    throw new Error("Theme source emails not implemented for MemStorage");
  }

  async getThemeSourceEmails(thematicSectionId: number): Promise<ThemeSourceEmail[]> {
    // TODO: Implement in-memory storage for theme source emails
    return [];
  }
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
  
  async removeMonitoredEmail(id: number): Promise<void> {
    await db.delete(monitoredEmails).where(eq(monitoredEmails.id, id));
  }
  
  // Email digests methods
  async getEmailDigests(): Promise<EmailDigest[]> {
    return await db.select().from(emailDigests).orderBy(desc(emailDigests.date));
  }
  
  async getEmailDigest(id: number): Promise<EmailDigest | undefined> {
    const results = await db.select().from(emailDigests).where(eq(emailDigests.id, id));
    return results.length > 0 ? results[0] : undefined;
  }
  
  async getLatestEmailDigest(userId: string): Promise<EmailDigest | undefined> {
    const results = await db.select().from(emailDigests)
      .where(eq(emailDigests.userId, userId))
      .orderBy(desc(emailDigests.date))
      .limit(1);
    return results.length > 0 ? results[0] : undefined;
  }
  
  async createEmailDigest(digest: InsertEmailDigest): Promise<EmailDigest> {
    // Ensure date is set (required by the schema)
    const digestToInsert = {
      ...digest,
      date: digest.date || new Date()
    };
    
    const results = await db.insert(emailDigests).values(digestToInsert).returning();
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
        emailNotificationsEnabled: false
      };
      
      const newSettings = await db.insert(userSettings).values(defaultSettings).returning();
      return newSettings[0];
    }
    
    return results[0];
  }
  
  async updateUserSettings(userId: string, settings: Partial<UserSettings>): Promise<UserSettings> {
    // Get current settings first
    const currentSettings = await this.getUserSettings(userId);
    
    // Update settings
    const results = await db
      .update(userSettings)
      .set(settings)
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
    
    const results = await db
      .update(oauthTokens)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(oauthTokens.uid, uid))
      .returning();
    
    return results.length > 0 ? results[0] : undefined;
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

  async createThematicDigest(digest: InsertThematicDigest): Promise<ThematicDigest> {
    const database = this.ensureDb();
    
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

// Initialize with default monitored emails
async function initializeDefaultMonitoredEmails() {
  const storage = new DatabaseStorage();
  const emails = await storage.getMonitoredEmails();
  
  // Only add default emails if the table is empty
  if (emails.length === 0) {
    const defaultEmails = [
      'daily@pivot5.ai',
      'eletters@om.adexchanger.com',
      'email@washingtonpost.com'
    ];
    
    for (const email of defaultEmails) {
      await storage.addMonitoredEmail({ email, active: true });
    }
  }
}

// Initialize settings if needed
async function initializeSettings() {
  const storage = new DatabaseStorage();
  await storage.getUserSettings(); // Will create default settings if none exist
}

// Skip global initialization - user-specific data is created per user during OAuth
// if (process.env.DATABASE_URL) {
//   initializeDefaultMonitoredEmails().catch(console.error);
//   initializeSettings().catch(console.error);
// }

// Export the storage implementation
// Use memory storage in development for quick setup
const useMemStorage = process.env.NODE_ENV === 'development' && !process.env.DATABASE_URL;
console.log(`Storage initialization: NODE_ENV=${process.env.NODE_ENV}, DATABASE_URL=${process.env.DATABASE_URL ? 'set' : 'not set'}, using ${useMemStorage ? 'MemStorage' : 'DatabaseStorage'}`);
export const storage = useMemStorage ? new MemStorage() : new DatabaseStorage();
