
"use client";

import type { Story, GeneratedImage, StoryCharacterLocationItemPrompts } from '@/types/story';
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
import { generateTitle, generateScript, generateCharacterPrompts, generateNarrationAudio, generateImagePrompts, saveStory, getStory, generateImageFromPrompt } from '@/actions/storyActions';
import { Bot, Clapperboard, ImageIcon, Loader2, Mic, Save, Sparkles, FileText, Image as LucideImage, AlertCircle, CheckCircle, Info, Pencil } from 'lucide-react';
import Image from 'next/image';
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


  const updateStoryData = (updates: Partial<Story>) => {
    setStoryData(prev => ({ ...prev, ...updates }));
  };

  const handleSetLoading = (key: string, value: boolean) => {
    setIsLoading(prev => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    if (authLoading) return; 
    if (!user) {
        router.replace('/login');
        return;
    }

    updateStoryData({ userId: user.uid }); 

    if (storyId && user) {
      handleSetLoading('page', true);
      getStory(storyId, user.uid)
        .then(response => {
          if (response.success && response.data) {
            setStoryData(response.data);
            if (response.data.generatedImages && response.data.generatedImages.length > 0 && response.data.imagePrompts && response.data.generatedImages.length === response.data.imagePrompts.length) setCurrentStep(6);
            else if (response.data.imagePrompts && response.data.imagePrompts.length > 0) setCurrentStep(5);
            else if (response.data.narrationAudioUrl) setCurrentStep(4);
            else if (response.data.detailsPrompts) setCurrentStep(3);
            else if (response.data.generatedScript) setCurrentStep(2);
            else setCurrentStep(1);
          } else {
            toast({ title: 'Error', description: response.error || 'Failed to load story.', variant: 'destructive' });
            router.push('/dashboard'); 
          }
        })
        .finally(() => handleSetLoading('page', false));
    } else {
       handleSetLoading('page', false); 
    }
    setPageLoading(false);
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
            // Fallback to a simple title if AI fails
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
    if (!storyData.generatedScript) return;
    handleSetLoading('narration', true);
    const result = await generateNarrationAudio({ script: storyData.generatedScript });
    if (result.success && result.data) {
      updateStoryData({ narrationAudioUrl: result.data.audioDataUri, narrationAudioDurationSeconds: result.data.duration });
      setCurrentStep(4);
      toast({ title: 'Narration Generated!', description: 'Audio narration is ready.', className: 'bg-primary text-primary-foreground' });
    } else {
      toast({ title: 'Error', description: result.error || 'Failed to generate narration.', variant: 'destructive' });
    }
    handleSetLoading('narration', false);
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
      const updatedImages = [...(storyData.generatedImages || [])];
      const existingImageIndex = updatedImages.findIndex(img => img.prompt === prompt);
      if (existingImageIndex > -1) {
        updatedImages[existingImageIndex] = newImage;
      } else {
        updatedImages.push(newImage);
      }
      updateStoryData({ generatedImages: updatedImages });
      toast({ title: `Image ${index + 1} Generated!`, description: 'Visual for prompt ready.', className: 'bg-primary text-primary-foreground' });
    } else {
      toast({ title: 'Image Generation Error', description: result.error || `Failed to generate image ${index + 1}.`, variant: 'destructive' });
    }
    handleSetLoading(`image-${index}`, false);
     if (storyData.imagePrompts && storyData.generatedImages?.length === storyData.imagePrompts?.length) {
      setCurrentStep(6);
    }
  };

  const handleGenerateAllImages = async () => {
    if (!storyData.imagePrompts || storyData.imagePrompts.length === 0) return;
    handleSetLoading('allImages', true);
    const newGeneratedImages: GeneratedImage[] = []; 
    let allSucceeded = true;
    
    const existingPrompts = new Set(storyData.generatedImages?.map(img => img.prompt) || []);

    for (let i = 0; i < storyData.imagePrompts.length; i++) {
      const prompt = storyData.imagePrompts[i];
      if (existingPrompts.has(prompt)) {
        const existingImage = storyData.generatedImages?.find(img => img.prompt === prompt);
        if(existingImage) newGeneratedImages.push(existingImage);
        continue;
      }

      handleSetLoading(`image-${i}`, true); 
      const result = await generateImageFromPrompt(prompt);
      if (result.success && result.imageUrl) {
        newGeneratedImages.push({ prompt, imageUrl: result.imageUrl, dataAiHint: result.dataAiHint });
      } else {
        allSucceeded = false;
        toast({ title: 'Image Generation Error', description: result.error || `Failed for prompt: "${prompt.substring(0,30)}..."`, variant: 'destructive' });
      }
      handleSetLoading(`image-${i}`, false);
      setStoryData(prev => {
        const combined = [...(prev.generatedImages || []), ...newGeneratedImages];
        const uniqueImages = Array.from(new Map(combined.map(img => [img.prompt, img])).values());
        return { ...prev, generatedImages: uniqueImages };
      });
    }

    if (allSucceeded) {
      toast({ title: 'All Images Generated!', description: 'All visuals are ready for your story.', className: 'bg-primary text-primary-foreground' });
    } else {
      toast({ title: 'Image Generation Partially Failed', description: 'Some images could not be generated. Check individual prompts.', variant: 'default' });
    }
    handleSetLoading('allImages', false);
    setCurrentStep(6);
  };


  const handleConfirmSaveStory = async () => {
    if (!user) {
      toast({ title: 'Authentication Error', description: 'You must be logged in to save a story.', variant: 'destructive' });
      return;
    }
    if (!storyData.title || !storyData.title.trim()) {
      toast({ title: 'Missing Title', description: 'Please give your story a title.', variant: 'destructive' });
      setIsSaveConfirmOpen(false); 
      return;
    }
    handleSetLoading('save', true);
    const result = await saveStory({ ...storyData, userId: user.uid }, user.uid); 
    if (result.success && result.storyId) {
      updateStoryData({ id: result.storyId });
      toast({ title: 'Story Saved!', description: 'Your masterpiece is safely stored.', className: 'bg-primary text-primary-foreground' });
      if (!storyId) { 
          router.replace(`/create-story?storyId=${result.storyId}`);
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

  const allImagesGenerated = storyData.imagePrompts && storyData.generatedImages && storyData.imagePrompts.length > 0 && storyData.imagePrompts.length === storyData.generatedImages.length;
  const isSaveButtonDisabled = !storyData.title?.trim() || !user || isLoading.save;


  return (
    <div className="container mx-auto max-w-5xl py-8">
      <Card className="shadow-2xl">
        <CardHeader className="bg-card-foreground/5">
          <CardTitle className="text-3xl font-bold tracking-tight text-primary flex items-center">
             <Sparkles className="w-8 h-8 mr-3 text-accent" />
            {storyId ? 'Edit Your Story' : 'Create a New Story'}
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

          <Accordion type="single" collapsible defaultValue="step-1" value={`step-${currentStep}`} className="w-full">
            {/* Step 1: User Prompt */}
            <AccordionItem value="step-1">
              <AccordionTrigger className="text-xl font-semibold hover:no-underline data-[state=open]:text-primary">
                <div className="flex items-center">
                  <Pencil className="w-6 h-6 mr-3" /> Step 1: Craft Your Story Idea
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                <Label htmlFor="userPrompt" className="block text-md font-medium">Your Story Prompt</Label>
                <Textarea
                  id="userPrompt"
                  placeholder="e.g., A brave little fox explores a magical forest, learns about courage, and meets talking animals..."
                  value={storyData.userPrompt}
                  onChange={(e) => updateStoryData({ userPrompt: e.target.value })}
                  rows={6}
                  className="text-base"
                />
                <Button onClick={handleGenerateScript} disabled={isLoading.script || !storyData.userPrompt.trim()} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  {isLoading.script ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {storyData.generatedScript ? 'Re-generate Script & Title' : 'Generate Script & Title'}
                </Button>
              </AccordionContent>
            </AccordionItem>

            {/* Step 2: Generated Script & Details */}
            <AccordionItem value="step-2" disabled={currentStep < 2}>
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
              </AccordionContent>
            </AccordionItem>

            {/* Step 3: Narration */}
            <AccordionItem value="step-3" disabled={currentStep < 3}>
              <AccordionTrigger className="text-xl font-semibold hover:no-underline data-[state=open]:text-primary">
                <div className="flex items-center">
                 <Mic className="w-6 h-6 mr-3" /> Step 3: Generate Narration
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                {storyData.detailsPrompts && (
                  <div>
                    <Label className="block text-md font-medium">Character, Item & Location Prompts</Label>
                     <Accordion type="multiple" className="w-full mt-1 bg-muted/30 rounded-md">
                        <AccordionItem value="chars">
                            <AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">View Character Prompts</AccordionTrigger>
                            <AccordionContent className="px-3 pb-2">
                                <Textarea value={storyData.detailsPrompts.characterPrompts || "No character prompts generated."} readOnly rows={5} className="bg-muted/50 text-xs"/>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="items">
                            <AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">View Item Prompts</AccordionTrigger>
                            <AccordionContent className="px-3 pb-2">
                                 <Textarea value={storyData.detailsPrompts.itemPrompts || "No item prompts generated."} readOnly rows={5} className="bg-muted/50 text-xs"/>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="locations">
                            <AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">View Location Prompts</AccordionTrigger>
                            <AccordionContent className="px-3 pb-2">
                                 <Textarea value={storyData.detailsPrompts.locationPrompts || "No location prompts generated."} readOnly rows={5} className="bg-muted/50 text-xs"/>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>

                     <Button onClick={handleGenerateNarration} disabled={isLoading.narration || !storyData.generatedScript} className="mt-4 bg-accent hover:bg-accent/90 text-accent-foreground">
                      {isLoading.narration ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mic className="mr-2 h-4 w-4" />}
                      Generate Narration Audio
                    </Button>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Step 4: Image Prompts */}
            <AccordionItem value="step-4" disabled={currentStep < 4}>
              <AccordionTrigger className="text-xl font-semibold hover:no-underline data-[state=open]:text-primary">
                <div className="flex items-center">
                  <LucideImage className="w-6 h-6 mr-3" /> Step 4: Generate Image Prompts
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                {storyData.narrationAudioUrl && (
                  <div>
                    <Label className="block text-md font-medium">Narration Audio</Label>
                    <audio controls src={storyData.narrationAudioUrl} className="w-full mt-1">Your browser does not support the audio element.</audio>
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
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Step 5: Image Generation */}
            <AccordionItem value="step-5" disabled={currentStep < 5}>
              <AccordionTrigger className="text-xl font-semibold hover:no-underline data-[state=open]:text-primary">
                <div className="flex items-center">
                  <ImageIcon className="w-6 h-6 mr-3" /> Step 5: Generate Images
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                {storyData.imagePrompts && storyData.imagePrompts.length > 0 && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                        <Label className="block text-md font-medium">Image Prompts ({storyData.imagePrompts.length} total)</Label>
                        <Button 
                            onClick={handleGenerateAllImages} 
                            disabled={isLoading.allImages || storyData.imagePrompts.every((_, idx) => isLoading[`image-${idx}`] || storyData.generatedImages?.some(img => img.prompt === storyData.imagePrompts![idx]))} 
                            variant="outline"
                        >
                            {isLoading.allImages ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                            Generate All Remaining Images
                        </Button>
                    </div>
                    <div className="max-h-96 overflow-y-auto space-y-3 pr-2 rounded-md border p-3 bg-muted/20">
                      {storyData.imagePrompts.map((prompt, index) => {
                        const existingImage = storyData.generatedImages?.find(img => img.prompt === prompt);
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
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Step 6: Video Assembly (Placeholder) */}
            <AccordionItem value="step-6" disabled={currentStep < 6}>
              <AccordionTrigger className="text-xl font-semibold hover:no-underline data-[state=open]:text-primary">
                <div className="flex items-center">
                  <Clapperboard className="w-6 h-6 mr-3" /> Step 6: Assemble & Export Video
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                <p className="text-muted-foreground">Once all images are generated, you can assemble your video.</p>
                 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-4">
                  {storyData.generatedImages?.map((img, index) => (
                    <div key={index} className="border rounded-md overflow-hidden aspect-square relative group shadow-md">
                      <Image src={img.imageUrl} alt={`Scene ${index + 1}`} layout="fill" objectFit="cover" data-ai-hint={img.dataAiHint || "animation frame"}/>
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <p className="text-white text-xs p-1 text-center">{img.prompt.substring(0,50)}...</p>
                      </div>
                    </div>
                  ))}\
                </div>
                <Button disabled className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground opacity-50 cursor-not-allowed" title="Video assembly coming soon!">
                  <Clapperboard className="mr-2 h-4 w-4" /> Assemble Video (Coming Soon)
                </Button>
                 <div className="flex items-center p-3 text-sm text-primary bg-primary/10 border border-primary/20 rounded-md">
                  <Info className="h-5 w-5 mr-2 shrink-0" />
                  <span>Video assembly and MP4 export features are currently under development. Stay tuned!</span>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <Separator className="my-8" />

          <div className="flex justify-end">
             <AlertDialog open={isSaveConfirmOpen} onOpenChange={setIsSaveConfirmOpen}>
                <AlertDialogTrigger asChild>
                  <Button size="lg" disabled={isSaveButtonDisabled} className="bg-green-600 hover:bg-green-700 text-white">
                    <Save className="mr-2 h-4 w-4" />
                    {isLoading.save ? 'Saving...' : (storyId ? 'Save Changes' : 'Save Story')}
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
                    <AlertDialogAction onClick={handleConfirmSaveStory} disabled={isLoading.save || !storyData.title?.trim()} className="bg-green-600 hover:bg-green-700">
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
