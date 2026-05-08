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
import { CANONICAL_TAGS, type CanonicalTag } from './tags/canonical';
import { normalizeTagList, TAG_LIMITS, type NormalizedTag } from './tags/normalize';
import { persistTagsForArticle } from './tags/storage';

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
  categoryId?: number | null;  // Resolved by resolveSubscription upstream; snapshotted at persist time
  // Resolved category display name ("Technology", "Sports", "General News",
  // …). Looked up once in generateDigest before the parallel LLM calls and
  // injected into the per-article prompt as a tagging hint. Null when the
  // article has no category, or when the caller is processEmailWithAI on a
  // standalone path (no batch resolve happens).
  categoryName?: string | null;
  subscriptionId?: number | null;  // Smart sender parsing: derived subscription id (nullable for pre-feature / unknown senders)
  signalsJson?: Record<string, unknown> | null;  // Raw parsed header signals (List-Id, from display name, subscription key/tier)
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
  // Normalized tags from the LLM after passing through services/tags/normalize.
  // Persisted to digest_emails.topics (display names, denormalized cache for
  // card render) and to article_tags via tags table (canonical join for the
  // /tags/:slug page).
  tags: NormalizedTag[];
  // topics is `tags.map(t => t.displayName)` — kept on the type so the
  // thematic clusterer (services/thematic-processor.ts) and the JSON-shape
  // dispatcher in routes/digest.ts can read display names directly without
  // touching the new tag pipeline. Derive once at construction time.
  topics: string[];
  keywords: string[];  // External links (unchanged — extracted from email body)
  originalLink?: string;
  gmailMessageId?: string;  // Persisted on digest_emails so cleanup tasks can target the source
  heroImageUrl?: string | null;  // Passthrough from EmailInput — AI does not touch this field
  categoryId?: number | null;  // Passthrough from EmailInput; snapshotted at persist time
  subscriptionId?: number | null;  // Passthrough from EmailInput
  signalsJson?: Record<string, unknown> | null;  // Passthrough from EmailInput
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

TAG RULES (strict):
- Return at most ${TAG_LIMITS.maxPerArticle} tags.
- Each tag is 1 to ${TAG_LIMITS.maxWords} words, lowercase, no punctuation.${email.categoryName ? `
- This article is from a "${email.categoryName}" newsletter. Prefer tags relevant to ${email.categoryName} when the content fits — but a tag can apply across many categories, so don't force a fit.` : ''}
- Reuse a tag from this canonical list whenever the article fits:
  ${formatCanonicalTagsForPrompt(CANONICAL_TAGS)}
- Only invent a new tag if no canonical tag applies. New tags must still be 1–2 lowercase words and describe the subject (not the sender, not the medium).
- Never use generic filler like "news", "update", "article", "newsletter", "today", "weekly".

Return JSON with exactly these fields:
{
  "source": "Sender display name (not the email address — e.g. 'The Washington Post', not 'info@e.mail.washingtonpost.com')",
  "subject": "Email subject, or write a short descriptive subject if missing",
  "snippet": "25 words or less — the single most important point",
  "summary": "The main point(s) in fewer than 100 words, plain text, focusing on content not promotional material. Used for card excerpts.",
  "summaryHtml": "300–400 words of valid HTML rendering the article as an editorial read. Structure: one short opening <p> paragraph (the lead), then 2–3 <h3> section headings each followed by a <p> body. Use <ul>/<li> for genuine lists only, <strong> and <em> sparingly for emphasis. No <h1>, no <h2>, no <h4>+, no <div>, no <span>, no <img>, no <script>, no <style>, no inline style attributes, no class attributes. Plain prose. Do not quote the email verbatim — summarise and synthesise.",
  "tags": ["1-2 word lowercase tags following the rules above"],
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

    const normalizedTags = normalizeTagList(analysis.tags);
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
      tags: normalizedTags,
      topics: normalizedTags.map(t => t.displayName),
      keywords: Array.isArray(analysis.externalLinks) ? analysis.externalLinks : [],
      originalLink: email.originalLink,
      gmailMessageId: email.gmailMessageId,
      heroImageUrl: email.heroImageUrl ?? null,
      categoryId: email.categoryId ?? null,
      subscriptionId: email.subscriptionId ?? null,
      signalsJson: email.signalsJson ?? null,
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
      tags: [],
      topics: [],
      keywords: [],
      originalLink: email.originalLink,
      gmailMessageId: email.gmailMessageId,
      heroImageUrl: email.heroImageUrl ?? null,
      categoryId: email.categoryId ?? null,
      subscriptionId: email.subscriptionId ?? null,
      signalsJson: email.signalsJson ?? null,
    };
  }
}

