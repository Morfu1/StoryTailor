"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { Story, GeneratedImage } from "@/types/story";
import { Check, ImageIcon, Loader2, Film, MessageSquareText, Play, Pause, Scissors, Trash2, MousePointer2, Undo2, Redo2, ZoomIn, ZoomOut, Maximize2 } from "lucide-react"; // Removed Music2, Video as they are track-specific icons, useDroppable removed
import TrackLane from "./TrackLane"; // Import the new TrackLane component

// Define types for tracks and media items that this component will receive
// These should match or be compatible with PageTimelineTrack and PageTimelineMediaItem from page.tsx
// Ensure these types are exported if TrackLane needs them directly from here, or define them in a shared types file.
export interface TimelineStripMediaItem {
  id: string;
  type: 'image' | 'audio' | 'text';
  originalIndex?: number;
  imageUrl?: string;
  scriptSegment?: string;
  title?: string; // Added title
  // Potentially more UI-specific or timeline-specific properties if needed by TimelineStrip
}

export interface TimelineStripTrack {
  id: string;
  type: 'video' | 'narration' | 'audio' | 'text';
  name: string;
  icon: React.ElementType;
  items: TimelineStripMediaItem[];
  height: string;
  accepts: Array<'image' | 'audio' | 'text'>;
  emptyStateMessage: string;
  showGenerateButton?: boolean;
}

interface TimelineStripProps {
  storyData: Story | null;
  timelineTracks: TimelineStripTrack[];
  selectedTimelineImage: number | null;
  setSelectedTimelineImage: (index: number | null) => void;
  selectedTimelineItemKey: string | null; // Unique key of the selected item
  setSelectedTimelineItemKey: (key: string | null) => void; // Setter for unique key
  handleDeleteItemFromTimeline: (itemId?: string) => void; // Delete handler
  setSelectedPanel: (panel: string) => void;
  isGeneratingImages: boolean;
  handleGenerateChapterImages: () => Promise<void>;
  currentChapter: number;
  className?: string;
}

