import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Bot, Loader2, FileText } from 'lucide-react';
import { generateTitle, generateScript, saveStory } from '@/actions/storyActions';
import { prepareScriptChunksAI } from '@/utils/narrationUtils';
import { useToast } from '@/hooks/use-toast';
import type { UseStoryStateReturn } from '@/hooks/useStoryState';

interface StoryPromptStepProps {
  storyState: UseStoryStateReturn;
}

export function StoryPromptStep({ storyState }: StoryPromptStepProps) {
  const { toast } = useToast();
  const {
    storyData,
    updateStoryData,
    isLoading,
    handleSetLoading,
    setCurrentStep,
    isScriptManuallyEditing,
    setIsScriptManuallyEditing
  } = storyState;

  const handleGenerateScript = async () => {
    if (!storyData.userPrompt.trim()) {
      toast({ title: 'Missing Prompt', description: 'Please enter a story prompt.', variant: 'destructive' });
      return;
    }
    
    handleSetLoading('script', true);
    setIsScriptManuallyEditing(false); 

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
      // Split the script into chunks for narration using AI
      const scriptText = scriptResult.data.script;
      handleSetLoading('scriptChunks', true);
      const narrationChunks = await prepareScriptChunksAI(scriptText);
      handleSetLoading('scriptChunks', false);
      
      const updatedStoryData = {
        ...storyData,
        generatedScript: scriptText,
        narrationChunks
      };
      
      updateStoryData({
        generatedScript: scriptText,
        narrationChunks
      });
      
      // Auto-save the story with the new script
      if (storyData.id && storyData.userId) {
        try {
          await saveStory(updatedStoryData, storyData.userId);
          console.log('Auto-saved story with new script');
        } catch (error) {
          console.error('Failed to auto-save story after script generation:', error);
        }
      }
      
      setCurrentStep(2);
      toast({ title: 'Script Generated!', description: 'Your story script is ready.', className: 'bg-primary text-primary-foreground' });
    } else {
      toast({ title: 'Error', description: scriptResult.error || 'Failed to generate script.', variant: 'destructive' });
    }
    handleSetLoading('script', false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Step 1: Story Prompt & Script Generation
        </CardTitle>
        <CardDescription>
          Describe your story idea and we'll generate a complete script for you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Story Title (Optional)</Label>
          <Input
            id="title"
            placeholder="Enter a title for your story (or we'll generate one)"
            value={storyData.title}
            onChange={(e) => updateStoryData({ title: e.target.value })}
            disabled={isLoading.script || isLoading.titleGen}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="prompt">Story Prompt *</Label>
          <Textarea
            id="prompt"
            placeholder="Describe your story idea here... (e.g., 'A young wizard discovers a magical forest where animals can talk and must help them solve an ancient mystery.')"
            value={storyData.userPrompt}
            onChange={(e) => updateStoryData({ userPrompt: e.target.value })}
            rows={4}
            disabled={isLoading.script}
          />
        </div>

        <Button 
          onClick={handleGenerateScript}
          disabled={!storyData.userPrompt.trim() || isLoading.script}
          className="w-full"
        >
          {isLoading.script ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating Story...
            </>
          ) : (
            <>
              <Bot className="mr-2 h-4 w-4" />
              Generate Story Script
            </>
          )}
        </Button>

        {storyData.generatedScript && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Generated Script
              </Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsScriptManuallyEditing(!isScriptManuallyEditing)}
              >
                {isScriptManuallyEditing ? 'Save' : 'Edit'}
              </Button>
            </div>
            
            {isScriptManuallyEditing ? (
              <Textarea
                value={storyData.generatedScript}
                onChange={(e) => updateStoryData({ generatedScript: e.target.value })}
                rows={8}
                className="text-sm"
              />
            ) : (
              <div className="p-3 border rounded-md bg-muted/50 text-sm whitespace-pre-wrap max-h-60 overflow-y-auto">
                {storyData.generatedScript}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
