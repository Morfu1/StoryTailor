import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { ConvertibleAudioPlayer } from '@/components/ConvertibleAudioPlayer';

import { Languages, Loader2, RefreshCw, Mic, Edit, Save, X } from 'lucide-react';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { generateRomanianTranslation } from '@/actions/storyActions';
import { generateNarrationAudio } from '@/actions/storyActions';
import { saveStory } from '@/actions/baserowStoryActions';
import { debounce, type DebouncedFunction } from '@/utils/debounce';
import type { UseStoryStateReturn } from '@/hooks/useStoryState';

interface RomanianNarrationSectionProps {
  storyState: UseStoryStateReturn;
}

interface RomanianChunk {
  id: string;
  text: string;
  audioUrl?: string;
  duration?: number;
  index: number;
}

export function RomanianNarrationSection({ storyState }: RomanianNarrationSectionProps) {
  const { toast } = useToast();
  const {
    storyData,
    setStoryData,
    userApiKeys,
    aiProvider,
    googleScriptModel,
    perplexityModel,
    selectedTtsModel,
    selectedVoiceId,
    selectedGoogleApiModel,
    handleSetLoading
  } = storyState;

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState<{ [key: string]: boolean }>({});
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSavedRomanianChunks, setLastSavedRomanianChunks] = useState<RomanianChunk[] | null>(null);

  const debouncedSaveFnRef = useRef<DebouncedFunction<[RomanianChunk[]]> | null>(null);

  const romanianChunks = storyData.romanianNarrationChunks || [];
  const englishChunks = storyData.narrationChunks || [];

  const completedRomanianChunks = romanianChunks.filter(chunk => chunk.audioUrl).length;
  const progressPercentage = romanianChunks.length > 0 ? (completedRomanianChunks / romanianChunks.length) * 100 : 0;

  // Autosave effect for Romanian narration chunks
  useEffect(() => {
    debouncedSaveFnRef.current = debounce(async (chunksToSave: RomanianChunk[]) => {
      if (!storyData.userId || !storyData.id || chunksToSave.length === 0) return;
      
      // Prevent multiple simultaneous saves of the same content
      if (lastSavedRomanianChunks && JSON.stringify(lastSavedRomanianChunks) === JSON.stringify(chunksToSave)) {
        console.log('Skipping Romanian chunks save - content already saved');
        return;
      }
      
      // Prevent save if already saving
      if (isAutoSaving) {
        console.log('Skipping Romanian chunks save - already in progress');
        return;
      }

      setIsAutoSaving(true);
      try {
        const updatedStoryData = {
          ...storyData,
          romanianNarrationChunks: chunksToSave
        };

        const saveResult = await saveStory(updatedStoryData, storyData.userId);
        if (saveResult.success) {
          setLastSavedRomanianChunks([...chunksToSave]);
          toast({
            title: 'Romanian Chunks Saved!',
            description: 'Your Romanian narration changes have been automatically saved.',
            className: 'bg-green-500 text-white'
          });
        } else {
          toast({
            title: 'Error Saving Romanian Chunks',
            description: saveResult.error || 'An unknown error occurred.',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error("Error in Romanian chunks autoSave:", error);
        toast({
          title: 'Error',
          description: 'An unexpected error occurred during Romanian chunks auto-save.',
          variant: 'destructive',
        });
      } finally {
        setIsAutoSaving(false);
      }
    }, 3000); // 3 second debounce time

    return () => {
      if (debouncedSaveFnRef.current) {
        debouncedSaveFnRef.current.cancel();
      }
    };
  }, [storyData, isAutoSaving, lastSavedRomanianChunks, toast]);

  const autoSaveRomanianChunks = useCallback((chunks: RomanianChunk[]) => {
    if (debouncedSaveFnRef.current && chunks.length > 0) {
      debouncedSaveFnRef.current(chunks);
    }
  }, []);

  const handleTranslateToRomanian = async () => {
    if (!englishChunks.length) {
      toast({
        title: 'No English chunks found',
        description: 'Please generate English narration chunks first.',
        variant: 'destructive'
      });
      return;
    }

    setIsTranslating(true);
    handleSetLoading('romanianTranslation', true);

    try {
      const chunksToTranslate = englishChunks.map(chunk => ({
        id: chunk.id,
        text: chunk.text,
        index: chunk.index
      }));

      const result = await generateRomanianTranslation({
        userId: storyData.userId!,
        chunks: chunksToTranslate,
        aiProvider: aiProvider || 'google',
        googleScriptModel,
        perplexityModel
      });

      if (result.success && result.data?.romanianChunks) {
        const newRomanianChunks: RomanianChunk[] = result.data.romanianChunks.map(chunk => ({
          id: chunk.id,
          text: chunk.text,
          index: chunk.index,
          audioUrl: undefined,
          duration: undefined
        }));

        setStoryData({
          ...storyData,
          romanianNarrationChunks: newRomanianChunks
        });

        // Trigger autosave
        autoSaveRomanianChunks(newRomanianChunks);

        toast({
          title: 'Romanian Translation Complete',
          description: `Successfully translated ${newRomanianChunks.length} chunks to Romanian.`,
          className: 'bg-green-500 text-white'
        });
      } else {
        toast({
          title: 'Translation Failed',
          description: result.error || 'Failed to translate chunks to Romanian.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error translating to Romanian:', error);
      toast({
        title: 'Translation Error',
        description: 'An unexpected error occurred during translation.',
        variant: 'destructive'
      });
    } finally {
      setIsTranslating(false);
      handleSetLoading('romanianTranslation', false);
    }
  };

  const handleEditChunk = (index: number, text: string) => {
    setEditingIndex(index);
    setEditText(text);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;

    const updatedChunks = [...romanianChunks];
    updatedChunks[editingIndex] = {
      ...updatedChunks[editingIndex],
      text: editText
    };

    setStoryData({
      ...storyData,
      romanianNarrationChunks: updatedChunks
    });

    // Trigger autosave
    autoSaveRomanianChunks(updatedChunks);

    setEditingIndex(null);
    setEditText('');

    toast({
      title: 'Chunk Updated',
      description: 'Romanian chunk text has been updated.',
      className: 'bg-green-500 text-white'
    });
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditText('');
  };

  const handleGenerateRomanianAudio = async (chunk: RomanianChunk, index: number) => {
    if (!storyData.id || !storyData.userId) {
      toast({
        title: 'Story Not Saved',
        description: 'Please save your story before generating Romanian audio.',
        variant: 'destructive'
      });
      return;
    }

    const chunkKey = `romanian_${chunk.id}`;
    setGeneratingAudio(prev => ({ ...prev, [chunkKey]: true }));

    try {
      const result = await generateNarrationAudio({
        script: chunk.text,
        voiceId: selectedVoiceId,
        ttsModel: selectedTtsModel || 'elevenlabs',
        googleApiModel: selectedGoogleApiModel,
        languageCode: 'ro-RO', // Romanian language code
        userId: storyData.userId,
        storyId: storyData.id,
        chunkId: chunk.id,
        isRomanian: true // Flag for Romanian narration
      });

      if (result.success && result.data?.audioStorageUrl) {
        const updatedChunks = [...romanianChunks];
        updatedChunks[index] = {
          ...updatedChunks[index],
          audioUrl: result.data.audioStorageUrl,
          duration: result.data.duration
        };

        setStoryData({
          ...storyData,
          romanianNarrationChunks: updatedChunks
        });

        // Trigger autosave
        autoSaveRomanianChunks(updatedChunks);

        toast({
          title: 'Romanian Audio Generated',
          description: `Generated Romanian audio for chunk ${index + 1}.`,
          className: 'bg-green-500 text-white'
        });
      } else {
        toast({
          title: 'Audio Generation Failed',
          description: result.error || 'Failed to generate Romanian audio.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error generating Romanian audio:', error);
      toast({
        title: 'Audio Generation Error',
        description: 'An unexpected error occurred during Romanian audio generation.',
        variant: 'destructive'
      });
    } finally {
      setGeneratingAudio(prev => ({ ...prev, [chunkKey]: false }));
    }
  };

  const handleGenerateAllRomanianAudio = async () => {
    if (!storyData.id || !storyData.userId) {
      toast({
        title: 'Story Not Saved',
        description: 'Please save your story before generating Romanian audio.',
        variant: 'destructive'
      });
      return;
    }

    for (let i = 0; i < romanianChunks.length; i++) {
      const chunk = romanianChunks[i];
      if (!chunk.audioUrl) {
        await handleGenerateRomanianAudio(chunk, i);
      }
    }
  };

  const canTranslate = !isTranslating && englishChunks.length > 0 && 
    ((aiProvider === 'google' && userApiKeys?.googleApiKey) || 
     (aiProvider === 'perplexity' && userApiKeys?.perplexityApiKey));

  const canGenerateAudio = !isTranslating && 
    ((selectedTtsModel === 'elevenlabs' && userApiKeys?.elevenLabsApiKey) || 
     (selectedTtsModel === 'google' && userApiKeys?.googleApiKey));

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Languages className="h-5 w-5" />
          Romanian Translation & Narration
          {isAutoSaving && (
            <div className="flex items-center gap-1 ml-auto">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-xs text-muted-foreground">Auto-saving...</span>
            </div>
          )}
        </CardTitle>
        <CardDescription>
          Generate Romanian translations of your story chunks and create Romanian audio narration.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {romanianChunks.length === 0 ? (
          <div className="text-center py-6">
            <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
              <h4 className="text-sm font-medium text-blue-800">Generate Romanian Translation</h4>
              <p className="text-xs text-blue-700 mt-1">
                Translate your English narration chunks to Romanian for bilingual storytelling.
              </p>
            </div>
            <Button 
              onClick={handleTranslateToRomanian}
              disabled={!canTranslate}
              className="w-full"
            >
              {isTranslating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Translating to Romanian...
                </>
              ) : (
                <>
                  <Languages className="mr-2 h-4 w-4" />
                  Generate Romanian Translation
                </>
              )}
            </Button>
            {!canTranslate && (
              <p className="text-xs text-destructive mt-2">
                API key required for translation. Please configure in Account Settings.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                Romanian Audio Progress ({completedRomanianChunks}/{romanianChunks.length} chunks completed)
              </Label>
              <span className="text-sm text-muted-foreground">
                {Math.round(progressPercentage)}%
              </span>
            </div>
            <Progress value={progressPercentage} className="w-full" />

            <div className="flex gap-2">
              <Button 
                onClick={handleTranslateToRomanian}
                disabled={!canTranslate}
                variant="outline"
                size="sm"
              >
                {isTranslating ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Retranslating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-3 w-3" />
                    Retranslate
                  </>
                )}
              </Button>
              
              <Button 
                onClick={handleGenerateAllRomanianAudio}
                disabled={!canGenerateAudio}
                className="flex-1"
              >
                <Mic className="mr-2 h-4 w-4" />
                Generate All Romanian Audio
              </Button>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Romanian Chunks</Label>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {romanianChunks.map((chunk, index) => (
                  <Card key={chunk.id} className="p-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                          Romanian Chunk {index + 1}
                        </span>
                        <div className="flex items-center gap-1">
                          {editingIndex === index ? (
                            <>
                              <Button
                                onClick={handleSaveEdit}
                                size="sm"
                                variant="outline"
                              >
                                <Save className="h-3 w-3" />
                              </Button>
                              <Button
                                onClick={handleCancelEdit}
                                size="sm"
                                variant="outline"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              onClick={() => handleEditChunk(index, chunk.text)}
                              size="sm"
                              variant="outline"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {editingIndex === index ? (
                        <Textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="min-h-[60px]"
                          placeholder="Edit Romanian text..."
                        />
                      ) : (
                        <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                          {chunk.text}
                        </p>
                      )}

                      <div className="flex items-center justify-between">
                        {chunk.audioUrl ? (
                          <div className="flex-1">
                            <ConvertibleAudioPlayer
                              src={chunk.audioUrl}
                              className="w-full"
                              chunkId={`ro_chunk_${chunk.id}`}
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">No audio generated</span>
                        )}
                        
                        <Button
                          onClick={() => handleGenerateRomanianAudio(chunk, index)}
                          disabled={!canGenerateAudio || generatingAudio[`romanian_${chunk.id}`]}
                          size="sm"
                          variant={chunk.audioUrl ? "outline" : "default"}
                        >
                          {generatingAudio[`romanian_${chunk.id}`] ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Mic className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}

        {!canGenerateAudio && romanianChunks.length > 0 && (
          <p className="text-xs text-destructive text-center">
            Audio generation API key required. Please configure in Account Settings.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
