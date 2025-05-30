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

interface RenderVideoProps {
  images: string[]; // Array of image URLs
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
 * Downloads images and audio files from URLs to local files.
 * This is necessary because Remotion needs local files for rendering.
 */
export const downloadAssetsForRendering = async (
  images: string[],
  audioChunks: NarrationChunk[]
): Promise<{ localImages: string[]; localAudioChunks: NarrationChunk[] }> => {
  if (!isNode) {
    throw new Error('Asset downloading is only supported on the server side');
  }
  
  // Create directory in public folder for assets
  // This is required because staticFile() only works with files in the public folder
  const publicDir = path.join(process.cwd(), 'public');
  const assetsDir = path.join(publicDir, 'remotion-assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  
  console.log(`Downloading ${images.length} images and ${audioChunks.length} audio chunks...`);
  
  // Create a placeholder image to use as fallback
  const placeholderImagePath = path.join(assetsDir, 'placeholder.jpg');
  try {
    // Simple 1x1 black pixel as a placeholder
    const placeholderData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync(placeholderImagePath, placeholderData);
    console.log('Created placeholder image at', placeholderImagePath);
  } catch (error) {
    console.error('Failed to create placeholder image:', error);
  }
  
  // Ensure we clean up any previous assets except the placeholder
  try {
    const existingFiles = fs.readdirSync(assetsDir);
    for (const file of existingFiles) {
      if (file !== 'placeholder.jpg') {
        fs.unlinkSync(path.join(assetsDir, file));
      }
    }
    console.log(`Cleaned up ${existingFiles.length} previous assets`);
  } catch (error) {
    console.warn('Could not clean up previous assets:', error);
  }
  
  // Download images
  const localImages = await Promise.all(
    images.map(async (imageUrl, index) => {
      try {
        if (!imageUrl) {
          console.warn(`No URL for image ${index}, skipping`);
          return 'remotion-assets/placeholder.jpg';
        }
        
        // If the image is already a relative path in the public folder, use it directly
        if (imageUrl.startsWith('remotion-assets/')) {
          const fullPath = path.join(publicDir, imageUrl);
          if (fs.existsSync(fullPath)) {
            console.log(`Image ${index} already exists in public folder: ${imageUrl}`);
            return imageUrl;
          } else {
            console.warn(`Image ${index} references a non-existent path: ${fullPath}`);
            return 'remotion-assets/placeholder.jpg';
          }
        }
        
        console.log(`Downloading image ${index}: ${imageUrl.substring(0, 50)}...`);
        
        let response;
        try {
          response = await fetch(imageUrl);
        } catch (fetchError) {
          console.error(`Network error fetching image ${index}:`, fetchError);
          return 'remotion-assets/placeholder.jpg';
        }
        
        if (!response.ok) {
          console.error(`Failed to fetch image ${index}: ${response.status} ${response.statusText}`);
          return 'remotion-assets/placeholder.jpg';
        }
        
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength === 0) {
          console.error(`Downloaded empty image ${index} from ${imageUrl}`);
          return 'remotion-assets/placeholder.jpg';
        }
        
        const filename = `image-${index}.jpg`;
        const localPath = path.join(assetsDir, filename);
        fs.writeFileSync(localPath, Buffer.from(buffer));
        
        // Verify the file was written correctly
        if (!fs.existsSync(localPath) || fs.statSync(localPath).size === 0) {
          console.error(`Failed to write image ${index} to ${localPath}`);
          return 'remotion-assets/placeholder.jpg';
        }
        
        console.log(`Successfully downloaded image ${index} to remotion-assets/${filename}`);
        
        // Return just the filename for staticFile() to use
        return `remotion-assets/${filename}`;
      } catch (error) {
        console.error(`Error processing image ${index}:`, error);
        // Return a placeholder instead of throwing - we want to continue with other images
        return 'remotion-assets/placeholder.jpg';
      }
    })
  );
    
  console.log(`Successfully processed ${localImages.length} images`);
  
  // Verify all images exist in the public folder
  const verifiedImages = localImages.map((imgPath, index) => {
    const fullPath = path.join(publicDir, imgPath);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).size > 0) {
      return imgPath;
    } else {
      console.warn(`Image path ${imgPath} doesn't exist or is empty, using placeholder for index ${index}`);
      return 'remotion-assets/placeholder.jpg';
    }
  });
  
  // Create a placeholder image if we need one
  if (localImages.some(img => img === null)) {
    try {
      // Simple 1x1 black pixel as a placeholder
      const placeholderData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      const placeholderPath = path.join(assetsDir, 'placeholder.jpg');
      fs.writeFileSync(placeholderPath, placeholderData);
      console.log('Created placeholder image');
    } catch (error) {
      console.error('Failed to create placeholder image:', error);
    }
  }
  
  // Download audio files
  const localAudioChunks = await Promise.all(
    audioChunks.map(async (chunk, index) => {
      if (!chunk.audioUrl) {
        console.warn(`No audio URL for chunk ${index}, skipping`);
        return chunk;
      }
      
      // Check if it's already a local path
      if (chunk.audioUrl.startsWith('remotion-assets/')) {
        const fullPath = path.join(publicDir, chunk.audioUrl);
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).size > 0) {
          console.log(`Audio chunk ${index} already exists in public folder: ${chunk.audioUrl}`);
          return chunk;
        }
      }
      
      try {
        console.log(`Downloading audio chunk ${index}: ${chunk.audioUrl.substring(0, 50)}...`);
        
        let response;
        try {
          response = await fetch(chunk.audioUrl);
        } catch (fetchError) {
          console.error(`Network error fetching audio for chunk ${index}:`, fetchError);
          return chunk;
        }
        
        if (!response.ok) {
          console.error(`Failed to fetch audio for chunk ${index}: ${response.status} ${response.statusText}`);
          return chunk;
        }
        
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength === 0) {
          console.error(`Downloaded empty audio file for chunk ${index}`);
          return chunk;
        }
        
        // Check file type - Google TTS returns PCM, ElevenLabs returns MP3
        const view = new Uint8Array(buffer);
        
        // Check for WAV header (RIFF)
        const isWav = view[0] === 0x52 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x46;
        
        // Check for MP3 header (ID3 tag or MP3 frame sync)
        const isMp3 = (view[0] === 0x49 && view[1] === 0x44 && view[2] === 0x33) || // ID3 tag
                      (view[0] === 0xFF && (view[1] & 0xE0) === 0xE0); // MP3 frame sync
        
        let finalBuffer: Buffer;
        let filename: string;
        
        if (isWav) {
          // Already a complete WAV file
          console.log(`Audio chunk ${index} is already a complete WAV file`);
          finalBuffer = Buffer.from(buffer);
          filename = `audio-${index}.wav`;
        } else if (isMp3) {
          // Complete MP3 file from ElevenLabs - keep as MP3
          console.log(`Audio chunk ${index} is MP3 from ElevenLabs`);
          finalBuffer = Buffer.from(buffer);
          filename = `audio-${index}.mp3`;
        } else {
          // This is raw PCM data from Google TTS, add WAV headers
          console.log(`Converting raw PCM data from Google TTS to WAV format for chunk ${index}`);
          const wavBuffer = addWavHeadersToBuffer(buffer);
          finalBuffer = Buffer.from(wavBuffer);
          filename = `audio-${index}.wav`;
        }
        
        const localPath = path.join(assetsDir, filename);
        fs.writeFileSync(localPath, finalBuffer);
        
        // Verify the file was written successfully
        if (!fs.existsSync(localPath) || fs.statSync(localPath).size === 0) {
          console.error(`Failed to write audio file for chunk ${index}`);
          return chunk;
        }
        
        console.log(`Successfully downloaded audio chunk ${index} to remotion-assets/${filename}`);
        
        return {
          ...chunk,
          // Use relative path for staticFile()
          audioUrl: `remotion-assets/${filename}`,
        };
      } catch (error) {
        console.error(`Error downloading audio chunk ${index}:`, error);
        // Return the original chunk without modifying the URL - it will be skipped during rendering
        return chunk;
      }
    })
  );
  
  console.log(`Successfully processed ${localAudioChunks.filter(c => c.audioUrl?.includes('remotion-assets/')).length} audio chunks`);
  
  return {
    localImages: verifiedImages,
    localAudioChunks
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
  
  // Clean up temporary Remotion assets
  cleanupRemotionAssets();
  
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