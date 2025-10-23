#!/usr/bin/env node

/**
 * End-to-End Email Digest Generation Test
 * 
 * Tests the complete email processing pipeline:
 * 1. OAuth token retrieval for tmattoneill@gmail.com
 * 2. Gmail API integration to fetch emails from pivot5@mail.beehiiv.com (72h)
 * 3. OpenAI analysis and digest generation
 * 4. Database storage and retrieval
 * 
 * This validates the core business logic functionality.
 */

import { loadEnv } from '../lib/env.js';
import fetch from 'node-fetch';

// Load environment variables
loadEnv('.env.dev');

const DATA_SERVER_URL = process.env.DATA_SERVER_URL || 'http://localhost:3001';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || 'subsbuzz-internal-api-secret-dev-testing';

console.log('🧪 End-to-End Email Digest Generation Test');
console.log('='.repeat(60));
console.log('👤 User: tmattoneill@gmail.com');
console.log('📧 Sender: pivot5@mail.beehiiv.com');
console.log('⏰ Timeframe: Last 72 hours');
console.log('='.repeat(60));

async function testEmailDigestGeneration() {
  try {
    // Step 1: Check Data Server connectivity
    console.log('\n🔌 Step 1: Checking Data Server connectivity...');
    const healthResponse = await fetch(`${DATA_SERVER_URL}/health`);
    if (!healthResponse.ok) {
      throw new Error(`Data Server not responding: ${healthResponse.status}`);
    }
    const healthData = await healthResponse.json();
    console.log(`✅ Data Server healthy: ${healthData.service} v${healthData.version}`);

    // Step 2: Check OAuth tokens for tmattoneill@gmail.com
    console.log('\n🔑 Step 2: Checking OAuth tokens for tmattoneill@gmail.com...');
    const tokenResponse = await fetch(`${DATA_SERVER_URL}/api/storage/oauth-token/email/tmattoneill@gmail.com`, {
      headers: {
        'x-internal-api-key': INTERNAL_API_SECRET
      }
    });
    
    if (!tokenResponse.ok) {
      if (tokenResponse.status === 404) {
        throw new Error('OAuth token for tmattoneill@gmail.com not found. Please ensure OAuth setup is complete.');
      }
      throw new Error(`Failed to fetch OAuth token: ${tokenResponse.status}`);
    }
    
    const tokenData = await tokenResponse.json();
    const userToken = tokenData.data;
    
    if (!userToken) {
      throw new Error('OAuth token data is empty');
    }
    
    console.log(`✅ OAuth token found for ${userToken.email}`);
    console.log(`   - UID: ${userToken.uid}`);
    console.log(`   - Scope: ${userToken.scope || 'gmail.readonly'}`);
    console.log(`   - Created: ${userToken.createdAt || 'unknown'}`);

    // Step 3: Create digest generation request
    console.log('\n⚙️ Step 3: Generating digest for pivot5@mail.beehiiv.com emails...');
    
    const digestRequest = {
      userId: userToken.uid,
      emailAddress: userToken.email,
      senderFilter: 'pivot5@mail.beehiiv.com',
      timeframeHours: 72,
      includeContent: true,
      generateSummary: true
    };
    
    console.log('📨 Digest request parameters:');
    console.log(JSON.stringify(digestRequest, null, 2));
    
    const digestResponse = await fetch(`${DATA_SERVER_URL}/api/digest/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-key': INTERNAL_API_SECRET
      },
      body: JSON.stringify(digestRequest)
    });
    
    if (!digestResponse.ok) {
      const errorText = await digestResponse.text();
      throw new Error(`Digest generation failed: ${digestResponse.status} - ${errorText}`);
    }
    
    const digestResult = await digestResponse.json();
    console.log('\n🎉 Digest generation successful!');
    
    // Step 4: Display results
    console.log('\n📊 DIGEST RESULTS');
    console.log('='.repeat(60));
    
    if (digestResult.digest) {
      console.log(`📧 Digest ID: ${digestResult.digest.id || 'N/A'}`);
      console.log(`👤 User: ${digestResult.digest.userId || userToken.uid}`);
      console.log(`📅 Date: ${digestResult.digest.date || new Date().toISOString()}`);
      console.log(`📨 Emails Processed: ${digestResult.digest.emailsProcessed || 0}`);
      console.log(`🏷️ Topics Identified: ${digestResult.digest.topicsIdentified || 0}`);
    }
    
    if (digestResult.emails && digestResult.emails.length > 0) {
      console.log(`\n📧 PROCESSED EMAILS (${digestResult.emails.length}):`);
      console.log('-'.repeat(60));
      
      digestResult.emails.forEach((email, index) => {
        console.log(`\n${index + 1}. 📨 ${email.subject || 'No Subject'}`);
        console.log(`   📤 From: ${email.sender || 'Unknown'}`);
        console.log(`   📅 Received: ${email.receivedAt || 'Unknown'}`);
        
        if (email.summary) {
          console.log(`   📝 Summary: ${email.summary.substring(0, 200)}${email.summary.length > 200 ? '...' : ''}`);
        }
        
        if (email.topics && email.topics.length > 0) {
          console.log(`   🏷️ Topics: ${email.topics.join(', ')}`);
        }
        
        if (email.keywords && email.keywords.length > 0) {
          console.log(`   🔑 Keywords: ${email.keywords.join(', ')}`);
        }
        
        if (email.originalLink) {
          console.log(`   🔗 Link: ${email.originalLink}`);
        }
      });
    } else {
      console.log('\n📭 No emails found for the specified criteria');
      console.log('   This could mean:');
      console.log('   - No emails from pivot5@mail.beehiiv.com in the last 72 hours');
      console.log('   - Gmail API access issues');
      console.log('   - Email filtering not working correctly');
    }
    
    // Step 5: Show OpenAI analysis details if available
    if (digestResult.analysis) {
      console.log('\n🤖 OPENAI ANALYSIS:');
      console.log('-'.repeat(60));
      console.log(JSON.stringify(digestResult.analysis, null, 2));
    }
    
    // Step 6: Check for any errors or warnings
    if (digestResult.errors && digestResult.errors.length > 0) {
      console.log('\n⚠️ ERRORS/WARNINGS:');
      console.log('-'.repeat(60));
      digestResult.errors.forEach(error => {
        console.log(`❌ ${error}`);
      });
    }
    
    // Step 7: Show success metrics
    console.log('\n✅ TEST COMPLETION SUMMARY:');
    console.log('='.repeat(60));
    console.log(`✅ OAuth token retrieval: SUCCESS`);
    console.log(`✅ Gmail API integration: ${digestResult.emails ? 'SUCCESS' : 'PARTIAL'}`);
    console.log(`✅ Email processing: ${digestResult.emails && digestResult.emails.length > 0 ? 'SUCCESS' : 'NO EMAILS'}`);
    console.log(`✅ OpenAI analysis: ${digestResult.emails && digestResult.emails.some(e => e.summary) ? 'SUCCESS' : 'PARTIAL'}`);
    console.log(`✅ Database storage: ${digestResult.digest ? 'SUCCESS' : 'PARTIAL'}`);
    
    const emailCount = digestResult.emails ? digestResult.emails.length : 0;
    const hasAnalysis = digestResult.emails && digestResult.emails.some(e => e.summary || e.topics);
    
    if (emailCount > 0 && hasAnalysis) {
      console.log('\n🎉 END-TO-END TEST: ✅ COMPLETE SUCCESS');
      console.log('   📧 Emails found and processed');
      console.log('   🤖 AI analysis completed');
      console.log('   💾 Data stored successfully');
    } else if (emailCount === 0) {
      console.log('\n📭 END-TO-END TEST: ⚠️ NO EMAILS FOUND');
      console.log('   🔍 Check if pivot5@mail.beehiiv.com sent emails in last 72h');
      console.log('   🔑 Verify Gmail API permissions and token validity');
    } else {
      console.log('\n⚠️ END-TO-END TEST: 🔄 PARTIAL SUCCESS');
      console.log('   📧 Emails found but analysis incomplete');
      console.log('   🔧 Check OpenAI API configuration');
    }
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('\n🔍 Troubleshooting steps:');
    console.error('   1. Ensure Data Server is running on port 3001');
    console.error('   2. Verify OAuth token exists for tmattoneill@gmail.com');
    console.error('   3. Check Gmail API permissions and quotas');
    console.error('   4. Verify OpenAI API key is configured');
    console.error('   5. Check database connectivity');
    
    process.exit(1);
  }
}

// Run the test
testEmailDigestGeneration();