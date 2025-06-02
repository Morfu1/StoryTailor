
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePopup } from '@/components/ui/image-popup';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Clapperboard, Loader2, Edit2, ImageIcon, RefreshCw, Download, Settings, ListMusic, ChevronsRight } from 'lucide-react';
import Link from 'next/link';
import { generateImagePrompts, generateImageFromPrompt } from '@/actions/storyActions';
import { saveStory } from '@/actions/firestoreStoryActions';
import { useToast } from '@/hooks/use-toast';
import { countSceneImages } from '@/utils/storyHelpers';
import Image from 'next/image';
import { useState, useRef } from 'react';
import type { UseStoryStateReturn } from '@/hooks/useStoryState';
import type { GeneratedImage, ActionPrompt } from '@/types/story';
import { IMAGE_STYLES, DEFAULT_STYLE_ID, type ImageStyleId } from '@/types/imageStyles';

const HighlightedPrompt = ({ prompt }: { prompt: string | undefined }) => {
  if (!prompt) {
    return <span>No prompt available</span>;
  }
  
  const parts = prompt.split(/(@[\w-]+)/g);
  return (
    <span>
      {parts.map((part, index) => {
        if (part.startsWith('@')) {
          return (
            <span key={index} className="font-semibold text-primary bg-primary/10 px-1 rounded mr-1">
              {part}
            </span>
          );
        }
        return part;
      })}
    </span>
  );
};

interface ImageGenerationStepProps {
  storyState: UseStoryStateReturn;
}

