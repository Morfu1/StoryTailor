import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Upload } from 'lucide-react';
import { googleTtsVoices, googleTtsApiModels, googleTtsLanguages } from '@/constants/voices';
import { generateNarrationAudio } from '@/actions/storyActions';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';
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
    setSelectedTtsModel,
    selectedGoogleApiModel,
    setSelectedGoogleApiModel,
    selectedGoogleLanguage,
    setSelectedGoogleLanguage,
    selectedGoogleVoiceId,
    setSelectedGoogleVoiceId,
    selectedVoiceId,
    setSelectedVoiceId,
    elevenLabsVoices,
    setElevenLabsVoices,
    uploadedAudioFileName,
    setUploadedAudioFileName,
    isLoading,
    handleSetLoading,
    storyData
  } = storyState;

  // Effect to load ElevenLabs voices when the model is selected and voices aren't loaded
  useEffect(() => {
    if (narrationSource === 'generate' && selectedTtsModel === 'elevenlabs' && elevenLabsVoices.length === 0 && !isLoading.voices) {
      handleSetLoading('voices', true);
      console.log("[useEffect] Attempting to load ElevenLabs voices...");
      generateNarrationAudio({ script: "placeholder_for_voice_listing", ttsModel: 'elevenlabs' })
        .then(response => {
          if (response.success && response.data?.voices) {
            setElevenLabsVoices(response.data.voices);
            console.log(`[useEffect] Loaded ${response.data.voices.length} ElevenLabs voices.`);
            if (storyData.elevenLabsVoiceId && response.data.voices.some(v => v.voice_id === storyData.elevenLabsVoiceId)) {
              setSelectedVoiceId(storyData.elevenLabsVoiceId);
            }
          } else {
            console.error("[useEffect] Error loading ElevenLabs voices:", response.error);
            toast({ title: "Error Loading ElevenLabs Voices", description: response.error || "Could not fetch voices.", variant: "destructive" });
          }
        })
        .catch(error => {
          console.error("[useEffect] Exception loading ElevenLabs voices:", error);
          toast({ title: "Error Loading ElevenLabs Voices", description: "Network error while fetching voices.", variant: "destructive" });
        })
        .finally(() => {
          handleSetLoading('voices', false);
        });
    }
  }, [narrationSource, selectedTtsModel, elevenLabsVoices.length, isLoading.voices, storyData.elevenLabsVoiceId, toast, handleSetLoading, setElevenLabsVoices, setSelectedVoiceId]);

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
                onValueChange={(value: 'elevenlabs' | 'google') => setSelectedTtsModel(value)}
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
                  <Select value={selectedVoiceId} onValueChange={setSelectedVoiceId}>
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
                )}
              </div>
            )}

            {selectedTtsModel === 'google' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Google API Model</Label>
                  <Select value={selectedGoogleApiModel} onValueChange={setSelectedGoogleApiModel}>
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
                  <Select value={selectedGoogleVoiceId} onValueChange={setSelectedGoogleVoiceId}>
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
