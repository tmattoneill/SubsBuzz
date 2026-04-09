import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, tokenManager, ApiError } from './api-client';
import { useToast } from '../hooks/use-toast';

// Simple user interface without Firebase dependency
interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  token: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  error: null,
  signIn: async () => {},
  signOut: async () => {},
  refreshAuth: async () => {},
  token: null
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Check for existing auth on mount and handle OAuth callback
  useEffect(() => {
    // Check if we're returning from OAuth (look for connected=gmail parameter)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('connected') === 'gmail') {
      // Remove the parameter and show success message
      window.history.replaceState({}, document.title, window.location.pathname);
      toast({
        title: "Connected to Gmail",
        description: "Your Gmail account has been successfully connected.",
      });
      // The OAuth callback already handled token storage, so just check auth status
      setTimeout(checkAuthStatus, 500); // Small delay to ensure backend has processed
    } else {
      checkAuthStatus();
    }
  }, []);

  const checkAuthStatus = async () => {
    try {
      const existingToken = tokenManager.getAccessToken();
      if (!existingToken) {
        setIsLoading(false);
        return;
      }

      // Check if user is already authenticated by calling validation endpoint
      const data = await api.get<{
        valid: boolean;
        uid?: string;
        email?: string;
      }>('/api/auth/validate');
      
      if (data.valid && data.uid) {
        setUser({
          uid: data.uid,
          email: data.email || null,
          displayName: null,
          photoURL: null
        });
        setToken(existingToken);
      } else {
        // Invalid token, clear it
        tokenManager.clearTokens();
      }
    } catch (error) {
      console.log('No existing auth found:', error);
      tokenManager.clearTokens();
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async () => {
    try {
      setError(null);
      setIsLoading(true);
      
      // Get Gmail auth URL from backend - no authentication required for new users
      const data = await api.post<{ auth_url: string }>('/api/auth/gmail-access', {});
      
      // Redirect to Google OAuth
      window.location.href = data.auth_url;
    } catch (error) {
      console.error('Error signing in:', error);
      const apiError = error as ApiError;
      setError(apiError.message || 'Failed to sign in with Google. Please try again.');
      toast({
        title: "Authentication Error",
        description: apiError.message || 'Failed to sign in with Google. Please try again.',
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setError(null);
      
      // Call backend logout endpoint
      await api.post('/api/auth/logout', {});
      
    } catch (error) {
      console.error('Error signing out:', error);
      const apiError = error as ApiError;
      setError(apiError.message || 'Failed to sign out. Please try again.');
      toast({
        title: "Sign Out Error",
        description: apiError.message || 'Failed to sign out. Please try again.',
        variant: "destructive",
      });
    } finally {
      // Always clear tokens and user state, even if the API call fails
      tokenManager.clearTokens();
      setUser(null);
      setToken(null);
    }
  };

  const refreshAuth = async () => {
    await checkAuthStatus();
  };

  const value = {
    user,
    isLoading,
    error,
    signIn,
    signOut,
    refreshAuth,
    token
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};