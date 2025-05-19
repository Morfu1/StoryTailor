"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useDroppable } from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Check, ImageIcon, Loader2 } from "lucide-react";
import type { TimelineStripTrack, TimelineStripMediaItem } from "./TimelineStrip"; // Assuming types are exported from TimelineStrip or a shared types file

interface TrackLaneProps {
  track: TimelineStripTrack;
  selectedTimelineImage: number | null;
  selectedTimelineItemKey: string | null;
  setSelectedTimelineImage: (index: number | null) => void;
  setSelectedTimelineItemKey: (key: string | null) => void;
  setSelectedPanel: (panel: string) => void;
  handleGenerateChapterImages: () => Promise<void>; // For the button on empty video track
  isGeneratingImages: boolean; // For the button
  currentChapter: number; // For the button
  // Props needed for audio synchronization if item click seeks audio
  audioRef: React.RefObject<HTMLAudioElement>;
  duration: number;
  setCurrentTime: (time: number) => void;
  imagesToShowForAudioSync: any[]; // This is the 'imagesToShow' from TimelineStrip, used for audio sync calculations
  handleUpdateItemWidth?: (itemId: string, width: number) => void;
}

export default function TrackLane({
  track,
  selectedTimelineImage,
  selectedTimelineItemKey,
  setSelectedTimelineImage,
  setSelectedTimelineItemKey,
  setSelectedPanel,
  handleGenerateChapterImages,
  isGeneratingImages,
  currentChapter,
  audioRef,
  duration,
  setCurrentTime,
  imagesToShowForAudioSync,
  handleUpdateItemWidth,
}: TrackLaneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: track.id,
    data: {
      accepts: track.accepts,
    },
  });

  // Simplified click handler for an item, to be adapted from TimelineStrip's logic
  const handleItemClick = (item: TimelineStripMediaItem) => {
    setSelectedTimelineItemKey(item.id);
    if (item.originalIndex !== undefined) {
      setSelectedTimelineImage(item.originalIndex);
    } else {
      setSelectedTimelineImage(null);
    }
    // Potentially switch panel, e.g., to "Edit Image" or "Edit Audio"
    if (item.type === 'image') setSelectedPanel("Edit Image");
    // Add more panel switches for other types if needed

    // Audio seeking logic (if applicable for this item type and track)
    if (audioRef.current && item.originalIndex !== undefined && track.type === 'video') {
        const videoTrackItems = track.items || []; // Assuming track.items are the relevant items for this track
        const itemIndexInVideoTrack = videoTrackItems.findIndex(vidItem => vidItem.id === item.id);

        if (duration > 0 && imagesToShowForAudioSync.length > 0 && itemIndexInVideoTrack !== -1) {
            const sceneDuration = duration / imagesToShowForAudioSync.length;
            const newTime = itemIndexInVideoTrack * sceneDuration;
            audioRef.current.currentTime = newTime;
            setCurrentTime(newTime);
        }
    }
  };

  return (
    <div
      ref={setNodeRef}
      key={track.id} // Key is on the iterated element in the parent
      className={`flex items-stretch border-t border-border/50 first:border-t-0 pt-1 first:pt-0 transition-colors duration-150 ease-in-out ${isOver ? 'bg-primary/10' : ''}`}
      style={{ minHeight: track.height }}
    >
      {/* Optional: Track Header (Icon + Name) can be added here if desired */}
      {/* <div className="w-20 flex-shrink-0 p-1 border-r border-border/50 flex flex-col items-center justify-center text-center">
        <track.icon className="w-5 h-5 text-muted-foreground mb-1" />
        <span className="text-xs text-muted-foreground truncate leading-tight">{track.name}</span>
      </div> */}
      <div className={`flex-grow flex space-x-1 ${track.height} items-center p-1`}>
        {track.items && track.items.length > 0 ? (
          track.items.map((item) => {
            const isSelectedByKey = selectedTimelineItemKey === item.id;
            const isSelectedByOriginalIndex = !selectedTimelineItemKey && item.originalIndex !== undefined && selectedTimelineImage === item.originalIndex;
            const isEffectivelySelected = isSelectedByKey || isSelectedByOriginalIndex;

            // Use custom width from ui property if available, otherwise use default widths
            const defaultWidth = isEffectivelySelected ? 240 : 120;
            const widthValue = item.ui?.width !== undefined ? item.ui.width : defaultWidth;
            const widthPx = typeof widthValue === 'string' ? widthValue : `${widthValue}px`;
            // Use inline style for width instead of Tailwind class

            if (track.type === 'video' && item.type === 'image' && item.imageUrl) {
              // Only duplicate images if width is explicitly set and larger than base
              const baseWidth = 120; // Base width of a single image
              const numWidth = typeof widthValue === 'string' ?
                parseInt(widthValue.replace('px', '')) : widthValue;

              // Only duplicate if width is significantly larger than base
              const shouldDuplicate = numWidth > baseWidth * 1.5;
              const duplicateCount = shouldDuplicate ? Math.max(1, Math.floor(numWidth / baseWidth)) : 1;

              // State for direct editing
              const [isResizing, setIsResizing] = useState(false);
              const [startX, setStartX] = useState(0);
              const [startWidth, setStartWidth] = useState(numWidth);

              // Handle resize start
              const handleResizeStart = (e: React.MouseEvent) => {
                e.stopPropagation();
                e.preventDefault();
                setIsResizing(true);
                setStartX(e.clientX);
                setStartWidth(numWidth);

                // Add document-level event listeners
                document.addEventListener('mousemove', handleResizeMove);
                document.addEventListener('mouseup', handleResizeEnd);
              };

              // Handle resize move
              const handleResizeMove = (e: MouseEvent) => {
                if (!isResizing) return;
                const diff = e.clientX - startX;
                const newWidth = Math.max(80, startWidth + diff);
                handleUpdateItemWidth && handleUpdateItemWidth(item.id, newWidth);
              };

              // Handle resize end
              const handleResizeEnd = () => {
                setIsResizing(false);
                document.removeEventListener('mousemove', handleResizeMove);
                document.removeEventListener('mouseup', handleResizeEnd);
              };

              return (
                <div
                  key={item.id}
                  className={`flex-shrink-0 ${track.height} rounded-md overflow-hidden cursor-pointer relative transition-all duration-200 ease-in-out group`}
                  style={{
                    width: widthPx,
                    border: isEffectivelySelected ? '2px solid #10b981' : '2px solid transparent',
                    boxShadow: isEffectivelySelected ? '0 0 0 2px rgba(16, 185, 129, 0.2)' : 'none',
                    marginLeft: item.ui?.marginLeft || '0px'
                  }}
                  onClick={(e) => { e.stopPropagation(); handleItemClick(item); }}
                >
                  {/* Edit button that appears on hover or when selected */}
                  {isEffectivelySelected && (
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-white shadow-md rounded-md px-2 py-1 z-10">
                      <button className="text-xs font-medium text-gray-700 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        Edit
                      </button>
                    </div>
                  )}

                  <div className="flex w-full h-full">
                    {/* Render multiple copies of the image only if width is large enough */}
                    {Array.from({ length: duplicateCount }).map((_, index) => (
                      <Image
                        key={`${item.id}-dup-${index}`}
                        src={item.imageUrl || ''}
                        alt={item.title || `Image ${item.originalIndex !== undefined ? item.originalIndex + 1 : ''}`}
                        width={120} height={90}
                        className="object-cover h-full flex-shrink-0"
                        style={{ width: `${100 / duplicateCount}%` }}
                      />
                    ))}
                  </div>

                  {/* Resize handle */}
                  <div
                    className="absolute top-0 right-0 w-4 h-full cursor-ew-resize opacity-0 group-hover:opacity-100 bg-gradient-to-r from-transparent to-black/20"
                    onMouseDown={handleResizeStart}
                  />
                  {isEffectivelySelected && (
                    <div className="absolute top-1 right-1 bg-primary rounded-full w-4 h-4 flex items-center justify-center z-10">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
              );
            } else if (track.type === 'text' && item.type === 'text' && item.scriptSegment) {
              return (
                <div
                  key={item.id}
                  className={`flex-shrink-0 ${track.height} rounded-md p-1.5 border ${isEffectivelySelected ? "border-primary/30 bg-primary/10" : "border-border bg-muted/30"} overflow-hidden transition-all duration-200 ease-in-out cursor-pointer`}
                  style={{ width: widthPx }}
                  onClick={(e) => { e.stopPropagation(); handleItemClick(item); }}
                >
                  <p className="text-xs text-foreground/80 leading-tight line-clamp-3">
                    {item.scriptSegment || "Loading script..."}
                  </p>
                </div>
              );
            } else if (item.type === 'audio') { // Generic audio item
              return (
                <div
                  key={item.id}
                  className={`flex-grow ${track.height} rounded-md flex items-center justify-center p-1 border ${isEffectivelySelected ? "border-primary bg-primary/10" : "border-border bg-muted/30"} cursor-pointer`}
                  style={{ width: widthPx }}
                  onClick={(e) => { e.stopPropagation(); handleItemClick(item); }}
                >
                  <span className={`text-xs ${isEffectivelySelected ? 'text-primary-foreground' : 'text-muted-foreground'}`}>{item.title || 'Audio Clip'}</span>
                </div>
              );
            }
            return null;
          })
        ) : (
          <div className={`flex flex-col items-center justify-center w-full ${track.height} text-center`}>
            <track.icon className="w-5 h-5 text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">{track.emptyStateMessage}</p>
            {track.showGenerateButton && track.type === 'video' && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2 border-dashed border-2 hover:border-primary text-xs px-2 py-1 h-auto"
                disabled={isGeneratingImages}
                onClick={(e) => { e.stopPropagation(); handleGenerateChapterImages(); }}
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
  );
}