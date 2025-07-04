import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import { generateDigest, getLatestDigest, getLatestThematicDigest } from "./openai";
import { fetchEmails, scanForNewsletters } from "./gmail";
import { setupCronJobs } from "./cron";
import { verifyToken, mockGmailAccess, exchangeTokenForGmail } from "./auth";
import { getAuth } from "firebase-admin/auth";
import { google } from "googleapis";
import { getUserId } from "./storage";

// Import OAuth credentials from auth module
import { OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REDIRECT_URI } from './auth';

// Middleware to get userId from session
function requireAuth(req: any, res: any, next: any) {
  const session = req.session;
  console.log('requireAuth - session:', session?.id, 'user:', session?.user?.email);
  if (!session || !session.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  req.userId = getUserId(session.user.email);
  console.log('requireAuth - userId:', req.userId);
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth Routes
  app.post('/api/auth/verify-token', async (req: Request, res: Response) => {
    try {
      // Check if user has a valid session
      const session = (req as any).session;
      console.log('Session check - ID:', session?.id, 'User:', session?.user?.email);
      
      if (session && session.user) {
        return res.status(200).json({
          user: session.user
        });
      }
      
      return res.status(401).json({ message: 'Not authenticated' });
    } catch (error: any) {
      console.error('Error verifying token:', error);
      return res.status(401).json({ message: 'Invalid token' });
    }
  });
  
  app.post('/api/auth/logout', async (req: Request, res: Response) => {
    try {
      // Clear the session
      (req as any).session.destroy((err: any) => {
        if (err) {
          console.error('Error destroying session:', err);
          return res.status(500).json({ message: 'Failed to logout' });
        }
        res.clearCookie('sessionId'); // Clear session cookie
        return res.status(200).json({ message: 'Logged out successfully' });
      });
    } catch (error: any) {
      console.error('Error logging out:', error);
      return res.status(500).json({ message: 'Failed to logout' });
    }
  });
  
  app.post('/api/auth/gmail-access', async (req: Request, res: Response) => {
    try {
      const { idToken } = req.body;
      
      if (!idToken) {
        return res.status(400).json({ message: 'ID token is required' });
      }
      
      // Create OAuth client for Gmail with the configured credentials
      const oauth2Client = new google.auth.OAuth2(
        OAUTH_CLIENT_ID,
        OAUTH_CLIENT_SECRET,
        OAUTH_REDIRECT_URI
      );
      
      // Generate a URL to request access to Gmail
      const scopes = [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
      ];
      
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent',
        // Use idToken as state to associate this request with the user
        state: idToken
      });
      
      console.log(`Generated Gmail OAuth URL: ${authUrl}`);
      
      // Return the auth URL for the frontend to redirect to
      return res.status(200).json({ authUrl });
    } catch (error: any) {
      console.error('Error setting up Gmail access:', error);
      return res.status(500).json({ message: `Failed to setup Gmail access: ${error.message}` });
    }
  });
  
  // Handle OAuth callback on /auth/callback path
  app.get('/auth/callback', async (req: Request, res: Response) => {
    console.log("OAuth callback received at /auth/callback:", req.query);
    
    try {
      const { code, state } = req.query;
      
      if (!code || typeof code !== 'string') {
        return res.redirect('/?error=No authorization code received');
      }
      
      console.log(`Processing OAuth code for state: ${state}`);
      
      // Create OAuth client for Gmail with the configured credentials
      const oauth2Client = new google.auth.OAuth2(
        OAUTH_CLIENT_ID,
        OAUTH_CLIENT_SECRET,
        OAUTH_REDIRECT_URI
      );
      
      console.log('Exchanging authorization code for tokens...');
      
      // Exchange authorization code for tokens
      const { tokens } = await oauth2Client.getToken(code);
      console.log('Received tokens from Google');
      
      // Set the credentials on the auth client
      oauth2Client.setCredentials(tokens);
      
      // Get user info to extract email and uid
      const oauth2 = google.oauth2({
        auth: oauth2Client,
        version: 'v2'
      });
      
      const userInfo = await oauth2.userinfo.get();
      const email = userInfo.data.email;
      const uid = userInfo.data.id;
      
      if (!email || !uid) {
        throw new Error('Failed to get user email or ID from Google');
      }
      
      console.log(`Got user info: ${email}, uid: ${uid}`);
      
      // Store the OAuth tokens in the database
      const userId = getUserId(email);
      const tokenData = {
        uid: uid,
        email: email,
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token || null,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null
      };
      
      await storage.storeOAuthToken(tokenData);
      console.log('OAuth tokens stored successfully');
      
      // New users start with no monitored emails - they must add their own
      
      // Store user session
      (req as any).session.user = {
        uid: uid,
        email: email,
        displayName: userInfo.data.name,
        photoURL: userInfo.data.picture
      };
      
      console.log('Storing user in session:', email);
      
      // Save session before redirect
      (req as any).session.save((err: any) => {
        if (err) {
          console.error('Session save error:', err);
          return res.redirect(`/?error=${encodeURIComponent('Session save failed')}`);
        }
        console.log('Session saved successfully');
        // Redirect back to the app with success
        return res.redirect('/?connected=gmail');
      });
    } catch (error: any) {
      console.error('Error in OAuth callback:', error);
      return res.redirect(`/?error=${encodeURIComponent('Failed to authenticate with Gmail: ' + error.message)}`);
    }
  });
  
  // Handle OAuth callback on root path
  app.get('/', async (req: Request, res: Response, next: NextFunction) => {
    // Check if this is an OAuth callback
    if (req.query.code && req.query.state) {
      console.log("OAuth callback received at root path:", req.query);
      
      try {
        const { code, state } = req.query;
        
        if (!code || typeof code !== 'string') {
          return res.redirect('/?error=No authorization code received');
        }
        
        console.log(`Processing OAuth code for state: ${state}`);
        
        // Create OAuth client
        const oauth2Client = new google.auth.OAuth2(
          OAUTH_CLIENT_ID,
          OAUTH_CLIENT_SECRET,
          OAUTH_REDIRECT_URI
        );
        
        // Exchange code for tokens
        console.log('Exchanging code for tokens...');
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        
        // Get user info
        console.log('Getting user info...');
        const oauth2 = google.oauth2({ 
          version: 'v2', 
          auth: oauth2Client 
        });
        
        const userInfo = await oauth2.userinfo.get();
        const email = userInfo.data.email;
        
        if (!email) {
          return res.redirect('/?error=Could not retrieve email from Google');
        }
        
        console.log(`Authenticated email: ${email}`);
        
        // Store tokens in database
        const expiresAt = new Date();
        if (tokens.expiry_date) {
          expiresAt.setTime(tokens.expiry_date);
        } else {
          expiresAt.setHours(expiresAt.getHours() + 1);
        }
        
        // Use a default user ID if we don't have Firebase authentication
        const uid = 'gmail_user_' + email.replace(/[^a-zA-Z0-9]/g, '_');
        
        await storage.storeOAuthToken({
          uid,
          email,
          accessToken: tokens.access_token || '',
          refreshToken: tokens.refresh_token || null,
          expiresAt
        });
        
        console.log('OAuth tokens stored successfully');
        
        // Store user session
        (req as any).session.user = {
          uid: uid,
          email: email,
          displayName: userInfo.data.name,
          photoURL: userInfo.data.picture
        };
        
        console.log('Storing user in session:', email);
        
        // Save session before redirect
        (req as any).session.save((err: any) => {
          if (err) {
            console.error('Session save error:', err);
            return res.redirect(`/?error=${encodeURIComponent('Session save failed')}`);
          }
          console.log('Session saved successfully');
          // Redirect back to the app with success
          return res.redirect('/?connected=gmail');
        });
      } catch (error: any) {
        console.error('Error in OAuth callback:', error);
        return res.redirect(`/?error=${encodeURIComponent('Failed to authenticate with Gmail: ' + error.message)}`);
      }
    } else {
      // Not an OAuth callback, pass to next handler
      next();
    }
  });
  
  // Legacy endpoint for storing OAuth tokens
  app.post('/api/auth/store-tokens', async (req: Request, res: Response) => {
    try {
      const { idToken, accessToken, uid, email } = req.body;
      
      if (!idToken || !accessToken || !uid || !email) {
        return res.status(400).json({ message: 'Required fields are missing' });
      }
      
      // Verify the ID token
      try {
        const decodedToken = await getAuth().verifyIdToken(idToken);
        
        // Ensure the UID in the token matches the provided UID
        if (decodedToken.uid !== uid) {
          return res.status(403).json({ message: 'Unauthorized access' });
        }
        
        // Store the tokens
        const expiresIn = 3600; // Default expiration of 1 hour
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);
        
        await storage.storeOAuthToken({
          uid,
          email,
          accessToken,
          refreshToken: null, // Firebase doesn't provide refresh tokens directly
          expiresAt
        });
        
        return res.status(200).json({ message: 'Tokens successfully stored' });
      } catch (verifyError: any) {
        console.error('Token verification failed:', verifyError);
        return res.status(401).json({ message: 'Invalid token' });
      }
    } catch (error: any) {
      console.error('Error storing tokens:', error);
      return res.status(500).json({ message: 'Failed to store tokens' });
    }
  });
  
  // API Routes (these should be protected with verifyToken middleware in production)
  
  // Manual trigger for digest generation
  app.post('/api/digest/generate', requireAuth, async (req: any, res) => {
    try {
      // Get monitored emails for this user
      const monitoredEmails = await storage.getMonitoredEmails(req.userId);
      
      // Only get active monitored emails
      const activeEmails = monitoredEmails
        .filter(email => email.active)
        .map(email => email.email);
      
      if (activeEmails.length === 0) {
        return res.status(400).json({ 
          message: 'No active monitored email addresses configured. Add email addresses to monitor in settings.'
        });
      }
      
      // Get stored OAuth token for this user
      const session = req.session;
      const userUid = session?.user?.uid;
      
      if (!userUid) {
        return res.status(401).json({ message: 'User session not found' });
      }
      
      // Fetch emails from monitored sources using stored OAuth token
      console.log(`Manually triggering email fetch from ${activeEmails.length} sources...`);
      const emails = await fetchEmails(activeEmails, userUid);
      
      if (emails.length === 0) {
        return res.status(200).json({ 
          message: 'No new emails from sender found in inbox'
        });
      }
      
      // Generate digest
      console.log(`Generating digest from ${emails.length} emails...`);
      const digest = await generateDigest(req.userId, emails);
      
      console.log(`Digest generation complete. Processed ${digest.emailsProcessed} emails with ${digest.topicsIdentified} topics.`);
      
      return res.status(200).json(digest);
    } catch (error: any) {
      console.error('Error generating digest:', error);
      return res.status(500).json({ 
        message: 'Failed to generate digest', 
        error: error.message 
      });
    }
  });
  
  app.get('/api/monitored-emails', requireAuth, async (req: any, res) => {
    try {
      console.log('Getting monitored emails for userId:', req.userId);
      const monitoredEmails = await storage.getMonitoredEmails(req.userId);
      console.log('Found monitored emails:', monitoredEmails.length);
      res.json(monitoredEmails);
    } catch (error: any) {
      console.error('Error in /api/monitored-emails:', error);
      res.status(500).json({ message: `Failed to get monitored emails: ${error.message}` });
    }
  });

  app.post('/api/monitored-emails', requireAuth, async (req: any, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }
      const newEmail = await storage.addMonitoredEmail({ userId: req.userId, email, active: true });
      res.status(201).json(newEmail);
    } catch (error) {
      res.status(500).json({ message: `Failed to add monitored email: ${error.message}` });
    }
  });

  app.delete('/api/monitored-emails/:id', requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID' });
      }
      await storage.removeMonitoredEmail(req.userId, id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: `Failed to remove monitored email: ${error.message}` });
    }
  });

  // Scan Gmail for potential newsletters for onboarding
  app.get('/api/onboarding/scan-newsletters', requireAuth, async (req: any, res) => {
    try {
      console.log('Scanning for newsletters for user:', req.userId);
      
      // Get user's email from session for OAuth lookup
      const session = req.session;
      if (!session || !session.user) {
        console.error('Session missing or incomplete:', { 
          hasSession: !!session, 
          hasUser: !!session?.user,
          userKeys: session?.user ? Object.keys(session.user) : []
        });
        return res.status(401).json({ message: 'Session not found' });
      }
      
      // Use the user's UID from session for OAuth token lookup
      const userUid = session.user.uid;
      console.log(`Looking up OAuth token for UID: ${userUid}, email: ${session.user.email}`);
      
      if (!userUid) {
        console.error('UID not found in session:', session.user);
        return res.status(401).json({ message: 'User UID not found in session' });
      }
      
      const newsletters = await scanForNewsletters(userUid);
      console.log(`Found ${newsletters.length} potential newsletter senders`);
      
      res.json({ newsletters });
    } catch (error: any) {
      console.error('Error scanning for newsletters:', error);
      res.status(500).json({ 
        message: 'Failed to scan for newsletters', 
        error: error.message 
      });
    }
  });

  // Save onboarding selections
  app.post('/api/onboarding/save-selections', requireAuth, async (req: any, res) => {
    try {
      const { emails, frequency, customDays } = req.body;
      
      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return res.status(400).json({ message: 'At least one email is required' });
      }
      
      if (!frequency || !['daily', 'weekly', 'custom'].includes(frequency)) {
        return res.status(400).json({ message: 'Valid frequency is required' });
      }
      
      console.log(`Saving onboarding selections for user ${req.userId}:`, {
        emails: emails.length,
        frequency,
        customDays
      });
      
      // Add all selected emails as monitored emails
      const addedEmails = [];
      for (const email of emails) {
        try {
          const monitoredEmail = await storage.addMonitoredEmail({
            userId: req.userId,
            email: email.trim(),
            active: true
          });
          addedEmails.push(monitoredEmail);
        } catch (error) {
          console.warn(`Failed to add monitored email ${email}:`, error);
        }
      }
      
      // Update user settings with digest frequency
      await storage.updateUserSettings(req.userId, {
        dailyDigestEnabled: frequency === 'daily',
        digestFrequency: frequency,
        ...(frequency === 'custom' && { customDigestDays: customDays })
      });
      
      // Mark user as onboarded (you might want to add this field to user settings)
      console.log(`Successfully onboarded user ${req.userId} with ${addedEmails.length} monitored emails`);
      
      // Trigger first digest generation in background
      try {
        const session = req.session;
        const userUid = session.user.uid;
        const monitoredSenders = emails;
        
        // Don't await this - let it run in background
        generateDigest(monitoredSenders, req.userId, userUid)
          .then(() => console.log('First digest generated successfully for new user'))
          .catch((error) => console.error('Failed to generate first digest:', error));
      } catch (error) {
        console.warn('Failed to trigger first digest generation:', error);
      }
      
      res.json({ 
        message: 'Onboarding completed successfully',
        monitoredEmails: addedEmails.length,
        firstDigestGenerating: true
      });
    } catch (error: any) {
      console.error('Error saving onboarding selections:', error);
      res.status(500).json({ 
        message: 'Failed to save onboarding selections', 
        error: error.message 
      });
    }
  });

  app.get('/api/settings', requireAuth, async (req: any, res) => {
    try {
      const settings = await storage.getUserSettings(req.userId);
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ message: `Failed to get user settings: ${error.message}` });
    }
  });

  app.patch('/api/settings', requireAuth, async (req: any, res) => {
    try {
      const updatedSettings = await storage.updateUserSettings(req.userId, req.body);
      res.json(updatedSettings);
    } catch (error) {
      res.status(500).json({ message: `Failed to update user settings: ${error.message}` });
    }
  });

  app.post('/api/settings/api-key', async (req, res) => {
    try {
      const { apiKey } = req.body;
      if (!apiKey) {
        return res.status(400).json({ message: 'API key is required' });
      }
      // In a real application, you would encrypt the API key before storing it
      process.env.OPENAI_API_KEY = apiKey;
      res.status(200).json({ message: 'API key updated successfully' });
    } catch (error) {
      res.status(500).json({ message: `Failed to update API key: ${error.message}` });
    }
  });

  app.get('/api/digest/latest', requireAuth, async (req: any, res) => {
    try {
      const latestDigest = await getLatestThematicDigest(req.userId);
      res.json(latestDigest);
    } catch (error: any) {
      res.status(500).json({ message: `Failed to get latest digest: ${error.message}` });
    }
  });

  // Keep the detailed view available as a separate endpoint
  app.get('/api/digest/detailed', requireAuth, async (req: any, res) => {
    try {
      const latestDigest = await getLatestDigest(req.userId);
      res.json(latestDigest);
    } catch (error: any) {
      res.status(500).json({ message: `Failed to get detailed digest: ${error.message}` });
    }
  });

  // Get digest history for a user
  app.get('/api/digest/history', requireAuth, async (req: any, res) => {
    try {
      const digests = await storage.getEmailDigests(req.userId);
      res.json(digests);
    } catch (error: any) {
      res.status(500).json({ message: `Failed to get digest history: ${error.message}` });
    }
  });

  // Get available digest dates for calendar highlighting
  app.get('/api/digest/available-dates', requireAuth, async (req: any, res) => {
    try {
      const dates = await storage.getAvailableDigestDates(req.userId);
      res.json(dates);
    } catch (error: any) {
      res.status(500).json({ message: `Failed to get available digest dates: ${error.message}` });
    }
  });

  // Get digest for a specific date
  app.get('/api/digest/date/:date', requireAuth, async (req: any, res) => {
    try {
      const { date } = req.params;
      console.log(`🔍 Looking for digest for user ${req.userId} on date ${date}`);
      
      // First, try to get thematic digest for this date
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      console.log(`🔍 Target date: ${targetDate}, Start of day: ${startOfDay}, End of day: ${endOfDay}`);
      
      // Check if thematic digest exists for this date
      const hasThematic = await storage.hasThematicDigestForDate(req.userId, targetDate);
      console.log(`🔍 Has thematic digest: ${hasThematic}`);
      
      if (hasThematic) {
        // Get thematic digest
        const thematicDigests = await storage.getThematicDigests(req.userId);
        const dateStr = date;
        const thematicDigest = thematicDigests.find((digest) => {
          const digestDateStr = new Date(digest.date).toISOString().split('T')[0];
          return digestDateStr === dateStr;
        });
        
        if (thematicDigest) {
          const fullThematicDigest = await storage.getThematicDigest(req.userId, thematicDigest.id);
          if (fullThematicDigest) {
            return res.json({
              ...fullThematicDigest,
              type: 'thematic',
              date: fullThematicDigest.date instanceof Date ? fullThematicDigest.date.toISOString() : fullThematicDigest.date,
              emailsProcessed: fullThematicDigest.totalSourceEmails,
              topicsIdentified: fullThematicDigest.sectionsCount
            });
          }
        }
      }
      
      // Fall back to regular digest
      console.log(`🔍 Falling back to regular digest for date ${date}`);
      const digest = await storage.getDigestByDate(req.userId, date);
      console.log(`🔍 Regular digest result:`, digest ? `Found digest ID ${digest.id}` : 'No digest found');
      
      if (!digest) {
        return res.status(404).json({ message: 'No digest found for this date' });
      }
      
      // Get emails for this digest
      const emails = await storage.getDigestEmails(digest.id);
      console.log(`🔍 Found ${emails.length} emails for digest ${digest.id}`);
      
      const response = {
        ...digest,
        type: 'regular',
        emails: emails.map(email => ({
          ...email,
          receivedAt: email.receivedAt instanceof Date ? email.receivedAt.toISOString() : email.receivedAt
        }))
      };
      
      console.log(`🔍 API Response:`, {
        id: response.id,
        type: response.type,
        emailsCount: response.emails.length,
        date: response.date
      });
      
      res.json(response);
    } catch (error: any) {
      res.status(500).json({ message: `Failed to get digest for date: ${error.message}` });
    }
  });



  // Setup cron jobs for automated tasks
  setupCronJobs();

  const httpServer = createServer(app);
  return httpServer;
}
