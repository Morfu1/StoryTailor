"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { Story, GeneratedImage } from "@/types/story";
import { Check, ImageIcon, Loader2, Film, MessageSquareText, Play, Pause } from "lucide-react"; // Added Play, Pause

interface TimelineStripProps {
  storyData: Story | null;
  selectedTimelineImage: number | null;
  setSelectedTimelineImage: (index: number | null) => void;
  setSelectedPanel: (panel: string) => void;
  isGeneratingImages: boolean;
  handleGenerateChapterImages: () => Promise<void>;
  currentChapter: number;
  chaptersGenerated: number[];
  currentImageProgress: number;
  totalImagesToGenerate: number;
  generationProgress: number;
}

export default function TimelineStrip({
  storyData,
  selectedTimelineImage,
  setSelectedTimelineImage,
  setSelectedPanel,
  isGeneratingImages,
  handleGenerateChapterImages,
  currentChapter,
  chaptersGenerated,
  currentImageProgress,
  totalImagesToGenerate,
  generationProgress,
}: TimelineStripProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const imageTrackHeight = "h-[90px]";
  const textTrackHeight = "h-[60px]";
  const controlsHeight = "h-[40px]"; // Height for the new controls bar
  // Adjusted total height: image + text + controls + spacing + padding
  const totalTimelineHeight = "h-[238px]";

  const imagesToShow = storyData?.generatedImages?.filter(
    (img): img is GeneratedImage => !!img && img.isChapterGenerated === true
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (audio && imagesToShow) {
      const setAudioData = () => {
        if (isFinite(audio.duration)) {
          setDuration(audio.duration);
        }
        setCurrentTime(audio.currentTime);
      };

      const handleTimeUpdate = () => {
        setCurrentTime(audio.currentTime);
        // Synchronize selected image with audio playback
        if (imagesToShow.length > 0 && duration > 0) {
          const sceneDuration = duration / imagesToShow.length;
          const currentSceneIndex = Math.min(
            Math.floor(audio.currentTime / sceneDuration),
            imagesToShow.length - 1
          );
          // Only update if it's different to avoid unnecessary re-renders
          // and to allow user to manually select an image while paused.
          if (isPlaying) {
            // Find the original index of the current scene image
            const currentImageObject = imagesToShow[currentSceneIndex];
            const originalIndex = storyData?.generatedImages?.findIndex(
              (originalImg) => originalImg.imageUrl === currentImageObject.imageUrl && originalImg.originalPrompt === currentImageObject.originalPrompt
            );

            if (originalIndex !== undefined && originalIndex !== -1 && selectedTimelineImage !== originalIndex) {
              setSelectedTimelineImage(originalIndex);
            }
          }
        }
      };
      
      audio.addEventListener("loadeddata", setAudioData);
      audio.addEventListener("timeupdate", handleTimeUpdate);
      audio.addEventListener("ended", () => {
        setIsPlaying(false);
        // Optionally, reset to first image or keep last:
        // setSelectedTimelineImage(0);
      });

      if (storyData?.narrationAudioUrl) {
        if (audio.src !== storyData.narrationAudioUrl) { // Check if src actually changed
          audio.src = storyData.narrationAudioUrl;
          audio.load();
          setIsPlaying(false);
          setCurrentTime(0); // Reset time
          if (imagesToShow.length > 0) {
             const firstImageOriginalIndex = storyData?.generatedImages?.findIndex(
              (originalImg) => originalImg.imageUrl === imagesToShow[0].imageUrl && originalImg.originalPrompt === imagesToShow[0].originalPrompt
            );
            if(firstImageOriginalIndex !== undefined && firstImageOriginalIndex !== -1) {
              setSelectedTimelineImage(firstImageOriginalIndex);
            } else {
              setSelectedTimelineImage(0); // Fallback
            }
          }
        }
      } else { // No audio URL, reset state
        setDuration(0);
        setCurrentTime(0);
        setIsPlaying(false);
      }

      return () => {
        audio.removeEventListener("loadeddata", setAudioData);
        audio.removeEventListener("timeupdate", handleTimeUpdate);
        audio.removeEventListener("ended", () => setIsPlaying(false));
      };
    }
  }, [storyData?.narrationAudioUrl, imagesToShow, duration, isPlaying, setSelectedTimelineImage, selectedTimelineImage]);

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(error => console.error("Error playing audio:", error));
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const getScriptSegment = (
    index: number,
    totalImages: number,
    script?: string
  ): string => {
    if (!script || totalImages === 0) {
      return "Script not available.";
    }
    const scriptLength = script.length;
    const segmentLength = Math.floor(scriptLength / totalImages);
    const start = index * segmentLength;
    const end = (index + 1) * segmentLength;

    if (index === totalImages - 1) {
      // For the last segment, take all remaining text
      return script.substring(start);
    }
    return script.substring(start, end) + (end < scriptLength ? "..." : "");
  };


  return (
    <div className="flex flex-col">
      {storyData?.narrationAudioUrl && (
        <audio ref={audioRef} src={storyData.narrationAudioUrl} preload="metadata" />
      )}
      <div className="flex justify-between items-center mb-1">
        <h3 className="text-sm font-medium text-primary flex items-center">
          <Film className="w-4 h-4 mr-2" /> Timeline
        </h3>
      </div>
      <ScrollArea
        className={`bg-background p-2 rounded-md shadow-sm border border-border ${totalTimelineHeight} w-full`}
      >
        <div className="flex flex-col space-y-1 pb-1 h-full">
          {/* Playback Controls */}
          {storyData?.narrationAudioUrl && (
            <div className={`flex items-center space-x-3 p-1 border-b border-border mb-1 ${controlsHeight}`}>
              <Button variant="ghost" size="icon" onClick={handlePlayPause} className="h-7 w-7">
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <div className="text-xs text-muted-foreground">
                <span>{formatTime(currentTime)}</span> / <span>{formatTime(duration)}</span>
              </div>
              {/* Optional: Add a simple progress bar later if needed */}
            </div>
          )}

          {/* Image Track */}
          <div className={`flex space-x-1 ${imageTrackHeight} items-center`}>
            {imagesToShow && imagesToShow.length > 0 ? (
              imagesToShow.map((img, filteredIndex) => {
                // Find the original index of this image in storyData.generatedImages
                const originalImageIndex = storyData?.generatedImages?.findIndex(
                  (originalImg) => originalImg.imageUrl === img.imageUrl && originalImg.originalPrompt === img.originalPrompt
                );

                // If originalImageIndex is undefined or -1, something is wrong, skip rendering or handle error
                if (originalImageIndex === undefined || originalImageIndex === -1) {
                  console.warn("Could not find original index for timeline image:", img);
                  return null;
                }

                const isSelected = selectedTimelineImage === originalImageIndex;
                const imageWidth = isSelected ? "w-[240px]" : "w-[120px]";

                return (
                  <div
                    key={originalImageIndex} // Use original index for key if possible, or a unique ID from img
                    className={`flex-shrink-0 ${imageWidth} ${imageTrackHeight} rounded-md overflow-hidden border-2 ${isSelected ? "border-primary shadow-lg" : "border-transparent hover:border-primary/50"} cursor-pointer relative transition-all duration-200 ease-in-out`}
                    onClick={() => {
                      if (originalImageIndex !== undefined && originalImageIndex !== -1) {
                        setSelectedTimelineImage(originalImageIndex);
                        setSelectedPanel("Edit Image");
                        // Pause audio on manual selection to prevent immediate override by playback sync
                        if (audioRef.current && isPlaying) {
                          audioRef.current.pause();
                          setIsPlaying(false);
                        }
                      }
                    }}
                  >
                    <div className="flex w-full h-full">
                      <Image
                        src={img.imageUrl}
                        alt={`Scene ${originalImageIndex + 1}`}
                        width={120} // Base width
                        height={90}  // Base height
                        className="object-cover h-full w-full" // First image
                      />
                      {isSelected && ( // Render second image only if selected to create "extension"
                        <Image
                          src={img.imageUrl}
                          alt={`Scene ${originalImageIndex + 1} extended`}
                          width={120}
                          height={90}
                          className="object-cover h-full w-full" // Second image, effectively doubling the view
                        />
                      )}
                    </div>
                    {isSelected && (
                      <div className="absolute top-1 right-1 bg-primary rounded-full w-4 h-4 flex items-center justify-center z-10">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              // Empty state for Image Track (centered within the image track area)
              <div className={`flex flex-col items-center justify-center w-full ${imageTrackHeight} text-center`}>
                <div className="text-muted-foreground mb-2">
                  <p className="text-xs">
                    Image track empty. Generate images for Chapter {currentChapter}.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-dashed border-2 hover:border-primary text-xs px-2 py-1 h-auto"
                  disabled={isGeneratingImages}
                  onClick={handleGenerateChapterImages}
                >
                  {isGeneratingImages ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      {currentImageProgress > 0 && totalImagesToGenerate > 0
                        ? `Gen: ${currentImageProgress}/${totalImagesToGenerate} (${generationProgress}%)`
                        : `Preparing...`}
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-3 h-3 mr-1" />
                      Generate Ch. {currentChapter}
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Text Track (Script Snippets) */}
          <div className={`flex space-x-1 ${textTrackHeight} items-stretch overflow-hidden`}>
            {imagesToShow && imagesToShow.length > 0 ? (
              imagesToShow.map((img, filteredIndex) => { // Renamed index to filteredIndex for clarity
                const originalImageIndex = storyData?.generatedImages?.findIndex(
                  (originalImg) => originalImg.imageUrl === img.imageUrl && originalImg.originalPrompt === img.originalPrompt
                );
                if (originalImageIndex === undefined || originalImageIndex === -1) return null;

                const isSelected = selectedTimelineImage === originalImageIndex;
                const textSegmentWidth = isSelected ? "w-[240px]" : "w-[120px]";
                return (
                  <div
                    key={`text-${originalImageIndex}`}
                    className={`flex-shrink-0 ${textSegmentWidth} ${textTrackHeight} rounded-md p-1.5 border ${isSelected ? "border-primary/30 bg-primary/10" : "border-border bg-muted/30"} overflow-hidden transition-all duration-200 ease-in-out`}
                  >
                    <p className="text-xs text-foreground/80 leading-tight line-clamp-3">
                      {getScriptSegment(filteredIndex, imagesToShow.length, storyData?.generatedScript) || "Loading script..."}
                    </p>
                  </div>
                );
              })
            ) : (
              // Empty state for Text Track
              <div className={`flex items-center justify-center w-full ${textTrackHeight} text-center text-muted-foreground`}>
                <MessageSquareText className="w-4 h-4 mr-2" />
                <p className="text-xs">Script snippets will appear here once images are generated.</p>
              </div>
            )}
          </div>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}