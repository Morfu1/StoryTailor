
import * as admin from 'firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';
// Import getFirestore from firebase-admin/firestore to specify a database ID
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

if (!admin.apps.length) {
  try {
    console.log('[firebaseAdmin] Attempting to initialize Firebase Admin SDK (expecting GOOGLE_APPLICATION_CREDENTIALS env var)...');
    console.log(`[firebaseAdmin] Current GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);

    admin.initializeApp(); 

    console.log('[firebaseAdmin] Firebase Admin SDK initialized successfully (presumably via GOOGLE_APPLICATION_CREDENTIALS).');
  } catch (error) {
    console.error('[firebaseAdmin] Error during Firebase Admin SDK initializeApp():', error);
    if (error instanceof Error) {
      console.error(`[firebaseAdmin] Initialization Error Name: ${error.name}`);
      console.error(`[firebaseAdmin] Initialization Error Message: ${error.message}`);
    }
  }
}

let dbAdmin: Firestore | undefined;
// Ensure an app is initialized before trying to get Firestore
if (admin.apps.length > 0 && admin.apps[0]) {
  try {
    // Explicitly get the 'storytailordb' instance using the first initialized app
    dbAdmin = getAdminFirestore(admin.apps[0], 'storytailordb');
    console.log('[firebaseAdmin] Firestore Admin SDK instance for "storytailordb" created.');
  } catch (error) {
    console.error('[firebaseAdmin] Error getting Firestore Admin instance for "storytailordb":', error);
    if (error instanceof Error) {
      console.error(`[firebaseAdmin] Firestore Instance Error Name: ${error.name}`);
      console.error(`[firebaseAdmin] Firestore Instance Error Message: ${error.message}`);
    }
    // Fallback to default if specific DB fails, though this might not be desired if 'storytailordb' is mandatory
    // console.warn('[firebaseAdmin] Falling back to default Firestore instance due to error with "storytailordb".');
    // dbAdmin = admin.firestore(); // Or getAdminFirestore(admin.apps[0]) for default
  }
} else {
  console.error('[firebaseAdmin] No Firebase app initialized after attempting. Firestore Admin instance cannot be created.');
}

export { dbAdmin, admin as firebaseAdmin };
