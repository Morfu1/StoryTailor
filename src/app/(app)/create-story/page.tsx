"use client";

import type { Story, GeneratedImage, StoryCharacterLocationItemPrompts, ElevenLabsVoice } from '@/types/story';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateTitle, generateScript, generateCharacterPrompts, generateNarrationAudio, generateImagePrompts, saveStory, getStory, generateImageFromPrompt } from '@/actions/storyActions';
import { Bot, Clapperboard, ImageIcon, Loader2, Mic, Save, Sparkles, FileText, Image as LucideImage, AlertCircle, CheckCircle, Info, Pencil, ListMusic, Upload, Film } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';

const initialStoryState: Story = {
  userId: '',
  title: '',
  userPrompt: '',
  generatedScript: undefined,
  detailsPrompts: undefined,
  narrationAudioUrl: undefined,
  narrationAudioDurationSeconds: undefined,
  elevenLabsVoiceId: undefined,
  imagePrompts: [],
  generatedImages: [],
};

export default function CreateStoryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const storyId = searchParams.get('storyId');
  const { toast } = useToast();

  const [storyData, setStoryData] = useState<Story>(initialStoryState);
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const [currentStep, setCurrentStep] = useState(1);
  const [pageLoading, setPageLoading] = useState(true);
  const [imagesPerMinute, setImagesPerMinute] = useState(5);
  const [isSaveConfirmOpen, setIsSaveConfirmOpen] = useState(false);
  const [elevenLabsVoices, setElevenLabsVoices] = useState<ElevenLabsVoice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | undefined>(undefined);
  const [narrationSource, setNarrationSource] = useState<'generate' | 'upload'>('generate');
  const [uploadedAudioFileName, setUploadedAudioFileName] = useState<string | null>(null);


  const updateStoryData = (updates: Partial<Story>) => {
    setStoryData(prev => ({ ...prev, ...updates }));
  };

  const handleSetLoading = (key: string, value: boolean) => {
    setIsLoading(prev => ({ ...prev, [key]: value }));
  };

    // Helper function to estimate duration from MP3 data URI (client-side)
    const getMp3DurationFromDataUriClient = (dataUri: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        if (!dataUri.startsWith('data:audio/mpeg;base64,')) {
        console.warn('Cannot estimate duration: Not an MP3 data URI.');
        resolve(30); // Default duration
        return;
        }
        const audio = document.createElement('audio');
        audio.src = dataUri;
        audio.onloadedmetadata = () => {
        if (audio.duration === Infinity || !audio.duration) {
            // Fallback for browsers that struggle with data URI duration
            const base64Data = dataUri.substring('data:audio/mpeg;base64,'.length);
            const kbytes = Math.ceil(((base64Data.length / 4) * 3) / 1024); // Estimate kbytes
            const estimatedDuration = Math.max(1, Math.floor(kbytes / 16)); // Approx 128kbps
            console.warn(`Could not get precise duration, estimated: ${estimatedDuration}s`);
            resolve(estimatedDuration);
        } else {
            resolve(parseFloat(audio.duration.toFixed(2)));
        }
        };
        audio.onerror = (e) => {
            console.error('Error loading audio for duration calculation:', e);
            const base64Data = dataUri.substring('data:audio/mpeg;base64,'.length);
            const kbytes = Math.ceil(((base64Data.length / 4) * 3) / 1024);
            const estimatedDuration = Math.max(1, Math.floor(kbytes / 16));
            resolve(estimatedDuration); 
        };
    });
    };


  useEffect(() => {
    if (authLoading) return; 
    if (!user) {
        router.replace('/login');
        return;
    }

    if (user.uid && !storyData.userId) {
      updateStoryData({ userId: user.uid }); 
    }

    if (storyId && user) {
      setPageLoading(true); 
      getStory(storyId, user.uid)
        .then(response => {
          if (response.success && response.data) {
            const loadedStory = response.data;
             if (loadedStory.createdAt && !(loadedStory.createdAt instanceof Date)) {
                loadedStory.createdAt = (loadedStory.createdAt as any).toDate();
            }
            if (loadedStory.updatedAt && !(loadedStory.updatedAt instanceof Date)) {
                loadedStory.updatedAt = (loadedStory.updatedAt as any).toDate();
            }
            setStoryData(loadedStory);
            if (loadedStory.elevenLabsVoiceId) {
              setSelectedVoiceId(loadedStory.elevenLabsVoiceId);
              setNarrationSource('generate'); // Assume generated if voiceId is present
            } else if (loadedStory.narrationAudioUrl) {
              // If URL exists but no voice ID, assume it was uploaded
              setNarrationSource('upload');
              // Potentially try to derive filename if stored, or use a generic placeholder
              setUploadedAudioFileName("Previously uploaded audio");
            }
            
            if (loadedStory.generatedImages && loadedStory.generatedImages.length > 0 && loadedStory.imagePrompts && loadedStory.generatedImages.length === loadedStory.imagePrompts.length && loadedStory.generatedImages.every(img => img !== null)) setCurrentStep(6);
            else if (loadedStory.imagePrompts && loadedStory.imagePrompts.length > 0) setCurrentStep(5);
            else if (loadedStory.narrationAudioUrl) setCurrentStep(4);
            else if (loadedStory.detailsPrompts && (loadedStory.detailsPrompts.characterPrompts || loadedStory.detailsPrompts.itemPrompts || loadedStory.detailsPrompts.locationPrompts)) setCurrentStep(3);
            else if (loadedStory.generatedScript) setCurrentStep(2);
            else setCurrentStep(1);
          } else {
            toast({ title: 'Error Loading Story', description: response.error || 'Failed to load story. Creating a new one.', variant: 'destructive' });
             setStoryData({...initialStoryState, userId: user.uid}); 
             setCurrentStep(1);
          }
        })
        .finally(() => setPageLoading(false)); 
    } else {
       setPageLoading(false); 
       if(user?.uid) { 
        setStoryData(prev => ({...prev, userId: user.uid}));
       }
    }
  }, [storyId, user, router, toast, authLoading]);


  const handleGenerateScript = async () => {
    if (!storyData.userPrompt.trim()) {
      toast({ title: 'Missing Prompt', description: 'Please enter a story prompt.', variant: 'destructive' });
      return;
    }
    
    handleSetLoading('script', true);

    let currentTitle = storyData.title;
    if (!currentTitle.trim() && storyData.userPrompt.trim()) {
        handleSetLoading('titleGen', true);
        const titleResult = await generateTitle({ userPrompt: storyData.userPrompt });
        handleSetLoading('titleGen', false);
        if (titleResult.success && titleResult.data?.title) {
            currentTitle = titleResult.data.title;
            updateStoryData({ title: currentTitle });
            toast({ title: 'Title Generated!', description: 'A title for your story has been created.', className: 'bg-primary text-primary-foreground' });
        } else {
            toast({ title: 'Title Generation Failed', description: titleResult.error || 'Could not generate a title. Please enter one manually.', variant: 'default' });
            const promptSegment = storyData.userPrompt.trim().substring(0, 30);
            currentTitle = promptSegment.length > 0 ? 
                            (promptSegment.length < storyData.userPrompt.trim().length ? `${promptSegment}... (Draft)` : `${promptSegment} (Draft)`)
                            : `Untitled Story - ${new Date().toLocaleTimeString()}`;
            updateStoryData({ title: currentTitle });
        }
    }
    
    const scriptResult = await generateScript({ prompt: storyData.userPrompt });
    if (scriptResult.success && scriptResult.data) {
      updateStoryData({ generatedScript: scriptResult.data.script });
      setCurrentStep(2);
      toast({ title: 'Script Generated!', description: 'Your story script is ready.', className: 'bg-primary text-primary-foreground' });
    } else {
      toast({ title: 'Error', description: scriptResult.error || 'Failed to generate script.', variant: 'destructive' });
    }
    handleSetLoading('script', false);
  };

  const handleGenerateDetails = async () => {
    if (!storyData.generatedScript) return;
    handleSetLoading('details', true);
    const result = await generateCharacterPrompts({ script: storyData.generatedScript });
    if (result.success && result.data) {
      updateStoryData({ detailsPrompts: result.data as StoryCharacterLocationItemPrompts });
      setCurrentStep(3);
      toast({ title: 'Details Generated!', description: 'Character, item, and location prompts are ready.', className: 'bg-primary text-primary-foreground' });
    } else {
      toast({ title: 'Error', description: result.error || 'Failed to generate details.', variant: 'destructive' });
    }
    handleSetLoading('details', false);
  };

  const handleGenerateNarration = async () => {
    if (!storyData.generatedScript || narrationSource !== 'generate') return;
    handleSetLoading('narration', true);

    const input = selectedVoiceId
      ? { script: storyData.generatedScript, voiceId: selectedVoiceId }
      : { script: storyData.generatedScript }; // This will fetch voices

    const result = await generateNarrationAudio(input);

    if (result.success && result.data) {
      if (result.data.voices) {
        setElevenLabsVoices(result.data.voices);
        toast({ title: 'Voices Loaded', description: 'Please select a voice to generate narration.', className: 'bg-primary text-primary-foreground' });
      } else if (result.data.audioDataUri) {
        updateStoryData({ 
          narrationAudioUrl: result.data.audioDataUri, 
          narrationAudioDurationSeconds: result.data.duration,
          elevenLabsVoiceId: selectedVoiceId 
        });
        setUploadedAudioFileName(null); // Clear uploaded file if AI generation is used
        setCurrentStep(4);
        toast({ title: 'Narration Generated!', description: 'Audio narration is ready.', className: 'bg-primary text-primary-foreground' });
      }
    } else {
      toast({ title: 'Narration Error', description: result.error || 'Failed to process narration.', variant: 'destructive' });
    }
    handleSetLoading('narration', false);
  };

  const handleAudioFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== "audio/mpeg") {
        toast({ title: "Invalid File Type", description: "Please upload an MP3 audio file.", variant: "destructive" });
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit for data URI handling sanity
        toast({ title: "File Too Large", description: "Please upload an audio file smaller than 10MB.", variant: "destructive" });
        return;
      }
      handleSetLoading('narrationUpload', true);
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUri = e.target?.result as string;
        try {
            const duration = await getMp3DurationFromDataUriClient(dataUri);
            updateStoryData({
            narrationAudioUrl: dataUri,
            narrationAudioDurationSeconds: duration,
            elevenLabsVoiceId: undefined, // Clear selected AI voice
            });
            setUploadedAudioFileName(file.name);
            setCurrentStep(4); // Move to next step as audio is now "ready"
            toast({ title: "Audio Uploaded", description: `${file.name} is ready.`, className: 'bg-primary text-primary-foreground' });
        } catch (error) {
            toast({ title: "Audio Processing Error", description: "Could not process the uploaded audio file.", variant: "destructive" });
        } finally {
            handleSetLoading('narrationUpload', false);
        }
      };
      reader.onerror = () => {
        toast({ title: "File Read Error", description: "Could not read the audio file.", variant: "destructive" });
        handleSetLoading('narrationUpload', false);
      };
      reader.readAsDataURL(file);
    }
  };


  const handleGenerateImagePrompts = async () => {
    if (!storyData.generatedScript || !storyData.detailsPrompts || !storyData.narrationAudioDurationSeconds) return;
    handleSetLoading('imagePrompts', true);
    const result = await generateImagePrompts({
      script: storyData.generatedScript,
      characterPrompts: storyData.detailsPrompts.characterPrompts || '',
      locationPrompts: storyData.detailsPrompts.locationPrompts || '',
      itemPrompts: storyData.detailsPrompts.itemPrompts || '',
      audioDurationSeconds: storyData.narrationAudioDurationSeconds,
      imagesPerMinute: imagesPerMinute,
    });
    if (result.success && result.data) {
      updateStoryData({ imagePrompts: result.data.imagePrompts });
      setCurrentStep(5);
      toast({ title: 'Image Prompts Generated!', description: 'Prompts for your animation visuals are ready.', className: 'bg-primary text-primary-foreground' });
    } else {
      toast({ title: 'Error', description: result.error || 'Failed to generate image prompts.', variant: 'destructive' });
    }
    handleSetLoading('imagePrompts', false);
  };

  const handleGenerateSingleImage = async (prompt: string, index: number) => {
    handleSetLoading(`image-${index}`, true);
    const result = await generateImageFromPrompt(prompt);
    if (result.success && result.imageUrl) {
      const newImage: GeneratedImage = { prompt, imageUrl: result.imageUrl, dataAiHint: result.dataAiHint };
      const currentGeneratedImages = Array.isArray(storyData.generatedImages) ? storyData.generatedImages : [];
      
      let updatedImages = [...currentGeneratedImages];
      const existingImageIndexForPrompt = updatedImages.findIndex(img => img.prompt === prompt);
      
      if (existingImageIndexForPrompt > -1) {
        updatedImages[existingImageIndexForPrompt] = newImage;
      } else {
         const newImagesArray = Array(storyData.imagePrompts?.length || 0).fill(null);
         currentGeneratedImages.forEach((img) => {
            if (img) { // Check if img is not null
              const originalPromptIndex = storyData.imagePrompts?.indexOf(img.prompt);
              if(originalPromptIndex !== undefined && originalPromptIndex > -1) {
                  newImagesArray[originalPromptIndex] = img;
              }
            }
         });
         newImagesArray[index] = newImage;
         updatedImages = newImagesArray.filter(Boolean) as GeneratedImage[]; 
      }

      updateStoryData({ generatedImages: updatedImages });
      toast({ title: `Image ${index + 1} Generated!`, description: 'Visual for prompt ready.', className: 'bg-primary text-primary-foreground' });
    } else {
      toast({ title: 'Image Generation Error', description: result.error || `Failed to generate image ${index + 1}.`, variant: 'destructive' });
    }
    handleSetLoading(`image-${index}`, false);
     if (storyData.imagePrompts && storyData.generatedImages?.length === storyData.imagePrompts?.length && storyData.generatedImages.every(img => img !== null)) {
      setCurrentStep(6);
    }
  };

  const handleGenerateAllImages = async () => {
    if (!storyData.imagePrompts || storyData.imagePrompts.length === 0) return;
    handleSetLoading('allImages', true);
    
    const currentGeneratedImages = Array.isArray(storyData.generatedImages) ? storyData.generatedImages : [];
    const imagesToGenerate = storyData.imagePrompts.map((prompt, index) => ({ prompt, index })).filter(
      p => !currentGeneratedImages.some(img => img && img.prompt === p.prompt) // Check if img is not null
    );

    const results = await Promise.all(
      imagesToGenerate.map(async ({prompt, index}) => {
        handleSetLoading(`image-${index}`, true);
        const result = await generateImageFromPrompt(prompt);
        handleSetLoading(`image-${index}`, false);
        if (result.success && result.imageUrl) {
          return { prompt, imageUrl: result.imageUrl, dataAiHint: result.dataAiHint, success: true, index };
        }
        toast({ title: 'Image Generation Error', description: result.error || `Failed for prompt: "${prompt.substring(0,30)}..."`, variant: 'destructive' });
        return { prompt, success: false, index, error: result.error };
      })
    );

    const successfulNewImages = results.filter(r => r.success).map(r => ({prompt: r.prompt, imageUrl: r.imageUrl!, dataAiHint: r.dataAiHint}));
    
    if (successfulNewImages.length > 0) {
      setStoryData(prev => {
        const existingImages = Array.isArray(prev.generatedImages) ? prev.generatedImages.filter(img => img !== null) as GeneratedImage[] : []; // Filter out nulls
        const combined = [...existingImages, ...successfulNewImages];
        const uniqueImagesByPrompt = Array.from(new Map(combined.map(img => [img.prompt, img])).values());
        
        const orderedImages = prev.imagePrompts?.map(p => uniqueImagesByPrompt.find(img => img.prompt === p)).filter(Boolean) as GeneratedImage[] || uniqueImagesByPrompt;
        return { ...prev, generatedImages: orderedImages };
      });
    }
    
    if (successfulNewImages.length === imagesToGenerate.length && imagesToGenerate.length > 0) {
      toast({ title: 'All Remaining Images Generated!', description: 'All visuals are ready for your story.', className: 'bg-primary text-primary-foreground' });
    } else if (successfulNewImages.length > 0) {
      toast({ title: 'Image Generation Partially Completed', description: 'Some images were generated. Check individual prompts for failures.', variant: 'default' });
    } else if (imagesToGenerate.length > 0) { 
       toast({ title: 'Image Generation Failed', description: `Could not generate new images. Errors: ${results.filter(r=>!r.success).map(r => r.error).join(', ')}`, variant: 'destructive' });
    }


    handleSetLoading('allImages', false);
    if (storyData.imagePrompts && storyData.generatedImages?.length === storyData.imagePrompts?.length && storyData.generatedImages.every(img => img !== null)) {
      setCurrentStep(6);
    }
  };


  const handleConfirmSaveStory = async () => {
    if (!user || !user.uid || typeof user.uid !== 'string' || user.uid.trim() === '') {
      toast({ title: 'Authentication Error', description: 'User session is invalid or User ID is missing. Please re-login.', variant: 'destructive' });
      setIsSaveConfirmOpen(false); 
      return;
    }
    if (!storyData.title || !storyData.title.trim()) {
      toast({ title: 'Missing Title', description: 'Please give your story a title.', variant: 'destructive' });
      setIsSaveConfirmOpen(false); 
      return;
    }
    handleSetLoading('save', true);
    
    const storyToSave = { ...storyData };
    if (selectedVoiceId && !storyToSave.elevenLabsVoiceId && narrationSource === 'generate') {
        storyToSave.elevenLabsVoiceId = selectedVoiceId;
    }


    const result = await saveStory(storyToSave, user.uid); 
    if (result.success && result.storyId) {
      const updatedStoryData = { ...storyData, id: result.storyId };
      if (result.data?.narrationAudioUrl && result.data.narrationAudioUrl !== storyData.narrationAudioUrl) {
        updatedStoryData.narrationAudioUrl = result.data.narrationAudioUrl;
      }
       if (selectedVoiceId && narrationSource === 'generate') {
        updatedStoryData.elevenLabsVoiceId = selectedVoiceId;
      }

      setStoryData(updatedStoryData);
      
      toast({ title: 'Story Saved!', description: 'Your masterpiece is safely stored.', className: 'bg-primary text-primary-foreground' });
      if (!storyId && result.storyId) { 
          router.replace(`/create-story?storyId=${result.storyId}`, { scroll: false });
      }
    } else {
      toast({ title: 'Error Saving Story', description: result.error || 'Could not save your story.', variant: 'destructive' });
    }
    handleSetLoading('save', false);
    setIsSaveConfirmOpen(false); 
  };

  const progressPercentage = ((currentStep -1) / 5) * 100; 

  if (pageLoading || authLoading) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="ml-4 text-xl text-foreground">Loading Story Editor...</p>
      </div>
    );
  }

  if(!user && !authLoading){ 
    return <div className="text-center p-8"><p>Redirecting to login...</p></div>
  }

  const allImagesGenerated = storyData.imagePrompts && storyData.imagePrompts.length > 0 && storyData.generatedImages && storyData.generatedImages.length === storyData.imagePrompts.length && storyData.generatedImages.every(img => img !== null);
  const isSaveButtonDisabled = !storyData.title?.trim() || isLoading.save || !user?.uid;

  const narrationButtonText = () => {
    if (isLoading.narration) return "Processing...";
    if (narrationSource === 'generate') {
        if (storyData.narrationAudioUrl && storyData.elevenLabsVoiceId) return "Re-generate Narration";
        if (elevenLabsVoices.length > 0) return "Generate Narration with Selected Voice";
        return "Load Voices & Generate Narration";
    }
    return "Generate Narration (AI)" // Should be disabled if upload is chosen
  };

  const isNarrationButtonDisabled = narrationSource === 'upload' || isLoading.narration || !storyData.generatedScript || (narrationSource === 'generate' && elevenLabsVoices.length > 0 && !selectedVoiceId && !storyData.elevenLabsVoiceId) || isLoading.narrationUpload;


  return (
    <div className="container mx-auto max-w-5xl py-8">
      <Card className="shadow-2xl">
        <CardHeader className="bg-card-foreground/5">
          <CardTitle className="text-3xl font-bold tracking-tight text-primary flex items-center">
             <Sparkles className="w-8 h-8 mr-3 text-accent" />
            {storyData.id ? 'Edit Your Story' : 'Create a New Story'}
          </CardTitle>
          <CardDescription>
            Follow the steps below to bring your animated story to life. Click Save Story anytime to store your progress.
          </CardDescription>
           <div className="mt-4">
            <Label htmlFor="storyTitle" className="text-sm font-medium flex items-center">
                Story Title 
                {isLoading.titleGen && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            </Label>
            <Input
              id="storyTitle"
              placeholder="My Awesome Adventure"
              value={storyData.title}
              onChange={(e) => updateStoryData({ title: e.target.value })}
              className="mt-1 text-lg"
              disabled={isLoading.titleGen}
            />
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <div className="mb-6">
            <Label className="text-sm font-medium">Overall Progress</Label>
            <Progress value={progressPercentage} className="w-full mt-1 h-3" />
            <p className="text-xs text-muted-foreground mt-1">Step {currentStep} of 6</p>
          </div>

          <Accordion type="single" collapsible defaultValue="step-1" value={`step-${currentStep}`} className="w-full" onValueChange={(value) => { if(value) setCurrentStep(parseInt(value.split('-')[1]))}}>
            {/* Step 1: User Prompt */}
            <AccordionItem value="step-1">
              <AccordionTrigger className="text-xl font-semibold hover:no-underline data-[state=open]:text-primary">
                <div className="flex items-center">
                  <Pencil className="w-6 h-6 mr-3" /> Step 1: Craft Your Story Idea
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                <div>
                  <Label htmlFor="userPrompt" className="block text-md font-medium">Your Story Prompt</Label>
                  <Textarea
                    id="userPrompt"
                    placeholder="e.g., A brave little fox explores a magical forest, learns about courage, and meets talking animals..."
                    value={storyData.userPrompt}
                    onChange={(e) => updateStoryData({ userPrompt: e.target.value })}
                    rows={6}
                    className="text-base mt-1"
                  />
                </div>
                {storyData.generatedScript && (
                  <div className="mt-4">
                    <Label htmlFor="generatedScriptDisplayStep1" className="block text-md font-medium">Generated Story Script (Review)</Label>
                    <Textarea
                      id="generatedScriptDisplayStep1"
                      value={storyData.generatedScript}
                      readOnly
                      rows={10}
                      className="text-base mt-1 bg-muted/50"
                    />
                  </div>
                )}
                <Button onClick={handleGenerateScript} disabled={isLoading.script || !storyData.userPrompt.trim()} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  {isLoading.script ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {storyData.generatedScript ? 'Re-generate Script & Title' : 'Generate Script & Title'}
                </Button>
                 {storyData.generatedScript && (
                   <p className="text-sm text-muted-foreground">
                     You can re-generate the script and title if you wish. The updated script will be shown here and in Step 2.
                   </p>
                 )}
              </AccordionContent>
            </AccordionItem>

            {/* Step 2: Generated Script & Details */}
            <AccordionItem value="step-2" disabled={!storyData.generatedScript}>
              <AccordionTrigger className="text-xl font-semibold hover:no-underline data-[state=open]:text-primary">
                <div className="flex items-center">
                  <FileText className="w-6 h-6 mr-3" /> Step 2: Review Script & Generate Details
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                {storyData.generatedScript && (
                  <div>
                    <Label className="block text-md font-medium">Generated Script</Label>
                    <Textarea value={storyData.generatedScript} readOnly rows={10} className="mt-1 bg-muted/50 text-base"/>
                    <Button onClick={handleGenerateDetails} disabled={isLoading.details || !storyData.generatedScript} className="mt-4 bg-accent hover:bg-accent/90 text-accent-foreground">
                      {isLoading.details ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
                      Generate Character, Item & Location Details
                    </Button>
                  </div>
                )}
                 {!storyData.generatedScript && <p className="text-muted-foreground">Please generate a script in Step 1 first.</p>}
              </AccordionContent>
            </AccordionItem>

            {/* Step 3: Narration */}
            <AccordionItem value="step-3" disabled={!(storyData.detailsPrompts && (storyData.detailsPrompts.characterPrompts || storyData.detailsPrompts.itemPrompts || storyData.detailsPrompts.locationPrompts))}>
              <AccordionTrigger className="text-xl font-semibold hover:no-underline data-[state=open]:text-primary">
                <div className="flex items-center">
                 <Mic className="w-6 h-6 mr-3" /> Step 3: Generate or Upload Narration
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                {storyData.detailsPrompts && (storyData.detailsPrompts.characterPrompts || storyData.detailsPrompts.itemPrompts || storyData.detailsPrompts.locationPrompts) ? (
                  <div>
                    <Label className="block text-md font-medium">Character, Item & Location Prompts (Review)</Label>
                     <Accordion type="multiple" className="w-full mt-1 bg-muted/30 rounded-md">
                        <AccordionItem value="chars">
                            <AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">View Character Prompts</AccordionTrigger>
                            <AccordionContent className="px-3 pb-2">
                                <Textarea value={storyData.detailsPrompts.characterPrompts || "No character prompts generated."} readOnly rows={5} className="bg-muted/50 text-xs whitespace-pre-wrap"/>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="items">
                            <AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">View Item Prompts</AccordionTrigger>
                            <AccordionContent className="px-3 pb-2">
                                 <Textarea value={storyData.detailsPrompts.itemPrompts || "No item prompts generated."} readOnly rows={5} className="bg-muted/50 text-xs whitespace-pre-wrap"/>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="locations">
                            <AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">View Location Prompts</AccordionTrigger>
                            <AccordionContent className="px-3 pb-2">
                                 <Textarea value={storyData.detailsPrompts.locationPrompts || "No location prompts generated."} readOnly rows={5} className="bg-muted/50 text-xs whitespace-pre-wrap"/>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>

                    <div className="mt-6">
                        <Label className="block text-md font-medium mb-2">Narration Source</Label>
                        <RadioGroup value={narrationSource} onValueChange={(value) => setNarrationSource(value as 'generate' | 'upload')} className="flex space-x-4">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="generate" id="rGenerate" />
                                <Label htmlFor="rGenerate">Generate with AI (ElevenLabs)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="upload" id="rUpload" />
                                <Label htmlFor="rUpload">Upload my own MP3</Label>
                            </div>
                        </RadioGroup>
                    </div>
                    
                    {narrationSource === 'generate' && (
                      <div className="mt-4 pl-2 border-l-2 border-primary">
                        {elevenLabsVoices.length > 0 && !storyData.elevenLabsVoiceId && ( // Show only if voices loaded AND no voice is selected yet for *current* story
                          <div className="mb-4">
                            <Label htmlFor="elevenLabsVoice" className="block text-md font-medium">Select AI Voice</Label>
                            <Select value={selectedVoiceId} onValueChange={setSelectedVoiceId}>
                              <SelectTrigger className="w-full mt-1">
                                <SelectValue placeholder="Choose a voice..." />
                              </SelectTrigger>
                              <SelectContent>
                                {elevenLabsVoices.map(voice => (
                                  <SelectItem key={voice.voice_id} value={voice.voice_id}>
                                    {voice.name} ({voice.category || 'Standard'})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <Button onClick={handleGenerateNarration} disabled={isNarrationButtonDisabled} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                            {isLoading.narration ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (storyData.narrationAudioUrl && storyData.elevenLabsVoiceId ? <Mic className="mr-2 h-4 w-4" /> : <ListMusic className="mr-2 h-4 w-4" />)}
                            {narrationButtonText()}
                        </Button>
                        {storyData.elevenLabsVoiceId && <p className="text-sm text-muted-foreground mt-1">Using AI voice: {elevenLabsVoices.find(v => v.voice_id === storyData.elevenLabsVoiceId)?.name || storyData.elevenLabsVoiceId}</p>}
                      </div>
                    )}

                    {narrationSource === 'upload' && (
                        <div className="mt-4 pl-2 border-l-2 border-primary">
                            <Label htmlFor="audioUpload" className="block text-md font-medium">Upload MP3 Narration</Label>
                            <Input type="file" id="audioUpload" accept="audio/mpeg" onChange={handleAudioFileUpload} className="mt-1" disabled={isLoading.narrationUpload}/>
                            {isLoading.narrationUpload && <Loader2 className="mt-2 h-4 w-4 animate-spin" />}
                            {uploadedAudioFileName && <p className="text-sm text-muted-foreground mt-1">File: {uploadedAudioFileName}</p>}
                        </div>
                    )}

                    {storyData.narrationAudioUrl && (
                        <div className="mt-6">
                            <Label className="block text-md font-medium">Current Narration Audio</Label>
                             <audio controls src={storyData.narrationAudioUrl} key={storyData.narrationAudioUrl} className="w-full mt-1">Your browser does not support the audio element.</audio>
                             <p className="text-sm text-muted-foreground mt-1">Duration: {storyData.narrationAudioDurationSeconds?.toFixed(2) || 'N/A'} seconds</p>
                        </div>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Please generate character, item, or location details in Step 2 first.</p>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Step 4: Image Prompts */}
            <AccordionItem value="step-4" disabled={!storyData.narrationAudioUrl}>
              <AccordionTrigger className="text-xl font-semibold hover:no-underline data-[state=open]:text-primary">
                <div className="flex items-center">
                  <LucideImage className="w-6 h-6 mr-3" /> Step 4: Generate Image Prompts
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                {storyData.narrationAudioUrl ? (
                  <div>
                    <Label className="block text-md font-medium">Narration Audio (Review)</Label>
                    <audio controls src={storyData.narrationAudioUrl} key={storyData.narrationAudioUrl} className="w-full mt-1">Your browser does not support the audio element.</audio>
                    <p className="text-sm text-muted-foreground mt-1">Duration: {storyData.narrationAudioDurationSeconds?.toFixed(2) || 'N/A'} seconds</p>

                    <div className="mt-4">
                        <Label htmlFor="imagesPerMinute" className="block text-md font-medium">Images per Minute of Audio</Label>
                        <Input
                            type="number"
                            id="imagesPerMinute"
                            value={imagesPerMinute}
                            onChange={(e) => setImagesPerMinute(Math.max(1, parseInt(e.target.value,10) || 1))}
                            min="1"
                            max="20"
                            className="w-32 mt-1"
                        />
                    </div>

                    <Button onClick={handleGenerateImagePrompts} disabled={isLoading.imagePrompts || !storyData.narrationAudioDurationSeconds} className="mt-4 bg-accent hover:bg-accent/90 text-accent-foreground">
                      {isLoading.imagePrompts ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LucideImage className="mr-2 h-4 w-4" />}
                      Generate Image Prompts
                    </Button>
                  </div>
                ): (
                     <p className="text-muted-foreground">Please generate or upload narration audio in Step 3 first.</p>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Step 5: Image Generation */}
            <AccordionItem value="step-5" disabled={!(storyData.imagePrompts && storyData.imagePrompts.length > 0)}>
              <AccordionTrigger className="text-xl font-semibold hover:no-underline data-[state=open]:text-primary">
                <div className="flex items-center">
                  <ImageIcon className="w-6 h-6 mr-3" /> Step 5: Generate Images
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                {(storyData.imagePrompts && storyData.imagePrompts.length > 0) ? (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                        <Label className="block text-md font-medium">Image Prompts ({storyData.imagePrompts.length} total)</Label>
                        <Button 
                            onClick={handleGenerateAllImages} 
                            disabled={isLoading.allImages || allImagesGenerated || storyData.imagePrompts.every((_, idx) => isLoading[`image-${idx}`])} 
                            variant="outline"
                        >
                            {isLoading.allImages ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                            Generate All Remaining Images
                        </Button>
                    </div>
                    <div className="max-h-96 overflow-y-auto space-y-3 pr-2 rounded-md border p-3 bg-muted/20">
                      {storyData.imagePrompts.map((prompt, index) => {
                        const existingImage = storyData.generatedImages?.find(img => img && img.prompt === prompt);
                        return (
                          <div key={index} className="p-3 bg-card rounded-md shadow-sm border">
                            <p className="text-sm text-muted-foreground"><strong>Prompt {index + 1}:</strong> {prompt}</p>
                            {existingImage ? (
                              <div className="mt-2 border rounded-md overflow-hidden w-40 h-40 relative">
                                <Image src={existingImage.imageUrl} alt={`Generated image for prompt ${index + 1}`} layout="fill" objectFit="cover" data-ai-hint={existingImage.dataAiHint || "story scene"} />
                                <CheckCircle className="absolute top-1 right-1 h-5 w-5 text-green-500 bg-white rounded-full p-0.5" />
                              </div>
                            ) : (
                              <Button onClick={() => handleGenerateSingleImage(prompt, index)} size="sm" variant="secondary" className="mt-2" disabled={isLoading[`image-${index}`]}>
                                {isLoading[`image-${index}`] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-2 h-4 w-4" />}
                                Generate Image {index + 1}
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {allImagesGenerated && (
                       <div className="flex items-center p-3 mt-4 text-sm text-green-700 bg-green-100 border border-green-200 rounded-md">
                         <CheckCircle className="h-5 w-5 mr-2 shrink-0" />
                         <span>All images have been generated! Proceed to the next step.</span>
                       </div>
                    )}
                  </div>
                ) : (
                     <p className="text-muted-foreground">Please generate image prompts in Step 4 first.</p>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Step 6: Video Assembly */}
            <AccordionItem value="step-6" disabled={!allImagesGenerated}>
              <AccordionTrigger className="text-xl font-semibold hover:no-underline data-[state=open]:text-primary">
                <div className="flex items-center">
                  <Clapperboard className="w-6 h-6 mr-3" /> Step 6: Assemble & Export Video
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                 {!allImagesGenerated && <p className="text-muted-foreground">Please generate all images in Step 5 first.</p>}
                {allImagesGenerated && storyData.id && (
                  <>
                    <p className="text-muted-foreground">All images are generated. You can now proceed to assemble your video.</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-4">
                      {storyData.generatedImages?.map((img, index) => (
                        img && // Ensure img is not null before rendering
                        <div key={index} className="border rounded-md overflow-hidden aspect-square relative group shadow-md">
                          <Image src={img.imageUrl} alt={`Scene ${index + 1}`} layout="fill" objectFit="cover" data-ai-hint={img.dataAiHint || "animation frame"}/>
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <p className="text-white text-xs p-1 text-center">{img.prompt.substring(0,50)}...</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button asChild className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground" disabled={!allImagesGenerated || !storyData.id}>
                      <Link href={`/assemble-video?storyId=${storyData.id}`}>
                        <Film className="mr-2 h-4 w-4" /> Assemble & Export Video
                      </Link>
                    </Button>
                    <div className="flex items-center p-3 text-sm text-primary bg-primary/10 border border-primary/20 rounded-md mt-2">
                      <Info className="h-5 w-5 mr-2 shrink-0" />
                      <span>Video assembly and MP4 export will be handled on the next page. Some features might be under development.</span>
                    </div>
                  </>
                )}
                 {allImagesGenerated && !storyData.id && (
                    <div className="flex items-center p-3 text-sm text-yellow-700 bg-yellow-100 border border-yellow-200 rounded-md">
                        <AlertCircle className="h-5 w-5 mr-2 shrink-0" />
                        <span>Please save your story first to enable video assembly.</span>
                    </div>
                 )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <Separator className="my-8" />

          <div className="flex justify-end items-center space-x-4">
             {allImagesGenerated && storyData.id && (
                <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Link href={`/assemble-video?storyId=${storyData.id}`}>
                    <Film className="mr-2 h-4 w-4" /> Assemble & Export Video
                  </Link>
                </Button>
              )}
             <AlertDialog open={isSaveConfirmOpen} onOpenChange={setIsSaveConfirmOpen}>
                <AlertDialogTrigger asChild>
                  <Button size="lg" disabled={isSaveButtonDisabled} className="bg-green-600 hover:bg-green-700 text-white">
                    <Save className="mr-2 h-4 w-4" />
                    {isLoading.save ? 'Saving...' : (storyData.id ? 'Update Story' : 'Save New Story')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Save</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to save the current state of your story "{storyData.title || 'Untitled Story'}"?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isLoading.save}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmSaveStory} disabled={isSaveButtonDisabled} className="bg-green-600 hover:bg-green-700">
                       {isLoading.save ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                       Yes, Save Story
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

