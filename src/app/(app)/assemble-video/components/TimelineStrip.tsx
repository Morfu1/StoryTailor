"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { Story, GeneratedImage } from "@/types/story";
import { Check, ImageIcon, Loader2, Film, MessageSquareText, Play, Pause, Scissors, Trash2, MousePointer2, Undo2, Redo2, ZoomIn, ZoomOut, Maximize2, Music2, Video } from "lucide-react"; // Added Play, Pause & new icons
import { useDroppable } from "@dnd-kit/core";

// Define types for tracks and media items that this component will receive
// These should match or be compatible with PageTimelineTrack and PageTimelineMediaItem from page.tsx
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
  storyData: Story | null; // Still needed for narration audio URL, overall script, etc.
  timelineTracks: TimelineStripTrack[]; // This will now be passed as a prop
  selectedTimelineImage: number | null; // originalIndex of the image
  setSelectedTimelineImage: (index: number | null) => void;
  setSelectedPanel: (panel: string) => void;
  isGeneratingImages: boolean; // For the "Generate Images" button on empty video track
  handleGenerateChapterImages: () => Promise<void>; // For the button
  currentChapter: number; // For the button text
  // chaptersGenerated, currentImageProgress, totalImagesToGenerate, generationProgress might be removed if not directly used by UI elements within TimelineStrip itself
  className?: string;
}

