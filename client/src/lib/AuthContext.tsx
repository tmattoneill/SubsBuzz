import React, { createContext, useContext, useState, useEffect } from 'react';

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
  token: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  error: null,
  signIn: async () => {},
  signOut: async () => {},
  token: null
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for existing auth on mount and handle OAuth callback
  useEffect(() => {
    // Check if we're returning from OAuth (look for connected=gmail parameter)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('connected') === 'gmail') {
      // Remove the parameter and show success message
      window.history.replaceState({}, document.title, window.location.pathname);
      // The OAuth callback already handled token storage, so just check auth status
      setTimeout(checkAuthStatus, 500); // Small delay to ensure backend has processed
    } else {
      checkAuthStatus();
    }
  }, []);

  const checkAuthStatus = async () => {
    try {
      // Check if user is already authenticated by calling validation endpoint
      const userResponse = await fetch('/api/auth/validate', {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('subsbuzz_token')}`
        }
      });
      
      if (userResponse.ok) {
        const data = await userResponse.json();
        if (data.valid) {
          setUser({
            uid: data.uid,
            email: data.email,
            displayName: null,
            photoURL: null
          });
          setToken(localStorage.getItem('subsbuzz_token'));
        }
      }
    } catch (error) {
      console.log('No existing auth found');
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async () => {
    try {
      setError(null);
      setIsLoading(true);
      
      // First, we need to get a temporary token to access the gmail-access endpoint
      // For now, we'll use Firebase auth to get a token, then use that to get Gmail access
      
      // Get Gmail auth URL from backend - no authentication required for new users
      const response = await fetch('/api/auth/gmail-access', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      
      if (!response.ok) {
        throw new Error('Failed to get auth URL');
      }
      
      const { auth_url } = await response.json();
      
      // Redirect to Google OAuth
      window.location.href = auth_url;
    } catch (error) {
      console.error('Error signing in:', error);
      setError('Failed to sign in with Google. Please try again.');
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setError(null);
      
      // Call backend logout endpoint
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('subsbuzz_token')}`
        }
      });
      
      // Clear local storage
      localStorage.removeItem('subsbuzz_token');
      
      setUser(null);
      setToken(null);
    } catch (error) {
      console.error('Error signing out:', error);
      setError('Failed to sign out. Please try again.');
    }
  };

  const value = {
    user,
    isLoading,
    error,
    signIn,
    signOut,
    token
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};