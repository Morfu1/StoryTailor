// Test script for Remotion rendering - images only
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

// Ensure output directory exists
const outputDir = path.join(__dirname, '../../public/test');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Path to test output file
const outputPath = path.join(outputDir, 'test-video.mp4');

// Path to the entry point
const entryPoint = path.resolve(__dirname, './index.ts');

// Create test assets directory
const assetsDir = path.join(__dirname, '../../public/remotion-assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Create simple image files (1px black transparent GIFs encoded as base64)
const imageData = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

// Write test image files
const testImage1 = path.join(assetsDir, 'test-image-1.jpg');
const testImage2 = path.join(assetsDir, 'test-image-2.jpg');
const testImage3 = path.join(assetsDir, 'test-image-3.jpg');
const testImage4 = path.join(assetsDir, 'test-image-4.jpg');
fs.writeFileSync(testImage1, imageData);
fs.writeFileSync(testImage2, imageData);
fs.writeFileSync(testImage3, imageData);
fs.writeFileSync(testImage4, imageData);

console.log('Created test images:', testImage1, testImage2, testImage3, testImage4);

// Sample props for an images-only test (no audio)
const props = {
  images: [
    // Local images in the public folder, using the format needed by staticFile()
    'remotion-assets/test-image-1.jpg',
    'remotion-assets/test-image-2.jpg',
    'remotion-assets/test-image-3.jpg',
    'remotion-assets/test-image-4.jpg'
  ],
  // Using audioChunks with durations but NO audioUrl properties
  // This is important because our StoryVideo component requires audioChunks
  // but we want to avoid audio file issues
  audioChunks: [
    { 
      id: 'chunk-1',
      index: 0,
      text: 'This is a test chunk one',
      duration: 3000 // 3 seconds
      // No audioUrl property!
    },
    { 
      id: 'chunk-2',
      index: 1,
      text: 'This is a test chunk two',
      duration: 3000 // 3 seconds
      // No audioUrl property!
    },
    { 
      id: 'chunk-3',
      index: 2,
      text: 'This is a test chunk three',
      duration: 3000 // 3 seconds
      // No audioUrl property!
    },
    { 
      id: 'chunk-4',
      index: 3,
      text: 'This is a test chunk four',
      duration: 3000 // 3 seconds
      // No audioUrl property!
    }
  ]
};

// Log props for debugging
console.log('Test props:', JSON.stringify(props, null, 2));

// Create props file
const propsPath = path.join(__dirname, 'test-props.json');
fs.writeFileSync(propsPath, JSON.stringify(props));

// Cleanup function to remove test files
const cleanup = () => {
  console.log('Cleaning up test files...');
  try {
    if (fs.existsSync(propsPath)) {
      fs.unlinkSync(propsPath);
    }
    console.log('Cleanup completed');
  } catch (err) {
    console.error('Error during cleanup:', err);
  }
};

// Attach cleanup to process exit
process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit();
});

// Command to render with verbose logging
const command = `npx remotion render "${entryPoint}" StoryVideo "${outputPath}" --props="${propsPath}" --disable-web-security --log=verbose`;

console.log('Running Remotion test render with command:');
console.log(command);

// Execute render
exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error('Error executing Remotion render:', error);
    console.error('Error output:');
    console.error(stderr);
    cleanup();
    return;
  }
  
  console.log('Render output:');
  console.log(stdout);
  
  if (stderr) {
    console.log('Warning/Error output:');
    console.log(stderr);
  }
  
  if (fs.existsSync(outputPath)) {
    console.log('✅ Success! Test video was rendered to:', outputPath);
    console.log('File size:', fs.statSync(outputPath).size, 'bytes');
    
    // Check if the video is valid (size > 0)
    if (fs.statSync(outputPath).size === 0) {
      console.log('⚠️ Warning: Generated video file has zero size!');
    } else {
      console.log('✅ Video file has valid size, likely rendered correctly');
    }
  } else {
    console.log('❌ Failed! No output file was generated.');
  }
  
  cleanup();
});