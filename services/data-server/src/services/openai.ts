/**
 * LLM Service - AI Processing and Analysis
 *
 * Routes all completions through the provider abstraction in ./llm/provider.
 * Filename retained (was openai.ts) to avoid churning imports across routes
 * and the thematic processor — TEEPER-139.
 */

import { storage } from './storage';
import { InsertEmailDigest, InsertDigestEmail } from '../db/schema.js';
import {
  ProviderSelection,
  resolveProvider,
  getClient,
  mergeCompletionParams,
  ProviderConfigError,
} from './llm/provider';

if (!process.env.DEEPSEEK_API_KEY && !process.env.OPENAI_API_KEY) {
  console.warn('⚠️  Neither DEEPSEEK_API_KEY nor OPENAI_API_KEY is set — AI summarisation will use fallback text');
}

export interface EmailInput {
  sender: string;
  subject: string;
  content: string;
  receivedAt: Date;
  originalLink?: string;
  gmailMessageId?: string;  // Source Gmail message ID — used by the worker for post-digest cleanup
  heroImageUrl?: string | null;  // Hero image URL extracted from raw email HTML (worker-side)
  categoryId?: number | null;  // User-assigned category (TEEPER-105); resolved to name/slug snapshots at persist time
}

export interface ProcessedEmail {
  sender: string;
  source: string;      // Display name (e.g. "The Washington Post")
  subject: string;
  receivedAt: Date;
  snippet: string;     // ≤25-word summary
  summary: string;     // ≤100-word plain-text — used for cards and excerpts
  summaryHtml: string | null;  // ~300–400-word HTML body (h3/p/ul/li/strong/em) — rendered as the article body
  fullContent: string;
  topics: string[];    // Other articles/topics referenced
  keywords: string[];  // External links
  originalLink?: string;
  gmailMessageId?: string;  // Persisted on digest_emails so cleanup tasks can target the source
  heroImageUrl?: string | null;  // Passthrough from EmailInput — AI does not touch this field
  categoryId?: number | null;  // Passthrough from EmailInput; snapshotted at persist time
}

export interface DigestResult {
  digest: any;
  processedEmails: ProcessedEmail[];
}

// ---------------------------------------------------------------------------
// Per-provider reasoning-mode gotcha — OpenAI's gpt-5.4-nano defaults to
// reasoning mode; without `reasoning_effort: 'none'` the model burns the full
// `max_completion_tokens` budget on internal reasoning and returns empty
// content (blank digests, no error — the HTTP call itself succeeds). That
// flag is injected automatically by `mergeCompletionParams` for the OpenAI
// provider via its `extraParams` (see ./llm/provider.ts). DeepSeek has no
// equivalent — the flag is omitted for that provider. If you swap models
// within a provider or add a new provider, revisit reasoning-mode handling
// in provider.ts. See docs/WORKFLOW.md "Non-obvious things to remember".
// ---------------------------------------------------------------------------

/**
 * Process individual email through the selected LLM provider.
 */
