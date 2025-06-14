"use server";

import { baserowService } from '@/lib/baserow';
import type { UserApiKeys } from '@/types/apiKeys';

const BASEROW_USER_API_KEYS_TABLE_ID = process.env.BASEROW_USER_API_KEYS_TABLE_ID;

export async function saveUserApiKeys(userId: string, apiKeys: UserApiKeys): Promise<{ success: boolean; error?: string }> {
  if (!BASEROW_USER_API_KEYS_TABLE_ID) {
    console.error("[saveUserApiKeys] BASEROW_USER_API_KEYS_TABLE_ID is not configured.");
    return { success: false, error: "API keys table not configured. Check server configuration." };
  }
  
  if (!userId) {
    console.error("[saveUserApiKeys] User ID is required but was not provided.");
    return { success: false, error: "User ID is required." };
  }

  try {
    console.log(`[saveUserApiKeys] Attempting to save API keys for userId: ${userId}`);
    console.log(`[saveUserApiKeys] Table ID: ${BASEROW_USER_API_KEYS_TABLE_ID}`);
    console.log(`[saveUserApiKeys] API keys to save:`, { ...apiKeys, ...Object.keys(apiKeys).reduce((acc, key) => ({ ...acc, [key]: '***' }), {}) });
    
    // Check if user already has API keys
    const existingKeys = await getUserApiKeys(userId);
    console.log(`[saveUserApiKeys] Existing keys result:`, existingKeys.success ? 'found' : existingKeys.error);
    
    const apiKeyData = {
      user_id: userId,
      // Store API keys as JSON string - in production these should be encrypted
      api_key_hash: JSON.stringify(apiKeys),
      created_at: new Date().toISOString().split('T')[0],
      last_used: new Date().toISOString().split('T')[0]
    };

    // Always fetch all rows to check if user exists
    const apiKeyRows = await baserowService.apiCall(`/database/rows/table/${BASEROW_USER_API_KEYS_TABLE_ID}/?user_field_names=true`);
    const userRow = apiKeyRows.results.find((row: any) => row.user_id === userId);
    
    if (userRow) {
      // Update existing record
      console.log(`[saveUserApiKeys] Updating existing record with ID: ${userRow.id}`);
      await baserowService.apiCall(`/database/rows/table/${BASEROW_USER_API_KEYS_TABLE_ID}/${userRow.id}/?user_field_names=true`, 'PATCH', {
        api_key_hash: JSON.stringify(apiKeys),
        last_used: new Date().toISOString().split('T')[0]
      });
      console.log(`[saveUserApiKeys] Successfully updated API keys for userId: ${userId}`);
    } else {
      // Create new record
      console.log(`[saveUserApiKeys] Creating new record for userId: ${userId}`);
      const result = await baserowService.apiCall(`/database/rows/table/${BASEROW_USER_API_KEYS_TABLE_ID}/?user_field_names=true`, 'POST', apiKeyData);
      console.log(`[saveUserApiKeys] Successfully created API keys for userId: ${userId}, new record ID: ${result.id}`);
    }
    
    return { success: true };
  } catch (error: unknown) {
    console.error(`[saveUserApiKeys] Error saving API keys for userId: ${userId}. Error:`, error);
    let errorMessage = "Failed to save API keys.";
    
    if (error instanceof Error) {
      errorMessage += ` Details: ${error.message}`;
      
      // Check for Baserow-specific errors
      if (error.message.includes('401') || error.message.includes('permission')) {
        errorMessage = "Failed to save API keys due to a permission issue. Please check Baserow API token permissions.";
      } else if (error.message.includes('network') || error.message.includes('connection')) {
        errorMessage = "Failed to save API keys. Unable to connect to Baserow. Please check server connectivity.";
      }
    } else {
      errorMessage += " An unknown error occurred.";
    }
    
    return { success: false, error: errorMessage };
  }
}

