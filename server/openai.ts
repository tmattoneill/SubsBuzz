import OpenAI from "openai";
import { storage } from "./storage";
import { ParsedEmail } from "./gmail";
import { 
  InsertEmailDigest, 
  InsertDigestEmail, 
  EmailDigest, 
  DigestEmail 
} from "@shared/schema";

// Initialize OpenAI with API key from environment variable
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || "default_key"
});

interface OpenAIEmailAnalysis {
  summary: string;
  topics: string[];
  keywords: string[];
}

export async function generateDigest(emails: any[]): Promise<EmailDigest> {
  try {
    console.log("Starting digest generation for", emails.length, "emails");
    
    // Create a new digest with proper date format
    const newDigest: InsertEmailDigest = {
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
            "You are an expert email analyst. Analyze the following email content and provide a concise summary, identify key topics, and extract relevant keywords. Respond in JSON format with the following structure: { 'summary': string, 'topics': string[], 'keywords': string[] }"
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

export async function getLatestDigest(): Promise<EmailDigest | null> {
  try {
    // Get the latest digest
    const latestDigest = await storage.getLatestEmailDigest();
    
    if (!latestDigest) {
      console.log("No digest found in database, generating sample digest");
      // If no digest exists, generate a sample digest with mock data
      try {
        return await generateSampleDigest();
      } catch (genError) {
        console.error('Error generating sample digest:', genError);
        throw new Error(`Failed to generate sample digest: ${genError.message}`);
      }
    }
    
    // Get the emails associated with this digest
    const emails = await storage.getDigestEmails(latestDigest.id);
    
    // Return the digest with associated emails
    // Format dates for client consumption
    const formattedEmails = emails.map(email => ({
      ...email,
      receivedAt: email.receivedAt instanceof Date ? email.receivedAt.toISOString() : email.receivedAt
    }));
    
    return {
      ...latestDigest,
      date: latestDigest.date instanceof Date ? latestDigest.date.toISOString() : latestDigest.date,
      emails: formattedEmails
    };
  } catch (error) {
    console.error('Error getting latest digest:', error);
    throw new Error(`Failed to get latest digest: ${error.message}`);
  }
}

async function generateSampleDigest(): Promise<EmailDigest> {
  console.log("Starting sample digest generation");
  
  // Create a well-formed sample digest
  const sampleDigest: InsertEmailDigest = {
    date: new Date(), // Use Date object directly, not string
    emailsProcessed: 3,
    topicsIdentified: 8
  };
  
  console.log("Creating digest in database");
  const createdDigest = await storage.createEmailDigest(sampleDigest);
  console.log(`Sample digest created with ID: ${createdDigest.id}`);
  
  // Sample emails for the digest
  const sampleEmails: InsertDigestEmail[] = [
    {
      digestId: createdDigest.id,
      sender: "daily@pivot5.ai",
      subject: "Tech Giants Announce Major AI Breakthroughs at Annual Conference",
      receivedAt: new Date(Date.now() - 3600000), // Use Date object directly
      summary: "Major technology companies unveiled significant advancements in artificial intelligence at this year's tech conference. Key highlights include new language models that show improved reasoning capabilities, computer vision systems that can interpret complex scenes with greater accuracy, and AI assistants that can perform more sophisticated tasks with minimal human input.",
      fullContent: "Tech giants including OpenAI, Google, and Microsoft presented their latest AI developments at the annual AI Summit held in San Francisco this week. The event showcased revolutionary advancements that could reshape industries from healthcare to finance.\n\nOpenAI demonstrated GPT-5, featuring enhanced reasoning and problem-solving abilities that surpass previous versions. Google presented its new multimodal system that can simultaneously process and analyze text, images, and audio inputs. Microsoft introduced an advanced AI assistant for business applications that can handle complex workflows without human intervention.\n\nIndustry experts note that these developments signal an accelerating pace of innovation in the AI sector, with implications for regulatory frameworks and ethical considerations. The conference also addressed concerns about AI safety and governance, with several companies announcing new initiatives for responsible AI development.",
      topics: ["Technology", "AI", "Innovation"],
      keywords: ["OpenAI", "Google", "Microsoft", "GPT-5", "multimodal", "AI assistant", "AI safety"],
      originalLink: "https://pivot5.ai/newsletter/latest"
    },
    {
      digestId: createdDigest.id,
      sender: "eletters@om.adexchanger.com",
      subject: "Digital Advertising Trends: Privacy-First Approaches Gaining Momentum",
      receivedAt: new Date(Date.now() - 7200000), // Use Date object directly
      summary: "A major shift toward privacy-centric advertising strategies is transforming the digital marketing landscape as regulations tighten and consumer awareness grows. Industry leaders are embracing contextual advertising solutions and exploring alternative targeting methods that don't rely on personal data. This trend represents a significant pivot from the data-intensive approaches that have dominated digital advertising for the past decade.",
      fullContent: "The digital advertising ecosystem is undergoing a fundamental transformation as privacy concerns become increasingly central to both regulatory frameworks and consumer preferences. Major platforms and advertisers are now pivoting toward solutions that respect user privacy while maintaining advertising effectiveness.\n\nSeveral key developments are driving this shift: First, the ongoing phaseout of third-party cookies in major browsers, with Google Chrome set to join Safari and Firefox in blocking these tracking technologies. Second, the expansion of privacy regulations beyond GDPR and CCPA to new regions and jurisdictions. Third, the growing sophistication of contextual advertising technologies that can deliver relevance without personal data.\n\nLeading agencies report that campaigns using privacy-preserving approaches are seeing comparable or better performance metrics than traditional targeting methods. This success is accelerating adoption across the industry, with major brands announcing commitments to reduce their reliance on personal data collection.",
      topics: ["Marketing", "Advertising", "Privacy"],
      keywords: ["third-party cookies", "GDPR", "CCPA", "contextual advertising", "privacy regulations"],
      originalLink: "https://adexchanger.com/newsletter/latest"
    },
    {
      digestId: createdDigest.id,
      sender: "email@washingtonpost.com",
      subject: "Climate Summit Reaches Breakthrough Agreement on Emissions Targets",
      receivedAt: new Date(Date.now() - 10800000), // Use Date object directly
      summary: "World leaders at the International Climate Summit have reached a landmark agreement on reducing carbon emissions, with major economies committing to more ambitious targets than previously pledged. The accord includes unprecedented financial commitments to support developing nations in transitioning to clean energy and adapting to climate impacts. Environmental experts are cautiously optimistic about the deal, noting that implementation will be crucial.",
      fullContent: "After two weeks of intense negotiations, the International Climate Summit concluded with an agreement that climate scientists are calling \"potentially transformative\" if fully implemented. The summit, attended by representatives from 196 countries, focused on accelerating emissions reductions to limit global warming to 1.5 degrees Celsius above pre-industrial levels.\n\nKey elements of the agreement include: A commitment from all G20 nations to reach net-zero emissions by 2050, with China pledging 2060 and India 2070; the establishment of a $100 billion annual fund to help vulnerable nations adapt to climate impacts and transition their energy systems; and a new framework for measuring and verifying emissions reductions that includes stricter reporting requirements.\n\nThe agreement also addresses methane emissions for the first time in a significant way, with major fossil fuel producers agreeing to reduce methane leakage by 75% by 2030. Additionally, a coalition of 50 countries committed to ending deforestation by 2030, with significant financial incentives for preserving rainforests.",
      topics: ["Climate", "Policy", "International"],
      keywords: ["emissions", "net-zero", "G20", "methane", "deforestation", "climate finance"],
      originalLink: "https://www.washingtonpost.com/newsletters/latest"
    }
  ];
  
  // Add the sample emails to storage
  const emails: DigestEmail[] = [];
  for (const email of sampleEmails) {
    const createdEmail = await storage.addDigestEmail(email);
    emails.push(createdEmail);
  }
  
  // Format dates for client consumption
  const formattedEmails = emails.map(email => ({
    ...email,
    receivedAt: email.receivedAt instanceof Date ? email.receivedAt.toISOString() : email.receivedAt
  }));
  
  return {
    ...createdDigest,
    date: createdDigest.date instanceof Date ? createdDigest.date.toISOString() : createdDigest.date,
    emails: formattedEmails
  };
}
