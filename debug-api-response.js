// Load environment variables first
import dotenv from 'dotenv';
dotenv.config({ path: '.env.dev' });

import { storage } from './server/storage.ts';

const userId = 'fa91fdc214719bd4aa0d5368501b0ff633f7276e5b5dc01a8fa29a6e16dcf52d';

async function debugApiResponse() {
  try {
    // Test July 3rd (failing) vs July 4th (working)
    const testDates = ['2025-07-03', '2025-07-04'];
    
    for (const date of testDates) {
      console.log(`\n=== API Response Simulation for ${date} ===`);
      
      // Simulate the exact logic from routes.ts
      const targetDate = new Date(date);
      const hasThematic = await storage.hasThematicDigestForDate(userId, targetDate);
      
      if (hasThematic) {
        console.log(`${date}: Returns THEMATIC digest`);
        const thematicDigests = await storage.getThematicDigests(userId);
        const thematicDigest = thematicDigests.find((digest) => {
          const digestDateStr = new Date(digest.date).toISOString().split('T')[0];
          return digestDateStr === date;
        });
        
        if (thematicDigest) {
          const fullThematicDigest = await storage.getThematicDigest(userId, thematicDigest.id);
          console.log(`   Thematic digest sections: ${fullThematicDigest?.sections?.length || 0}`);
        }
      } else {
        console.log(`${date}: Returns REGULAR digest`);
        const digest = await storage.getDigestByDate(userId, date);
        
        if (digest) {
          const emails = await storage.getDigestEmails(digest.id);
          console.log(`   Regular digest emails: ${emails.length}`);
          
          // This is the exact response structure from the API
          const apiResponse = {
            ...digest,
            type: 'regular',
            emails: emails.map(email => ({
              ...email,
              receivedAt: email.receivedAt instanceof Date ? email.receivedAt.toISOString() : email.receivedAt
            }))
          };
          
          console.log(`   API Response structure:`);
          console.log(`     - id: ${apiResponse.id}`);
          console.log(`     - type: ${apiResponse.type}`);
          console.log(`     - emails.length: ${apiResponse.emails.length}`);
          if (apiResponse.emails.length > 0) {
            const firstEmail = apiResponse.emails[0];
            console.log(`     - first email structure:`);
            console.log(`       - id: ${firstEmail.id}`);
            console.log(`       - sender: ${firstEmail.sender}`);
            console.log(`       - subject: "${firstEmail.subject}"`);
            console.log(`       - receivedAt: ${firstEmail.receivedAt}`);
            console.log(`       - topics: [${firstEmail.topics?.join(', ')}]`);
            console.log(`       - summary length: ${firstEmail.summary?.length || 0}`);
          }
        } else {
          console.log(`   No digest found!`);
        }
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

debugApiResponse();