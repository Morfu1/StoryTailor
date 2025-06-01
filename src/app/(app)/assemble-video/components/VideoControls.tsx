"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import type { Story } from "@/types/story";
import {
  Play,
  Pause,
  Scissors,
  Trash2,
  Copy,
  History,
  ZoomOut,
  ZoomIn,
  Maximize,
} from "lucide-react";

interface VideoControlsProps {
  storyData: Story | null; // storyData can be null initially
}

export default function VideoControls({ storyData }: VideoControlsProps) {
  return (
    <div className="bg-background p-2 rounded-md shadow-sm border border-border flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" disabled>
          <Play className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" disabled>
          <Pause className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" disabled>
          <Scissors className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" disabled>
          <Trash2 className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" disabled>
          <Copy className="w-5 h-5" />
        </Button>
      </div>
      <span className="text-sm text-muted-foreground">
        0:00 /{" "}
        {typeof storyData?.narrationAudioDurationSeconds === 'number'
          ? ((storyData.narrationAudioDurationSeconds / 60)
              .toFixed(2)
              .replace(".", ":"))
          : "3:59"}{" "}
        {/* Default to 3:59 for demo purposes */}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" disabled>
          <History className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" disabled>
          <ZoomOut className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" disabled>
          <ZoomIn className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" disabled>
          <Maximize className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}