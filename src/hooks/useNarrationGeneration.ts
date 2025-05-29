import { useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { generateNarrationAudio, saveStory } from '@/actions/storyActions';
import { prepareScriptChunksAI, calculateTotalNarrationDuration } from '@/utils/narrationUtils';
import type { Story } from '@/types/story';
import type { UseStoryStateReturn } from './useStoryState';

interface UseNarrationGenerationProps {
  storyState: UseStoryStateReturn;
}

export const useNarrationGeneration = ({ storyState }: UseNarrationGenerationProps) => {
  const { toast } = useToast();
  const {
    storyData,
    updateStoryData,
    narrationSource,
    selectedTtsModel,
    selectedVoiceId,
    selectedGoogleVoiceId,
    selectedGoogleApiModel,
    selectedGoogleLanguage,
    currentNarrationChunkIndex,
    setCurrentNarrationChunkIndex,
    processingAllMode,
    setProcessingAllMode,
    setCurrentStep,
    handleSetLoading,
    setElevenLabsVoices,
    isLoading
  } = storyState;

  const handleGenerateNarration = useCallback(async (specificChunkIndexToProcess?: number) => {
    if (narrationSource !== 'generate') return;
    
    // If a specific chunk is requested, ensure script and chunks exist for that index.
    // If "generate all" is implied (no specific index), ensure script exists.
    if (typeof specificChunkIndexToProcess === 'number') {
      if (!storyData.narrationChunks || !storyData.narrationChunks[specificChunkIndexToProcess]) {
        toast({ title: 'Error', description: 'Chunk not found for individual generation.', variant: 'destructive'});
        return;
      }
    } else if (!storyData.generatedScript) { // For "generate all" or initial prep
      toast({ title: 'No Script', description: 'Please generate a script first.', variant: 'destructive' });
      return;
    }
    
    handleSetLoading('narration', true); // General loading state

    let voiceIdToUse: string | undefined = undefined;

    if (selectedTtsModel === 'elevenlabs') {
      voiceIdToUse = selectedVoiceId || storyData.elevenLabsVoiceId;
      if (!voiceIdToUse) {
        toast({ title: 'ElevenLabs Voice Not Selected', description: 'Please select an ElevenLabs voice.', variant: 'destructive' });
        handleSetLoading('narration', false);
        return;
      }
    } else if (selectedTtsModel === 'google') {
      voiceIdToUse = selectedGoogleVoiceId;
      if (!voiceIdToUse) {
        toast({ title: 'Google Voice Not Selected', description: 'Please select a Google voice.', variant: 'destructive' });
        handleSetLoading('narration', false);
        return;
      }
    } else {
      toast({ title: 'TTS Model Error', description: 'No TTS model selected.', variant: 'destructive' });
      handleSetLoading('narration', false);
      return;
    }

    // Ensure narrationChunks exist (with text) before proceeding
    if (!storyData.narrationChunks || storyData.narrationChunks.length === 0) {
      if (storyData.generatedScript) {
        toast({ title: 'Preparing Chunks...', description: 'AI is splitting the script. Please wait.', className: 'bg-primary text-primary-foreground' });
        handleSetLoading('scriptChunksUpdate', true);
        try {
          const newNarrationChunks = await prepareScriptChunksAI(storyData.generatedScript);
          updateStoryData({ narrationChunks: newNarrationChunks });
          handleSetLoading('scriptChunksUpdate', false);
          if (newNarrationChunks.length > 0) {
            toast({ title: 'Script Chunks Ready!', description: `AI created ${newNarrationChunks.length} chunks. Now select a voice and generate audio.`, className: 'bg-primary text-primary-foreground' });
            // Don't proceed to audio generation immediately, let user click again after voice selection if needed.
            handleSetLoading('narration', false);
            return;
          } else {
            toast({ title: 'No Chunks Generated', description: 'AI could not split the script into chunks.', variant: 'destructive' });
            handleSetLoading('narration', false);
            return;
          }
        } catch (error) {
          toast({ title: 'Error Preparing Chunks', description: 'Failed to split script with AI.', variant: 'destructive' });
          handleSetLoading('scriptChunksUpdate', false);
          handleSetLoading('narration', false);
          return;
        }
      } else {
        toast({ title: 'No Script', description: 'Please generate a script first.', variant: 'destructive' });
        handleSetLoading('narration', false);
        return;
      }
    }
    
    // At this point, voice is selected, and narrationChunks (with text) should exist if we got this far.

    let chunkToProcessIndex = -1;

    if (typeof specificChunkIndexToProcess === 'number') {
      chunkToProcessIndex = specificChunkIndexToProcess;
      // If processing a single chunk, ensure currentNarrationChunkIndex reflects this specific chunk for UI feedback
      setCurrentNarrationChunkIndex(chunkToProcessIndex);
    } else { // "Generate All" flow
      if (currentNarrationChunkIndex === -1) { // If not already processing a sequence
        const firstUnprocessed = storyData.narrationChunks!.findIndex(chunk => !chunk.audioUrl);
        if (firstUnprocessed !== -1) {
          chunkToProcessIndex = firstUnprocessed;
          setCurrentNarrationChunkIndex(firstUnprocessed);
        } else { // All are already processed
          // Option to re-generate all: clear existing audio and start from 0
          const confirmReGenerate = storyData.narrationChunks!.every(c => c.audioUrl); // True if all have audio
          if (confirmReGenerate) {
             const resetChunks = storyData.narrationChunks!.map(c => ({...c, audioUrl: undefined, duration: undefined}));
             updateStoryData({ narrationChunks: resetChunks, narrationAudioDurationSeconds: 0 });
             chunkToProcessIndex = 0;
             setCurrentNarrationChunkIndex(0);
             toast({title: "Re-generating All Chunks", description: "Previous audio cleared.", className: "bg-primary text-primary-foreground"})
          } else {
            toast({ title: 'All Chunks Processed', description: 'All narration chunks already have audio.', className: 'bg-primary text-primary-foreground' });
            handleSetLoading('narration', false);
            return;
          }
        }
      } else { // Already in a "Generate All" sequence
        chunkToProcessIndex = currentNarrationChunkIndex;
      }
    }

    if (chunkToProcessIndex === -1 || !storyData.narrationChunks || !storyData.narrationChunks[chunkToProcessIndex]) {
      setCurrentNarrationChunkIndex(-1);
      if (typeof specificChunkIndexToProcess !== 'number') { // Part of "Generate All" flow that finished or had nothing to do
        setProcessingAllMode(false);
        if (storyData.narrationChunks?.every(c => c.audioUrl)) {
             setCurrentStep(4);
        }
      }
      handleSetLoading('narration', false);
      return;
    }
    
    // If this call is for a single chunk, ensure processingAllMode is false.
    if (typeof specificChunkIndexToProcess === 'number' && processingAllMode) {
      setProcessingAllMode(false); // Stop any "generate all" sequence if user clicks a single chunk.
    }
    
    const chunk = storyData.narrationChunks![chunkToProcessIndex]; // Assert narrationChunks is not null/undefined
    const result = await generateNarrationAudio({
      script: chunk.text,
      voiceId: selectedTtsModel === 'elevenlabs' ? voiceIdToUse : selectedGoogleVoiceId,
      ttsModel: selectedTtsModel,
      googleApiModel: selectedTtsModel === 'google' ? selectedGoogleApiModel : undefined,
      languageCode: selectedTtsModel === 'google' ? selectedGoogleLanguage : undefined,
      userId: storyData.userId,
      storyId: storyData.id,
      chunkId: chunk.id
    });
    
    if (result.success && result.data && result.data.audioStorageUrl) { // Check for audioStorageUrl
      const updatedChunks = [...storyData.narrationChunks!];
      updatedChunks[chunkToProcessIndex] = {
        ...chunk,
        audioUrl: result.data.audioStorageUrl, // Use audioStorageUrl
        duration: result.data.duration
      };
      
      const totalDuration = calculateTotalNarrationDuration(updatedChunks);
      const updatedStoryData = {
        ...storyData,
        narrationChunks: updatedChunks,
        narrationAudioDurationSeconds: totalDuration,
        elevenLabsVoiceId: voiceIdToUse
      };
      
      updateStoryData({
        narrationChunks: updatedChunks,
        narrationAudioDurationSeconds: totalDuration,
        elevenLabsVoiceId: voiceIdToUse
      });
      
      // Auto-save the story with the new narration chunk (non-blocking)
      if (storyData.id && storyData.userId) {
        saveStory(updatedStoryData, storyData.userId)
          .then(() => {
            console.log(`Auto-saved story with new narration chunk ${chunkToProcessIndex + 1}`);
          })
          .catch((error) => {
            console.error('Failed to auto-save story after narration generation:', error);
          });
      }
      
      toast({
        title: `Chunk ${chunkToProcessIndex + 1} Generated!`,
        description: `Audio for chunk ${chunkToProcessIndex + 1} of ${storyData.narrationChunks.length} is ready.`,
        className: 'bg-primary text-primary-foreground'
      });
      
      if (typeof specificChunkIndexToProcess === 'number') {
        // Single chunk processed.
        setCurrentNarrationChunkIndex(-1); // Reset index, indicating no specific chunk is "active" for sequence.
        setProcessingAllMode(false); // Ensure "all" mode is off.
        handleSetLoading('narration', false);
      } else { // This was part of a "Generate All" sequence (processingAllMode should be true)
        console.log('[useNarrationGeneration] Chunk completed, looking for next unprocessed chunk after index:', chunkToProcessIndex);
        const nextUnprocessed = updatedChunks.findIndex((c, idx) => idx > chunkToProcessIndex && !c.audioUrl);
        console.log('[useNarrationGeneration] Next unprocessed chunk index:', nextUnprocessed);
        
        if (nextUnprocessed !== -1) {
          // Reset loading state first, then set next chunk index so useEffect can proceed
          handleSetLoading('narration', false);
          console.log('[useNarrationGeneration] Setting currentNarrationChunkIndex to:', nextUnprocessed);
          setCurrentNarrationChunkIndex(nextUnprocessed); // useEffect will pick this up
        } else { // No more unprocessed chunks after the current one in the sequence
          console.log('[useNarrationGeneration] All chunks completed, finishing sequence');
          setCurrentNarrationChunkIndex(-1);
          setProcessingAllMode(false); // Sequence finished
          handleSetLoading('narration', false);
          if (updatedChunks.every(c => c.audioUrl)) {
             setCurrentStep(4);
             toast({ title: 'All Narration Generated!', description: 'Audio for all chunks is ready.', className: 'bg-primary text-primary-foreground' });
          }
        }
      }
    } else { // Audio generation for current chunk failed
      toast({
        title: 'Chunk Narration Error',
        description: result.error || `Failed to generate audio for chunk ${chunkToProcessIndex + 1}.`,
        variant: 'destructive'
      });
      setCurrentNarrationChunkIndex(-1);
      setProcessingAllMode(false); // Stop "all" mode on error
      handleSetLoading('narration', false);
    }
  }, [
    narrationSource,
    storyData.generatedScript,
    storyData.narrationChunks,
    storyData.elevenLabsVoiceId,
    storyData.userId,
    storyData.id,
    selectedVoiceId,
    selectedTtsModel,
    selectedGoogleVoiceId,
    selectedGoogleApiModel,
    selectedGoogleLanguage,
    currentNarrationChunkIndex,
    processingAllMode,
    toast,
    updateStoryData,
    handleSetLoading,
    setCurrentNarrationChunkIndex,
    setProcessingAllMode,
    setCurrentStep
  ]);

  // Auto-continue generation when in processingAllMode and currentNarrationChunkIndex changes
  useEffect(() => {
    console.log('[useNarrationGeneration] useEffect triggered:', {
      processingAllMode,
      currentNarrationChunkIndex,
      isLoadingNarration: isLoading.narration
    });
    
    if (processingAllMode && currentNarrationChunkIndex >= 0 && !isLoading.narration) {
      console.log('[useNarrationGeneration] Scheduling next chunk generation for index:', currentNarrationChunkIndex);
      // Small delay to prevent infinite loops and allow state to settle
      const timer = setTimeout(() => {
        console.log('[useNarrationGeneration] Triggering handleGenerateNarration for chunk:', currentNarrationChunkIndex);
        handleGenerateNarration();
      }, 100); // Reduced back to 100ms since we fixed the loading state
      
      return () => {
        console.log('[useNarrationGeneration] Clearing timer for chunk:', currentNarrationChunkIndex);
        clearTimeout(timer);
      };
    }
  }, [processingAllMode, currentNarrationChunkIndex, isLoading.narration]);

  const handleRegenerateChunks = async () => {
    if (!storyData.generatedScript) {
      toast({ title: 'No Script Available', description: 'Generate a script first.', variant: 'destructive' });
      return;
    }

    toast({ 
      title: 'Regenerating Chunks...', 
      description: 'AI is re-splitting the script with improved visual scene logic. All voice generations will be reset.', 
      className: 'bg-primary text-primary-foreground' 
    });
    
    handleSetLoading('scriptChunksUpdate', true);
    
    try {
      const newNarrationChunks = await prepareScriptChunksAI(storyData.generatedScript);
      
      // Clear any existing audio URLs since chunks are changing
      const chunksWithoutAudio = newNarrationChunks.map(chunk => ({
        ...chunk,
        audioUrl: undefined,
        duration: undefined
      }));
      
      updateStoryData({ narrationChunks: chunksWithoutAudio });
      handleSetLoading('scriptChunksUpdate', false);
      
      if (newNarrationChunks.length > 0) {
        toast({ 
          title: 'Chunks Regenerated!', 
          description: `AI created ${newNarrationChunks.length} new visual scene-based chunks. Previous voice generations have been cleared.`, 
          className: 'bg-primary text-primary-foreground' 
        });
      } else {
        toast({ title: 'No Chunks Generated', description: 'AI could not split the script into chunks.', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error regenerating chunks:', error);
      toast({ title: 'Error', description: 'Failed to regenerate chunks. Please try again.', variant: 'destructive' });
      handleSetLoading('scriptChunksUpdate', false);
    }
  };

  return {
    handleGenerateNarration,
    handleRegenerateChunks
  };
};
