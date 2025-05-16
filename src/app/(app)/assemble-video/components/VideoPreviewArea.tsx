"use client";

import React from "react";
import Image from "next/image";
import type { Story } from "@/types/story";
import { Video } from "lucide-react";

interface VideoPreviewAreaProps {
  storyData: Story | null;
  selectedTimelineImage: number | null;
  className?: string;
}

export default function VideoPreviewArea({
  storyData,
  selectedTimelineImage,
  className,
}: VideoPreviewAreaProps) {
  return (
    <div className={`flex-1 bg-muted rounded-lg flex items-center justify-center shadow-inner relative overflow-hidden ${className || ''}`}>
      {selectedTimelineImage !== null &&
      storyData?.generatedImages?.[selectedTimelineImage]?.imageUrl ? (
        <Image
          src={
            storyData.generatedImages[selectedTimelineImage].imageUrl
          }
          alt={`Preview of Scene ${selectedTimelineImage + 1}`}
          width={800}
          height={450}
          className="max-w-full max-h-full object-contain rounded-md"
          key={
            storyData.generatedImages[selectedTimelineImage].imageUrl
          } // Force re-render if URL changes for same index
        />
      ) : storyData?.generatedImages &&
        storyData.generatedImages.length > 0 &&
        storyData.generatedImages.some(
          (img) => img?.isChapterGenerated,
        ) ? (
        // Show the first available chapter-generated image if no timeline item is selected
        <Image
          src={
            storyData.generatedImages.find(
              (img) => img?.isChapterGenerated,
            )?.imageUrl || ""
          }
          alt="Video Preview Placeholder"
          width={800}
          height={450}
          className="max-w-full max-h-full object-contain rounded-md"
        />
      ) : (
        <div className="flex flex-col items-center justify-center p-8">
          <Video className="w-24 h-24 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground text-sm max-w-md text-center">
            This is the timeline view. Generate images to start creating
            your animation or select an image from the timeline below.
            <span className="font-mono text-xs block mt-2 p-2 bg-background/80 rounded-md">
              Example: "Wide shot of @SunnyMeadow, with @Barnaby..."
            </span>
          </p>
        </div>
      )}
    </div>
  );
}