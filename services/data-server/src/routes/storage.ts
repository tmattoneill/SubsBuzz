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
  return res.json(apiResponse(monitoredEmails));
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

  return res.json(apiResponse(monitoredEmail));
}));

// Add monitored email
router.post('/monitored-emails', asyncHandler(async (req: Request, res: Response) => {
  const { userId, email, active, categoryId } = req.body;

  if (!userId || !email) {
    return res.status(400).json(apiError('userId and email are required', 'MISSING_FIELDS'));
  }

  // Cross-user ownership check: ensure the category belongs to this user before
  // linking. Prevents user A from assigning user B's category to their sender.
  if (categoryId != null) {
    const cat = await storage.getEmailCategory(userId, categoryId);
    if (!cat) {
      return res.status(400).json(apiError('Invalid categoryId for user', 'INVALID_CATEGORY'));
    }
  }

  const newMonitoredEmail = await storage.addMonitoredEmail({
    userId,
    email,
    active: active !== undefined ? active : true,
    categoryId: categoryId ?? null,
  });

  return res.status(201).json(apiResponse(newMonitoredEmail, 'Monitored email added'));
}));

// Update monitored email (active toggle / category reassignment)
router.patch('/monitored-emails/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json(apiError('Invalid ID', 'INVALID_ID'));
  }
  const { userId, active, categoryId } = req.body;
  if (!userId) {
    return res.status(400).json(apiError('userId is required', 'MISSING_FIELDS'));
  }

  if (categoryId != null) {
    const cat = await storage.getEmailCategory(userId, categoryId);
    if (!cat) {
      return res.status(400).json(apiError('Invalid categoryId for user', 'INVALID_CATEGORY'));
    }
  }

  const updated = await storage.updateMonitoredEmail(userId, id, {
    active,
    categoryId: categoryId === undefined ? undefined : categoryId,
  });
  if (!updated) {
    return res.status(404).json(apiError('Monitored email not found', 'NOT_FOUND'));
  }
  return res.json(apiResponse(updated, 'Monitored email updated'));
}));

// Remove monitored email
router.delete('/monitored-emails/:userId/:id', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const id = parseInt(req.params.id);
  
  if (isNaN(id)) {
    return res.status(400).json(apiError('Invalid ID', 'INVALID_ID'));
  }
  
  await storage.removeMonitoredEmail(userId, id);
  return res.json(apiResponse(null, 'Monitored email removed'));
}));

// ==================== EMAIL DIGESTS ====================

// Get email digests for a user
router.get('/email-digests/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const digests = await storage.getEmailDigests(userId);
  return res.json(apiResponse(digests));
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

  return res.json(apiResponse(digest));
}));

// Get latest email digest
router.get('/email-digest/:userId/latest', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const digest = await storage.getLatestEmailDigest(userId);

  if (!digest) {
    return res.status(404).json(apiError('No digests found', 'NOT_FOUND'));
  }

  return res.json(apiResponse(digest));
}));

// Get digest by date
router.get('/email-digest/:userId/date/:date', asyncHandler(async (req: Request, res: Response) => {
  const { userId, date } = req.params;
  const digest = await storage.getDigestByDate(userId, date);

  if (!digest) {
    return res.status(404).json(apiError('No digest found for this date', 'NOT_FOUND'));
  }

  return res.json(apiResponse(digest));
}));

// Get available digest dates
router.get('/available-digest-dates/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const dates = await storage.getAvailableDigestDates(userId);
  return res.json(apiResponse(dates));
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

  return res.status(201).json(apiResponse(newDigest, 'Email digest created'));
}));

// ==================== DIGEST EMAILS ====================

// Get emails for a digest
router.get('/digest-emails/:digestId', asyncHandler(async (req: Request, res: Response) => {
  const digestId = parseInt(req.params.digestId);
  
  if (isNaN(digestId)) {
    return res.status(400).json(apiError('Invalid digest ID', 'INVALID_ID'));
  }
  
  const emails = await storage.getDigestEmails(digestId);
  return res.json(apiResponse(emails));
}));

