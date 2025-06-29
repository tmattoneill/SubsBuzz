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

// Get Gmail access using stored OAuth token by UID
export const exchangeTokenForGmail = async (userUid: string): Promise<{oauth2Client: OAuth2Client | null, authUrl?: string}> => {
  try {
    // Look up stored OAuth token by UID
    console.log(`Looking for OAuth token for UID: ${userUid}`);
    const storedToken = await storage.getOAuthTokenByUid(userUid);
    
    if (!storedToken) {
      console.error(`No OAuth token found for UID: ${userUid}`);
      return { oauth2Client: null };
    }
      
    console.log(`Found stored Gmail OAuth token for ${storedToken.email}`);
    
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
      
      return { oauth2Client };
    }
    
    // No valid tokens found
    console.log('No valid OAuth tokens found for this user');
    return { oauth2Client: null };
  } catch (error: any) {
    console.error('Error getting OAuth token:', error);
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