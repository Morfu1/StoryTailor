
import * as admin from 'firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';
// Import getFirestore from firebase-admin/firestore to specify a database ID
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

console.log('[firebaseAdmin] Module loaded. Initializing Firebase Admin SDK...');

let dbAdmin: Firestore | undefined;
let adminInitialized = false;

const GAC_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!GAC_PATH) {
  console.warn(
    '[firebaseAdmin] WARNING: GOOGLE_APPLICATION_CREDENTIALS environment variable is NOT SET. ' +
    'Firebase Admin SDK will attempt to use default credentials if running in a GCP environment (e.g., Cloud Functions, App Engine). ' +
    'For local development outside such environments, this variable MUST be set to the absolute path of your service account key JSON file for server-side operations to work.'
  );
} else {
  console.log(`[firebaseAdmin] GOOGLE_APPLICATION_CREDENTIALS is set to: ${GAC_PATH}`);
  // Basic check if the path looks like a path to a JSON file
  if (!GAC_PATH.toLowerCase().endsWith('.json')) {
      console.warn(`[firebaseAdmin] WARNING: GOOGLE_APPLICATION_CREDENTIALS path "${GAC_PATH}" does not end with .json. This might be incorrect.`);
  }
  // In a real production server, you'd also want to check if the file exists and is readable if possible,
  // but fs access might not be straightforward in all Next.js deployment environments.
}

if (!admin.apps.length) {
  console.log('[firebaseAdmin] No existing Firebase Admin app instances found. Attempting to initialize a new one...');
  try {
    // admin.initializeApp() will use GOOGLE_APPLICATION_CREDENTIALS if set and valid,
    // or attempt to find Application Default Credentials if running in a GCP environment.
    admin.initializeApp();
    adminInitialized = true;
    console.log('[firebaseAdmin] Firebase Admin SDK initializeApp() called successfully.');
    if (admin.apps[0]) {
      console.log(`[firebaseAdmin] Initialized app name: ${admin.apps[0].name} (Project ID: ${admin.apps[0].options.projectId || 'N/A'})`);
    } else {
      console.warn('[firebaseAdmin] admin.initializeApp() succeeded but admin.apps array is empty. This is unexpected.');
      adminInitialized = false; // Treat as not initialized if no app object is available
    }
  } catch (error) {
    adminInitialized = false;
    console.error('[firebaseAdmin] CRITICAL ERROR during Firebase Admin SDK initializeApp():');
    if (error instanceof Error) {
      console.error(`  Error Name: ${error.name}`);
      console.error(`  Error Message: ${error.message}`);
      if (error.message.includes('ENOENT') || error.message.includes('file not found')) {
          console.error(`  Potential Issue: The service account key file specified by GOOGLE_APPLICATION_CREDENTIALS ("${GAC_PATH}") might not be found or accessible.`);
      } else if (error.message.includes('Error parsing service account credential')) {
          console.error(`  Potential Issue: The service account key file specified by GOOGLE_APPLICATION_CREDENTIALS ("${GAC_PATH}") might be malformed or not a valid JSON key file.`);
      }
      if (error.stack) console.error(`  Stack: ${error.stack}`);
    } else {
      console.error('  Caught a non-Error object during initializeApp:', error);
    }
    console.error('[firebaseAdmin] Firebase Admin SDK initialization FAILED. `dbAdmin` will be undefined.');
  }
} else {
  adminInitialized = true; // An app already exists
  console.log(`[firebaseAdmin] Firebase Admin SDK already initialized. Found ${admin.apps.length} app(s).`);
  if (admin.apps[0]) {
    console.log(`[firebaseAdmin] Using existing app: ${admin.apps[0].name} (Project ID: ${admin.apps[0].options.projectId || 'N/A'})`);
  }
}

// Attempt to get Firestore instance if Admin SDK is initialized
if (adminInitialized && admin.apps.length > 0 && admin.apps[0]) {
  try {
    const appToUse = admin.apps[0];
    console.log(`[firebaseAdmin] Attempting to get Firestore Admin instance for database "storytailordb" using app: ${appToUse.name}.`);
    // Explicitly get the 'storytailordb' instance
    dbAdmin = getAdminFirestore(appToUse, 'storytailordb');
    console.log('[firebaseAdmin] Firestore Admin SDK instance for "storytailordb" (dbAdmin) created successfully.');
  } catch (error) {
    dbAdmin = undefined; // Ensure it's undefined on error
    console.error('[firebaseAdmin] CRITICAL ERROR getting Firestore Admin instance for "storytailordb":');
     if (error instanceof Error) {
      console.error(`  Error Name: ${error.name}`);
      console.error(`  Error Message: ${error.message}`);
      if (error.stack) console.error(`  Stack: ${error.stack}`);
    } else {
      console.error('  Caught a non-Error object during getAdminFirestore:', error);
    }
    console.error('[firebaseAdmin] Creation of dbAdmin for "storytailordb" FAILED.');
  }
} else if (adminInitialized) {
  // This case means admin.initializeApp() might have claimed success but admin.apps[0] is not available
  console.error('[firebaseAdmin] CRITICAL ERROR: Firebase Admin SDK was marked as initialized, but no valid app instance is available. Firestore Admin instance for "storytailordb" cannot be created.');
  dbAdmin = undefined;
} else {
  // This means admin.initializeApp() failed earlier.
  console.error('[firebaseAdmin] CRITICAL ERROR: Firebase Admin SDK initialization failed previously or was not attempted. Firestore Admin instance for "storytailordb" cannot be created.');
  dbAdmin = undefined;
}

// Final diagnostic log
if (dbAdmin) {
  console.log('[firebaseAdmin] Final check: `dbAdmin` IS DEFINED. Server-side Firestore operations should be possible for "storytailordb".');
} else {
  console.error('[firebaseAdmin] Final check: `dbAdmin` IS UNDEFINED. Server-side Firestore operations WILL FAIL with "Database connection not available". ' +
                'Review logs above for initialization errors. Common issues include incorrect GOOGLE_APPLICATION_CREDENTIALS path, ' +
                'invalid service account key file, or problems connecting to the specified Firestore database instance ("storytailordb").');
}

export { dbAdmin, admin as firebaseAdmin };
