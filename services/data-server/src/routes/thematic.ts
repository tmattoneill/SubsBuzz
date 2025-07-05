/**
 * Thematic Routes - Thematic Digest Processing
 * 
 * Handles thematic digest operations and advanced processing
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

// ==================== THEMATIC DIGEST OPERATIONS ====================

// Get all thematic digests for a user
router.get('/digests/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { limit, offset } = req.query;
  
  console.log(`📚 Getting thematic digests for user ${userId}`);
  
  try {
    const digests = await storage.getThematicDigests(userId);
    
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
    console.error('Error getting thematic digests:', error);
    res.status(500).json(apiError(
      `Failed to get thematic digests: ${error.message}`,
      'THEMATIC_RETRIEVAL_FAILED'
    ));
  }
}));

// Get specific thematic digest with full details
router.get('/digest/:userId/:id', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const id = parseInt(req.params.id);
  
  if (isNaN(id)) {
    return res.status(400).json(apiError('Invalid thematic digest ID', 'INVALID_ID'));
  }
  
  console.log(`🎯 Getting thematic digest ${id} for user ${userId}`);
  
  try {
    const digest = await storage.getThematicDigest(userId, id);
    
    if (!digest) {
      return res.status(404).json(apiError('Thematic digest not found', 'NOT_FOUND'));
    }
    
    res.json(apiResponse(digest));
    
  } catch (error: any) {
    console.error('Error getting thematic digest:', error);
    res.status(500).json(apiError(
      `Failed to get thematic digest: ${error.message}`,
      'THEMATIC_RETRIEVAL_FAILED'
    ));
  }
}));

// Get latest thematic digest
router.get('/latest/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  
  console.log(`🎯 Getting latest thematic digest for user ${userId}`);
  
  try {
    const digest = await storage.getLatestThematicDigest(userId);
    
    if (!digest) {
      return res.status(404).json(apiError('No thematic digests found', 'NOT_FOUND'));
    }
    
    res.json(apiResponse(digest));
    
  } catch (error: any) {
    console.error('Error getting latest thematic digest:', error);
    res.status(500).json(apiError(
      `Failed to get latest thematic digest: ${error.message}`,
      'THEMATIC_RETRIEVAL_FAILED'
    ));
  }
}));

// Check if thematic digest exists for a specific date
router.get('/exists/:userId/:date', asyncHandler(async (req: Request, res: Response) => {
  const { userId, date } = req.params;
  
  console.log(`🔍 Checking if thematic digest exists for user ${userId} on ${date}`);
  
  try {
    const exists = await storage.hasThematicDigestForDate(userId, new Date(date));
    res.json(apiResponse({ exists, date, userId }));
    
  } catch (error: any) {
    console.error('Error checking thematic digest existence:', error);
    res.status(500).json(apiError(
      `Failed to check thematic digest existence: ${error.message}`,
      'EXISTENCE_CHECK_FAILED'
    ));
  }
}));

// ==================== THEMATIC SECTIONS ====================

// Get sections for a thematic digest
router.get('/sections/:thematicDigestId', asyncHandler(async (req: Request, res: Response) => {
  const thematicDigestId = parseInt(req.params.thematicDigestId);
  
  if (isNaN(thematicDigestId)) {
    return res.status(400).json(apiError('Invalid thematic digest ID', 'INVALID_ID'));
  }
  
  console.log(`📑 Getting sections for thematic digest ${thematicDigestId}`);
  
  try {
    const sections = await storage.getThematicSections(thematicDigestId);
    res.json(apiResponse(sections));
    
  } catch (error: any) {
    console.error('Error getting thematic sections:', error);
    res.status(500).json(apiError(
      `Failed to get thematic sections: ${error.message}`,
      'SECTIONS_RETRIEVAL_FAILED'
    ));
  }
}));

// Create thematic section
router.post('/sections', asyncHandler(async (req: Request, res: Response) => {
  const { 
    thematicDigestId, theme, summary, confidence, 
    keywords, entities, order 
  } = req.body;
  
  if (!thematicDigestId || !theme || !summary || order === undefined) {
    return res.status(400).json(apiError(
      'thematicDigestId, theme, summary, and order are required', 
      'MISSING_FIELDS'
    ));
  }
  
  console.log(`📝 Creating thematic section for digest ${thematicDigestId}: ${theme}`);
  
  try {
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
    
  } catch (error: any) {
    console.error('Error creating thematic section:', error);
    res.status(500).json(apiError(
      `Failed to create thematic section: ${error.message}`,
      'SECTION_CREATION_FAILED'
    ));
  }
}));

// ==================== SOURCE EMAIL LINKS ====================

// Get source emails for a thematic section
router.get('/section/:sectionId/sources', asyncHandler(async (req: Request, res: Response) => {
  const sectionId = parseInt(req.params.sectionId);
  
  if (isNaN(sectionId)) {
    return res.status(400).json(apiError('Invalid section ID', 'INVALID_ID'));
  }
  
  console.log(`🔗 Getting source emails for section ${sectionId}`);
  
  try {
    const sourceEmails = await storage.getThemeSourceEmails(sectionId);
    res.json(apiResponse(sourceEmails));
    
  } catch (error: any) {
    console.error('Error getting source emails:', error);
    res.status(500).json(apiError(
      `Failed to get source emails: ${error.message}`,
      'SOURCE_EMAILS_FAILED'
    ));
  }
}));

// Link source email to thematic section
router.post('/section/sources', asyncHandler(async (req: Request, res: Response) => {
  const { thematicSectionId, digestEmailId, relevanceScore } = req.body;
  
  if (!thematicSectionId || !digestEmailId) {
    return res.status(400).json(apiError(
      'thematicSectionId and digestEmailId are required', 
      'MISSING_FIELDS'
    ));
  }
  
  console.log(`🔗 Linking email ${digestEmailId} to section ${thematicSectionId}`);
  
  try {
    const link = await storage.createThemeSourceEmail({
      thematicSectionId,
      digestEmailId,
      relevanceScore: relevanceScore || 50
    });
    
    res.status(201).json(apiResponse(link, 'Source email linked to section'));
    
  } catch (error: any) {
    console.error('Error linking source email:', error);
    res.status(500).json(apiError(
      `Failed to link source email: ${error.message}`,
      'SOURCE_LINK_FAILED'
    ));
  }
}));

// ==================== THEMATIC PROCESSING ====================

// Process emails into thematic digest (main processing endpoint)
router.post('/process', asyncHandler(async (req: Request, res: Response) => {
  const { userId, emailDigestId, emails } = req.body;
  
  if (!userId || !emailDigestId || !emails || !Array.isArray(emails)) {
    return res.status(400).json(apiError(
      'userId, emailDigestId, and emails array are required', 
      'MISSING_FIELDS'
    ));
  }
  
  if (emails.length === 0) {
    return res.status(400).json(apiError('At least one email is required', 'NO_EMAILS'));
  }
  
  console.log(`🎯 Processing ${emails.length} emails into thematic digest for user ${userId}`);
  
  try {
    // Import and use thematic processor
    const { thematicProcessor } = await import('../services/thematic-processor.js');
    
    const thematicDigestId = await thematicProcessor.processEmailsIntoThemes(userId, emails);
    
    res.status(201).json(apiResponse({
      thematicDigestId,
      emailDigestId,
      emailsProcessed: emails.length,
      userId,
      processingMethod: 'category-classification'
    }, 'Thematic digest processed successfully'));
    
  } catch (error: any) {
    console.error('Error processing thematic digest:', error);
    res.status(500).json(apiError(
      `Failed to process thematic digest: ${error.message}`,
      'THEMATIC_PROCESSING_FAILED'
    ));
  }
}));

// ==================== ANALYTICS ====================

// Get thematic digest analytics
router.get('/analytics/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { period, limit } = req.query;
  
  console.log(`📊 Getting thematic analytics for user ${userId}`);
  
  try {
    const thematicDigests = await storage.getThematicDigests(userId);
    
    if (thematicDigests.length === 0) {
      return res.json(apiResponse({
        totalThematicDigests: 0,
        totalSections: 0,
        totalSourceEmails: 0,
        averageSectionsPerDigest: 0,
        averageSourceEmailsPerDigest: 0,
        commonThemes: [],
        processingMethods: {},
        period: period || 'all-time'
      }));
    }
    
    // Calculate analytics
    const totalSections = thematicDigests.reduce((sum, d) => sum + d.sectionsCount, 0);
    const totalSourceEmails = thematicDigests.reduce((sum, d) => sum + d.totalSourceEmails, 0);
    
    // Get processing method breakdown
    const processingMethods: Record<string, number> = {};
    thematicDigests.forEach(digest => {
      processingMethods[digest.processingMethod] = 
        (processingMethods[digest.processingMethod] || 0) + 1;
    });
    
    const analytics = {
      totalThematicDigests: thematicDigests.length,
      totalSections,
      totalSourceEmails,
      averageSectionsPerDigest: totalSections / thematicDigests.length,
      averageSourceEmailsPerDigest: totalSourceEmails / thematicDigests.length,
      processingMethods,
      mostRecentDigest: thematicDigests[0]?.date || null,
      oldestDigest: thematicDigests[thematicDigests.length - 1]?.date || null,
      period: period || 'all-time'
    };
    
    res.json(apiResponse(analytics));
    
  } catch (error: any) {
    console.error('Error getting thematic analytics:', error);
    res.status(500).json(apiError(
      `Failed to get thematic analytics: ${error.message}`,
      'ANALYTICS_FAILED'
    ));
  }
}));

// Get theme frequency analysis
router.get('/themes/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { limit = '10' } = req.query;
  
  console.log(`🏷️  Getting theme analysis for user ${userId}`);
  
  try {
    const thematicDigests = await storage.getThematicDigests(userId);
    const themeFrequency: Record<string, number> = {};
    
    // Collect all themes from all sections
    for (const digest of thematicDigests) {
      const sections = await storage.getThematicSections(digest.id);
      sections.forEach(section => {
        themeFrequency[section.theme] = (themeFrequency[section.theme] || 0) + 1;
      });
    }
    
    // Sort by frequency and limit results
    const sortedThemes = Object.entries(themeFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, parseInt(limit as string))
      .map(([theme, count]) => ({ theme, count }));
    
    res.json(apiResponse({
      themes: sortedThemes,
      totalUniqueThemes: Object.keys(themeFrequency).length,
      totalThemeInstances: Object.values(themeFrequency).reduce((sum, count) => sum + count, 0)
    }));
    
  } catch (error: any) {
    console.error('Error getting theme analysis:', error);
    res.status(500).json(apiError(
      `Failed to get theme analysis: ${error.message}`,
      'THEME_ANALYSIS_FAILED'
    ));
  }
}));

export { router as thematicRoutes };