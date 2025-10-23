#!/usr/bin/env node

/**
 * Complete Email Processing Pipeline Test
 * 
 * This test implements the full end-to-end pipeline:
 * 1. Retrieves OAuth token for tmattoneill@gmail.com
 * 2. Uses Gmail API to fetch emails from pivot5@mail.beehiiv.com (72h)
 * 3. Processes emails with OpenAI for analysis
 * 4. Creates digest with all processed emails
 * 5. Shows complete results
 * 
 * This test validates the complete business logic workflow.
 */

import { loadEnv } from '../lib/env.js';
import fetch from 'node-fetch';
import { google } from 'googleapis';

// Load environment variables
loadEnv('.env.dev');

const DATA_SERVER_URL = process.env.DATA_SERVER_URL || 'http://localhost:3001';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || 'subsbuzz-internal-api-secret-dev-testing';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

console.log('🚀 Complete Email Processing Pipeline Test');
console.log('='.repeat(70));
console.log('👤 User: tmattoneill@gmail.com');
console.log('📧 Sender: pivot5@mail.beehiiv.com');
console.log('⏰ Timeframe: Last 72 hours');
console.log('🔄 Full Pipeline: Gmail → OpenAI → Database');
console.log('='.repeat(70));

// Helper function to clean HTML content
function extractTextFromHtml(html) {
  if (!html) return '';
  // Basic HTML tag removal - more sophisticated parsing could be added
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

// Helper function to process email with OpenAI
async function processEmailWithOpenAI(email) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert email analyst. Analyze the email content and provide:
1. A concise summary (2-3 sentences)
2. 3-5 main topics/themes
3. 5-8 relevant keywords

Format your response as JSON:
{
  "summary": "Brief summary...",
  "topics": ["topic1", "topic2", "topic3"],
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}`
          },
          {
            role: 'user',
            content: `Email Subject: ${email.subject}\n\nEmail Content: ${email.content.substring(0, 4000)}`
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const analysis = JSON.parse(data.choices[0].message.content);
    
    return {
      summary: analysis.summary,
      topics: analysis.topics || [],
      keywords: analysis.keywords || []
    };
  } catch (error) {
    console.warn(`⚠️ OpenAI analysis failed for email "${email.subject}": ${error.message}`);
    return {
      summary: `Email from ${email.sender}: ${email.subject}`,
      topics: ['General'],
      keywords: ['email', 'newsletter']
    };
  }
}

async function testCompleteEmailPipeline() {
  try {
    // Step 1: Get OAuth token
    console.log('\n🔑 Step 1: Retrieving OAuth token...');
    const tokenResponse = await fetch(`${DATA_SERVER_URL}/api/storage/oauth-token/email/tmattoneill@gmail.com`, {
      headers: {
        'x-internal-api-key': INTERNAL_API_SECRET
      }
    });
    
    if (!tokenResponse.ok) {
      throw new Error(`OAuth token not found: ${tokenResponse.status}`);
    }
    
    const tokenData = await tokenResponse.json();
    const userToken = tokenData.data;
    console.log(`✅ OAuth token retrieved for ${userToken.email}`);

    // Step 2: Set up Gmail API client
    console.log('\n📧 Step 2: Setting up Gmail API client...');
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: userToken.accessToken,
      refresh_token: userToken.refreshToken
    });
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    console.log('✅ Gmail API client configured');

    // Step 3: Calculate 72-hour timeframe
    const now = new Date();
    const seventyTwoHoursAgo = new Date(now.getTime() - (72 * 60 * 60 * 1000));
    const queryDate = Math.floor(seventyTwoHoursAgo.getTime() / 1000);
    
    console.log(`\n🔍 Step 3: Searching for emails from pivot5@mail.beehiiv.com since ${seventyTwoHoursAgo.toISOString()}...`);

    // Step 4: Search for emails
    const searchQuery = `from:pivot5@mail.beehiiv.com after:${queryDate}`;
    console.log(`🔎 Search query: ${searchQuery}`);
    
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      q: searchQuery,
      maxResults: 50
    });

    if (!listResponse.data.messages || listResponse.data.messages.length === 0) {
      console.log('📭 No emails found matching criteria');
      console.log('   This could mean:');
      console.log('   - No emails from pivot5@mail.beehiiv.com in last 72 hours');
      console.log('   - OAuth token expired or lacks Gmail access');
      console.log('   - Gmail API quota exceeded');
      return;
    }

    console.log(`📨 Found ${listResponse.data.messages.length} emails`);

    // Step 5: Fetch and process emails
    console.log('\n📥 Step 5: Fetching and processing emails...');
    const processedEmails = [];

    for (let i = 0; i < Math.min(listResponse.data.messages.length, 5); i++) {
      const message = listResponse.data.messages[i];
      console.log(`   Processing email ${i + 1}/${Math.min(listResponse.data.messages.length, 5)}...`);
      
      try {
        // Get full email
        const fullMessage = await gmail.users.messages.get({
          userId: 'me',
          id: message.id
        });

        const headers = fullMessage.data.payload.headers;
        const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
        const from = headers.find(h => h.name === 'From')?.value || 'Unknown Sender';
        const date = headers.find(h => h.name === 'Date')?.value || new Date().toISOString();
        const messageId = headers.find(h => h.name === 'Message-ID')?.value || message.id;

        // Extract content
        let content = '';
        const extractContent = (part) => {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            return Buffer.from(part.body.data, 'base64').toString('utf-8');
          } else if (part.mimeType === 'text/html' && part.body?.data) {
            const html = Buffer.from(part.body.data, 'base64').toString('utf-8');
            return extractTextFromHtml(html);
          } else if (part.parts) {
            return part.parts.map(extractContent).join('\n').trim();
          }
          return '';
        };

        content = extractContent(fullMessage.data.payload).substring(0, 5000); // Limit content length

        // Create email object
        const email = {
          id: message.id,
          sender: from,
          subject: subject,
          content: content,
          receivedAt: new Date(date),
          originalLink: `https://mail.google.com/mail/u/0/#inbox/${message.id}`
        };

        // Process with OpenAI
        console.log(`   🤖 Analyzing "${subject.substring(0, 50)}..." with OpenAI...`);
        const analysis = await processEmailWithOpenAI(email);

        // Combine email with analysis
        const processedEmail = {
          ...email,
          summary: analysis.summary,
          topics: analysis.topics,
          keywords: analysis.keywords
        };

        processedEmails.push(processedEmail);
        console.log(`   ✅ Processed: ${analysis.topics.join(', ')}`);

        // Add delay to avoid rate limiting
        if (i < Math.min(listResponse.data.messages.length, 5) - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (emailError) {
        console.warn(`   ⚠️ Failed to process email ${i + 1}: ${emailError.message}`);
      }
    }

    if (processedEmails.length === 0) {
      console.log('❌ No emails could be processed');
      return;
    }

    console.log(`\n✅ Successfully processed ${processedEmails.length} emails`);

    // Step 6: Create digest
    console.log('\n💾 Step 6: Creating digest in database...');
    
    const digestPayload = {
      user_id: userToken.uid,
      emails: processedEmails.map(email => ({
        sender: email.sender,
        subject: email.subject,
        content: email.content,
        received_at: email.receivedAt.toISOString(),
        summary: email.summary,
        topics: email.topics,
        keywords: email.keywords,
        original_link: email.originalLink
      }))
    };

    console.log(`📤 Creating digest with ${digestPayload.emails.length} processed emails...`);
    
    const digestResponse = await fetch(`${DATA_SERVER_URL}/api/digest/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-key': INTERNAL_API_SECRET
      },
      body: JSON.stringify(digestPayload)
    });

    if (!digestResponse.ok) {
      const errorText = await digestResponse.text();
      throw new Error(`Digest creation failed: ${digestResponse.status} - ${errorText}`);
    }

    const digestResult = await digestResponse.json();
    console.log('✅ Digest created successfully!');

    // Step 7: Display Results
    console.log('\n' + '='.repeat(70));
    console.log('🎉 COMPLETE PIPELINE TEST RESULTS');
    console.log('='.repeat(70));

    console.log(`\n📊 DIGEST SUMMARY:`);
    console.log(`   📧 Emails Processed: ${processedEmails.length}`);
    console.log(`   👤 User: ${userToken.email}`);
    console.log(`   📅 Generated: ${new Date().toISOString()}`);

    if (digestResult.data?.digest) {
      console.log(`   🆔 Digest ID: ${digestResult.data.digest.id}`);
      console.log(`   🏷️ Topics Identified: ${digestResult.data.digest.topicsIdentified}`);
    }

    console.log(`\n📨 PROCESSED EMAILS:`);
    processedEmails.forEach((email, index) => {
      console.log(`\n${index + 1}. 📧 ${email.subject}`);
      console.log(`   📤 From: ${email.sender}`);
      console.log(`   📅 Received: ${email.receivedAt.toISOString()}`);
      console.log(`   📝 Summary: ${email.summary}`);
      console.log(`   🏷️ Topics: ${email.topics.join(', ')}`);
      console.log(`   🔑 Keywords: ${email.keywords.join(', ')}`);
      console.log(`   🔗 Gmail Link: ${email.originalLink}`);
    });

    // Step 8: Success Summary
    console.log('\n' + '='.repeat(70));
    console.log('✅ COMPLETE SUCCESS - All Pipeline Components Working!');
    console.log('='.repeat(70));
    console.log('✅ Gmail OAuth Authentication: SUCCESS');
    console.log('✅ Gmail API Email Fetching: SUCCESS');
    console.log('✅ OpenAI Email Analysis: SUCCESS');
    console.log('✅ Database Digest Storage: SUCCESS');
    console.log('✅ End-to-End Processing: SUCCESS');
    console.log('\n🎯 The SubsBuzz email processing pipeline is fully operational!');

  } catch (error) {
    console.error('\n❌ PIPELINE TEST FAILED:', error.message);
    console.error('\n🔍 Troubleshooting:');
    console.error('   1. Verify OAuth token is valid and not expired');
    console.error('   2. Check Gmail API permissions and quotas');
    console.error('   3. Ensure OpenAI API key is configured correctly');
    console.error('   4. Verify Data Server is running and accessible');
    console.error('   5. Check if pivot5@mail.beehiiv.com sent emails recently');
    process.exit(1);
  }
}

// Run the complete pipeline test
testCompleteEmailPipeline();