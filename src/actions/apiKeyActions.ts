
"use server";

import type { UserApiKeys } from '@/types/apiKeys';
import { dbAdmin } from '@/lib/firebaseAdmin';

export async function saveUserApiKeys(userId: string, apiKeys: UserApiKeys): Promise<{ success: boolean; error?: string }> {
  if (!dbAdmin) {
    console.error("[saveUserApiKeys] dbAdmin is not defined. Firebase Admin SDK initialization issue.");
    return { success: false, error: "Database connection not available. Check server logs for firebaseAdmin.ts output." };
  }
  if (!userId) {
    console.error("[saveUserApiKeys] User ID is required but was not provided.");
    return { success: false, error: "User ID is required." };
  }

  try {
    const apiKeyRef = dbAdmin.collection("userApiKeys").doc(userId);
    console.log(`[saveUserApiKeys] Attempting to save API keys for userId: ${userId} to path: ${apiKeyRef.path}`);
    // We'll store the keys directly for now.
    // IMPORTANT: For production, these keys should be encrypted before saving.
    await apiKeyRef.set(apiKeys, { merge: true });
    console.log(`[saveUserApiKeys] Successfully saved API keys for userId: ${userId}`);
    return { success: true };
  } catch (error: unknown) { // Catch as 'unknown' for better type safety
    console.error(`[saveUserApiKeys] Error saving API keys for userId: ${userId}. Error:`, error);
    let errorMessage = "Failed to save API keys.";
    if (error instanceof Error) {
      errorMessage += ` Details: ${error.message}`;
      // Check for a 'code' property if it's a FirebaseError or similar
      if ('code' in error && error.code) {
        errorMessage += ` (Code: ${error.code})`;
        // Specific check for common permission issues
        if (error.code === 7 || (error.message && error.message.toLowerCase().includes('permission denied'))) {
            errorMessage = "Failed to save API keys due to a permission issue on the server. Please check the service account permissions for Firestore.";
            console.error("[saveUserApiKeys] Potential permission issue. Ensure the service account has 'Cloud Datastore User' or equivalent Firestore write permissions.");
        }
      } else if (error.message && error.message.toLowerCase().includes('offline')) {
          errorMessage = "Failed to save API keys. The server appears to be offline or unable to reach Firestore. Please check server connectivity and Firebase status.";
      }
    } else {
        errorMessage += " An unknown error occurred.";
    }
    
    return { success: false, error: errorMessage };
  }
}

export async function getUserApiKeys(userId: string): Promise<{ success: boolean; data?: UserApiKeys; error?: string }> {
  if (!dbAdmin) {
    console.error("[getUserApiKeys] dbAdmin is not defined. Firebase Admin SDK initialization issue.");
    return { success: false, error: "Database connection not available. Check server logs for firebaseAdmin.ts output." };
  }
  if (!userId) {
    console.error("[getUserApiKeys] User ID is required but was not provided.");
    return { success: false, error: "User ID is required." };
  }

  try {
    const apiKeyRef = dbAdmin.collection("userApiKeys").doc(userId);
    const docSnap = await apiKeyRef.get();

    if (docSnap.exists) {
      return { success: true, data: docSnap.data() as UserApiKeys };
    } else {
      // It's not an error if no keys are found, just return an empty object.
      return { success: true, data: {} };
    }
  } catch (error: unknown) {
    console.error(`[getUserApiKeys] Error fetching API keys for userId: ${userId}. Error:`, error);
    let errorMessage = "Failed to fetch API keys.";
    if (error instanceof Error) {
      errorMessage += ` Details: ${error.message}`;
      if ('code' in error && error.code) {
        errorMessage += ` (Code: ${error.code})`;
        if (error.code === 7 || (error.message && error.message.toLowerCase().includes('permission denied'))) {
          errorMessage = "Failed to fetch API keys due to a permission issue on the server. Please check the service account permissions for Firestore.";
        }
      }
    } else {
        errorMessage += " An unknown error occurred.";
    }
    return { success: false, error: errorMessage };
  }
}
