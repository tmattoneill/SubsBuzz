import { initializeApp, cert } from 'firebase-admin/app';
import * as fs from 'fs';
import * as path from 'path';

let firebaseAdmin;

// Initialize Firebase Admin with service account JSON file
try {
  // Load the service account file
  const serviceAccountPath = path.join(process.cwd(), 'firebase-service-account.json');
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  
  // Initialize Firebase Admin
  firebaseAdmin = initializeApp({
    credential: cert(serviceAccount),
    projectId: "mymaildigest-120bf"
  });
  
  console.log('Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error);
  
  // Mock Firebase Admin for development purposes
  console.log('Using mock Firebase Admin SDK for development');
  firebaseAdmin = initializeApp(
    {
      projectId: "mymaildigest-120bf"
    }, 
    'mock-app'
  );
}

export default firebaseAdmin;