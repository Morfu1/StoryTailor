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
  images: LocalImageWithMetadata[];
  audioChunks: NarrationChunk[];
  fps?: number;
  placeholderAssetPath?: string; // Added placeholder path
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
const organizeScenes = (
  images: LocalImageWithMetadata[],
  audioChunks: NarrationChunk[],
  fps: number = VIDEO_FPS,
  placeholderAssetPath: string // Added placeholder path argument
): SceneData[] => {
  console.log('--- organizeScenes ---');
  console.log(`Received ${images.length} images and ${audioChunks.length} audio chunks.`);
  console.log(`Using placeholderAssetPath: ${placeholderAssetPath}`);
  
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
    // Use the provided placeholderAssetPath if no images, otherwise use actual images
    const defaultImages = images.length > 0 ? images.map(getImageUrl) : [placeholderAssetPath];
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
        images: [placeholderAssetPath], // Use the provided placeholder path
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
      const chunkImageUrls = chunkImages.length > 0
        ? chunkImages.map(getImageUrl) // This will get localPath from LocalImageWithMetadata
        : [placeholderAssetPath]; // Fallback to provided placeholderAssetPath if no images for chunk
      
      if (chunkImages.length === 0) {
        console.log(`Chunk ${i + 1} (${chunk.id}): No specific images assigned. Using placeholder: ${placeholderAssetPath}`);
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
const SceneComponent = ({ image: imagePathProp, index }: { image: string; index: number }) => { // Renamed image to imagePathProp for clarity
  const frame = useCurrentFrame();
  let staticPathDisplay = 'N/A';
  let staticFileErrorDisplay = 'None';
  let imageToRenderSource = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=='; // Transparent pixel

  try {
    if (imagePathProp) {
      if (imagePathProp.startsWith('data:') || imagePathProp.startsWith('http')) {
        staticPathDisplay = imagePathProp; // It's already a data URI or absolute URL
        imageToRenderSource = imagePathProp;
      } else {
        // Attempt to resolve with staticFile
        const resolved = staticFile(imagePathProp);
        staticPathDisplay = resolved;
        imageToRenderSource = resolved;
      }
    } else {
      staticPathDisplay = 'Error: imagePathProp is null/undefined';
      staticFileErrorDisplay = 'imagePathProp is null/undefined';
      // Keep imageToRenderSource as transparent pixel or error SVG
      imageToRenderSource = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyMCIgaGVpZ2h0PSIxMDgwIiB2aWV3Qm94PSIwIDAgMTkyMCAxMDgwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cmVjdCB3aWR0aD0iMTkyMCIgaGVpZ2h0PSIxMDgwIiBmaWxsPSIjRkY0NDQ0Ii8+Cjx0ZXh0IHg9Ijk2MCIgeT0iNTQwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iNjQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0iY2VudGVyIj5JbWFnZSBFcnJvcjwvZm9udD48L3N2Zz4K';
    }
  } catch (e: any) {
    staticFileErrorDisplay = e.message || 'Unknown error during staticFile()';
    staticPathDisplay = `Error resolving: ${staticFileErrorDisplay}`;
    imageToRenderSource = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyMCIgaGVpZ2h0PSIxMDgwIiB2aWV3Qm94PSIwIDAgMTkyMCAxMDgwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cmVjdCB3aWR0aD0iMTkyMCIgaGVpZ2h0PSIxMDgwIiBmaWxsPSIjRkY0NDQ0Ii8+Cjx0ZXh0IHg9Ijk2MCIgeT0iNTQwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iNjQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0iY2VudGVyIj5TdGF0aWNGaWxlIEVycm9yPC90ZXh0Pjwvc3ZnPgo='; // SVG for StaticFile Error
  }

  const opacity = useMemo(() => {
    const fadeInDuration = 10; // Opacity calculation based on component frame, not video frame
    return Math.min(1, frame / fadeInDuration);
  }, [frame]);

  const sceneDebugTextStyle: React.CSSProperties = {
    color: 'lime',
    fontSize: '16px',
    fontFamily: 'monospace',
    padding: '5px',
    backgroundColor: 'rgba(0,0,0,0.7)',
    position: 'absolute',
    bottom: '10px',
    left: '10px',
    zIndex: 1001,
    maxWidth: '95%',
    maxHeight: '30%',
    overflowY: 'auto',
    wordBreak: 'break-all',
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: 'rgba(50,0,0,0.5)', // Dark red semi-transparent background for scene debugging
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        opacity,
      }}
    >
      <img
        src={imageToRenderSource}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
        }}
        alt={`Scene ${index + 1} - ${imagePathProp || 'No Path'}`}
      />
      <div style={sceneDebugTextStyle}>
        <div>Scene Index: {index}</div>
        <div>Img Prop (localPath): {imagePathProp || 'N/A'}</div>
        <div>Resolved Src (staticFile): {staticPathDisplay}</div>
        <div>staticFile() Error: {staticFileErrorDisplay}</div>
        <div>Current Frame (in scene): {frame}</div>
      </div>
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
const StoryVideoComponentInner: React.FC<StoryVideoProps> = ({ images, audioChunks, fps, placeholderAssetPath }) => {
  // console.log statements are not appearing in stderr, so we'll use visual debugging.
  // console.log('=== StoryVideoComponent rendering ===');
  // console.log('- Images count:', images?.length || 0);
  // console.log('- Placeholder asset path:', placeholderAssetPath);
  // console.log('- Audio chunks count:', audioChunks?.length || 0);
  
  // if (images?.length) {
  //   console.log('- First 5 images:', images.slice(0, 5));
  // }
  
  const frame = useCurrentFrame();
  const actualFPS = fps || VIDEO_FPS;
  // console.log('- Using FPS:', actualFPS);

  // Memoize scene organization - expensive computation
  const scenes = useMemo(() => {
    if (!placeholderAssetPath) {
      console.error("Placeholder asset path is undefined in StoryVideoComponentInner. Scenes may not render correctly.");
      // Potentially return empty scenes or throw an error
      // For now, proceed but expect issues if placeholder is needed.
    }
    return organizeScenes(images || [], audioChunks || [], actualFPS, placeholderAssetPath || 'error-placeholder-path-missing.jpg');
  }, [images, audioChunks, actualFPS, placeholderAssetPath]);
  
  console.log('=== Organized into', scenes.length, 'scenes ===');
  
  // Memoize total duration calculation
  const totalDurationInFrames = useMemo(() => {
    return calculateTotalDuration(scenes);
  }, [scenes]);
  
  // console.log('=== Total video duration:', totalDurationInFrames, 'frames =', totalDurationInFrames / actualFPS, 'seconds ===');
  
  const debugTextStyle: React.CSSProperties = {
    color: 'white',
    fontSize: '20px',
    fontFamily: 'Arial, sans-serif',
    padding: '10px',
    backgroundColor: 'rgba(0,0,0,0.5)',
    position: 'absolute',
    top: '10px',
    left: '10px',
    zIndex: 1000, // Ensure it's on top
  };

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      <div style={debugTextStyle}>
        <div>Frame: {frame} / {totalDurationInFrames} (FPS: {actualFPS})</div>
        <div>StoryVideoComponentInner Active</div>
        <div>Images Rcvd: {images?.length || 0}</div>
        <div>AudioChunks Rcvd: {audioChunks?.length || 0}</div>
        <div>Placeholder Path: {placeholderAssetPath}</div>
        <div>Scenes Calculated: {scenes.length}</div>
      </div>

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
                  src={staticFile(scene.audioChunk.audioUrl)}
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
  const { images, audioChunks, width, height, fps, detectedDimensions, placeholderAssetPath } = getInputProps<StoryVideoProps & {
    width?: number;
    height?: number;
    detectedDimensions?: { width: number; height: number };
    placeholderAssetPath?: string; // Ensure this is part of the props type for getInputProps
  }>();
  
  console.log('StoryVideo loading:', images?.length || 0, 'images,', audioChunks?.length || 0, 'chunks');
  console.log('Placeholder asset path from props:', placeholderAssetPath);
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
        placeholderAssetPath, // Pass placeholder path to the component
      }}
    />
  );
};
