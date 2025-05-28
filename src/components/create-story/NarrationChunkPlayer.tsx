import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConvertibleAudioPlayer } from '@/components/ConvertibleAudioPlayer';
import { Mic, Loader2, CheckCircle } from 'lucide-react';
import type { NarrationChunk } from '@/types/narration';
import type { UseStoryStateReturn } from '@/hooks/useStoryState';

interface NarrationChunkPlayerProps {
  chunk: NarrationChunk;
  index: number;
  storyState: UseStoryStateReturn;
  onGenerateChunk: (chunkIndex: number) => void;
}

export function NarrationChunkPlayer({ 
  chunk, 
  index, 
  storyState, 
  onGenerateChunk 
}: NarrationChunkPlayerProps) {
  const {
    isLoading,
    currentNarrationChunkIndex,
    processingAllMode,
    narrationSource
  } = storyState;

  const isCurrentlyProcessing = currentNarrationChunkIndex === index && isLoading.narration;
  const isCompleted = Boolean(chunk.audioUrl);
  const isDisabled = isLoading.narration || processingAllMode;

  return (
    <Card className="border-l-4 border-l-primary/20">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            {isCompleted ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : isCurrentlyProcessing ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />
            )}
          </div>
          
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                Chunk {index + 1}
                {chunk.duration && (
                  <span className="text-muted-foreground ml-2">
                    ({chunk.duration.toFixed(1)}s)
                  </span>
                )}
              </span>
              
              {narrationSource === 'generate' && !isCompleted && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onGenerateChunk(index)}
                  disabled={isDisabled}
                  className="text-xs"
                >
                  {isCurrentlyProcessing ? (
                    <>
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Mic className="mr-1 h-3 w-3" />
                      Generate
                    </>
                  )}
                </Button>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground line-clamp-3">
              {chunk.text}
            </p>
            
            {chunk.audioUrl && (
              <div className="mt-2">
                <ConvertibleAudioPlayer
                  src={chunk.audioUrl}
                  className="w-full"
                  chunkId={chunk.id}
                />
              </div>
            )}
            
            {isCurrentlyProcessing && (
              <div className="mt-2 text-xs text-primary">
                Generating audio for this chunk...
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
