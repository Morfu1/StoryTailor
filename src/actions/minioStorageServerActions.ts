"use server";

import { refreshMinIOStorageUrl } from './minioStorageActions';

/**
 * Server action wrapper for refreshing MinIO Storage URLs
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