// Add email to digest
router.post('/digest-emails', asyncHandler(async (req: Request, res: Response) => {
  const {
    digestId, sender, subject, receivedAt, summary, summaryHtml,
    fullContent, topics, keywords, originalLink, gmailMessageId,
    categoryId, categoryNameSnapshot, categorySlugSnapshot
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
    summaryHtml: summaryHtml ?? null,
    fullContent,
    topics: topics || [],
    keywords: keywords || [],
    originalLink,
    gmailMessageId: gmailMessageId || null,
    categoryId: categoryId ?? null,
    categoryNameSnapshot: categoryNameSnapshot ?? null,
    categorySlugSnapshot: categorySlugSnapshot ?? null,
  });

  return res.status(201).json(apiResponse(newEmail, 'Email added to digest'));
}));

// Get digest emails by category slug (for collection route)
router.get('/digests/by-category/:userId/:slug', asyncHandler(async (req: Request, res: Response) => {
  const { userId, slug } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const before = req.query.before ? new Date(req.query.before as string) : undefined;

  const emails = await storage.getDigestEmailsByCategorySlug(userId, slug, limit, before);
  return res.json(apiResponse(emails));
}));

// ==================== USER SETTINGS ====================

// Strip the raw OpenAI key from any settings response — callers only need to
// know whether one is configured, not the key itself. Returning the plaintext
// key from a GET (even over the internal API) is a needless exposure.
function maskUserSettings(settings: any) {
  if (!settings) return settings;
  const { openaiApiKey, ...rest } = settings;
  return {
    ...rest,
    openaiApiKeyConfigured: typeof openaiApiKey === 'string' && openaiApiKey.length > 0,
  };
}

const ALLOWED_SETTINGS_FIELDS = new Set([
  'dailyDigestEnabled',
  'topicClusteringEnabled',
  'emailNotificationsEnabled',
  'themeMode',
  'themeColor',
  'openaiApiKey',
  'firstName',
  'lastName',
  'location',
  'inboxCleanupAction',
  'inboxCleanupLabelName',
  'llmProvider',
  'llmMigrationNoticeSeen',
]);

const VALID_LLM_PROVIDERS = new Set(['deepseek', 'openai']);

// Get user settings
router.get('/user-settings/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const settings = await storage.getUserSettings(userId);
  return res.json(apiResponse(maskUserSettings(settings)));
}));

// Update user settings
router.patch('/user-settings/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const body = req.body ?? {};

  const unknownFields = Object.keys(body).filter(k => !ALLOWED_SETTINGS_FIELDS.has(k));
  if (unknownFields.length > 0) {
    return res.status(400).json(apiError(
      `Unknown settings fields: ${unknownFields.join(', ')}`,
      'UNKNOWN_FIELDS',
    ));
  }

  if (body.llmProvider !== undefined && !VALID_LLM_PROVIDERS.has(body.llmProvider)) {
    return res.status(400).json(apiError(
      `llmProvider must be one of: ${[...VALID_LLM_PROVIDERS].join(', ')}`,
      'INVALID_LLM_PROVIDER',
    ));
  }

  if (body.llmMigrationNoticeSeen !== undefined && typeof body.llmMigrationNoticeSeen !== 'boolean') {
    return res.status(400).json(apiError(
      'llmMigrationNoticeSeen must be boolean',
      'INVALID_FIELD_TYPE',
    ));
  }

  const updatedSettings = await storage.updateUserSettings(userId, body);
  return res.json(apiResponse(maskUserSettings(updatedSettings), 'Settings updated'));
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
    scope,
    // Re-consent always clears any prior revocation — by definition we just
    // received a working refresh token from Google. (TEEPER-204)
    revokedAt: null,
    revocationReason: null,
  });

  return res.status(201).json(apiResponse(token, 'OAuth token stored'));
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
    revoked_at: token.revokedAt instanceof Date ? token.revokedAt.toISOString() : token.revokedAt,
    revocation_reason: token.revocationReason,
    created_at: token.createdAt instanceof Date ? token.createdAt.toISOString() : token.createdAt,
    updated_at: token.updatedAt instanceof Date ? token.updatedAt.toISOString() : token.updatedAt
  };

  return res.json(apiResponse(transformedToken));
}));

// Get OAuth token by email
router.get('/oauth-token/email/:email', asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.params;
  const token = await storage.getOAuthTokenByEmail(email);
  
  if (!token) {
    return res.status(404).json(apiError('OAuth token not found', 'NOT_FOUND'));
  }

  return res.json(apiResponse(token));
}));

