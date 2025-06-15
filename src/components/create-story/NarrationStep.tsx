
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Mic, Loader2, RefreshCw, StopCircle } from 'lucide-react'; // Removed Play, Pause, Settings
import Link from 'next/link'; // Added Link
import { VoiceSelector } from './VoiceSelector';
import { NarrationChunkPlayer } from './NarrationChunkPlayer';
import { useNarrationGeneration } from '@/hooks/useNarrationGeneration';
// import { useToast } from '@/hooks/use-toast'; // Unused
import type { UseStoryStateReturn } from '@/hooks/useStoryState';

interface NarrationStepProps {
  storyState: UseStoryStateReturn;
}

export function NarrationStep({ storyState }: NarrationStepProps) {
  // const { toast } = useToast(); // Unused
  const { handleGenerateNarration, handleRegenerateChunks, handleStopGeneration } = useNarrationGeneration({ storyState });
  const {
    storyData,
    isLoading,
    setCurrentStep,
    narrationSource,
    processingAllMode,
    setProcessingAllMode,
    currentNarrationChunkIndex,
    userApiKeys, // Get userApiKeys
    apiKeysLoading, // Get apiKeysLoading
    selectedTtsModel
  } = storyState;

  const handleGenerateAllNarration = () => {
    setProcessingAllMode(true);
    handleGenerateNarration(); 
  };

  const elevenLabsKeyMissing = selectedTtsModel === 'elevenlabs' && !apiKeysLoading && !userApiKeys?.elevenLabsApiKey;
  const googleKeyMissingForTTS = selectedTtsModel === 'google' && !apiKeysLoading && !userApiKeys?.googleApiKey && !userApiKeys?.geminiApiKey;
  const googleKeyMissingForChunks = !apiKeysLoading && !userApiKeys?.googleApiKey; // Chunking always uses Google API Key

  const canGenerate = narrationSource === 'generate' && !apiKeysLoading &&
    !(selectedTtsModel === 'elevenlabs' && !userApiKeys?.elevenLabsApiKey) &&
    !(selectedTtsModel === 'google' && (!userApiKeys?.googleApiKey && !userApiKeys?.geminiApiKey));

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
          Generate audio narration for your story using AI voices or upload your own audio. Your story has been automatically split into chunks for optimal narration.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!storyData.id && (
          <div className="bg-amber-100 border border-amber-300 rounded p-3 mb-4">
            <h4 className="text-sm font-medium text-amber-800">Please Save Your Story First</h4>
            <p className="text-xs text-amber-700 mt-1">
              To ensure narration works correctly, save your story using the &quot;Save Story&quot; button at the bottom of the page before generating audio.
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

        { (elevenLabsKeyMissing || googleKeyMissingForTTS) && narrationSource === 'generate' && (
           <p className="text-xs text-destructive text-center">
             {selectedTtsModel === 'elevenlabs' ? 'ElevenLabs' : 'Google'} API Key required for narration generation. Please set it in <Link href="/settings" className="underline">Account Settings</Link>.
           </p>
        )}
        { googleKeyMissingForChunks && (!storyData.narrationChunks || storyData.narrationChunks.length === 0) && (
           <p className="text-xs text-destructive text-center">
             Google API Key required for initial script chunking. Please set it in <Link href="/settings" className="underline">Account Settings</Link>.
           </p>
        )}


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
                        disabled={isLoading.scriptChunksUpdate || apiKeysLoading || googleKeyMissingForChunks}
                      >
                        {isLoading.scriptChunksUpdate || apiKeysLoading ? (
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
                        This will regenerate the story chunks using the AI model you selected in Step 1. 
                        <strong className="block mt-2 text-destructive">
                        Warning: All existing voice generations will be cleared and need to be regenerated.
                        </strong>
                        {googleKeyMissingForChunks && <span className="block mt-2 text-destructive">Google API Key is required for this.</span>}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRegenerateChunks} disabled={googleKeyMissingForChunks}>
                          Regenerate Chunks
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <Progress value={progressPercentage} className="w-full" />
            </div>

            {/* Optional Regenerate Chunks Button */}
            <div className="bg-blue-50 border border-blue-200 rounded p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-blue-800">Need to Adjust Chunks?</h4>
                  <p className="text-xs text-blue-700 mt-1">
                    Your story was automatically split into chunks in Step 1. You can regenerate them if needed.
                  </p>
                </div>
                <Button
                  onClick={handleRegenerateChunks}
                  disabled={isLoading.scriptChunksUpdate || apiKeysLoading || googleKeyMissingForChunks}
                  variant="outline"
                  size="sm"
                >
                  {isLoading.scriptChunksUpdate ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Regenerating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-3 w-3" />
                      Regenerate Chunks
                    </>
                  )}
                </Button>
              </div>
            </div>

            {narrationSource === 'generate' && (
              <div className="flex gap-2">
                {!processingAllMode ? (
                  <Button 
                    onClick={handleGenerateAllNarration}
                    disabled={isLoading.narration || apiKeysLoading || !canGenerate}
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
            <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4">
              <h4 className="text-sm font-medium text-yellow-800">Missing Script Chunks</h4>
              <p className="text-xs text-yellow-700 mt-1">
                It looks like chunks weren't generated in Step 1. This might happen with older stories or if there was an error during processing.
              </p>
            </div>
            <div className="space-y-3">
              <Button 
                onClick={handleRegenerateChunks} // Use the dedicated chunk generation function
                disabled={isLoading.scriptChunksUpdate || apiKeysLoading || googleKeyMissingForChunks}
                className="w-full"
              >
                {isLoading.scriptChunksUpdate || apiKeysLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {apiKeysLoading ? "Checking API Keys..." : "Generating Chunks..."}
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Generate Script Chunks Now
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                After chunks are generated, you can select a voice and generate audio.
              </p>
            </div>
            {googleKeyMissingForChunks && (
               <p className="text-xs text-destructive text-center mt-2">
                 Google API Key required to prepare script chunks. Please set it in <Link href="/settings" className="underline">Account Settings</Link>.
               </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

