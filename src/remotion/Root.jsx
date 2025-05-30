"use client";

const React = require('react');
const { Composition } = require('remotion');
const { StoryVideoComponent } = require('./StoryVideo');

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

module.exports = { RemotionRoot };