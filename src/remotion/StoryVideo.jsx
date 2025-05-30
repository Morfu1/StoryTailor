"use client";

const React = require('react');
const {
  Composition,
  getInputProps,
  AbsoluteFill,
  Series,
  Audio,
  staticFile,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} = require('remotion');

// Calculate the duration for each image based on audio chunk duration
const calculateImageDurations = (audioChunks) => {
  return audioChunks.map((chunk) => {
    // Use duration property instead of durationMs
    const durationInSeconds = (chunk.duration || 0) / 1000;
    // Convert seconds to frames (assuming 30fps)
    return Math.ceil(durationInSeconds * 30);
  });
};

// Individual Scene component
const Scene = ({ image, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Simple fade-in and fade-out effect
  const fadeInDuration = Math.min(30, fps); // 1 second fade in
  const opacity = Math.min(1, frame / fadeInDuration);

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
      {/* If the image is a local file path, use staticFile, otherwise use the URL directly */}
      <img
        src={image.startsWith('http') ? image : staticFile(image)}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
        }}
        alt={`Scene ${index + 1}`}
      />
    </AbsoluteFill>
  );
};

// Story Video component - exported for use in Root.jsx
const StoryVideoComponent = ({ images, audioChunks }) => {
  const imageDurations = calculateImageDurations(audioChunks);
  
  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {/* Render images in sequence */}
      <Series>
        {images.map((image, index) => {
          if (index >= imageDurations.length) return null;
          
          return (
            <Series.Sequence durationInFrames={imageDurations[index]} key={index}>
              <Scene image={image} index={index} />
            </Series.Sequence>
          );
        })}
      </Series>
      
      {/* Render audio */}
      {audioChunks.map((chunk, index) => {
        // Calculate the start frame for this audio chunk
        const startFrame = imageDurations
          .slice(0, index)
          .reduce((acc, duration) => acc + duration, 0);
        
        return (
          <Sequence from={startFrame} key={index}>
            <Audio
              src={chunk.audioUrl ? (chunk.audioUrl.startsWith('http') ? chunk.audioUrl : staticFile(chunk.audioUrl)) : ''}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

// Main entry component for Remotion
const StoryVideo = () => {
  const { images, audioChunks } = getInputProps();
  
  return (
    <Composition
      id="StoryVideo"
      component={StoryVideoComponent}
      durationInFrames={calculateImageDurations(audioChunks).reduce((a, b) => a + b, 0)}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        images,
        audioChunks,
      }}
    />
  );
};

module.exports = { StoryVideo, StoryVideoComponent };