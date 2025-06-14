"use server";

import { minioService } from '@/lib/minio';

export async function getStorageBucket(): Promise<string | undefined> {
  return process.env.MINIO_BUCKET_NAME;
}

export async function uploadAudioToMinIOStorage(audioDataUri: string, userId: string, storyId: string, filename: string): Promise<string> {
  if (!audioDataUri || !userId || !storyId || !filename) {
    throw new Error("Missing required parameters for audio upload.");
  }

  let base64Data: string;
  let contentType: string;

  if (audioDataUri.startsWith('data:audio/mpeg;base64,')) {
    base64Data = audioDataUri.substring('data:audio/mpeg;base64,'.length);
    contentType = 'audio/mpeg';
  } else if (audioDataUri.startsWith('data:audio/wav;base64,')) {
    base64Data = audioDataUri.substring('data:audio/wav;base64,'.length);
    contentType = 'audio/wav';
  } else {
    throw new Error('Invalid audio data URI format. Supported formats: audio/mpeg, audio/wav');
  }

  const audioBuffer = Buffer.from(base64Data, 'base64');
  const filePath = minioService.generateFilePath(userId, storyId, filename, 'audio');
  
  // Upload file to MinIO
  await minioService.uploadFile(filePath, audioBuffer, contentType);
  
  // Return a presigned URL that expires in 7 days (matching Firebase behavior)
  return await minioService.getSignedUrl(filePath, 7 * 24 * 60 * 60);
}

export async function uploadImageBufferToMinIOStorage(imageBuffer: Buffer, userId: string, storyId: string, filename: string, contentType: string = 'image/png'): Promise<string> {
  if (!imageBuffer || !userId || !storyId || !filename) {
    throw new Error("Missing required parameters for image buffer upload.");
  }

  const filePath = minioService.generateFilePath(userId, storyId, filename, 'image');
  
  // Upload buffer directly to MinIO
  await minioService.uploadFile(filePath, imageBuffer, contentType);
  
  // Return a presigned URL that expires in 7 days
  return await minioService.getSignedUrl(filePath, 7 * 24 * 60 * 60);
}

export async function uploadImageToMinIOStorage(imageDataUri: string, userId: string, storyId: string, filename: string): Promise<string> {
  if (!imageDataUri || !userId || !storyId || !filename) {
    throw new Error("Missing required parameters for image upload.");
  }

  let base64Data: string;
  let contentType: string;

  if (imageDataUri.startsWith('data:image/jpeg;base64,')) {
    base64Data = imageDataUri.substring('data:image/jpeg;base64,'.length);
    contentType = 'image/jpeg';
  } else if (imageDataUri.startsWith('data:image/png;base64,')) {
    base64Data = imageDataUri.substring('data:image/png;base64,'.length);
    contentType = 'image/png';
  } else if (imageDataUri.startsWith('data:image/webp;base64,')) {
    base64Data = imageDataUri.substring('data:image/webp;base64,'.length);
    contentType = 'image/webp';
  } else {
    throw new Error('Invalid image data URI format. Supported formats: image/jpeg, image/png, image/webp');
  }

  const imageBuffer = Buffer.from(base64Data, 'base64');
  const filePath = minioService.generateFilePath(userId, storyId, filename, 'image');
  
  // Upload file to MinIO
  await minioService.uploadFile(filePath, imageBuffer, contentType);
  
  // Return a presigned URL that expires in 7 days
  return await minioService.getSignedUrl(filePath, 7 * 24 * 60 * 60);
}

