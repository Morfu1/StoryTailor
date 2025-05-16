"use client";

import React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { Story, GeneratedImage } from "@/types/story"; // Assuming GeneratedImage is also in story.ts
import { Check, ImageIcon, Loader2 } from "lucide-react";

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
  return (
    <div className="flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium text-primary">Timeline</h3>
      </div>
      <ScrollArea className="h-32 bg-background p-2 rounded-md shadow-sm border border-border">
        <div className="flex space-x-2 pb-2">
          {storyData?.generatedImages &&
          Array.isArray(storyData.generatedImages) &&
          storyData.generatedImages.length > 0 &&
          storyData.generatedImages.some(
            (img) => img.isChapterGenerated,
          ) ? (
            // Only show images when they've been generated through our chapter generation
            storyData.generatedImages
              .filter((img): img is GeneratedImage => !!img && img.isChapterGenerated === true) // Type guard
              .map((img, index) => (
                <div
                  key={index}
                  className={`flex-shrink-0 w-32 h-28 rounded-md overflow-hidden border-2 ${selectedTimelineImage === index ? "border-primary" : "border-transparent hover:border-primary/50"} cursor-pointer shadow relative group`}
                  onClick={() => {
                    setSelectedTimelineImage(index);
                    setSelectedPanel("Edit Image"); // Switch to Edit Image panel
                  }}
                >
                  <Image
                    src={img.imageUrl}
                    alt={`Scene ${index + 1}`}
                    width={128}
                    height={112}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end">
                    <div className="p-2 text-[10px] text-white">
                      <p className="truncate font-medium">
                        Chapter {img.chapterNumber || 1}, Scene{" "}
                        {index + 1}
                      </p>
                      <p className="truncate text-gray-300 mt-0.5">
                        {img.originalPrompt?.substring(0, 60)}...
                      </p>
                    </div>
                  </div>
                  {selectedTimelineImage === index && (
                    <div className="absolute top-1 right-1 bg-primary rounded-full w-4 h-4 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
              ))
          ) : (
            // Empty state showing "Generate Chapter" button
            <div className="flex flex-col items-center justify-center w-full h-full text-center">
              <div className="text-muted-foreground mb-3">
                <p className="text-sm">
                  Empty timeline - click below to generate images for
                  Chapter {currentChapter}
                </p>
              </div>
              <Button
                variant="outline"
                className="border-dashed border-2 hover:border-primary"
                disabled={isGeneratingImages}
                onClick={handleGenerateChapterImages}
              >
                {isGeneratingImages ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {currentImageProgress > 0 &&
                    totalImagesToGenerate > 0
                      ? `Generating ${currentImageProgress}/${totalImagesToGenerate} (${generationProgress}%)`
                      : `Preparing images...`}
                  </>
                ) : chaptersGenerated.length === 0 ? (
                  <>
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Generate Chapter 1 Images
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Generate Chapter {currentChapter} Images
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}