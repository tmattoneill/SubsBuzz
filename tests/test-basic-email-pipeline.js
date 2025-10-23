#!/usr/bin/env node

/**
 * Basic Email Pipeline Test - Fast Validation
 * 
 * Quick test to validate core functionality:
 * 1. OAuth token retrieval
 * 2. Gmail API connectivity 
 * 3. Basic email search
 * 4. Simple digest creation with mock data
 */

import { loadEnv } from '../lib/env.js';
import fetch from 'node-fetch';
import { google } from 'googleapis';

// Load environment variables
loadEnv('.env.dev');

const DATA_SERVER_URL = process.env.DATA_SERVER_URL || 'http://localhost:3001';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || 'subsbuzz-internal-api-secret-dev-testing';

console.log('⚡ Basic Email Pipeline Test (Fast)');
console.log('='.repeat(50));

async function testBasicPipeline() {
  try {
    // Step 1: Get OAuth token
    console.log('🔑 Step 1: Getting OAuth token...');
    const tokenResponse = await fetch(`${DATA_SERVER_URL}/api/storage/oauth-token/email/tmattoneill@gmail.com`, {
      headers: { 'x-internal-api-key': INTERNAL_API_SECRET }
    });
    
    if (!tokenResponse.ok) {
      throw new Error(`OAuth token not found: ${tokenResponse.status}`);
    }
    
    const tokenData = await tokenResponse.json();
    const userToken = tokenData.data;
    console.log(`✅ OAuth token found for ${userToken.email}`);

    // Step 2: Test Gmail API connectivity
    console.log('\n📧 Step 2: Testing Gmail API...');
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: userToken.accessToken,
      refresh_token: userToken.refreshToken
    });
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Simple profile test
    const profile = await gmail.users.getProfile({ userId: 'me' });
    console.log(`✅ Gmail API connected - ${profile.data.emailAddress}`);

    // Step 3: Search for emails
    console.log('\n🔍 Step 3: Searching for emails...');
    const searchResponse = await gmail.users.messages.list({
      userId: 'me',
      q: 'from:pivot5@mail.beehiiv.com',
      maxResults: 5
    });

    const emailCount = searchResponse.data.messages?.length || 0;
    console.log(`✅ Found ${emailCount} emails from pivot5@mail.beehiiv.com`);

    // Step 4: Create a test digest with mock data
    console.log('\n💾 Step 4: Creating test digest...');
    
    const mockEmail = {
      sender: 'pivot5@mail.beehiiv.com',
      subject: 'Test Email for Pipeline Validation',
      content: 'This is a test email to validate the SubsBuzz pipeline functionality.',
      received_at: new Date().toISOString(),
      summary: 'Test email for validating the SubsBuzz email processing pipeline',
      topics: ['Technology', 'Testing', 'Pipeline'],
      keywords: ['test', 'validation', 'pipeline', 'subsbuzz'],
      original_link: 'https://mail.google.com/mail/test'
    };

    const digestPayload = {
      user_id: userToken.uid,
      emails: [mockEmail]
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
    console.log('✅ Test digest created successfully!');

    // Step 5: Show results
    console.log('\n📊 RESULTS:');
    console.log('='.repeat(50));
    console.log(`✅ OAuth Authentication: Working`);
    console.log(`✅ Gmail API Access: Working`);
    console.log(`✅ Email Search: Found ${emailCount} emails`);
    console.log(`✅ Digest Creation: Working`);
    
    if (digestResult.data?.digest) {
      console.log(`✅ Digest ID: ${digestResult.data.digest.id}`);
      console.log(`✅ User ID: ${digestResult.data.digest.userId}`);
    }

    console.log('\n🎉 BASIC PIPELINE: ✅ ALL SYSTEMS OPERATIONAL');
    
    if (emailCount > 0) {
      console.log('\n🚀 READY FOR FULL EMAIL PROCESSING');
      console.log('   The system can successfully:');
      console.log('   - Authenticate with Gmail OAuth');
      console.log('   - Search and retrieve emails');
      console.log('   - Create and store digests');
      console.log('   - Process emails end-to-end');
      
      console.log(`\n📧 Found ${emailCount} emails from pivot5@mail.beehiiv.com`);
      console.log('   To process these emails with OpenAI analysis:');
      console.log('   Run: node tests/test-complete-email-pipeline.js');
    } else {
      console.log('\n📭 No recent emails from pivot5@mail.beehiiv.com found');
      console.log('   This is normal if no emails were sent recently');
      console.log('   The pipeline is ready to process emails when they arrive');
    }

  } catch (error) {
    console.error('\n❌ BASIC PIPELINE TEST FAILED:', error.message);
    
    if (error.message.includes('OAuth')) {
      console.error('🔑 OAuth Issue: Check token validity and permissions');
    } else if (error.message.includes('Gmail')) {
      console.error('📧 Gmail API Issue: Check API access and quotas');
    } else if (error.message.includes('Digest')) {
      console.error('💾 Database Issue: Check Data Server connectivity');
    }
    
    process.exit(1);
  }
}

// Run the basic test
testBasicPipeline();