// Update OAuth token
router.patch('/oauth-token/:uid', asyncHandler(async (req: Request, res: Response) => {
  const { uid } = req.params;
  const updates = req.body;
  
  const updatedToken = await storage.updateOAuthToken(uid, updates);
  
  if (!updatedToken) {
    return res.status(404).json(apiError('OAuth token not found', 'NOT_FOUND'));
  }

  return res.json(apiResponse(updatedToken, 'OAuth token updated'));
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
    return res.json(apiResponse(expiringTokens));
  } catch (error: any) {
    console.error('Error getting expiring tokens:', error);
    return res.status(500).json(apiError(`Failed to get expiring tokens: ${error.message}`, 'EXPIRING_TOKENS_FAILED'));
  }
}));

// Create session token for user (called after OAuth login)
router.post('/session-token/:uid', asyncHandler(async (req: Request, res: Response) => {
  const { uid } = req.params;
  const result = await storage.createSessionToken(uid);
  return res.json(apiResponse(result, 'Session token created'));
}));

// Validate session token (called by api-gateway on refresh)
router.post('/session-validate', asyncHandler(async (req: Request, res: Response) => {
  const { sessionToken } = req.body;

  if (!sessionToken) {
    return res.status(400).json(apiError('sessionToken is required', 'MISSING_FIELDS'));
  }

  const user = await storage.validateSessionToken(sessionToken);
  if (!user) {
    return res.status(401).json(apiError('Invalid or expired session token', 'INVALID_SESSION'));
  }

  return res.json(apiResponse(user));
}));

// ==================== THEMATIC DIGESTS ====================

// Get thematic digests for a user
router.get('/thematic-digests/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const digests = await storage.getThematicDigests(userId);
  return res.json(apiResponse(digests));
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

  return res.json(apiResponse(digest));
}));

// Get latest thematic digest
router.get('/thematic-digest/:userId/latest', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const digest = await storage.getLatestThematicDigest(userId);
  
  if (!digest) {
    return res.status(404).json(apiError('No thematic digests found', 'NOT_FOUND'));
  }

  return res.json(apiResponse(digest));
}));

// Check if thematic digest exists for date
router.get('/thematic-digest/:userId/exists/:date', asyncHandler(async (req: Request, res: Response) => {
  const { userId, date } = req.params;
  const exists = await storage.hasThematicDigestForDate(userId, new Date(date));
  return res.json(apiResponse({ exists }));
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

  return res.status(201).json(apiResponse(digest, 'Thematic digest created'));
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

  return res.status(201).json(apiResponse(section, 'Thematic section created'));
}));

// Get thematic sections
router.get('/thematic-sections/:thematicDigestId', asyncHandler(async (req: Request, res: Response) => {
  const thematicDigestId = parseInt(req.params.thematicDigestId);
  
  if (isNaN(thematicDigestId)) {
    return res.status(400).json(apiError('Invalid thematic digest ID', 'INVALID_ID'));
  }
  
  const sections = await storage.getThematicSections(thematicDigestId);
  return res.json(apiResponse(sections));
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

  return res.status(201).json(apiResponse(link, 'Theme source email link created'));
}));

// Get theme source emails
router.get('/theme-source-emails/:thematicSectionId', asyncHandler(async (req: Request, res: Response) => {
  const thematicSectionId = parseInt(req.params.thematicSectionId);
  
  if (isNaN(thematicSectionId)) {
    return res.status(400).json(apiError('Invalid thematic section ID', 'INVALID_ID'));
  }
  
  const sourceEmails = await storage.getThemeSourceEmails(thematicSectionId);
  return res.json(apiResponse(sourceEmails));
}));

// ==================== UTILITY ENDPOINTS ====================

// Get users with monitored emails (for email worker)
router.get('/users-with-monitored-emails', asyncHandler(async (req: Request, res: Response) => {
  try {
    const users = await storage.getUsersWithMonitoredEmails();
    
    console.log(`📊 Found ${users.length} users with monitored emails`);
    return res.json(apiResponse(users));
  } catch (error: any) {
    console.error('Error getting users with monitored emails:', error);
    return res.status(500).json(apiError(`Failed to get users: ${error.message}`, 'USERS_FETCH_FAILED'));
  }
}));

export { router as storageRoutes };