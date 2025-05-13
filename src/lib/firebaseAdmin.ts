import * as admin from 'firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import fs from 'fs'; // Re-import fs
import path from 'path'; // Re-import path

console.log('---------------------------------------------------------------------');
console.log('[firebaseAdmin] MODULE LOAD (Manual Key Parse): Attempting Firebase Admin SDK setup...');
console.log('--------------------------------------------------------------------');

let dbAdmin: Firestore | undefined;
let adminApp: admin.app.App | undefined;

const GAC_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const PROJECT_ID = "storytailor-f089f"; // Your Firebase Project ID

console.log(`[firebaseAdmin] INFO (Manual Key Parse): Using PROJECT_ID: "${PROJECT_ID}"`);
if (GAC_PATH) {
  console.log(`[firebaseAdmin] INFO (Manual Key Parse): GOOGLE_APPLICATION_CREDENTIALS is SET to: "${GAC_PATH}"`);
} else {
  console.error('[firebaseAdmin] CRITICAL (Manual Key Parse): GOOGLE_APPLICATION_CREDENTIALS is NOT SET. Cannot initialize with service account.');
}

const databaseId = 'storytailordb'; // Your target Firestore database ID

if (!admin.apps.length) {
  console.log('[firebaseAdmin] INFO (Manual Key Parse): No existing Firebase Admin app instances. Attempting to initialize a new one...');
  if (GAC_PATH) { // Only attempt if GAC_PATH is set
    try {
      const absoluteKeyPath = path.resolve(GAC_PATH);
      console.log(`[firebaseAdmin] INFO (Manual Key Parse): Absolute path to service account key being checked: "${absoluteKeyPath}"`);

      if (fs.existsSync(absoluteKeyPath)) {
        console.log(`[firebaseAdmin] INFO (Manual Key Parse): Service account key file FOUND at "${absoluteKeyPath}". Reading and parsing...`);
        const keyFileContent = fs.readFileSync(absoluteKeyPath, 'utf8');
        const serviceAccountObject = JSON.parse(keyFileContent);
        console.log('[firebaseAdmin] INFO (Manual Key Parse): Service account key file parsed successfully.');

        const appOptions: admin.AppOptions = {
          credential: admin.credential.cert(serviceAccountObject), // Pass the parsed object
          projectId: PROJECT_ID
        };
        console.log('[firebaseAdmin] INFO (Manual Key Parse): Attempting admin.initializeApp() with parsed key object and options:', JSON.stringify(appOptions, null, 2));
        admin.initializeApp(appOptions);
        adminApp = admin.app(); // Get the default app
        console.log(`[firebaseAdmin] SUCCESS (Manual Key Parse): Firebase Admin SDK initializeApp() completed.`);
        console.log(`[firebaseAdmin] INFO (Manual Key Parse): Initialized app name: "${adminApp.name}"`);
        console.log(`[firebaseAdmin] INFO (Manual Key Parse): Project ID from initialized app: "${adminApp.options.projectId || 'N/A'}"`);
        if (adminApp.options.projectId !== PROJECT_ID) {
          console.warn(`[firebaseAdmin] MISMATCH (Manual Key Parse): Initialized app PID ("${adminApp.options.projectId}") vs configured PID ("${PROJECT_ID}")`);
        }
      } else {
        console.error(`[firebaseAdmin] CRITICAL (Manual Key Parse): Service account key file NOT FOUND at "${absoluteKeyPath}".`);
        // This will prevent initialization if key file is mandatory
      }
    } catch (error: any) {
      adminApp = undefined;
      console.error('[firebaseAdmin] CRITICAL ERROR (Manual Key Parse) during Firebase Admin SDK initializeApp() or key parsing:');
      console.error(`  Error Type: ${error.name}`);
      console.error(`  Error Message: ${error.message}`);
      if (error.stack) console.error(`  Stack Trace: ${error.stack}`);
      console.error('[firebaseAdmin] RESULT (Manual Key Parse): Firebase Admin SDK initialization FAILED. \`dbAdmin\` will be undefined.');
    }
  } else {
    console.error('[firebaseAdmin] ERROR (Manual Key Parse): GAC_PATH not set, cannot initialize new app instance with service account.');
  }
} else {
  console.log('[firebaseAdmin] INFO (Manual Key Parse): Firebase Admin app instance(s) already exist. Attempting to use default app.');
  adminApp = admin.app(); 
  if (adminApp) {
     console.log(`[firebaseAdmin] INFO (Manual Key Parse): Using existing app: "${adminApp.name}" (Project ID: "${adminApp.options.projectId || 'N/A'}")`);
     if (adminApp.options.projectId !== PROJECT_ID) {
        console.warn(`[firebaseAdmin] MISMATCH (Manual Key Parse): Existing app PID ("${adminApp.options.projectId}") vs configured PID ("${PROJECT_ID}")`);
     }
  } else {
      console.error('[firebaseAdmin] ERROR (Manual Key Parse): admin.apps not empty, but admin.app() returned no default app.');
  }
}

if (adminApp) {
  try {
    console.log(`[firebaseAdmin] INFO (Manual Key Parse): Attempting to get Firestore Admin instance for database ID: "${databaseId}" using app: "${adminApp.name}".`);
    dbAdmin = getAdminFirestore(adminApp, databaseId);
    console.log(`[firebaseAdmin] SUCCESS (Manual Key Parse): Firestore Admin SDK instance for "${databaseId}" (dbAdmin) obtained.`);
  } catch (error: any) {
    dbAdmin = undefined;
    console.error(`[firebaseAdmin] CRITICAL ERROR (Manual Key Parse) obtaining Firestore Admin instance for database "${databaseId}":`);
    console.error(`  Error Type: ${error.name}`);
    console.error(`  Error Message: ${error.message}`);
    if (error.stack) console.error(`  Stack Trace: ${error.stack}`);
    console.error(`[firebaseAdmin] RESULT (Manual Key Parse): Creation of dbAdmin for database "${databaseId}" FAILED.`);
  }
} else {
  console.error('[firebaseAdmin] RESULT (Manual Key Parse): Firebase Admin App not available. Firestore Admin instance (dbAdmin) cannot be created.');
}

console.log('---------------------------------------------------------------------');
if (dbAdmin) {
  console.log('[firebaseAdmin] FINAL STATUS (Manual Key Parse): \`dbAdmin\` IS DEFINED. Server-side Firestore operations should be possible.');
} else {
  console.error('[firebaseAdmin] FINAL STATUS (Manual Key Parse): \`dbAdmin\` IS UNDEFINED. Server-side Firestore operations WILL FAIL.');
}
console.log('---------------------------------------------------------------------');

export { dbAdmin, admin as firebaseAdmin };
