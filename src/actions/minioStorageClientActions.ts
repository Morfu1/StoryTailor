"use server";

import { refreshMinIOStorageUrl } from './minioStorageActions';

/**
 * Client-callable wrapper for refreshing MinIO Storage URLs
 * Extracts user ID and story ID from the URL path
 */
export async function refreshMinIOStorageUrlClient(expiredUrl: string): Promise<string | null> {
  if (!expiredUrl || typeof expiredUrl !== 'string') {
    return null;
  }

  try {
    const minioEndpoint = process.env.MINIO_ENDPOINT;
    if (!minioEndpoint || !expiredUrl.includes(minioEndpoint)) {
      console.warn(`[refreshMinIOStorageUrlClient] URL is not a MinIO URL: ${expiredUrl}`);
      return null;
    }

    // Extract file path from MinIO URL
    // MinIO URL format: http://endpoint/bucket/users/userId/stories/storyId/folder/filename
    const urlObj = new URL(expiredUrl);
    const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
    
    // Find users/{userId}/stories/{storyId} pattern
    const usersIndex = pathParts.findIndex(part => part === 'users');
    if (usersIndex !== -1 && usersIndex + 3 < pathParts.length) {
      const userId = pathParts[usersIndex + 1];
      const storyId = pathParts[usersIndex + 3];
      
      // Full file path after bucket name
      const bucketName = process.env.MINIO_BUCKET_NAME || 'storytailor-media';
      const bucketIndex = pathParts.findIndex(part => part === bucketName);
      
      if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
        const filePath = pathParts.slice(bucketIndex + 1).join('/');
        
        console.log(`[refreshMinIOStorageUrlClient] Refreshing URL for user: ${userId}, story: ${storyId}, file: ${filePath}`);
        
        return await refreshMinIOStorageUrl(expiredUrl, userId, storyId, filePath);
      }
    }
    
    console.warn(`[refreshMinIOStorageUrlClient] Unable to extract user/story ID from MinIO URL: ${expiredUrl}`);
    return null;
    
  } catch (error) {
    console.error('[refreshMinIOStorageUrlClient] Error refreshing URL:', error);
    return null;
  }
}

/**
 * Check if a URL is a MinIO storage URL
 */
export function isMinIOStorageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  const minioEndpoint = process.env.MINIO_ENDPOINT;
  return minioEndpoint ? url.includes(minioEndpoint) : false;
}

/**
 * Extract storage metadata from MinIO URL
 */
export function parseMinIOStorageUrl(url: string): {
  userId?: string;
  storyId?: string;
  fileName?: string;
  fileType?: 'audio' | 'image';
  isValid: boolean;
} {
  try {
    if (!isMinIOStorageUrl(url)) {
      return { isValid: false };
    }

    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
    
    // MinIO structure: bucket/users/{userId}/stories/{storyId}/{folder}/{filename}
    const usersIndex = pathParts.findIndex(part => part === 'users');
    
    if (usersIndex !== -1 && usersIndex + 4 < pathParts.length) {
      const userId = pathParts[usersIndex + 1];
      const storyId = pathParts[usersIndex + 3];
      const folder = pathParts[usersIndex + 4];
      const fileName = pathParts[usersIndex + 5];
      
      const fileType = folder === 'narration_chunks' ? 'audio' : 'image';
      
      return {
        userId,
        storyId,
        fileName,
        fileType,
        isValid: true
      };
    }
    
    return { isValid: false };
  } catch (error) {
    console.error('Error parsing MinIO storage URL:', error);
    return { isValid: false };
  }
}
