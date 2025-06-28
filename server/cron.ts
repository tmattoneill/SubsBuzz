import cron from 'node-cron';
import { storage } from './storage';
import { fetchEmails } from './gmail';
import { generateDigest } from './openai';

export function setupCronJobs() {
  // Schedule daily digest generation at 7:00 AM
  cron.schedule('0 7 * * *', async () => {
    console.log('Running scheduled digest generation...');
    
    try {
      // Check if daily digest is enabled
      const settings = await storage.getUserSettings();
      if (!settings.dailyDigestEnabled) {
        console.log('Daily digest generation is disabled. Skipping...');
        return;
      }
      
      // Get monitored emails
      const monitoredEmails = await storage.getMonitoredEmails();
      if (monitoredEmails.length === 0) {
        console.log('No monitored email addresses configured. Skipping digest generation.');
        return;
      }
      
      // Only get active monitored emails
      const activeEmails = monitoredEmails
        .filter(email => email.active)
        .map(email => email.email);
      
      if (activeEmails.length === 0) {
        console.log('No active monitored email addresses. Skipping digest generation.');
        return;
      }
      
      // Fetch emails from monitored sources
      console.log(`Fetching emails from ${activeEmails.length} sources...`);
      const emails = await fetchEmails(activeEmails);
      
      if (emails.length === 0) {
        console.log('No new emails found. Skipping digest generation.');
        return;
      }
      
      // Generate digest
      console.log(`Generating digest from ${emails.length} emails...`);
      const digest = await generateDigest(emails);
      
      console.log(`Digest generation complete. Processed ${digest.emailsProcessed} emails with ${digest.topicsIdentified} topics.`);
      
      // If email notifications are enabled, we would send a notification here
      if (settings.emailNotificationsEnabled) {
        console.log('Email notifications are enabled. Sending notification...');
        // This would be implemented in a real application
        // sendEmailNotification(digest);
      }
    } catch (error) {
      console.error('Error in scheduled digest generation:', error);
    }
  });
}
