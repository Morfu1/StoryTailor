"use client";

import React, { useMemo } from "react";
import type { Story } from "@/types/story";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";

interface VoicesContentProps {
  storyData: Story;
}

export default function VoicesContent({ storyData }: VoicesContentProps) {
  const voiceInfo = useMemo(() => {
    const voiceName = storyData.narrationVoice || "Narrator";
    const voiceId =
      storyData.narrationVoiceId ||
      (storyData as { elevenLabsVoiceId?: string })?.elevenLabsVoiceId ||
      "Unknown";
    const durationSeconds = storyData.narrationAudioDurationSeconds;
    const duration = typeof durationSeconds === 'number'
      ? `${Math.floor(durationSeconds / 60)}:${(durationSeconds % 60).toString().padStart(2, "0")}`
      : "0:00";
    const hasAudio = !!storyData.narrationAudioUrl;

    return { voiceName, voiceId, duration, hasAudio };
  }, [storyData]);

  return (
    <div className="h-full">
      <div className="rounded-lg border border-border shadow-sm h-full">
        <div className="p-3 border-b border-border bg-muted/20">
          <h2 className="font-semibold">Voice Settings</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage voice settings for your story narration
          </p>
        </div>

        <div className="p-4">
          <h3 className="text-sm font-medium mb-3">Narrator Voice</h3>

          <div className="space-y-4">
            <div className="bg-muted/20 p-4 rounded-md border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Narrator</h4>
                  <p className="text-xs text-muted-foreground">
                    Voice used for story narration
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">Default Voice</p>
                  <p className="text-xs text-muted-foreground">
                    No voice selection
                  </p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-border flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <div className="text-xs text-muted-foreground">
                  Audio Duration: {voiceInfo.duration}
                </div>

                {voiceInfo.hasAudio ? (
                  <div className="flex items-center gap-2">
                    <audio
                      controls
                      src={storyData.narrationAudioUrl || undefined}
                      className="h-7 w-full sm:w-48"
                    >
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground italic">
                    No audio available
                  </div>
                )}
              </div>
            </div>

            <div className="bg-muted/20 p-3 rounded-md border border-border border-dashed">
              <div className="text-center py-3">
                <p className="text-muted-foreground text-sm">
                  Character voices coming soon
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  You&apos;ll be able to assign different voices to each character
                </p>
                <Button variant="outline" size="sm" className="mt-3" disabled>
                  <User className="h-4 w-4 mr-2" />
                  Add Character Voice
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}