export async function processEmailWithAI(email: EmailInput, settings: ProviderSelection): Promise<ProcessedEmail> {
  console.log(`🤖 Processing email: ${email.subject}`);

  try {
    const cfg = resolveProvider(settings);
    const client = getClient(cfg);
    // Truncate content to avoid excessive token usage
    const truncatedContent = email.content?.slice(0, 4000) || '';

    const completion = await client.chat.completions.create(mergeCompletionParams({
      model: cfg.model,
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant who scans and summarises email newsletters from specific senders.

Style: Concise and professional. Maintain the tone of the original email. If in doubt, be concise. Write in British English.

Processing rules:
- IGNORE anything to do with subscriptions, marketing, signing up, or other promotional items
- IGNORE content containing words like "subscribe", "sign up", "preferences" and similar phrases
- FOCUS solely on content and information

Return JSON with exactly these fields:
{
  "source": "Sender display name (not the email address — e.g. 'The Washington Post', not 'info@e.mail.washingtonpost.com')",
  "subject": "Email subject, or write a short descriptive subject if missing",
  "snippet": "25 words or less — the single most important point",
  "summary": "The main point(s) in fewer than 100 words, plain text, focusing on content not promotional material. Used for card excerpts.",
  "summaryHtml": "300–400 words of valid HTML rendering the article as an editorial read. Structure: one short opening <p> paragraph (the lead), then 2–3 <h3> section headings each followed by a <p> body. Use <ul>/<li> for genuine lists only, <strong> and <em> sparingly for emphasis. No <h1>, no <h2>, no <h4>+, no <div>, no <span>, no <img>, no <script>, no <style>, no inline style attributes, no class attributes. Plain prose. Do not quote the email verbatim — summarise and synthesise.",
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
      max_completion_tokens: 1800,
    }, cfg) as any);

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from LLM');
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
      summaryHtml: typeof analysis.summaryHtml === 'string' && analysis.summaryHtml.trim().length > 0
        ? analysis.summaryHtml
        : null,
      fullContent: email.content,
      topics: Array.isArray(analysis.otherTopics) ? analysis.otherTopics : [],
      keywords: Array.isArray(analysis.externalLinks) ? analysis.externalLinks : [],
      originalLink: email.originalLink,
      gmailMessageId: email.gmailMessageId,
      heroImageUrl: email.heroImageUrl ?? null,
      categoryId: email.categoryId ?? null
    };

  } catch (error: any) {
    if (error instanceof ProviderConfigError) {
      console.error(`LLM provider config error (${error.code}): ${error.message}`);
    } else {
      console.error(`Error processing email with LLM: ${error?.message || error}`);
      if (error?.status) console.error(`LLM HTTP status: ${error.status}`);
    }

    // Fallback to basic processing
    return {
      sender: email.sender,
      source: email.sender,
      subject: email.subject,
      receivedAt: email.receivedAt,
      snippet: email.subject,
      summary: `Email from ${email.sender} regarding ${email.subject}`,
      summaryHtml: null,
      fullContent: email.content,
      topics: [],
      keywords: [],
      originalLink: email.originalLink,
      gmailMessageId: email.gmailMessageId,
      heroImageUrl: email.heroImageUrl ?? null,
      categoryId: email.categoryId ?? null
    };
  }
}

/**
 * Generate digest from processed emails using the user's selected LLM provider.
 */
