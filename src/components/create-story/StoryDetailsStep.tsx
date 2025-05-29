import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Loader2, Edit2, RefreshCw } from 'lucide-react';
import { generateCharacterPrompts, saveStory } from '@/actions/storyActions';
import { useToast } from '@/hooks/use-toast';
import type { UseStoryStateReturn } from '@/hooks/useStoryState';
import type { StoryCharacterLocationItemPrompts } from '@/types/story';
import type { ImageStyleId } from '@/types/imageStyles';
import { IMAGE_STYLES, DEFAULT_STYLE_ID } from '@/types/imageStyles';
import { DetailImageManager } from './DetailImageManager';

interface StoryDetailsStepProps {
  storyState: UseStoryStateReturn;
}

export function StoryDetailsStep({ storyState }: StoryDetailsStepProps) {
  const { toast } = useToast();
  const {
    storyData,
    updateStoryData,
    isLoading,
    handleSetLoading,
    setCurrentStep,
    isCharacterPromptsEditing,
    setIsCharacterPromptsEditing,
    isItemPromptsEditing,
    setIsItemPromptsEditing,
    isLocationPromptsEditing,
    setIsLocationPromptsEditing,
    imageProvider,
    setImageProvider
  } = storyState;

  const handleGenerateDetails = async () => {
    if (!storyData.generatedScript) return;
    handleSetLoading('details', true);
    setIsCharacterPromptsEditing(false);
    setIsItemPromptsEditing(false);
    setIsLocationPromptsEditing(false);
    
    const result = await generateCharacterPrompts({ 
      script: storyData.generatedScript,
      imageStyleId: storyData.imageStyleId,
      imageProvider: imageProvider,
    });
    if (result.success && result.data) {
      const updatedStoryData = {
        ...storyData,
        detailsPrompts: result.data as StoryCharacterLocationItemPrompts
      };
      
      updateStoryData({ detailsPrompts: result.data as StoryCharacterLocationItemPrompts });
      
      // Auto-save the story with the new details
      if (storyData.id && storyData.userId) {
        try {
          await saveStory(updatedStoryData, storyData.userId);
          console.log('Auto-saved story with new character/location/item details');
        } catch (error) {
          console.error('Failed to auto-save story after details generation:', error);
        }
      }
      
      setCurrentStep(3);
      toast({ title: 'Details Generated!', description: 'Character, item, and location prompts are ready.', className: 'bg-primary text-primary-foreground' });
    } else {
      toast({ title: 'Error', description: result.error || 'Failed to generate details.', variant: 'destructive' });
    }
    handleSetLoading('details', false);
  };

  const handleRegeneratePrompts = async () => {
    if (!storyData.generatedScript) return;
    handleSetLoading('details', true);
    
    const result = await generateCharacterPrompts({ 
      script: storyData.generatedScript,
      imageStyleId: storyData.imageStyleId,
      imageProvider: imageProvider,
    });
    if (result.success && result.data) {
      const updatedStoryData = {
        ...storyData,
        detailsPrompts: result.data as StoryCharacterLocationItemPrompts
      };
      
      updateStoryData({ detailsPrompts: result.data as StoryCharacterLocationItemPrompts });
      
      // Auto-save the story with the new details
      if (storyData.id && storyData.userId) {
        try {
          await saveStory(updatedStoryData, storyData.userId);
          console.log('Auto-saved story with regenerated character/location/item details');
        } catch (error) {
          console.error('Failed to auto-save story after details regeneration:', error);
        }
      }
      
      toast({ 
        title: 'Prompts Regenerated!', 
        description: 'Character, item, and location prompts updated with consistency features.', 
        className: 'bg-primary text-primary-foreground' 
      });
    } else {
      toast({ title: 'Error', description: result.error || 'Failed to regenerate details.', variant: 'destructive' });
    }
    handleSetLoading('details', false);
  };

  if (!storyData.generatedScript) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Step 2: Character & Scene Details
          </CardTitle>
          <CardDescription>
            Generate a script first to continue with character and scene details.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Step 2: Character & Scene Details
        </CardTitle>
        <CardDescription>
          Generate detailed prompts for characters, items, and locations in your story.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* AI Model and Art Style Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-md bg-muted/50">
          <div className="space-y-2">
            <Label>Image Provider for Details</Label>
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

          <div className="space-y-2">
            <Label>Art Style</Label>
            <Select 
              value={storyData.imageStyleId || DEFAULT_STYLE_ID} 
              onValueChange={(value: ImageStyleId) => updateStoryData({ imageStyleId: value })}
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

        <div className="flex gap-2">
          <Button 
            onClick={handleGenerateDetails}
            disabled={isLoading.details}
            className="flex-1"
          >
            {isLoading.details ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Details...
              </>
            ) : (
              <>
                <Users className="mr-2 h-4 w-4" />
                Generate Character & Scene Details
              </>
            )}
          </Button>
          
          {storyData.detailsPrompts && (
            <Button 
              onClick={handleRegeneratePrompts}
              disabled={isLoading.details}
              variant="outline"
              className="px-3"
              title="Regenerate prompts with updated consistency requirements"
            >
              {isLoading.details ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>

        {storyData.detailsPrompts && (
          <div className="space-y-6 mt-6">
            {/* Character Prompts */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Character Prompts</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCharacterPromptsEditing(!isCharacterPromptsEditing)}
                >
                  <Edit2 className="mr-1 h-3 w-3" />
                  {isCharacterPromptsEditing ? 'Save' : 'Edit'}
                </Button>
              </div>
              
              {isCharacterPromptsEditing ? (
                <Textarea
                  value={storyData.detailsPrompts.characterPrompts || ''}
                  onChange={(e) => updateStoryData({
                    detailsPrompts: {
                      ...storyData.detailsPrompts!,
                      characterPrompts: e.target.value
                    }
                  })}
                  rows={4}
                  className="text-sm"
                  placeholder="Enter character descriptions, one per paragraph..."
                />
              ) : (
                <div className="p-3 border rounded-md bg-muted/50 text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {storyData.detailsPrompts.characterPrompts || 'No character prompts generated yet.'}
                </div>
              )}

              <DetailImageManager 
                storyState={storyState}
                promptType="Character"
                promptsString={storyData.detailsPrompts.characterPrompts}
              />
            </div>

            <Separator />

            {/* Item Prompts */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Item Prompts</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsItemPromptsEditing(!isItemPromptsEditing)}
                >
                  <Edit2 className="mr-1 h-3 w-3" />
                  {isItemPromptsEditing ? 'Save' : 'Edit'}
                </Button>
              </div>
              
              {isItemPromptsEditing ? (
                <Textarea
                  value={storyData.detailsPrompts.itemPrompts || ''}
                  onChange={(e) => updateStoryData({
                    detailsPrompts: {
                      ...storyData.detailsPrompts!,
                      itemPrompts: e.target.value
                    }
                  })}
                  rows={4}
                  className="text-sm"
                  placeholder="Enter item descriptions, one per paragraph..."
                />
              ) : (
                <div className="p-3 border rounded-md bg-muted/50 text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {storyData.detailsPrompts.itemPrompts || 'No item prompts generated yet.'}
                </div>
              )}

              <DetailImageManager 
                storyState={storyState}
                promptType="Item"
                promptsString={storyData.detailsPrompts.itemPrompts}
              />
            </div>

            <Separator />

            {/* Location Prompts */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Location Prompts</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsLocationPromptsEditing(!isLocationPromptsEditing)}
                >
                  <Edit2 className="mr-1 h-3 w-3" />
                  {isLocationPromptsEditing ? 'Save' : 'Edit'}
                </Button>
              </div>
              
              {isLocationPromptsEditing ? (
                <Textarea
                  value={storyData.detailsPrompts.locationPrompts || ''}
                  onChange={(e) => updateStoryData({
                    detailsPrompts: {
                      ...storyData.detailsPrompts!,
                      locationPrompts: e.target.value
                    }
                  })}
                  rows={4}
                  className="text-sm"
                  placeholder="Enter location descriptions, one per paragraph..."
                />
              ) : (
                <div className="p-3 border rounded-md bg-muted/50 text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {storyData.detailsPrompts.locationPrompts || 'No location prompts generated yet.'}
                </div>
              )}

              <DetailImageManager 
                storyState={storyState}
                promptType="Location"
                promptsString={storyData.detailsPrompts.locationPrompts}
              />
            </div>

            {/* Generate All Detail Images Button */}
            <div className="pt-4">
              <DetailImageManager 
                storyState={storyState}
                promptType="All"
                promptsString="generate-all"
                showGenerateAllButton={true}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
