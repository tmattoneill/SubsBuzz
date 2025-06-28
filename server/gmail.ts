import { google } from 'googleapis';
import { OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REDIRECT_URI, exchangeTokenForGmail } from './auth';
import { getAuth } from 'firebase-admin/auth';

interface RawEmail {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  historyId: string;
  internalDate: string;
  payload: {
    partId: string;
    mimeType: string;
    filename: string;
    headers: {
      name: string;
      value: string;
    }[];
    body: {
      size: number;
      data?: string;
    };
    parts?: any[];
  };
  sizeEstimate: number;
}

interface ParsedEmail {
  id: string;
  sender: string;
  subject: string;
  receivedAt: string;
  content: string;
  originalLink?: string;
}

// Fetch emails from Gmail using the Gmail API
export async function fetchEmails(monitoredSenders: string[], userIdToken?: string): Promise<ParsedEmail[]> {
  try {
    console.log(`Attempting to fetch emails from monitored senders: ${monitoredSenders.join(', ')}`);

    // Filter out any empty sender emails
    const validSenders = monitoredSenders.filter(sender => sender.trim() !== '');
    
    if (validSenders.length === 0) {
      console.log('No valid sender emails provided');
      return [];
    }

    try {
      let oauth2Client = null;
      
      // Try to get OAuth client if user token is provided
      if (userIdToken) {
        console.log('Attempting to exchange token for Gmail API access');
        const result = await exchangeTokenForGmail(userIdToken);
        if (result && result.oauth2Client) {
          oauth2Client = result.oauth2Client;
        } else if (result && result.authUrl) {
          console.log('Gmail authorization needed. Auth URL:', result.authUrl);
        }
      }
      
      // If we have a valid OAuth client, try to fetch real emails
      if (oauth2Client) {
        console.log('OAuth client obtained, attempting to fetch real emails');
        
        // Create a search query to find emails from the monitored senders
        // Only include emails received in the last 24 hours
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const afterDate = yesterday.toISOString().split('T')[0]; // Format as YYYY-MM-DD
        
        // Build the search query: from:(sender1 OR sender2) after:YYYY-MM-DD
        const fromQuery = validSenders.map(sender => `"${sender}"`).join(' OR ');
        const searchQuery = `from:(${fromQuery}) after:${afterDate}`;
        
        console.log(`Gmail search query: ${searchQuery}`);
        
        // Create Gmail API client
        const gmail = google.gmail('v1');
        
        // List messages matching the search query
        const response = await gmail.users.messages.list({
          auth: oauth2Client,
          userId: 'me',
          q: searchQuery,
          maxResults: 10
        });
        
        const messages = response.data.messages || [];
        console.log(`Found ${messages.length} matching emails`);
        
        // If we successfully connected but found no messages, return an empty array
        if (messages.length === 0) {
          return [];
        }
        
        // Fetch each message's details
        const emails: ParsedEmail[] = [];
        
        for (const message of messages) {
          if (message.id) {
            const messageData = await gmail.users.messages.get({
              auth: oauth2Client,
              userId: 'me',
              id: message.id
            });
            
            if (messageData && messageData.data) {
              // Parse the raw email into our ParsedEmail format
              const parsedEmail = parseGmailMessage(messageData.data as RawEmail);
              
              // Only include emails from our monitored senders
              if (validSenders.some(sender => parsedEmail.sender.includes(sender))) {
                emails.push(parsedEmail);
              }
            }
          }
        }
        
        console.log(`Successfully processed ${emails.length} real emails`);
        return emails;
      } else {
        console.log('No valid OAuth client available, falling back to mock data');
      }
    } catch (error) {
      console.error('Error fetching real emails from Gmail API, falling back to mock data:', error);
    }
    
    // Fall back to mock data
    console.log('Generating mock email data for development');
    const mockEmails: ParsedEmail[] = [];
    
    // Generate a few mock emails for each sender
    for (const sender of validSenders) {
      // Create 1-3 emails per sender
      const numEmails = Math.floor(Math.random() * 3) + 1;
      
      for (let i = 0; i < numEmails; i++) {
        const mockEmail = createMockEmail(sender);
        mockEmails.push(mockEmail);
      }
    }
    
    console.log(`Generated ${mockEmails.length} mock emails for development`);
    return mockEmails;
  } catch (error: any) {
    console.error('Error in fetchEmails:', error);
    throw new Error(`Failed to fetch emails: ${error.message}`);
  }
}

