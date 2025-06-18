
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Upload } from 'lucide-react';
import { googleTtsVoices, googleTtsApiModels, googleTtsLanguages } from '@/constants/voices';
import { generateNarrationAudio, generateVoicePreview } from '@/actions/storyActions';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState } from 'react';
import { VoicePreviewPlayer } from '@/components/ui/voice-preview-player';
import type { UseStoryStateReturn } from '@/hooks/useStoryState';

interface VoiceSelectorProps {
  storyState: UseStoryStateReturn;
}

export function VoiceSelector({ storyState }: VoiceSelectorProps) {
  const { toast } = useToast();
  const {
    narrationSource,
    setNarrationSource,
    selectedTtsModel,
    setSelectedTtsModelWithPersist,
    selectedGoogleApiModel,
    setSelectedGoogleApiModelWithPersist,
    selectedGoogleLanguage,
    setSelectedGoogleLanguage,
    selectedGoogleVoiceId,
    setSelectedGoogleVoiceIdWithPersist,
    selectedVoiceId,
    setSelectedVoiceId,
    setSelectedVoiceIdWithPersist,
    elevenLabsVoices,
    setElevenLabsVoices,
    uploadedAudioFileName,
    setUploadedAudioFileName,
    isLoading,
    handleSetLoading,
    storyData // Ensure storyData is destructured
  } = storyState;

  // Voice preview state
  const [voicePreviews, setVoicePreviews] = useState<Record<string, string>>({});
  const [loadingPreviews, setLoadingPreviews] = useState<Record<string, boolean>>({});

  // Effect to load ElevenLabs voices when the model is selected and voices aren't loaded
  useEffect(() => {
    console.log('[VoiceSelector useEffect] Running. Dependencies affecting voice loading:', {
      narrationSource,
      selectedTtsModel,
      elevenLabsVoicesLength: elevenLabsVoices.length,
      isLoadingVoices: isLoading.voices,
      storyDataUserId: storyData.userId, // Log the actual value
    });

    if (
      narrationSource === 'generate' &&
      selectedTtsModel === 'elevenlabs' &&
      elevenLabsVoices.length === 0 &&
      !isLoading.voices &&
      storyData.userId && storyData.userId !== '' // More explicit check
    ) {
      handleSetLoading('voices', true);
      console.log(`[VoiceSelector useEffect] Conditions met for ElevenLabs voice loading. Calling generateNarrationAudio. UserID: '${storyData.userId}'`);
      generateNarrationAudio({
        script: "placeholder_for_voice_listing", // Script content doesn't matter for listing voices
        ttsModel: 'elevenlabs',
        userId: storyData.userId, // Pass the valid userId
      })
        .then(response => {
          if (response.success && response.data?.voices) {
            setElevenLabsVoices(response.data.voices);
            console.log(`[VoiceSelector useEffect] Loaded ${response.data.voices.length} ElevenLabs voices.`);
            if (storyData.elevenLabsVoiceId && response.data.voices.some(v => v.voice_id === storyData.elevenLabsVoiceId)) {
              setSelectedVoiceId(storyData.elevenLabsVoiceId);
            }
          } else {
            console.error("[VoiceSelector useEffect] Error loading ElevenLabs voices from action:", response.error);
            toast({ title: "Error Loading ElevenLabs Voices", description: response.error || "Could not fetch voices.", variant: "destructive" });
          }
        })
        .catch(error => {
          console.error("[VoiceSelector useEffect] Exception loading ElevenLabs voices:", error);
          toast({ title: "Error Loading ElevenLabs Voices", description: "Network error while fetching voices.", variant: "destructive" });
        })
        .finally(() => {
          handleSetLoading('voices', false);
        });
    } else {
      console.log('[VoiceSelector useEffect] Conditions NOT met for ElevenLabs voice loading. Skipping API call.');
      if (!(storyData.userId && storyData.userId !== '')) {
        console.log('[VoiceSelector useEffect] Reason: storyData.userId is invalid or empty.');
      }
    }
  }, [narrationSource, selectedTtsModel, elevenLabsVoices.length, isLoading.voices, storyData.userId, toast, handleSetLoading, setElevenLabsVoices, setSelectedVoiceId, storyData.elevenLabsVoiceId]);


  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      toast({ title: 'Invalid File', description: 'Please select an audio file.', variant: 'destructive' });
      return;
    }

    setUploadedAudioFileName(file.name);
    toast({ title: 'Audio Uploaded', description: `File "${file.name}" is ready.`, className: 'bg-primary text-primary-foreground' });
  };

  const handleVoicePreview = async (voiceIdToPreview: string, ttsModelToPreview: 'elevenlabs' | 'google') => {
    if (voicePreviews[voiceIdToPreview]) return; // Don't regenerate if preview exists
    
    // Critical: Ensure userId is available for API key fetching by the action
    if (!storyData.userId) {
        toast({ title: 'User ID Missing', description: 'Cannot generate voice preview without a user ID.', variant: 'destructive' });
        return;
    }

    setLoadingPreviews(prev => ({ ...prev, [voiceIdToPreview]: true }));

    try {
      const result = await generateVoicePreview({
        voiceId: voiceIdToPreview,
        ttsModel: ttsModelToPreview,
        googleApiModel: ttsModelToPreview === 'google' ? selectedGoogleApiModel : undefined,
        languageCode: ttsModelToPreview === 'google' ? selectedGoogleLanguage : undefined,
        userId: storyData.userId, // Pass userId here
      });

      if (result.success && result.audioDataUri) {
        setVoicePreviews(prev => ({ ...prev, [voiceIdToPreview]: result.audioDataUri! }));
      } else {
        toast({
          title: 'Preview Failed',
          description: result.error || 'Failed to generate voice preview.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error generating voice preview:', error);
      toast({
        title: 'Preview Error',
        description: 'An error occurred while generating the voice preview.',
        variant: 'destructive'
      });
    } finally {
      setLoadingPreviews(prev => ({ ...prev, [voiceIdToPreview]: false }));
    }
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="space-y-3">
          <Label className="text-sm font-medium">Narration Source</Label>
          <RadioGroup 
            value={narrationSource} 
            onValueChange={(value: 'generate' | 'upload') => setNarrationSource(value)}
            className="flex flex-col space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="generate" id="generate" />
              <Label htmlFor="generate" className="text-sm">Generate with AI</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="upload" id="upload" />
              <Label htmlFor="upload" className="text-sm">Upload your own audio</Label>
            </div>
          </RadioGroup>
        </div>

        {narrationSource === 'generate' && (
          <div className="space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">TTS Model</Label>
              <RadioGroup 
                value={selectedTtsModel} 
                onValueChange={(value: 'elevenlabs' | 'google') => setSelectedTtsModelWithPersist(value)}
                className="flex flex-col space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="elevenlabs" id="elevenlabs" />
                  <Label htmlFor="elevenlabs" className="text-sm">ElevenLabs (Premium)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="google" id="google" />
                  <Label htmlFor="google" className="text-sm">Google TTS (Standard)</Label>
                </div>
              </RadioGroup>
            </div>

            {selectedTtsModel === 'elevenlabs' && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">ElevenLabs Voice</Label>
                {isLoading.voices ? (
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading voices...</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Select value={selectedVoiceId} onValueChange={setSelectedVoiceIdWithPersist}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a voice" />
                      </SelectTrigger>
                      <SelectContent>
                        {elevenLabsVoices.map((voice) => (
                          <SelectItem key={voice.voice_id} value={voice.voice_id}>
                            {voice.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {elevenLabsVoices.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Voice Previews</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                          {elevenLabsVoices.map((voice) => (
                            <div key={voice.voice_id} className="flex items-center justify-between p-2 border rounded-md bg-muted/50">
                              <span className="text-sm font-medium truncate flex-1 mr-2">{voice.name}</span>
                              <VoicePreviewPlayer
                                audioDataUri={voicePreviews[voice.voice_id]}
                                isLoading={loadingPreviews[voice.voice_id]}
                                onPlay={() => handleVoicePreview(voice.voice_id, 'elevenlabs')}
                                size="sm"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {selectedTtsModel === 'google' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Google API Model</Label>
                  <Select value={selectedGoogleApiModel} onValueChange={setSelectedGoogleApiModelWithPersist}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {googleTtsApiModels.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Language</Label>
                  <Select value={selectedGoogleLanguage} onValueChange={setSelectedGoogleLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {googleTtsLanguages.map((lang) => (
                        <SelectItem key={lang.id} value={lang.id}>
                          {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Google Voice</Label>
                  <div className="space-y-3">
                    <Select value={selectedGoogleVoiceId} onValueChange={setSelectedGoogleVoiceIdWithPersist}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {googleTtsVoices.map((voice) => (
                          <SelectItem key={voice.id} value={voice.id}>
                            {voice.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {googleTtsVoices.length > 0 && selectedGoogleApiModel && selectedGoogleLanguage && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Voice Previews</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                          {googleTtsVoices.map((voice) => (
                            <div key={voice.id} className="flex items-center justify-between p-2 border rounded-md bg-muted/50">
                              <span className="text-sm font-medium truncate flex-1 mr-2">{voice.name}</span>
                              <VoicePreviewPlayer
                                audioDataUri={voicePreviews[voice.id]}
                                isLoading={loadingPreviews[voice.id]}
                                onPlay={() => handleVoicePreview(voice.id, 'google')}
                                size="sm"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {narrationSource === 'upload' && (
          <div className="space-y-2">
            <Label htmlFor="audio-upload" className="text-sm font-medium">Upload Audio File</Label>
            <div className="flex items-center gap-2">
              <Button variant="outline" asChild className="cursor-pointer">
                <label htmlFor="audio-upload">
                  <Upload className="mr-2 h-4 w-4" />
                  Choose File
                </label>
              </Button>
              <input
                id="audio-upload"
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              {uploadedAudioFileName && (
                <span className="text-sm text-muted-foreground">{uploadedAudioFileName}</span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

