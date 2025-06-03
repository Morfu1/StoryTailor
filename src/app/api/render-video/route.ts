
import { NextResponse } from 'next/server';
import { downloadAssetsForRendering, saveVideoForDownload, cleanupRemotionAssets } from '@/utils/remotionUtils'; // Added cleanupRemotionAssets
import { NarrationChunk } from '@/types/narration';
import { GeneratedImage } from '@/types/story'; 
import { ensureDownloadsDirectory } from './init-downloads';
import { createVideoJob, updateJobStatus } from '@/utils/videoJobManager';
import { exec, ChildProcess } from 'child_process'; 
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
  const jobTempInputDir = path.join(process.cwd(), '.tmp-remotion-input', jobId);
  const jobTempOutputDir = path.join(process.cwd(), '.tmp-remotion-output', jobId);
  fs.mkdirSync(jobTempInputDir, { recursive: true });
  fs.mkdirSync(jobTempOutputDir, { recursive: true });

  try {
    console.log(`Starting background Remotion rendering for job ${jobId}`);
    updateJobStatus(jobId, { status: 'processing', progress: 10 });

    console.log('Downloading assets for rendering to temp directory:', jobTempInputDir);
    updateJobStatus(jobId, { progress: 20 });
    
    const { localImages, localAudioChunks, imageDimensions } = await downloadAssetsForRendering(images, audioChunks, jobTempInputDir);

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
    };
    const propsJsonPathOnHost = path.join(jobTempInputDir, 'props.json');
    fs.writeFileSync(propsJsonPathOnHost, JSON.stringify(propsForRemotion, null, 2));

    const outputVideoFilename = `${storyTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${jobId}.mp4`;
    
    const outputVideoPathOnHost = path.join(jobTempOutputDir, outputVideoFilename);
    const remotionEntryPoint = 'src/remotion/index.ts'; // Adjust if your entry point is different
    const compositionId = 'StoryVideo'; // Adjust if your composition ID is different

    // Ensure propsJsonPathOnHost is correctly escaped for the shell if it contains spaces, etc.
    // For npx remotion render, props can be a JSON string or a path to a JSON file.
    // Using a path is cleaner.
    const renderCommand = `npx remotion render ${remotionEntryPoint} ${compositionId} ${outputVideoPathOnHost} --props=${propsJsonPathOnHost} --log=verbose`;

    console.log(`[renderVideoInBackground] Executing Remotion CLI command for job ${jobId}:\n${renderCommand}`);
    updateJobStatus(jobId, { progress: 40, status: 'processing' });

    const child = exec(renderCommand, { cwd: process.cwd() }, async (error, stdout, stderr) => {
      activeRenderProcesses.delete(jobId); // Remove from active processes

      if (error) {
        console.error(`Remotion render failed for job ${jobId}:`, error);
        console.error(`Stderr: ${stderr}`);
        updateJobStatus(jobId, { 
          status: 'error', 
          error: `Remotion render failed: ${error.message}. Stderr: ${stderr}`,
          progress: 100
        });
        cleanupRemotionAssets(jobId);
        return;
      }

      console.log(`Remotion render stdout for job ${jobId}: ${stdout}`);
      if (stderr) {
        console.warn(`Remotion render stderr for job ${jobId}: ${stderr}`);
      }

      if (!fs.existsSync(outputVideoPathOnHost) || fs.statSync(outputVideoPathOnHost).size === 0) {
        console.error(`Render completed but output file is missing or empty for job ${jobId}: ${outputVideoPathOnHost}`);
        updateJobStatus(jobId, { 
          status: 'error', 
          error: 'Render completed but output file is missing or empty.',
          progress: 100
        });
        cleanupRemotionAssets(jobId);
        return;
      }
      
      updateJobStatus(jobId, { progress: 90 });
      console.log(`Video rendered successfully for job ${jobId} to ${outputVideoPathOnHost}`);

      try {
        const downloadUrl = await saveVideoForDownload(outputVideoPathOnHost, storyId);
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
    // This requires a way to signal cancellation to this process.
    // For now, if the server restarts, activeRenderProcesses is cleared.

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
