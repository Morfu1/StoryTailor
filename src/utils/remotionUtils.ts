
import path from 'path';
// import os from 'os'; // Unused
import fs from 'fs';
import { NarrationChunk } from '@/types/narration';

/**
 * Add WAV headers to raw PCM data from Google TTS
 * Google TTS returns 24kHz, 16-bit, mono PCM data
 */
function addWavHeadersToBuffer(pcmData: ArrayBuffer): ArrayBuffer {
  const pcmBytes = pcmData.byteLength;
  const sampleRate = 24000; // Google TTS uses 24kHz
  const numChannels = 1; // Mono
  const bitsPerSample = 16; // 16-bit
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  
  // WAV header is 44 bytes
  const headerSize = 44;
  const fileSize = headerSize + pcmBytes;
  
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);
  
  // RIFF header
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, fileSize - 8, true); // File size - 8
  view.setUint32(8, 0x57415645, false); // "WAVE"
  
  // fmt chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // Audio format (1 = PCM)
  view.setUint16(22, numChannels, true); // Number of channels
  view.setUint32(24, sampleRate, true); // Sample rate
  view.setUint32(28, byteRate, true); // Byte rate
  view.setUint16(32, blockAlign, true); // Block align
  view.setUint16(34, bitsPerSample, true); // Bits per sample
  
  // data chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, pcmBytes, true); // Data size
  
  // Copy PCM data
  // const headerArray = new Uint8Array(buffer, 0, headerSize); // Unused
  const dataArray = new Uint8Array(buffer, headerSize);
  const pcmArray = new Uint8Array(pcmData);
  dataArray.set(pcmArray);
  
  return buffer;
}

// Check if we're in a Node.js environment
const isNode = typeof window === 'undefined';

// [REMOVED] Programmatic Remotion bundling/rendering helpers and env setup.
// This section (originally lines 57-129) was removed to prevent Next.js build errors
// caused by Webpack attempting to bundle `@remotion/bundler`.
// The project uses a CLI-based approach for Remotion rendering.

import { GeneratedImage } from '@/types/story';

// [REMOVED] Programmatic Remotion bundling/rendering function `renderStoryVideo` and its `RenderVideoProps` interface.
// This section (originally lines 132-214) was removed as it also relied on the problematic `require('@remotion/bundler')`.

/**
 * Helper function to detect image dimensions from a buffer
 */