export default function TimelineStrip({
  storyData,
  timelineTracks, // Use the prop
  selectedTimelineImage,
  setSelectedTimelineImage,
  setSelectedPanel,
  isGeneratingImages,
  handleGenerateChapterImages,
  currentChapter,
  // chaptersGenerated, // Likely no longer needed here
  // currentImageProgress, // Likely no longer needed here
  // totalImagesToGenerate, // Likely no longer needed here
  // generationProgress, // Likely no longer needed here
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
            // We select based on originalIndex if available, assuming it maps to storyData.generatedImages
            if (timelineItemToSelect.originalIndex !== undefined && selectedTimelineImage !== timelineItemToSelect.originalIndex) {
              setSelectedTimelineImage(timelineItemToSelect.originalIndex);
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
          } else if (imagesToShow.length > 0) { // Fallback to old logic if no video items yet
             const firstImageOriginalIndex = storyData?.generatedImages?.findIndex(
              (originalImg) => originalImg.imageUrl === imagesToShow[0].imageUrl && originalImg.originalPrompt === imagesToShow[0].originalPrompt
            );
             if(firstImageOriginalIndex !== undefined && firstImageOriginalIndex !== -1) {
               setSelectedTimelineImage(firstImageOriginalIndex);
             } else {
               setSelectedTimelineImage(0);
             }
          } else {
            setSelectedTimelineImage(null);
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
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Delete Clip (Placeholder)"> <Trash2 className="h-4 w-4" /> </Button>
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
            {timelineTracks.map((track) => {
              const { setNodeRef, isOver } = useDroppable({
                id: track.id, // Unique ID for the droppable track
                data: {
                  accepts: track.type === 'video' ? ['image'] : track.type === 'narration' || track.type === 'audio' ? ['audio'] : ['text'], // Define what this track accepts
                }
              });

              return (
              <div
                ref={setNodeRef}
                key={track.id}
                className={`flex items-stretch border-t border-border/50 first:border-t-0 pt-1 first:pt-0 transition-colors duration-150 ease-in-out ${isOver ? 'bg-primary/10' : ''}`}
                style={{ minHeight: track.height }} // Ensure track has min height even when empty for dropping
              >
                {/* Track Header (Icon + Name) - Optional, can be added later for better UX */}
                {/* <div className="w-24 flex-shrink-0 flex items-center p-1 border-r border-border/50">
                  <track.icon className="w-4 h-4 mr-2 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground truncate">{track.name}</span>
                </div> */}

                {/* Track Content Area */}
                <div className={`flex-grow flex space-x-1 ${track.height} items-center overflow-hidden p-1`}> {/* Added p-1 for slight padding */}
                  {track.items && track.items.length > 0 ? (
                    track.items.map((item, itemIndex) => {
                      // For Video Track (Images)
                      if (track.type === 'video' && item.type === 'image' && item.imageUrl && item.originalIndex !== undefined) {
                        const isSelected = selectedTimelineImage === item.originalIndex;
                        const imageWidth = isSelected ? "w-[240px]" : "w-[120px]"; // Keep dynamic width for selected
                        return (
                          <div
                            key={item.id}
                            className={`flex-shrink-0 ${imageWidth} ${track.height} rounded-md overflow-hidden border-2 ${isSelected ? "border-primary shadow-lg" : "border-transparent hover:border-primary/50"} cursor-pointer relative transition-all duration-200 ease-in-out group`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (item.originalIndex !== undefined && audioRef.current) {
                                setSelectedTimelineImage(item.originalIndex);
                                setSelectedPanel("Edit Image");
                                // Clicking an image item should also seek the audio
                                // This logic assumes items in the video track correspond to `imagesToShow` for timing.
                                const videoTrackItems = timelineTracks.find(t => t.type === 'video')?.items || [];
                                const itemIndexInVideoTrack = videoTrackItems.findIndex(vidItem => vidItem.id === item.id);

                                if (duration > 0 && imagesToShow.length > 0 && itemIndexInVideoTrack !== -1) {
                                  // Assuming imagesToShow provides the basis for scene duration calculation
                                  const sceneDuration = duration / imagesToShow.length;
                                  const newTime = itemIndexInVideoTrack * sceneDuration;
                                  audioRef.current.currentTime = newTime;
                                  setCurrentTime(newTime);
                                }
                              }
                            }}
                          >
                            <div className="flex w-full h-full">
                              <Image
                                src={item.imageUrl} // item.imageUrl should be guaranteed by the if condition
                                alt={item.title || `Image ${item.originalIndex !== undefined ? item.originalIndex + 1 : ''}`}
                                width={120} height={90} // Base dimensions
                                className="object-cover h-full w-full"
                              />
                              {isSelected && item.imageUrl && ( // Ensure imageUrl exists for the second image too
                                <Image
                                  src={item.imageUrl}
                                  alt={`${item.title || `Image ${item.originalIndex !== undefined ? item.originalIndex + 1 : ''}`} extended`}
                                  width={120} height={90}
                                  className="object-cover h-full w-full"
                                />
                              )}
                            </div>
                            {isSelected && (
                              <div className="absolute top-1 right-1 bg-primary rounded-full w-4 h-4 flex items-center justify-center z-10">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                            {/* Placeholder for resize handles - to be added later */}
                            {/* <div className="absolute top-0 right-0 bottom-0 w-2 cursor-ew-resize bg-blue-500/50 opacity-0 group-hover:opacity-100 z-20"/> */}
                          </div>
                        );
                      }
                      // For Text Track
                      else if (track.type === 'text' && item.type === 'text' && item.scriptSegment && item.originalIndex !== undefined) {
                        const isSelected = selectedTimelineImage === item.originalIndex; // Text selection follows image selection
                        const textSegmentWidth = isSelected ? "w-[240px]" : "w-[120px]";
                        return (
                          <div
                            key={item.id}
                            className={`flex-shrink-0 ${textSegmentWidth} ${track.height} rounded-md p-1.5 border ${isSelected ? "border-primary/30 bg-primary/10" : "border-border bg-muted/30"} overflow-hidden transition-all duration-200 ease-in-out`}
                          >
                            <p className="text-xs text-foreground/80 leading-tight line-clamp-3">
                              {item.scriptSegment || "Loading script..."}
                            </p>
                          </div>
                        );
                      }
                      // For Narration Track (simple bar for now)
                      else if (track.type === 'narration' && item.type === 'audio') {
                        return (
                          <div key={item.id} className={`flex-grow ${track.height} bg-blue-200/30 rounded-md flex items-center justify-center`}>
                            {/* Later: waveform display */}
                            <span className="text-xs text-blue-700/70">Narration Audio</span>
                          </div>
                        );
                      }
                      return null; // Fallback for unhandled item types
                    })
                  ) : (
                    // Empty state for the track
                    <div className={`flex flex-col items-center justify-center w-full ${track.height} text-center`}>
                       <track.icon className="w-5 h-5 text-muted-foreground mb-1" />
                      <p className="text-xs text-muted-foreground">{track.emptyStateMessage}</p>
                      {track.showGenerateButton && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 border-dashed border-2 hover:border-primary text-xs px-2 py-1 h-auto"
                          disabled={isGeneratingImages}
                          onClick={(e) => { e.stopPropagation(); handleGenerateChapterImages();}}
                        >
                          {isGeneratingImages ? (
                            <> <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Generating... </>
                          ) : ( <> <ImageIcon className="w-3 h-3 mr-1" /> Generate Ch. {currentChapter} </>)}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ); // Closing the return statement for each track
          })} {/* Closing the timelineTracks.map callback body and the map call itself */}

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