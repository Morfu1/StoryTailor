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
      // Clean up blob URL if we created one
      if (audioSrc !== src && audioSrc.startsWith('blob:')) {
        URL.revokeObjectURL(audioSrc);
      }
    };
  }, [src, chunkId, onError]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (audioSrc !== src && audioSrc.startsWith('blob:')) {
        URL.revokeObjectURL(audioSrc);
      }
    };
  }, [audioSrc, src]);

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
        <div className="flex items-center justify-center h-8 bg-red-100 rounded">
          <span className="text-xs text-red-600">Audio error: {conversionError}</span>
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
          const errorMsg = `Audio error ${target.error?.code}: ${target.error?.message}`;
          console.error(`Audio loading error for chunk: ${chunkId}`, errorMsg);
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