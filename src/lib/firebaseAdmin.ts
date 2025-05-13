
import * as admin from 'firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

console.log('---------------------------------------------------------------------');
console.log('[firebaseAdmin] MODULE LOAD: Attempting Firebase Admin SDK setup...');
console.log('---------------------------------------------------------------------');

let dbAdmin: Firestore | undefined;
let adminApp: admin.app.App | undefined;

const GAC_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (GAC_PATH) {
  console.log(`[firebaseAdmin] INFO: GOOGLE_APPLICATION_CREDENTIALS is SET to: "${GAC_PATH}"`);
  // You could add a check here to see if the file exists, e.g., using fs.existsSync,
  // but fs module might not be straightforward in all Next.js edge/serverless environments.
  // For now, we rely on Firebase Admin SDK's error if it can't find/read the file.
} else {
  console.warn(
    '[firebaseAdmin] WARNING: GOOGLE_APPLICATION_CREDENTIALS environment variable is NOT SET. ' +
    'Firebase Admin SDK will attempt to use Application Default Credentials (ADC). ' +
    'This is expected if running in a GCP environment (e.g., Cloud Functions, App Engine, Cloud Run). ' +
    'For local development or non-GCP servers, this variable MUST be set to the absolute path of your service account key JSON file.'
  );
}

if (!admin.apps.length) {
  console.log('[firebaseAdmin] INFO: No existing Firebase Admin app instances. Attempting to initialize a new one...');
  try {
    // admin.initializeApp() will use GOOGLE_APPLICATION_CREDENTIALS if set and valid,
    // or ADC if GOOGLE_APPLICATION_CREDENTIALS is not set.
    admin.initializeApp({
      // If GOOGLE_APPLICATION_CREDENTIALS is set, it overrides credential specified here.
      // If it's NOT set, and you want to load from a default path, you might specify:
      // credential: admin.credential.applicationDefault(), // Or a specific cert
      // projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, // Ensure this is your correct project ID
    });
    adminApp = admin.app(); // Get the default app instance
    console.log(`[firebaseAdmin] SUCCESS: Firebase Admin SDK initializeApp() completed.`);
    console.log(`[firebaseAdmin] INFO: Initialized app name: "${adminApp.name}"`);
    console.log(`[firebaseAdmin] INFO: Project ID from initialized app: "${adminApp.options.projectId || 'N/A (Could not read from app options)'}"`);
    
    if (!adminApp.options.projectId && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
        console.warn(`[firebaseAdmin] WARNING: Initialized app does not have a projectId in its options. This is unusual. Using NEXT_PUBLIC_FIREBASE_PROJECT_ID ('${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}') for Firestore connection if needed, but the Admin SDK might not be fully configured.`);
    } else if (adminApp.options.projectId !== process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
        console.warn(`[firebaseAdmin] POTENTIAL MISMATCH: Initialized Admin App Project ID ("${adminApp.options.projectId}") does not match NEXT_PUBLIC_FIREBASE_PROJECT_ID ("${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}"). Ensure credentials point to the correct project.`);
    }


  } catch (error) {
    adminApp = undefined;
    console.error('[firebaseAdmin] CRITICAL ERROR during Firebase Admin SDK initializeApp():');
    if (error instanceof Error) {
      console.error(`  Error Type: ${error.name}`);
      console.error(`  Error Message: ${error.message}`);
      if (error.message.includes('ENOENT') || error.message.includes('file not found')) {
          console.error(`  TROUBLESHOOTING: The service account key file specified by GOOGLE_APPLICATION_CREDENTIALS ("${GAC_PATH || 'Not Set'}") might be missing, not found at the specified path, or the path is incorrect.`);
      } else if (error.message.includes('Error parsing service account credential') || error.message.includes('Invalid JSON')) {
          console.error(`  TROUBLESHOOTING: The service account key file ("${GAC_PATH || 'Not Set'}") might be malformed, not a valid JSON key file, or corrupted.`);
      } else if (error.message.includes('Missing project ID')) {
          console.error(`  TROUBLESHOOTING: A project ID could not be determined. Ensure your service account key is valid or Application Default Credentials are configured with a project ID.`);
      }
      if (error.stack) console.error(`  Stack Trace: ${error.stack}`);
    } else {
      console.error('  Caught a non-Error object during initializeApp:', error);
    }
    console.error('[firebaseAdmin] RESULT: Firebase Admin SDK initialization FAILED. `dbAdmin` will be undefined.');
  }
} else {
  adminApp = admin.apps[0]; // Use the first existing app
  if (adminApp) {
    console.log(`[firebaseAdmin] INFO: Firebase Admin SDK already initialized. Using existing app: "${adminApp.name}" (Project ID: "${adminApp.options.projectId || 'N/A'}")`);
  } else {
     console.error('[firebaseAdmin] CRITICAL ERROR: admin.apps array is not empty, but the first element is undefined. This should not happen.');
  }
}

