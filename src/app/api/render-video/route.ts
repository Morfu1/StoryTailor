
import { NextResponse } from 'next/server';
import { downloadAssetsForRendering, saveVideoForDownload, cleanupRemotionAssets } from '@/utils/remotionUtils'; // Added cleanupRemotionAssets
import { NarrationChunk } from '@/types/narration';
import { GeneratedImage } from '@/types/story'; 
import { ensureDownloadsDirectory } from './init-downloads';
import { createVideoJob, updateJobStatus } from '@/utils/videoJobManager';
import { spawn, ChildProcess } from 'child_process'; // Changed from exec to spawn
import path from 'path';
import fs from 'fs';


export const activeRenderProcesses = new Map<string, ChildProcess>();

async function renderVideoInBackground(
  jobId: string,
  images: GeneratedImage[], // Changed from (string | GeneratedImage)[] to GeneratedImage[]
  audioChunks: NarrationChunk[],
  storyTitle: string,
  storyId: string,
  defaultWidth: number,
  defaultHeight: number,
  defaultFPS: number
): Promise<void> {
    // Create simple alphanumeric directories at the project root
    const jobTempDir = path.join(process.cwd(), `remotion_${jobId}`); // Use underscore instead of dot
    const jobTempInputDir = path.join(jobTempDir, 'input');
    const jobTempOutputDir = path.join(jobTempDir, 'output');
    fs.mkdirSync(jobTempInputDir, { recursive: true });
    fs.mkdirSync(jobTempOutputDir, { recursive: true });

  try {
    console.log(`[Job ${jobId}] Checking BROWSER_PATH environment variable:`);
    console.log(`[Job ${jobId}] process.env.BROWSER_PATH: ${process.env.BROWSER_PATH}`);
    console.log(`[Job ${jobId}] process.env.REMOTION_CHROME_PATH: ${process.env.REMOTION_CHROME_PATH}`);
    console.log(`[Job ${jobId}] process.env.REMOTION_BINARY_LOCATION: ${process.env.REMOTION_BINARY_LOCATION}`);
    console.log(`[Job ${jobId}] process.env.CHROME_PATH: ${process.env.CHROME_PATH}`);

    console.log(`Starting background Remotion rendering for job ${jobId}`);
    updateJobStatus(jobId, { status: 'processing', progress: 10 });

    console.log('Downloading assets for rendering to temp directory:', jobTempInputDir);
    updateJobStatus(jobId, { progress: 20 });
    
    const { localImages, localAudioChunks, imageDimensions, placeholderAssetPath } = await downloadAssetsForRendering(images, audioChunks, jobTempInputDir);

    let videoWidth = defaultWidth;
    let videoHeight = defaultHeight;
    let optimalFPS = defaultFPS;
    
    if (imageDimensions) {
      videoWidth = imageDimensions.width;
      videoHeight = imageDimensions.height;
      if (imageDimensions.width <= 640 && imageDimensions.height <= 360) optimalFPS = 12;
    } else {
      console.log(`No image dimensions detected, using default: ${videoWidth}x${videoHeight}`);
    }
    
    console.log(`Preparing video rendering with Remotion CLI for job ${jobId}`);
    updateJobStatus(jobId, { progress: 30 });

    const propsForRemotion: Omit<StoryVideoProps, 'width' | 'height' | 'fps'> & { width?: number, height?: number, fps?: number, detectedDimensions?: {width: number, height: number} } = {
      images: localImages, // These paths are relative to jobTempInputDir's "remotion-assets"
      audioChunks: localAudioChunks,
      storyTitle,
      width: videoWidth,
      height: videoHeight,
      fps: optimalFPS,
      detectedDimensions: imageDimensions,
      placeholderAssetPath: placeholderAssetPath, // Add placeholder path to props
    };
    const propsJsonPathOnHost = path.join(jobTempInputDir, 'props.json');
    const propsJsonContent = JSON.stringify(propsForRemotion, null, 2);
    fs.writeFileSync(propsJsonPathOnHost, propsJsonContent);

    // Log the content of props.json for debugging
    console.log(`[Job ${jobId}] Content of props.json written to ${propsJsonPathOnHost}:`);
    console.log(propsJsonContent);

    // Use root output directory - Remotion CLI will create numbered frames
    const outputDir = jobTempOutputDir;
    fs.mkdirSync(outputDir, { recursive: true });
    
    const outputVideoPathOnHost = outputDir;
    const remotionEntryPoint = 'src/remotion/index.ts'; // Adjust if your entry point is different
    const compositionId = 'StoryVideo'; // Reverted to original
    // const compositionId = 'MinimalTestComposition'; // No longer testing minimal composition

    
    // Set up Remotion CLI with custom asset server
    // Use the output directory directly - Remotion will handle frame naming
    // Simplify command, let Remotion use defaults for sequence rendering
    // Added --image-format=jpeg
    const renderCommandParts = [
      'remotion', 
      'render',
      remotionEntryPoint,
      compositionId,
      outputVideoPathOnHost,
      `--props=${propsJsonPathOnHost}`,
      '--sequence',
      '--concurrency=1',
      '--image-format=jpeg' // Explicitly set image format
      // '--log-level=verbose' // Removed, as component logs are not appearing in stderr
      // '--frames=0-4' // Removed: Render all frames for StoryVideo
    ];

    // Keep essential environment variables
    const env = {
      ...process.env,
      REMOTION_GL_IMPLEMENTATION: 'angle',
      REMOTION_HEADLESS: '1',
      // Explicitly set BROWSER_PATH for macOS if Google Chrome is in the default location
      BROWSER_PATH: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 
      REMOTION_BINARY_LOCATION: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // Also set Remotion's specific vars
      REMOTION_CHROME_PATH: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',   // Also set Remotion's specific vars
      CHROME_PATH: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',             // Also set Remotion's specific vars
      REMOTION_DISABLE_GPU: '1',
      REMOTION_MAX_RETRIES: '3',
      PATH: process.env.PATH,
      DISPLAY: process.env.DISPLAY
      // PUPPETEER_DUMP_BROWSER_LOGS: 'true', // Removed
      // DEBUG: 'remotion:browser,puppeteer:*', // Removed
    };
    
    console.log(`[Job ${jobId}] Using explicit BROWSER_PATH: ${env.BROWSER_PATH}`);
    console.log(`[renderVideoInBackground] Executing Remotion CLI command for job ${jobId}:\n npx ${renderCommandParts.join(' ')}`);
    updateJobStatus(jobId, { progress: 40, status: 'processing' });

    // Use spawn instead of exec for better stream handling
    const child = spawn('npx', renderCommandParts, {
      cwd: process.cwd(),
      env,
      stdio: ['ignore', 'pipe', 'pipe'] // stdin, stdout, stderr
    });

    activeRenderProcesses.set(jobId, child);
    console.log(`Remotion render process started for job ${jobId} with PID: ${child.pid}`);

    let stdoutData = '';
    let stderrData = '';

    if (child.stdout) {
      child.stdout.on('data', (data) => {
        const message = data.toString();
        stdoutData += message;
        // Optional: Log stdout chunks if needed for real-time progress, but can be very verbose
        // console.log(`[Job ${jobId} Remotion stdout chunk]: ${message}`);
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        const message = data.toString();
        stderrData += message;
        // Log stderr chunks immediately as they might contain important errors or StoryVideo.tsx logs
        console.warn(`[Job ${jobId} Remotion stderr chunk]: ${message}`);
      });
    }

    child.on('close', async (code) => {
      activeRenderProcesses.delete(jobId);
      console.log(`[Job ${jobId}] Remotion process exited with code ${code}.`);
      
      console.log(`======== [Job ${jobId}] START Full Remotion stdout ========`);
      console.log(stdoutData);
      console.log(`======== [Job ${jobId}] END Full Remotion stdout ========`);
      
      console.warn(`======== [Job ${jobId}] START Full Remotion stderr ========`);
      console.warn(stderrData);
      console.warn(`======== [Job ${jobId}] END Full Remotion stderr ========`);

      if (code !== 0) {
        console.error(`Remotion render failed for job ${jobId} with exit code ${code}.`);
        updateJobStatus(jobId, {
          status: 'error',
          error: `Remotion render failed with exit code ${code}. Stderr: ${stderrData.substring(0, 1000)}...`, // Truncate stderr for status
          progress: 100
        });
        cleanupRemotionAssets(jobId);
        return;
      }

      // Check for rendered frames in the output directory
      const filesInOutputDir = fs.readdirSync(outputVideoPathOnHost);
      // console.log(`[Job ${jobId}] Files in output directory (${outputVideoPathOnHost}) after Remotion CLI: ${filesInOutputDir.join(', ')}`); // Reduced logging

      if (!filesInOutputDir || filesInOutputDir.length === 0) {
        console.error(`[Job ${jobId}] Render completed but no files were generated in output directory: ${outputVideoPathOnHost}`);
        updateJobStatus(jobId, { 
          status: 'error', 
          error: 'Render completed but no files were generated by Remotion CLI.',
          progress: 100
        });
        cleanupRemotionAssets(jobId);
        return;
      }
      
      // updateJobStatus(jobId, { progress: 90 }); // Reduced logging
      // console.log(`Remotion CLI process completed for job ${jobId}. Output directory: ${outputVideoPathOnHost}. Proceeding to save video.`); // Reduced logging

      try {
        const downloadUrl = await saveVideoForDownload(outputVideoPathOnHost, storyId, optimalFPS); // saveVideoForDownload now logs frame details
        updateJobStatus(jobId, { 
          status: 'completed', 
          downloadUrl, 
          progress: 100 
        });
        console.log(`Video saved for download for job ${jobId}: ${downloadUrl}`);
        // Input assets are cleaned up by cleanupRemotionAssets, output (video) was moved by saveVideoForDownload
        // cleanupRemotionAssets will clean both .tmp-docker-input and .tmp-docker-output
        cleanupRemotionAssets(jobId); 
      } catch (saveError) {
        console.error(`Failed to save video for download for job ${jobId}:`, saveError);
        updateJobStatus(jobId, { 
          status: 'error', 
          error: saveError instanceof Error ? saveError.message : String(saveError),
          progress: 100
        });
        cleanupRemotionAssets(jobId);
      }
    });

    activeRenderProcesses.set(jobId, child);
    console.log(`Remotion render process started for job ${jobId} with PID: ${child.pid}`);

    // Handle cancellation (e.g., if the job is deleted via API while rendering)
    child.on('error', (err) => {
      activeRenderProcesses.delete(jobId);
      console.error(`Failed to start Remotion process for job ${jobId}:`, err);
      updateJobStatus(jobId, {
        status: 'error',
        error: `Failed to start Remotion process: ${err.message}`,
        progress: 100
      });
      cleanupRemotionAssets(jobId);
    });

  } catch (error) {
    console.error(`Error in renderVideoInBackground for job ${jobId}:`, error);
    updateJobStatus(jobId, { 
      status: 'error', 
      error: error instanceof Error ? error.message : String(error) 
    });
    // If an error occurs before exec, it's caught here.
    updateJobStatus(jobId, { 
      status: 'error', 
      error: error instanceof Error ? error.message : String(error) 
    });
    cleanupRemotionAssets(jobId);
  }
}


