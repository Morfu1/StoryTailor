import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Mic, Loader2, Play, Pause, RefreshCw, StopCircle } from 'lucide-react';
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
  const { handleGenerateNarration, handleRegenerateChunks, handleStopGeneration } = useNarrationGeneration({ storyState });
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
        {!storyData.id && (
          <div className="bg-amber-100 border border-amber-300 rounded p-3 mb-4">
            <h4 className="text-sm font-medium text-amber-800">Please Save Your Story First</h4>
            <p className="text-xs text-amber-700 mt-1">
              To ensure narration works correctly, save your story using the "Save Story" button at the bottom of the page before generating audio.
            </p>
          </div>
        )}
        
        <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
          <h4 className="text-sm font-medium text-blue-800">Troubleshooting Audio Issues</h4>
          <p className="text-xs text-blue-700 mt-1">
            If you encounter audio loading errors, they may be caused by:
          </p>
          <ul className="list-disc list-inside text-xs text-blue-700 mt-1">
            <li>Ad blockers or privacy extensions blocking Firebase Storage connections</li>
            <li>Network connectivity issues</li>
            <li>Story not being saved before generating audio</li>
          </ul>
          <p className="text-xs text-blue-700 mt-2">
            Try disabling ad blockers temporarily for this site, ensure your story is saved, and reload the page if issues persist.
          </p>
        </div>

        <VoiceSelector storyState={storyState} />

        {storyData.narrationChunks && storyData.narrationChunks.length > 0 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Narration Progress ({completedChunks}/{totalChunks} chunks completed)
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {Math.round(progressPercentage)}%
                  </span>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isLoading.scriptChunksUpdate}
                      >
                        {isLoading.scriptChunksUpdate ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Regenerate Story Chunks?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will regenerate the story chunks using improved visual scene logic. 
                          <strong className="block mt-2 text-destructive">
                            Warning: All existing voice generations will be cleared and need to be regenerated.
                          </strong>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRegenerateChunks}>
                          Regenerate Chunks
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <Progress value={progressPercentage} className="w-full" />
            </div>

            {narrationSource === 'generate' && (
              <div className="flex gap-2">
                {!processingAllMode ? (
                  <Button 
                    onClick={handleGenerateAllNarration}
                    disabled={isLoading.narration}
                    className="flex-1"
                  >
                    <Mic className="mr-2 h-4 w-4" />
                    {completedChunks === 0 ? 'Generate All Narration' : 'Continue Generation'}
                  </Button>
                ) : (
                  <>
                    <Button 
                      disabled
                      className="flex-1"
                    >
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating All... ({currentNarrationChunkIndex + 1}/{totalChunks})
                    </Button>
                    <Button 
                      onClick={handleStopGeneration}
                      variant="destructive"
                      size="default"
                    >
                      <StopCircle className="mr-2 h-4 w-4" />
                      Stop
                    </Button>
                  </>
                )}
                
                {completedChunks === totalChunks && totalChunks > 0 && !processingAllMode && (
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
