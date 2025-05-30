import { Config } from '@remotion/cli/config';

// Remotion configuration for optimized rendering
Config.setVideoImageFormat('jpeg');
Config.setImageSequence(false);

// Optimize concurrency for better performance  
// Based on benchmark results, 4 concurrent tabs work well for this hardware
Config.setConcurrency(4);

// Enable output location override
Config.setOutputLocation('out');

// Enable better caching
Config.setMaxTimelineTracks(10);

// Optimize puppeteer for rendering
Config.setBrowserExecutable(null);
Config.setChromiumOpenGlRenderer('egl');

// Quality settings for faster rendering
// Config.setQuality(80); // Lower quality for faster rendering (adjust as needed)

export default Config;
