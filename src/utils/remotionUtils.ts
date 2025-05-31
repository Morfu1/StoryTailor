import path from 'path';
import os from 'os';
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
  const headerArray = new Uint8Array(buffer, 0, headerSize);
  const dataArray = new Uint8Array(buffer, headerSize);
  const pcmArray = new Uint8Array(pcmData);
  dataArray.set(pcmArray);
  
  return buffer;
}

// Check if we're in a Node.js environment
const isNode = typeof window === 'undefined';

// Server-side module loaders
const loadBundler = () => {
  try {
    return require('@remotion/bundler');
  } catch (error) {
    console.error('Failed to load @remotion/bundler:', error);
    return null;
  }
};

const loadRenderer = () => {
  try {
    const renderer = require('@remotion/renderer');
    return {
      renderMedia: renderer.renderMedia,
      selectComposition: renderer.selectComposition
    };
  } catch (error) {
    console.error('Failed to load @remotion/renderer:', error);
    return null;
  }
};

// Lazy-loaded module references
let bundleModule: any = null;
let renderMediaModule: any = null;
let selectCompositionModule: any = null;

// Handle Remotion environment setup
if (isNode) {
  // Configure environment before loading modules
  try {
    // Determine platform
    const platform = os.platform();
    console.log('Current platform:', platform);
    
    // Set environment variables to optimize Remotion behavior
    process.env.REMOTION_BINARY_LOCATION = 'mock';
    process.env.SKIP_DOWNLOADING_REMOTION_BINARIES = 'true';
    
    // Force Remotion to use specific render mode
    process.env.REMOTION_DISABLE_COMPOSITOR = 'true';
    
    // Load modules only when needed, not on initial import
  } catch (error) {
    console.error('Error configuring Remotion environment:', error);
  }
}

// Helper function to ensure modules are loaded
const ensureRemotionModules = () => {
  if (!bundleModule) {
    bundleModule = loadBundler();
    if (!bundleModule) {
      throw new Error('Failed to load @remotion/bundler module');
    }
  }
  
  if (!renderMediaModule || !selectCompositionModule) {
    const renderer = loadRenderer();
    if (!renderer) {
      throw new Error('Failed to load @remotion/renderer module');
    }
    renderMediaModule = renderer.renderMedia;
    selectCompositionModule = renderer.selectComposition;
  }
  
  return {
    bundleModule,
    renderMediaModule,
    selectCompositionModule
  };
};

import { GeneratedImage } from '@/types/story';

interface RenderVideoProps {
  images: (string | GeneratedImage)[]; // Array of image URLs or GeneratedImage objects
  audioChunks: NarrationChunk[]; // Array of narration chunks
  storyTitle: string;
}

/**
 * Renders a video using Remotion with the provided images and audio chunks.
 * @param images - Array of image URLs
 * @param audioChunks - Array of narration chunks
 * @param storyTitle - Title of the story
 * @returns The path to the rendered video
 */
