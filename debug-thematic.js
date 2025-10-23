// Load environment variables first
import dotenv from 'dotenv';
dotenv.config({ path: '.env.dev' });

import { storage } from './server/storage.ts';

const userId = 'fa91fdc214719bd4aa0d5368501b0ff633f7276e5b5dc01a8fa29a6e16dcf52d';

async function debugThematicDigests() {
  try {
    console.log('=== Checking Thematic Digests ===');
    const thematicDigests = await storage.getThematicDigests(userId);
    console.log(`Found ${thematicDigests.length} thematic digests`);
    
    thematicDigests.forEach(digest => {
      const dateStr = new Date(digest.date).toISOString().split('T')[0];
      console.log(`- Thematic: ${dateStr}: ID ${digest.id}`);
    });
    
    const testDates = ['2025-07-01', '2025-07-02', '2025-07-03', '2025-07-04', '2025-06-28', '2025-06-29'];
    
    console.log('\n=== Testing Each Date (like the API does) ===');
    for (const date of testDates) {
      console.log(`\n--- Testing ${date} ---`);
      
      // Check thematic first (exactly like the API)
      const targetDate = new Date(date);
      const hasThematic = await storage.hasThematicDigestForDate(userId, targetDate);
      console.log(`Has thematic digest: ${hasThematic}`);
      
      if (hasThematic) {
        const thematicDigests = await storage.getThematicDigests(userId);
        const thematicDigest = thematicDigests.find((digest) => {
          const digestDateStr = new Date(digest.date).toISOString().split('T')[0];
          return digestDateStr === date;
        });
        
        if (thematicDigest) {
          console.log(`✅ Would return thematic digest ID ${thematicDigest.id}`);
          const fullThematicDigest = await storage.getThematicDigest(userId, thematicDigest.id);
          if (fullThematicDigest) {
            console.log(`   Sections: ${fullThematicDigest.sections?.length || 0}`);
          } else {
            console.log(`❌ Failed to get full thematic digest`);
          }
        } else {
          console.log(`❌ Thematic digest not found in array`);
        }
      } else {
        // Fall back to regular digest
        const digest = await storage.getDigestByDate(userId, date);
        if (digest) {
          const emails = await storage.getDigestEmails(digest.id);
          console.log(`✅ Would return regular digest ID ${digest.id} with ${emails.length} emails`);
        } else {
          console.log(`❌ No regular digest found either`);
        }
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

debugThematicDigests();