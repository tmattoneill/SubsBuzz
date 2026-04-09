/**
 * OpenAI Service - AI Processing and Analysis
 * 
 * Extracted from server/openai.ts for the data server
 */

import OpenAI from 'openai';
import { storage } from './storage';
import { InsertEmailDigest, InsertDigestEmail } from '../db/schema.js';

if (!process.env.OPENAI_API_KEY) {
  console.warn('⚠️  OPENAI_API_KEY is not set — AI summarisation will use fallback text');
}

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
  source: string;      // Display name (e.g. "The Washington Post")
  subject: string;
  receivedAt: Date;
  snippet: string;     // ≤25-word summary
  summary: string;
  fullContent: string;
  topics: string[];    // Other articles/topics referenced
  keywords: string[];  // External links
  originalLink?: string;
}

export interface DigestResult {
  digest: any;
  processedEmails: ProcessedEmail[];
}

function getClient(apiKey?: string | null): OpenAI {
  return apiKey ? new OpenAI({ apiKey }) : openai;
}

/**
 * Process individual email with OpenAI
 */
export async function processEmailWithAI(email: EmailInput, apiKey?: string | null): Promise<ProcessedEmail> {
  console.log(`🤖 Processing email: ${email.subject}`);
  
  try {
    const client = getClient(apiKey);
    // Truncate content to avoid excessive token usage
    const truncatedContent = email.content?.slice(0, 4000) || '';

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant who scans and summarises email newsletters from specific senders.

Style: Concise and professional. Maintain the tone of the original email. If in doubt, be concise.

Processing rules:
- IGNORE anything to do with subscriptions, marketing, signing up, or other promotional items
- IGNORE content containing words like "subscribe", "sign up", "preferences" and similar phrases
- FOCUS solely on content and information

Return JSON with exactly these fields:
{
  "source": "Sender display name (not the email address — e.g. 'The Washington Post', not 'info@e.mail.washingtonpost.com')",
  "subject": "Email subject, or write a short descriptive subject if missing",
  "snippet": "25 words or less — the single most important point",
  "summary": "The main point(s) in fewer than 100 words, focusing on content not promotional material",
  "otherTopics": ["other article or topic referenced in this email"],
  "externalLinks": ["relevant external link or URL mentioned"]
}`
        },
        {
          role: 'user',
          content: `From: ${email.sender}
Subject: ${email.subject}
Date: ${email.receivedAt.toISOString()}
Content: ${truncatedContent}`
        }
      ],
      temperature: 0.7,
      max_tokens: 700
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
      source: analysis.source || email.sender,
      subject: email.subject,
      receivedAt: email.receivedAt,
      snippet: analysis.snippet || '',
      summary: analysis.summary,
      fullContent: email.content,
      topics: Array.isArray(analysis.otherTopics) ? analysis.otherTopics : [],
      keywords: Array.isArray(analysis.externalLinks) ? analysis.externalLinks : [],
      originalLink: email.originalLink
    };

  } catch (error: any) {
    console.error(`Error processing email with OpenAI: ${error?.message || error}`);
    if (error?.status) console.error(`OpenAI HTTP status: ${error.status}`);

    // Fallback to basic processing
    return {
      sender: email.sender,
      source: email.sender,
      subject: email.subject,
      receivedAt: email.receivedAt,
      snippet: email.subject,
      summary: `Email from ${email.sender} regarding ${email.subject}`,
      fullContent: email.content,
      topics: [],
      keywords: [],
      originalLink: email.originalLink
    };
  }
}

/**
 * Generate digest from processed emails
 */
export async function generateDigest(userId: string, emails: EmailInput[], apiKey?: string | null): Promise<DigestResult> {
  console.log(`📊 Generating digest for user ${userId} with ${emails.length} emails`);
  
  if (emails.length === 0) {
    throw new Error('No emails provided for digest generation');
  }

  try {
    // Process all emails with AI
    const processedEmails = await Promise.all(
      emails.map(email => processEmailWithAI(email, apiKey))
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
        source: email.source || null,
        subject: email.subject,
        receivedAt: email.receivedAt,
        snippet: email.snippet || null,
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
export async function analyzeEmailForThemes(emails: ProcessedEmail[], apiKey?: string | null): Promise<any> {
  console.log(`🔍 Analyzing ${emails.length} emails for themes`);

  if (emails.length === 0) {
    return { themes: [], clusters: [] };
  }

  try {
    const client = getClient(apiKey);
    // Combine all email content for analysis
    const emailSummaries = emails.map(email =>
      `From: ${email.sender}\nSubject: ${email.subject}\nSummary: ${email.summary}\nTopics: ${email.topics.join(', ')}`
    ).join('\n\n---\n\n');

    const completion = await client.chat.completions.create({
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
 * Generate an overall daily synthesis paragraph from themes
 */
export async function generateDailySummary(
  themes: { name: string; summary: string }[],
  totalEmails: number,
  apiKey?: string | null
): Promise<string> {
  if (themes.length === 0) return '';

  try {
    const client = getClient(apiKey);
    const themeDescriptions = themes
      .map(t => `- ${t.name}: ${t.summary}`)
      .join('\n');

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a daily briefing analyst. Write a single concise paragraph (2-3 sentences max) summarizing the key themes and trends across today's newsletters. Focus on what matters — the trends, insights, and topics worth knowing. Be direct and informative.`
        },
        {
          role: 'user',
          content: `Today's digest has ${totalEmails} newsletter${totalEmails !== 1 ? 's' : ''} across ${themes.length} themes:\n\n${themeDescriptions}\n\nWrite a 2-3 sentence executive summary of today's key trends.`
        }
      ],
      temperature: 0.7,
      max_tokens: 200
    });

    return completion.choices[0]?.message?.content?.trim() || '';
  } catch (error: any) {
    console.error(`Error generating daily summary: ${error?.message || error}`);
    return '';
  }
}

/**
 * Health check for OpenAI service
 */
export async function checkOpenAIHealth(apiKey?: string | null): Promise<boolean> {
  try {
    const client = getClient(apiKey);
    if (!apiKey && !process.env.OPENAI_API_KEY) {
      console.warn('OpenAI API key not configured');
      return false;
    }

    // Simple test call
    const completion = await client.chat.completions.create({
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