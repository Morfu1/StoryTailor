
"use server";

import type { UserApiKeys } from '@/types/apiKeys';
import { firebaseAdmin, dbAdmin } from '@/lib/firebaseAdmin';

export async function saveUserApiKeys(userId: string, apiKeys: UserApiKeys): Promise<{ success: boolean; error?: string }> {
  if (!dbAdmin) {
    return { success: false, error: "Database connection not available." };
  }
  if (!userId) {
    return { success: false, error: "User ID is required." };
  }

  try {
    const apiKeyRef = dbAdmin.collection("userApiKeys").doc(userId);
    // We'll store the keys directly for now.
    // IMPORTANT: For production, these keys should be encrypted before saving.
    await apiKeyRef.set(apiKeys, { merge: true });
    return { success: true };
  } catch (error) {
    console.error("Error saving API keys:", error);
    return { success: false, error: "Failed to save API keys." };
  }
}

export async function getUserApiKeys(userId: string): Promise<{ success: boolean; data?: UserApiKeys; error?: string }> {
  if (!dbAdmin) {
    return { success: false, error: "Database connection not available." };
  }
  if (!userId) {
    return { success: false, error: "User ID is required." };
  }

  try {
    const apiKeyRef = dbAdmin.collection("userApiKeys").doc(userId);
    const docSnap = await apiKeyRef.get();

    if (docSnap.exists) {
      return { success: true, data: docSnap.data() as UserApiKeys };
    } else {
      return { success: true, data: {} }; // Return empty object if no keys found
    }
  } catch (error) {
    console.error("Error fetching API keys:", error);
    return { success: false, error: "Failed to fetch API keys." };
  }
}