export async function getUserApiKeys(userId: string): Promise<{ success: boolean; data?: UserApiKeys; error?: string }> {
  if (!BASEROW_USER_API_KEYS_TABLE_ID) {
    console.error("[getUserApiKeys] BASEROW_USER_API_KEYS_TABLE_ID is not configured.");
    return { success: false, error: "API keys table not configured. Check server configuration." };
  }
  
  if (!userId) {
    console.error("[getUserApiKeys] User ID is required but was not provided.");
    return { success: false, error: "User ID is required." };
  }

  try {
    // Get all API key rows and filter by user_id
    const apiKeyRows = await baserowService.apiCall(`/database/rows/table/${BASEROW_USER_API_KEYS_TABLE_ID}/?user_field_names=true`);
    const userRow = apiKeyRows.results.find((row: any) => row.user_id === userId);

    if (userRow && userRow.api_key_hash) {
      try {
        const apiKeys = JSON.parse(userRow.api_key_hash);
        
        // Update last_used timestamp
        await baserowService.apiCall(`/database/rows/table/${BASEROW_USER_API_KEYS_TABLE_ID}/${userRow.id}/?user_field_names=true`, 'PATCH', {
          last_used: new Date().toISOString().split('T')[0]
        });
        
        return { success: true, data: apiKeys as UserApiKeys };
      } catch (parseError) {
        console.error(`[getUserApiKeys] Failed to parse API keys JSON for userId: ${userId}`, parseError);
        return { success: false, error: "Failed to parse stored API keys." };
      }
    } else {
      // It's not an error if no keys are found, just return an empty object.
      return { success: true, data: {} };
    }
  } catch (error: unknown) {
    console.error(`[getUserApiKeys] Error fetching API keys for userId: ${userId}. Error:`, error);
    let errorMessage = "Failed to fetch API keys.";
    
    if (error instanceof Error) {
      errorMessage += ` Details: ${error.message}`;
      
      if (error.message.includes('401') || error.message.includes('permission')) {
        errorMessage = "Failed to fetch API keys due to a permission issue. Please check Baserow API token permissions.";
      }
    } else {
      errorMessage += " An unknown error occurred.";
    }
    
    return { success: false, error: errorMessage };
  }
}

export async function deleteUserApiKeys(userId: string): Promise<{ success: boolean; error?: string }> {
  if (!BASEROW_USER_API_KEYS_TABLE_ID) {
    console.error("[deleteUserApiKeys] BASEROW_USER_API_KEYS_TABLE_ID is not configured.");
    return { success: false, error: "API keys table not configured. Check server configuration." };
  }
  
  if (!userId) {
    console.error("[deleteUserApiKeys] User ID is required but was not provided.");
    return { success: false, error: "User ID is required." };
  }

  try {
    // Find the user's API key row
    const apiKeyRows = await baserowService.apiCall(`/database/rows/table/${BASEROW_USER_API_KEYS_TABLE_ID}/?user_field_names=true`);
    const userRow = apiKeyRows.results.find((row: any) => row.user_id === userId);

    if (userRow) {
      await baserowService.apiCall(`/database/rows/table/${BASEROW_USER_API_KEYS_TABLE_ID}/${userRow.id}/?user_field_names=true`, 'DELETE');
      console.log(`[deleteUserApiKeys] Successfully deleted API keys for userId: ${userId}`);
    } else {
      console.log(`[deleteUserApiKeys] No API keys found for userId: ${userId}`);
    }
    
    return { success: true };
  } catch (error: unknown) {
    console.error(`[deleteUserApiKeys] Error deleting API keys for userId: ${userId}. Error:`, error);
    let errorMessage = "Failed to delete API keys.";
    
    if (error instanceof Error) {
      errorMessage += ` Details: ${error.message}`;
    } else {
      errorMessage += " An unknown error occurred.";
    }
    
    return { success: false, error: errorMessage };
  }
}
