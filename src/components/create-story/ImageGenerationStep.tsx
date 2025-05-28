import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePopup } from '@/components/ui/image-popup';
import { Clapperboard, Loader2, Edit2, ImageIcon, RefreshCw, Download } from 'lucide-react';
import { generateImagePrompts, generateImageFromPrompt, saveStory } from '@/actions/storyActions';
import { useToast } from '@/hooks/use-toast';
import { extractKeywordsFromText, countSceneImages } from '@/utils/storyHelpers';
import Image from 'next/image';
import { useState } from 'react';
import type { UseStoryStateReturn } from '@/hooks/useStoryState';
import type { GeneratedImage } from '@/types/story';

interface ImageGenerationStepProps {
  storyState: UseStoryStateReturn;
}

export function ImageGenerationStep({ storyState }: ImageGenerationStepProps) {
  const { toast } = useToast();
  const [popupImage, setPopupImage] = useState<{ src: string; alt: string } | null>(null);
  
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
    setImageGenerationProgress
  } = storyState;

  const handleGenerateImagePrompts = async () => {
    if (!storyData.generatedScript || !storyData.detailsPrompts) return;
    handleSetLoading('imagePrompts', true);
    
    const audioDurationSeconds = storyData.narrationAudioDurationSeconds || 
      (storyData.narrationChunks?.reduce((total, chunk) => total + (chunk.duration || 0), 0)) || 
      60; // Default fallback
    
    const result = await generateImagePrompts({ 
      script: storyData.generatedScript,
      characterPrompts: storyData.detailsPrompts.characterPrompts || '',
      locationPrompts: storyData.detailsPrompts.locationPrompts || '',
      itemPrompts: storyData.detailsPrompts.itemPrompts || '',
      audioDurationSeconds,
      imagesPerMinute: 5 // Default value
    });
    
    if (result.success && result.data?.imagePrompts) {
      const updatedStoryData = {
        ...storyData,
        imagePrompts: result.data.imagePrompts
      };
      
      updateStoryData({ imagePrompts: result.data.imagePrompts });
      setIsImagePromptEditing(Array(result.data.imagePrompts.length).fill(false));
      
      // Auto-save the story with the new image prompts
      if (storyData.id && storyData.userId) {
        try {
          await saveStory(updatedStoryData, storyData.userId);
          console.log('Auto-saved story with new image prompts');
        } catch (error) {
          console.error('Failed to auto-save story after image prompts generation:', error);
        }
      }
      
      setCurrentStep(5);
      toast({ 
        title: 'Image Prompts Generated!', 
        description: `${result.data.imagePrompts.length} scene prompts are ready.`, 
        className: 'bg-primary text-primary-foreground' 
      });
    } else {
      toast({ 
        title: 'Error', 
        description: result.error || 'Failed to generate image prompts.', 
        variant: 'destructive' 
      });
    }
    handleSetLoading('imagePrompts', false);
  };

  const handleGenerateIndividualImage = async (prompt: string, index: number) => {
    if (!storyData.imagePrompts) return;
    
    const loadingKey = `image-${index}`;
    handleSetLoading(loadingKey, true);
    
    // Update progress
    setImageGenerationProgress({
      ...imageGenerationProgress,
      generating: [...imageGenerationProgress.generating, index]
    });
    
    toast({ 
      title: 'Generating Scene Image...', 
      description: `Prompt: "${prompt.substring(0, 50)}..."` 
    });
    
    const result = await generateImageFromPrompt(prompt, storyData.userId, storyData.id, imageProvider);
    
    if (result.success && result.imageUrl && result.requestPrompt) {
      const newImage: GeneratedImage = {
        originalPrompt: prompt,
        requestPrompt: result.requestPrompt,
        imageUrl: result.imageUrl,
      };
      
      // Add to generatedImages, ensuring no duplicates
      const updatedImages = [
        ...(storyData.generatedImages || []).filter(img => img.originalPrompt !== prompt),
        newImage,
      ];
      setStoryData({
        ...storyData,
        generatedImages: updatedImages
      });
      
      // Auto-save the story
      if (storyData.id && storyData.userId) {
        try {
          await saveStory({ ...storyData, generatedImages: updatedImages }, storyData.userId);
          console.log('Auto-saved story with new scene image');
        } catch (error) {
          console.error('Failed to auto-save story:', error);
        }
      }
      
      // Update progress
      setImageGenerationProgress({
        ...imageGenerationProgress,
        completed: imageGenerationProgress.completed + 1,
        generating: imageGenerationProgress.generating.filter((i: number) => i !== index)
      });
      
      toast({ 
        title: 'Scene Image Generated!', 
        description: `Image for scene ${index + 1} is ready.`, 
        className: 'bg-green-500 text-white' 
      });
    } else {
      setImageGenerationProgress({
        ...imageGenerationProgress,
        generating: imageGenerationProgress.generating.filter((i: number) => i !== index)
      });
      
      toast({ 
        title: 'Image Generation Error', 
        description: result.error || `Failed to generate image for scene ${index + 1}.`, 
        variant: 'destructive' 
      });
    }
    
    handleSetLoading(loadingKey, false);
  };

  const handleGenerateAllImages = async () => {
    if (!storyData.imagePrompts || storyData.imagePrompts.length === 0) return;
    
    handleSetLoading('allImages', true);
    setImageGenerationProgress({
      total: storyData.imagePrompts.length,
      completed: 0,
      generating: []
    });
    
    toast({ 
      title: 'Generating All Scene Images...', 
      description: 'This may take several minutes.' 
    });
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < storyData.imagePrompts.length; i++) {
      const prompt = storyData.imagePrompts[i];
      
      // Skip if already generated
      if (storyData.generatedImages?.find(img => img.originalPrompt === prompt)) {
        setImageGenerationProgress({
          ...imageGenerationProgress,
          completed: imageGenerationProgress.completed + 1
        });
        continue;
      }
      
      setImageGenerationProgress({
        ...imageGenerationProgress,
        generating: [i]
      });
      
      const result = await generateImageFromPrompt(prompt, storyData.userId, storyData.id, imageProvider);
      
      if (result.success && result.imageUrl && result.requestPrompt) {
        const newImage: GeneratedImage = {
          originalPrompt: prompt,
          requestPrompt: result.requestPrompt,
          imageUrl: result.imageUrl,
        };
        
        const updatedImages = [
          ...(storyData.generatedImages || []).filter(img => img.originalPrompt !== prompt),
          newImage,
        ];
        
        setStoryData({
          ...storyData,
          generatedImages: updatedImages
        });
        
        successCount++;
      } else {
        errorCount++;
      }
      
      setImageGenerationProgress({
        ...imageGenerationProgress,
        completed: imageGenerationProgress.completed + 1,
        generating: []
      });
    }
    
    // Auto-save final state
    if (storyData.id && storyData.userId && successCount > 0) {
      try {
        await saveStory(storyData, storyData.userId);
        console.log(`Auto-saved story with ${successCount} new scene images`);
      } catch (error) {
        console.error('Failed to auto-save story:', error);
      }
    }
    
    if (successCount > 0) {
      toast({ 
        title: 'Scene Images Generated!', 
        description: `${successCount} images created. ${errorCount > 0 ? `${errorCount} errors.` : ''}`, 
        className: errorCount === 0 ? 'bg-green-500 text-white' : 'bg-yellow-500 text-black' 
      });
    } else {
      toast({ 
        title: 'Image Generation Failed', 
        description: `All ${errorCount} generations failed.`, 
        variant: 'destructive' 
      });
    }
    
    handleSetLoading('allImages', false);
  };

  const updateImagePrompt = (index: number, newPrompt: string) => {
    if (!storyData.imagePrompts) return;
    const updatedPrompts = [...storyData.imagePrompts];
    updatedPrompts[index] = newPrompt;
    updateStoryData({ imagePrompts: updatedPrompts });
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
        <div className="space-y-2">
          <Label>Image Provider</Label>
          <Select value={imageProvider} onValueChange={(value: 'picsart' | 'gemini' | 'imagen3') => setImageProvider(value)}>
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

        <Button 
          onClick={handleGenerateImagePrompts}
          disabled={isLoading.imagePrompts}
          className="w-full"
        >
          {isLoading.imagePrompts ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating Scene Prompts...
            </>
          ) : (
            <>
              <Clapperboard className="mr-2 h-4 w-4" />
              Generate Scene Image Prompts
            </>
          )}
        </Button>

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

            <Button 
              onClick={handleGenerateAllImages}
              disabled={isLoading.allImages}
              variant="outline"
              className="w-full"
            >
              {isLoading.allImages ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating All Images... ({imageGenerationProgress.completed}/{imageGenerationProgress.total})
                </>
              ) : (
                <>
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Generate All Scene Images
                </>
              )}
            </Button>

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
                              disabled={isLoading[`image-${index}`] || isCurrentlyGenerating}
                            >
                              {isCurrentlyGenerating ? (
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
                          <p className="text-sm text-muted-foreground">{prompt}</p>
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
    </Card>
  );
}
