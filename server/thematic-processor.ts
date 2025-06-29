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
   * Stage 1: Perform NLP analysis to discover themes and cluster emails
   */
  private async performNLPAnalysis(emails: DigestEmail[]): Promise<NLPResult> {
    console.log('Starting NLP analysis...');
    
    // For now, implement a hybrid approach using existing topics + simple clustering
    // TODO: Enhance with proper topic modeling (LDA) and semantic clustering
    
    try {
      // Extract all existing topics from emails
      const allTopics = new Set<string>();
      emails.forEach(email => {
        email.topics.forEach(topic => allTopics.add(topic));
      });
      
      // Simple clustering based on existing topics
      const clusters: EmailCluster[] = [];
      const processedEmails = new Set<number>();
      
      // Group emails by their primary topics
      for (const topic of Array.from(allTopics)) {
        const topicEmails = emails.filter(email => 
          email.topics.includes(topic) && !processedEmails.has(email.id)
        );
        
        if (topicEmails.length > 0) {
          // Extract keywords for this cluster
          const keywords = this.extractClusterKeywords(topicEmails);
          
          clusters.push({
            emails: topicEmails,
            theme: this.normalizeThemeName(topic),
            keywords,
            confidence: this.calculateClusterConfidence(topicEmails, topic)
          });
          
          // Mark emails as processed
          topicEmails.forEach(email => processedEmails.add(email.id));
        }
      }
      
      // Handle remaining emails that don't fit into clear themes
      const unclusteredEmails = emails.filter(email => !processedEmails.has(email.id));
      if (unclusteredEmails.length > 0) {
        clusters.push({
          emails: unclusteredEmails,
          theme: "Miscellaneous & Other News",
          keywords: this.extractClusterKeywords(unclusteredEmails),
          confidence: 50 // Lower confidence for miscellaneous
        });
      }
      
      // Sort clusters by email count (most significant first)
      clusters.sort((a, b) => b.emails.length - a.emails.length);
      
      console.log(`NLP analysis complete: ${clusters.length} themes discovered`);
      return {
        clusters,
        processingMethod: 'hybrid' // Using hybrid approach for now
      };
      
    } catch (error) {
      console.error('Error in NLP analysis:', error);
      // Fallback: single cluster with all emails
      return {
        clusters: [{
          emails,
          theme: "Daily Summary",
          keywords: this.extractClusterKeywords(emails),
          confidence: 70
        }],
        processingMethod: 'llm' // Fallback to LLM-only processing
      };
    }
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
   * Helper: Normalize theme names for consistency
   */
  private normalizeThemeName(topic: string): string {
    // Simple theme name normalization
    const themeMap: Record<string, string> = {
      'politics': 'Politics & Government',
      'technology': 'Technology & Innovation',
      'entertainment': 'Entertainment & Culture',
      'business': 'Business & Economy',
      'health': 'Health & Science',
      'sports': 'Sports & Recreation',
      'environment': 'Environment & Climate',
      'education': 'Education & Society'
    };
    
    const normalized = topic.toLowerCase().trim();
    return themeMap[normalized] || this.capitalizeWords(topic);
  }

  /**
   * Helper: Capitalize words in a theme name
   */
  private capitalizeWords(str: string): string {
    return str.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Helper: Calculate confidence score for a cluster
   */
  private calculateClusterConfidence(emails: DigestEmail[], topic: string): number {
    // Simple confidence calculation based on topic consistency
    const topicMatches = emails.filter(email => 
      email.topics.some(t => t.toLowerCase().includes(topic.toLowerCase()))
    ).length;
    
    const confidence = Math.round((topicMatches / emails.length) * 100);
    return Math.max(50, Math.min(95, confidence)); // Clamp between 50-95
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
    
    return Math.round((overlap / total) * 100);
  }
}

// Export singleton instance
export const thematicProcessor = new ThematicProcessor();