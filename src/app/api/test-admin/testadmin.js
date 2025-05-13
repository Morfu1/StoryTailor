const admin = require('firebase-admin');
const path = require('path');

// Use the path to the key file you copied into this directory
const serviceAccountPath = path.resolve('./serviceAccountKey.json'); // Or the full name if you didn't rename it

console.log(`[Test Script] Attempting to initialize Firebase Admin SDK...`);
console.log(`[Test Script] Using service account key path: ${serviceAccountPath}`);

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
    // You can also specify projectId here if needed, though it's usually in the key
    // projectId: "storytailor-f089f"
  });
  console.log(`[Test Script] SUCCESS: Firebase Admin SDK initialized successfully!`);
  console.log(`[Test Script] App name: ${admin.app().name}`);
  if (admin.app().options.projectId) {
    console.log(`[Test Script] Project ID from SDK: ${admin.app().options.projectId}`);
  } else {
    console.warn("[Test Script] Project ID could not be read from initialized app options.");
  }
} catch (error) {
  console.error(`[Test Script] ERROR initializing Firebase Admin SDK:`);
  console.error(`  Error Type: ${error.name}`);
  console.error(`  Error Message: ${error.message}`);
  if (error.stack) {
    console.error(`  Stack Trace: ${error.stack}`);
  }
}
