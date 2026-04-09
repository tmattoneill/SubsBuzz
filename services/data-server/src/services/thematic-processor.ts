/**
 * Thematic Processor Service - Advanced Digest Processing
 * 
 * Extracted from server/thematic-processor.ts for the data server
 * Handles the 3-stage thematic digest generation pipeline
 */

import { storage } from './storage';
import { analyzeEmailForThemes, generateDailySummary, ProcessedEmail } from './openai';
import {
  InsertThematicDigest,
  InsertThematicSection,
  InsertThemeSourceEmail
} from '../db/schema.js';

export interface ThematicProcessingResult {
  thematicDigestId: number;
  sectionsCount: number;
  totalSourceEmails: number;
  processingMethod: string;
  dailySummary: string;
}

export interface ThematicTheme {
  name: string;
  summary: string;
  confidence: number;
  keywords: string[];
  emailIndexes: number[];
}

export interface ThematicAnalysis {
  themes: ThematicTheme[];
  totalEmails: number;
  processingMethod: string;
}

/**
 * Stage 1: NLP Analysis and Email Clustering
 */
async function stageOneAnalysis(emails: ProcessedEmail[], apiKey?: string | null): Promise<ThematicAnalysis> {
  console.log('📊 Stage 1: NLP Analysis and Email Clustering');

  if (emails.length === 0) {
    return {
      themes: [],
      totalEmails: 0,
      processingMethod: 'no-emails'
    };
  }

  try {
    // Use OpenAI for advanced theme analysis
    const analysis = await analyzeEmailForThemes(emails, apiKey);
    
    return {
      themes: analysis.themes || [],
      totalEmails: emails.length,
      processingMethod: 'ai-analysis'
    };

  } catch (error) {
    console.error('Stage 1 analysis failed, using fallback:', error);
    
    // Fallback to topic-based clustering
    return fallbackTopicClustering(emails);
  }
}

/**
 * Fallback clustering based on email topics
 */
function fallbackTopicClustering(emails: ProcessedEmail[]): ThematicAnalysis {
  console.log('🔄 Using fallback topic-based clustering');
  
  const topicCounts: Record<string, number[]> = {};
  
  // Group emails by their primary topics
  emails.forEach((email, index) => {
    email.topics.forEach(topic => {
      if (!topicCounts[topic]) {
        topicCounts[topic] = [];
      }
      topicCounts[topic].push(index);
    });
  });

  // Create themes from most common topics
  const themes: ThematicTheme[] = Object.entries(topicCounts)
    .filter(([topic, emailIndexes]) => emailIndexes.length >= 1)
    .sort(([,a], [,b]) => b.length - a.length)
    .slice(0, 5)
    .map(([topic, emailIndexes]) => ({
      name: topic,
      summary: `${emailIndexes.length} emails related to ${topic}. Topics include various updates and news about ${topic}.`,
      confidence: Math.min(90, emailIndexes.length * 20),
      keywords: [topic],
      emailIndexes
    }));

  return {
    themes,
    totalEmails: emails.length,
    processingMethod: 'topic-clustering'
  };
}

/**
 * Stage 2: Pass through — Stage 1 AI summaries are already narrative quality.
 * No template overwriting.
 */
async function stageTwoSynthesis(
  themes: ThematicTheme[],
  _emails: ProcessedEmail[]
): Promise<ThematicTheme[]> {
  console.log('📝 Stage 2: Keeping Stage 1 AI-generated summaries');
  return themes;
}

/**
 * Stage 3: Database Storage and Source Linking
 */
async function stageThreeStorage(
  userId: string,
  emailDigestId: number,
  themes: ThematicTheme[],
  emails: ProcessedEmail[],
  processingMethod: string,
  dailySummary: string
): Promise<number> {
  console.log('💾 Stage 3: Database Storage and Source Linking');
  
  try {
    // Create the thematic digest record
    const thematicDigestData: InsertThematicDigest = {
      userId,
      date: new Date(),
      emailDigestId,
      sectionsCount: themes.length,
      totalSourceEmails: emails.length,
      processingMethod,
      dailySummary
    };

    const thematicDigest = await storage.createThematicDigest(thematicDigestData);
    console.log(`✅ Created thematic digest with ID ${thematicDigest.id}`);

    // Create sections for each theme
    for (const [i, theme] of themes.entries()) {
      
      const sectionData: InsertThematicSection = {
        thematicDigestId: thematicDigest.id,
        theme: theme.name,
        summary: theme.summary,
        confidence: theme.confidence,
        keywords: theme.keywords,
        entities: {}, // Could be enhanced with NER in the future
        order: i
      };

      const section = await storage.createThematicSection(sectionData);
      console.log(`✅ Created section "${theme.name}" with ID ${section.id}`);

      // Link source emails to this section
      for (const emailIndex of theme.emailIndexes) {
        if (emailIndex < emails.length) {
          // Find the digest email ID by matching email properties
          const digestEmails = await storage.getDigestEmails(emailDigestId);
          const email = emails[emailIndex];
          if (!email) continue;

          const matchingDigestEmail = digestEmails.find(de =>
            de.sender === email.sender && 
            de.subject === email.subject
          );

          if (matchingDigestEmail) {
            const linkData: InsertThemeSourceEmail = {
              thematicSectionId: section.id,
              digestEmailId: matchingDigestEmail.id,
              relevanceScore: theme.confidence
            };

            await storage.createThemeSourceEmail(linkData);
            console.log(`🔗 Linked email "${email.subject}" to section "${theme.name}"`);
          }
        }
      }
    }

    return thematicDigest.id;

  } catch (error) {
    console.error('Error in stage 3 storage:', error);
    throw error;
  }
}

