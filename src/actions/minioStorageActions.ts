"use server";

import { minioService } from '@/lib/minio';

/**
 * Convert raw PCM data to proper WAV format with headers
 * Google TTS returns 24kHz, 16-bit, mono PCM data
 */
/*
function convertPcmToWav(pcmBuffer: Buffer): Buffer {
  const pcmBytes = pcmBuffer.byteLength;
  const sampleRate = 24000; // Google TTS uses 24kHz
  const numChannels = 1; // Mono
  const bitsPerSample = 16; // 16-bit
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  
  // WAV header is 44 bytes
  const headerSize = 44;
  const fileSize = headerSize + pcmBytes;
  
  const buffer = Buffer.alloc(fileSize);
  
  // RIFF header
  buffer.write('RIFF', 0, 4, 'ascii');
  buffer.writeUInt32LE(fileSize - 8, 4); // File size - 8
  buffer.write('WAVE', 8, 4, 'ascii');
  
  // fmt chunk
  buffer.write('fmt ', 12, 4, 'ascii');
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // Audio format (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22); // Number of channels
  buffer.writeUInt32LE(sampleRate, 24); // Sample rate
  buffer.writeUInt32LE(byteRate, 28); // Byte rate
  buffer.writeUInt16LE(blockAlign, 32); // Block align
  buffer.writeUInt16LE(bitsPerSample, 34); // Bits per sample
  
  // data chunk
  buffer.write('data', 36, 4, 'ascii');
  buffer.writeUInt32LE(pcmBytes, 40); // Data size
  
  // Copy PCM data
  pcmBuffer.copy(buffer, headerSize);
  
  return buffer;
}
*/

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

  // Just like Firebase - save the raw base64 data directly without conversion
  const audioBuffer = Buffer.from(base64Data, 'base64');
  console.log('🎵 Saving audio directly like Firebase (no conversion):');
  console.log('  Buffer size:', audioBuffer.length);
  console.log('  Content type:', contentType);
  
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

export async function uploadImageToMinIOStorage(imageDataUriOrUrl: string, userId: string, storyId: string, filename: string): Promise<string> {
  if (!imageDataUriOrUrl || !userId || !storyId || !filename) {
    throw new Error("Missing required parameters for image upload.");
  }

  let imageBuffer: Buffer;
  let contentType: string;

  // Handle data URI (base64 encoded)
  if (imageDataUriOrUrl.startsWith('data:image/')) {
    let base64Data: string;

    if (imageDataUriOrUrl.startsWith('data:image/jpeg;base64,')) {
      base64Data = imageDataUriOrUrl.substring('data:image/jpeg;base64,'.length);
      contentType = 'image/jpeg';
    } else if (imageDataUriOrUrl.startsWith('data:image/png;base64,')) {
      base64Data = imageDataUriOrUrl.substring('data:image/png;base64,'.length);
      contentType = 'image/png';
    } else if (imageDataUriOrUrl.startsWith('data:image/webp;base64,')) {
      base64Data = imageDataUriOrUrl.substring('data:image/webp;base64,'.length);
      contentType = 'image/webp';
    } else {
      throw new Error('Invalid image data URI format. Supported formats: image/jpeg, image/png, image/webp');
    }

    imageBuffer = Buffer.from(base64Data, 'base64');
  } 
  // Handle HTTP URL - fetch and convert
  else if (imageDataUriOrUrl.startsWith('http://') || imageDataUriOrUrl.startsWith('https://')) {
    try {
      const response = await fetch(imageDataUriOrUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
      
      // Determine content type from response or URL extension
      contentType = response.headers.get('content-type') || 'image/jpeg';
      if (!contentType.startsWith('image/')) {
        // Fallback based on URL extension or default to JPEG
        if (imageDataUriOrUrl.toLowerCase().includes('.png')) {
          contentType = 'image/png';
        } else if (imageDataUriOrUrl.toLowerCase().includes('.webp')) {
          contentType = 'image/webp';
        } else {
          contentType = 'image/jpeg';
        }
      }
    } catch (error) {
      throw new Error(`Failed to download image from URL: ${error}`);
    }
  } 
  else {
    throw new Error('Invalid image input. Must be a data URI (data:image/...) or HTTP URL (http/https)');
  }

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
  } catch {
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


