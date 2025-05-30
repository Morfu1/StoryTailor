"use client";

import React from 'react';
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

// Make this a Record<string, unknown> to satisfy Remotion type constraints
interface StoryVideoProps extends Record<string, unknown> {
  images: string[];
  audioChunks: NarrationChunk[];
}

// Define a structure for scene organization
interface SceneData {
  audioChunk: NarrationChunk;
  images: string[];
  durationInFrames: number;
  imageFrameDurations: number[];
}

// Associate images with audio chunks and calculate appropriate durations
const organizeScenes = (images: string[], audioChunks: NarrationChunk[]): SceneData[] => {
  console.log('Organizing scenes with:', images.length, 'images and', audioChunks.length, 'audio chunks');
  
  // Use all chunks with proper durations - don't filter too aggressively
  const validChunks = audioChunks.filter(chunk => 
    chunk.duration && chunk.duration > 0
  );
  
  if (validChunks.length === 0) {
    console.warn('No valid audio chunks found, creating default scene with images');
    const totalFrames = images.length * 90; // 3 seconds per image at 30fps
    return [{
      audioChunk: { id: 'default', text: '', index: 0, duration: totalFrames * 1000 / 30 },
      images: images.length > 0 ? images : ['placeholder'],
      durationInFrames: totalFrames,
      imageFrameDurations: images.map(() => 90)
    }];
  }
  
  console.log('Using', validChunks.length, 'valid chunks, total duration:', validChunks.reduce((sum, chunk) => sum + (chunk.duration || 0), 0), 'seconds');
  
  // Ensure we have at least one image per chunk
  const paddedImages = [...images];
  while (paddedImages.length < validChunks.length) {
    const lastImage = paddedImages[paddedImages.length - 1] || 'placeholder';
    paddedImages.push(lastImage);
  }
  
  // Distribute images across chunks
  const scenes: SceneData[] = [];
  const imagesPerChunk = Math.max(1, Math.floor(paddedImages.length / validChunks.length));
  const extraImages = paddedImages.length % validChunks.length;
  
  let imageIndex = 0;
  
  for (let i = 0; i < validChunks.length; i++) {
    const chunk = validChunks[i];
    const chunkImages = [];
    
    // Calculate how many images this chunk gets
    const imagesForThisChunk = imagesPerChunk + (i < extraImages ? 1 : 0);
    
    // Assign images to this chunk
    for (let j = 0; j < imagesForThisChunk && imageIndex < paddedImages.length; j++) {
      chunkImages.push(paddedImages[imageIndex]);
      imageIndex++;
    }
    
    // Ensure at least one image per chunk
    if (chunkImages.length === 0) {
      chunkImages.push(paddedImages[i % paddedImages.length] || 'placeholder');
    }
    
    // Calculate frame duration from audio chunk duration - durations are already in seconds
    const durationInSeconds = chunk.duration || 0; // Durations are already in seconds
    const totalFrames = Math.ceil(durationInSeconds * 30); // 30 fps
    
    // Frame calculation complete
    
    // Distribute frames evenly across images in this chunk
    const framesPerImage = Math.max(1, Math.floor(totalFrames / chunkImages.length));
    const extraFrames = totalFrames - (framesPerImage * chunkImages.length);
    
    const imageFrameDurations = chunkImages.map((_, idx) =>
      framesPerImage + (idx < extraFrames ? 1 : 0)
    );
    
    scenes.push({
      audioChunk: chunk,
      images: chunkImages,
      durationInFrames: totalFrames,
      imageFrameDurations
    });
  }
  
  const totalFrames = scenes.reduce((sum, scene) => sum + scene.durationInFrames, 0);
  console.log('Organized', scenes.length, 'scenes, total duration:', totalFrames / 30, 'seconds');
  
  // Debug: Check first few scenes and their images
  console.log('First 3 scenes images:');
  scenes.slice(0, 3).forEach((scene, i) => {
    console.log(`Scene ${i}:`, scene.images);
  });
  
  return scenes;
};

// Calculate total duration in frames from scenes
const calculateTotalDuration = (scenes: SceneData[]): number => {
  return scenes.reduce((acc, scene) => acc + scene.durationInFrames, 0);
};