export async function generateDigest(userId: string, emails: EmailInput[], settings: ProviderSelection): Promise<DigestResult> {
  console.log(`📊 Generating digest for user ${userId} with ${emails.length} emails`);

  if (emails.length === 0) {
    throw new Error('No emails provided for digest generation');
  }

  try {
    // Process all emails with AI
    const processedEmails = await Promise.all(
      emails.map(email => processEmailWithAI(email, settings))
    );

    // Create digest record
    const digestData: InsertEmailDigest = {
      userId,
      date: new Date(),
      emailsProcessed: processedEmails.length,
      topicsIdentified: processedEmails.reduce((acc, email) => acc + email.topics.length, 0)
    };

    const digest = await storage.createEmailDigest(digestData);

    // Bulk-resolve category snapshots once per digest. Writing the name/slug
    // into digest_emails at create time preserves historical attribution even
    // if the category is later renamed or deleted.
    const categoryIds = Array.from(new Set(
      processedEmails.map(e => e.categoryId).filter((id): id is number => typeof id === 'number')
    ));
    const snapshots = await storage.resolveCategorySnapshots(userId, categoryIds);

    // Add all processed emails to the digest
    for (const email of processedEmails) {
      const snap = email.categoryId != null ? snapshots.get(email.categoryId) : undefined;
      const digestEmailData: InsertDigestEmail = {
        digestId: digest.id,
        sender: email.sender,
        source: email.source || null,
        subject: email.subject,
        receivedAt: email.receivedAt,
        snippet: email.snippet || null,
        summary: email.summary,
        summaryHtml: email.summaryHtml ?? null,
        fullContent: email.fullContent,
        topics: email.topics,
        keywords: email.keywords,
        originalLink: email.originalLink || null,
        gmailMessageId: email.gmailMessageId || null,
        heroImageUrl: email.heroImageUrl ?? null,
        categoryId: email.categoryId ?? null,
        categoryNameSnapshot: snap?.name ?? null,
        categorySlugSnapshot: snap?.slug ?? null,
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
export async function analyzeEmailForThemes(emails: ProcessedEmail[], settings: ProviderSelection): Promise<any> {
  console.log(`🔍 Analyzing ${emails.length} emails for themes`);

  if (emails.length === 0) {
    return { themes: [], clusters: [] };
  }

  try {
    const cfg = resolveProvider(settings);
    const client = getClient(cfg);
    // Combine all email content for analysis
    const emailSummaries = emails.map(email =>
      `From: ${email.sender}\nSubject: ${email.subject}\nSummary: ${email.summary}\nTopics: ${email.topics.join(', ')}`
    ).join('\n\n---\n\n');

    const completion = await client.chat.completions.create(mergeCompletionParams({
      model: cfg.model,
      response_format: { type: 'json_object' as const },
      messages: [
        {
          role: 'system',
          content: `You are an expert content analyst. Analyze the email summaries and identify 3-7 major themes that group these emails together. For each theme, provide:
          1. A clear, descriptive theme name (e.g. "Political and Social Issues", not just "politics")
          2. A narrative summary (2-4 sentences) that tells the story of that theme — mention specific sources, figures, or events referenced in the emails
          3. A confidence score (0-100) based on how strongly the emails cluster
          4. 3-6 specific keywords (not just the theme name repeated)
          5. Which emails belong to this theme (by their 0-based index in the list)

          Return JSON: {
            "themes": [
              {
                "name": "Theme Name",
                "summary": "Narrative summary of this theme...",
                "confidence": 85,
                "keywords": ["keyword1", "keyword2", "keyword3"],
                "emailIndexes": [0, 2, 4]
              }
            ]
          }`
        },
        {
          role: 'user',
          content: `Analyze these ${emails.length} email summaries:\n\n${emailSummaries}`
        }
      ],
      temperature: 0.7,
      max_completion_tokens: 2000,
    }, cfg) as any);

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from LLM theme analysis');
    }

    // Strip markdown code fences if present (```json ... ```)
    const cleanedResponse = response
      .replace(/^```json\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();

    return JSON.parse(cleanedResponse);

  } catch (error: any) {
    if (error instanceof ProviderConfigError) {
      console.error(`LLM provider config error (${error.code}): ${error.message}`);
    } else {
      console.error('Error analyzing emails for themes:', error?.message || error);
      if (error?.status) console.error(`LLM HTTP status: ${error.status}`);
    }

    // Rich fallback using actual email content
    const topicData: Record<string, { emails: ProcessedEmail[]; indexes: number[] }> = {};
    emails.forEach((email, idx) => {
      email.topics.forEach(topic => {
        if (!topicData[topic]) {
          topicData[topic] = { emails: [], indexes: [] };
        }
        topicData[topic].emails.push(email);
        topicData[topic].indexes.push(idx);
      });
    });

    const themes = Object.entries(topicData)
      .sort(([,a], [,b]) => b.emails.length - a.emails.length)
      .slice(0, 5)
      .map(([topic, data]) => {
        // Build a richer summary from the actual email snippets/summaries
        const snippets = data.emails
          .map(e => e.snippet || e.summary)
          .filter(Boolean)
          .slice(0, 3);
        const sources = [...new Set(data.emails.map(e => e.source || e.sender))];
        const allKeywords = [...new Set(
          data.emails.flatMap(e => [...e.topics, ...e.keywords])
            .filter(k => k && k !== topic)
        )].slice(0, 5);

        const summary = snippets.length > 0
          ? `${sources.slice(0, 3).join(', ')} cover${sources.length === 1 ? 's' : ''} ${topic}. ${snippets.join('. ')}.`
          : `${data.emails.length} emails related to ${topic}`;

        return {
          name: topic,
          summary,
          confidence: Math.min(90, data.emails.length * 20),
          keywords: [topic, ...allKeywords],
          emailIndexes: data.indexes
        };
      });

    return { themes };
  }
}

/**
 * Generate an overall daily synthesis paragraph from themes
 */
export async function generateDailySummary(
  themes: { name: string; summary: string }[],
  totalEmails: number,
  settings: ProviderSelection
): Promise<string> {
  if (themes.length === 0) return '';

  try {
    const cfg = resolveProvider(settings);
    const client = getClient(cfg);
    const themeDescriptions = themes
      .map(t => `- ${t.name}: ${t.summary}`)
      .join('\n');

    const completion = await client.chat.completions.create(mergeCompletionParams({
      model: cfg.model,
      messages: [
        {
          role: 'system',
          content: `You are a senior daily briefing analyst writing a morning intelligence summary for a busy professional. Your job is to synthesise newsletter themes into a rich, scannable briefing.

Output format — return valid HTML using these tags only: <h3>, <p>, <ul>, <li>, <strong>, <em>. No wrapper div, no <h1>/<h2> (those are used by the page layout).

Structure:
1. Open with a short <p> that captures the single most important thread running through today's coverage — one or two sentences, punchy and direct.
2. For each theme, write an <h3> with the theme name, followed by a <p> that expands on the key stories, names specific sources or figures mentioned, and surfaces any emerging trends or counter-narratives. Aim for 2-4 sentences per theme.
3. Close with an <h3>Worth watching</h3> section: a <ul> with 2-3 bullet points flagging developing stories, contrarian signals, or cross-theme patterns the reader should track.

Tone: Authoritative but conversational — like The Economist meets Morning Brew. No filler, no hype. If a theme is thin on substance, say so briefly and move on.`
        },
        {
          role: 'user',
          content: `Today's digest covers ${totalEmails} newsletter${totalEmails !== 1 ? 's' : ''} across ${themes.length} themes:\n\n${themeDescriptions}\n\nWrite the daily briefing.`
        }
      ],
      temperature: 0.7,
      max_completion_tokens: 1500,
    }, cfg) as any);

    const content = completion.choices[0]?.message?.content?.trim() || '';
    if (!content) {
      console.warn('⚠️  Daily summary returned empty.', JSON.stringify({
        finishReason: completion.choices[0]?.finish_reason,
        usage: completion.usage
      }));
    }
    return content;
  } catch (error: any) {
    if (error instanceof ProviderConfigError) {
      console.error(`LLM provider config error (${error.code}): ${error.message}`);
    } else {
      console.error(`Error generating daily summary: ${error?.message || error}`);
      if (error?.status) console.error(`LLM HTTP status: ${error.status}`);
    }
    return '';
  }
}

/**
 * Health check — resolves the user's selected provider and fires a minimal
 * completion against it. Name retained for backward-compat with existing
 * route imports; internally it now supports both OpenAI and DeepSeek.
 */
export async function checkOpenAIHealth(settings: ProviderSelection): Promise<boolean> {
  try {
    const cfg = resolveProvider(settings);
    const client = getClient(cfg);

    const completion = await client.chat.completions.create(mergeCompletionParams({
      model: cfg.model,
      messages: [
        {
          role: 'user' as const,
          content: 'Test message for health check'
        }
      ],
      max_completion_tokens: 20,
    }, cfg) as any);

    return completion.choices.length > 0;

  } catch (error) {
    if (error instanceof ProviderConfigError) {
      console.warn(`LLM health check skipped — ${error.message}`);
    } else {
      console.error('LLM health check failed:', error);
    }
    return false;
  }
}