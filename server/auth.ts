import { Request, Response, NextFunction } from 'express';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { getAuth } from 'firebase-admin/auth';
import { storage } from './storage';

const gmail = google.gmail('v1');

// Gmail OAuth credentials from environment variables
export const OAUTH_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
export const OAUTH_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
// Using redirect URI from environment to match Google Console configuration
export const OAUTH_REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || 'http://127.0.0.1:5500/auth/callback';

// Simplified token verification for development
export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      message: 'Unauthorized - No token provided' 
    });
  }
  
  const idToken = authHeader.split('Bearer ')[1];
  
  try {
    // For development, accept any token
    req.user = {
      uid: 'development_user_id',
      email: 'tmattoneill@gmail.com',
      name: 'Tom O\'Neill'
    };
    next();
  } catch (error: any) {
    console.error('Error verifying token:', error);
    return res.status(401).json({ 
      message: 'Unauthorized - Invalid token'
    });
  }
};

// Create OAuth client
const createOAuthClient = () => {
  return new google.auth.OAuth2(
    OAUTH_CLIENT_ID,
    OAUTH_CLIENT_SECRET,
    OAUTH_REDIRECT_URI
  );
};

// Get Gmail access with or without Firebase token
export const exchangeTokenForGmail = async (idToken: string): Promise<{oauth2Client: OAuth2Client | null, authUrl?: string}> => {
  try {
    // First try using direct Gmail OAuth tokens if we have them
    try {
      // Try to find any stored Gmail OAuth tokens
      // We'll use email as identifier if we have it (more reliable than Firebase token)
      const email = 'tmattoneill@gmail.com'; // Default to the known email
      const storedToken = await storage.getOAuthTokenByEmail(email);
      
      if (storedToken) {
        console.log(`Found stored Gmail OAuth token for ${email}`);
        
        // Check if token is expired
        const now = new Date();
        const isExpired = storedToken.expiresAt && now > storedToken.expiresAt;
        
        // Create OAuth client with Google credentials
        const oauth2Client = new google.auth.OAuth2(
          OAUTH_CLIENT_ID,
          OAUTH_CLIENT_SECRET,
          OAUTH_REDIRECT_URI
        );
        
        if (isExpired && storedToken.refreshToken) {
          // Token is expired, use refresh token to get a new one
          console.log('Refreshing expired token');
          oauth2Client.setCredentials({
            refresh_token: storedToken.refreshToken
          });
          
          // Refresh the token
          try {
            const { credentials } = await oauth2Client.refreshAccessToken();
            
            // Update token in database
            if (credentials.access_token) {
              const expiresAt = new Date();
              if (credentials.expiry_date) {
                expiresAt.setTime(credentials.expiry_date);
              } else {
                expiresAt.setHours(expiresAt.getHours() + 1);
              }
              
              await storage.updateOAuthToken(storedToken.uid, {
                accessToken: credentials.access_token,
                refreshToken: credentials.refresh_token || storedToken.refreshToken,
                expiresAt
              });
              
              return { oauth2Client };
            }
          } catch (refreshError) {
            console.error('Error refreshing token:', refreshError);
          }
        } else if (!isExpired) {
          // Token is still valid
          console.log('Using existing valid token');
          oauth2Client.setCredentials({
            access_token: storedToken.accessToken,
            refresh_token: storedToken.refreshToken
          });
          
          return oauth2Client;
        }
      }
    } catch (directError) {
      console.warn('Error trying direct Gmail OAuth:', directError);
    }
    
    // Fall back to Firebase token if direct Gmail auth failed
    try {
      // Verify the Firebase ID token
      const decodedToken = await getAuth().verifyIdToken(idToken);
      const uid = decodedToken.uid;
      
      // Get stored OAuth token from database
      const storedToken = await storage.getOAuthTokenByUid(uid);
      
      if (storedToken) {
        // Process similar to above
        const now = new Date();
        const isExpired = storedToken.expiresAt && now > storedToken.expiresAt;
        
        const oauth2Client = new google.auth.OAuth2(
          OAUTH_CLIENT_ID,
          OAUTH_CLIENT_SECRET,
          OAUTH_REDIRECT_URI
        );
        
        if (!isExpired) {
          oauth2Client.setCredentials({
            access_token: storedToken.accessToken,
            refresh_token: storedToken.refreshToken
          });
          
          return oauth2Client;
        }
      }
    } catch (firebaseError) {
      console.warn('Firebase token verification failed:', firebaseError);
    }
    
    // No valid tokens found, generate auth URL for new authentication
    console.log('No valid OAuth tokens found, generating auth URL');
    const oauth2Client = new google.auth.OAuth2(
      OAUTH_CLIENT_ID,
      OAUTH_CLIENT_SECRET,
      OAUTH_REDIRECT_URI
    );

    // Set up the Gmail API scopes
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];

    // Generate an auth URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state: idToken // Pass the Firebase ID token as state for later
    });

    console.log('Generated Gmail OAuth URL:', authUrl);
    return { oauth2Client: null, authUrl };
  } catch (error: any) {
    console.error('Error exchanging token:', error);
    return { oauth2Client: null };
  }
};

// Mock Gmail API access for development
export const mockGmailAccess = async (idToken: string) => {
  // Skip token verification for development
  return {
    accessToken: 'mock_access_token',
    refreshToken: 'mock_refresh_token',
    user: {
      email: 'tmattoneill@gmail.com',
      name: 'Tom O\'Neill'
    }
  };
};

// Add Firebase UID to Request interface
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}