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

export interface NewsletterSender {
  email: string;
  name: string;
  count: number;
  latestSubject: string;
  hasUnsubscribe: boolean;
}

// Scan Gmail for potential newsletter senders (looking for unsubscribe links)
export async function scanForNewsletters(userUid: string): Promise<NewsletterSender[]> {
  try {
    console.log(`Scanning Gmail for potential newsletter senders, userUid: ${userUid}`);

    // Get OAuth client
    const result = await exchangeTokenForGmail(userUid);
    if (!result || !result.oauth2Client) {
      console.error(`No valid OAuth client for newsletter scanning. Result: ${JSON.stringify(result)}`);
      throw new Error('Gmail authentication required. Please connect your Gmail account.');
    }

    const oauth2Client = result.oauth2Client;
    const gmail = google.gmail('v1');

    // Look back 72 hours for emails
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const afterDate = threeDaysAgo.toISOString().split('T')[0];

    // Search for emails with unsubscribe links (newsletters typically have these)
    const searchQuery = `after:${afterDate} unsubscribe`;
    
    console.log(`Newsletter search query: ${searchQuery}`);

    // Get messages with unsubscribe mentions
    const response = await gmail.users.messages.list({
      auth: oauth2Client,
      userId: 'me',
      q: searchQuery,
      maxResults: 100 // Limit to avoid overwhelming API
    });

    const messages = response.data.messages || [];
    console.log(`Found ${messages.length} potential newsletter emails`);

    if (messages.length === 0) {
      return [];
    }

    // Group emails by sender
    const senderMap = new Map<string, NewsletterSender>();

    // Process each message
    for (const message of messages) {
      if (message.id) {
        try {
          const messageData = await gmail.users.messages.get({
            auth: oauth2Client,
            userId: 'me',
            id: message.id
          });

          if (messageData && messageData.data) {
            const rawEmail = messageData.data as RawEmail;
            const headers = rawEmail.payload.headers;
            
            // Extract sender info
            const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
            const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
            
            // Extract sender email and name
            const senderMatch = from.match(/^(.+?)\s*<(.+?)>$/);
            let senderEmail = '';
            let senderName = '';
            
            if (senderMatch) {
              senderName = senderMatch[1].trim().replace(/"/g, '');
              senderEmail = senderMatch[2].trim();
            } else {
              senderEmail = from.split(' ').pop() || from;
              senderName = from.replace(senderEmail, '').trim().replace(/[<>]/g, '');
            }

            if (!senderEmail || senderEmail.length === 0) continue;

            // Check if this email actually has unsubscribe content
            const hasUnsubscribe = await checkForUnsubscribeLink(rawEmail);

            // Group by sender email
            if (senderMap.has(senderEmail)) {
              const existing = senderMap.get(senderEmail)!;
              existing.count++;
              if (hasUnsubscribe) existing.hasUnsubscribe = true;
              // Update with latest subject if newer
              existing.latestSubject = subject;
            } else {
              senderMap.set(senderEmail, {
                email: senderEmail,
                name: senderName || senderEmail,
                count: 1,
                latestSubject: subject,
                hasUnsubscribe
              });
            }
          }
        } catch (error) {
          console.warn(`Error processing message ${message.id}:`, error);
          continue;
        }
      }
    }

    // Convert to array and sort by email count (most frequent first)
    const newsletters = Array.from(senderMap.values())
      .filter(sender => sender.hasUnsubscribe) // Only include emails with unsubscribe links
      .sort((a, b) => b.count - a.count);

    console.log(`Found ${newsletters.length} potential newsletter senders`);
    return newsletters;

  } catch (error: any) {
    console.error('Error scanning for newsletters:', error);
    return [];
  }
}

// Check if an email contains unsubscribe links
async function checkForUnsubscribeLink(message: RawEmail): Promise<boolean> {
  try {
    let content = '';
    
    // Get email content
    if (message.payload.body && message.payload.body.data) {
      content = Buffer.from(message.payload.body.data, 'base64').toString('utf8');
    } else if (message.payload.parts) {
      // Look for HTML part first, then text
      const htmlPart = message.payload.parts.find(part => part.mimeType === 'text/html');
      const textPart = message.payload.parts.find(part => part.mimeType === 'text/plain');
      
      const part = htmlPart || textPart;
      if (part && part.body && part.body.data) {
        content = Buffer.from(part.body.data, 'base64').toString('utf8');
      }
    }

    if (!content) return false;

    // Check for common unsubscribe patterns
    const unsubscribePatterns = [
      /unsubscribe/i,
      /opt.out/i,
      /manage.*preferences/i,
      /email.*preferences/i,
      /subscription.*settings/i,
      /remove.*from.*list/i,
      /list-unsubscribe/i, // Email header
    ];

    return unsubscribePatterns.some(pattern => pattern.test(content));
  } catch (error) {
    console.warn('Error checking for unsubscribe link:', error);
    return false;
  }
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
        // Look back 24 hours for recent emails
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        const afterDate = oneDayAgo.toISOString().split('T')[0]; // Format as YYYY-MM-DD
        
        // Build the search query: from:(sender1 OR sender2) after:YYYY-MM-DD
        const fromQuery = validSenders.map(sender => `"${sender}"`).join(' OR ');
        const searchQuery = `from:(${fromQuery}) after:${afterDate}`;
        
        console.log(`Gmail search query: ${searchQuery}`);
        
        // Create Gmail API client
        const gmail = google.gmail('v1');
        
        // List messages matching the search query (no limit - get all emails)
        const response = await gmail.users.messages.list({
          auth: oauth2Client,
          userId: 'me',
          q: searchQuery
          // Removed maxResults to get all matching emails
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
              const parsedEmail = await parseGmailMessage(messageData.data as RawEmail);
              
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
async function parseGmailMessage(message: RawEmail): Promise<ParsedEmail> {
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
  
  // Extract clean content from HTML newsletters with advanced pre-processing
  const originalLength = rawContent.length;
  content = await extractNewsletterContent(rawContent);
  console.log(`Content extraction: ${originalLength} chars → ${content.length} chars (${Math.round((1 - content.length/originalLength) * 100)}% reduction)`);
  
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
async function extractNewsletterContent(rawContent: string): Promise<string> {
  if (!rawContent) return '';
  
  // If it's already plain text, return as-is with basic cleanup
  if (!rawContent.includes('<html') && !rawContent.includes('<HTML')) {
    return cleanTextContent(rawContent);
  }
  
  try {
    // Load HTML content with Cheerio
    const $ = cheerio.load(rawContent);
    
    // First, try to find and use "view online" link for better content
    const onlineContent = await tryExtractFromOnlineVersion($);
    if (onlineContent) {
      console.log('Successfully extracted content from online version');
      return onlineContent;
    }
    
    // Fall back to aggressive email HTML cleaning
    return await extractFromEmailHTML($, rawContent);
    
  } catch (error) {
    console.warn('Error parsing HTML content, falling back to raw content:', error);
    // Fallback to basic text cleanup if HTML parsing fails
    return cleanTextContent(rawContent.replace(/<[^>]*>/g, ' '));
  }
}

// Try to find "view online" links and scrape better content
async function tryExtractFromOnlineVersion($: any): Promise<string | null> {
  try {
    // Common patterns for "view online" links
    const onlinePatterns = [
      'a[href*="view"]:contains("online")',
      'a[href*="browser"]:contains("view")',
      'a[href*="web"]:contains("view")',
      'a:contains("View in browser")',
      'a:contains("Read online")',
      'a:contains("Open in browser")',
      'a:contains("View this email in your browser")',
      'a:contains("Having trouble viewing")',
      'a[href*="newsletter"]:contains("view")',
      'a[href*="email"]:contains("view")'
    ];
    
    let onlineUrl: string | null = null;
    
    for (const pattern of onlinePatterns) {
      const link = $(pattern).first();
      if (link.length > 0) {
        const href = link.attr('href');
        if (href && (href.startsWith('http') || href.startsWith('https'))) {
          onlineUrl = href;
          console.log(`Found online version link: ${onlineUrl}`);
          break;
        }
      }
    }
    
    if (!onlineUrl) return null;
    
    // Fetch and extract content from online version with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(onlineUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SubsBuzz/1.0; +https://subsbuzz.com)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) return null;
    
    const html = await response.text();
    const $online = cheerio.load(html);
    
    // Extract content from the online version
    return await extractFromEmailHTML($online, html);
    
  } catch (error) {
    console.warn('Failed to extract from online version:', error);
    return null;
  }
}

// Advanced email HTML content extraction
async function extractFromEmailHTML($: any, rawContent: string): Promise<string> {
  // Step 1: Aggressively remove all non-content elements
  $('script, style, noscript, meta, link[rel="stylesheet"]').remove();
  $('img[width="1"], img[height="1"]').remove(); // Tracking pixels
  $('[style*="display:none"], [style*="display: none"]').remove();
  $('[style*="visibility:hidden"], [style*="visibility: hidden"]').remove();
  $('.tracking, .pixel, .beacon').remove();
  
  // Step 2: Remove newsletter cruft more comprehensively
  const cruftySelectors = [
    '.unsubscribe', '.footer', '.social-links', '.header-logo', '.nav', '.navigation',
    '.sidebar', '.advertisement', '.ad', '.promo', '.sponsor', '.banner',
    '[id*="unsubscribe"]', '[class*="unsubscribe"]', '[class*="footer"]', '[id*="footer"]',
    '[class*="social"]', '[class*="share"]', '[class*="follow"]',
    '[href*="unsubscribe"]', '[href*="preferences"]', '[href*="manage"]',
    '.header-image', '.logo-container', '.email-header', '.email-footer',
    '[class*="tracking"]', '[id*="tracking"]', '[class*="pixel"]'
  ];
  
  cruftySelectors.forEach(selector => {
    try {
      $(selector).remove();
    } catch (e) {
      // Continue if selector is invalid
    }
  });
  
  // Step 3: Remove elements that are likely navigation or cruft based on content
  $('a').each((_i: number, elem: any) => {
    const text = $(elem).text().toLowerCase().trim();
    const cruftyTexts = [
      'unsubscribe', 'manage preferences', 'view in browser', 'forward to a friend',
      'add to address book', 'whitelist', 'privacy policy', 'terms', 'contact us',
      'follow us', 'like us', 'tweet', 'share', 'facebook', 'twitter', 'linkedin',
      'instagram', 'youtube', 'update preferences', 'email preferences'
    ];
    
    if (cruftyTexts.some(crufty => text.includes(crufty))) {
      $(elem).parent().remove();
    }
  });
  
  // Step 4: Target main content areas with improved selectors
  let mainContent = '';
  
  const contentSelectors = [
    // Newsletter-specific selectors (high priority)
    '[role="article"]', 'article', '.article-content', '.newsletter-content',
    '.email-content', '.main-content', '.content-wrapper', '.email-body',
    
    // Generic content selectors
    '.content', '.main', '.body', '.wrapper .content',
    '[role="main"]', 'main', '#content', '#main',
    
    // Table-based newsletters (improved selectors)
    'table[role="presentation"] td', // More general table cell selector
    'table td[style*="padding"]', // Table cells with padding (common in newsletters)
    'table.email-container td', 'table.newsletter td',
    'table[width] td', // Tables with explicit width
    
    // Container patterns
    '.container .content', '.email-container .content',
    '.newsletter-container', '.email-wrapper .content'
  ];
  
  for (const selector of contentSelectors) {
    try {
      const element = $(selector);
      if (element.length > 0) {
        const text = element.text().trim();
        // More lenient content requirements - newsletters vary widely in length
        if (text.length > 100 && text.split(' ').length > 15) {
          mainContent = element.html() || '';
          console.log(`Found content using selector: ${selector} (${text.length} chars)`);
          break;
        }
      }
    } catch (e) {
      continue;
    }
  }
  
  // Step 5: Fallback with more aggressive body cleaning
  if (!mainContent && $('body').length > 0) {
    // Remove everything that's typically not content
    const bodyCleaners = [
      'header', 'footer', 'nav', 'aside', '.sidebar', '.nav', '.navigation',
      '.header', '.footer', '.social', '.share', '.follow', '.ad', '.advertisement',
      '.unsubscribe', '.preferences', '.manage', '.contact', '.about'
    ];
    
    bodyCleaners.forEach(selector => $('body').find(selector).remove());
    mainContent = $('body').html() || '';
  }
  
  // Step 6: Final fallback
  if (!mainContent) {
    mainContent = rawContent;
  }
  
  // Step 7: Convert to clean text with aggressive options
  const cleanText = convert(mainContent, {
    wordwrap: false,
    preserveNewlines: true,
    baseElements: { 
      selectors: ['p', 'div', 'article', 'section', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
      returnDomByDefault: false 
    },
    selectors: [
      { selector: 'img', format: 'skip' },
      { selector: 'script', format: 'skip' },
      { selector: 'style', format: 'skip' },
      { selector: 'iframe', format: 'skip' },
      { selector: 'video', format: 'skip' },
      { selector: 'audio', format: 'skip' },
      { selector: 'canvas', format: 'skip' },
      { selector: 'svg', format: 'skip' },
      { selector: 'table', options: { uppercaseHeaderCells: false } },
      { selector: 'a', options: { 
        hideLinkHrefIfSameAsText: true,
        ignoreHref: true // Don't include URLs in text
      }},
      { selector: 'h1', options: { uppercase: false } },
      { selector: 'h2', options: { uppercase: false } },
      { selector: 'h3', options: { uppercase: false } },
      { selector: 'h4', options: { uppercase: false } },
      { selector: 'h5', options: { uppercase: false } },
      { selector: 'h6', options: { uppercase: false } }
    ]
  });
  
  const finalContent = cleanTextContent(cleanText);
  
  // If the extracted content is too short, fall back to basic text extraction
  if (finalContent.length < 200) {
    console.log('Extracted content too short, falling back to basic HTML stripping');
    const basicText = cleanTextContent(rawContent.replace(/<[^>]*>/g, ' '));
    // Only use basic text if it's significantly longer than extracted content
    return basicText.length > (finalContent.length * 1.5) ? basicText : finalContent;
  }
  
  return finalContent;
}

// Clean and normalize text content
function cleanTextContent(text: string): string {
  return text
    // Remove multiple consecutive whitespace
    .replace(/\s+/g, ' ')
    // Remove excessive newlines (more than 2)
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    // Remove leading/trailing whitespace per line
    .split('\n').map(line => line.trim()).join('\n')
    // Remove empty lines at start/end
    .replace(/^\n+|\n+$/g, '')
    // Remove common email artifacts
    .replace(/\[.*?\]/g, '') // Remove [brackets] content
    .replace(/\|.*?\|/g, '') // Remove |pipe| content  
    .replace(/^>.*$/gm, '') // Remove quoted text lines
    .replace(/Click here to view.*$/gm, '') // Remove "click here" lines
    .replace(/This email was sent to.*$/gm, '') // Remove email footer text
    .replace(/You received this.*$/gm, '') // Remove subscription text
    .replace(/To unsubscribe.*$/gm, '') // Remove unsubscribe text
    .replace(/^\s*[\*\-\_\=]{3,}\s*$/gm, '') // Remove separator lines
    // Final cleanup
    .trim();
}