/**
 * Main processing function - orchestrates all 3 stages
 */
export async function processEmailsIntoThemes(
  userId: string,
  emails: ProcessedEmail[],
  emailDigestId?: number,
  apiKey?: string | null
): Promise<ThematicProcessingResult> {
  console.log(`🎯 Starting thematic processing for user ${userId} with ${emails.length} emails`);
  
  if (emails.length === 0) {
    throw new Error('No emails provided for thematic processing');
  }

  try {
    // Stage 1: NLP Analysis and Email Clustering
    const analysis = await stageOneAnalysis(emails, apiKey);
    
    if (analysis.themes.length === 0) {
      throw new Error('No themes identified from email analysis');
    }

    console.log(`📊 Stage 1 complete: ${analysis.themes.length} themes identified`);

    // Stage 2: LLM Synthesis and Narrative Generation
    const enhancedThemes = await stageTwoSynthesis(analysis.themes, emails);
    console.log(`📝 Stage 2 complete: Enhanced ${enhancedThemes.length} themes`);

    // Stage 2.5: Generate overall daily synthesis paragraph
    const dailySummary = await generateDailySummary(enhancedThemes, emails.length, apiKey);
    console.log(`📰 Daily summary: ${dailySummary ? dailySummary.slice(0, 80) + '...' : '(none)'}`);

    // If no emailDigestId provided, we need to create a basic digest first
    let finalEmailDigestId = emailDigestId;
    if (!finalEmailDigestId) {
      // Create a basic email digest for linking
      const basicDigest = await storage.createEmailDigest({
        userId,
        date: new Date(),
        emailsProcessed: emails.length,
        topicsIdentified: emails.reduce((acc, email) => acc + email.topics.length, 0)
      });
      finalEmailDigestId = basicDigest.id;

      // Add emails to the digest
      for (const email of emails) {
        await storage.addDigestEmail({
          digestId: basicDigest.id,
          sender: email.sender,
          subject: email.subject,
          receivedAt: email.receivedAt,
          summary: email.summary,
          fullContent: email.fullContent,
          topics: email.topics,
          keywords: email.keywords,
          originalLink: email.originalLink || null
        });
      }
    }

    // Stage 3: Database Storage and Source Linking
    const thematicDigestId = await stageThreeStorage(
      userId,
      finalEmailDigestId,
      enhancedThemes,
      emails,
      analysis.processingMethod,
      dailySummary
    );

    console.log(`💾 Stage 3 complete: Thematic digest stored with ID ${thematicDigestId}`);

    const result: ThematicProcessingResult = {
      thematicDigestId,
      sectionsCount: enhancedThemes.length,
      totalSourceEmails: emails.length,
      processingMethod: analysis.processingMethod,
      dailySummary
    };

    console.log(`🎉 Thematic processing complete:`, result);
    return result;

  } catch (error) {
    console.error('Error in thematic processing:', error);
    throw error;
  }
}

/**
 * Process emails from raw input (for API endpoints)
 */
export async function processRawEmailsIntoThemes(
  userId: string,
  rawEmails: any[]
): Promise<ThematicProcessingResult> {
  console.log(`🔄 Processing ${rawEmails.length} raw emails into themes`);
  
  // Convert raw emails to ProcessedEmail format
  const processedEmails: ProcessedEmail[] = rawEmails.map(email => ({
    sender: email.sender || 'Unknown',
    source: email.source || email.sender || 'Unknown',
    subject: email.subject || 'No Subject',
    receivedAt: email.receivedAt ? new Date(email.receivedAt) : new Date(),
    snippet: email.snippet || email.subject || '',
    summary: email.summary || `Email from ${email.sender}`,
    fullContent: email.fullContent || email.content || '',
    topics: Array.isArray(email.topics) ? email.topics : [],
    keywords: Array.isArray(email.keywords) ? email.keywords : [],
    originalLink: email.originalLink
  }));

  return processEmailsIntoThemes(userId, processedEmails);
}

/**
 * Get processing statistics
 */
export async function getProcessingStats(userId: string): Promise<any> {
  console.log(`📊 Getting processing statistics for user ${userId}`);
  
  try {
    const thematicDigests = await storage.getThematicDigests(userId);
    const emailDigests = await storage.getEmailDigests(userId);
    
    const stats = {
      totalThematicDigests: thematicDigests.length,
      totalRegularDigests: emailDigests.length,
      totalSections: thematicDigests.reduce((sum, d) => sum + d.sectionsCount, 0),
      totalSourceEmails: thematicDigests.reduce((sum, d) => sum + d.totalSourceEmails, 0),
      processingMethods: thematicDigests.reduce((acc, d) => {
        acc[d.processingMethod] = (acc[d.processingMethod] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      averageSectionsPerDigest: thematicDigests.length > 0 ? 
        thematicDigests.reduce((sum, d) => sum + d.sectionsCount, 0) / thematicDigests.length : 0,
      averageEmailsPerDigest: thematicDigests.length > 0 ?
        thematicDigests.reduce((sum, d) => sum + d.totalSourceEmails, 0) / thematicDigests.length : 0
    };

    return stats;

  } catch (error) {
    console.error('Error getting processing stats:', error);
    throw error;
  }
}

// Export the main processor instance
export const thematicProcessor = {
  processEmailsIntoThemes,
  processRawEmailsIntoThemes,
  getProcessingStats
};