import { initializeApp, cert } from 'firebase-admin/app';

let firebaseAdmin;

// Initialize Firebase Admin with environment variables
try {
  // Check if Firebase credentials are provided via environment variables
  const firebaseConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  };

  // Only initialize if all required credentials are present
  if (firebaseConfig.projectId && firebaseConfig.privateKey && firebaseConfig.clientEmail) {
    firebaseAdmin = initializeApp({
      credential: cert(firebaseConfig),
      projectId: firebaseConfig.projectId
    });
    
    console.log('Firebase Admin SDK initialized successfully');
  } else {
    throw new Error('Firebase credentials not found in environment variables');
  }
} catch (error) {
  console.warn('Firebase Admin SDK not configured:', error.message);
  
  // Create minimal Firebase Admin for development
  console.log('Using minimal Firebase Admin SDK for development');
  firebaseAdmin = initializeApp(
    {
      projectId: process.env.FIREBASE_PROJECT_ID || "dev-project"
    }, 
    'dev-app'
  );
}

export default firebaseAdmin;