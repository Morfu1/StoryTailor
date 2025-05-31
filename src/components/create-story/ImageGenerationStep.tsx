
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePopup } from '@/components/ui/image-popup';
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
import { Clapperboard, Loader2, Edit2, ImageIcon, RefreshCw, Download, RotateCcw, Square, Settings } from 'lucide-react'; // Added Settings
import Link from 'next/link'; // Added Link
import { generateImagePrompts, generateImageFromPrompt, saveStory } from '@/actions/storyActions';
import { useToast } from '@/hooks/use-toast';
import { countSceneImages } from '@/utils/storyHelpers';
import Image from 'next/image';
import { useState, useRef } from 'react';
import type { UseStoryStateReturn } from '@/hooks/useStoryState';
import type { GeneratedImage, ActionPrompt } from '@/types/story';
import { IMAGE_STYLES, DEFAULT_STYLE_ID, type ImageStyleId } from '@/types/imageStyles';

interface ImageGenerationProgressState {
  total: number;
  completed: number;
  generating: number[];
}

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
    userApiKeys, // Get userApiKeys
    apiKeysLoading // Get apiKeysLoading
  } = storyState;

  const googleKeyMissing = !apiKeysLoading && !userApiKeys?.googleApiKey;
  const picsartKeyMissing = imageProvider === 'picsart' && !apiKeysLoading && !userApiKeys?.picsartApiKey;
  const geminiKeyMissing = imageProvider === 'gemini' && !apiKeysLoading && !userApiKeys?.geminiApiKey;
  const imagen3KeyMissing = imageProvider === 'imagen3' && !apiKeysLoading && !userApiKeys?.googleApiKey; // Imagen3 uses Google API key

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
      userId: storyData.userId, // Pass userId
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
    // ... (rest of the console logs can remain if needed for debugging)

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
      // console.log(JSON.stringify(newActionPrompts, null, 2)); // Potentially large log

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
  
  const handleRegenerateImagePrompts = () => generatePromptsWithOptions(true);

  const handleGenerateIndividualImage = async (prompt: string, index: number) => {
    if (googleKeyMissing || (imageProvider === 'picsart' && picsartKeyMissing) || (imageProvider === 'gemini' && geminiKeyMissing) || (imageProvider === 'imagen3' && imagen3KeyMissing)) {
      toast({ title: 'API Key Required', description: `Please configure your ${imageProvider === 'picsart' ? 'Picsart' : imageProvider === 'gemini' ? 'Gemini' : 'Google'} API Key in Account Settings.`, variant: 'destructive' });
      return;
    }
    if (!storyData.imagePrompts) return;
    
    const loadingKey = `image-${index}`;
    handleSetLoading(loadingKey, true);
    
    setImageGenerationProgress({
      ...imageGenerationProgress,
      generating: [...imageGenerationProgress.generating, index]
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
      // console.log('Found actionPrompt:', JSON.stringify(actionPrompt, null, 2)); // Potentially large log
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
      
      setImageGenerationProgress({
        ...imageGenerationProgress,
        completed: imageGenerationProgress.completed + 1,
        generating: imageGenerationProgress.generating.filter((i) => i !== index)
      });
      
      toast({ 
        title: 'Scene Image Generated!', 
        description: `Image for scene ${index + 1} is ready.`, 
        className: 'bg-green-500 text-white' 
      });
    } else {
      setImageGenerationProgress({
        ...imageGenerationProgress,
        generating: imageGenerationProgress.generating.filter((i) => i !== index)
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
      
      setImageGenerationProgress({
        ...imageGenerationProgress, 
        generating: [i],
        total: imageGenerationProgress.total || 0,
        completed: imageGenerationProgress.completed || 0,
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
        // console.log('Using actionPrompt:', JSON.stringify(actionPrompt, null, 2)); // Potentially large log
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
      
      setImageGenerationProgress({
        ...imageGenerationProgress, 
        completed: (imageGenerationProgress.completed || 0) + 1,
        generating: [],
        total: imageGenerationProgress.total || 0,
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
    toast({
      title: 'Stopping Generation...',
      description: 'Will stop after current image completes.',
      className: 'bg-orange-500 text-white'
    });
  };

  const updateImagePrompt = (index: number, newPrompt: string) => {
    if (!storyData.imagePrompts) return;
    const updatedPrompts = [...storyData.imagePrompts];
    updatedPrompts[index] = newPrompt;
    
    const updatedActionPrompts = [...(storyData.actionPrompts || [])];
    if (updatedActionPrompts[index]) {
      updatedActionPrompts[index] = {
        sceneIndex: index,
        originalPrompt: newPrompt,
        actionDescription: updatedActionPrompts[index].actionDescription, 
        chunkText: updatedActionPrompts[index].chunkText 
      };
    }
    
    updateStoryData({ 
      imagePrompts: updatedPrompts,
      actionPrompts: updatedActionPrompts
    });
  };

  const toggleImagePromptEditing = (index: number) => {
    const newEditing = [...isImagePromptEditing];
    newEditing[index] = !newEditing[index];
    setIsImagePromptEditing(newEditing);
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

  if (!storyData.narrationChunks || !storyData.narrationChunks.every(c => c.audioUrl)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clapperboard className="h-5 w-5" />
            Step 4: Scene Image Generation
          </CardTitle>
          <CardDescription>
            Complete narration generation first to continue with scene images.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const totalImages = storyData.imagePrompts?.length || 0;
  const generatedSceneImages = countSceneImages(storyData);
  const progressPercentage = totalImages > 0 ? (generatedSceneImages / totalImages) * 100 : 0;
  
  const providerKeyMissing = 
    (imageProvider === 'picsart' && picsartKeyMissing) ||
    (imageProvider === 'gemini' && geminiKeyMissing) ||
    (imageProvider === 'imagen3' && imagen3KeyMissing);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clapperboard className="h-5 w-5" />
          Step 4: Scene Image Generation
        </CardTitle>
        <CardDescription>
          Generate visual prompts and images for key scenes in your story.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Image Provider</Label>
            <Select 
              value={imageProvider} 
              onValueChange={(value: 'picsart' | 'gemini' | 'imagen3') => setImageProvider(value)}
              disabled={apiKeysLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="picsart">PicsArt AI</SelectItem>
                <SelectItem value="gemini">Gemini</SelectItem>
                <SelectItem value="imagen3">Imagen 3</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Art Style</Label>
            <Select 
              value={storyData.imageStyleId || DEFAULT_STYLE_ID} 
              onValueChange={(value: ImageStyleId) => updateStoryData({ imageStyleId: value })}
              disabled={apiKeysLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(IMAGE_STYLES).map((style) => (
                  <SelectItem key={style.id} value={style.id}>
                    <div>
                      <div className="font-medium">{style.name}</div>
                      <div className="text-xs text-muted-foreground">{style.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          <Button 
            onClick={handleGenerateImagePrompts}
            disabled={isLoading.imagePrompts || apiKeysLoading || googleKeyMissing}
            className="w-full"
          >
            {isLoading.imagePrompts || apiKeysLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {apiKeysLoading ? "Checking API Keys..." : "Generating Scene Prompts..."}
              </>
            ) : (
              <>
                <Clapperboard className="mr-2 h-4 w-4" />
                Generate Scene Image Prompts
              </>
            )}
          </Button>
          {googleKeyMissing && (
            <p className="text-xs text-destructive text-center">
              Google API Key required for prompt generation. Please set it in <Link href="/settings" className="underline">Account Settings</Link>.
            </p>
          )}

          {storyData.imagePrompts && storyData.imagePrompts.length > 0 && (
            <Button 
              onClick={() => setIsRegenerateDialogOpen(true)}
              disabled={isLoading.imagePrompts || apiKeysLoading || googleKeyMissing}
              variant="outline"
              className="w-full"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Update Scene Associations
            </Button>
          )}
        </div>

        {storyData.imagePrompts && storyData.imagePrompts.length > 0 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Scene Images ({generatedSceneImages}/{totalImages} generated)
                </Label>
                <span className="text-sm text-muted-foreground">
                  {Math.round(progressPercentage)}%
                </span>
              </div>
              <Progress value={progressPercentage} className="w-full" />
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleGenerateAllImages}
                disabled={isLoading.allImages || apiKeysLoading || googleKeyMissing || providerKeyMissing}
                variant="outline"
                className="flex-1"
              >
                {isLoading.allImages || apiKeysLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {apiKeysLoading ? "Checking API Keys..." : `Generating All Images... (${imageGenerationProgress.completed}/${imageGenerationProgress.total})`}
                  </>
                ) : (
                  <>
                    <ImageIcon className="mr-2 h-4 w-4" />
                    Generate All Scene Images
                  </>
                )}
              </Button>
              
              {isLoading.allImages && (
                <Button 
                  onClick={handleStopGeneration}
                  variant="destructive"
                  className="px-3"
                >
                  <Square className="h-4 w-4" />
                </Button>
              )}
            </div>
            {(googleKeyMissing || providerKeyMissing) && (
                <p className="text-xs text-destructive text-center">
                  {googleKeyMissing && "Google API Key required for prompts. "}
                  {providerKeyMissing && `${imageProvider.charAt(0).toUpperCase() + imageProvider.slice(1)} API Key required for image generation. `}
                  Please set them in <Link href="/settings" className="underline">Account Settings</Link>.
                </p>
            )}


            <div className="space-y-3">
              <Label className="text-sm font-medium">Individual Scene Prompts</Label>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {storyData.imagePrompts.map((prompt, index) => {
                  const existingImage = storyData.generatedImages?.find(img => img.originalPrompt === prompt);
                  const isCurrentlyGenerating = imageGenerationProgress.generating.includes(index);
                  const isEditing = isImagePromptEditing[index];
                  
                  return (
                    <Card key={index} className="border-l-4 border-l-primary/20">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Scene {index + 1}</span>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleImagePromptEditing(index)}
                            >
                              <Edit2 className="mr-1 h-3 w-3" />
                              {isEditing ? 'Save' : 'Edit'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleGenerateIndividualImage(prompt, index)}
                              disabled={isLoading[`image-${index}`] || isCurrentlyGenerating || apiKeysLoading || googleKeyMissing || providerKeyMissing}
                            >
                              {isCurrentlyGenerating || apiKeysLoading ? (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              ) : existingImage ? (
                                <RefreshCw className="mr-1 h-3 w-3" />
                              ) : (
                                <ImageIcon className="mr-1 h-3 w-3" />
                              )}
                              {existingImage ? 'Regenerate' : 'Generate'}
                            </Button>
                          </div>
                        </div>
                        
                        {isEditing ? (
                          <Textarea
                            value={prompt}
                            onChange={(e) => updateImagePrompt(index, e.target.value)}
                            rows={3}
                            className="text-sm"
                          />
                        ) : (
                          <div className="space-y-2">
                            <div className="text-sm text-muted-foreground">
                              <strong>Main Prompt:</strong> <HighlightedPrompt prompt={prompt} />
                            </div>
                            {storyData.actionPrompts?.[index]?.actionDescription && (
                              <div className="space-y-1">
                                <div className="text-sm">
                                  <strong className="text-muted-foreground">Action:</strong>{" "}
                                  <span className="text-muted-foreground/80 italic">
                                    <HighlightedPrompt prompt={storyData.actionPrompts[index].actionDescription} />
                                  </span>
                                </div>
                                {storyData.actionPrompts[index].chunkText && (
                                  <div className="text-xs bg-muted/50 p-2 rounded border-l-2 border-muted">
                                    <strong className="text-muted-foreground">Source Text:</strong>
                                    <div className="text-muted-foreground/80 mt-1 leading-relaxed">
                                      "{storyData.actionPrompts[index].chunkText}"
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {existingImage?.imageUrl && (
                          <div className="relative aspect-video w-full max-w-sm overflow-hidden rounded-md border group">
                            <Image
                              src={existingImage.imageUrl}
                              alt={`Scene ${index + 1}`}
                              fill
                              sizes="(max-width: 768px) 100vw, 400px"
                              style={{ objectFit: "contain" }}
                              className="bg-muted cursor-pointer transition-transform hover:scale-105"
                              priority
                              unoptimized
                              onClick={() => setPopupImage({ src: existingImage.imageUrl, alt: `Scene ${index + 1}` })}
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
                        )}
                        
                        {isCurrentlyGenerating && (
                          <div className="text-xs text-primary">
                            Generating image for scene {index + 1}...
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
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
            <AlertDialogTitle>Regenerate Image Prompts</AlertDialogTitle>
            <AlertDialogDescription>
              This will generate new image prompts for all scenes. <strong>All existing scene images will need to be regenerated</strong> because the prompts will change. This action cannot be undone.
              {googleKeyMissing && <span className="block mt-2 text-destructive">Google API Key is required for this action.</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRegenerateImagePrompts}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={googleKeyMissing}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Update Associations
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

