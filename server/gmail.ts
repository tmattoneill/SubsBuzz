import { google } from 'googleapis';
import { OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REDIRECT_URI, exchangeTokenForGmail } from './auth';
import { getAuth } from 'firebase-admin/auth';
import * as cheerio from 'cheerio';
import { convert } from 'html-to-text';

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

export interface ParsedEmail {
  id: string;
  sender: string;
  subject: string;
  receivedAt: string;
  content: string;
  originalLink?: string;
}

// Fetch emails from Gmail using the Gmail API
export async function fetchEmails(monitoredSenders: string[], userUid?: string): Promise<ParsedEmail[]> {
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
      
      // Try to get OAuth client if user UID is provided
      if (userUid) {
        console.log('Attempting to get stored OAuth token for user');
        const result = await exchangeTokenForGmail(userUid);
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
        // Look back 72 hours to catch recent emails when adding new senders
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        const afterDate = threeDaysAgo.toISOString().split('T')[0]; // Format as YYYY-MM-DD
        
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
        console.log('No valid OAuth client available - cannot fetch emails');
        return [];
      }
    } catch (error) {
      console.error('Error fetching emails from Gmail API:', error);
      return [];
    }
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
  
  // Extract the email content with improved parsing
  let content = '';
  let rawContent = '';
  
  // Check if the message has a body with data
  if (message.payload.body && message.payload.body.data) {
    // Decode the base64 encoded content
    rawContent = Buffer.from(message.payload.body.data, 'base64').toString('utf8');
  } else if (message.payload.parts) {
    // If the message has parts, prefer HTML over plain text for newsletters
    const htmlPart = message.payload.parts.find(part => part.mimeType === 'text/html');
    const textPart = message.payload.parts.find(part => part.mimeType === 'text/plain');
    
    const preferredPart = htmlPart || textPart;
    
    if (preferredPart && preferredPart.body && preferredPart.body.data) {
      rawContent = Buffer.from(preferredPart.body.data, 'base64').toString('utf8');
    }
  }
  
  // Extract clean content from HTML newsletters
  content = extractNewsletterContent(rawContent);
  
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

// Extract clean newsletter content from raw email HTML/text
function extractNewsletterContent(rawContent: string): string {
  if (!rawContent) return '';
  
  // If it's already plain text, return as-is with basic cleanup
  if (!rawContent.includes('<html') && !rawContent.includes('<HTML')) {
    return rawContent.trim().replace(/\s+/g, ' ');
  }
  
  try {
    // Load HTML content with Cheerio
    const $ = cheerio.load(rawContent);
    
    // Remove common newsletter cruft that doesn't contain useful content
    $('script, style, noscript').remove();
    $('.unsubscribe, .footer, .social-links, .header-logo').remove();
    $('[id*="unsubscribe"], [class*="unsubscribe"]').remove();
    $('[id*="footer"], [class*="footer"]').remove();
    $('[href*="unsubscribe"]').parent().remove();
    
    // Target main content areas (common newsletter patterns)
    let mainContent = '';
    
    // Try common newsletter content selectors
    const contentSelectors = [
      '.content', '.main', '.newsletter-content', '.email-content',
      'article', '.article', '.post', '.story',
      '[role="main"]', '.wrapper .content', 
      'table[role="presentation"] td', // Many newsletters use tables
      '.body', '.email-body'
    ];
    
    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0 && element.text().trim().length > 100) {
        mainContent = element.html() || '';
        break;
      }
    }
    
    // Fallback: if no specific content area found, use body but remove common cruft
    if (!mainContent && $('body').length > 0) {
      $('body').find('.header, .footer, .unsubscribe, .social, .ad, .advertisement').remove();
      mainContent = $('body').html() || '';
    }
    
    // Final fallback: use all content
    if (!mainContent) {
      mainContent = rawContent;
    }
    
    // Convert HTML to clean text
    const cleanText = convert(mainContent, {
      wordwrap: false,
      preserveNewlines: true,
      selectors: [
        { selector: 'img', options: { ignoreHref: true } },
        { selector: 'a', options: { hideLinkHrefIfSameAsText: true } },
        { selector: 'h1', options: { uppercase: false } },
        { selector: 'h2', options: { uppercase: false } },
        { selector: 'h3', options: { uppercase: false } },
        { selector: 'h4', options: { uppercase: false } },
        { selector: 'h5', options: { uppercase: false } },
        { selector: 'h6', options: { uppercase: false } }
      ]
    });
    
    // Clean up extra whitespace while preserving structure
    return cleanText
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Reduce multiple newlines to double
      .replace(/[ \t]+/g, ' ') // Normalize spaces and tabs
      .trim();
      
  } catch (error) {
    console.warn('Error parsing HTML content, falling back to raw content:', error);
    // Fallback to basic text cleanup if HTML parsing fails
    return rawContent
      .replace(/<[^>]*>/g, ' ') // Strip HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }
}

