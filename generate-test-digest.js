#!/usr/bin/env node

/**
 * Generate Test Digest Script
 * 
 * This script generates a fresh digest for tmattoneill@gmail.com using:
 * 1. OAuth tokens from database
 * 2. Gmail API to fetch last 48 hours of emails
 * 3. OpenAI for analysis
 * 4. Storage in database
 */

import 'dotenv/config';
import { GoogleAuth } from 'google-auth-library';
import { gmail_v1, google } from 'googleapis';
import OpenAI from 'openai';
import pg from 'pg';
import { format } from 'date-fns';

const { Client } = pg;

// Configuration
const USER_EMAIL = 'tmattoneill@gmail.com';
const USER_ID = '108916677826866981071';
const HOURS_BACK = 48;

// Initialize clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const db = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  console.log('🚀 Starting digest generation for', USER_EMAIL);
  
  try {
    // Connect to database
    await db.connect();
    console.log('✅ Connected to database');
    
    // Get OAuth tokens
    const tokenResult = await db.query(
      'SELECT access_token, refresh_token FROM oauth_tokens WHERE email = $1',
      [USER_EMAIL]
    );
    
    if (tokenResult.rows.length === 0) {
      throw new Error('No OAuth tokens found for user');
    }
    
    const { access_token, refresh_token } = tokenResult.rows[0];
    console.log('✅ Retrieved OAuth tokens');
    
    // Set up Gmail client
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    
    auth.setCredentials({
      access_token,
      refresh_token,
    });
    
    const gmail = google.gmail({ version: 'v1', auth });
    console.log('✅ Gmail client initialized');
    
    // Get monitored email addresses
    const monitoredResult = await db.query(
      'SELECT email FROM monitored_emails WHERE user_id = $1',
      [USER_ID]
    );
    
    const monitoredEmails = monitoredResult.rows.map(row => row.email);
    console.log('✅ Found monitored emails:', monitoredEmails);
    
    // Calculate date range (last 48 hours)
    const now = new Date();
    const hoursAgo = new Date(now.getTime() - (HOURS_BACK * 60 * 60 * 1000));
    
    console.log(`📅 Fetching emails from ${hoursAgo.toISOString()} to ${now.toISOString()}`);
    
    // Fetch emails from Gmail
    const emails = [];
    
    for (const senderEmail of monitoredEmails) {
      console.log(`📧 Fetching emails from ${senderEmail}...`);
      
      const query = `from:${senderEmail} after:${Math.floor(hoursAgo.getTime() / 1000)}`;
      
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 50,
      });
      
      if (response.data.messages) {
        for (const message of response.data.messages) {
          const messageDetail = await gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'full',
          });
          
          const headers = messageDetail.data.payload?.headers || [];
          const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
          const from = headers.find(h => h.name === 'From')?.value || senderEmail;
          const date = headers.find(h => h.name === 'Date')?.value || new Date().toISOString();
          
          // Extract email body
          let body = '';
          if (messageDetail.data.payload?.body?.data) {
            body = Buffer.from(messageDetail.data.payload.body.data, 'base64').toString();
          } else if (messageDetail.data.payload?.parts) {
            for (const part of messageDetail.data.payload.parts) {
              if (part.mimeType === 'text/plain' && part.body?.data) {
                body += Buffer.from(part.body.data, 'base64').toString();
              }
            }
          }
          
          emails.push({
            subject,
            sender: from,
            receivedAt: new Date(date),
            content: body.substring(0, 2000), // Limit content length
            messageId: message.id,
          });
        }
      }
    }
    
    console.log(`✅ Fetched ${emails.length} emails`);
    
    if (emails.length === 0) {
      console.log('⚠️  No emails found in the last 48 hours');
      return;
    }
    
    // Create email digest in database
    const digestResult = await db.query(
      'INSERT INTO email_digests (user_id, date, emails_processed, topics_identified) VALUES ($1, $2, $3, $4) RETURNING id',
      [USER_ID, now, emails.length, 0]
    );
    
    const digestId = digestResult.rows[0].id;
    console.log(`✅ Created digest with ID: ${digestId}`);
    
    // Process each email with OpenAI
    let totalTopics = 0;
    
    for (const email of emails) {
      console.log(`🤖 Analyzing email: ${email.subject.substring(0, 50)}...`);
      
      try {
        const analysisPrompt = `You are an AI assistant that analyzes emails and returns structured data in JSON format.

Email to analyze:
Subject: ${email.subject}
From: ${email.sender}
Content: ${email.content}

Return a JSON object with these exact fields:
- summary: A 2-3 sentence summary of the email content
- topics: An array of 3-5 topic strings (e.g., ["Breaking News", "Politics", "Technology"])
- keywords: An array of 3-5 keyword strings (e.g., ["election", "candidate", "voting"])
- sentiment: One of: "positive", "negative", or "neutral"

Example response format:
{
  "summary": "This email discusses recent political developments and election updates.",
  "topics": ["Politics", "Elections", "Breaking News"],
  "keywords": ["election", "candidate", "voting", "politics"],
  "sentiment": "neutral"
}

Respond with ONLY the JSON object, no other text.`;

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: analysisPrompt }],
          temperature: 0.7,
          max_tokens: 500,
        });
        
        const analysisText = completion.choices[0].message.content?.trim();
        let analysis;
        
        try {
          // Try to parse the JSON response
          analysis = JSON.parse(analysisText);
          
          // Validate required fields
          if (!analysis.summary || !Array.isArray(analysis.topics) || !Array.isArray(analysis.keywords)) {
            throw new Error('Invalid structure');
          }
          
        } catch (parseError) {
          console.log(`⚠️  JSON parsing failed for: ${email.subject.substring(0, 30)}...`);
          console.log(`Parse error: ${parseError.message}`);
          console.log(`Full response: ${analysisText}`);
          
          // Fallback if JSON parsing fails
          analysis = {
            summary: `Email from ${email.sender.split('@')[0]} about ${email.subject}. Content includes updates and information relevant to subscribers.`,
            topics: ['Email Newsletter', 'Updates', 'Information'],
            keywords: ['newsletter', 'update', 'information'],
            sentiment: 'neutral'
          };
        }
        
        // Store email in digest_emails table
        await db.query(
          `INSERT INTO digest_emails 
           (digest_id, sender, subject, received_at, summary, full_content, topics, keywords, original_link) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            digestId,
            email.sender,
            email.subject,
            email.receivedAt,
            analysis.summary,
            email.content,
            analysis.topics, // PostgreSQL text array - pass directly
            analysis.keywords, // PostgreSQL text array - pass directly
            `https://mail.google.com/mail/u/0/#inbox/${email.messageId}`
          ]
        );
        
        totalTopics += (analysis.topics?.length || 0);
        
        console.log(`✅ Processed: ${email.subject.substring(0, 30)}... (${analysis.topics?.length || 0} topics)`);
        
      } catch (error) {
        console.error(`❌ Failed to analyze email: ${email.subject}`, error.message);
      }
    }
    
    // Update digest with topic count
    await db.query(
      'UPDATE email_digests SET topics_identified = $1 WHERE id = $2',
      [totalTopics, digestId]
    );
    
    console.log(`✅ Digest generation complete!`);
    console.log(`📊 Digest ID: ${digestId}`);
    console.log(`📧 Emails processed: ${emails.length}`);
    console.log(`🏷️  Topics identified: ${totalTopics}`);
    console.log(`📅 Date: ${format(now, 'yyyy-MM-dd HH:mm:ss')}`);
    
  } catch (error) {
    console.error('❌ Error generating digest:', error);
    throw error;
  } finally {
    await db.end();
  }
}

main().catch(console.error);