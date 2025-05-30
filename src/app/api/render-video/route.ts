import { NextResponse } from 'next/server';
import { downloadAssetsForRendering, saveVideoForDownload } from '@/utils/remotionUtils';
import { NarrationChunk } from '@/types/narration';
import { ensureDownloadsDirectory } from './init-downloads';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';

const execAsync = promisify(exec);

/**
 * Renders a video using the Remotion CLI approach
 * This avoids React context issues in server components
 */
async function renderStoryVideoWithCLI({
  images,
  audioChunks,
  storyTitle
}: {
  images: string[];
  audioChunks: NarrationChunk[];
  storyTitle: string;
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
      }))
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
    
    // Use npx to run remotion render command with optimized settings for low resources
    const command = `npx remotion render "${entryPointPath}" StoryVideo "${outputPath}" --props="${propsPath}" --disable-web-security --log=info --concurrency=1 --temp-dir="${tmpDir}" --timeout=30000 --delayRenderTimeoutInMilliseconds=30000`;
    
    console.log(`Executing command: ${command}`);
    
    // Execute the command with a 10-minute timeout
    const { stdout, stderr } = await execAsync(command, { 
      timeout: 600000, // 10 minutes
      maxBuffer: 1024 * 1024 * 50 // 50MB buffer
    });
    
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

    // Download assets for rendering
    console.log('Downloading assets for rendering...');
    const { localImages, localAudioChunks } = await downloadAssetsForRendering(images, audioChunks);

    // Render the video using CLI approach to avoid React context issues
    console.log('Rendering video...');
    const videoPath = await renderStoryVideoWithCLI({
      images: localImages,
      audioChunks: localAudioChunks,
      storyTitle,
    });

    // Save the video for download
    console.log('Saving video for download...');
    const downloadUrl = await saveVideoForDownload(videoPath, storyId);

    // Clean up assets after successful render and save
    console.log('Cleaning up temporary assets...');
    try {
      const { cleanupRemotionAssets } = await import('@/utils/remotionUtils');
      cleanupRemotionAssets();
    } catch (error) {
      console.warn('Failed to cleanup assets:', error);
    }

    // Return the download URL
    return NextResponse.json({ downloadUrl });
  } catch (error) {
    console.error('Error rendering video:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to render video: ${errorMessage}` },
      { status: 500 }
    );
  }
}