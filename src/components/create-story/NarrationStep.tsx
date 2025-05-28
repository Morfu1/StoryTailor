import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Mic, Loader2, Play, Pause } from 'lucide-react';
import { VoiceSelector } from './VoiceSelector';
import { NarrationChunkPlayer } from './NarrationChunkPlayer';
import { useNarrationGeneration } from '@/hooks/useNarrationGeneration';
import { useToast } from '@/hooks/use-toast';
import type { UseStoryStateReturn } from '@/hooks/useStoryState';

interface NarrationStepProps {
  storyState: UseStoryStateReturn;
}

export function NarrationStep({ storyState }: NarrationStepProps) {
  const { toast } = useToast();
  const { handleGenerateNarration } = useNarrationGeneration({ storyState });
  const {
    storyData,
    isLoading,
    setCurrentStep,
    narrationSource,
    processingAllMode,
    setProcessingAllMode,
    currentNarrationChunkIndex
  } = storyState;

  const handleGenerateAllNarration = () => {
    setProcessingAllMode(true);
    handleGenerateNarration(); // No specific index means "generate all"
  };

  if (!storyData.detailsPrompts) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Step 3: Narration Generation
          </CardTitle>
          <CardDescription>
            Generate character and scene details first to continue with narration.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const totalChunks = storyData.narrationChunks?.length || 0;
  const completedChunks = storyData.narrationChunks?.filter(chunk => chunk.audioUrl).length || 0;
  const progressPercentage = totalChunks > 0 ? (completedChunks / totalChunks) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5" />
          Step 3: Narration Generation
        </CardTitle>
        <CardDescription>
          Generate audio narration for your story using AI voices or upload your own audio.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <VoiceSelector storyState={storyState} />

        {storyData.narrationChunks && storyData.narrationChunks.length > 0 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Narration Progress ({completedChunks}/{totalChunks} chunks completed)
                </Label>
                <span className="text-sm text-muted-foreground">
                  {Math.round(progressPercentage)}%
                </span>
              </div>
              <Progress value={progressPercentage} className="w-full" />
            </div>

            {narrationSource === 'generate' && (
              <div className="flex gap-2">
                <Button 
                  onClick={handleGenerateAllNarration}
                  disabled={isLoading.narration || processingAllMode}
                  className="flex-1"
                >
                  {isLoading.narration && processingAllMode ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating All... ({currentNarrationChunkIndex + 1}/{totalChunks})
                    </>
                  ) : (
                    <>
                      <Mic className="mr-2 h-4 w-4" />
                      {completedChunks === 0 ? 'Generate All Narration' : 'Continue Generation'}
                    </>
                  )}
                </Button>
                
                {completedChunks === totalChunks && totalChunks > 0 && (
                  <Button 
                    onClick={() => setCurrentStep(4)}
                    variant="outline"
                  >
                    Next Step
                  </Button>
                )}
              </div>
            )}

            <div className="space-y-3">
              <Label className="text-sm font-medium">Individual Chunks</Label>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {storyData.narrationChunks.map((chunk, index) => (
                  <NarrationChunkPlayer
                    key={chunk.id}
                    chunk={chunk}
                    index={index}
                    storyState={storyState}
                    onGenerateChunk={handleGenerateNarration}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {(!storyData.narrationChunks || storyData.narrationChunks.length === 0) && storyData.generatedScript && (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-4">
              Your script is ready to be split into narration chunks.
            </p>
            <Button 
              onClick={handleGenerateAllNarration}
              disabled={isLoading.narration}
            >
              {isLoading.narration ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Preparing Chunks...
                </>
              ) : (
                <>
                  <Mic className="mr-2 h-4 w-4" />
                  Start Narration Generation
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
