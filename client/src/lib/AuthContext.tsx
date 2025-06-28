import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from 'firebase/auth';

// Dev mode flag - enables bypass login during development
const DEV_MODE = true;

// Import Firebase functions (they'll work with dev config now)
import { onAuthChange, signInWithGoogle, signOutUser } from './firebase';

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

// Mock user for development mode
const createMockUser = (): User => {
  return {
    uid: 'dev-user-123',
    email: 'tmattoneill@gmail.com',
    displayName: 'Tom O\'Neill (Development)',
    photoURL: null,
    emailVerified: true,
    isAnonymous: false,
    metadata: {
      creationTime: new Date().toISOString(),
      lastSignInTime: new Date().toISOString()
    },
    providerData: [],
    refreshToken: 'mock-refresh-token',
    tenantId: null,
    phoneNumber: null,
    delete: async () => {},
    getIdToken: async () => 'mock-id-token',
    getIdTokenResult: async () => ({ token: 'mock-id-token' } as any),
    reload: async () => {},
    toJSON: () => ({}),
    providerId: 'google.com',
  } as unknown as User;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(DEV_MODE ? createMockUser() : null);
  const [token, setToken] = useState<string | null>(DEV_MODE ? 'dev-mode-token' : null);
  const [isLoading, setIsLoading] = useState(!DEV_MODE);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // In dev mode, we already have a mock user set, so skip the auth change listener
    if (DEV_MODE) {
      return () => {};
    }
    
    // In production, use the real Firebase auth
    const unsubscribe = onAuthChange((authUser) => {
      setUser(authUser);
      setIsLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    try {
      setError(null);
      
      // In development mode, just set the mock user
      if (DEV_MODE) {
        setUser(createMockUser());
        setToken('dev-mode-token');
        return;
      }
      
      // In production, use the real Firebase auth
      setIsLoading(true);
      const result = await signInWithGoogle();
      setToken(result.token || null);
    } catch (error) {
      console.error('Error signing in:', error);
      
      // Even if there's an error, in dev mode, proceed with mock user
      if (DEV_MODE) {
        setUser(createMockUser());
        setToken('dev-mode-token');
      } else {
        setError('Failed to sign in with Google. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setError(null);
      
      // In development mode, just clear the user
      if (DEV_MODE) {
        setUser(null);
        setToken(null);
        return;
      }
      
      // In production, use the real Firebase auth
      await signOutUser();
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