export function ImageGenerationStep({ storyState }: ImageGenerationStepProps) {
  const { toast } = useToast();
  const [popupImage, setPopupImage] = useState<{ src: string; alt: string } | null>(null);
  const [isRegenerateDialogOpen, setIsRegenerateDialogOpen] = useState(false);

  
  const {
    storyData,
    updateStoryData,
    setStoryData,
    isLoading,
    handleSetLoading,
    setCurrentStep,
    isImagePromptEditing,
    setIsImagePromptEditing,
    imageProvider,
    setImageProvider,
    imageGenerationProgress,
    setImageGenerationProgress,
    userApiKeys, 
    apiKeysLoading 
  } = storyState;

  const googleKeyMissing = !apiKeysLoading && !userApiKeys?.googleApiKey;
  const picsartKeyMissing = imageProvider === 'picsart' && !apiKeysLoading && !userApiKeys?.picsartApiKey;
  const geminiKeyMissing = imageProvider === 'gemini' && !apiKeysLoading && !userApiKeys?.geminiApiKey;
  const imagen3KeyMissing = imageProvider === 'imagen3' && !apiKeysLoading && !userApiKeys?.googleApiKey; 

  const handleRegenerateImagePrompts = async () => {
    await generatePromptsWithOptions(true);
    setIsRegenerateDialogOpen(false); 
  };
 
  const generatePromptsWithOptions = async (isRegeneration = false) => {
    if (googleKeyMissing) {
      toast({ title: 'API Key Required', description: 'Please configure your Google API Key in Account Settings for prompt generation.', variant: 'destructive' });
      return;
    }
    if (!storyData.generatedScript || !storyData.detailsPrompts) return;
    handleSetLoading('imagePrompts', true);
    
    const audioDurationSeconds = storyData.narrationAudioDurationSeconds ||
      (storyData.narrationChunks?.reduce((total, chunk) => total + (chunk.duration || 0), 0)) ||
      60; 
    
    const imagePromptsInput = {
      userId: storyData.userId, 
      script: storyData.generatedScript,
      characterPrompts: storyData.detailsPrompts.characterPrompts || '',
      locationPrompts: storyData.detailsPrompts.locationPrompts || '',
      itemPrompts: storyData.detailsPrompts.itemPrompts || '',
      audioDurationSeconds,
      narrationChunks: storyData.narrationChunks?.map(chunk => ({
        text: chunk.text,
        duration: chunk.duration || 0,
        audioUrl: chunk.audioUrl
      })),
      imageProvider: imageProvider
    };
    
    console.log('=== GENERATING IMAGE PROMPTS ===');
    let currentImagePrompts = storyData.imagePrompts || [];
    let currentActionDescriptions = storyData.actionPrompts?.map(ap => ap.actionDescription) || [];

    let calledAiForPrompts = false;
    if (!isRegeneration || !storyData.imagePrompts || storyData.imagePrompts.length === 0) {
      console.log('Calling AI to generate new image prompts and action descriptions...');
      const aiResult = await generateImagePrompts(imagePromptsInput);
      console.log('=== AI SERVER ACTION RESULT ===');
      console.log('Result:', aiResult);
      if (aiResult.success && aiResult.data) {
        currentImagePrompts = aiResult.data.imagePrompts || [];
        currentActionDescriptions = aiResult.data.actionPrompts || [];
        calledAiForPrompts = true;
      } else {
        toast({
          title: 'Error Generating Prompts via AI',
          description: aiResult.error || 'Failed to get prompts from AI.',
          variant: 'destructive'
        });
        handleSetLoading('imagePrompts', false);
        setIsRegenerateDialogOpen(false);
        return;
      }
    } else {
      console.log('Using existing image prompts for re-association / action prompt generation. AI will not be called for new prompts.');
      if (currentActionDescriptions.length !== currentImagePrompts.length) {
        currentActionDescriptions = currentImagePrompts.map((_, idx) => storyData.actionPrompts?.[idx]?.actionDescription || `Character performs action in scene ${idx + 1}.`);
      }
    }
    
    if (currentImagePrompts.length > 0) {
      const newActionPrompts = (() => {
        const actionPrompts: ActionPrompt[] = [];
        let promptIndex = 0;
        if (storyData.narrationChunks && storyData.narrationChunks.length > 0) {
          storyData.narrationChunks.forEach((chunk, chunkIndex) => {
            const duration = chunk.duration || 0;
            let promptCount: number;
            if (duration <= 5) promptCount = 1;
            else if (duration <= 10) promptCount = chunk.text.length > 100 ? 2 : 1;
            else if (duration <= 15) promptCount = 2;
            else promptCount = 3;
            
            for (let i = 0; i < promptCount && promptIndex < currentImagePrompts.length; i++) {
              actionPrompts.push({
                sceneIndex: promptIndex,
                originalPrompt: currentImagePrompts[promptIndex],
                actionDescription: currentActionDescriptions[promptIndex] || `Character performs action in scene ${promptIndex + 1}.`,
                chunkText: chunk.text,
                chunkId: chunk.id,
                chunkIndex: chunkIndex
              });
              promptIndex++;
            }
          });
        } else {
          currentImagePrompts.forEach((prompt, index) => {
            actionPrompts.push({
              sceneIndex: index,
              originalPrompt: prompt,
              actionDescription: currentActionDescriptions[index] || `Character performs action in scene ${index + 1}.`,
              chunkText: "Script chunk not available"
            });
          });
        }
        return actionPrompts;
      })();

      console.log('--- ImageGenerationStep: Generated actionPrompts ---');

      let updatedGeneratedImages = [...(storyData.generatedImages || [])];

      if (isRegeneration && calledAiForPrompts) {
        const oldScenePrompts = new Set(storyData.imagePrompts || []); 
        updatedGeneratedImages = updatedGeneratedImages.filter(img => !oldScenePrompts.has(img.originalPrompt));
        console.log('Regeneration with AI: Cleared images associated with old scene prompts. Remaining images:', updatedGeneratedImages.length);
      } else if (isRegeneration && !calledAiForPrompts) {
        console.log('Update Associations: Keeping all existing images for potential chunk data backfill.');
      }

      if (newActionPrompts.length > 0) {
        updatedGeneratedImages = updatedGeneratedImages.map(image => {
          if (image.originalPrompt && (image.chunkId === undefined || image.chunkIndex === undefined)) {
            const matchingActionPrompt = newActionPrompts.find(ap => ap.originalPrompt === image.originalPrompt);
            if (matchingActionPrompt) {
              console.log(`Backfilling chunk info for image with prompt: ${image.originalPrompt.substring(0,30)}...`);
              return {
                ...image,
                chunkId: matchingActionPrompt.chunkId,
                chunkIndex: matchingActionPrompt.chunkIndex,
              };
            }
          }
          return image;
        });
        console.log('Attempted backfill of chunk info for existing images.');
      }
      
      updateStoryData({
        imagePrompts: currentImagePrompts, 
        generatedImages: updatedGeneratedImages,
        actionPrompts: newActionPrompts
      });
      setIsImagePromptEditing(Array(currentImagePrompts.length).fill(false));
      
      if (storyData.id && storyData.userId) {
        try {
          const finalStoryDataToSave = {
            ...storyData,
            imagePrompts: currentImagePrompts, 
            generatedImages: updatedGeneratedImages,
            actionPrompts: newActionPrompts,
          };
          await saveStory(finalStoryDataToSave, storyData.userId);
          console.log('Auto-saved story. Image prompts count:', currentImagePrompts.length, 'Action prompts count:', newActionPrompts.length, 'Updated images count:', updatedGeneratedImages.length);
        } catch (error) {
          console.error('Failed to auto-save story after image prompts generation/update:', error);
        }
      }
      
      if (!isRegeneration) {
        setCurrentStep(5);
      }
      
      toast({
        title: isRegeneration ? 'Image Associations Updated!' : 'Image Prompts Generated!',
        description: `${currentImagePrompts.length} scene prompts processed. Chunk associations updated for existing images.`,
        className: 'bg-primary text-primary-foreground'
      });
    } else { 
      toast({
        title: 'Error Processing Prompts',
        description: 'Could not obtain or process image prompts.',
        variant: 'destructive'
      });
    }
    handleSetLoading('imagePrompts', false);
    setIsRegenerateDialogOpen(false);
  };

  const handleGenerateImagePrompts = () => generatePromptsWithOptions(false);
  

  const handleGenerateIndividualImage = async (prompt: string, index: number) => {
    if (googleKeyMissing || (imageProvider === 'picsart' && picsartKeyMissing) || (imageProvider === 'gemini' && geminiKeyMissing) || (imageProvider === 'imagen3' && imagen3KeyMissing)) {
      toast({ title: 'API Key Required', description: `Please configure your ${imageProvider === 'picsart' ? 'Picsart' : imageProvider === 'gemini' ? 'Gemini' : 'Google'} API Key in Account Settings.`, variant: 'destructive' });
      return;
    }
    if (!storyData.imagePrompts) return;
    
    const loadingKey = `image-${index}`;
    handleSetLoading(loadingKey, true);
    
    const currentProgress = imageGenerationProgress;
    setImageGenerationProgress({
      total: currentProgress.total,
      completed: currentProgress.completed,
      generating: [...currentProgress.generating, index]
    });
    
    toast({ 
      title: 'Generating Scene Image...', 
      description: `Prompt: "${prompt.substring(0, 50)}..."` 
    });
    
    const styleId = storyData.imageStyleId || DEFAULT_STYLE_ID;
    const result = await generateImageFromPrompt(prompt, storyData.userId, storyData.id, imageProvider, styleId);
    
    if (result.success && result.imageUrl && result.requestPrompt) {
      const actionPrompt = storyData.actionPrompts?.find((ap: ActionPrompt) => ap.originalPrompt === prompt);
      
      const newImage: GeneratedImage = {
        originalPrompt: prompt,
        requestPrompt: result.requestPrompt,
        imageUrl: result.imageUrl,
        chunkId: actionPrompt?.chunkId,
        chunkIndex: actionPrompt?.chunkIndex,
      };
      
      console.log(`--- ImageGenerationStep: Assigning to newImage (individual) for prompt "${prompt.substring(0,30)}..." ---`);
      console.log('Assigned chunkId:', newImage.chunkId);
      console.log('Assigned chunkIndex:', newImage.chunkIndex);
      
      const updatedImages = [
        ...(storyData.generatedImages || []).filter(img => img.originalPrompt !== prompt),
        newImage,
      ];
      setStoryData({
        ...storyData,
        generatedImages: updatedImages
      });
      
      if (storyData.id && storyData.userId) {
        try {
          await saveStory({ ...storyData, generatedImages: updatedImages }, storyData.userId);
          console.log('Auto-saved story with new scene image');
        } catch (error) {
          console.error('Failed to auto-save story:', error);
        }
      }
      
      const latestProgress = imageGenerationProgress;
      setImageGenerationProgress({
        total: latestProgress.total,
        completed: latestProgress.completed + 1,
        generating: latestProgress.generating.filter((i) => i !== index)
      });
      
      toast({ 
        title: 'Scene Image Generated!', 
        description: `Image for scene ${index + 1} is ready.`, 
        className: 'bg-green-500 text-white' 
      });
    } else {
      const latestProgress = imageGenerationProgress;
      setImageGenerationProgress({
        total: latestProgress.total,
        completed: latestProgress.completed,
        generating: latestProgress.generating.filter((i) => i !== index)
      });
      
      toast({ 
        title: 'Image Generation Error', 
        description: result.error || `Failed to generate image for scene ${index + 1}.`, 
        variant: 'destructive' 
      });
    }
    
    handleSetLoading(loadingKey, false);
  };

  const isGenerationStoppedRef = useRef(false);

  const handleGenerateAllImages = async () => {
    if (googleKeyMissing || (imageProvider === 'picsart' && picsartKeyMissing) || (imageProvider === 'gemini' && geminiKeyMissing) || (imageProvider === 'imagen3' && imagen3KeyMissing)) {
      toast({ title: 'API Key Required', description: `Please configure your ${imageProvider === 'picsart' ? 'Picsart' : imageProvider === 'gemini' ? 'Gemini' : 'Google'} API Key in Account Settings.`, variant: 'destructive' });
      return;
    }
    if (!storyData.imagePrompts || storyData.imagePrompts.length === 0) return;
    
    isGenerationStoppedRef.current = false;
    handleSetLoading('allImages', true);
    
    const alreadyGenerated = (storyData.actionPrompts || []).filter((actionPrompt: ActionPrompt) =>
      storyData.generatedImages?.find(img => img.originalPrompt === actionPrompt.originalPrompt)
    ).length;
    
    setImageGenerationProgress({
      total: storyData.actionPrompts?.length || 0,
      completed: alreadyGenerated,
      generating: []
    });
    
    toast({ 
      title: 'Generating All Scene Images...', 
      description: `${alreadyGenerated > 0 ? `Resuming from ${alreadyGenerated} already generated. ` : ''}This may take several minutes.` 
    });
    
    let successCount = 0;
    let errorCount = 0;
    let currentStoryData = storyData;
    
    for (let i = 0; i < (storyData.actionPrompts?.length || 0); i++) {
      if (isGenerationStoppedRef.current) {
        toast({
          title: 'Generation Stopped',
          description: `Stopped after generating ${successCount} new images. Progress saved.`,
          className: 'bg-yellow-500 text-black'
        });
        handleSetLoading('allImages', false);
        return; 
      }
      
      const actionPrompt = storyData.actionPrompts![i];
      const prompt = actionPrompt.originalPrompt;
      
      if (currentStoryData.generatedImages?.find(img => img.originalPrompt === prompt)) {
        continue;
      }
      
      const currentProgressForLoop = imageGenerationProgress;
      setImageGenerationProgress({ 
        total: currentProgressForLoop.total || 0,
        completed: currentProgressForLoop.completed || 0,
        generating: [i]
      });
      
      const styleId = storyData.imageStyleId || DEFAULT_STYLE_ID;
      const result = await generateImageFromPrompt(prompt, storyData.userId, storyData.id, imageProvider, styleId);
      
      if (result.success && result.imageUrl && result.requestPrompt) {
        const newImage: GeneratedImage = {
          originalPrompt: prompt,
          requestPrompt: result.requestPrompt,
          imageUrl: result.imageUrl,
          chunkId: actionPrompt.chunkId,
          chunkIndex: actionPrompt.chunkIndex,
        };

        console.log(`--- ImageGenerationStep: Assigning to newImage (all) for prompt "${prompt.substring(0,30)}..." ---`);
        console.log('Assigned chunkId:', newImage.chunkId);
        console.log('Assigned chunkIndex:', newImage.chunkIndex);
        
        const updatedImages = [
          ...(currentStoryData.generatedImages || []).filter(img => img.originalPrompt !== prompt),
          newImage,
        ];
        
        currentStoryData = {
          ...currentStoryData,
          generatedImages: updatedImages
        };
        
        setStoryData(currentStoryData);
        
        if (storyData.id && storyData.userId) {
          try {
            await saveStory(currentStoryData, storyData.userId);
            console.log(`Auto-saved story with new scene image ${i + 1}`);
          } catch (error) {
            console.error('Failed to auto-save story:', error);
          }
        }
        
        successCount++;
      } else {
        errorCount++;
        console.warn(`Image generation failed for scene ${i + 1}:`, result.error);
        toast({
          title: `Scene ${i + 1} Generation Failed`,
          description: result.error || 'Unknown error occurred',
          variant: 'destructive'
        });
        
        const errorMessage = result.error?.toLowerCase() || '';
        const criticalErrors = [
          'insufficient credit', 'insufficient_credits', 'no credit', 'credit exhausted', 
          'credits exhausted', 'quota exceeded', 'rate limit exceeded', 'insufficient fund', 
          'insufficient balance', 'payment required', 'subscription expired', 
          'api quota exceeded', 'balance insufficient', 'not enough credit', 
          'credit limit', 'usage limit', 'billing', 'payment failed', 'account suspended'
        ];
        
        const isCriticalError = criticalErrors.some(error => errorMessage.includes(error));
        
        if (isCriticalError) {
          console.warn('Critical error detected, stopping generation:', result.error);
          toast({
            title: 'Generation Stopped - Critical Error',
            description: `Stopped due to: ${result.error}. Generated ${successCount} images before stopping.`,
            variant: 'destructive'
          });
          handleSetLoading('allImages', false);
          return; 
        }
      }
      
      const latestProgressLoop = imageGenerationProgress;
      setImageGenerationProgress({
        total: latestProgressLoop.total || 0,
        completed: (latestProgressLoop.completed || 0) + 1,
        generating: []
      });
    }
    
    if (!isGenerationStoppedRef.current) {
      if (successCount > 0) {
        toast({ 
          title: 'Scene Images Generated!', 
          description: `${successCount} images created. ${errorCount > 0 ? `${errorCount} errors.` : ''}`, 
          className: errorCount === 0 ? 'bg-green-500 text-white' : 'bg-yellow-500 text-black' 
        });
      } else if (alreadyGenerated === storyData.imagePrompts.length) {
        toast({ 
          title: 'All Images Already Generated!', 
          description: 'No new images needed.', 
          className: 'bg-blue-500 text-white' 
        });
      } else {
        toast({ 
          title: 'Image Generation Failed', 
          description: `All ${errorCount} generations failed.`, 
          variant: 'destructive' 
        });
      }
    }
    handleSetLoading('allImages', false);
  };

  const handleStopGeneration = () => {
    isGenerationStoppedRef.current = true;
    handleSetLoading('allImages', false); 
    const currentProgress = imageGenerationProgress;
    setImageGenerationProgress({ 
        total: currentProgress.total, 
        completed: currentProgress.completed, 
        generating: [] 
    });
  };

  const updateImagePrompt = (index: number, newPrompt: string) => {
    if (!storyData.imagePrompts) return;
    const updatedPrompts = [...storyData.imagePrompts];
    updatedPrompts[index] = newPrompt;
    updateStoryData({ imagePrompts: updatedPrompts });
  };

  const toggleImagePromptEditing = (index: number) => {
    const newState = [...isImagePromptEditing];
    newState[index] = !newState[index];
    setIsImagePromptEditing(newState);
  };

  const handleDownloadImage = async (imageUrl: string, alt: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${alt.replace(/\s+/g, '_')}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast({
        title: 'Image Downloaded',
        description: 'The image has been saved to your device.',
        className: 'bg-green-500 text-white'
      });
    } catch (error) {
      console.error('Error downloading image:', error);
      toast({
        title: 'Download Failed',
        description: 'Failed to download the image.',
        variant: 'destructive'
      });
    }
  };

  if (!storyData.generatedScript || !storyData.detailsPrompts) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clapperboard className="h-6 w-6 text-primary" />
            Generate Scene Images
          </CardTitle>
          <CardDescription>
            First, ensure your story script and character/location/item details are generated. Then, generate image prompts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Please complete the &quot;Story Details&quot; and &quot;Script&quot; steps before generating images.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clapperboard className="h-6 w-6 text-primary" />
          Generate Scene Images
        </CardTitle>
        <CardDescription>
          Based on your script and character details, we&apos;ll generate image prompts. Review and edit them, then generate images for each scene.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="image-provider-select">Image Generation Provider</Label>
          <div className="flex items-center gap-2">
            <Select value={imageProvider} onValueChange={(value) => setImageProvider(value as 'picsart' | 'gemini' | 'imagen3')}>
              <SelectTrigger id="image-provider-select" className="w-[200px]">
                <SelectValue placeholder="Select Provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="picsart">Picsart (Flux Dev)</SelectItem>
                <SelectItem value="gemini">Google Gemini</SelectItem>
                <SelectItem value="imagen3">Google Imagen 3</SelectItem>
              </SelectContent>
            </Select>
            <Link href="/settings?tab=apiKeys" passHref>
              <Button variant="outline" size="sm" className="text-xs">
                <Settings className="mr-2 h-3 w-3" /> API Keys
              </Button>
            </Link>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="image-style-select">Image Style</Label>
          <div className="flex items-center gap-2">
            <Select
              value={storyData.imageStyleId || DEFAULT_STYLE_ID}
              onValueChange={(value) => updateStoryData({ imageStyleId: value as ImageStyleId })}
            >
              <SelectTrigger id="image-style-select" className="w-[200px]">
                <SelectValue placeholder="Select Style" />
              </SelectTrigger>
              <SelectContent>
                {Object.values(IMAGE_STYLES).map((style) => (
                  <SelectItem key={style.id} value={style.id}>
                    {style.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
             <Link href="/settings?tab=imageStyles" passHref>
                <Button variant="outline" size="sm" className="text-xs">
                    <Settings className="mr-2 h-3 w-3" /> Manage Styles
                </Button>
            </Link>
          </div>
        </div>

        <div className="space-y-3">
          <Button 
            onClick={handleGenerateImagePrompts} 
            disabled={isLoading.imagePrompts || googleKeyMissing}
            variant="outline"
          >
            {isLoading.imagePrompts ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ImageIcon className="mr-2 h-4 w-4" />
            )}
            {storyData.imagePrompts && storyData.imagePrompts.length > 0 ? 'Re-generate Image Prompts & Associations' : 'Generate Image Prompts'}
          </Button>
          {googleKeyMissing && <p className="text-xs text-destructive">Google API Key needed for prompt generation. <Link href="/settings?tab=apiKeys" className="underline">Configure here</Link>.</p>}
          
          {storyData.imagePrompts && storyData.imagePrompts.length > 0 && (
            <Button 
              onClick={() => setIsRegenerateDialogOpen(true)} 
              disabled={isLoading.imagePrompts || googleKeyMissing}
              variant="outline"
              size="sm"
              className="ml-2"
            >
              <RefreshCw className="mr-2 h-3 w-3" />
              Advanced: Regenerate Prompts (AI Call)
            </Button>
          )}
        </div>

        {storyData.imagePrompts && storyData.imagePrompts.length > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Generated Scene Prompts ({storyData.imagePrompts.length})</Label>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={handleGenerateAllImages} 
                  disabled={isLoading.allImages || picsartKeyMissing || geminiKeyMissing || imagen3KeyMissing}
                  size="sm"
                >
                  {isLoading.allImages ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ImageIcon className="mr-2 h-4 w-4" />
                  )}
                  Generate All Scene Images ({countSceneImages(storyData)}/{storyData.imagePrompts.length})
                </Button>
                {isLoading.allImages && (
                    <Button onClick={handleStopGeneration} variant="destructive" size="sm">
                        Stop
                    </Button>
                )}
              </div>
            </div>
            {picsartKeyMissing && imageProvider === 'picsart' && <p className="text-xs text-destructive">Picsart API Key needed for image generation. <Link href="/settings?tab=apiKeys" className="underline">Configure here</Link>.</p>}
            {geminiKeyMissing && imageProvider === 'gemini' && <p className="text-xs text-destructive">Gemini API Key needed for image generation. <Link href="/settings?tab=apiKeys" className="underline">Configure here</Link>.</p>}
            {imagen3KeyMissing && imageProvider === 'imagen3' && <p className="text-xs text-destructive">Google API Key needed for Imagen 3 generation. <Link href="/settings?tab=apiKeys" className="underline">Configure here</Link>.</p>}


            {isLoading.allImages && imageGenerationProgress.total > 0 && (
              <div className="mt-2">
                <Progress value={(imageGenerationProgress.completed / imageGenerationProgress.total) * 100} className="w-full" />
                <p className="text-xs text-muted-foreground mt-1 text-center">
                  {imageGenerationProgress.completed} / {imageGenerationProgress.total} images generated.
                  {imageGenerationProgress.generating.length > 0 && ` (Currently processing scene ${imageGenerationProgress.generating[0] + 1}... )`}
                </p>
              </div>
            )}
            <ScrollArea className="h-[400px] w-full rounded-md border p-3 bg-muted/20">
              <div className="space-y-4">
              <TooltipProvider>
                {storyData.imagePrompts.map((prompt, index) => {
                  const existingImage = storyData.generatedImages?.find(img => img.originalPrompt === prompt);
                  const isCurrentlyGenerating = imageGenerationProgress.generating.includes(index);
                  const isEditing = isImagePromptEditing[index];
                  const actionPrompt = storyData.actionPrompts?.find(ap => ap.sceneIndex === index);

                  return (
                    <Card key={index} className="border-l-4 border-l-primary/20">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                            <div>
                                <Label htmlFor={`prompt-${index}`} className="text-xs font-semibold">Scene {index + 1} Prompt</Label>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleImagePromptEditing(index)}>
                                <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7" 
                                onClick={() => handleGenerateIndividualImage(prompt, index)}
                                disabled={isLoading[`image-${index}`] || isLoading.allImages || picsartKeyMissing || geminiKeyMissing || imagen3KeyMissing}
                                >
                                {isLoading[`image-${index}`] || isCurrentlyGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                </Button>
                            </div>
                        </div>
                        {isEditing ? (
                          <Textarea
                            id={`prompt-${index}`}
                            value={prompt}
                            onChange={(e) => updateImagePrompt(index, e.target.value)}
                            className="text-xs min-h-[60px]"
                          />
                        ) : (
                          <p className="text-xs p-2 border rounded-md bg-background min-h-[60px]">
                            <HighlightedPrompt prompt={prompt} />
                          </p>
                        )}
                        
                        {actionPrompt && (
                          <div className="mt-2 space-y-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-default">
                                  <ListMusic className="h-3.5 w-3.5 text-blue-500"/>
                                  <span>Narration Chunk: {actionPrompt.chunkIndex !== undefined ? actionPrompt.chunkIndex + 1 : 'N/A'}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" align="start" className="max-w-xs">
                                <p className="text-xs leading-relaxed">{actionPrompt.chunkText || "No narration text available for this chunk."}</p>
                              </TooltipContent>
                            </Tooltip>
                            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                              <ChevronsRight className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0"/>
                              <p className="text-xs leading-relaxed">
                                <span className="font-medium text-foreground/80">Action:</span> {actionPrompt.actionDescription || 'No action defined'}
                              </p>
                            </div>
                          </div>
                        )}

                        {existingImage?.imageUrl && (
                          <div className="mt-2">
                            <Label className="text-xs font-medium">Generated Image:</Label>
                            <div className="relative aspect-video w-full max-w-sm overflow-hidden rounded-md border mt-1 group">
                              <Image
                                src={existingImage.imageUrl}
                                alt={`Generated image for scene ${index + 1}`}
                                fill
                                sizes="(max-width: 768px) 100vw, 400px"
                                style={{ objectFit: "contain" }}
                                className="bg-muted cursor-pointer transition-transform hover:scale-105"
                                priority={index < 3} 
                                unoptimized
                                onClick={() => setPopupImage({ src: existingImage.imageUrl, alt: `Scene ${index + 1}: ${prompt.substring(0,30)}` })}
                              />
                              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadImage(existingImage.imageUrl, `Scene_${index + 1}`);
                                  }}
                                  className="bg-white/90 hover:bg-white text-black"
                                >
                                  <Download className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Full prompt sent to AI: &quot;{existingImage.requestPrompt}&quot;</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </TooltipProvider>
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
      <ImagePopup
        src={popupImage?.src || ''}
        alt={popupImage?.alt || ''}
        isOpen={!!popupImage}
        onClose={() => setPopupImage(null)}
      />

      <AlertDialog open={isRegenerateDialogOpen} onOpenChange={setIsRegenerateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Prompt Regeneration</AlertDialogTitle>
            <AlertDialogDescription>
              This will call the AI to generate new image prompts and action descriptions based on your current script and detail prompts. 
              Existing images associated with the old prompts will be cleared. Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegenerateImagePrompts}>Regenerate Prompts</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
