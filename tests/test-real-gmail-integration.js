#!/usr/bin/env node

/**
 * Real Gmail Integration Test
 * 
 * This test will:
 * 1. Help re-authenticate Gmail OAuth if needed
 * 2. Fetch REAL emails from tmattoneill@gmail.com
 * 3. Process them through the complete pipeline
 * 4. Show actual results from pivot5@mail.beehiiv.com
 */

import { loadEnv } from '../lib/env.js';
import fetch from 'node-fetch';
import { google } from 'googleapis';
import readline from 'readline';

// Load environment variables
loadEnv('.env.dev');

const DATA_SERVER_URL = process.env.DATA_SERVER_URL || 'http://localhost:3001';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || 'subsbuzz-internal-api-secret-dev-testing';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

console.log('🔑 Real Gmail Integration Test');
console.log('='.repeat(50));
console.log('👤 User: tmattoneill@gmail.com');
console.log('📧 Target: pivot5@mail.beehiiv.com emails');
console.log('🎯 Goal: End-to-end REAL email processing');
console.log('='.repeat(50));

async function getUserInput(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function refreshOAuthToken(refreshToken) {
  console.log('\n🔄 Attempting to refresh OAuth token...');
  
  try {
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      'http://localhost:8000/auth/callback'
    );
    
    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });
    
    const { credentials } = await oauth2Client.refreshAccessToken();
    console.log('✅ OAuth token refreshed successfully');
    
    return {
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token || refreshToken,
      expiresAt: new Date(credentials.expiry_date).toISOString()
    };
  } catch (error) {
    console.error('❌ Token refresh failed:', error.message);
    return null;
  }
}

async function getNewOAuthToken() {
  console.log('\n🚀 Setting up new OAuth flow...');
  console.log('This will open a browser window for Gmail authentication.');
  
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    process.env.OAUTH_REDIRECT_URI || 'http://127.0.0.1:5500/auth/callback'
  );
  
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
    prompt: 'consent'
  });
  
  console.log('\n🌐 Open this URL in your browser:');
  console.log(authUrl);
  console.log('\n📋 After authorizing, copy the authorization code.');
  
  const code = await getUserInput('Enter the authorization code: ');
  
  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log('✅ New OAuth tokens obtained successfully');
    
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(tokens.expiry_date).toISOString()
    };
  } catch (error) {
    console.error('❌ Failed to exchange code for tokens:', error.message);
    return null;
  }
}

