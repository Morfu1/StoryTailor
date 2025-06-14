// Re-export server action from separate server file
export { refreshMinIOStorageUrlClient } from './minioStorageServerActions';

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

/**
 * Helper function to extract file info from MinIO URLs
 * Note: This function doesn't have access to server environment variables,
 * so it uses a provided endpoint or falls back to checking common patterns
 */
export function parseMinIOUrl(url: string, minioEndpoint?: string): { 
  bucket?: string; 
  filePath?: string; 
  isMinIOUrl: boolean 
} {
  try {
    // If no endpoint provided, try to detect MinIO-like patterns
    if (!minioEndpoint) {
      // Check for common MinIO URL patterns
      if (!url.includes('minio') && !url.includes(':9000') && !url.includes(':9100')) {
        return { isMinIOUrl: false };
      }
    } else if (!url.includes(minioEndpoint)) {
      return { isMinIOUrl: false };
    }

    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
    
    if (pathParts.length >= 2) {
      const bucket = pathParts[0];
      const filePath = pathParts.slice(1).join('/');
      return { bucket, filePath, isMinIOUrl: true };
    }

    return { isMinIOUrl: true };
  } catch (error) {
    return { isMinIOUrl: false };
  }
}
