'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Volume2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoicePreviewPlayerProps {
  audioDataUri?: string;
  isLoading?: boolean;
  onPlay?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function VoicePreviewPlayer({ 
  audioDataUri, 
  isLoading = false, 
  onPlay, 
  className,
  size = 'sm'
}: VoicePreviewPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const hasAutoPlayed = useRef<boolean>(false);
  const previousAudioDataUri = useRef<string | undefined>(audioDataUri);

  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8', 
    lg: 'h-10 w-10'
  };

  const iconSizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  useEffect(() => {
    if (audioDataUri && audioRef.current) {
      const format = audioDataUri.split(';')[0];
      console.log('Setting audio src:', {
        format: format,
        size: audioDataUri.length,
        preview: audioDataUri.substring(0, 100) + '...'
      });
      
      // Check if the browser can play this format
      const mimeType = format.replace('data:', '');
      const canPlay = audioRef.current.canPlayType(mimeType);
      console.log('Can play format:', {
        mimeType: mimeType,
        canPlay: canPlay,
        canPlayResult: canPlay === '' ? 'Not supported' : canPlay === 'maybe' ? 'Maybe supported' : 'Probably supported'
      });
      
      // For Google TTS WAV format (24kHz PCM), we need to handle it differently
      if (format.includes('audio/wav') && (canPlay === '' || canPlay === 'maybe')) {
        console.warn('Browser may not fully support this WAV format. Attempting Web Audio API conversion for Google TTS.');
        createWebAudioPlayback(audioDataUri);
      } else {
        // ElevenLabs MP3 and other supported formats
        audioRef.current.src = audioDataUri;
        audioRef.current.load();
      }
    }
  }, [audioDataUri]);

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  // Track when we get new audio data for autoplay
  useEffect(() => {
    if (audioDataUri && audioDataUri !== previousAudioDataUri.current) {
      hasAutoPlayed.current = false;
      previousAudioDataUri.current = audioDataUri;
    }
  }, [audioDataUri]);

  // Autoplay handler
  const handleAutoPlay = async () => {
    if (!hasAutoPlayed.current && audioRef.current && audioDataUri) {
      hasAutoPlayed.current = true;
      try {
        console.log('Auto-playing newly generated voice preview...');
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (error) {
        console.log('Autoplay prevented by browser policy:', error);
        // Autoplay failed (browser policy), but that's okay
        // User can still manually play
      }
    }
  };

  const createWebAudioPlayback = async (dataUri: string) => {
    try {
      console.log('Converting Google TTS WAV using existing audio converter logic...');
      
      // Extract base64 data and convert to ArrayBuffer
      const base64Data = dataUri.split(',')[1];
      const arrayBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0)).buffer;
      
      console.log('Decoded arrayBuffer size:', arrayBuffer.byteLength);
      
      // Check if this is already a complete WAV file or raw PCM data (same logic as audioConverter)
      const view = new Uint8Array(arrayBuffer);
      const isAlreadyWav = view[0] === 0x52 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x46; // "RIFF"
      
      let wavBlob: Blob;
      
      if (isAlreadyWav) {
        console.log('Audio is already a complete WAV file');
        wavBlob = new Blob([arrayBuffer], { type: 'audio/wav' });
      } else {
        console.log('Converting raw PCM data to WAV format using audioConverter logic');
        wavBlob = addWavHeaders(arrayBuffer);
      }
      
      const objectUrl = URL.createObjectURL(wavBlob);
      objectUrlRef.current = objectUrl;
      
      console.log('Created WAV blob:', {
        blobSize: wavBlob.size,
        blobType: wavBlob.type,
        wasAlreadyWav: isAlreadyWav
      });
      
      if (audioRef.current) {
        audioRef.current.src = objectUrl;
        audioRef.current.load();
      }
      
    } catch (error) {
      console.error('Audio conversion failed:', error);
      console.log('Falling back to direct data URI...');
      
      // Fallback: try the original data URI
      if (audioRef.current) {
        audioRef.current.src = dataUri;
        audioRef.current.load();
      }
    }
  };

  // Add WAV headers to raw PCM data from Google TTS (same as audioConverter.ts)
  const addWavHeaders = (pcmData: ArrayBuffer): Blob => {
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
    const dataArray = new Uint8Array(buffer, headerSize);
    const pcmArray = new Uint8Array(pcmData);
    dataArray.set(pcmArray);
    
    return new Blob([buffer], { type: 'audio/wav' });
  };

  const handleTogglePlay = async () => {
    if (!audioDataUri) {
      onPlay?.();
      return;
    }

    if (!audioRef.current) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        console.log('Attempting to play audio:', {
          src: audioRef.current.src?.substring(0, 100) + '...',
          readyState: audioRef.current.readyState,
          networkState: audioRef.current.networkState
        });
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error playing audio:', {
        error,
        audioSrc: audioRef.current?.src?.substring(0, 100) + '...',
        readyState: audioRef.current?.readyState,
        networkState: audioRef.current?.networkState
      });
      setIsPlaying(false);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
  };

  const handleError = (event: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    const audio = event.target as HTMLAudioElement;
    const errorDetails = {
      error: audio.error,
      errorCode: audio.error?.code,
      errorMessage: audio.error?.message,
      networkState: audio.networkState,
      readyState: audio.readyState,
      src: audio.src?.substring(0, 100) + '...', // Log first 100 chars of src
      audioDataUri: audioDataUri?.substring(0, 100) + '...' // Log first 100 chars
    };
    
    console.error('Audio playback error:', errorDetails);
    
    // Try to provide more specific error information
    if (audio.error) {
      switch (audio.error.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          console.error('Audio error: Playback aborted');
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          console.error('Audio error: Network error');
          break;
        case MediaError.MEDIA_ERR_DECODE:
          console.error('Audio error: Decode error - audio format may not be supported');
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          console.error('Audio error: Source not supported - invalid audio format or data URI');
          break;
        default:
          console.error('Audio error: Unknown error');
      }
    }
    
    setIsPlaying(false);
  };

  const getIcon = () => {
    if (isLoading) {
      return <Loader2 className={cn(iconSizeClasses[size], 'animate-spin')} />;
    }
    
    if (!audioDataUri) {
      return <Volume2 className={iconSizeClasses[size]} />;
    }
    
    return isPlaying ? 
      <Pause className={iconSizeClasses[size]} /> : 
      <Play className={iconSizeClasses[size]} />;
  };

  const getTitle = () => {
    if (isLoading) return 'Generating preview...';
    if (!audioDataUri) return 'Generate voice preview';
    return isPlaying ? 'Pause preview' : 'Play preview';
  };

  return (
    <>
      <audio
          ref={audioRef}
          onEnded={handleEnded}
          onError={handleError}
          onLoadStart={() => console.log('Audio load started')}
        onCanPlay={() => {
        console.log('Audio can play');
        handleAutoPlay();
        }}
          onLoadedData={() => console.log('Audio loaded data')}
          preload="metadata"
        />
      <Button
        variant="ghost"
        size="sm"
        onClick={handleTogglePlay}
        disabled={isLoading}
        className={cn(
          sizeClasses[size],
          'rounded-full p-0 hover:bg-primary/10 hover:text-primary transition-colors',
          className
        )}
        title={getTitle()}
      >
        {getIcon()}
      </Button>
    </>
  );
}
