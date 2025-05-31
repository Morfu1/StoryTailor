"use client";

import React, { useMemo, useCallback, memo } from 'react';
import {
  Composition,
  getInputProps,
  AbsoluteFill,
  Series,
  Audio,
  staticFile,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { NarrationChunk } from '@/types/narration';
import { GeneratedImage } from '@/types/story';

// Dynamic FPS configuration for video rendering
// Lower FPS for static images improves rendering speed significantly
const VIDEO_FPS = 15; // Can be adjusted: 15 for fast rendering, 24 for smoother, 30 for highest quality

// Make this a Record<string, unknown> to satisfy Remotion type constraints
interface StoryVideoProps extends Record<string, unknown> {
  images: (string | GeneratedImage)[];
  audioChunks: NarrationChunk[];
  fps?: number; // Optional FPS override
}

// Define a structure for scene organization
interface SceneData {
  audioChunk: NarrationChunk;
  images: string[];
  durationInFrames: number;
  imageFrameDurations: number[];
}

// Cache for organized scenes to prevent recalculation
const scenesCache = new Map<string, SceneData[]>();

// Helper function to extract image URL from string or GeneratedImage
const getImageUrl = (image: string | GeneratedImage): string => {
  return typeof image === 'string' ? image : image.imageUrl;
};

// Helper function to get chunk metadata from GeneratedImage
const getChunkMetadata = (image: string | GeneratedImage): { chunkId?: string; chunkIndex?: number } => {
  return typeof image === 'string' ? {} : { chunkId: image.chunkId, chunkIndex: image.chunkIndex };
};

// Associate images with audio chunks using chunk metadata from GeneratedImages
const organizeScenes = (images: (string | GeneratedImage)[], audioChunks: NarrationChunk[], fps: number = VIDEO_FPS): SceneData[] => {
  // Create cache key for memoization (convert images to URLs for consistent caching)
  const imageUrls = images.map(getImageUrl);
  const cacheKey = `${imageUrls.length}-${audioChunks.length}-${fps}-${audioChunks.map(c => c.duration).join(',')}`;
  
  if (scenesCache.has(cacheKey)) {
    console.log('Using cached scenes for:', images.length, 'images and', audioChunks.length, 'audio chunks');
    return scenesCache.get(cacheKey)!;
  }
  
  console.log('Organizing scenes with:', images.length, 'images and', audioChunks.length, 'audio chunks');
  
  // Use all chunks with proper durations - don't filter too aggressively
  const validChunks = audioChunks.filter(chunk => 
    chunk.duration && chunk.duration > 0
  );
  
  if (validChunks.length === 0) {
    console.warn('No valid audio chunks found, creating default scene with images');
    const defaultImages = images.length > 0 ? images.map(getImageUrl) : ['placeholder'];
    const framesPerImage = Math.max(fps * 3, 1); // Minimum 3 seconds or 1 frame per image
    const totalFrames = defaultImages.length * framesPerImage;
    
    return [{
      audioChunk: { id: 'default', text: '', index: 0, duration: totalFrames / fps },
      images: defaultImages,
      durationInFrames: totalFrames,
      imageFrameDurations: defaultImages.map(() => framesPerImage)
    }];
  }
  
  console.log('Using', validChunks.length, 'valid chunks, total duration:', validChunks.reduce((sum, chunk) => sum + (chunk.duration || 0), 0), 'seconds');
  
  // Group images by chunk using metadata (if available) or fallback to sequential distribution
  const scenes: SceneData[] = [];
  
  if (images.length === 0) {
    // No images available, create placeholder scenes
    for (let i = 0; i < validChunks.length; i++) {
      const chunk = validChunks[i];
      const durationInSeconds = chunk.duration || 3;
      const totalFrames = Math.max(1, Math.ceil(durationInSeconds * fps));
      
      scenes.push({
        audioChunk: chunk,
        images: ['placeholder'],
        durationInFrames: totalFrames,
        imageFrameDurations: [totalFrames]
      });
    }
  } else {
    // Group images by chunk using metadata when available
    const imagesByChunk = new Map<string, (string | GeneratedImage)[]>();
    const unassignedImages: (string | GeneratedImage)[] = [];
    
    // First, group images by their chunk metadata
    images.forEach(image => {
      const metadata = getChunkMetadata(image);
      if (metadata.chunkId) {
        if (!imagesByChunk.has(metadata.chunkId)) {
          imagesByChunk.set(metadata.chunkId, []);
        }
        imagesByChunk.get(metadata.chunkId)!.push(image);
      } else {
        unassignedImages.push(image);
      }
    });
    
    console.log(`Found ${imagesByChunk.size} chunks with assigned images, ${unassignedImages.length} unassigned images`);
    
    // For each audio chunk, collect its assigned images
    for (let i = 0; i < validChunks.length; i++) {
      const chunk = validChunks[i];
      let chunkImages: (string | GeneratedImage)[] = [];
      
      // Get images assigned to this chunk by metadata
      if (imagesByChunk.has(chunk.id)) {
        chunkImages = imagesByChunk.get(chunk.id)! || [];
        console.log(`Chunk ${i + 1} (${chunk.id}): Found ${chunkImages.length} assigned images`);
      }
      
      // If no assigned images, fall back to distributing unassigned images
      if (chunkImages.length === 0 && unassignedImages.length > 0) {
        const totalUnassigned = unassignedImages.length;
        const averageImagesPerChunk = Math.max(1, Math.floor(totalUnassigned / validChunks.length));
        const extraImages = totalUnassigned % validChunks.length;
        
        const startIndex = i * averageImagesPerChunk + Math.min(i, extraImages);
        const imagesForThisChunk = averageImagesPerChunk + (i < extraImages ? 1 : 0);
        const endIndex = Math.min(startIndex + imagesForThisChunk, totalUnassigned);
        
        chunkImages = unassignedImages.slice(startIndex, endIndex);
        console.log(`Chunk ${i + 1} (${chunk.id}): Assigned ${chunkImages.length} unassigned images (${startIndex}-${endIndex - 1})`);
      }
      
      // Ensure at least one image per chunk
      if (chunkImages.length === 0) {
        chunkImages = ['placeholder'];
        console.log(`Chunk ${i + 1} (${chunk.id}): Using placeholder image`);
      }
      
      // Convert to image URLs for rendering
      const chunkImageUrls = chunkImages.map(getImageUrl);
      
      console.log(`Chunk ${i + 1} (${chunk.id}): ${chunkImageUrls.length} images assigned`);
      
      // Calculate frame duration from audio chunk duration
      const durationInSeconds = chunk.duration || 3;
      const totalFrames = Math.max(1, Math.ceil(durationInSeconds * fps));
      
      // Distribute frames evenly across images in this chunk
      const framesPerImage = Math.max(1, Math.floor(totalFrames / chunkImageUrls.length));
      const extraFrames = Math.max(0, totalFrames - (framesPerImage * chunkImageUrls.length));
      
      const imageFrameDurations = chunkImageUrls.map((_, idx) => {
        const duration = framesPerImage + (idx < extraFrames ? 1 : 0);
        return Math.max(1, duration); // Ensure minimum 1 frame
      });
      
      scenes.push({
        audioChunk: chunk,
        images: chunkImageUrls,
        durationInFrames: totalFrames,
        imageFrameDurations
      });
    }
  }
  
  const totalFrames = scenes.reduce((sum, scene) => sum + scene.durationInFrames, 0);
  console.log('Organized', scenes.length, 'scenes, total duration:', totalFrames / 30, 'seconds');
  
  // Debug: Check first few scenes and their images
  console.log('First 3 scenes images:');
  scenes.slice(0, 3).forEach((scene, i) => {
    console.log(`Scene ${i}:`, scene.images);
  });
  
  // Cache the result
  scenesCache.set(cacheKey, scenes);
  
  return scenes;
};

// Calculate total duration in frames from scenes
const calculateTotalDuration = (scenes: SceneData[]): number => {
  return scenes.reduce((acc, scene) => acc + scene.durationInFrames, 0);
};

// Cache for image sources to prevent repeated processing
const imageSrcCache = new Map<string, string>();

// Individual Scene component - memoized for performance
const Scene = memo(({ image, index }: { image: string; index: number }) => {
  const frame = useCurrentFrame();

  // Memoize fade-in calculation
  const opacity = useMemo(() => {
    const fadeInDuration = 10;
    return frame < fadeInDuration ? frame / fadeInDuration : 1;
  }, [frame]);

  // Memoized image source handling with caching
  const getImageSrc = useCallback(() => {
    // Check cache first
    if (imageSrcCache.has(image)) {
      return imageSrcCache.get(image)!;
    }
    
    let result: string;
    
    if (!image || image === 'placeholder') {
      console.log('Using placeholder for missing image');
      result = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyMCIgaGVpZ2h0PSIxMDgwIiB2aWV3Qm94PSIwIDAgMTkyMCAxMDgwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cmVjdCB3aWR0aD0iMTkyMCIgaGVpZ2h0PSIxMDgwIiBmaWxsPSIjMzMzMzMzIi8+Cjx0ZXh0IHg9Ijk2MCIgeT0iNTQwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iNjQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0iY2VudGVyIj5TY2VuZSBJbWFnZTwvdGV4dD4KPHN2Zz4K';
    } else if (image.startsWith('data:') || image.startsWith('http')) {
      console.log('Using direct image URL:', image.substring(0, 50) + '...');
      result = image;
    } else {
      // For local paths, use staticFile
      try {
        const staticPath = staticFile(image);
        console.log('Using staticFile for:', image, '-> resolved to:', staticPath);
        result = staticPath;
      } catch (error) {
        console.error(`Error loading image ${image}:`, error);
        result = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyMCIgaGVpZ2h0PSIxMDgwIiB2aWV3Qm94PSIwIDAgMTkyMCAxMDgwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cmVjdCB3aWR0aD0iMTkyMCIgaGVpZ2h0PSIxMDgwIiBmaWxsPSIjRkY0NDQ0Ii8+Cjx0ZXh0IHg9Ijk2MCIgeT0iNTQwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iNjQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0iY2VudGVyIj5JbWFnZSBFcnJvcjwvdGV4dD4KPHN2Zz4K';
      }
    }
    
    // Cache the result
    imageSrcCache.set(image, result);
    return result;
  }, [image]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: 'black',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        opacity,
      }}
    >
      <img
        src={getImageSrc()}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
        }}
        alt={`Scene ${index + 1}`}
        onError={(e) => {
          console.error(`Failed to load image ${image} for scene ${index}`);
        }}
      />
    </AbsoluteFill>
  );
});

