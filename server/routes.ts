import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import { generateDigest, getLatestDigest, getLatestThematicDigest } from "./openai";
import { fetchEmails } from "./gmail";
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
  if (!session || !session.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  req.userId = getUserId(session.user.email);
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
        
        // Redirect back to the app with success
        return res.redirect('/?connected=gmail');
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
      const session = (req as any).session;
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
      const monitoredEmails = await storage.getMonitoredEmails(req.userId);
      res.json(monitoredEmails);
    } catch (error: any) {
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



  // Setup cron jobs for automated tasks
  setupCronJobs();

  const httpServer = createServer(app);
  return httpServer;
}
