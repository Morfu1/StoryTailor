
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
  const jobInputHostDir = path.join(process.cwd(), '.tmp-docker-input', jobId);
  const jobOutputHostDir = path.join(process.cwd(), '.tmp-docker-output', jobId);
  fs.mkdirSync(jobInputHostDir, { recursive: true });
  fs.mkdirSync(jobOutputHostDir, { recursive: true });

  try {
    console.log(`Starting background rendering for job ${jobId}`);
    updateJobStatus(jobId, { status: 'processing', progress: 10 });

    console.log('Downloading assets for rendering to host directory:', jobInputHostDir);
    updateJobStatus(jobId, { progress: 20 });
    
    const { localImages, localAudioChunks, imageDimensions } = await downloadAssetsForRendering(images, audioChunks, jobInputHostDir);

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
    
    console.log(`Rendering video using Docker for job ${jobId}`);
    updateJobStatus(jobId, { progress: 30 });

    const propsForDocker: Omit<StoryVideoProps, 'width' | 'height' | 'fps'> & { width?: number, height?: number, fps?: number, detectedDimensions?: {width: number, height: number} } = {
      images: localImages, // These paths are relative to jobInputHostDir's "remotion-assets"
      audioChunks: localAudioChunks,
      storyTitle,
      width: videoWidth,
      height: videoHeight,
      fps: optimalFPS,
      detectedDimensions: imageDimensions,
    };
    const propsJsonPathOnHost = path.join(jobInputHostDir, 'props.json');
    fs.writeFileSync(propsJsonPathOnHost, JSON.stringify(propsForDocker, null, 2));

    const outputVideoFilename = `${storyTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${jobId}.mp4`;
    
    // Hypothetical Docker command structure
    const dockerCommand = [
      'docker run --rm',
      `-v "${jobInputHostDir}:/input:ro"`, // Mount host input dir to /input in container (read-only)
      `-v "${jobOutputHostDir}:/output"`,   // Mount host output dir to /output in container
      'storytailor-render', // Replace with your actual Docker image name
      'node render.mjs',
      '--props /input/props.json',
      `--output /output/${outputVideoFilename}`,
      '--composition StoryVideo' // Assuming StoryVideo is your main composition ID
    ].join(' ');

    console.log(`[renderVideoInBackground] Hypothetical Docker command for Firebase Studio to adapt:\n${dockerCommand}`);
    updateJobStatus(jobId, { progress: 40, status: 'processing' }); // Indicate it's now waiting for Docker

    // SIMULATE DOCKER RUN & VIDEO OUTPUT FOR TESTING (REMOVE IN PRODUCTION)
    // This part is where Firebase Studio (or your orchestration) would run Docker and place the video.
    // For now, we'll just log and set status.
    // In a real setup, you'd await Docker completion and then proceed.
    console.log(`Job ${jobId} is now 'processing'. Waiting for external Docker execution and video output.`);
    // The actual update to 'completed' status and downloadUrl would happen *after* Docker finishes
    // and the video file is confirmed in jobOutputHostDir. This part needs external orchestration.

  } catch (error) {
    console.error(`Background preparation for Docker rendering failed for job ${jobId}:`, error);
    updateJobStatus(jobId, { 
      status: 'error', 
      error: error instanceof Error ? error.message : String(error) 
    });
    cleanupRemotionAssets(jobId); // Clean up input/output dirs on error
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

    console.log('Render video request received (for Docker):', {
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

    // Start background preparation and logging of Docker command (don't await)
    prepareInputsForDockerRender( // Renamed from renderVideoInBackground
      job.id,
      images, // Pass GeneratedImage[]
      audioChunks,
      storyTitle,
      storyId,
      1920, 
      1080,
      15 
    ).catch(error => {
      console.error(`Background Docker input preparation failed for job ${job.id}:`, error);
      // Status is already updated to 'error' inside prepareInputsForDockerRender if it fails there.
    });

    return NextResponse.json({ 
      jobId: job.id,
      message: 'Video rendering inputs being prepared. Docker execution is next.',
      status: 'processing' // Initial status, Docker run is awaited externally
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
