"use client";

import React from 'react';
import { Composition } from 'remotion';
import { StoryVideoComponent } from './StoryVideo';

// Root component for Remotion
const RemotionRoot = () => {
  // Default props for preview (these will be overridden during actual rendering)
  const defaultImages = [];
  const defaultAudioChunks = [];
  
  return (
    <>
      <Composition
        id="StoryVideo"
        component={StoryVideoComponent}
        durationInFrames={300} // Default duration, will be overridden
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          images: defaultImages,
          audioChunks: defaultAudioChunks,
        }}
      />
    </>
  );
};

export { RemotionRoot };