export async function refreshMinIOStorageUrl(url: string, userId: string, storyId: string, filePath?: string): Promise<string | null> {
  if (!url || typeof url !== 'string') return null;

  const bucketName = await getStorageBucket();
  const minioEndpoint = process.env.MINIO_ENDPOINT;
  
  if (!bucketName || !minioEndpoint || !url.includes(minioEndpoint)) {
    return null;
  }

  try {
    console.log(`[refreshMinIOStorageUrl] Refreshing signed URL for: ${url}`);

    if (!filePath) {
      try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/');
        
        // Extract file path from MinIO URL structure
        // URL format: http://endpoint/bucket/users/userId/stories/storyId/folder/file
        const bucketIndex = pathParts.findIndex(part => part === bucketName);
        if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
          filePath = pathParts.slice(bucketIndex + 1).join('/');
        } else {
          console.warn(`[refreshMinIOStorageUrl] Could not extract file path from URL: ${url}`);
          return null;
        }
      } catch (urlParseError) {
        console.error(`[refreshMinIOStorageUrl] Failed to parse URL: ${url}`, urlParseError);
        return null;
      }
    }

    if (!filePath) {
      console.warn(`[refreshMinIOStorageUrl] No file path available for URL: ${url}`);
      return null;
    }

    // Generate new signed URL for 7 days
    const newSignedUrl = await minioService.getSignedUrl(filePath, 7 * 24 * 60 * 60);
    console.log(`[refreshMinIOStorageUrl] Successfully refreshed URL for file: ${filePath}`);
    
    return newSignedUrl;
  } catch (error) {
    console.error(`[refreshMinIOStorageUrl] Error refreshing signed URL for: ${url}`, error);
    return null;
  }
}

export async function deleteFileFromMinIOStorage(filePath: string): Promise<void> {
  if (!filePath) {
    throw new Error("File path is required for deletion.");
  }

  try {
    await minioService.deleteFile(filePath);
    console.log(`[deleteFileFromMinIOStorage] Successfully deleted file: ${filePath}`);
  } catch (error) {
    console.error(`[deleteFileFromMinIOStorage] Failed to delete file: ${filePath}`, error);
    throw error;
  }
}

export async function deleteFolderFromMinIOStorage(folderPath: string): Promise<void> {
  if (!folderPath) {
    throw new Error("Folder path is required for deletion.");
  }

  try {
    // Ensure folder path ends with / for proper prefix matching
    const normalizedFolderPath = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;
    
    // List all files in the folder
    const files = await minioService.listFiles(normalizedFolderPath);
    
    if (files.length === 0) {
      console.log(`[deleteFolderFromMinIOStorage] No files found in folder: ${folderPath}`);
      return;
    }

    // Delete all files in parallel
    await Promise.all(files.map(filePath => minioService.deleteFile(filePath)));
    
    console.log(`[deleteFolderFromMinIOStorage] Successfully deleted ${files.length} files from folder: ${folderPath}`);
  } catch (error) {
    console.error(`[deleteFolderFromMinIOStorage] Failed to delete folder: ${folderPath}`, error);
    throw error;
  }
}

export async function listFilesInMinIOStorage(prefix: string): Promise<string[]> {
  try {
    const files = await minioService.listFiles(prefix);
    return files;
  } catch (error) {
    console.error(`[listFilesInMinIOStorage] Failed to list files with prefix: ${prefix}`, error);
    throw error;
  }
}

export async function downloadFileFromMinIOStorage(filePath: string): Promise<Buffer> {
  if (!filePath) {
    throw new Error("File path is required for download.");
  }

  try {
    const fileBuffer = await minioService.downloadFile(filePath);
    console.log(`[downloadFileFromMinIOStorage] Successfully downloaded file: ${filePath}`);
    return fileBuffer;
  } catch (error) {
    console.error(`[downloadFileFromMinIOStorage] Failed to download file: ${filePath}`, error);
    throw error;
  }
}

export async function getFileSignedUrl(filePath: string, expiresInSeconds: number = 7 * 24 * 60 * 60): Promise<string> {
  if (!filePath) {
    throw new Error("File path is required to generate signed URL.");
  }

  try {
    const signedUrl = await minioService.getSignedUrl(filePath, expiresInSeconds);
    console.log(`[getFileSignedUrl] Generated signed URL for file: ${filePath}`);
    return signedUrl;
  } catch (error) {
    console.error(`[getFileSignedUrl] Failed to generate signed URL for file: ${filePath}`, error);
    throw error;
  }
}

export async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    await minioService.downloadFile(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

export async function getStorageUsage(userId: string): Promise<{ fileCount: number; totalSizeBytes: number }> {
  try {
    const userPrefix = `users/${userId}/`;
    const files = await minioService.listFiles(userPrefix);
    
    // Note: MinIO listFiles doesn't return file sizes by default
    // This would need enhancement in the minioService if detailed size info is needed
    return {
      fileCount: files.length,
      totalSizeBytes: 0 // Would need additional MinIO API calls to get sizes
    };
  } catch (error) {
    console.error(`[getStorageUsage] Failed to get storage usage for user: ${userId}`, error);
    throw error;
  }
}