async function testRealGmailIntegration() {
  try {
    // Step 1: Check current OAuth token
    console.log('\n🔑 Step 1: Checking current OAuth token...');
    
    let tokenResponse = await fetch(`${DATA_SERVER_URL}/api/storage/oauth-token/email/tmattoneill@gmail.com`, {
      headers: { 'x-internal-api-key': INTERNAL_API_SECRET }
    });
    
    let userToken = null;
    let needsNewAuth = false;
    
    if (tokenResponse.ok) {
      const tokenData = await tokenResponse.json();
      userToken = tokenData.data;
      
      const expiresAt = new Date(userToken.expiresAt);
      const now = new Date();
      
      console.log(`📅 Token expires: ${expiresAt.toISOString()}`);
      console.log(`📅 Current time: ${now.toISOString()}`);
      
      if (expiresAt < now) {
        console.log('⚠️ Token is expired, attempting refresh...');
        
        const refreshedToken = await refreshOAuthToken(userToken.refreshToken);
        if (refreshedToken) {
          // Update token in database
          const updateResponse = await fetch(`${DATA_SERVER_URL}/api/storage/oauth-token/${userToken.uid}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-api-key': INTERNAL_API_SECRET
            },
            body: JSON.stringify({
              accessToken: refreshedToken.accessToken,
              refreshToken: refreshedToken.refreshToken,
              expiresAt: refreshedToken.expiresAt
            })
          });
          
          if (updateResponse.ok) {
            console.log('✅ Token updated in database');
            userToken.accessToken = refreshedToken.accessToken;
            userToken.refreshToken = refreshedToken.refreshToken;
            userToken.expiresAt = refreshedToken.expiresAt;
          } else {
            console.log('⚠️ Failed to update token in database');
            needsNewAuth = true;
          }
        } else {
          needsNewAuth = true;
        }
      } else {
        console.log('✅ Token is still valid');
      }
    } else {
      console.log('❌ No OAuth token found for tmattoneill@gmail.com');
      needsNewAuth = true;
    }
    
    // Step 2: Get new authentication if needed
    if (needsNewAuth) {
      console.log('\n🔐 Step 2: Getting new OAuth authentication...');
      
      const newTokens = await getNewOAuthToken();
      if (!newTokens) {
        throw new Error('Failed to get new OAuth tokens');
      }
      
      // Store new token in database
      const storeResponse = await fetch(`${DATA_SERVER_URL}/api/storage/oauth-tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api-key': INTERNAL_API_SECRET
        },
        body: JSON.stringify({
          uid: '108916677826866981071', // tmattoneill@gmail.com UID
          email: 'tmattoneill@gmail.com',
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken,
          expiresAt: newTokens.expiresAt,
          scope: 'https://www.googleapis.com/auth/gmail.readonly'
        })
      });
      
      if (!storeResponse.ok) {
        const errorText = await storeResponse.text();
        throw new Error(`Failed to store new token: ${storeResponse.status} - ${errorText}`);
      }
      
      userToken = {
        uid: '108916677826866981071',
        email: 'tmattoneill@gmail.com',
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        expiresAt: newTokens.expiresAt
      };
      
      console.log('✅ New OAuth token stored successfully');
    }
    
    // Step 3: Test Gmail API connection
    console.log('\n📧 Step 3: Testing Gmail API connection...');
    
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: userToken.accessToken,
      refresh_token: userToken.refreshToken
    });
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Test connection
    const profile = await gmail.users.getProfile({ userId: 'me' });
    console.log(`✅ Connected to Gmail: ${profile.data.emailAddress}`);
    console.log(`📊 Total messages: ${profile.data.messagesTotal}`);
    
    // Step 4: Search for real emails from pivot5@mail.beehiiv.com
    console.log('\n🔍 Step 4: Searching for real emails from pivot5@mail.beehiiv.com...');
    
    const searchResponse = await gmail.users.messages.list({
      userId: 'me',
      q: 'from:pivot5@mail.beehiiv.com',
      maxResults: 10
    });
    
    const messages = searchResponse.data.messages || [];
    console.log(`📨 Found ${messages.length} emails from pivot5@mail.beehiiv.com`);
    
    if (messages.length === 0) {
      console.log('\n📭 No emails found from pivot5@mail.beehiiv.com');
      console.log('   Searching for any recent emails to test with...');
      
      const recentResponse = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 5
      });
      
      const recentMessages = recentResponse.data.messages || [];
      console.log(`📨 Found ${recentMessages.length} recent emails total`);
      
      if (recentMessages.length === 0) {
        throw new Error('No emails found in Gmail account');
      }
      
      // Use recent emails for testing
      messages.push(...recentMessages.slice(0, 2));
      console.log(`🔄 Using ${messages.length} recent emails for testing`);
    }
    
    // Step 5: Process real emails
    console.log(`\n⚙️ Step 5: Processing ${Math.min(messages.length, 3)} real emails...`);
    
    const processedEmails = [];
    
    for (let i = 0; i < Math.min(messages.length, 3); i++) {
      const message = messages[i];
      console.log(`   📥 Processing email ${i + 1}/${Math.min(messages.length, 3)}...`);
      
      try {
        const fullMessage = await gmail.users.messages.get({
          userId: 'me',
          id: message.id
        });
        
        const headers = fullMessage.data.payload.headers;
        const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
        const from = headers.find(h => h.name === 'From')?.value || 'Unknown Sender';
        const date = headers.find(h => h.name === 'Date')?.value || new Date().toISOString();
        
        // Extract content
        let content = '';
        const extractContent = (part) => {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            return Buffer.from(part.body.data, 'base64').toString('utf-8');
          } else if (part.mimeType === 'text/html' && part.body?.data) {
            const html = Buffer.from(part.body.data, 'base64').toString('utf-8');
            return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          } else if (part.parts) {
            return part.parts.map(extractContent).join('\n').trim();
          }
          return '';
        };
        
        content = extractContent(fullMessage.data.payload);
        
        const email = {
          sender: from,
          subject: subject,
          content: content.substring(0, 2000), // Limit content for processing
          received_at: new Date(date).toISOString(),
          original_link: `https://mail.google.com/mail/u/0/#inbox/${message.id}`
        };
        
        processedEmails.push(email);
        console.log(`   ✅ "${subject.substring(0, 50)}..." from ${from.substring(0, 30)}...`);
        
      } catch (emailError) {
        console.warn(`   ⚠️ Failed to process email ${i + 1}: ${emailError.message}`);
      }
    }
    
    if (processedEmails.length === 0) {
      throw new Error('No emails could be processed');
    }
    
    // Step 6: Create digest with real emails
    console.log(`\n💾 Step 6: Creating digest with ${processedEmails.length} real emails...`);
    
    const digestPayload = {
      user_id: userToken.uid,
      emails: processedEmails
    };
    
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
    console.log('✅ Real email digest created successfully!');
    
    // Step 7: Show results
    console.log('\n' + '='.repeat(60));
    console.log('🎉 REAL GMAIL INTEGRATION RESULTS');
    console.log('='.repeat(60));
    
    console.log(`\n📊 DIGEST SUMMARY:`);
    if (digestResult.data?.digest) {
      console.log(`   🆔 Digest ID: ${digestResult.data.digest.id}`);
      console.log(`   👤 User: tmattoneill@gmail.com`);
      console.log(`   📧 Real Emails Processed: ${digestResult.data.digest.emailsProcessed}`);
      console.log(`   🏷️ Topics Identified: ${digestResult.data.digest.topicsIdentified}`);
    }
    
    if (digestResult.data?.emails) {
      console.log(`\n📨 REAL EMAILS PROCESSED:`);
      digestResult.data.emails.forEach((email, index) => {
        console.log(`\n${index + 1}. 📧 ${email.subject}`);
        console.log(`   📤 From: ${email.sender}`);
        console.log(`   📅 Received: ${email.receivedAt}`);
        
        if (email.summary) {
          console.log(`   📝 AI Summary: ${email.summary.substring(0, 150)}...`);
        }
        
        if (email.topics?.length > 0) {
          console.log(`   🏷️ Topics: ${email.topics.join(', ')}`);
        }
        
        if (email.keywords?.length > 0) {
          console.log(`   🔑 Keywords: ${email.keywords.slice(0, 6).join(', ')}`);
        }
      });
    }
    
    console.log('\n✅ REAL END-TO-END TEST: COMPLETE SUCCESS!');
    console.log('🎯 Your actual Gmail emails have been processed through the full SubsBuzz pipeline');
    
  } catch (error) {
    console.error('\n❌ REAL GMAIL TEST FAILED:', error.message);
    console.error('\nThis indicates the OAuth/Gmail integration needs attention.');
    process.exit(1);
  }
}

// Run the real Gmail integration test
testRealGmailIntegration();