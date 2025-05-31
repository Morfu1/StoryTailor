import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, AlertCircle, Film, VideoIcon, Download, RefreshCw, XCircle } from 'lucide-react';
import { ImageCategorizer } from './ImageCategorizer';
import { countSceneImages, countDetailImages } from '@/utils/storyHelpers';
import type { UseStoryStateReturn } from '@/hooks/useStoryState';
import { useState, useEffect } from 'react';
import { NarrationChunk } from '@/types/narration';
import { GeneratedImage } from '@/types/story';

interface FinalReviewStepProps {
  storyState: UseStoryStateReturn;
}

export function FinalReviewStep({ storyState }: FinalReviewStepProps) {
  const { storyData } = storyState;

  const isStoryComplete = Boolean(
    storyData.title &&
    storyData.generatedScript &&
    storyData.narrationChunks &&
    storyData.narrationChunks.length > 0 &&
    storyData.narrationChunks.every(c => c.audioUrl) &&
    storyData.imagePrompts &&
    storyData.imagePrompts.length > 0
  );

  const totalSceneImages = storyData.imagePrompts?.length || 0;
  const generatedSceneImages = countSceneImages(storyData);

  if (!storyData.imagePrompts || storyData.imagePrompts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="h-5 w-5" />
            Step 5: Final Review & Export
          </CardTitle>
          <CardDescription>
            Generate scene images first to continue with the final review.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Film className="h-5 w-5" />
          Step 5: Final Review & Export
        </CardTitle>
        <CardDescription>
          Review your complete story and save or export it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Story Completion Status */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Story Completion Status</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle className={`h-4 w-4 ${storyData.title ? 'text-green-500' : 'text-muted-foreground'}`} />
              <span className="text-sm">Title: {storyData.title || 'Not set'}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <CheckCircle className={`h-4 w-4 ${storyData.generatedScript ? 'text-green-500' : 'text-muted-foreground'}`} />
              <span className="text-sm">Script Generated</span>
            </div>
            
            <div className="flex items-center gap-2">
              <CheckCircle className={`h-4 w-4 ${storyData.narrationChunks?.every(c => c.audioUrl) ? 'text-green-500' : 'text-muted-foreground'}`} />
              <span className="text-sm">
                Narration: {storyData.narrationChunks?.filter(c => c.audioUrl).length || 0}/{storyData.narrationChunks?.length || 0} chunks
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <CheckCircle className={`h-4 w-4 ${generatedSceneImages === totalSceneImages && totalSceneImages > 0 ? 'text-green-500' : 'text-muted-foreground'}`} />
              <span className="text-sm">
                Scene Images: {generatedSceneImages}/{totalSceneImages}
              </span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Story Summary */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Story Summary</Label>
          <div className="p-4 border rounded-md bg-muted/50">
            <h3 className="font-semibold mb-2">{storyData.title || 'Untitled Story'}</h3>
            <p className="text-sm text-muted-foreground mb-3">{storyData.userPrompt}</p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium">Script Length:</span>
                <br />
                {storyData.generatedScript?.length || 0} characters
                <br />
                {storyData.generatedScript ? storyData.generatedScript.trim().split(/\s+/).length : 0} words
              </div>
              
              <div>
                <span className="font-medium">Audio Duration:</span>
                <br />
                {storyData.narrationAudioDurationSeconds ? 
                  `${Math.round(storyData.narrationAudioDurationSeconds / 60)}:${String(Math.round(storyData.narrationAudioDurationSeconds % 60)).padStart(2, '0')}` : 
                  'Not calculated'
                }
              </div>
              
              <div>
                <span className="font-medium">Detail Images:</span>
                <br />
                {countDetailImages(storyData)}
              </div>
              
              <div>
                <span className="font-medium">Scene Images:</span>
                <br />
                {generatedSceneImages}
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Generated Images */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Generated Images</Label>
          <ImageCategorizer storyState={storyState} />
        </div>

        <Separator />

        {/* Status Messages */}
        <div className="space-y-4">
          {!isStoryComplete && (
            <div className="flex items-start gap-2 p-3 border border-yellow-200 bg-yellow-50 rounded-md">
              <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-800">Story Not Complete</p>
                <p className="text-yellow-700">
                  Some elements are missing. Complete all steps for the best experience.
                </p>
              </div>
            </div>
          )}
          
          {isStoryComplete && (
            <div className="text-center p-4 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center justify-center gap-2 text-green-600 mb-2">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Story Complete!</span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Your story is ready. Use the Save Story button below to save your progress.
              </p>
              <RenderVideoButton storyData={storyData} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Component for rendering video button
function RenderVideoButton({ storyData }: { storyData: UseStoryStateReturn['storyData'] }) {
  const [isRendering, setIsRendering] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);

  // Poll job status when rendering
  const pollJobStatus = async (jobId: string) => {
    try {
      const response = await fetch(`/api/video-job/${jobId}`);
      const job = await response.json();
      
      if (response.ok) {
        setProgress(job.progress || 0);
        setEstimatedTimeRemaining(job.estimatedTimeRemaining || null);
        
        if (job.status === 'completed' && job.downloadUrl) {
          setVideoUrl(job.downloadUrl);
          setIsRendering(false);
          setJobId(null);
          return; // Stop polling
        } else if (job.status === 'error') {
          setError(job.error || 'Video rendering failed');
          setIsRendering(false);
          setJobId(null);
          return; // Stop polling
        }
        
        // Continue polling if still processing
        if (job.status === 'processing' || job.status === 'pending') {
          setTimeout(() => pollJobStatus(jobId), 2000); // Poll every 2 seconds
        }
      } else {
        console.error('Failed to get job status:', job.error);
        setTimeout(() => pollJobStatus(jobId), 5000); // Retry after 5 seconds
      }
    } catch (error) {
      console.error('Error polling job status:', error);
      setTimeout(() => pollJobStatus(jobId), 5000); // Retry after 5 seconds
    }
  };

  // Check for existing completed videos when component loads
  useEffect(() => {
    const checkExistingVideo = async () => {
      if (!storyData.id) return;
      
      try {
        // Check if there are any completed jobs for this story
        const response = await fetch(`/api/video-job/story/${storyData.id}`);
        if (response.ok) {
          const jobs = await response.json();
          const completedJob = jobs.find((job: any) => job.status === 'completed' && job.downloadUrl);
          if (completedJob) {
            setVideoUrl(completedJob.downloadUrl);
          }
          
          // Check for any in-progress jobs
          const inProgressJob = jobs.find((job: any) => job.status === 'processing' || job.status === 'pending');
          if (inProgressJob) {
            setIsRendering(true);
            setJobId(inProgressJob.id);
            setProgress(inProgressJob.progress || 0);
            pollJobStatus(inProgressJob.id);
          }
        }
      } catch (error) {
        console.error('Error checking existing videos:', error);
      }
    };
    
    checkExistingVideo();
  }, [storyData.id]);

  const handleRenderVideo = async () => {
    setIsRendering(true);
    setError(null);
    setVideoUrl(null);

    try {
      console.log('--- Debugging Video Rendering ---');
      console.log('Initial storyData.generatedImages:', JSON.stringify(storyData.generatedImages, null, 2));
      console.log('Initial storyData.imagePrompts:', JSON.stringify(storyData.imagePrompts, null, 2));

      // Order images by their original prompts to match Step 4 sequence (preserve GeneratedImage objects)
      let sceneImages: GeneratedImage[] = [];
      
      if (storyData.imagePrompts && storyData.generatedImages) {
        // Create a map of prompt to GeneratedImage for fast lookup
        const imageMap = new Map<string, GeneratedImage>();
        storyData.generatedImages
          .filter(image => image.imageUrl && image.originalPrompt)
          .forEach(image => {
            imageMap.set(image.originalPrompt, image);
          });
        console.log('Populated imageMap:', Array.from(imageMap.entries()));
        
        // Order images by imagePrompts sequence (Step 4 order)
        sceneImages = storyData.imagePrompts
          .map(prompt => imageMap.get(prompt))
          .filter(image => image !== undefined) as GeneratedImage[];
        console.log('SceneImages after primary ordering:', JSON.stringify(sceneImages, null, 2));
      }

      // If no ordered images found, fall back to any images with URLs
      if (sceneImages.length === 0) {
        console.log('No prompt-ordered images found, falling back to all images');
        sceneImages = storyData.generatedImages
          ?.filter(image => image.imageUrl) || [];
        console.log('SceneImages after fallback:', JSON.stringify(sceneImages, null, 2));
      }

      console.log('Scene images for video (intermediate):', sceneImages.length, 'images with chunk metadata');
      
      // Validate that we have images to work with
      if (sceneImages.length === 0) {
        throw new Error('No images available for video rendering');
      }

      // Gather all audio chunks, filter for valid ones, and sort them by index
      console.log('DEBUG - Total narration chunks from Firebase:', storyData.narrationChunks?.length || 0);
      
      const allChunks = [...(storyData.narrationChunks || [])];
      console.log('DEBUG - All chunks status:', allChunks.map(chunk => ({
        index: chunk.index,
        hasAudioUrl: !!chunk.audioUrl,
        hasText: !!chunk.text,
        audioUrlPreview: chunk.audioUrl?.substring(0, 30) + '...',
        duration: chunk.duration
      })));
      
      const audioChunks = allChunks
        .filter(chunk => chunk.audioUrl) // Only require audioUrl for video rendering
        .sort((a, b) => a.index - b.index);
      
      console.log('DEBUG - Filtered audio chunks count:', audioChunks.length, 'out of', allChunks.length);
      console.log('DEBUG - Filtered and sorted audio chunks:', audioChunks.map(chunk => ({
        index: chunk.index,
        hasAudio: !!chunk.audioUrl,
        textPreview: chunk.text?.substring(0, 30) || 'NO TEXT',
        duration: chunk.duration
      })));
      
      // Validate that we have audio chunks to work with
      if (audioChunks.length === 0) {
        throw new Error('No audio narration available for video rendering');
      }

      // Prepare request payload
      // Ensure all scene images have valid imageUrls
      const validSceneImages = sceneImages.filter(img => typeof img.imageUrl === 'string');

      if (validSceneImages.length !== sceneImages.length) {
        console.warn("Some images were filtered out due to missing or invalid imageUrls.");
      }
      
      if (validSceneImages.length === 0) {
        throw new Error('No valid images available for video rendering after filtering.');
      }

      // Log chunk metadata to verify images have correct associations
      console.log('Final validSceneImages for payload (full objects):', JSON.stringify(validSceneImages, null, 2));
      console.log('Image chunk associations (enhanced):', validSceneImages.map(img => ({
        imageUrl: img.imageUrl?.substring(0, 30),
        originalPrompt: img.originalPrompt,
        chunkId: img.chunkId,
        chunkIndex: img.chunkIndex
      })));

      const payload = {
        images: validSceneImages, // Send the full GeneratedImage objects with metadata
        audioChunks,
        storyTitle: storyData.title || 'Untitled Story',
        storyId: storyData.id || `story-${Date.now()}`
      };

      // Call the API
      const response = await fetch('/api/render-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      // Log the payload to help with debugging
      console.log('Video render request payload:', {
        imageCount: payload.images.length,
        audioChunkCount: payload.audioChunks.length,
        storyTitle: payload.storyTitle,
        storyId: payload.storyId
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Video render API error:', errorData);
        throw new Error(errorData.error || 'Failed to render video');
      }

      const data = await response.json();
      
      if (data.jobId) {
        setJobId(data.jobId);
        setProgress(0);
        // Start polling for job status
        pollJobStatus(data.jobId);
      } else {
        throw new Error('No job ID returned from server');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      console.error('Error rendering video:', err);
      setIsRendering(false);
    }
  };

  const handleStopRendering = async () => {
    if (!jobId) {
      setError("No active job to stop.");
      setIsRendering(false);
      return;
    }
    console.log(`Attempting to stop rendering for job: ${jobId}`);
    try {
      const response = await fetch(`/api/video-job/${jobId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (response.ok) {
        setError('Rendering cancelled by user.');
        setIsRendering(false);
        setVideoUrl(null); // Clear video URL as it's no longer valid
        // setJobId(null); // JobId is cleared by pollJobStatus or if it was never set
        setProgress(0);
        setEstimatedTimeRemaining(null);
         // Explicitly set jobId to null here as polling will stop
        setJobId(null);
      } else {
        setError(data.error || 'Failed to stop rendering.');
        // Keep isRendering true if stop failed, or let polling handle it
      }
    } catch (err) {
      console.error('Error stopping rendering:', err);
      setError('An error occurred while trying to stop rendering.');
      // Potentially keep isRendering true, or let polling sort it out
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Render/Render Again Button (shown if not rendering) */}
      {!isRendering && (
        <Button
          onClick={handleRenderVideo}
          className="flex items-center gap-2"
        >
          {videoUrl ? <RefreshCw className="h-4 w-4" /> : <VideoIcon className="h-4 w-4" />}
          {videoUrl ? "Render Again" : "Generate Video"}
        </Button>
      )}

      {/* Progress Bar and Stop Button (shown when rendering) */}
      {isRendering && (
        <div className="space-y-4 w-full max-w-md"> {/* Added w-full and max-w-md for better layout */}
          <div className="text-center">
            <div className="text-sm font-medium text-gray-700 mb-2">
              Rendering your video...
            </div>
            <div className="text-xs text-gray-500">
              This process continues even if you leave this page
            </div>
          </div>
          
          {/* Modern Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Progress</span>
              <span className="font-medium text-gray-900">{progress}%</span>
            </div>
            
            <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              {/* Background track */}
              <div className="absolute inset-0 bg-gradient-to-r from-gray-100 to-gray-200"></div>
              
              {/* Progress fill with gradient and animation */}
              <div 
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-600 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              >
                {/* Shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
              </div>
              
              {/* Pulse animation for when progress is active */}
              {progress > 0 && progress < 100 && (
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 animate-pulse"></div>
              )}
            </div>
            
            {/* Status text and estimated time */}
            <div className="flex justify-between items-center text-xs text-gray-500">
              <span>
                {progress === 0 && 'Starting...'}
                {progress > 0 && progress < 20 && 'Downloading assets...'}
                {progress >= 20 && progress < 40 && 'Optimizing resolution...'}
                {progress >= 40 && progress < 80 && 'Rendering video...'}
                {progress >= 80 && progress < 100 && 'Finalizing...'}
                {progress === 100 && 'Complete!'}
              </span>
              {estimatedTimeRemaining && (
                <span>~{Math.ceil(estimatedTimeRemaining / 60)} min remaining</span>
              )}
            </div>
          </div>
          
          {/* Animated rendering icon */}
          <div className="flex justify-center">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
          <Button
            variant="destructive"
            onClick={handleStopRendering}
            className="w-full flex items-center gap-2"
            disabled={!jobId} // Disable if no jobId (e.g., initial phase before jobId is set)
          >
            <XCircle className="h-4 w-4" />
            Stop Rendering
          </Button>
        </div>
      )}

      {/* Download Button and Success Message (shown if videoUrl exists and not rendering) */}
      {videoUrl && !isRendering && (
        <div className="flex flex-col items-center gap-2">
          <span className="text-green-600 text-sm font-medium">Video rendered successfully!</span>
          <Button asChild variant="outline" className="flex items-center gap-2">
            <a href={videoUrl} download>
              <Download className="h-4 w-4" />
              Download Video
            </a>
          </Button>
        </div>
      )}

      {/* Error Message */}
      {error && !isRendering && (
        <div className="text-red-500 text-sm">
          Error: {error}
        </div>
      )}
    </div>
  );
}
