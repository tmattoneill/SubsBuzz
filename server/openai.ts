import OpenAI from "openai";
import { storage } from "./storage";
import { ParsedEmail } from "./gmail";
import { 
  InsertEmailDigest, 
  InsertDigestEmail, 
  EmailDigest, 
  DigestEmail 
} from "@shared/schema";
import { thematicProcessor } from "./thematic-processor";

// Initialize OpenAI with API key from environment variable
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || "default_key"
});

interface OpenAIEmailAnalysis {
  summary: string;
  topics: string[];
  keywords: string[];
}

export async function generateDigest(userId: string, emails: any[]): Promise<EmailDigest> {
  try {
    console.log("Starting digest generation for", emails.length, "emails");
    
    // Create a new digest with proper date format
    const newDigest: InsertEmailDigest = {
      userId,
      date: new Date(), // Use Date object directly
      emailsProcessed: emails.length,
      topicsIdentified: 0 // Will be updated after processing
    };
    
    const emailDigest = await storage.createEmailDigest(newDigest);
    const processedEmails: DigestEmail[] = [];
    const allTopics = new Set<string>();
    
    // Process each email with OpenAI
    for (const email of emails) {
      const analysis = await analyzeEmail(email.content);
      
      // Add topics to the set of all topics
      analysis.topics.forEach(topic => allTopics.add(topic));
      
      // Create a digest email entry
      const digestEmail: InsertDigestEmail = {
        digestId: emailDigest.id,
        sender: email.sender,
        subject: email.subject,
        receivedAt: typeof email.receivedAt === 'string' ? new Date(email.receivedAt) : email.receivedAt,
        summary: analysis.summary,
        fullContent: email.content,
        topics: analysis.topics,
        keywords: analysis.keywords,
        originalLink: email.originalLink
      };
      
      const createdEmail = await storage.addDigestEmail(digestEmail);
      processedEmails.push(createdEmail);
    }
    
    // Update the digest with the total number of unique topics
    const updatedDigest: EmailDigest = {
      ...emailDigest,
      topicsIdentified: allTopics.size,
      emails: processedEmails
    };
    
    // Generate thematic digest from processed emails
    try {
      console.log(`Generating thematic digest from processed emails... (${processedEmails.length} emails)`);
      const thematicDigestId = await thematicProcessor.processEmailsIntoThemes(userId, processedEmails);
      console.log(`Successfully created thematic digest ${thematicDigestId} for email digest ${emailDigest.id}`);
    } catch (error) {
      console.error('Error generating thematic digest:', error);
      console.error('Full error details:', JSON.stringify(error, null, 2));
      // Don't fail the main digest if thematic processing fails
    }
    
    return updatedDigest;
  } catch (error) {
    console.error('Error generating digest:', error);
    throw new Error(`Failed to generate digest: ${error.message}`);
  }
}

async function analyzeEmail(content: string): Promise<OpenAIEmailAnalysis> {
  try {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: 
            "You are an expert newsletter content extractor. Your job is to extract the actual substantive content from newsletters, not describe what the newsletter is about. For each newsletter:\n\n1. EXTRACT the key articles, stories, and content pieces within the newsletter\n2. SUMMARIZE the actual content/findings/insights of each piece, not just what topics they cover\n3. Focus on the information readers would want to know, not meta-descriptions\n\nFor example:\n- Instead of: 'The newsletter covers Supreme Court rulings and vaccine skepticism'\n- Provide: 'Supreme Court ruled that birthright citizenship applies to [specific details]. New research shows vaccine skepticism increases mortality by [specific findings]'\n\nRespond in JSON format: { 'summary': string, 'topics': string[], 'keywords': string[] }"
        },
        {
          role: "user",
          content: content
        }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content);
    
    return {
      summary: result.summary,
      topics: result.topics,
      keywords: result.keywords
    };
  } catch (error) {
    console.error('Error analyzing email with OpenAI:', error);
    
    // Fallback if OpenAI analysis fails
    return {
      summary: "Failed to generate summary due to an error.",
      topics: ["Miscellaneous"],
      keywords: ["error"]
    };
  }
}

export async function getLatestThematicDigest(userId: string): Promise<any | null> {
  try {
    console.log(`Getting latest thematic digest for userId: ${userId}`);
    
    // Get the latest thematic digest for this user
    const latestThematicDigest = await storage.getLatestThematicDigest(userId);
    
    if (!latestThematicDigest) {
      console.log("No thematic digest found, falling back to regular digest");
      // Fall back to regular digest if no thematic digest exists
      return await getLatestDigest(userId);
    }
    
    console.log(`Found thematic digest with ID: ${latestThematicDigest.id}, sections: ${latestThematicDigest.sectionsCount}`);
    
    return {
      ...latestThematicDigest,
      date: latestThematicDigest.date instanceof Date ? latestThematicDigest.date.toISOString() : latestThematicDigest.date,
      emailsProcessed: latestThematicDigest.totalSourceEmails,
      topicsIdentified: latestThematicDigest.sectionsCount
    };
    
  } catch (error: any) {
    console.error('Error getting latest thematic digest:', error);
    // Fall back to regular digest on error
    return await getLatestDigest(userId);
  }
}

export async function getLatestDigest(userId: string): Promise<any | null> {
  try {
    console.log(`Getting latest digest for userId: ${userId}`);
    // Get the latest digest for this user
    const latestDigest = await storage.getLatestEmailDigest(userId);
    
    if (!latestDigest) {
      console.log("No digest found for user, returning null");
      // For new users, return null instead of generating sample data
      return null;
    }
    
    console.log(`Found digest with ID: ${latestDigest.id}, emails processed: ${latestDigest.emailsProcessed}`);
    
    // Get the emails associated with this digest
    const emails = await storage.getDigestEmails(latestDigest.id);
    console.log(`Found ${emails.length} emails for digest ${latestDigest.id}`);
    
    // Return the digest with associated emails
    // Format dates for client consumption
    const formattedEmails = emails.map(email => ({
      ...email,
      receivedAt: email.receivedAt instanceof Date ? email.receivedAt.toISOString() : email.receivedAt
    }));
    
    // Calculate actual topics identified from the emails
    const allTopics = new Set();
    emails.forEach(email => {
      email.topics.forEach(topic => allTopics.add(topic));
    });
    
    const result = {
      ...latestDigest,
      date: latestDigest.date instanceof Date ? latestDigest.date.toISOString() : latestDigest.date,
      emails: formattedEmails,
      topicsIdentified: allTopics.size // Override with actual count
    };
    
    console.log(`Returning digest with ${result.emails.length} emails and ${result.topicsIdentified} topics`);
    return result;
  } catch (error: any) {
    console.error('Error getting latest digest:', error);
    throw new Error(`Failed to get latest digest: ${error.message}`);
  }
}
