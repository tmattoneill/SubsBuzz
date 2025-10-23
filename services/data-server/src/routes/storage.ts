/**
 * Storage Routes - Internal API for Database Operations
 * 
 * Exposes all storage operations from the existing storage.ts as REST endpoints
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/error';
import { storage } from '../services/storage';

const router = Router();

// Helper function for standard API responses
const apiResponse = (data: any, message?: string) => ({
  success: true,
  data,
  ...(message && { message })
});

const apiError = (message: string, code?: string) => ({
  success: false,
  error: message,
  ...(code && { code })
});

// ==================== MONITORED EMAILS ====================

// Get monitored emails for a user
router.get('/monitored-emails/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const monitoredEmails = await storage.getMonitoredEmails(userId);
  res.json(apiResponse(monitoredEmails));
}));

// Get specific monitored email
router.get('/monitored-email/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json(apiError('Invalid ID', 'INVALID_ID'));
  }
  
  const monitoredEmail = await storage.getMonitoredEmail(id);
  if (!monitoredEmail) {
    return res.status(404).json(apiError('Monitored email not found', 'NOT_FOUND'));
  }
  
  res.json(apiResponse(monitoredEmail));
}));

// Add monitored email
router.post('/monitored-emails', asyncHandler(async (req: Request, res: Response) => {
  const { userId, email, active } = req.body;
  
  if (!userId || !email) {
    return res.status(400).json(apiError('userId and email are required', 'MISSING_FIELDS'));
  }
  
  const newMonitoredEmail = await storage.addMonitoredEmail({
    userId,
    email,
    active: active !== undefined ? active : true
  });
  
  res.status(201).json(apiResponse(newMonitoredEmail, 'Monitored email added'));
}));

// Remove monitored email
router.delete('/monitored-emails/:userId/:id', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const id = parseInt(req.params.id);
  
  if (isNaN(id)) {
    return res.status(400).json(apiError('Invalid ID', 'INVALID_ID'));
  }
  
  await storage.removeMonitoredEmail(userId, id);
  res.json(apiResponse(null, 'Monitored email removed'));
}));

// ==================== EMAIL DIGESTS ====================

// Get email digests for a user
router.get('/email-digests/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const digests = await storage.getEmailDigests(userId);
  res.json(apiResponse(digests));
}));

// Get specific email digest
router.get('/email-digest/:userId/:id', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const id = parseInt(req.params.id);
  
  if (isNaN(id)) {
    return res.status(400).json(apiError('Invalid ID', 'INVALID_ID'));
  }
  
  const digest = await storage.getEmailDigest(userId, id);
  if (!digest) {
    return res.status(404).json(apiError('Digest not found', 'NOT_FOUND'));
  }
  
  res.json(apiResponse(digest));
}));

// Get latest email digest
router.get('/email-digest/:userId/latest', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const digest = await storage.getLatestEmailDigest(userId);
  
  if (!digest) {
    return res.status(404).json(apiError('No digests found', 'NOT_FOUND'));
  }
  
  res.json(apiResponse(digest));
}));

// Get digest by date
router.get('/email-digest/:userId/date/:date', asyncHandler(async (req: Request, res: Response) => {
  const { userId, date } = req.params;
  const digest = await storage.getDigestByDate(userId, date);
  
  if (!digest) {
    return res.status(404).json(apiError('No digest found for this date', 'NOT_FOUND'));
  }
  
  res.json(apiResponse(digest));
}));

// Get available digest dates
router.get('/available-digest-dates/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const dates = await storage.getAvailableDigestDates(userId);
  res.json(apiResponse(dates));
}));

// Create email digest
router.post('/email-digests', asyncHandler(async (req: Request, res: Response) => {
  const { userId, date, emailsProcessed, topicsIdentified } = req.body;
  
  if (!userId || emailsProcessed === undefined || topicsIdentified === undefined) {
    return res.status(400).json(apiError('Missing required fields', 'MISSING_FIELDS'));
  }
  
  const newDigest = await storage.createEmailDigest({
    userId,
    date: date ? new Date(date) : new Date(),
    emailsProcessed,
    topicsIdentified
  });
  
  res.status(201).json(apiResponse(newDigest, 'Email digest created'));
}));

// ==================== DIGEST EMAILS ====================

// Get emails for a digest
router.get('/digest-emails/:digestId', asyncHandler(async (req: Request, res: Response) => {
  const digestId = parseInt(req.params.digestId);
  
  if (isNaN(digestId)) {
    return res.status(400).json(apiError('Invalid digest ID', 'INVALID_ID'));
  }
  
  const emails = await storage.getDigestEmails(digestId);
  res.json(apiResponse(emails));
}));

// Add email to digest
router.post('/digest-emails', asyncHandler(async (req: Request, res: Response) => {
  const { 
    digestId, sender, subject, receivedAt, summary, 
    fullContent, topics, keywords, originalLink 
  } = req.body;
  
  if (!digestId || !sender || !subject || !summary || !fullContent) {
    return res.status(400).json(apiError('Missing required fields', 'MISSING_FIELDS'));
  }
  
  const newEmail = await storage.addDigestEmail({
    digestId,
    sender,
    subject,
    receivedAt: new Date(receivedAt),
    summary,
    fullContent,
    topics: topics || [],
    keywords: keywords || [],
    originalLink
  });
  
  res.status(201).json(apiResponse(newEmail, 'Email added to digest'));
}));

// ==================== USER SETTINGS ====================

// Get user settings
router.get('/user-settings/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const settings = await storage.getUserSettings(userId);
  res.json(apiResponse(settings));
}));

// Update user settings
router.patch('/user-settings/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const updates = req.body;
  
  const updatedSettings = await storage.updateUserSettings(userId, updates);
  res.json(apiResponse(updatedSettings, 'Settings updated'));
}));

// ==================== OAUTH TOKENS ====================

// Store OAuth token
router.post('/oauth-tokens', asyncHandler(async (req: Request, res: Response) => {
  const { uid, email, accessToken, refreshToken, expiresAt, scope } = req.body;
  
  if (!uid || !email || !accessToken) {
    return res.status(400).json(apiError('Missing required fields', 'MISSING_FIELDS'));
  }
  
  const token = await storage.storeOAuthToken({
    uid,
    email,
    accessToken,
    refreshToken,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    scope
  });
  
  res.status(201).json(apiResponse(token, 'OAuth token stored'));
}));

// Get OAuth token by UID
router.get('/oauth-token/:uid', asyncHandler(async (req: Request, res: Response) => {
  const { uid } = req.params;
  const token = await storage.getOAuthTokenByUid(uid);

  if (!token) {
    return res.status(404).json(apiError('OAuth token not found', 'NOT_FOUND'));
  }

  // Transform to snake_case for Python email worker compatibility
  const transformedToken = {
    id: token.id,
    uid: token.uid,
    email: token.email,
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
    expires_at: token.expiresAt instanceof Date ? token.expiresAt.toISOString() : token.expiresAt,
    scope: token.scope,
    created_at: token.createdAt instanceof Date ? token.createdAt.toISOString() : token.createdAt,
    updated_at: token.updatedAt instanceof Date ? token.updatedAt.toISOString() : token.updatedAt
  };

  res.json(apiResponse(transformedToken));
}));

// Get OAuth token by email
router.get('/oauth-token/email/:email', asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.params;
  const token = await storage.getOAuthTokenByEmail(email);
  
  if (!token) {
    return res.status(404).json(apiError('OAuth token not found', 'NOT_FOUND'));
  }
  
  res.json(apiResponse(token));
}));

// Update OAuth token
router.patch('/oauth-token/:uid', asyncHandler(async (req: Request, res: Response) => {
  const { uid } = req.params;
  const updates = req.body;
  
  const updatedToken = await storage.updateOAuthToken(uid, updates);
  
  if (!updatedToken) {
    return res.status(404).json(apiError('OAuth token not found', 'NOT_FOUND'));
  }
  
  res.json(apiResponse(updatedToken, 'OAuth token updated'));
}));

// Get expiring OAuth tokens
router.get('/oauth-tokens/expiring', asyncHandler(async (req: Request, res: Response) => {
  const { before } = req.query;
  
  if (!before) {
    return res.status(400).json(apiError('before parameter is required', 'MISSING_PARAMETER'));
  }
  
  try {
    const beforeDate = new Date(before as string);
    const expiringTokens = await storage.getExpiringOAuthTokens(beforeDate);
    
    console.log(`🔍 Found ${expiringTokens.length} tokens expiring before ${beforeDate.toISOString()}`);
    res.json(apiResponse(expiringTokens));
  } catch (error: any) {
    console.error('Error getting expiring tokens:', error);
    res.status(500).json(apiError(`Failed to get expiring tokens: ${error.message}`, 'EXPIRING_TOKENS_FAILED'));
  }
}));

// ==================== THEMATIC DIGESTS ====================

// Get thematic digests for a user
router.get('/thematic-digests/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const digests = await storage.getThematicDigests(userId);
  res.json(apiResponse(digests));
}));

// Get specific thematic digest
router.get('/thematic-digest/:userId/:id', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const id = parseInt(req.params.id);
  
  if (isNaN(id)) {
    return res.status(400).json(apiError('Invalid ID', 'INVALID_ID'));
  }
  
  const digest = await storage.getThematicDigest(userId, id);
  
  if (!digest) {
    return res.status(404).json(apiError('Thematic digest not found', 'NOT_FOUND'));
  }
  
  res.json(apiResponse(digest));
}));

// Get latest thematic digest
router.get('/thematic-digest/:userId/latest', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const digest = await storage.getLatestThematicDigest(userId);
  
  if (!digest) {
    return res.status(404).json(apiError('No thematic digests found', 'NOT_FOUND'));
  }
  
  res.json(apiResponse(digest));
}));

// Check if thematic digest exists for date
router.get('/thematic-digest/:userId/exists/:date', asyncHandler(async (req: Request, res: Response) => {
  const { userId, date } = req.params;
  const exists = await storage.hasThematicDigestForDate(userId, new Date(date));
  res.json(apiResponse({ exists }));
}));

// Create thematic digest
router.post('/thematic-digests', asyncHandler(async (req: Request, res: Response) => {
  const { 
    userId, date, emailDigestId, sectionsCount, 
    totalSourceEmails, processingMethod 
  } = req.body;
  
  if (!userId || !emailDigestId || sectionsCount === undefined || 
      totalSourceEmails === undefined || !processingMethod) {
    return res.status(400).json(apiError('Missing required fields', 'MISSING_FIELDS'));
  }
  
  const digest = await storage.createThematicDigest({
    userId,
    date: date ? new Date(date) : new Date(),
    emailDigestId,
    sectionsCount,
    totalSourceEmails,
    processingMethod
  });
  
  res.status(201).json(apiResponse(digest, 'Thematic digest created'));
}));

// ==================== THEMATIC SECTIONS ====================

// Create thematic section
router.post('/thematic-sections', asyncHandler(async (req: Request, res: Response) => {
  const { 
    thematicDigestId, theme, summary, confidence, 
    keywords, entities, order 
  } = req.body;
  
  if (!thematicDigestId || !theme || !summary || order === undefined) {
    return res.status(400).json(apiError('Missing required fields', 'MISSING_FIELDS'));
  }
  
  const section = await storage.createThematicSection({
    thematicDigestId,
    theme,
    summary,
    confidence,
    keywords: keywords || [],
    entities: entities || {},
    order
  });
  
  res.status(201).json(apiResponse(section, 'Thematic section created'));
}));

// Get thematic sections
router.get('/thematic-sections/:thematicDigestId', asyncHandler(async (req: Request, res: Response) => {
  const thematicDigestId = parseInt(req.params.thematicDigestId);
  
  if (isNaN(thematicDigestId)) {
    return res.status(400).json(apiError('Invalid thematic digest ID', 'INVALID_ID'));
  }
  
  const sections = await storage.getThematicSections(thematicDigestId);
  res.json(apiResponse(sections));
}));

// ==================== THEME SOURCE EMAILS ====================

// Create theme source email link
router.post('/theme-source-emails', asyncHandler(async (req: Request, res: Response) => {
  const { thematicSectionId, digestEmailId, relevanceScore } = req.body;
  
  if (!thematicSectionId || !digestEmailId) {
    return res.status(400).json(apiError('Missing required fields', 'MISSING_FIELDS'));
  }
  
  const link = await storage.createThemeSourceEmail({
    thematicSectionId,
    digestEmailId,
    relevanceScore
  });
  
  res.status(201).json(apiResponse(link, 'Theme source email link created'));
}));

// Get theme source emails
router.get('/theme-source-emails/:thematicSectionId', asyncHandler(async (req: Request, res: Response) => {
  const thematicSectionId = parseInt(req.params.thematicSectionId);
  
  if (isNaN(thematicSectionId)) {
    return res.status(400).json(apiError('Invalid thematic section ID', 'INVALID_ID'));
  }
  
  const sourceEmails = await storage.getThemeSourceEmails(thematicSectionId);
  res.json(apiResponse(sourceEmails));
}));

// ==================== UTILITY ENDPOINTS ====================

// Get users with monitored emails (for email worker)
router.get('/users-with-monitored-emails', asyncHandler(async (req: Request, res: Response) => {
  try {
    const users = await storage.getUsersWithMonitoredEmails();
    
    console.log(`📊 Found ${users.length} users with monitored emails`);
    res.json(apiResponse(users));
  } catch (error: any) {
    console.error('Error getting users with monitored emails:', error);
    res.status(500).json(apiError(`Failed to get users: ${error.message}`, 'USERS_FETCH_FAILED'));
  }
}));

export { router as storageRoutes };