// Individual Scene component  
const Scene = ({ image, index }: { image: string; index: number }) => {
  const frame = useCurrentFrame();

  // Simple fade-in effect for the first few frames
  const fadeInDuration = 10;
  const opacity = frame < fadeInDuration ? frame / fadeInDuration : 1;

  // Simplified image source handling
  const getImageSrc = () => {
    if (!image || image === 'placeholder') {
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyMCIgaGVpZ2h0PSIxMDgwIiB2aWV3Qm94PSIwIDAgMTkyMCAxMDgwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cmVjdCB3aWR0aD0iMTkyMCIgaGVpZ2h0PSIxMDgwIiBmaWxsPSIjMzMzMzMzIi8+Cjx0ZXh0IHg9Ijk2MCIgeT0iNTQwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iNjQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0iY2VudGVyIj5TY2VuZSBJbWFnZTwvdGV4dD4KPHN2Zz4K';
    }
    
    if (image.startsWith('data:') || image.startsWith('http')) {
      return image;
    }
    
    // For local paths, use staticFile
    try {
      return staticFile(image);
    } catch (error) {
      console.error(`Error loading image ${image}:`, error);
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyMCIgaGVpZ2h0PSIxMDgwIiB2aWV3Qm94PSIwIDAgMTkyMCAxMDgwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cmVjdCB3aWR0aD0iMTkyMCIgaGVpZ2h0PSIxMDgwIiBmaWxsPSIjRkY0NDQ0Ii8+Cjx0ZXh0IHg9Ijk2MCIgeT0iNTQwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iNjQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0iY2VudGVyIj5JbWFnZSBFcnJvcjwvdGV4dD4KPHN2Zz4K';
    }
  };

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
};

// Story Video component - exported for use in Root.tsx
export const StoryVideoComponent: React.FC<StoryVideoProps> = ({ images, audioChunks }) => {
  console.log('=== StoryVideoComponent rendering ===');
  console.log('- Images count:', images?.length || 0);
  console.log('- Audio chunks count:', audioChunks?.length || 0);
  
  if (images?.length) {
    console.log('- First 5 images:', images.slice(0, 5));
  }
  
  // Organize scenes to associate images with audio chunks
  const scenes = organizeScenes(images || [], audioChunks || []);
  console.log('=== Organized into', scenes.length, 'scenes ===');
  
  // Calculate the total duration in frames
  const totalDurationInFrames = calculateTotalDuration(scenes);
  console.log('=== Total video duration:', totalDurationInFrames, 'frames =', totalDurationInFrames / 30, 'seconds ===');
  
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

// Helper to detect image dimensions and calculate optimal video resolution
const calculateOptimalResolution = async (images: string[]): Promise<{ width: number; height: number }> => {
  if (!images || images.length === 0) {
    return { width: 1920, height: 1080 }; // Default Full HD
  }

  try {
    // Take the first valid image to detect dimensions
    const firstImage = images.find(img => img && img !== 'placeholder');
    if (!firstImage) {
      return { width: 1920, height: 1080 };
    }

    // Create a promise to load the image and get its dimensions
    const getImageDimensions = (src: string): Promise<{ width: number; height: number }> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = () => {
          resolve({ width: 1920, height: 1080 }); // Fallback on error
        };
        img.src = src;
      });
    };

    const dimensions = await getImageDimensions(firstImage);
    
    // If images are smaller than Full HD, use their dimensions for faster rendering
    if (dimensions.width <= 1280 && dimensions.height <= 720) {
      console.log('Using image dimensions for faster rendering:', dimensions);
      return dimensions;
    }
    
    // For larger images, use standard resolutions for consistency
    console.log('Using Full HD for large images');
    return { width: 1920, height: 1080 };
  } catch (error) {
    console.error('Error detecting image dimensions:', error);
    return { width: 1920, height: 1080 }; // Fallback
  }
};

// Main entry component for Remotion
export const StoryVideo = () => {
  const { images, audioChunks } = getInputProps<StoryVideoProps>();
  
  console.log('StoryVideo loading:', images?.length || 0, 'images,', audioChunks?.length || 0, 'chunks');
  
  // Calculate total duration from scenes for the composition
  const calculateDuration = (): number => {
    try {
      if (audioChunks?.length > 0) {
        // Calculate total duration directly from audio chunk durations (already in seconds)
        const totalAudioDuration = audioChunks
          .filter(chunk => chunk.duration && chunk.duration > 0)
          .reduce((sum, chunk) => sum + (chunk.duration || 0), 0);
        
        const totalFrames = Math.ceil(totalAudioDuration * 30); // Convert seconds to frames at 30fps
        
        console.log('Video duration:', totalFrames, 'frames (', totalFrames / 30, 'sec)');
        
        if (totalFrames > 0) {
          return totalFrames;
        }
      }
    } catch (error) {
      console.error('Error calculating duration:', error);
    }
    
    // Fallback: try to calculate from images if no audio
    if (images?.length > 0) {
      const fallbackFrames = images.length * 90; // 3 seconds per image
      console.log('Using image fallback:', fallbackFrames, 'frames');
      return fallbackFrames;
    }
    
    // Final fallback
    console.log('Using default fallback: 300 frames');
    return 300;
  };

  // Calculate optimal resolution based on image dimensions
  const [resolution, setResolution] = React.useState({ width: 1920, height: 1080 });

  React.useEffect(() => {
    if (images?.length > 0) {
      calculateOptimalResolution(images).then(setResolution);
    }
  }, [images]);
  
  return (
    <Composition
      id="StoryVideo"
      component={StoryVideoComponent}
      durationInFrames={calculateDuration()}
      fps={30}
      width={resolution.width}
      height={resolution.height}
      defaultProps={{
        images,
        audioChunks,
      }}
    />
  );
};