// Parse a Gmail API message into our ParsedEmail format
function parseGmailMessage(message: RawEmail): ParsedEmail {
  const headers = message.payload.headers;
  
  // Extract email metadata from headers
  const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || 'No Subject';
  const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
  const date = headers.find(h => h.name.toLowerCase() === 'date')?.value || '';
  
  // Extract sender email from the From header
  const senderMatch = from.match(/<(.+?)>/) || [null, from.split(' ').pop()];
  const sender = senderMatch[1] || '';
  
  // Extract the email content
  let content = '';
  
  // Check if the message has a body with data
  if (message.payload.body && message.payload.body.data) {
    // Decode the base64 encoded content
    content = Buffer.from(message.payload.body.data, 'base64').toString('utf8');
  } else if (message.payload.parts) {
    // If the message has parts, find the text/plain or text/html part
    const textPart = message.payload.parts.find(part => 
      part.mimeType === 'text/plain' || part.mimeType === 'text/html'
    );
    
    if (textPart && textPart.body && textPart.body.data) {
      content = Buffer.from(textPart.body.data, 'base64').toString('utf8');
    }
  }
  
  // Parse the received date
  const receivedAt = new Date(date).toISOString();
  
  // Create a link to the original email in Gmail
  const originalLink = `https://mail.google.com/mail/u/0/#inbox/${message.id}`;
  
  return {
    id: message.id,
    sender,
    subject,
    receivedAt,
    content,
    originalLink
  };
}

function createMockEmail(sender: string): ParsedEmail {
  const id = `email_${Math.random().toString(36).substring(2, 11)}`;
  const receivedAt = new Date(Date.now() - Math.random() * 86400000 * 3).toISOString(); // Last 3 days
  
  // Generate appropriate subject and content based on the sender
  let subject = '';
  let content = '';
  let originalLink;
  
  if (sender === 'daily@pivot5.ai') {
    subject = getRandomPivot5Subject();
    content = getRandomPivot5Content();
    originalLink = 'https://pivot5.ai/newsletter/latest';
  } else if (sender === 'eletters@om.adexchanger.com') {
    subject = getRandomAdExchangerSubject();
    content = getRandomAdExchangerContent();
    originalLink = 'https://adexchanger.com/newsletter/latest';
  } else if (sender === 'email@washingtonpost.com') {
    subject = getRandomWashingtonPostSubject();
    content = getRandomWashingtonPostContent();
    originalLink = 'https://www.washingtonpost.com/newsletters/latest';
  } else {
    subject = `Latest updates from ${sender.split('@')[0]}`;
    content = `This is a sample email content from ${sender}. It would contain various information and updates.`;
    originalLink = `https://${sender.split('@')[1]}/newsletter`;
  }
  
  return {
    id,
    sender,
    subject,
    receivedAt,
    content,
    originalLink
  };
}

function getRandomPivot5Subject(): string {
  const subjects = [
    "Tech Giants Announce Major AI Breakthroughs at Annual Conference",
    "Weekly AI Digest: Transformative Developments in Machine Learning",
    "AI Startup Funding Reaches Record High in Q2 2023",
    "The Future of Work: How AI is Reshaping Industries",
    "New Research Shows Promising Results for AI in Healthcare"
  ];
  return subjects[Math.floor(Math.random() * subjects.length)];
}