export const renderStoryVideo = async ({
  images,
  audioChunks,
  storyTitle
}: RenderVideoProps): Promise<string> => {
  try {
    // Check if we're in a Node.js environment
    if (!isNode) {
      throw new Error('Video rendering is only supported on the server side');
    }
    
    // Create a temporary directory to store the composition bundle
    const tmpDir = path.join(os.tmpdir(), 'remotion-render');
    fs.mkdirSync(tmpDir, { recursive: true });
    
    console.log('Loading Remotion modules on demand...');
    
    // Ensure Remotion modules are loaded when needed
    const modules = ensureRemotionModules();
    console.log('Remotion modules loaded successfully');
    
    // Bundle the composition
    console.log('Bundling composition...');
    const bundle = await modules.bundleModule.bundle(
      path.resolve(process.cwd(), 'src', 'remotion', 'index.ts'),
      undefined,
      {
        cacheDir: tmpDir,
      }
    );
    
    // Select the composition from the bundle
    console.log('Selecting composition...');
    const composition = await modules.selectCompositionModule({
      serveUrl: bundle.url,
      id: 'StoryVideo',
      inputProps: {
        images,
        audioChunks,
      },
    });
    
    const outputLocation = path.join(
      tmpDir,
      `${storyTitle.replace(/[^a-zA-Z0-9]/g, '_')}.mp4`
    );
    
    // Render the video
    console.log('Rendering video to:', outputLocation);
    await modules.renderMediaModule({
      composition,
      serveUrl: bundle.url,
      codec: 'h264',
      outputLocation,
      inputProps: {
        images,
        audioChunks,
      },
    });
    
    console.log('Video rendering completed');
    // Return the output location
    return outputLocation;
  } catch (error) {
    console.error('Error rendering video:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to render video: ${errorMessage}`);
  }
};

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
  audioChunks: NarrationChunk[]
): Promise<{ localImages: LocalImageWithMetadata[]; localAudioChunks: NarrationChunk[]; imageDimensions?: { width: number; height: number } }> => {
  if (!isNode) {
    throw new Error('Asset downloading is only supported on the server side');
  }
  
  const publicDir = path.join(process.cwd(), 'public');
  const assetsDir = path.join(publicDir, 'remotion-assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  
  console.log(`Downloading ${images.length} images and ${audioChunks.length} audio chunks...`);
  
  let detectedDimensions: { width: number; height: number } | undefined;
  const placeholderLocalPath = 'remotion-assets/placeholder.jpg';

  // Create placeholder image once
  try {
    const placeholderData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync(path.join(assetsDir, 'placeholder.jpg'), placeholderData);
  } catch (error) {
    console.error('Failed to create placeholder image:', error);
    // Not throwing, as placeholder might not be strictly necessary if all images download
  }
  
  // Cleanup previous assets
  try {
    const existingFiles = fs.readdirSync(assetsDir);
    for (const file of existingFiles) {
      if (file !== 'placeholder.jpg') { // Don't delete the placeholder we just made
        fs.unlinkSync(path.join(assetsDir, file));
      }
    }
  } catch (error) {
    console.warn('Could not clean up previous assets:', error);
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


      if (imageUrl.startsWith('remotion-assets/')) {
        const fullPath = path.join(publicDir, imageUrl);
        if (fs.existsSync(fullPath)) {
          console.log(`Image ${index} already a local asset: ${imageUrl}`);
          return { localPath: imageUrl, originalUrl: imageUrl, chunkId, chunkIndex, originalPrompt };
        } else {
          console.warn(`Image ${index} references non-existent local asset: ${fullPath}, attempting download.`);
          // Continue to download logic if local asset is missing
        }
      }
      
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
      
      // If already a local asset path, verify and use
      if (chunk.audioUrl.startsWith('remotion-assets/')) {
        const fullPath = path.join(publicDir, chunk.audioUrl);
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).size > 0) {
          return chunk; // Already local and valid
        }
        // If local path is invalid, proceed to download
        console.warn(`Audio chunk ${index} references non-existent local asset: ${chunk.audioUrl}, attempting download.`);
      }
      
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
  
  // Create directory if it doesn't exist
  const downloadDir = path.join(process.cwd(), 'public', 'downloads', 'videos');
  fs.mkdirSync(downloadDir, { recursive: true });
  
  // Create a safe filename from the story ID
  const safeStoryId = storyId.replace(/[^a-zA-Z0-9-_]/g, '_');
  const filename = `${safeStoryId}-${Date.now()}.mp4`;
  const publicPath = path.join(downloadDir, filename);
  
  // Copy file to public directory
  fs.copyFileSync(videoPath, publicPath);
  
  // Note: Asset cleanup is handled separately to avoid interfering with CLI rendering
  
  // Return the relative path for frontend access
  return `/downloads/videos/${filename}`;
};

/**
 * Cleans up old assets from the public/remotion-assets directory
 * Called after a successful video render to prevent accumulation of files
 */
export const cleanupRemotionAssets = (): void => {
  if (!isNode) return;
  
  try {
    const assetsDir = path.join(process.cwd(), 'public', 'remotion-assets');
    if (fs.existsSync(assetsDir)) {
      const files = fs.readdirSync(assetsDir);
      
      // Delete all files in the directory
      for (const file of files) {
        fs.unlinkSync(path.join(assetsDir, file));
      }
      
      console.log(`Cleaned up ${files.length} temporary Remotion assets`);
    }
  } catch (error) {
    console.error('Error cleaning up Remotion assets:', error);
    // Don't throw, just log the error - we don't want to fail the video saving
  }
};