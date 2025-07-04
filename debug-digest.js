// Load environment variables first
import dotenv from 'dotenv';
dotenv.config({ path: '.env.dev' });

import { storage } from './server/storage.js';

const userId = 'fa91fdc214719bd4aa0d5368501b0ff633f7276e5b5dc01a8fa29a6e16dcf52d';

async function debugDigests() {
  try {
    console.log('=== All Digests for User ===');
    const allDigests = await storage.getEmailDigests(userId);
    console.log(`Found ${allDigests.length} total digests`);
    
    allDigests.forEach(digest => {
      const dateStr = new Date(digest.date).toISOString().split('T')[0];
      console.log(`- ${dateStr}: ID ${digest.id}, Date: ${digest.date}`);
    });
    
    console.log('\n=== Testing July 3rd Lookup ===');
    const july3 = await storage.getDigestByDate(userId, '2025-07-03');
    if (july3) {
      console.log('✅ July 3rd found via getDigestByDate');
      console.log('ID:', july3.id);
      console.log('Date:', july3.date);
      const emails = await storage.getDigestEmails(july3.id);
      console.log('Emails:', emails.length);
    } else {
      console.log('❌ July 3rd NOT found via getDigestByDate');
    }
    
    console.log('\n=== Testing July 4th Lookup ===');
    const july4 = await storage.getDigestByDate(userId, '2025-07-04');
    if (july4) {
      console.log('✅ July 4th found via getDigestByDate');
      console.log('ID:', july4.id);
      console.log('Date:', july4.date);
      const emails = await storage.getDigestEmails(july4.id);
      console.log('Emails:', emails.length);
    } else {
      console.log('❌ July 4th NOT found via getDigestByDate');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

debugDigests();