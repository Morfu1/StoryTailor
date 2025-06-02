
import { NextResponse } from 'next/server';
import { downloadAssetsForRendering, saveVideoForDownload } from '@/utils/remotionUtils';
import { NarrationChunk } from '@/types/narration';
import { GeneratedImage } from '@/types/story'; // Import GeneratedImage
import { ensureDownloadsDirectory } from './init-downloads';
import { createVideoJob, updateJobStatus } from '@/utils/videoJobManager';
import { exec, ChildProcess } from 'child_process'; // Import ChildProcess
// import { promisify } from 'util'; // Unused
import path from 'path';
import fs from 'fs';
// import os from 'os'; // Unused

// const execAsync = promisify(exec); // Unused

// Map to store active rendering processes
export const activeRenderProcesses = new Map<string, ChildProcess>();

/**
 * Background video rendering function that updates job status
 */
async function renderVideoInBackground(
  jobId: string,
  images: (string | GeneratedImage)[], // This is the input from the request
  audioChunks: NarrationChunk[],
  storyTitle: string,
  storyId: string,
  defaultWidth: number,
  defaultHeight: number,
  defaultFPS: number
): Promise<void> {
  try {
    console.log(`Starting background rendering for job ${jobId}`);
    updateJobStatus(jobId, { status: 'processing', progress: 10 });

    // Download assets for rendering
    console.log('Downloading assets for rendering...');
    updateJobStatus(jobId, { progress: 20 });
    // LocalImageWithMetadata is defined at the module scope later

    const { localImages, localAudioChunks, imageDimensions } = await downloadAssetsForRendering(images, audioChunks); // Type assertion removed, will rely on downloadAssetsForRendering's return type

    // Calculate optimal video resolution and FPS based on detected image dimensions
    let videoWidth = defaultWidth;
    let videoHeight = defaultHeight;
    let optimalFPS = defaultFPS;
    
    if (imageDimensions) {
      console.log(`Original image dimensions: ${imageDimensions.width}x${imageDimensions.height}`);
      
      // Always use detected image dimensions to match the actual image size
      videoWidth = imageDimensions.width;
      videoHeight = imageDimensions.height;
      console.log(`Using detected image resolution: ${videoWidth}x${videoHeight}`);
      
      // Optimize FPS based on image size for even faster rendering
      if (imageDimensions.width <= 640 && imageDimensions.height <= 360) {
        optimalFPS = 12; // Even faster for very small images
      }
    } else {
      console.log(`No image dimensions detected, using default: ${videoWidth}x${videoHeight}`);
    }
    
    console.log(`Using optimal FPS: ${optimalFPS} for rendering speed`);

    // Render the video
    console.log('Rendering video...');
    updateJobStatus(jobId, { progress: 30 });
    const videoPath = await renderStoryVideoWithCLI({
      images: localImages,
      audioChunks: localAudioChunks,
      storyTitle,
      width: videoWidth,
      height: videoHeight,
      fps: optimalFPS,
      detectedDimensions: imageDimensions,
      jobId, // Pass job ID for progress tracking
    });

    updateJobStatus(jobId, { progress: 80 });

    // Save the video for download
    console.log('Saving video for download...');
    const downloadUrl = await saveVideoForDownload(videoPath, storyId);
    
    updateJobStatus(jobId, { progress: 90 });

    // Clean up assets after successful render and save
    console.log('Cleaning up temporary assets...');
    try {
      const { cleanupRemotionAssets } = await import('@/utils/remotionUtils');
      cleanupRemotionAssets();
    } catch (error) {
      console.warn('Failed to cleanup assets:', error);
    }

    // Mark job as completed
    updateJobStatus(jobId, { 
      status: 'completed', 
      progress: 100, 
      downloadUrl 
    });

    console.log(`Background rendering completed for job ${jobId}`);
  } catch (error) {
    console.error(`Background rendering failed for job ${jobId}:`, error);
    updateJobStatus(jobId, { 
      status: 'error', 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
}

/**
 * Renders a video using the Remotion CLI approach
 * This avoids React context issues in server components
 */
async function renderStoryVideoWithCLI({
  images, // Type will be LocalImageWithMetadata[] due to call site
  audioChunks,
  storyTitle,
  width,
  height,
  fps,
  detectedDimensions,
  jobId
}: {
  images: LocalImageWithMetadata[]; // Corrected type for destructuring
  audioChunks: NarrationChunk[];
  storyTitle: string;
  width?: number;
  height?: number;
  fps?: number;
  detectedDimensions?: { width: number; height: number };
  jobId?: string;
}): Promise<string> {
  try {
    console.log('Starting video rendering process...');
    console.log(`Processing ${images.length} images and ${audioChunks.length} audio chunks`);
    
    // Use a project-relative temporary directory
    const tmpDir = path.join(process.cwd(), '.tmp-remotion-render');
    fs.mkdirSync(tmpDir, { recursive: true });
    
    // Log information about the props being passed to Remotion
    console.log('Images (first 3 LocalImageWithMetadata objects):', images.slice(0, 3).map(img => ({
        localPath: img.localPath ? img.localPath.substring(0,30) + "..." : "N/A",
        chunkId: img.chunkId,
        chunkIndex: img.chunkIndex,
        originalUrl: img.originalUrl ? img.originalUrl.substring(0,30) + "..." : "N/A",
        originalPrompt: img.originalPrompt ? img.originalPrompt.substring(0,20) + "..." : "N/A"
    })));
    console.log('Audio chunks (first 3):', audioChunks.slice(0, 3).map(chunk => ({
      id: chunk.id,
      hasAudio: !!chunk.audioUrl,
      audioPath: chunk.audioUrl?.substring(0, 30),
      text: chunk.text?.substring(0, 20)
    })));
    
    // Create a temporary JSON file to store the props
    const propsPath = path.join(tmpDir, 'props.json');
    const propsData = {
      images,
      audioChunks: audioChunks.map(chunk => ({
        ...chunk,
        // Ensure text field doesn't have any problematic characters for JSON
        text: chunk.text || ''
      })),
      width,
      height,
      fps,
      detectedDimensions
    };
    
    fs.writeFileSync(
      propsPath,
      JSON.stringify(propsData, null, 2)
    );
    
    console.log(`Props saved to ${propsPath}`);
    
    // Output filename
    const outputFilename = `${storyTitle.replace(/[^a-zA-Z0-9]/g, '_')}.mp4`;
    const outputPath = path.join(tmpDir, outputFilename);
    
    // Path to the Remotion entry point that calls registerRoot
    const entryPointPath = path.resolve(process.cwd(), 'src', 'remotion', 'index.ts');
    
    console.log('Rendering video using Remotion CLI...');
    
    if (jobId) {
      updateJobStatus(jobId, { progress: 40 });
    }
    
    // Use npx to run remotion render command with optimized settings for low resources
    const command = `npx remotion render "${entryPointPath}" StoryVideo "${outputPath}" --props="${propsPath}" --disable-web-security --log=verbose --concurrency=1 --temp-dir="${tmpDir}" --timeout=30000 --delayRenderTimeoutInMilliseconds=30000`;
    
    console.log(`Executing command: ${command}`);
    
    if (jobId) {
      updateJobStatus(jobId, { progress: 50 });
    }

    // Execute the command and manage the child process
    const executionPromise = new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const childProcess = exec(command, {
        timeout: 600000, // 10 minutes
        maxBuffer: 1024 * 1024 * 50 // 50MB buffer
      }, (error, stdout, stderr) => {
        if (jobId) {
          activeRenderProcesses.delete(jobId); // Remove process from map on completion/error
        }
        if (error) {
          console.error(`Exec error for job ${jobId}:`, error);
          // Include stdout and stderr in the rejection for better debugging
          reject(new Error(`Command failed: ${error.message}\nStdout: ${stdout}\nStderr: ${stderr}`));
          return;
        }
        resolve({ stdout, stderr });
      });

      if (jobId) {
        activeRenderProcesses.set(jobId, childProcess); // Store process in map
        console.log(`Stored child process for job ${jobId} with PID: ${childProcess.pid}`);
      }

      childProcess.on('exit', (code, signal) => {
        console.log(`Child process for job ${jobId} exited with code ${code} and signal ${signal}`);
        if (jobId) {
          activeRenderProcesses.delete(jobId); // Ensure removal on any exit
        }
      });
    });

    const { stdout, stderr } = await executionPromise;
    
    if (jobId) {
      updateJobStatus(jobId, { progress: 70 });
    }
    
    // Log detailed output for debugging
    console.log('--- REMOTION CLI OUTPUT ---');
    console.log(stdout);
    console.log('--- END REMOTION CLI OUTPUT ---');
    
    if (stderr) {
      console.error('--- REMOTION CLI ERRORS ---');
      console.error(stderr);
      console.error('--- END REMOTION CLI ERRORS ---');
    }
    
    // Verify the file was created
    if (!fs.existsSync(outputPath)) {
      throw new Error('Video file was not created by Remotion CLI');
    }
    
    console.log('Video rendering completed:', outputPath);
    return outputPath;
  } catch (error) {
    console.error('Error rendering video with CLI:', error);
    if (jobId) {
      activeRenderProcesses.delete(jobId); // Ensure removal on error
    }
    throw error;
  }
}

// Removed duplicate GeneratedImage import, it's already at the top (line 4)

// RenderVideoRequest defines the API input structure
interface RenderVideoRequest {
  images: (string | GeneratedImage)[];
  audioChunks: NarrationChunk[];
  storyTitle: string;
  storyId: string;
}

// Define LocalImageWithMetadata once at module scope
interface LocalImageWithMetadata {
  localPath: string;
  originalUrl?: string;
  chunkId?: string;
  chunkIndex?: number;
  originalPrompt?: string;
}

export async function POST(req: Request) {
  try {
    // Ensure the downloads directory exists
    ensureDownloadsDirectory();
    // Parse request body
    const { images, audioChunks, storyTitle, storyId }: RenderVideoRequest = await req.json();

    // Log incoming request data
    console.log('Render video request received:', {
      imagesCount: images?.length || 0,
      audioChunksCount: audioChunks?.length || 0,
      storyTitle,
      storyId,
    });

    // Create a background job for video rendering
    const job = createVideoJob(storyId, storyTitle);
    
    // Validate request data with detailed error messages
    if (!images || !Array.isArray(images)) {
      return NextResponse.json(
        { error: 'Missing or invalid images array' },
        { status: 400 }
      );
    }
    
    if (images.length === 0) {
      return NextResponse.json(
        { error: 'No images provided for rendering' },
        { status: 400 }
      );
    }
    
    if (!audioChunks || !Array.isArray(audioChunks)) {
      return NextResponse.json(
        { error: 'Missing or invalid audioChunks array' },
        { status: 400 }
      );
    }
    
    if (audioChunks.length === 0) {
      return NextResponse.json(
        { error: 'No audio chunks provided for rendering' },
        { status: 400 }
      );
    }
    
    // Verify that at least some audio chunks have valid audioUrl
    const validAudioChunks = audioChunks.filter(chunk => chunk.audioUrl);
    if (validAudioChunks.length === 0) {
      return NextResponse.json(
        { error: 'No audio chunks with valid audio URLs provided' },
        { status: 400 }
      );
    }
    
    console.log(`Found ${validAudioChunks.length} valid audio chunks out of ${audioChunks.length} total`);
    
    if (!storyTitle) {
      return NextResponse.json(
        { error: 'Missing story title' },
        { status: 400 }
      );
    }
    
    if (!storyId) {
      return NextResponse.json(
        { error: 'Missing story ID' },
        { status: 400 }
      );
    }

    // Start background rendering immediately (don't await - let it run in background)
    renderVideoInBackground(
      job.id,
      images,
      audioChunks,
      storyTitle,
      storyId,
      1920, // These will be determined in the background function
      1080,
      15
    ).catch(error => {
      console.error(`Background rendering failed for job ${job.id}:`, error);
    });

    // Return job ID immediately so user can check progress
    return NextResponse.json({ 
      jobId: job.id,
      message: 'Video rendering started in background',
      status: 'processing'
    });
  } catch (error) {
    console.error('Error rendering video:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to render video: ${errorMessage}` },
      { status: 500 }
    );
  }
}