// Function to get image dimensions from URL for resolution optimization
const getImageDimensionsFromUrl = async (imageUrl: string): Promise<{ width: number; height: number } | null> => {
  try {
    if (!imageUrl || imageUrl === 'placeholder') return null;
    
    // Only process HTTP URLs (not data URLs or static files)
    if (!imageUrl.startsWith('http')) return null;
    
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    
    const buffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);
    
    // Check for JPEG
    if (uint8Array[0] === 0xFF && uint8Array[1] === 0xD8) {
      for (let i = 2; i < uint8Array.length - 8; i++) {
        if (uint8Array[i] === 0xFF) {
          const marker = uint8Array[i + 1];
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
      const width = (uint8Array[16] << 24) | (uint8Array[17] << 16) | (uint8Array[18] << 8) | uint8Array[19];
      const height = (uint8Array[20] << 24) | (uint8Array[21] << 16) | (uint8Array[22] << 8) | uint8Array[23];
      return { width, height };
    }
    
    return null;
  } catch (error) {
    console.warn('Could not detect image dimensions:', error);
    return null;
  }
};

// Story Video component - exported for use in Root.tsx
export const StoryVideoComponent: React.FC<StoryVideoProps> = memo(({ images, audioChunks, fps }) => {
  console.log('=== StoryVideoComponent rendering ===');
  console.log('- Images count:', images?.length || 0);
  console.log('- Audio chunks count:', audioChunks?.length || 0);
  
  if (images?.length) {
    console.log('- First 5 images:', images.slice(0, 5));
  }
  
  const actualFPS = fps || VIDEO_FPS;
  console.log('- Using FPS:', actualFPS);

  // Memoize scene organization - expensive computation
  const scenes = useMemo(() => {
    return organizeScenes(images || [], audioChunks || [], actualFPS);
  }, [images, audioChunks, actualFPS]);
  
  console.log('=== Organized into', scenes.length, 'scenes ===');
  
  // Memoize total duration calculation
  const totalDurationInFrames = useMemo(() => {
    return calculateTotalDuration(scenes);
  }, [scenes]);
  
  console.log('=== Total video duration:', totalDurationInFrames, 'frames =', totalDurationInFrames / actualFPS, 'seconds ===');
  
  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {/* Render scenes sequentially */}
      <Series>
        {scenes.map((scene, sceneIndex) => (
          <Series.Sequence durationInFrames={scene.durationInFrames} key={`scene-${sceneIndex}`}>
            {/* Images for this scene */}
            <Series>
              {scene.images.map((image, imageIndex) => (
                <Series.Sequence 
                  durationInFrames={scene.imageFrameDurations[imageIndex]} 
                  key={`image-${sceneIndex}-${imageIndex}`}
                >
                  <Scene image={image} index={sceneIndex * 10 + imageIndex} />
                </Series.Sequence>
              ))}
            </Series>
            
            {/* Audio for this scene - start at the beginning of the scene */}
            {scene.audioChunk.audioUrl && (
              <Sequence from={0} durationInFrames={scene.durationInFrames}>
                <Audio
                  src={scene.audioChunk.audioUrl.startsWith('http') 
                    ? scene.audioChunk.audioUrl 
                    : staticFile(scene.audioChunk.audioUrl)
                  }
                  volume={1.0}
                  onError={(error) => {
                    console.error(`Audio error for scene ${sceneIndex}:`, error);
                    console.error(`Audio URL: ${scene.audioChunk.audioUrl}`);
                  }}
                />
              </Sequence>
            )}
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
});

// Main entry component for Remotion
export const StoryVideo = () => {
  const { images, audioChunks, width, height, fps, detectedDimensions } = getInputProps<StoryVideoProps & { 
    width?: number; 
    height?: number; 
    detectedDimensions?: { width: number; height: number }; 
  }>();
  
  console.log('StoryVideo loading:', images?.length || 0, 'images,', audioChunks?.length || 0, 'chunks');
  console.log('Resolution provided:', width, 'x', height);
  console.log('Detected dimensions:', detectedDimensions);
  console.log('FPS provided:', fps, 'fallback to default:', VIDEO_FPS);
  
  const actualFPS = fps || VIDEO_FPS;
  
  // Use detected dimensions if available and no explicit width/height provided
  let videoWidth = width || 1920;
  let videoHeight = height || 1080;
  
  if (!width && !height && detectedDimensions) {
    console.log(`Using detected image dimensions: ${detectedDimensions.width}x${detectedDimensions.height}`);
    videoWidth = detectedDimensions.width;
    videoHeight = detectedDimensions.height;
  }
  
  // Calculate total duration from scenes for the composition
  const calculateDuration = (): number => {
    try {
      if (audioChunks?.length > 0) {
        // Calculate total duration directly from audio chunk durations (already in seconds)
        const totalAudioDuration = audioChunks
          .filter(chunk => chunk.duration && chunk.duration > 0)
          .reduce((sum, chunk) => sum + (chunk.duration || 0), 0);
        
        const totalFrames = Math.ceil(totalAudioDuration * actualFPS);
        
        console.log('Video duration:', totalFrames, 'frames (', totalFrames / actualFPS, 'sec)');
        
        if (totalFrames > 0) {
          return totalFrames;
        }
      }
    } catch (error) {
      console.error('Error calculating duration:', error);
    }
    
    // Fallback: try to calculate from images if no audio
    if (images?.length > 0) {
      const fallbackFrames = images.length * (actualFPS * 3); // 3 seconds per image
      console.log('Using image fallback:', fallbackFrames, 'frames');
      return fallbackFrames;
    }
    
    // Final fallback
    const defaultFrames = actualFPS * 10; // 10 seconds default
    console.log(`Using default fallback: ${defaultFrames} frames`);
    return defaultFrames;
  };
  
  return (
    <Composition
      id="StoryVideo"
      component={StoryVideoComponent}
      durationInFrames={calculateDuration()}
      fps={actualFPS}
      width={videoWidth}
      height={videoHeight}
      defaultProps={{
        images,
        audioChunks,
        fps: actualFPS,
      }}
    />
  );
};
