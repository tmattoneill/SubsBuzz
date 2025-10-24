/**
 * OpenAI Service - AI Processing and Analysis
 * 
 * Extracted from server/openai.ts for the data server
 */

import OpenAI from 'openai';
import { storage } from './storage';
import { InsertEmailDigest, InsertDigestEmail } from '../db/schema.js';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface EmailInput {
  sender: string;
  subject: string;
  content: string;
  receivedAt: Date;
  originalLink?: string;
}

export interface ProcessedEmail {
  sender: string;
  subject: string;
  receivedAt: Date;
  summary: string;
  fullContent: string;
  topics: string[];
  keywords: string[];
  originalLink?: string;
}

export interface DigestResult {
  digest: any;
  processedEmails: ProcessedEmail[];
}

/**
 * Process individual email with OpenAI
 */
export async function processEmailWithAI(email: EmailInput): Promise<ProcessedEmail> {
  console.log(`🤖 Processing email: ${email.subject}`);
  
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert email analyst. Analyze the email and provide:
          1. A concise summary (2-3 sentences)
          2. Main topics (3-5 topics)
          3. Key keywords (5-8 keywords)
          
          Return as JSON: {
            "summary": "...",
            "topics": ["topic1", "topic2", ...],
            "keywords": ["keyword1", "keyword2", ...]
          }`
        },
        {
          role: 'user',
          content: `Email from: ${email.sender}
          Subject: ${email.subject}
          Content: ${email.content}`
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    // Strip markdown code fences if present (```json ... ```)
    const cleanedResponse = response
      .replace(/^```json\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();

    const analysis = JSON.parse(cleanedResponse);
    
    return {
      sender: email.sender,
      subject: email.subject,
      receivedAt: email.receivedAt,
      summary: analysis.summary,
      fullContent: email.content,
      topics: Array.isArray(analysis.topics) ? analysis.topics : [],
      keywords: Array.isArray(analysis.keywords) ? analysis.keywords : [],
      originalLink: email.originalLink
    };

  } catch (error) {
    console.error('Error processing email with OpenAI:', error);
    
    // Fallback to basic processing
    return {
      sender: email.sender,
      subject: email.subject,
      receivedAt: email.receivedAt,
      summary: `Email from ${email.sender} regarding ${email.subject}`,
      fullContent: email.content,
      topics: [email.subject.split(' ')[0]],
      keywords: email.subject.split(' ').slice(0, 3),
      originalLink: email.originalLink
    };
  }
}

/**
 * Generate digest from processed emails
 */
export async function generateDigest(userId: string, emails: EmailInput[]): Promise<DigestResult> {
  console.log(`📊 Generating digest for user ${userId} with ${emails.length} emails`);
  
  if (emails.length === 0) {
    throw new Error('No emails provided for digest generation');
  }

  try {
    // Process all emails with AI
    const processedEmails = await Promise.all(
      emails.map(email => processEmailWithAI(email))
    );

    // Create digest record
    const digestData: InsertEmailDigest = {
      userId,
      date: new Date(),
      emailsProcessed: processedEmails.length,
      topicsIdentified: processedEmails.reduce((acc, email) => acc + email.topics.length, 0)
    };

    const digest = await storage.createEmailDigest(digestData);

    // Add all processed emails to the digest
    for (const email of processedEmails) {
      const digestEmailData: InsertDigestEmail = {
        digestId: digest.id,
        sender: email.sender,
        subject: email.subject,
        receivedAt: email.receivedAt,
        summary: email.summary,
        fullContent: email.fullContent,
        topics: email.topics,
        keywords: email.keywords,
        originalLink: email.originalLink || null
      };

      await storage.addDigestEmail(digestEmailData);
    }

    console.log(`✅ Digest created with ID ${digest.id}`);
    
    return {
      digest,
      processedEmails
    };

  } catch (error) {
    console.error('Error generating digest:', error);
    throw error;
  }
}

