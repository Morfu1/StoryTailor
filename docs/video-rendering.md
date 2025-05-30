# Video Rendering Functionality

This document describes the video rendering functionality added to StoryTailor using [Remotion](https://www.remotion.dev/).

## Overview

The video rendering feature takes the generated story images and narration audio and combines them into a single MP4 video. This video shows each image while playing the corresponding narration audio.

## Components

### 1. Remotion Components

- `src/remotion/StoryVideo.tsx`: Main Remotion composition that renders images and audio in sequence

### 2. Utility Functions

- `src/utils/remotionUtils.ts`: Contains functions for:
  - Rendering videos with Remotion
  - Downloading assets for rendering
  - Saving rendered videos for download

### 3. API Endpoint

- `src/app/api/render-video/route.ts`: API endpoint for rendering videos
- `src/app/api/render-video/init-downloads.ts`: Helper to ensure download directories exist

### 4. UI Integration

- Added a "Generate Video" button in the FinalReviewStep component

## How It Works

1. User clicks "Generate Video" in the Final Review step
2. The application sends a request to the `/api/render-video` endpoint with:
   - Scene images URLs
   - Narration audio chunks
   - Story title and ID
3. The server:
   - Downloads all assets to temporary files
   - Renders the video using Remotion
   - Saves the video to the public directory
   - Returns the download URL
4. The user can download the rendered video

## Technical Details

### Video Specifications

- Resolution: 1920x1080 (Full HD)
- Frame rate: 30fps
- Codec: H.264
- Images and audio are intelligently matched:
  - If there are multiple images per audio chunk, they are evenly distributed across the chunk's duration
  - If there are fewer images than audio chunks, the last image is duplicated to ensure each chunk has visuals
  - Images have smooth fade-in transitions

### File Management

- Asset files (images and audio) are stored in `/public/remotion-assets/` during rendering
  - This location is required for Remotion's `staticFile()` function to work properly
  - Files are cleaned up automatically after rendering is complete
- Final rendered videos are stored in `/public/downloads/videos/`
- Each video filename includes a timestamp to prevent conflicts

## Usage

To render a video:

1. Complete all story creation steps (script, narration, images)
2. Navigate to the Final Review step
3. Click the "Generate Video" button
4. Wait for the rendering process to complete
5. Click "Download Video" to save the MP4 file

## Dependencies

- `@remotion/cli`: Command-line interface for Remotion
- `@remotion/renderer`: Server-side rendering capabilities
- `@remotion/bundler`: Bundles React components for rendering
- `@remotion/player`: React component for playing Remotion videos