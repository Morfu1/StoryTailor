import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ImageIcon, Loader2, Download } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { ImagePopup } from '@/components/ui/image-popup';
import { parseNamedPrompts } from '@/utils/storyHelpers';
import { generateImageFromPrompt, saveStory } from '@/actions/storyActions';
import { useToast } from '@/hooks/use-toast';
import type { UseStoryStateReturn } from '@/hooks/useStoryState';
import type { GeneratedImage } from '@/types/story';

interface DetailImageManagerProps {
  storyState: UseStoryStateReturn;
  promptType: 'Character' | 'Item' | 'Location' | 'All';
  promptsString: string | undefined;
  showGenerateAllButton?: boolean;
}

export function DetailImageManager({ storyState, promptType, promptsString, showGenerateAllButton = false }: DetailImageManagerProps) {
  const { toast } = useToast();
  const [popupImage, setPopupImage] = useState<{ src: string; alt: string } | null>(null);
  
  const {
    storyData,
    setStoryData,
    updateStoryData,
    isLoading,
    handleSetLoading,
    isGeneratingDetailImage,
    setIsGeneratingDetailImage,
    imageProvider
  } = storyState;

  const handleGenerateIndividualDetailImage = async (individualPrompt: string, index: number) => {
    const loadingKey = `${promptType}-${index}`;
    setIsGeneratingDetailImage(prev => ({ ...prev, [loadingKey]: true }));

    toast({ title: `Generating ${promptType} Image...`, description: `Prompt: "${individualPrompt.substring(0, 50)}..."` });
    
    const result = await generateImageFromPrompt(individualPrompt, storyData.userId, storyData.id, imageProvider);

    if (result.success && result.imageUrl && result.requestPrompt) {
      const newImage: GeneratedImage = {
        originalPrompt: individualPrompt,
        requestPrompt: result.requestPrompt,
        imageUrl: result.imageUrl,
      };
      
      // Add to generatedImages, ensuring no duplicates for the exact same originalPrompt
      const updatedImages = [
        ...(storyData.generatedImages || []).filter(img => img.originalPrompt !== individualPrompt),
        newImage,
      ];
      setStoryData({
        ...storyData,
        generatedImages: updatedImages
      });
      
      // Auto-save the story with the new image
      if (storyData.id && storyData.userId) {
        try {
          const storyToSave = { ...storyData, generatedImages: updatedImages };
          console.log('Auto-saving story with generatedImages:', storyToSave.generatedImages);
          await saveStory(storyToSave, storyData.userId);
          console.log('Auto-saved story with new image');
        } catch (error) {
          console.error('Failed to auto-save story:', error);
        }
      }
      
      toast({ title: `${promptType} Image Generated!`, description: `Image for "${individualPrompt.substring(0, 50)}..." is ready.`, className: 'bg-green-500 text-white' });
    } else {
      toast({ title: 'Image Generation Error', description: result.error || `Failed to generate image for "${individualPrompt.substring(0,50)}...".`, variant: 'destructive' });
    }
    setIsGeneratingDetailImage(prev => ({ ...prev, [loadingKey]: false }));
  };

  const handleGenerateAllDetailImages = async () => {
    if (!storyData.detailsPrompts) return;
    handleSetLoading('allDetailImages', true);
    toast({ title: 'Generating All Detail Images...', description: 'This may take a few moments.' });

    const { characterPrompts, itemPrompts, locationPrompts } = storyData.detailsPrompts;
    const allParsedPrompts: { name?: string, description: string, type: 'Character' | 'Item' | 'Location', key: string }[] = [];

    if (characterPrompts) {
      parseNamedPrompts(characterPrompts, 'Character').forEach(p => allParsedPrompts.push({ ...p, type: 'Character', key: `Character-${p.originalIndex}` }));
    }
    if (itemPrompts) {
      parseNamedPrompts(itemPrompts, 'Item').forEach(p => allParsedPrompts.push({ ...p, type: 'Item', key: `Item-${p.originalIndex}` }));
    }
    if (locationPrompts) {
      parseNamedPrompts(locationPrompts, 'Location').forEach(p => allParsedPrompts.push({ ...p, type: 'Location', key: `Location-${p.originalIndex}` }));
    }

    let newImages: GeneratedImage[] = [...(storyData.generatedImages || [])];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < allParsedPrompts.length; i++) {
      const { description, type, key, name } = allParsedPrompts[i];
      // Skip if already generated for this description during this batch or previously
      if (newImages.find(img => img.originalPrompt === description)) {
        console.log(`Skipping already processed prompt: ${description}`);
        continue;
      }
      
      setIsGeneratingDetailImage(prev => ({ ...prev, [key]: true }));
      toast({ title: `Generating ${type} Image for ${name || `Prompt ${i+1}`}...`, description: `"${description.substring(0, 50)}..."`});
      
      const result = await generateImageFromPrompt(description, storyData.userId, storyData.id, imageProvider);
      if (result.success && result.imageUrl && result.requestPrompt) {
        newImages = newImages.filter(img => img.originalPrompt !== description);
        newImages.push({ originalPrompt: description, requestPrompt: result.requestPrompt, imageUrl: result.imageUrl });
        successCount++;
      } else {
        errorCount++;
        toast({ title: `Error Generating ${type} Image for ${name || `Prompt ${i+1}`}`, description: result.error || `Failed for "${description.substring(0,50)}..."`, variant: 'destructive' });
      }
      setIsGeneratingDetailImage(prev => ({ ...prev, [key]: false }));
    }
    
    updateStoryData({ generatedImages: newImages });

    // Auto-save the story with the new images
    if (storyData.id && storyData.userId && successCount > 0) {
      try {
        await saveStory({ ...storyData, generatedImages: newImages }, storyData.userId);
        console.log(`Auto-saved story with ${successCount} new images`);
      } catch (error) {
        console.error('Failed to auto-save story:', error);
      }
    }

    if (successCount > 0) {
      toast({ title: 'Finished Generating Images!', description: `${successCount} images generated. ${errorCount > 0 ? `${errorCount} errors.` : ''}`, className: errorCount === 0 ? 'bg-green-500 text-white' : 'bg-yellow-500 text-black' });
    } else if (errorCount > 0 && allParsedPrompts.length > 0) {
      toast({ title: 'Image Generation Failed', description: `All ${errorCount} image generations failed. Please check prompts and try again.`, variant: 'destructive' });
    } else if (allParsedPrompts.length > 0) {
       toast({ title: 'No New Images Generated', description: 'All detail prompts may have already been processed or there were no new prompts to process.', variant: 'default' });
    }

    handleSetLoading('allDetailImages', false);
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

  // Handle "Generate All" button case
  if (showGenerateAllButton && promptType === 'All') {
    return (
      <Button 
        onClick={handleGenerateAllDetailImages}
        disabled={isLoading.allDetailImages}
        variant="outline"
        className="w-full"
      >
        {isLoading.allDetailImages ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating All Images...
          </>
        ) : (
          <>
            <ImageIcon className="mr-2 h-4 w-4" />
            Generate All Detail Images
          </>
        )}
      </Button>
    );
  }

  if (!promptsString) {
    return <p className="text-xs text-muted-foreground">No {promptType.toLowerCase()} prompts available yet. Generate details first.</p>;
  }

  const parsedPrompts = parseNamedPrompts(promptsString, promptType as 'Character' | 'Item' | 'Location');

  if (parsedPrompts.length === 0) {
    return <p className="text-xs text-muted-foreground">No {promptType.toLowerCase()} prompts found. Add some in the text area above, separating entries with a blank line.</p>;
  }

  return (
    <div className="space-y-3 mt-3">
      {parsedPrompts.map((promptDetail) => {
        const loadingKey = `${promptType}-${promptDetail.originalIndex}`;
        const existingImage = storyData.generatedImages?.find(img => 
          img.originalPrompt === promptDetail.description && 
          img.imageUrl && 
          !img.imageUrl.includes('.mp3')
        );
        const isCurrentlyGenerating = isGeneratingDetailImage[loadingKey] || false;

        return (
          <div key={loadingKey} className="p-3 border rounded-md bg-card/50">
            {promptDetail.name && <p className="text-sm font-semibold mb-1">{promptType}: {promptDetail.name}</p>}
            <p className={`text-xs text-muted-foreground mb-1 ${promptDetail.name ? 'ml-2' : ''}`}>
              {!promptDetail.name && <strong>{promptType} Prompt {promptDetail.originalIndex + 1}: </strong>}
              {promptDetail.description}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleGenerateIndividualDetailImage(promptDetail.description, promptDetail.originalIndex)}
              disabled={isLoading.allDetailImages || isCurrentlyGenerating}
              className="text-xs py-1 h-auto"
            >
              {isCurrentlyGenerating ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <ImageIcon className="mr-1 h-3 w-3" />
              )}
              {existingImage ? 'Re-generate Image' : 'Generate Image'}
            </Button>
            {isCurrentlyGenerating && !existingImage && (
              <div className="mt-2 flex items-center text-xs text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span>Generating image for {promptDetail.name || `${promptType} Prompt ${promptDetail.originalIndex + 1}`}...</span>
              </div>
            )}
            {existingImage?.imageUrl && (
              <div className="mt-2">
                <Label className="text-xs font-medium">Generated Image{promptDetail.name ? ` for ${promptDetail.name}` : ''}:</Label>
                <div className="relative aspect-video w-full max-w-sm overflow-hidden rounded-md border mt-1 group">
                  <Image
                    src={existingImage.imageUrl}
                    alt={`Generated image for ${promptType}: ${promptDetail.description.substring(0, 30)}...`}
                    fill
                    sizes="(max-width: 768px) 100vw, 400px"
                    style={{ objectFit: "contain" }}
                    className="bg-muted cursor-pointer transition-transform hover:scale-105"
                    priority
                    unoptimized
                    onClick={() => setPopupImage({ 
                      src: existingImage.imageUrl, 
                      alt: `${promptType}: ${promptDetail.name || promptDetail.description.substring(0, 30)}` 
                    })}
                  />
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        const altText = `${promptType}_${promptDetail.name || `Prompt_${promptDetail.originalIndex + 1}`}`;
                        handleDownloadImage(existingImage.imageUrl, altText);
                      }}
                      className="bg-white/90 hover:bg-white text-black"
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Full prompt: "{existingImage.requestPrompt}"</p>
              </div>
            )}
          </div>
        );
      })}
      
      <ImagePopup
        src={popupImage?.src || ''}
        alt={popupImage?.alt || ''}
        isOpen={!!popupImage}
        onClose={() => setPopupImage(null)}
      />
    </div>
  );
}