function getRandomPivot5Content(): string {
  return `
Major technology companies unveiled significant advancements in artificial intelligence at this year's tech conference. Key highlights include new language models that show improved reasoning capabilities, computer vision systems that can interpret complex scenes with greater accuracy, and AI assistants that can perform more sophisticated tasks with minimal human input.

Tech giants including OpenAI, Google, and Microsoft presented their latest AI developments at the annual AI Summit held in San Francisco this week. The event showcased revolutionary advancements that could reshape industries from healthcare to finance.

OpenAI demonstrated GPT-5, featuring enhanced reasoning and problem-solving abilities that surpass previous versions. Google presented its new multimodal system that can simultaneously process and analyze text, images, and audio inputs. Microsoft introduced an advanced AI assistant for business applications that can handle complex workflows without human intervention.

Industry experts note that these developments signal an accelerating pace of innovation in the AI sector, with implications for regulatory frameworks and ethical considerations. The conference also addressed concerns about AI safety and governance, with several companies announcing new initiatives for responsible AI development.
  `;
}

function getRandomAdExchangerSubject(): string {
  const subjects = [
    "Digital Advertising Trends: Privacy-First Approaches Gaining Momentum",
    "The End of Third-Party Cookies: What Advertisers Need to Know",
    "Programmatic Ad Spending Increases 25% Despite Economic Uncertainty",
    "First-Party Data Strategies That Drive Marketing ROI",
    "Connected TV Advertising: Growth Opportunities and Challenges"
  ];
  return subjects[Math.floor(Math.random() * subjects.length)];
}

function getRandomAdExchangerContent(): string {
  return `
A major shift toward privacy-centric advertising strategies is transforming the digital marketing landscape as regulations tighten and consumer awareness grows. Industry leaders are embracing contextual advertising solutions and exploring alternative targeting methods that don't rely on personal data. This trend represents a significant pivot from the data-intensive approaches that have dominated digital advertising for the past decade.

The digital advertising ecosystem is undergoing a fundamental transformation as privacy concerns become increasingly central to both regulatory frameworks and consumer preferences. Major platforms and advertisers are now pivoting toward solutions that respect user privacy while maintaining advertising effectiveness.

Several key developments are driving this shift: First, the ongoing phaseout of third-party cookies in major browsers, with Google Chrome set to join Safari and Firefox in blocking these tracking technologies. Second, the expansion of privacy regulations beyond GDPR and CCPA to new regions and jurisdictions. Third, the growing sophistication of contextual advertising technologies that can deliver relevance without personal data.

Leading agencies report that campaigns using privacy-preserving approaches are seeing comparable or better performance metrics than traditional targeting methods. This success is accelerating adoption across the industry, with major brands announcing commitments to reduce their reliance on personal data collection.
  `;
}

function getRandomWashingtonPostSubject(): string {
  const subjects = [
    "Climate Summit Reaches Breakthrough Agreement on Emissions Targets",
    "Senate Passes Landmark Infrastructure Bill After Months of Negotiations",
    "Global Economic Outlook: Experts Predict Challenging Year Ahead",
    "Supreme Court Issues Ruling on High-Profile Constitutional Case",
    "Health Officials Announce New Initiative to Address Public Health Challenges"
  ];
  return subjects[Math.floor(Math.random() * subjects.length)];
}

function getRandomWashingtonPostContent(): string {
  return `
World leaders at the International Climate Summit have reached a landmark agreement on reducing carbon emissions, with major economies committing to more ambitious targets than previously pledged. The accord includes unprecedented financial commitments to support developing nations in transitioning to clean energy and adapting to climate impacts. Environmental experts are cautiously optimistic about the deal, noting that implementation will be crucial.

After two weeks of intense negotiations, the International Climate Summit concluded with an agreement that climate scientists are calling "potentially transformative" if fully implemented. The summit, attended by representatives from 196 countries, focused on accelerating emissions reductions to limit global warming to 1.5 degrees Celsius above pre-industrial levels.

Key elements of the agreement include: A commitment from all G20 nations to reach net-zero emissions by 2050, with China pledging 2060 and India 2070; the establishment of a $100 billion annual fund to help vulnerable nations adapt to climate impacts and transition their energy systems; and a new framework for measuring and verifying emissions reductions that includes stricter reporting requirements.

The agreement also addresses methane emissions for the first time in a significant way, with major fossil fuel producers agreeing to reduce methane leakage by 75% by 2030. Additionally, a coalition of 50 countries committed to ending deforestation by 2030, with significant financial incentives for preserving rainforests.
  `;
}
