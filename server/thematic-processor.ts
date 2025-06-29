import { DigestEmail, InsertThematicDigest, InsertThematicSection, InsertThemeSourceEmail } from "@shared/schema";
import { storage } from "./storage";
import OpenAI from "openai";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || "default_key"
});

interface EmailCluster {
  emails: DigestEmail[];
  theme: string;
  keywords: string[];
  confidence: number;
  centroid?: number[]; // Feature vector centroid for clustering
}

interface NLPResult {
  clusters: EmailCluster[];
  processingMethod: 'nlp' | 'llm' | 'hybrid';
}

interface ThematicSummary {
  theme: string;
  summary: string;
  keywords: string[];
  entities: any;
  confidence: number;
  sourceEmails: DigestEmail[];
}

/**
 * Main thematic processor that converts daily emails into thematic digest
 */
export class ThematicProcessor {
  
  /**
   * Process a day's worth of emails into thematic sections
   */
  async processEmailsIntoThemes(userId: string, emails: DigestEmail[]): Promise<number> {
    console.log(`Processing ${emails.length} emails into thematic digest for user ${userId}`);
    
    if (emails.length === 0) {
      throw new Error("No emails to process");
    }

    try {
      // Stage 1: NLP Analysis and Clustering
      const nlpResult = await this.performNLPAnalysis(emails);
      
      // Stage 2: LLM Synthesis for each theme
      const thematicSummaries = await this.generateThematicSummaries(nlpResult.clusters);
      
      // Stage 3: Store results in database
      const thematicDigestId = await this.storeThematicDigest(
        userId, 
        emails[0].digestId, // Reference to the original email digest
        thematicSummaries,
        nlpResult.processingMethod
      );
      
      console.log(`Successfully created thematic digest ${thematicDigestId} with ${thematicSummaries.length} themes`);
      return thematicDigestId;
      
    } catch (error) {
      console.error('Error processing emails into themes:', error);
      throw new Error(`Failed to process thematic digest: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stage 1: Classify emails into predefined categories using best-fit algorithm
   */
  private async performNLPAnalysis(emails: DigestEmail[]): Promise<NLPResult> {
    console.log('Starting category classification...');
    
    // Predefined categories for consistent theming
    const predefinedCategories = [
      'Media + Advertising',
      'Politics', 
      'Programming and Computer Engineering',
      'Business + Finance',
      'Entertainment + Arts',
      'Science + Technology',
      'Sports',
      'Food, Drink, Dining',
      'Opinion + Thought',
      'Other'
    ];
    
    try {
      const clusters: EmailCluster[] = [];
      
      // For each predefined category, find best-fit emails
      for (const category of predefinedCategories) {
        const categoryEmails = this.classifyEmailsToCategory(emails, category);
        
        if (categoryEmails.length > 0) {
          clusters.push({
            emails: categoryEmails,
            theme: category,
            keywords: this.extractClusterKeywords(categoryEmails),
            confidence: this.calculateCategoryConfidence(categoryEmails, category)
          });
        }
      }
      
      // Handle any unclassified emails
      const classifiedIds = new Set(clusters.flatMap(c => c.emails.map(e => e.id)));
      const unclassifiedEmails = emails.filter(email => !classifiedIds.has(email.id));
      
      if (unclassifiedEmails.length > 0) {
        // Add them to "Other" category or create it if it doesn't exist
        const otherCluster = clusters.find(c => c.theme === 'Other');
        if (otherCluster) {
          otherCluster.emails.push(...unclassifiedEmails);
          otherCluster.keywords = this.extractClusterKeywords(otherCluster.emails);
        } else {
          clusters.push({
            emails: unclassifiedEmails,
            theme: 'Other',
            keywords: this.extractClusterKeywords(unclassifiedEmails),
            confidence: 60
          });
        }
      }
      
      // Sort clusters by relevance (email count and quality)
      clusters.sort((a, b) => (b.emails.length * b.confidence) - (a.emails.length * a.confidence));
      
      console.log(`Category classification complete: ${clusters.length} categories with emails`);
      return {
        clusters,
        processingMethod: 'category-classification'
      };
      
    } catch (error) {
      console.error('Error in category classification:', error);
      // Fallback: put all emails in "Other"
      return {
        clusters: [{
          emails,
          theme: "Other",
          keywords: this.extractClusterKeywords(emails),
          confidence: 70
        }],
        processingMethod: 'fallback'
      };
    }
  }

  /**
   * Classify emails to a specific category using best-fit algorithm
   */
  private classifyEmailsToCategory(emails: DigestEmail[], category: string): DigestEmail[] {
    const categoryKeywords = this.getCategoryKeywords(category);
    const emailScores: Array<{email: DigestEmail, score: number}> = [];
    
    for (const email of emails) {
      const score = this.calculateCategoryFitScore(email, categoryKeywords);
      if (score > 30) { // Minimum threshold for category fit
        emailScores.push({email, score});
      }
    }
    
    // Sort by score and return emails that fit this category
    return emailScores
      .sort((a, b) => b.score - a.score)
      .map(item => item.email);
  }

  /**
   * Calculate how well an email fits a category based on keywords and topics
   */
  private calculateCategoryFitScore(email: DigestEmail, categoryKeywords: string[]): number {
    let score = 0;
    const emailText = `${email.subject} ${email.summary} ${email.topics.join(' ')} ${email.keywords.join(' ')}`.toLowerCase();
    
    // Check for keyword matches
    for (const keyword of categoryKeywords) {
      if (emailText.includes(keyword.toLowerCase())) {
        score += 10; // Base score for keyword match
        
        // Bonus for matches in subject (more important)
        if (email.subject.toLowerCase().includes(keyword.toLowerCase())) {
          score += 15;
        }
        
        // Bonus for matches in topics
        if (email.topics.some(topic => topic.toLowerCase().includes(keyword.toLowerCase()))) {
          score += 10;
        }
      }
    }
    
    // Check sender patterns for certain categories
    const senderBonus = this.getSenderCategoryBonus(email.sender, categoryKeywords);
    score += senderBonus;
    
    return Math.min(100, score); // Cap at 100
  }

  /**
   * Get keywords associated with each category
   */
  private getCategoryKeywords(category: string): string[] {
    const keywordMap: Record<string, string[]> = {
      'Media + Advertising': [
        'media', 'advertising', 'marketing', 'television', 'streaming', 'netflix', 'disney', 'rtl', 'tf1', 
        'broadcast', 'ad', 'campaign', 'brand', 'publisher', 'journalism', 'news', 'magazine', 'radio'
      ],
      'Politics': [
        'politics', 'government', 'policy', 'election', 'vote', 'congress', 'senate', 'president', 
        'democratic', 'republican', 'biden', 'trump', 'supreme court', 'legislation', 'political'
      ],
      'Programming and Computer Engineering': [
        'programming', 'software', 'code', 'development', 'engineering', 'tech', 'api', 'javascript', 
        'python', 'react', 'ai', 'machine learning', 'data', 'algorithm', 'computing', 'developer'
      ],
      'Business + Finance': [
        'business', 'finance', 'stock', 'market', 'investment', 'economy', 'financial', 'revenue', 
        'profit', 'startup', 'vc', 'funding', 'ipo', 'acquisition', 'merger', 'corporate', 'earnings'
      ],
      'Entertainment + Arts': [
        'entertainment', 'movie', 'film', 'music', 'art', 'culture', 'celebrity', 'concert', 'album', 
        'artist', 'performance', 'theater', 'gallery', 'creative', 'design', 'fashion'
      ],
      'Science + Technology': [
        'science', 'research', 'study', 'technology', 'innovation', 'discovery', 'experiment', 
        'medical', 'health', 'climate', 'environment', 'space', 'physics', 'biology', 'chemistry'
      ],
      'Sports': [
        'sports', 'football', 'basketball', 'baseball', 'soccer', 'tennis', 'golf', 'olympics', 
        'athlete', 'team', 'game', 'match', 'tournament', 'championship', 'league'
      ],
      'Food, Drink, Dining': [
        'food', 'restaurant', 'dining', 'recipe', 'cooking', 'drink', 'wine', 'beer', 'coffee', 
        'chef', 'cuisine', 'meal', 'nutrition', 'taste', 'flavor', 'culinary'
      ],
      'Opinion + Thought': [
        'opinion', 'editorial', 'commentary', 'analysis', 'perspective', 'viewpoint', 'thought', 
        'philosophy', 'reflection', 'insight', 'argument', 'debate', 'discussion', 'critique'
      ],
      'Other': [
        'other', 'miscellaneous', 'general', 'various', 'mixed', 'diverse'
      ]
    };
    
    return keywordMap[category] || [];
  }

  /**
   * Get bonus score based on sender patterns
   */
  private getSenderCategoryBonus(sender: string, categoryKeywords: string[]): number {
    const senderLower = sender.toLowerCase();
    
    // Media outlets
    if (senderLower.includes('washingtonpost') || senderLower.includes('newyorker') || 
        senderLower.includes('media') || senderLower.includes('news')) {
      if (categoryKeywords.includes('media') || categoryKeywords.includes('politics')) {
        return 20;
      }
    }
    
    // Tech/Business sources
    if (senderLower.includes('substack') || senderLower.includes('pitchbook')) {
      if (categoryKeywords.includes('business') || categoryKeywords.includes('tech')) {
        return 15;
      }
    }
    
    return 0;
  }

  /**
   * Calculate confidence for category-based clustering
   */
  private calculateCategoryConfidence(emails: DigestEmail[], category: string): number {
    if (emails.length === 0) return 70;
    
    const categoryKeywords = this.getCategoryKeywords(category);
    let totalScore = 0;
    
    for (const email of emails) {
      totalScore += this.calculateCategoryFitScore(email, categoryKeywords);
    }
    
    const averageScore = totalScore / emails.length;
    return Math.round(Math.max(60, Math.min(95, averageScore)));
  }

  /**
   * Stage 2: Generate narrative summaries for each thematic cluster
   */
  private async generateThematicSummaries(clusters: EmailCluster[]): Promise<ThematicSummary[]> {
    console.log(`Generating summaries for ${clusters.length} themes...`);
    
    const summaries: ThematicSummary[] = [];
    
    for (const cluster of clusters) {
      try {
        const summary = await this.generateThemeSummary(cluster);
        summaries.push(summary);
      } catch (error) {
        console.error(`Error generating summary for theme "${cluster.theme}":`, error);
        // Create fallback summary
        summaries.push({
          theme: cluster.theme,
          summary: `This section covers ${cluster.emails.length} emails related to ${cluster.theme.toLowerCase()}. ` +
                  `Key topics include: ${cluster.keywords.slice(0, 3).join(', ')}.`,
          keywords: cluster.keywords,
          entities: {},
          confidence: cluster.confidence,
          sourceEmails: cluster.emails
        });
      }
    }
    
    return summaries;
  }

  /**
   * Generate a narrative summary for a single thematic cluster
   */
  private async generateThemeSummary(cluster: EmailCluster): Promise<ThematicSummary> {
    // Prepare email data for LLM
    const emailData = cluster.emails.map(email => ({
      sender: email.sender,
      subject: email.subject,
      content: email.summary // Use existing summary instead of full content for efficiency
    }));
    
    const prompt = {
      system: `You are an expert journalist creating a thematic summary for a newsletter section titled "${cluster.theme}". 
      
      Your task is to synthesize the provided emails into a coherent, engaging narrative summary that:
      1. Highlights the key developments and stories in this theme
      2. Identifies connections and patterns across the emails
      3. Maintains a journalistic, informative tone
      4. Focuses on what readers need to know, not meta-descriptions
      
      Write 2-4 paragraphs that tell the story of what's happening in this theme area.`,
      
      user: `Please create a thematic summary for the "${cluster.theme}" section based on these emails:
      
      ${JSON.stringify(emailData, null, 2)}`
    };
    
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user }
        ],
        temperature: 0.7
      });
      
      const summary = response.choices[0].message.content || 
        `Failed to generate summary for ${cluster.theme}`;
      
      return {
        theme: cluster.theme,
        summary,
        keywords: cluster.keywords,
        entities: this.extractEntities(cluster.emails),
        confidence: cluster.confidence,
        sourceEmails: cluster.emails
      };
      
    } catch (error) {
      console.error(`Error calling OpenAI for theme ${cluster.theme}:`, error);
      throw error;
    }
  }

  /**
   * Stage 3: Store thematic digest and sections in database
   */
  private async storeThematicDigest(
    userId: string,
    emailDigestId: number,
    summaries: ThematicSummary[],
    processingMethod: string
  ): Promise<number> {
    console.log('Storing thematic digest in database...');
    
    // Create main thematic digest record
    const thematicDigest: InsertThematicDigest = {
      userId,
      date: new Date(),
      emailDigestId,
      sectionsCount: summaries.length,
      totalSourceEmails: summaries.reduce((sum, s) => sum + s.sourceEmails.length, 0),
      processingMethod
    };
    
    const digestRecord = await storage.createThematicDigest(thematicDigest);
    
    // Create thematic sections and link to source emails
    for (let i = 0; i < summaries.length; i++) {
      const summary = summaries[i];
      
      const section: InsertThematicSection = {
        thematicDigestId: digestRecord.id,
        theme: summary.theme,
        summary: summary.summary,
        confidence: summary.confidence,
        keywords: summary.keywords,
        entities: summary.entities,
        order: i + 1
      };
      
      const sectionRecord = await storage.createThematicSection(section);
      
      // Link source emails to this section
      for (const email of summary.sourceEmails) {
        const linkRecord: InsertThemeSourceEmail = {
          thematicSectionId: sectionRecord.id,
          digestEmailId: email.id,
          relevanceScore: this.calculateRelevanceScore(email, summary)
        };
        
        await storage.createThemeSourceEmail(linkRecord);
      }
    }
    
    return digestRecord.id;
  }

  /**
   * Helper: Extract keywords for a cluster of emails
   */
  private extractClusterKeywords(emails: DigestEmail[]): string[] {
    const keywordCounts = new Map<string, number>();
    
    emails.forEach(email => {
      email.keywords.forEach(keyword => {
        keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
      });
    });
    
    // Return top keywords sorted by frequency
    return Array.from(keywordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([keyword]) => keyword);
  }


  /**
   * Helper: Calculate confidence score for a cluster
   */
  private calculateClusterConfidence(emails: DigestEmail[], topic: string): number {
    // Simple confidence calculation based on topic consistency
    if (emails.length === 0) {
      return 70; // Default confidence for empty clusters
    }
    
    const topicMatches = emails.filter(email => 
      email.topics.some(t => t.toLowerCase().includes(topic.toLowerCase()))
    ).length;
    
    const confidence = Math.round((topicMatches / emails.length) * 100);
    return isNaN(confidence) ? 70 : Math.max(50, Math.min(95, confidence)); // Clamp between 50-95
  }

  /**
   * Helper: Extract named entities from emails (placeholder)
   */
  private extractEntities(emails: DigestEmail[]): any {
    // TODO: Implement proper named entity recognition
    // For now, return a simple structure
    return {
      people: [],
      organizations: [],
      locations: [],
      events: []
    };
  }

  /**
   * Helper: Calculate relevance score of an email to a theme
   */
  private calculateRelevanceScore(email: DigestEmail, summary: ThematicSummary): number {
    // Simple relevance calculation based on keyword overlap
    const emailKeywords = new Set(email.keywords.map(k => k.toLowerCase()));
    const themeKeywords = new Set(summary.keywords.map(k => k.toLowerCase()));
    
    const overlap = Array.from(emailKeywords).filter(k => themeKeywords.has(k)).length;
    const total = Math.max(emailKeywords.size, themeKeywords.size);
    
    // Avoid division by zero and NaN
    if (total === 0) {
      return 50; // Default relevance score when no keywords are available
    }
    
    const score = Math.round((overlap / total) * 100);
    return isNaN(score) ? 50 : Math.max(0, Math.min(100, score)); // Clamp between 0-100
  }
}

// Export singleton instance
export const thematicProcessor = new ThematicProcessor();