/**
 * Get latest digest for user with fallback logic
 */
export async function getLatestDigest(userId: string): Promise<any> {
  console.log(`📊 Getting latest digest for user ${userId}`);
  
  try {
    const digest = await storage.getLatestEmailDigest(userId);
    
    if (!digest) {
      return null;
    }

    // Get emails for this digest
    const emails = await storage.getDigestEmails(digest.id);
    
    return {
      ...digest,
      emails,
      type: 'regular'
    };

  } catch (error) {
    console.error('Error getting latest digest:', error);
    throw error;
  }
}

/**
 * Get latest thematic digest with fallback to regular digest
 */
export async function getLatestThematicDigest(userId: string): Promise<any> {
  console.log(`🎯 Getting latest thematic digest for user ${userId}`);
  
  try {
    // Try thematic digest first
    const thematicDigest = await storage.getLatestThematicDigest(userId);
    
    if (thematicDigest) {
      return {
        ...thematicDigest,
        type: 'thematic'
      };
    }

    // Fall back to regular digest
    const regularDigest = await getLatestDigest(userId);
    
    if (regularDigest) {
      return {
        ...regularDigest,
        type: 'regular'
      };
    }

    return null;

  } catch (error) {
    console.error('Error getting latest thematic digest:', error);
    throw error;
  }
}

/**
 * Analyze email content for themes (used by thematic processor)
 */
export async function analyzeEmailForThemes(emails: ProcessedEmail[]): Promise<any> {
  console.log(`🔍 Analyzing ${emails.length} emails for themes`);

  if (emails.length === 0) {
    return { themes: [], clusters: [] };
  }

  try {
    // Combine all email content for analysis
    const emailSummaries = emails.map(email => 
      `From: ${email.sender}\nSubject: ${email.subject}\nSummary: ${email.summary}\nTopics: ${email.topics.join(', ')}`
    ).join('\n\n---\n\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert content analyst. Analyze the email summaries and identify 3-5 major themes that group these emails together. For each theme, provide:
          1. A clear theme name
          2. A narrative summary that tells the story of that theme
          3. A confidence score (0-100)
          4. Key keywords
          5. Which emails belong to this theme (by their index in the list)
          
          Return as JSON: {
            "themes": [
              {
                "name": "Theme Name",
                "summary": "Narrative summary of this theme...",
                "confidence": 85,
                "keywords": ["keyword1", "keyword2"],
                "emailIndexes": [0, 2, 4]
              }
            ]
          }`
        },
        {
          role: 'user',
          content: `Analyze these email summaries:\n\n${emailSummaries}`
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI theme analysis');
    }

    // Strip markdown code fences if present (```json ... ```)
    const cleanedResponse = response
      .replace(/^```json\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();

    return JSON.parse(cleanedResponse);

  } catch (error) {
    console.error('Error analyzing emails for themes:', error);
    
    // Fallback to topic-based clustering
    const topicCounts: Record<string, number> = {};
    emails.forEach(email => {
      email.topics.forEach(topic => {
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
      });
    });

    const themes = Object.entries(topicCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([topic, count], index) => ({
        name: topic,
        summary: `${count} emails related to ${topic}`,
        confidence: Math.min(90, count * 20),
        keywords: [topic],
        emailIndexes: emails
          .map((email, idx) => ({ email, idx }))
          .filter(({ email }) => email.topics.includes(topic))
          .map(({ idx }) => idx)
      }));

    return { themes };
  }
}

/**
 * Health check for OpenAI service
 */
export async function checkOpenAIHealth(): Promise<boolean> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OpenAI API key not configured');
      return false;
    }

    // Simple test call
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: 'Test message for health check'
        }
      ],
      max_tokens: 5
    });

    return completion.choices.length > 0;

  } catch (error) {
    console.error('OpenAI health check failed:', error);
    return false;
  }
}