"use server";

import { refreshFirebaseStorageUrl } from './firebaseStorageActions';

/**
 * Client-callable wrapper for refreshing Firebase Storage URLs
 * Extracts user ID and story ID from the URL path
 */
export async function refreshFirebaseStorageUrlClient(expiredUrl: string): Promise<string | null> {
  if (!expiredUrl || typeof expiredUrl !== 'string') {
    return null;
  }

  try {
    // Extract file path from URL to determine userId and storyId
    const urlObj = new URL(expiredUrl);
    const pathMatch = urlObj.pathname.match(/\/o\/(users\/([^\/]+)\/stories\/([^\/]+)\/.+?)(?:\?|$)/);
    
    if (pathMatch && pathMatch[2] && pathMatch[3]) {
      const userId = pathMatch[2];
      const storyId = pathMatch[3];
      const filePath = decodeURIComponent(pathMatch[1]);
      
      console.log(`[refreshFirebaseStorageUrlClient] Refreshing URL for user: ${userId}, story: ${storyId}`);
      
      return await refreshFirebaseStorageUrl(expiredUrl, userId, storyId, filePath);
    } else {
      console.warn(`[refreshFirebaseStorageUrlClient] Unable to extract user/story ID from URL: ${expiredUrl}`);
      return null;
    }
  } catch (error) {
    console.error('[refreshFirebaseStorageUrlClient] Error refreshing URL:', error);
    return null;
  }
}