if (adminApp) {
  try {
    const databaseId = 'storytailordb';
    console.log(`[firebaseAdmin] INFO: Attempting to get Firestore Admin instance for database ID: "${databaseId}" using app: "${adminApp.name}".`);
    // Explicitly get the 'storytailordb' instance
    dbAdmin = getAdminFirestore(adminApp, databaseId);
    console.log(`[firebaseAdmin] SUCCESS: Firestore Admin SDK instance for "${databaseId}" (dbAdmin) obtained.`);
  } catch (error) {
    dbAdmin = undefined; 
    console.error(`[firebaseAdmin] CRITICAL ERROR obtaining Firestore Admin instance for database ID "${'storytailordb'}" (or default if not specified):`);
     if (error instanceof Error) {
      console.error(`  Error Type: ${error.name}`);
      console.error(`  Error Message: ${error.message}`);
      if (error.message.includes('Could not load the default credentials') && !GAC_PATH) {
         console.error(`  TROUBLESHOOTING: This often means GOOGLE_APPLICATION_CREDENTIALS is not set and Application Default Credentials could not be found or are not configured for Firestore access.`);
      } else if (error.message.includes('PROJECT_NOT_FOUND') || (error.message.includes('7 PERMISSION_DENIED') && error.message.includes('Cloud Firestore API has not been used'))) {
         console.error(`  TROUBLESHOOTING: The project ID ("${adminApp.options.projectId || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'unknown'}") might be incorrect, or the Cloud Firestore API might not be enabled for this project. Visit https://console.cloud.google.com/apis/library/firestore.googleapis.com to enable it for the correct project.`);
      } else if (error.message.includes('NOT_FOUND') && error.message.includes(`database ${'storytailordb'}`)) {
         console.error(`  TROUBLESHOOTING: The specified Firestore database with ID "${'storytailordb'}" might not exist in project "${adminApp.options.projectId || 'unknown'}". Ensure it has been created.`);
      }
      if (error.stack) console.error(`  Stack Trace: ${error.stack}`);
    } else {
      console.error('  Caught a non-Error object during getAdminFirestore():', error);
    }
    console.error(`[firebaseAdmin] RESULT: Creation of dbAdmin for database "${'storytailordb'}" FAILED.`);
  }
} else {
  console.error('[firebaseAdmin] RESULT: Firebase Admin App not available. Firestore Admin instance (dbAdmin) cannot be created.');
  dbAdmin = undefined;
}

// Final diagnostic log
console.log('---------------------------------------------------------------------');
if (dbAdmin) {
  console.log('[firebaseAdmin] FINAL STATUS: `dbAdmin` IS DEFINED. Server-side Firestore operations should be possible.');
} else {
  console.error('[firebaseAdmin] FINAL STATUS: `dbAdmin` IS UNDEFINED. Server-side Firestore operations WILL FAIL with "Database connection not available". Review logs above for initialization errors.');
}
console.log('---------------------------------------------------------------------');

export { dbAdmin, admin as firebaseAdmin };
