import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";

// Check if we're in development mode and skip Firebase config if needed
const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || (isDevelopment ? "dev-api-key" : undefined),
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID || (isDevelopment ? "dev-project" : "")}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || (isDevelopment ? "dev-project" : undefined),
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID || (isDevelopment ? "dev-project" : "")}.appspot.com`,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || (isDevelopment ? "dev-app-id" : undefined),
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Always request access to Gmail with the required scopes
provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
provider.addScope('https://www.googleapis.com/auth/gmail.labels');
provider.addScope('https://www.googleapis.com/auth/gmail.metadata');

// Set custom OAuth parameters to request offline access (refresh token)
provider.setCustomParameters({
  prompt: 'consent',
  access_type: 'offline'
});

// Sign in with Google
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    
    // This gives you a Google Access Token which can be used to access the Gmail API
    const credential = GoogleAuthProvider.credentialFromResult(result);
    
    // Extract tokens and user info
    const accessToken = credential?.accessToken;
    const idToken = await result.user.getIdToken();
    
    // Send the tokens to the server for storage
    if (accessToken && idToken) {
      try {
        const response = await fetch('/api/auth/store-tokens', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            idToken,
            accessToken,
            uid: result.user.uid,
            email: result.user.email
          }),
        });
        
        if (!response.ok) {
          console.warn('Failed to store tokens on server');
        }
      } catch (storageError) {
        console.error('Error storing tokens:', storageError);
      }
    }
    
    return {
      user: result.user,
      token: accessToken
    };
  } catch (error) {
    console.error("Error signing in with Google:", error);
    throw error;
  }
};

// Sign out
export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
};

// Get current user
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

// Auth state change listener
export const onAuthChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export { auth };