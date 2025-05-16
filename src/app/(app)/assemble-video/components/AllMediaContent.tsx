"use client";

import React from "react";
import type { Story } from "@/types/story";
import Image from "next/image";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ImageIcon, Music } from "lucide-react";

interface AllMediaContentProps {
  storyData: Story;
}

export default function AllMediaContent({ storyData }: AllMediaContentProps) {
  const images = storyData.generatedImages || [];
  const narrationAudioUrl =
    (storyData as any).narrationAudioUrl ||
    (storyData as any).detailsPrompts?.narrationAudioUrl;

  return (
    <div className="h-full">
      <div className="rounded-lg border border-border shadow-sm h-full flex flex-col">
        <div className="p-3 border-b border-border bg-muted/20">
          <h2 className="font-semibold">All Media</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Browse all generated images and audio for your story.
          </p>
        </div>

        <ScrollArea className="flex-1 p-4 space-y-6">
          <div>
            <h3 className="text-md font-semibold mb-2">Generated Images</h3>
            {images.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {images.map((img, index) => (
                  <div
                    key={
                      (img as any).id ||
                      (img as any).imageId ||
                      `all-media-img-${index}`
                    }
                    className="aspect-video rounded-md overflow-hidden border border-input shadow-sm hover:shadow-lg transition-shadow relative bg-muted/20 flex items-center justify-center"
                  >
                    {img?.imageUrl ? (
                      <Image
                        src={img.imageUrl}
                        alt={
                          img.originalPrompt?.substring(0, 40) ||
                          `Image ${index + 1}`
                        }
                        layout="fill"
                        objectFit="contain"
                        className="rounded-sm"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-10 h-10 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No images have been generated yet.
              </p>
            )}
          </div>

          <div>
            <h3 className="text-md font-semibold mb-2">Main Narration Audio</h3>
            {narrationAudioUrl ? (
              <div>
                <audio controls src={narrationAudioUrl} className="w-full h-10">
                  Your browser does not support the audio element.
                </audio>
                {(storyData as any).narrationAudioDurationSeconds && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Duration:{" "}
                    {Math.floor(
                      (storyData as any).narrationAudioDurationSeconds / 60,
                    )}
                    :
                    {((storyData as any).narrationAudioDurationSeconds % 60)
                      .toString()
                      .padStart(2, "0")}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No main narration audio available.
              </p>
            )}
          </div>

          <div>
            <h3 className="text-md font-semibold mb-2">
              Sound Effects & Other Audio Clips
            </h3>
            <div className="p-6 border border-dashed rounded-md bg-muted/20 text-center">
              <Music className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Display for individual sound effects (e.g., "glow", "steps on
                path") will be implemented here once the data structure is
                available.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                (This requires a dedicated field in the Story object, like
                `storyData.soundEffects` an array of audio clips with
                names/URLs)
              </p>
            </div>
          </div>
          <ScrollBar orientation="vertical" />
        </ScrollArea>
      </div>
    </div>
  );
}