import { 
  monitoredEmails, 
  emailDigests, 
  digestEmails,
  userSettings,
  oauthTokens,
  type MonitoredEmail,
  type InsertMonitoredEmail,
  type EmailDigest,
  type InsertEmailDigest,
  type DigestEmail,
  type InsertDigestEmail,
  type UserSettings,
  type InsertUserSettings,
  type OAuthToken,
  type InsertOAuthToken
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Monitored emails
  getMonitoredEmails(): Promise<MonitoredEmail[]>;
  getMonitoredEmail(id: number): Promise<MonitoredEmail | undefined>;
  addMonitoredEmail(email: InsertMonitoredEmail): Promise<MonitoredEmail>;
  removeMonitoredEmail(id: number): Promise<void>;
  
  // Email digests
  getEmailDigests(): Promise<EmailDigest[]>;
  getEmailDigest(id: number): Promise<EmailDigest | undefined>;
  getLatestEmailDigest(): Promise<EmailDigest | undefined>;
  createEmailDigest(digest: InsertEmailDigest): Promise<EmailDigest>;
  
  // Digest emails
  getDigestEmails(digestId: number): Promise<DigestEmail[]>;
  addDigestEmail(email: InsertDigestEmail): Promise<DigestEmail>;
  
  // User settings
  getUserSettings(): Promise<UserSettings>;
  updateUserSettings(settings: Partial<UserSettings>): Promise<UserSettings>;
  
  // OAuth tokens
  storeOAuthToken(token: InsertOAuthToken): Promise<OAuthToken>;
  getOAuthTokenByUid(uid: string): Promise<OAuthToken | undefined>;
  getOAuthTokenByEmail(email: string): Promise<OAuthToken | undefined>;
  updateOAuthToken(uid: string, updates: Partial<OAuthToken>): Promise<OAuthToken | undefined>;
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
      dailyDigestEnabled: true,
      topicClusteringEnabled: true,
      emailNotificationsEnabled: false
    };
    
    // Initialize with default monitored emails
    this.initializeDefaultMonitoredEmails();
  }
  
  private initializeDefaultMonitoredEmails() {
    const defaultEmails = [
      'daily@pivot5.ai',
      'eletters@om.adexchanger.com',
      'email@washingtonpost.com'
    ];
    
    defaultEmails.forEach(email => {
      this.addMonitoredEmail({ email, active: true });
    });
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
  async getMonitoredEmails(): Promise<MonitoredEmail[]> {
    const database = this.ensureDb();
    return await database.select().from(monitoredEmails);
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
  
  async getLatestEmailDigest(): Promise<EmailDigest | undefined> {
    const results = await db.select().from(emailDigests).orderBy(desc(emailDigests.date)).limit(1);
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
  async getUserSettings(): Promise<UserSettings> {
    const results = await db.select().from(userSettings).limit(1);
    
    if (results.length === 0) {
      // Create default settings if none exist
      const defaultSettings: InsertUserSettings = {
        dailyDigestEnabled: true,
        topicClusteringEnabled: true,
        emailNotificationsEnabled: false
      };
      
      const newSettings = await db.insert(userSettings).values(defaultSettings).returning();
      return newSettings[0];
    }
    
    return results[0];
  }
  
  async updateUserSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    // Get current settings first
    const currentSettings = await this.getUserSettings();
    
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

// Initialize the database with default values (only for DatabaseStorage)
if (process.env.DATABASE_URL) {
  initializeDefaultMonitoredEmails().catch(console.error);
  initializeSettings().catch(console.error);
}

// Export the storage implementation
// Use memory storage in development for quick setup
export const storage = process.env.NODE_ENV === 'development' && !process.env.DATABASE_URL
  ? new MemStorage()
  : new DatabaseStorage();