export default function TimelineStrip({
  storyData,
  timelineTracks,
  selectedTimelineImage,
  setSelectedTimelineImage,
  selectedTimelineItemKey,
  setSelectedTimelineItemKey,
  handleDeleteItemFromTimeline,
  setSelectedPanel,
  isGeneratingImages,
  handleGenerateChapterImages,
  currentChapter,
  className,
}: TimelineStripProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const tracksContainerRef = useRef<HTMLDivElement>(null);

  const controlsHeight = "h-[40px]"; // Height for the new controls bar

  const imagesToShow = storyData?.generatedImages?.filter( // This is used for audio sync logic.
    (img): img is GeneratedImage => !!img && img.isChapterGenerated === true
  ) || []; // Ensure it's an array even if storyData or generatedImages is null/undefined

  // Removed internal timelineTracks derivation (trackConfigs, getScriptSegmentForImage, React.useMemo for timelineTracks)
  // The `timelineTracks` prop is now the source of truth for rendering.

  useEffect(() => {
    const audio = audioRef.current;
    // The `imagesToShow` derived from `storyData.generatedImages` is still used for calculating scene durations
    // for the main narration playback. This assumes the main narration syncs with these original images.
    // If timeline items can be arbitrarily placed/timed, this audio sync logic will need significant rework.
    if (audio && imagesToShow.length > 0) {
      const setAudioData = () => {
        if (isFinite(audio.duration)) {
          setDuration(audio.duration);
        }
        setCurrentTime(audio.currentTime);
      };

      const handleTimeUpdate = () => {
        setCurrentTime(audio.currentTime);
        if (isPlaying && duration > 0) { // Only sync if playing
          const sceneDuration = duration / imagesToShow.length;
          const currentSceneIndexInFiltered = Math.min(
            Math.floor(audio.currentTime / sceneDuration),
            imagesToShow.length - 1
          );
          
          // Find the corresponding item in the *passed* timelineTracks prop
          // This assumes the video track items correspond to imagesToShow for selection sync
          const videoTrack = timelineTracks.find(t => t.type === 'video');
          if (videoTrack && videoTrack.items[currentSceneIndexInFiltered]) {
            const timelineItemToSelect = videoTrack.items[currentSceneIndexInFiltered];
            // We select based on originalIndex if available
            if (timelineItemToSelect.originalIndex !== undefined && selectedTimelineImage !== timelineItemToSelect.originalIndex) {
              setSelectedTimelineImage(timelineItemToSelect.originalIndex);
              // Also update the unique key selection if an originalIndex-based item is auto-selected by playback
              setSelectedTimelineItemKey(timelineItemToSelect.id);
            }
          }
        }
      };
      
      audio.addEventListener("loadeddata", setAudioData);
      audio.addEventListener("timeupdate", handleTimeUpdate);
      audio.addEventListener("ended", () => setIsPlaying(false));

      if (storyData?.narrationAudioUrl) {
        if (audio.src !== storyData.narrationAudioUrl) {
          audio.src = storyData.narrationAudioUrl;
          audio.load();
          setIsPlaying(false);
          setCurrentTime(0);
          // Select the first image from the timelineTracks prop if available
          const firstVideoItem = timelineTracks.find(t => t.type === 'video')?.items[0];
          if (firstVideoItem?.originalIndex !== undefined) {
            setSelectedTimelineImage(firstVideoItem.originalIndex);
            setSelectedTimelineItemKey(firstVideoItem.id); // Also set the key
          } else if (imagesToShow.length > 0) {
             const firstImageOriginalIndex = storyData?.generatedImages?.findIndex(
              (originalImg) => originalImg.imageUrl === imagesToShow[0].imageUrl && originalImg.originalPrompt === imagesToShow[0].originalPrompt
            );
             if(firstImageOriginalIndex !== undefined && firstImageOriginalIndex !== -1) {
               setSelectedTimelineImage(firstImageOriginalIndex);
               // Try to find corresponding key for this fallback
                const videoTrack = timelineTracks.find(t => t.type === 'video');
                const itemWithOriginalIndex = videoTrack?.items.find(i => i.originalIndex === firstImageOriginalIndex);
                if (itemWithOriginalIndex) setSelectedTimelineItemKey(itemWithOriginalIndex.id); else setSelectedTimelineItemKey(null);
             } else {
               setSelectedTimelineImage(0); // Fallback, less ideal
               setSelectedTimelineItemKey(null);
             }
          } else {
            setSelectedTimelineImage(null);
            setSelectedTimelineItemKey(null);
          }
        }
      } else {
        setDuration(0);
        setCurrentTime(0);
        setIsPlaying(false);
      }

      return () => {
        audio.removeEventListener("loadeddata", setAudioData);
        audio.removeEventListener("timeupdate", handleTimeUpdate);
        audio.removeEventListener("ended", () => setIsPlaying(false));
      };
    } else if (audio) { // Handle case where there are no imagesToShow (e.g. new story)
        setDuration(0);
        setCurrentTime(0);
        setIsPlaying(false);
        if (storyData?.narrationAudioUrl && audio.src !== storyData.narrationAudioUrl) {
            audio.src = storyData.narrationAudioUrl;
            audio.load();
        } else if (!storyData?.narrationAudioUrl && audio.src) {
            audio.src = ""; // Clear src if no narration
        }
    }
  }, [storyData?.narrationAudioUrl, imagesToShow, duration, isPlaying, setSelectedTimelineImage, selectedTimelineImage, timelineTracks]);

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

  const handleTimelineClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!tracksContainerRef.current || !audioRef.current || duration <= 0) {
      return;
    }

    const rect = tracksContainerRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    let clickPercentage = clickX / rect.width;

    // Clamp percentage between 0 and 1
    clickPercentage = Math.max(0, Math.min(1, clickPercentage));

    const newTime = clickPercentage * duration;

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);

    // If it was playing, we want it to continue playing from the new position.
    // If it was paused, it should remain paused at the new position.
    // The `play()` or `pause()` state is managed by the `handlePlayPause` button.
  };

  return (
    <div className={`flex flex-col ${className || ''}`}>
      {storyData?.narrationAudioUrl && (
        <audio ref={audioRef} src={storyData.narrationAudioUrl} preload="metadata" />
      )}
      <div className="flex justify-between items-center mb-1">
        <h3 className="text-sm font-medium text-primary flex items-center">
          <Film className="w-4 h-4 mr-2" /> Timeline
        </h3>
        {/* TODO: Add button for "Add Track" here later */}
      </div>
      <ScrollArea
        className="bg-background p-2 rounded-md shadow-sm border border-border w-full" // Removed fixed totalTimelineHeight
      >
        <div className="flex flex-col space-y-1 pb-1"> {/* Main flex container for controls + tracks area */}
          {/* Playback Controls */}
          {storyData?.narrationAudioUrl && ( // Keep controls if narration exists
            <div className={`flex items-center space-x-3 p-1 border-b border-border mb-2 ${controlsHeight}`}>
              <Button variant="ghost" size="icon" onClick={handlePlayPause} className="h-7 w-7">
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <div className="text-xs text-muted-foreground">
                <span>{formatTime(currentTime)}</span> / <span>{formatTime(duration)}</span>
              </div>
              <div className="flex-grow" />
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Select Tool (Placeholder)"> <MousePointer2 className="h-4 w-4" /> </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Split Clip (Placeholder)"> <Scissors className="h-4 w-4" /> </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Delete Selected Clip"
                onClick={() => handleDeleteItemFromTimeline()}
                disabled={!selectedTimelineItemKey}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <div className="h-5 w-px bg-border mx-1" />
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Undo (Placeholder)"> <Undo2 className="h-4 w-4" /> </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Redo (Placeholder)"> <Redo2 className="h-4 w-4" /> </Button>
              <div className="h-5 w-px bg-border mx-1" />
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Zoom Out (Placeholder)"> <ZoomOut className="h-4 w-4" /> </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Zoom In (Placeholder)"> <ZoomIn className="h-4 w-4" /> </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Fit to Screen (Placeholder)"> <Maximize2 className="h-4 w-4" /> </Button>
              <div className="h-5 w-px bg-border mx-1" />
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" title="Playback Speed (Placeholder)"> 1x </Button>
            </div>
          )}

          {/* Wrapper for Tracks and Playhead */}
          <div
            ref={tracksContainerRef}
            className="relative flex flex-col space-y-2 cursor-pointer" // Increased space-y for better track separation
            onClick={handleTimelineClick} // Click on empty area seeks playhead
          >
            {timelineTracks.map((track) => (
              <TrackLane
                key={track.id}
                track={track}
                selectedTimelineImage={selectedTimelineImage}
                selectedTimelineItemKey={selectedTimelineItemKey}
                setSelectedTimelineImage={setSelectedTimelineImage}
                setSelectedTimelineItemKey={setSelectedTimelineItemKey}
                setSelectedPanel={setSelectedPanel}
                handleGenerateChapterImages={handleGenerateChapterImages}
                isGeneratingImages={isGeneratingImages}
                currentChapter={currentChapter}
                audioRef={audioRef}
                duration={duration}
                setCurrentTime={setCurrentTime}
                imagesToShowForAudioSync={imagesToShow} // Pass the filtered images for audio sync
              />
            ))}

            {/* Playhead: Spans across all tracks */}
            {/* Ensure playhead renders if there's duration and *any* items on a video track that audio syncs with, or just duration > 0 */}
            {duration > 0 && (timelineTracks.some(t => t.type === 'video' && t.items.length > 0) || imagesToShow.length > 0) && (
              <div
                className="absolute top-0 w-0.5 bg-purple-600 z-20 pointer-events-none"
                style={{
                  left: `${(currentTime / duration) * 100}%`,
                  height: '100%', // Spans the full height of the tracksContainerRef
                }}
              />
            )}
          </div> {/* End of Wrapper for Tracks and Playhead */}
        </div> {/* End of Main flex container */}
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}