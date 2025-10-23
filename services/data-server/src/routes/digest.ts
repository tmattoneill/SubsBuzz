/**
 * Digest Routes - AI Processing and Business Logic
 * 
 * Handles digest generation, OpenAI processing, and thematic analysis
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/error';
import { generateDigest, getLatestDigest, getLatestThematicDigest } from '../services/openai';
import { storage } from '../services/storage';
import { queueDigestGeneration } from '../services/celery-client';

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

// ==================== DIGEST GENERATION ====================

// Create digest from processed emails
router.post('/create', asyncHandler(async (req: Request, res: Response) => {
  const { user_id, emails } = req.body;
  
  if (!user_id || !emails || !Array.isArray(emails)) {
    return res.status(400).json(apiError('user_id and emails array are required', 'MISSING_FIELDS'));
  }
  
  console.log(`📧 Creating digest for user ${user_id} with ${emails.length} emails`);
  
  try {
    // Transform incoming email data to EmailInput format
    const transformedEmails = emails.map((email: any) => ({
      sender: email.sender,
      subject: email.subject,
      content: email.content,
      receivedAt: new Date(email.received_at || email.receivedAt), // Handle both snake_case and camelCase
      originalLink: email.original_link || email.originalLink
    }));
    
    // Generate digest using existing OpenAI service
    const digest = await generateDigest(user_id, transformedEmails);
    
    res.status(201).json(apiResponse(digest, 'Digest created successfully'));
    
  } catch (error: any) {
    console.error('Error creating digest:', error);
    res.status(500).json(apiError(
      `Failed to create digest: ${error.message}`,
      'DIGEST_CREATION_FAILED'
    ));
  }
}));

// Generate digest automatically (new simple endpoint)
router.post('/generate', asyncHandler(async (req: Request, res: Response) => {
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json(apiError('user_id is required', 'MISSING_FIELDS'));
  }

  console.log(`🚀 Auto-generating digest for user ${user_id}`);

  try {
    // Get monitored emails for the user
    const monitoredEmails = await storage.getMonitoredEmails(user_id);

    if (monitoredEmails.length === 0) {
      return res.status(400).json(apiError('No monitored emails configured. Please add email sources first.', 'NO_MONITORED_EMAILS'));
    }

    // Get OAuth tokens for Gmail access
    const oauthTokens = await storage.getOAuthTokenByUid(user_id);

    if (!oauthTokens) {
      return res.status(400).json(apiError('No OAuth tokens found. Please re-authenticate with Gmail.', 'NO_OAUTH_TOKENS'));
    }

    // Queue the digest generation task to Celery worker
    const taskId = await queueDigestGeneration(user_id);

    res.json(apiResponse({
      message: 'Digest generation started successfully',
      user_id,
      monitored_emails_count: monitoredEmails.length,
      status: 'processing',
      task_id: taskId
    }, 'Digest generation initiated'));

  } catch (error: any) {
    console.error('Error auto-generating digest:', error);
    res.status(500).json(apiError(
      `Failed to generate digest: ${error.message}`,
      'DIGEST_GENERATION_FAILED'
    ));
  }
}));

// Generate digest manually (for API gateway)
router.post('/generate/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { monitored_emails, oauth_data } = req.body;
  
  if (!monitored_emails || !Array.isArray(monitored_emails)) {
    return res.status(400).json(apiError('monitored_emails array is required', 'MISSING_FIELDS'));
  }
  
  console.log(`🔄 Manual digest generation for user ${userId}`);
  
  try {
    // This would typically trigger the email worker
    // For now, return a placeholder response
    res.json(apiResponse({
      message: 'Digest generation triggered',
      userId,
      monitoredEmails: monitored_emails.length,
      status: 'processing'
    }, 'Digest generation started'));
    
  } catch (error: any) {
    console.error('Error triggering digest generation:', error);
    res.status(500).json(apiError(
      `Failed to trigger digest generation: ${error.message}`,
      'DIGEST_GENERATION_FAILED'
    ));
  }
}));

// ==================== DIGEST RETRIEVAL ====================

// Get latest digest (prioritizes thematic)
router.get('/latest/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  
  console.log(`📊 Getting latest digest for user ${userId}`);
  
  try {
    // Try thematic digest first, fall back to regular
    const latestDigest = await getLatestThematicDigest(userId);
    
    if (!latestDigest) {
      return res.status(404).json(apiError('No digests found for user', 'NOT_FOUND'));
    }
    
    res.json(apiResponse(latestDigest));
    
  } catch (error: any) {
    console.error('Error getting latest digest:', error);
    res.status(500).json(apiError(
      `Failed to get latest digest: ${error.message}`,
      'DIGEST_RETRIEVAL_FAILED'
    ));
  }
}));

// Get latest detailed digest (individual emails)
router.get('/detailed/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  
  console.log(`📧 Getting detailed digest for user ${userId}`);
  
  try {
    const detailedDigest = await getLatestDigest(userId);
    
    if (!detailedDigest) {
      return res.status(404).json(apiError('No detailed digests found for user', 'NOT_FOUND'));
    }
    
    res.json(apiResponse(detailedDigest));
    
  } catch (error: any) {
    console.error('Error getting detailed digest:', error);
    res.status(500).json(apiError(
      `Failed to get detailed digest: ${error.message}`,
      'DIGEST_RETRIEVAL_FAILED'
    ));
  }
}));

// Get digest history
router.get('/history/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { limit, offset } = req.query;
  
  console.log(`📚 Getting digest history for user ${userId}`);
  
  try {
    const digests = await storage.getEmailDigests(userId);
    
    // Apply pagination if provided
    let paginatedDigests = digests;
    if (limit) {
      const limitNum = parseInt(limit as string);
      const offsetNum = parseInt(offset as string) || 0;
      paginatedDigests = digests.slice(offsetNum, offsetNum + limitNum);
    }
    
    res.json(apiResponse({
      digests: paginatedDigests,
      total: digests.length,
      ...(limit && { 
        limit: parseInt(limit as string),
        offset: parseInt(offset as string) || 0
      })
    }));
    
  } catch (error: any) {
    console.error('Error getting digest history:', error);
    res.status(500).json(apiError(
      `Failed to get digest history: ${error.message}`,
      'HISTORY_RETRIEVAL_FAILED'
    ));
  }
}));

// Get digest by date
router.get('/date/:userId/:date', asyncHandler(async (req: Request, res: Response) => {
  const { userId, date } = req.params;
  
  console.log(`📅 Getting digest for user ${userId} on date ${date}`);
  
  try {
    // Check for thematic digest first
    const targetDate = new Date(date);
    const hasThematic = await storage.hasThematicDigestForDate(userId, targetDate);
    
    if (hasThematic) {
      const thematicDigests = await storage.getThematicDigests(userId);
      const thematicDigest = thematicDigests.find(digest => {
        const digestDateStr = new Date(digest.date).toISOString().split('T')[0];
        return digestDateStr === date;
      });
      
      if (thematicDigest) {
        const fullThematicDigest = await storage.getThematicDigest(userId, thematicDigest.id);
        if (fullThematicDigest) {
          return res.json(apiResponse({
            ...fullThematicDigest,
            type: 'thematic',
            date: fullThematicDigest.date instanceof Date ? 
              fullThematicDigest.date.toISOString() : fullThematicDigest.date,
            emailsProcessed: fullThematicDigest.totalSourceEmails,
            topicsIdentified: fullThematicDigest.sectionsCount
          }));
        }
      }
    }
    
    // Fall back to regular digest
    const digest = await storage.getDigestByDate(userId, date);
    
    if (!digest) {
      return res.status(404).json(apiError('No digest found for this date', 'NOT_FOUND'));
    }
    
    // Get emails for this digest
    const emails = await storage.getDigestEmails(digest.id);
    
    const response = {
      ...digest,
      type: 'regular',
      date: digest.date instanceof Date ? digest.date.toISOString() : digest.date,
      emails: emails.map(email => ({
        ...email,
        receivedAt: email.receivedAt instanceof Date ? 
          email.receivedAt.toISOString() : email.receivedAt
      }))
    };
    
    res.json(apiResponse(response));
    
  } catch (error: any) {
    console.error('Error getting digest by date:', error);
    res.status(500).json(apiError(
      `Failed to get digest for date: ${error.message}`,
      'DATE_DIGEST_FAILED'
    ));
  }
}));

// ==================== THEMATIC PROCESSING ====================

// Process emails into thematic digest
router.post('/thematic/process', asyncHandler(async (req: Request, res: Response) => {
  const { userId, emailDigestId, emails } = req.body;
  
  if (!userId || !emailDigestId || !emails || !Array.isArray(emails)) {
    return res.status(400).json(apiError(
      'userId, emailDigestId, and emails array are required', 
      'MISSING_FIELDS'
    ));
  }
  
  console.log(`🎯 Processing ${emails.length} emails into thematic digest for user ${userId}`);
  
  try {
    // Import thematic processor (would be moved to services)
    const { thematicProcessor } = await import('../services/thematic-processor.js');
    
    const thematicDigestId = await thematicProcessor.processEmailsIntoThemes(userId, emails);
    
    res.status(201).json(apiResponse({
      thematicDigestId,
      emailsProcessed: emails.length,
      userId
    }, 'Thematic digest created successfully'));
    
  } catch (error: any) {
    console.error('Error processing thematic digest:', error);
    res.status(500).json(apiError(
      `Failed to process thematic digest: ${error.message}`,
      'THEMATIC_PROCESSING_FAILED'
    ));
  }
}));

// ==================== ANALYTICS ====================

// Get digest statistics
router.get('/stats/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { period } = req.query; // day, week, month, year
  
  console.log(`📊 Getting digest statistics for user ${userId}, period: ${period}`);
  
  try {
    const digests = await storage.getEmailDigests(userId);
    const thematicDigests = await storage.getThematicDigests(userId);
    
    // Calculate statistics
    const stats = {
      totalDigests: digests.length,
      totalThematicDigests: thematicDigests.length,
      totalEmailsProcessed: digests.reduce((sum, d) => sum + d.emailsProcessed, 0),
      totalTopicsIdentified: digests.reduce((sum, d) => sum + d.topicsIdentified, 0),
      averageEmailsPerDigest: digests.length > 0 ? 
        digests.reduce((sum, d) => sum + d.emailsProcessed, 0) / digests.length : 0,
      averageTopicsPerDigest: digests.length > 0 ?
        digests.reduce((sum, d) => sum + d.topicsIdentified, 0) / digests.length : 0,
      mostRecentDigest: digests.length > 0 ? digests[0].date : null,
      period: period || 'all-time'
    };
    
    res.json(apiResponse(stats));
    
  } catch (error: any) {
    console.error('Error getting digest statistics:', error);
    res.status(500).json(apiError(
      `Failed to get digest statistics: ${error.message}`,
      'STATS_RETRIEVAL_FAILED'
    ));
  }
}));

export { router as digestRoutes };