function formatCanonicalTagsForPrompt(canonical: ReadonlyArray<CanonicalTag>): string {
  // Show display names in the prompt — humans-readable, and the slugifier in
  // services/tags/normalize.ts converts whatever the LLM returns ("Machine
  // Learning", "machine learning", "machine-learning") to the same slug.
  return canonical.map(t => t.displayName).join(', ');
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
    // Bulk-resolve category snapshots once, BEFORE the parallel LLM calls,
    // so the per-article prompt can include the category name as a tagging
    // hint. The same snapshots are reused below for the persist-time
    // categoryNameSnapshot/categorySlugSnapshot writes.
    const categoryIds = Array.from(new Set(
      emails.map(e => e.categoryId).filter((id): id is number => typeof id === 'number')
    ));
    const snapshots = await storage.resolveCategorySnapshots(userId, categoryIds);

    const emailsWithCategory: EmailInput[] = emails.map(e => ({
      ...e,
      categoryName: e.categoryId != null ? snapshots.get(e.categoryId)?.name ?? null : null,
    }));

    // Process all emails with AI (parallel; counter gives progress visibility in logs)
    let completed = 0;
    const total = emailsWithCategory.length;
    const processedEmails = await Promise.all(
      emailsWithCategory.map(async email => {
        const result = await processEmailWithAI(email, settings);
        completed++;
        if (completed % 5 === 0 || completed === total) {
          console.log(`📧 LLM processing: ${completed}/${total} emails`);
        }
        return result;
      })
    );

    // Create digest record
    const digestData: InsertEmailDigest = {
      userId,
      date: new Date(),
      emailsProcessed: processedEmails.length,
      topicsIdentified: processedEmails.reduce((acc, email) => acc + email.tags.length, 0),
    };

    const digest = await storage.createEmailDigest(digestData);

    // Add all processed emails to the digest, then write tags to article_tags.
    // digest_emails.topics is kept as a denormalized cache of display names so
    // the card render doesn't need to join through article_tags on every read.
    for (const email of processedEmails) {
      const snap = email.categoryId != null ? snapshots.get(email.categoryId) : undefined;
      const digestEmailData: InsertDigestEmail = {
        digestId: digest.id,
        userId,
        sender: email.sender,
        source: email.source || null,
        subject: email.subject,
        receivedAt: email.receivedAt,
        snippet: email.snippet || null,
        summary: email.summary,
        summaryHtml: email.summaryHtml ?? null,
        fullContent: email.fullContent,
        topics: email.tags.map(t => t.displayName),
        keywords: email.keywords,
        originalLink: email.originalLink || null,
        gmailMessageId: email.gmailMessageId || null,
        heroImageUrl: email.heroImageUrl ?? null,
        categoryId: email.categoryId ?? null,
        categoryNameSnapshot: snap?.name ?? null,
        categorySlugSnapshot: snap?.slug ?? null,
        subscriptionId: email.subscriptionId ?? null,
        signalsJson: email.signalsJson ?? null,
      };

      const inserted = await storage.addDigestEmail(digestEmailData);

      // Tag persistence is non-fatal — a tagging error must not lose the
      // article. Log loudly so silent failures show up in the dashboard.
      if (email.tags.length > 0 && inserted?.id) {
        try {
          await persistTagsForArticle(inserted.id, email.tags);
        } catch (tagErr: any) {
          console.error(
            `[tags] FAILED digest_email_id=${inserted.id} tags=${email.tags.map(t => t.slug).join(',')} ` +
            `message=${tagErr?.message ?? String(tagErr)}`,
          );
        }
      }
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
    // Compact format: one line per email keeps input tokens low so the model
    // has budget to return full index arrays for all emails.
    const emailSummaries = emails.map((email, i) =>
      `[${i}] ${email.subject} | ${email.sender} | Topics: ${email.topics.join(', ')} | ${email.summary?.slice(0, 120) ?? ''}`
    ).join('\n');

    const completion = await client.chat.completions.create(mergeCompletionParams({
      model: cfg.model,
      response_format: { type: 'json_object' as const },
      messages: [
        {
          role: 'system',
          content: `You are an expert content analyst. Analyze these email summaries and identify 3-7 major themes.

CRITICAL RULES:
- Every email index (0 to ${emails.length - 1}) must appear in exactly one theme's emailIndexes. Do not omit any.
- emailIndexes must list ALL emails for that theme, not just representative ones.

For each theme provide:
1. name: clear, descriptive (e.g. "US Politics and Elections", not just "politics")
2. summary: 2-4 sentences naming specific sources, figures, or events from the emails
3. confidence: 0-100 based on how strongly the emails cluster
4. keywords: 3-6 specific keywords
5. emailIndexes: array of ALL 0-based indexes belonging to this theme

Return JSON: {"themes": [{"name": "...", "summary": "...", "confidence": 85, "keywords": [...], "emailIndexes": [...]}]}`
        },
        {
          role: 'user',
          content: `Assign all ${emails.length} emails (indexes 0-${emails.length - 1}) to themes:\n\n${emailSummaries}`
        }
      ],
      temperature: 0.3,
      max_completion_tokens: 4000,
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
export interface DailyBriefing {
  headline: string;  // ≤80-char newspaper-style banner; empty string if generation failed
  summary: string;   // HTML body (h3/p/ul/li/strong/em)
}

export async function generateDailySummary(
  themes: { name: string; summary: string }[],
  totalEmails: number,
  settings: ProviderSelection
): Promise<DailyBriefing> {
  if (themes.length === 0) return { headline: '', summary: '' };

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

Return JSON with exactly these fields:
{
  "headline": "Sharp, specific newspaper-style banner capturing today's dominant story. ≤80 characters. Sentence case. No trailing punctuation. No hype words ('shocking', 'massive'). Name a real subject — not 'Today's news' or 'Daily briefing'.",
  "summary": "HTML body — see structure below."
}

The summary HTML uses these tags only: <h3>, <p>, <ul>, <li>, <strong>, <em>. No wrapper div, no <h1>/<h2> (those are used by the page layout).

Summary structure:
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
      max_completion_tokens: 1700,
    }, cfg) as any);

    const raw = completion.choices[0]?.message?.content?.trim() || '';
    if (!raw) {
      console.warn('⚠️  Daily summary returned empty.', JSON.stringify({
        finishReason: completion.choices[0]?.finish_reason,
        usage: completion.usage
      }));
      return { headline: '', summary: '' };
    }

    const cleaned = raw
      .replace(/^```json\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();

    try {
      const parsed = JSON.parse(cleaned);
      const headline = typeof parsed.headline === 'string' ? parsed.headline.trim() : '';
      const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
      return { headline, summary };
    } catch (parseErr: any) {
      // Older prompt format returned bare HTML. If JSON.parse fails, treat
      // the whole response as the summary body so we don't lose it.
      console.warn(`Daily summary JSON parse failed (${parseErr?.message ?? 'unknown'}); falling back to raw HTML.`);
      return { headline: '', summary: cleaned };
    }
  } catch (error: any) {
    if (error instanceof ProviderConfigError) {
      console.error(`LLM provider config error (${error.code}): ${error.message}`);
    } else {
      console.error(`Error generating daily summary: ${error?.message || error}`);
      if (error?.status) console.error(`LLM HTTP status: ${error.status}`);
    }
    return { headline: '', summary: '' };
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