const getImageDimensionsFromBuffer = (buffer: ArrayBuffer): { width: number; height: number } | null => {
  try {
    const uint8Array = new Uint8Array(buffer);
    
    // Check for JPEG
    if (uint8Array[0] === 0xFF && uint8Array[1] === 0xD8) {
      // JPEG format - scan for SOF markers
      for (let i = 2; i < uint8Array.length - 8; i++) {
        if (uint8Array[i] === 0xFF) {
          const marker = uint8Array[i + 1];
          // SOF0, SOF1, SOF2 markers
          if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
            const height = (uint8Array[i + 5] << 8) | uint8Array[i + 6];
            const width = (uint8Array[i + 7] << 8) | uint8Array[i + 8];
            return { width, height };
          }
        }
      }
    }
    
    // Check for PNG
    if (uint8Array[0] === 0x89 && uint8Array[1] === 0x50 && uint8Array[2] === 0x4E && uint8Array[3] === 0x47) {
      // PNG format - IHDR chunk starts at byte 16
      const width = (uint8Array[16] << 24) | (uint8Array[17] << 16) | (uint8Array[18] << 8) | uint8Array[19];
      const height = (uint8Array[20] << 24) | (uint8Array[21] << 16) | (uint8Array[22] << 8) | uint8Array[23];
      return { width, height };
    }
    
    // Check for WebP
    if (uint8Array[0] === 0x52 && uint8Array[1] === 0x49 && uint8Array[2] === 0x46 && uint8Array[3] === 0x46 &&
        uint8Array[8] === 0x57 && uint8Array[9] === 0x45 && uint8Array[10] === 0x42 && uint8Array[11] === 0x50) {
      // WebP format - dimensions are at different locations depending on the VP8 variant
      if (uint8Array[12] === 0x56 && uint8Array[13] === 0x50 && uint8Array[14] === 0x38 && uint8Array[15] === 0x20) {
        // VP8 format
        const width = ((uint8Array[26] | (uint8Array[27] << 8)) & 0x3fff);
        const height = ((uint8Array[28] | (uint8Array[29] << 8)) & 0x3fff);
        return { width, height };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error reading image dimensions from buffer:', error);
    return null;
  }
};

/**
 * Downloads images and audio files from URLs to local files.
 * This is necessary because Remotion needs local files for rendering.
 */
// Define LocalImageWithMetadata (ideally in a shared types file)
interface LocalImageWithMetadata {
  localPath: string;
  originalUrl?: string;
  chunkId?: string;
  chunkIndex?: number;
  originalPrompt?: string; // Carry over from GeneratedImage if needed
}

export const downloadAssetsForRendering = async (
  images: (string | GeneratedImage)[],
  audioChunks: NarrationChunk[],
  targetDirectory: string // Added targetDirectory argument
): Promise<{ localImages: LocalImageWithMetadata[]; localAudioChunks: NarrationChunk[]; imageDimensions?: { width: number; height: number } }> => {
  if (!isNode) {
    throw new Error('Asset downloading is only supported on the server side');
  }
  
  // Use targetDirectory for assets, creating a 'remotion-assets' subdirectory within it
  const assetsDir = path.join(targetDirectory, 'remotion-assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  
  console.log(`Downloading ${images.length} images and ${audioChunks.length} audio chunks to ${assetsDir}...`);
  
  let detectedDimensions: { width: number; height: number } | undefined;
  const placeholderFilename = 'placeholder.jpg';
  const placeholderLocalPath = `remotion-assets/${placeholderFilename}`; // Relative path for Remotion props

  // Create placeholder image once in the target assets directory
  try {
    const placeholderData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync(path.join(assetsDir, placeholderFilename), placeholderData);
  } catch (error) {
    console.error('Failed to create placeholder image:', error);
  }
  
  // Cleanup previous assets in the target assets directory
  try {
    const existingFiles = fs.readdirSync(assetsDir);
    for (const file of existingFiles) {
      if (file !== placeholderFilename) { 
        fs.unlinkSync(path.join(assetsDir, file));
      }
    }
  } catch (error) {
    console.warn(`Could not clean up previous assets in ${assetsDir}:`, error);
  }
  
  const processedImages: LocalImageWithMetadata[] = await Promise.all(
    images.map(async (imageInput, index): Promise<LocalImageWithMetadata> => {
      let imageUrl: string | undefined;
      let chunkId: string | undefined;
      let chunkIndex: number | undefined;
      let originalPrompt: string | undefined;

      // Default return object in case of errors, using the placeholder path
      const placeholderReturnObject: LocalImageWithMetadata = {
        localPath: placeholderLocalPath,
        originalUrl: typeof imageInput === 'string' ? imageInput : imageInput?.imageUrl,
        chunkId: undefined,
        chunkIndex: undefined,
        originalPrompt: typeof imageInput === 'string' ? undefined : imageInput?.originalPrompt,
      };

      if (typeof imageInput === 'string') {
        imageUrl = imageInput;
      } else if (imageInput && typeof imageInput === 'object' && imageInput.imageUrl) {
        imageUrl = imageInput.imageUrl;
        chunkId = imageInput.chunkId;
        chunkIndex = imageInput.chunkIndex;
        originalPrompt = imageInput.originalPrompt; // Capture originalPrompt
        console.log(`Image ${index} (GeneratedImage): chunkId=${chunkId}, chunkIndex=${chunkIndex}, originalPrompt=${originalPrompt ? originalPrompt.substring(0,20) + "..." : "N/A"}`);
      } else {
        console.warn(`Invalid image input at index ${index}, using placeholder. Input:`, imageInput);
        return placeholderReturnObject;
      }

      if (!imageUrl) {
        console.warn(`No URL for image ${index}, using placeholder`);
        return placeholderReturnObject;
      }
      
      // Update placeholder's originalUrl if we have one now
      placeholderReturnObject.originalUrl = imageUrl;
      placeholderReturnObject.chunkId = chunkId;
      placeholderReturnObject.chunkIndex = chunkIndex;
      placeholderReturnObject.originalPrompt = originalPrompt;

      // If imageUrl already points to a path within the target assetsDir, check if it exists
      // This logic might be complex if imageUrls can be absolute or relative in different ways.
      // For now, assume imageUrls are external URLs or need to be downloaded.
      // If an image is already in `assetsDir` (e.g. `targetDirectory/remotion-assets/some-image.jpg`),
      // and `imageUrl` is `remotion-assets/some-image.jpg`, this check might be needed.
      // However, the current flow seems to imply downloading everything.
      // Let's simplify by assuming all non-placeholder images are downloaded.

      // The check `imageUrl.startsWith('remotion-assets/')` was tied to `publicDir`.
      // Now `assetsDir` is dynamic. The `localPath` returned should be relative to `assetsDir`'s parent.
      // e.g. if assetsDir is `/abs/path/to/.tmp-docker-input/<jobId>/remotion-assets`,
      // localPath should be `remotion-assets/image-0.jpg`.
      // This is consistent with current `localPath` construction.
      
      try {
        console.log(`Downloading image ${index}: ${imageUrl.substring(0, 50)}...`);
        const response = await fetch(imageUrl);
        if (!response.ok) {
          console.error(`Failed to fetch image ${index} (URL: ${imageUrl}): ${response.status} ${response.statusText}`);
          return placeholderReturnObject;
        }
        
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength === 0) {
          console.error(`Downloaded empty image ${index} from ${imageUrl}`);
          return placeholderReturnObject;
        }
        
        if (!detectedDimensions && index === 0) { // Only detect for the very first image
          const dimensions = getImageDimensionsFromBuffer(buffer);
          if (dimensions) {
            detectedDimensions = dimensions;
            console.log(`Detected image dimensions from first image: ${dimensions.width}x${dimensions.height}`);
          }
        }
        
        const filename = `image-${index}.jpg`; // Consider more unique filenames if needed
        const localFilePath = path.join(assetsDir, filename);
        fs.writeFileSync(localFilePath, Buffer.from(buffer));
        
        if (!fs.existsSync(localFilePath) || fs.statSync(localFilePath).size === 0) {
          console.error(`Failed to write image ${index} to ${localFilePath}`);
          return placeholderReturnObject;
        }
        
        console.log(`Successfully downloaded image ${index} to remotion-assets/${filename}`);
        return {
          localPath: `remotion-assets/${filename}`,
          originalUrl: imageUrl,
          chunkId,
          chunkIndex,
          originalPrompt
        };
      } catch (error) {
        console.error(`Error processing image ${index} (URL: ${imageUrl}):`, error);
        return placeholderReturnObject; // Return placeholder on error
      }
    })
  );
    
  console.log(`Successfully processed ${processedImages.length} images`);
  
  // Audio download logic (remains largely the same, ensure it returns NarrationChunk[])
  const localAudioChunks = await Promise.all(
    audioChunks.map(async (chunk, index) => {
      if (!chunk.audioUrl) {
        console.warn(`No audio URL for chunk ${index}, skipping`);
        return chunk; // Return original chunk
      }
      
      // Similar to images, the check `chunk.audioUrl.startsWith('remotion-assets/')`
      // was tied to `publicDir`. Now `assetsDir` is dynamic.
      // The `audioUrl` in the returned chunk should be relative like `remotion-assets/audio-0.wav`.
      // This is consistent with current `audioUrl` update logic.

      try {
        console.log(`Downloading audio chunk ${index}: ${chunk.audioUrl.substring(0, 50)}...`);
        const response = await fetch(chunk.audioUrl);
        if (!response.ok) {
          console.error(`Failed to fetch audio for chunk ${index} (URL: ${chunk.audioUrl}): ${response.status} ${response.statusText}`);
          return { ...chunk, audioUrl: undefined }; // Mark as failed by removing URL
        }
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength === 0) {
          console.error(`Downloaded empty audio file for chunk ${index}`);
          return { ...chunk, audioUrl: undefined };
        }
        
        const view = new Uint8Array(buffer);
        const isWav = view[0] === 0x52 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x46;
        const isMp3 = (view[0] === 0x49 && view[1] === 0x44 && view[2] === 0x33) || (view[0] === 0xFF && (view[1] & 0xE0) === 0xE0);
        
        let finalBuffer: Buffer;
        let filename: string;
        if (isWav) {
          finalBuffer = Buffer.from(buffer); filename = `audio-${index}.wav`;
        } else if (isMp3) {
          finalBuffer = Buffer.from(buffer); filename = `audio-${index}.mp3`;
        } else {
          const wavBuffer = addWavHeadersToBuffer(buffer);
          finalBuffer = Buffer.from(wavBuffer); filename = `audio-${index}.wav`;
        }
        
        const localAudioPath = path.join(assetsDir, filename);
        fs.writeFileSync(localAudioPath, finalBuffer);
        
        if (!fs.existsSync(localAudioPath) || fs.statSync(localAudioPath).size === 0) {
          console.error(`Failed to write audio file for chunk ${index} to ${localAudioPath}`);
          return { ...chunk, audioUrl: undefined };
        }
        
        console.log(`Successfully downloaded audio chunk ${index} to remotion-assets/${filename}`);
        return { ...chunk, audioUrl: `remotion-assets/${filename}` };
      } catch (error) {
        console.error(`Error downloading audio chunk ${index} (URL: ${chunk.audioUrl}):`, error);
        return { ...chunk, audioUrl: undefined }; // Mark as failed
      }
    })
  );
  
  // Filter out audio chunks that failed to download (audioUrl became undefined)
  const validLocalAudioChunks = localAudioChunks.filter(chunk => chunk.audioUrl !== undefined);
  console.log(`Successfully processed ${validLocalAudioChunks.length} audio chunks with valid local paths`);
  
  return {
    localImages: processedImages, // This is now LocalImageWithMetadata[]
    localAudioChunks: validLocalAudioChunks,
    imageDimensions: detectedDimensions
  };
};

