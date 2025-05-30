import { NextResponse } from 'next/server';
import { downloadAssetsForRendering, saveVideoForDownload } from '@/utils/remotionUtils';
import { NarrationChunk } from '@/types/narration';
import { ensureDownloadsDirectory } from './init-downloads';
import { createVideoJob, updateJobStatus } from '@/utils/videoJobManager';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';

const execAsync = promisify(exec);

/**
 * Background video rendering function that updates job status
 */
async function renderVideoInBackground(
  jobId: string,
  images: string[],
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
    const { localImages, localAudioChunks, imageDimensions } = await downloadAssetsForRendering(images, audioChunks);

    // Calculate optimal video resolution and FPS based on detected image dimensions
    let videoWidth = defaultWidth;
    let videoHeight = defaultHeight;
    let optimalFPS = defaultFPS;
    
    if (imageDimensions) {
      console.log(`Original image dimensions: ${imageDimensions.width}x${imageDimensions.height}`);
      
      // Use smaller resolution for faster rendering if images are small
      if (imageDimensions.width <= 1280 && imageDimensions.height <= 720) {
        videoWidth = imageDimensions.width;
        videoHeight = imageDimensions.height;
        console.log(`Using optimized resolution for faster rendering: ${videoWidth}x${videoHeight}`);
      } else {
        console.log(`Images are large, using Full HD: ${videoWidth}x${videoHeight}`);
      }
      
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
  images,
  audioChunks,
  storyTitle,
  width,
  height,
  fps,
  jobId
}: {
  images: string[];
  audioChunks: NarrationChunk[];
  storyTitle: string;
  width?: number;
  height?: number;
  fps?: number;
  jobId?: string;
}): Promise<string> {
  try {
    console.log('Starting video rendering process...');
    console.log(`Processing ${images.length} images and ${audioChunks.length} audio chunks`);
    
    // Create temporary directories on external drive with more space
    const tmpDir = path.join('/Volumes/McMorfu/Projects/StoryTailor/temp', 'remotion-render');
    fs.mkdirSync(tmpDir, { recursive: true });
    
    // Log information about the props being passed to Remotion
    console.log('Images paths (first 3):', images.slice(0, 3).map(img => img?.substring(0, 30)));
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
      fps
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
    
    // Execute the command with a 10-minute timeout
    const { stdout, stderr } = await execAsync(command, { 
      timeout: 600000, // 10 minutes
      maxBuffer: 1024 * 1024 * 50 // 50MB buffer
    });
    
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
    throw error;
  }
}

interface RenderVideoRequest {
  images: string[];
  audioChunks: NarrationChunk[];
  storyTitle: string;
  storyId: string;
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