
'use client';

import React, { useState, useEffect } from 'react';
import { convertWavToPlayableUrl, needsAudioConversion } from '@/utils/audioConverter';

interface ConvertibleAudioPlayerProps {
  src: string;
  className?: string;
  style?: React.CSSProperties;
  onError?: (error: string) => void;
  onCanPlay?: () => void;
  chunkId?: string;
}

export function ConvertibleAudioPlayer({ 
  src, 
  className, 
  style, 
  onError, 
  onCanPlay,
  chunkId 
}: ConvertibleAudioPlayerProps) {
  const [audioSrc, setAudioSrc] = useState<string>(src);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionError, setConversionError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    const handleAudioConversion = async () => {
      if (needsAudioConversion(src)) {
        setIsConverting(true);
        setConversionError(null);
        
        try {
          const convertedUrl = await convertWavToPlayableUrl(src);
          if (isMounted) {
            if (convertedUrl) {
              setAudioSrc(convertedUrl);
              console.log(`Audio converted successfully for chunk: ${chunkId}`);
            } else {
              setConversionError('Failed to convert audio file');
              onError?.('Audio conversion failed');
            }
            setIsConverting(false);
          }
        } catch (error) {
          if (isMounted) {
            setConversionError(`Conversion error: ${error}`);
            onError?.(`Audio conversion error: ${error}`);
            setIsConverting(false);
          }
        }
      } else {
        // If no conversion needed, use src directly
        if (isMounted) {
          setAudioSrc(src);
        }
      }
    };

    handleAudioConversion();

    return () => {
      isMounted = false;
      // Cleanup logic is handled by the second useEffect
    };
  }, [src, chunkId, onError]); // Removed audioSrc from this dependency array

  // Cleanup blob URL when audioSrc changes or component unmounts
  useEffect(() => {
    const currentAudioSrcForCleanup = audioSrc; // Capture current value for cleanup
    return () => {
      // Only revoke if it's a blob URL and not the original src prop
      if (currentAudioSrcForCleanup && currentAudioSrcForCleanup !== src && currentAudioSrcForCleanup.startsWith('blob:')) {
        console.log(`Revoking blob URL: ${currentAudioSrcForCleanup} for chunk ${chunkId}`);
        URL.revokeObjectURL(currentAudioSrcForCleanup);
      }
    };
  }, [audioSrc, src, chunkId]); // This effect correctly depends on audioSrc and src for cleanup

  if (isConverting) {
    return (
      <div className={className} style={style}>
        <div className="flex items-center justify-center h-8 bg-gray-100 rounded">
          <span className="text-xs text-gray-600">Converting audio...</span>
        </div>
      </div>
    );
  }

  if (conversionError) {
    return (
      <div className={className} style={style}>
        <div className="flex flex-col p-3 bg-red-100 rounded">
          <span className="text-sm font-medium text-red-600">Audio Error:</span>
          <span className="text-xs text-red-600 mt-1">{conversionError}</span>
          <div className="mt-2 text-xs text-gray-600">
            <p>Possible solutions:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Try saving your story before generating audio</li>
              <li>If using an ad blocker or privacy extension, try disabling it temporarily</li>
              <li>Reload the page and try again</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <audio
        controls
        src={audioSrc}
        className={className}
        style={style}
        preload="metadata"
        onError={(e) => {
          const target = e.target as HTMLAudioElement;
          const errorCode = target.error?.code || 'unknown';
          const errorMessage = target.error?.message || 'Unknown audio error';
          const errorMsg = `Audio error ${errorCode}: ${errorMessage}`;
          console.error(`Audio loading error for chunk: ${chunkId}`, errorMsg, 'URL:', audioSrc);
          
          if (errorMsg.includes("DEMUXER_ERROR_COULD_NOT_OPEN")) {
            console.warn(`Possible reasons for audio error:
              1. Story may not have been saved before generating audio (should be fixed now)
              2. Ad blocker or privacy extension might be blocking Firebase Storage
              3. The audio file might be corrupted or in an unsupported format`);
            
            if (audioSrc.includes('storage.googleapis.com')) {
              console.warn('Firebase Storage URL detected. This might be blocked by ad blockers or privacy extensions.');
              
              setConversionError(
                `Audio failed to load. This may be caused by an ad blocker or privacy extension
                blocking Firebase Storage connections. Try disabling them temporarily for this site.`
              );
              return;
            }
          }
          
          setConversionError(`Failed to load audio: ${errorMessage}`);
          onError?.(errorMsg);
        }}
        onCanPlay={() => {
          console.log(`Audio can play for chunk: ${chunkId}`);
          onCanPlay?.();
        }}
        onLoadStart={() => {
          console.log(`Audio load started for chunk: ${chunkId}`);
        }}
        onLoadedMetadata={() => {
          console.log(`Audio metadata loaded for chunk: ${chunkId}`);
        }}
      >
        <source src={audioSrc} type="audio/wav" />
        Your browser does not support the audio element.
      </audio>

    </div>
  );
}
