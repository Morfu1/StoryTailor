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
  // useVideoConfig, // Unused
} from 'remotion';
import { NarrationChunk } from '@/types/narration';
// import { GeneratedImage } from '@/types/story'; // Unused

// Define LocalImageWithMetadata (ideally import from a shared types file like src/types/story.ts)
interface LocalImageWithMetadata {
  localPath: string;
  originalUrl?: string;
  chunkId?: string;
  chunkIndex?: number;
  originalPrompt?: string;
}

// Dynamic FPS configuration for video rendering
// Lower FPS for static images improves rendering speed significantly
const VIDEO_FPS = 15; // Can be adjusted: 15 for fast rendering, 24 for smoother, 30 for highest quality

// Make this a Record<string, unknown> to satisfy Remotion type constraints
interface StoryVideoProps extends Record<string, unknown> {
  images: LocalImageWithMetadata[]; // Changed from (string | GeneratedImage)[]
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

// Helper function to extract image URL from LocalImageWithMetadata
const getImageUrl = (image: LocalImageWithMetadata): string => {
  return image.localPath; // Use the localPath for Remotion's staticFile
};

// Helper function to get chunk metadata from LocalImageWithMetadata
const getChunkMetadata = (image: LocalImageWithMetadata): { chunkId?: string; chunkIndex?: number } => {
  return { chunkId: image.chunkId, chunkIndex: image.chunkIndex };
};

// Associate images with audio chunks using chunk metadata from LocalImageWithMetadata
const organizeScenes = (images: LocalImageWithMetadata[], audioChunks: NarrationChunk[], fps: number = VIDEO_FPS): SceneData[] => {
  console.log('--- organizeScenes ---');
  console.log(`Received ${images.length} images and ${audioChunks.length} audio chunks.`);
  
  // Log details of the first few images received
  images.slice(0, 5).forEach((img, idx) => {
    console.log(`Image[${idx}]: localPath=${img.localPath}, chunkId=${img.chunkId}, chunkIndex=${img.chunkIndex}, originalPrompt=${img.originalPrompt ? img.originalPrompt.substring(0,20)+'...' : 'N/A'}`);
  });
  
  // Log details of the first few audio chunks received
  audioChunks.slice(0, 5).forEach((chunk, idx) => {
    console.log(`AudioChunk[${idx}]: id=${chunk.id}, duration=${chunk.duration}, text=${chunk.text.substring(0,20)+ '...'}`);
  });

  // Create cache key for memoization (use localPath for consistent caching)
  const imagePaths = images.map(img => img.localPath); // Use localPath for cache key
  const cacheKey = `${imagePaths.length}-${audioChunks.length}-${fps}-${audioChunks.map(c => c.duration).join(',')}`;
  
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
    const imagesByChunk = new Map<string, LocalImageWithMetadata[]>();
    const unassignedImages: LocalImageWithMetadata[] = [];
    
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
    
    // Debug chunk assignments
    if (imagesByChunk.size > 0) {
      console.log('Image-to-chunk mappings:');
      imagesByChunk.forEach((imgs, chunkId) => {
        console.log(`- Chunk ${chunkId}: ${imgs.length} images`);
      });
    }
    
    // Debug the first few unassigned images
    if (unassignedImages.length > 0) {
      console.log('First few unassigned images:');
      unassignedImages.slice(0, 3).forEach((img, i) => { // img is LocalImageWithMetadata
        const metadata = getChunkMetadata(img);
        console.log(`- Unassigned image ${i}: localPath=${img.localPath}, metadata:`, metadata);
      });
    }
    
    // For each audio chunk, collect its assigned images
    for (let i = 0; i < validChunks.length; i++) {
      const chunk = validChunks[i];
      let chunkImages: LocalImageWithMetadata[] = [];
      
      // Get images assigned to this chunk by metadata
      if (imagesByChunk.has(chunk.id)) {
        chunkImages = imagesByChunk.get(chunk.id)! || [];
        console.log(`Chunk ${i + 1} (${chunk.id}): Found ${chunkImages.length} assigned images`);
      }
      
      // If no assigned images were found via chunk.id, chunkImages remains empty.
      // We will NOT fall back to distributing unassignedImages into this chunk's specific slot.
      // This ensures only directly associated images (or a placeholder if none) are shown for this audio chunk.
      // The unassignedImages array still exists and could be processed separately if desired (e.g., appended at the end of the video).
      if (chunkImages.length === 0) {
        console.log(`Chunk ${i + 1} (${chunk.id}): No images specifically assigned. Will use placeholder.`);
      }
      
      // Ensure at least one image per chunk
      // Placeholder handling needs adjustment if chunkImages is LocalImageWithMetadata[]
      // For now, if no images, we create a scene with a placeholder string.
      // The Scene component will handle 'placeholder' string.
      if (chunkImages.length === 0) {
        // Scene component expects string URLs, so 'placeholder' is fine here.
        // The actual SceneData.images will be string[]
      }
      
      // Get image URLs (localPaths) for rendering this chunk
      const physicalPlaceholderPath = 'remotion-assets/placeholder.jpg'; // Path to the physical placeholder
      const chunkImageUrls = chunkImages.length > 0
        ? chunkImages.map(getImageUrl) // This will get localPath from LocalImageWithMetadata
        : [physicalPlaceholderPath]; // Fallback to physical placeholder if no images for chunk
      
      if (chunkImages.length === 0) {
        console.log(`Chunk ${i + 1} (${chunk.id}): No specific images assigned. Using physical placeholder: ${physicalPlaceholderPath}`);
      }
      
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
const SceneComponent = ({ image, index }: { image: string; index: number }) => {
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
    // The 'image' prop is now always a path string (e.g., "remotion-assets/image-0.jpg" or "remotion-assets/placeholder.jpg")
    // or an http/data URL if passed directly (though current flow uses local paths).

    if (!image) { // Should not happen if organizeScenes guarantees a path
        console.error('Scene component received undefined or null image path. Using error placeholder.');
        result = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyMCIgaGVpZ2h0PSIxMDgwIiB2aWV3Qm94PSIwIDAgMTkyMCAxMDgwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cmVjdCB3aWR0aD0iMTkyMCIgaGVpZ2h0PSIxMDgwIiBmaWxsPSIjRkY0NDQ0Ii8+Cjx0ZXh0IHg9Ijk2MCIgeT0iNTQwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iNjQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0iY2VudGVyIj5JbWFnZSBFcnJvcjwvdGV4dD4KPHN2Zz4K';
    } else if (image.startsWith('data:') || image.startsWith('http')) {
      console.log('Using direct image URL:', image.substring(0, 50) + '...');
      result = image;
    } else {
      // For local paths (like "remotion-assets/file.jpg"), use staticFile
      try {
        const staticPath = staticFile(image); // 'image' could be "remotion-assets/placeholder.jpg" here
        console.log('Using staticFile for:', image, '-> resolved to:', staticPath);
        result = staticPath;
      } catch (error) {
        console.error(`Error loading image via staticFile (${image}):`, error);
        // Fallback to an error SVG if staticFile fails
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getImageSrc()}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
        }}
        alt={`Scene ${index + 1}`}
        onError={() => {
          console.error(`Failed to load image ${image} for scene ${index}`);
        }}
      />
    </AbsoluteFill>
  );
};
SceneComponent.displayName = 'Scene';
const Scene = memo(SceneComponent);

// Function to get image dimensions from URL for resolution optimization
// const getImageDimensionsFromUrl = async (imageUrl: string): Promise<{ width: number; height: number } | null> => {
//   try {
//     if (!imageUrl || imageUrl === 'placeholder') return null;
    
//     // Only process HTTP URLs (not data URLs or static files)
//     if (!imageUrl.startsWith('http')) return null;
    
//     const response = await fetch(imageUrl);
//     if (!response.ok) return null;
    
//     const buffer = await response.arrayBuffer();
//     const uint8Array = new Uint8Array(buffer);
    
//     // Check for JPEG
//     if (uint8Array[0] === 0xFF && uint8Array[1] === 0xD8) {
//       for (let i = 2; i < uint8Array.length - 8; i++) {
//         if (uint8Array[i] === 0xFF) {
//           const marker = uint8Array[i + 1];
//           if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
//             const height = (uint8Array[i + 5] << 8) | uint8Array[i + 6];
//             const width = (uint8Array[i + 7] << 8) | uint8Array[i + 8];
//             return { width, height };
//           }
//         }
//       }
//     }
    
//     // Check for PNG
//     if (uint8Array[0] === 0x89 && uint8Array[1] === 0x50 && uint8Array[2] === 0x4E && uint8Array[3] === 0x47) {
//       const width = (uint8Array[16] << 24) | (uint8Array[17] << 16) | (uint8Array[18] << 8) | uint8Array[19];
//       const height = (uint8Array[20] << 24) | (uint8Array[21] << 16) | (uint8Array[22] << 8) | uint8Array[23];
//       return { width, height };
//     }
    
//     return null;
//   } catch (error) {
//     console.warn('Could not detect image dimensions:', error);
//     return null;
//   }
// };

// Story Video component - exported for use in Root.tsx
const StoryVideoComponentInner: React.FC<StoryVideoProps> = ({ images, audioChunks, fps }) => {
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
};
StoryVideoComponentInner.displayName = 'StoryVideoComponent';
export const StoryVideoComponent = memo(StoryVideoComponentInner);

// Main entry component for Remotion
export const StoryVideo = () => {
  // getInputProps will now provide images as LocalImageWithMetadata[]
  // Ensure the type passed to getInputProps matches StoryVideoProps
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
