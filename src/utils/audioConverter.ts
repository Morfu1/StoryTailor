/**
 * Client-side audio conversion utilities
 * Used to convert WAV files to browser-compatible formats
 */

/**
 * Refresh an expired MinIO Storage URL by calling the server action
 */
async function refreshExpiredUrl(expiredUrl: string): Promise<string | null> {
  try {
    // Call server action to refresh the URL
    const { refreshMinIOStorageUrlClient } = await import('@/actions/minioStorageClientActions');
    return await refreshMinIOStorageUrlClient(expiredUrl);
  } catch (error) {
    console.error('Error refreshing URL:', error);
    return null;
  }
}

/**
 * Convert Google TTS PCM data to a playable WAV file
 * Google TTS returns raw PCM data at 24kHz 16-bit mono, not a complete WAV file
 */
export async function convertWavToPlayableUrl(audioUrl: string, retryWithRefresh = true): Promise<string | null> {
  try {
    console.log('Attempting to fetch audio from URL:', audioUrl);
    // Fetch the audio data
    const response = await fetch(audioUrl);
    if (!response.ok) {
      console.error('Failed to fetch audio file:', response.status, response.statusText);
      console.error('URL that failed:', audioUrl);
      console.error('Response headers:', Object.fromEntries(response.headers.entries()));
      
      // If we get a 400 or 403 error, the signed URL might be expired
      if ((response.status === 400 || response.status === 403) && retryWithRefresh) {
        console.log('Attempting to refresh expired URL and retry...');
        try {
          const refreshedUrl = await refreshExpiredUrl(audioUrl);
          if (refreshedUrl && refreshedUrl !== audioUrl) {
            console.log('Got refreshed URL, retrying fetch...');
            return convertWavToPlayableUrl(refreshedUrl, false); // Avoid infinite recursion
          }
        } catch (refreshError) {
          console.error('Failed to refresh URL:', refreshError);
        }
      }
      
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    
    // Check if this is already a complete WAV file or raw PCM data
    const view = new Uint8Array(arrayBuffer);
    const isAlreadyWav = view[0] === 0x52 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x46; // "RIFF"
    
    if (isAlreadyWav) {
      // Already a complete WAV file, just return as blob
      console.log('Audio is already a complete WAV file');
      const wavBlob = new Blob([arrayBuffer], { type: 'audio/wav' });
      return URL.createObjectURL(wavBlob);
    } else {
      // This is raw PCM data from Google TTS, add WAV headers
      console.log('Converting raw PCM data to WAV format');
      const wavBlob = addWavHeaders(arrayBuffer);
      return URL.createObjectURL(wavBlob);
    }
  } catch (error) {
    console.error('Error converting audio file:', error);
    return null;
  }
}

/**
 * Add WAV headers to raw PCM data from Google TTS
 * Google TTS returns 24kHz, 16-bit, mono PCM data
 */
function addWavHeaders(pcmData: ArrayBuffer): Blob {
  const pcmBytes = pcmData.byteLength;
  const sampleRate = 24000; // Google TTS uses 24kHz
  const numChannels = 1; // Mono
  const bitsPerSample = 16; // 16-bit
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  
  // WAV header is 44 bytes
  const headerSize = 44;
  const fileSize = headerSize + pcmBytes;
  
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);
  
  // RIFF header
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, fileSize - 8, true); // File size - 8
  view.setUint32(8, 0x57415645, false); // "WAVE"
  
  // fmt chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // Audio format (1 = PCM)
  view.setUint16(22, numChannels, true); // Number of channels
  view.setUint32(24, sampleRate, true); // Sample rate
  view.setUint32(28, byteRate, true); // Byte rate
  view.setUint16(32, blockAlign, true); // Block align
  view.setUint16(34, bitsPerSample, true); // Bits per sample
  
  // data chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, pcmBytes, true); // Data size
  
  // Copy PCM data
  // const headerArray = new Uint8Array(buffer, 0, headerSize); // Unused
  const dataArray = new Uint8Array(buffer, headerSize);
  const pcmArray = new Uint8Array(pcmData);
  dataArray.set(pcmArray);
  
  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Convert AudioBuffer to WAV blob
 */
// function audioBufferToWav(buffer: AudioBuffer): Blob { // Unused
//   const length = buffer.length;
//   const numberOfChannels = buffer.numberOfChannels;
//   const sampleRate = buffer.sampleRate;
//   const bitDepth = 16;
  
//   const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
//   const view = new DataView(arrayBuffer);
  
//   // WAV header
//   const writeString = (offset: number, string: string) => {
//     for (let i = 0; i < string.length; i++) {
//       view.setUint8(offset + i, string.charCodeAt(i));
//     }
//   };
  
//   writeString(0, 'RIFF');
//   view.setUint32(4, 36 + length * numberOfChannels * 2, true);
//   writeString(8, 'WAVE');
//   writeString(12, 'fmt ');
//   view.setUint32(16, 16, true);
//   view.setUint16(20, 1, true);
//   view.setUint16(22, numberOfChannels, true);
//   view.setUint32(24, sampleRate, true);
//   view.setUint32(28, sampleRate * numberOfChannels * bitDepth / 8, true);
//   view.setUint16(32, numberOfChannels * bitDepth / 8, true);
//   view.setUint16(34, bitDepth, true);
//   writeString(36, 'data');
//   view.setUint32(40, length * numberOfChannels * 2, true);
  
//   // Convert float samples to 16-bit PCM
//   let offset = 44;
//   for (let i = 0; i < length; i++) {
//     for (let channel = 0; channel < numberOfChannels; channel++) {
//       const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
//       view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
//       offset += 2;
//     }
//   }
  
//   return new Blob([arrayBuffer], { type: 'audio/wav' });
// }

/**
 * Check if a URL needs conversion (is a WAV file that might not be playable)
 */
export function needsAudioConversion(url: string): boolean {
  // Don't convert blob URLs (already converted) or data URLs
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return false;
  }
  return url.includes('.wav') && url.includes('storage.googleapis.com');
}