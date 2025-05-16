"use client";

import React from "react";
import type { Story } from "@/types/story";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ImageIcon, Loader2, Sparkles, History } from "lucide-react";

interface EditTimelineItemPanelContentProps {
  storyData: Story | null;
  selectedTimelineImage: number | null;
  editedPrompt: string;
  setEditedPrompt: (prompt: string) => void;
  handleEditGenerate: () => Promise<void>;
  isEditingImage: boolean;
  handleRevertToHistory: (historyIndex: number) => Promise<void>;
}

export default function EditTimelineItemPanelContent({
  storyData,
  selectedTimelineImage,
  editedPrompt,
  setEditedPrompt,
  handleEditGenerate,
  isEditingImage,
  handleRevertToHistory,
}: EditTimelineItemPanelContentProps) {
  if (selectedTimelineImage === null || !storyData?.generatedImages?.[selectedTimelineImage]) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <ImageIcon className="w-12 h-12 text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">No image selected from the timeline.</p>
        <p className="text-xs text-muted-foreground mt-1">Click an image in the timeline below to edit it.</p>
      </div>
    );
  }

  const currentImage = storyData.generatedImages[selectedTimelineImage];

  return (
    <div className="p-1 flex flex-col h-full">
      <h3 className="text-base font-semibold mb-3 text-primary border-b pb-2">
        Edit Timeline Item (Scene {selectedTimelineImage + 1})
      </h3>
      <ScrollArea className="flex-1">
        <div className="space-y-4 pr-2">
          <div className="w-full aspect-video rounded-md overflow-hidden shadow-md mb-2 bg-muted">
            {currentImage?.imageUrl && (
              <Image
                src={currentImage.imageUrl}
                alt={`Selected Scene ${selectedTimelineImage + 1}`}
                width={400}
                height={225}
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <div>
            <Label htmlFor="editedPromptSidebar" className="text-xs font-medium mb-1">
              Prompt:
            </Label>
            <Textarea
              id="editedPromptSidebar"
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              className="text-xs min-h-[100px] mb-2"
              placeholder="Edit the prompt for the image..."
            />
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] text-muted-foreground">
                Use @EntityName for auto-expansion.
              </p>
              <Button
                size="sm"
                variant="default"
                className="text-xs h-8"
                onClick={handleEditGenerate}
                disabled={isEditingImage}
              >
                {isEditingImage ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3 mr-1" />
                )}
                Generate
              </Button>
            </div>
          </div>

          {currentImage?.history && currentImage.history.length > 0 && (
            <div className="mt-2 border-t pt-3">
              <p className="text-xs font-medium mb-2">History (Last 5):</p>
              <div className="space-y-2">
                {currentImage.history.map((histItem, histIdx) => (
                  <div
                    key={histIdx}
                    className="flex items-center gap-2 p-1.5 rounded-md border hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleRevertToHistory(histIdx)}
                  >
                    <div className="flex-shrink-0 w-12 h-12 rounded overflow-hidden border">
                      <Image
                        src={histItem.imageUrl}
                        alt={`History ${histIdx + 1}`}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-[11px] text-muted-foreground truncate leading-tight">
                        {histItem.originalPrompt}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                        {new Date(histItem.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="w-6 h-6">
                      <History className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}