// Load environment variables first
import dotenv from 'dotenv';
dotenv.config({ path: '.env.dev' });

import { storage } from './server/storage.ts';

const userId = 'fa91fdc214719bd4aa0d5368501b0ff633f7276e5b5dc01a8fa29a6e16dcf52d';

async function dumpData() {
  try {
    console.log('USER: tmattoneill@gmail.com');
    console.log('USER ID:', userId);
    console.log('\n' + '='.repeat(80));
    
    // July 3rd, 2025
    console.log('\nJULY 3, 2025 DATA:');
    console.log('-'.repeat(50));
    
    const july3Digest = await storage.getDigestByDate(userId, '2025-07-03');
    if (july3Digest) {
      console.log('EMAIL_DIGEST TABLE:');
      console.log(`  ID: ${july3Digest.id}`);
      console.log(`  User ID: ${july3Digest.userId}`);
      console.log(`  Date: ${july3Digest.date}`);
      console.log(`  Summary: ${july3Digest.summary ? july3Digest.summary.substring(0, 100) + '...' : 'NULL'}`);
      console.log(`  Emails Processed: ${july3Digest.emailsProcessed}`);
      console.log(`  Topics Identified: ${july3Digest.topicsIdentified}`);
      
      const july3Emails = await storage.getDigestEmails(july3Digest.id);
      console.log(`\nDIGEST_EMAILS TABLE (${july3Emails.length} records):`);
      july3Emails.forEach((email, i) => {
        console.log(`  Email ${i+1}:`);
        console.log(`    ID: ${email.id}`);
        console.log(`    Digest ID: ${email.digestId}`);
        console.log(`    Sender: ${email.sender}`);
        console.log(`    Subject: ${email.subject}`);
        console.log(`    Received At: ${email.receivedAt}`);
        console.log(`    Topics: [${email.topics.join(', ')}]`);
        console.log(`    Summary: ${email.summary.substring(0, 80)}...`);
        console.log('');
      });
    } else {
      console.log('NO EMAIL DIGEST FOUND');
    }
    
    // Check for thematic digest
    const july3Thematic = await storage.hasThematicDigestForDate(userId, new Date('2025-07-03'));
    console.log(`THEMATIC DIGEST EXISTS: ${july3Thematic}`);
    
    console.log('\n' + '='.repeat(80));
    
    // July 4th, 2025
    console.log('\nJULY 4, 2025 DATA:');
    console.log('-'.repeat(50));
    
    const july4Digest = await storage.getDigestByDate(userId, '2025-07-04');
    if (july4Digest) {
      console.log('EMAIL_DIGEST TABLE:');
      console.log(`  ID: ${july4Digest.id}`);
      console.log(`  User ID: ${july4Digest.userId}`);
      console.log(`  Date: ${july4Digest.date}`);
      console.log(`  Summary: ${july4Digest.summary ? july4Digest.summary.substring(0, 100) + '...' : 'NULL'}`);
      console.log(`  Emails Processed: ${july4Digest.emailsProcessed}`);
      console.log(`  Topics Identified: ${july4Digest.topicsIdentified}`);
      
      const july4Emails = await storage.getDigestEmails(july4Digest.id);
      console.log(`\nDIGEST_EMAILS TABLE (${july4Emails.length} records):`);
      july4Emails.forEach((email, i) => {
        console.log(`  Email ${i+1}:`);
        console.log(`    ID: ${email.id}`);
        console.log(`    Digest ID: ${email.digestId}`);
        console.log(`    Sender: ${email.sender}`);
        console.log(`    Subject: ${email.subject}`);
        console.log(`    Received At: ${email.receivedAt}`);
        console.log(`    Topics: [${email.topics.join(', ')}]`);
        console.log(`    Summary: ${email.summary.substring(0, 80)}...`);
        console.log('');
      });
    } else {
      console.log('NO EMAIL DIGEST FOUND');
    }
    
    // Check for thematic digest
    const july4Thematic = await storage.hasThematicDigestForDate(userId, new Date('2025-07-04'));
    console.log(`THEMATIC DIGEST EXISTS: ${july4Thematic}`);
    
    if (july4Thematic) {
      const thematicDigests = await storage.getThematicDigests(userId);
      const july4ThematicDigest = thematicDigests.find(d => {
        const dateStr = new Date(d.date).toISOString().split('T')[0];
        return dateStr === '2025-07-04';
      });
      
      if (july4ThematicDigest) {
        console.log('\nTHEMATIC_DIGEST TABLE:');
        console.log(`  ID: ${july4ThematicDigest.id}`);
        console.log(`  User ID: ${july4ThematicDigest.userId}`);
        console.log(`  Date: ${july4ThematicDigest.date}`);
        console.log(`  Summary: ${july4ThematicDigest.summary.substring(0, 100)}...`);
        console.log(`  Total Source Emails: ${july4ThematicDigest.totalSourceEmails}`);
        console.log(`  Sections Count: ${july4ThematicDigest.sectionsCount}`);
        
        const fullThematic = await storage.getThematicDigest(userId, july4ThematicDigest.id);
        if (fullThematic && fullThematic.sections) {
          console.log(`\nTHEMATIC_SECTIONS TABLE (${fullThematic.sections.length} sections):`);
          fullThematic.sections.forEach((section, i) => {
            console.log(`  Section ${i+1}:`);
            console.log(`    ID: ${section.id}`);
            console.log(`    Theme: ${section.theme}`);
            console.log(`    Summary: ${section.summary.substring(0, 80)}...`);
            console.log(`    Source Emails: ${section.sourceEmails?.length || 0}`);
            console.log('');
          });
        }
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

dumpData();