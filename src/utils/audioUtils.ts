/**
 * Utility functions for handling audio loading and playback
 */

/**
 * Test if an audio URL is accessible and can be loaded
 */
export async function testAudioUrl(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const audio = new Audio();
    
    const cleanup = () => {
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('abort', onError);
    };

    const onCanPlay = () => {
      cleanup();
      resolve(true);
    };

    const onError = () => {
      cleanup();
      resolve(false);
    };

    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('error', onError);
    audio.addEventListener('abort', onError);
    
    // Set a timeout to avoid hanging
    setTimeout(() => {
      cleanup();
      resolve(false);
    }, 10000);

    audio.src = url;
    audio.load();
  });
}

/**
 * Get the duration of an audio file from its URL
 */
export async function getAudioDuration(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const audio = new Audio();
    
    const cleanup = () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('error', onError);
    };

    const onLoadedMetadata = () => {
      cleanup();
      resolve(audio.duration || null);
    };

    const onError = () => {
      cleanup();
      resolve(null);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('error', onError);
    
    audio.src = url;
    audio.load();
  });
}

/**
 * Determine if the browser supports a specific audio format
 */
export function canPlayAudioFormat(mimeType: string): boolean {
  const audio = document.createElement('audio');
  const canPlay = audio.canPlayType(mimeType);
  return canPlay === 'probably' || canPlay === 'maybe';
}

/**
 * Get supported audio formats in order of preference
 */
export function getSupportedAudioFormats(): string[] {
  const formats = [
    'audio/mpeg',      // MP3
    'audio/wav',       // WAV
    'audio/ogg',       // OGG
    'audio/mp4',       // MP4/AAC
    'audio/webm'       // WebM
  ];
  
  return formats.filter(format => canPlayAudioFormat(format));
}