/**
 * Saves the rendered video to the public directory for download
 */
export const saveVideoForDownload = async (
  videoPath: string,
  storyId: string
): Promise<string> => {
  if (!isNode) {
    throw new Error('Saving video is only supported on the server side');
  }
  
  const publicDir = path.join(process.cwd(), 'public');
  const downloadsDir = path.join(publicDir, 'downloads', storyId);
  fs.mkdirSync(downloadsDir, { recursive: true });
  
  const filename = path.basename(videoPath);
  const destinationPath = path.join(downloadsDir, filename);
  
  try {
    fs.copyFileSync(videoPath, destinationPath);
    console.log(`Video copied to ${destinationPath}`);
    
    // Clean up the original video from the temp directory
    try {
      fs.unlinkSync(videoPath);
      console.log(`Temporary video file ${videoPath} deleted.`);
    } catch (cleanupError) {
      console.warn(`Failed to delete temporary video file ${videoPath}:`, cleanupError);
    }
    
    return `/downloads/${storyId}/${filename}`; // Return public URL
  } catch (error) {
    console.error('Error saving video for download:', error);
    throw new Error('Failed to save video for download.');
  }
};

/**
 * Cleans up temporary assets created for a specific Docker rendering job.
 */
export const cleanupRemotionAssets = (jobId: string): void => {
  if (!isNode) {
    console.warn('Asset cleanup is only supported on the server side');
    return;
  }

  const jobTempInputDir = path.join(process.cwd(), '.tmp-remotion-input', jobId);
  const jobTempOutputDir = path.join(process.cwd(), '.tmp-remotion-output', jobId);

  const dirsToClean = [jobTempInputDir, jobTempOutputDir];

  for (const dir of dirsToClean) {
    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
        console.log(`Cleaned up directory: ${dir}`);
      } else {
        console.log(`Directory not found, no cleanup needed: ${dir}`);
      }
    } catch (error) {
      console.error(`Error cleaning up directory ${dir}:`, error);
    }
  }
};