interface StoryVideoProps extends Record<string, unknown> {
  images: LocalImageWithMetadata[]; 
  audioChunks: NarrationChunk[];
  storyTitle: string;
  fps?: number;
  placeholderAssetPath?: string; // Add placeholder path to props type
}

interface LocalImageWithMetadata {
  localPath: string;
  originalUrl?: string;
  chunkId?: string;
  chunkIndex?: number;
  originalPrompt?: string;
}

interface RenderVideoRequest {
  images: GeneratedImage[]; // Expecting full GeneratedImage objects from client
  audioChunks: NarrationChunk[];
  storyTitle: string;
  storyId: string;
}


export async function POST(req: Request) {
  try {
    ensureDownloadsDirectory();
    const { images, audioChunks, storyTitle, storyId }: RenderVideoRequest = await req.json();

    console.log('Render video request received:', {
      imagesCount: images?.length || 0,
      audioChunksCount: audioChunks?.length || 0,
      storyTitle,
      storyId,
    });

    // Log incoming image chunkIds for debugging
    if (images && images.length > 0) {
      console.log('Incoming image chunkIds:');
      images.slice(0, 10).forEach((img, idx) => { // Log first 10
        console.log(`  Image[${idx}]: chunkId=${img.chunkId}, chunkIndex=${img.chunkIndex}, imageUrl=${img.imageUrl ? img.imageUrl.substring(0,30)+'...' : 'N/A'}`);
      });
      if (images.length > 10) {
        console.log(`  (... and ${images.length - 10} more images)`);
      }
    }


    const job = createVideoJob(storyId, storyTitle);
    
    if (!images || !Array.isArray(images) || images.length === 0) {
      updateJobStatus(job.id, {status: 'error', error: 'Missing or invalid images array'});
      return NextResponse.json({ error: 'Missing or invalid images array' }, { status: 400 });
    }
    if (!audioChunks || !Array.isArray(audioChunks) || audioChunks.length === 0) {
      updateJobStatus(job.id, {status: 'error', error: 'Missing or invalid audioChunks array'});
      return NextResponse.json({ error: 'Missing or invalid audioChunks array' }, { status: 400 });
    }
    const validAudioChunks = audioChunks.filter(chunk => chunk.audioUrl);
    if (validAudioChunks.length === 0) {
      updateJobStatus(job.id, {status: 'error', error: 'No audio chunks with valid audio URLs provided'});
      return NextResponse.json({ error: 'No audio chunks with valid audio URLs provided' }, { status: 400 });
    }
    if (!storyTitle) {
      updateJobStatus(job.id, {status: 'error', error: 'Missing story title'});
      return NextResponse.json({ error: 'Missing story title' }, { status: 400 });
    }
    if (!storyId) {
      updateJobStatus(job.id, {status: 'error', error: 'Missing story ID'});
      return NextResponse.json({ error: 'Missing story ID' }, { status: 400 });
    }

    // Start background Remotion rendering process (don't await)
    renderVideoInBackground(
      job.id,
      images, // Pass GeneratedImage[]
      audioChunks,
      storyTitle,
      storyId,
      1920, 
      1080,
      15 
    ).catch(error => {
      console.error(`Background Remotion rendering process failed for job ${job.id}:`, error);
      // Status is already updated to 'error' inside renderVideoInBackground if it fails there.
    });

    return NextResponse.json({ 
      jobId: job.id,
      message: 'Video rendering process started with Remotion CLI.',
      status: 'processing' // Initial status, Remotion CLI run is awaited.
    });
  } catch (error) {
    console.error('Error in POST /api/render-video:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    // If job creation failed before this point, we might not have a job ID
    // This catch is for errors in the main request handler itself.
    return NextResponse.json(
      { error: `Failed to initiate video rendering: ${errorMessage}` },
      { status: 500 }
    );
  }
}
