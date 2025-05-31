
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bot, Loader2, FileText, Edit3, Save, Settings } from 'lucide-react'; // Added Settings
import Link from 'next/link'; // Added Link
import { generateTitle, generateScript, saveStory } from '@/actions/storyActions';
import { prepareScriptChunksAI } from '@/utils/narrationUtils';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useCallback } from 'react';
import { debounce } from '@/utils/debounce';
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
    setIsScriptManuallyEditing,
    userApiKeys, // Get userApiKeys from storyState
    apiKeysLoading // Get apiKeysLoading from storyState
  } = storyState;

  const [activeTab, setActiveTab] = useState('ai-generate');
  const [manualScript, setManualScript] = useState(storyData.generatedScript || '');
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  const googleKeyMissing = !apiKeysLoading && !userApiKeys?.googleApiKey;

  const autoSaveStory = useCallback(
    debounce(async (title: string, script: string) => {
      if (!title.trim() || !script.trim() || !storyData.userId) return;
      if (googleKeyMissing && activeTab === 'ai-generate') return; // Don't autosave if key is missing for AI mode

      setIsAutoSaving(true);
      try {
        const narrationChunks = await prepareScriptChunksAI(script, storyData.userId);
        
        const updatedStoryData = {
          ...storyData,
          title: title.trim(),
          generatedScript: script,
          narrationChunks
        };
        
        const saveResult = await saveStory(updatedStoryData, storyData.userId);
        
        if (saveResult.success) {
          if (saveResult.storyId && !storyData.id) {
            updateStoryData({ 
              id: saveResult.storyId,
              title: title.trim(),
              generatedScript: script,
              narrationChunks 
            });
            toast({
              title: 'Story Saved!',
              description: 'Your story has been automatically saved.',
              className: 'bg-green-500 text-white'
            });
          } else {
            updateStoryData({ 
              title: title.trim(),
              generatedScript: script,
              narrationChunks 
            });
          }
        }
      } catch (error: any) {
        if (error.message && error.message.toLowerCase().includes("api key not configured")) {
           toast({ title: "Action Required", description: "Google API key needed to prepare script chunks. Please set it in Account Settings.", variant: "destructive" });
        } else {
           console.error('Auto-save error:', error);
        }
      } finally {
        setIsAutoSaving(false);
      }
    }, 2000),
    [storyData, updateStoryData, toast, googleKeyMissing, activeTab]
  );

  const handleManualScriptChange = (value: string) => {
    setManualScript(value);
    if (storyData.title.trim() && value.trim()) {
      autoSaveStory(storyData.title, value);
    }
  };

  const handleTitleChange = (value: string) => {
    updateStoryData({ title: value });
    if (value.trim() && manualScript.trim() && activeTab === 'manual') {
      autoSaveStory(value, manualScript);
    }
  };

  const handleGenerateScript = async () => {
    if (googleKeyMissing) {
      toast({ title: 'API Key Required', description: 'Please configure your Google API Key in Account Settings to generate scripts.', variant: 'destructive' });
      return;
    }
    if (!storyData.userPrompt.trim()) {
      toast({ title: 'Missing Prompt', description: 'Please enter a story prompt.', variant: 'destructive' });
      return;
    }
    
    handleSetLoading('script', true);
    setIsScriptManuallyEditing(false); 

    let currentTitle = storyData.title;
    if (!currentTitle.trim() && storyData.userPrompt.trim()) {
      handleSetLoading('titleGen', true);
      const titleResult = await generateTitle({ userPrompt: storyData.userPrompt, userId: storyData.userId });
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
    
    const scriptResult = await generateScript({ prompt: storyData.userPrompt, userId: storyData.userId });
    if (scriptResult.success && scriptResult.data) {
      const scriptText = scriptResult.data.script;
      handleSetLoading('scriptChunks', true);
      const narrationChunks = await prepareScriptChunksAI(scriptText, storyData.userId);
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
      
      if (storyData.userId) {
        try {
          handleSetLoading('save', true);
          const saveResult = await saveStory(updatedStoryData, storyData.userId);
          handleSetLoading('save', false);
          
          if (saveResult.success) {
            if (saveResult.storyId && !storyData.id) {
              updateStoryData({ id: saveResult.storyId });
              toast({
                title: 'Story Saved!',
                description: 'Your story has been automatically saved to your account.',
                className: 'bg-green-500 text-white'
              });
            }
          } else {
            toast({
              title: 'Auto-Save Failed',
              description: saveResult.error || 'Could not save your story. Please use the Save button below.',
              variant: 'destructive'
            });
          }
        } catch (error) {
          handleSetLoading('save', false);
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

  const handleContinueWithManualScript = async () => {
    if (googleKeyMissing) { // Also check for Google key for chunking
      toast({ title: 'API Key Required', description: 'Google API Key needed for script processing. Please set it in Account Settings.', variant: 'destructive' });
      return;
    }
    if (!storyData.title.trim()) {
      toast({ title: 'Missing Title', description: 'Please enter a story title.', variant: 'destructive' });
      return;
    }
    if (!manualScript.trim()) {
      toast({ title: 'Missing Script', description: 'Please enter your story script.', variant: 'destructive' });
      return;
    }

    handleSetLoading('scriptChunks', true);
    try {
      const narrationChunks = await prepareScriptChunksAI(manualScript, storyData.userId);
      
      updateStoryData({
        generatedScript: manualScript,
        narrationChunks
      });

      if (storyData.userId) {
        handleSetLoading('save', true);
        const updatedStoryData = {
          ...storyData,
          title: storyData.title.trim(),
          generatedScript: manualScript,
          narrationChunks
        };
        
        const saveResult = await saveStory(updatedStoryData, storyData.userId);
        handleSetLoading('save', false);
        
        if (saveResult.success && saveResult.storyId && !storyData.id) {
          updateStoryData({ id: saveResult.storyId });
        }
      }

      setCurrentStep(2);
      toast({ 
        title: 'Ready to Continue!', 
        description: 'Your story script has been processed.',
        className: 'bg-primary text-primary-foreground' 
      });
    } catch (error: any) {
      if (error.message && error.message.toLowerCase().includes("api key not configured")) {
        toast({ title: "Action Required", description: "Google API key needed to process script chunks. Please set it in Account Settings.", variant: "destructive" });
      } else {
        console.error('Error processing manual script:', error);
        toast({ title: 'Processing Error', description: 'Failed to process your script. Please try again.', variant: 'destructive' });
      }
    } finally {
      handleSetLoading('scriptChunks', false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Step 1: Story Script
        </CardTitle>
        <CardDescription>
          Choose how you want to create your story script - generate with AI or provide your own.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ai-generate" className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              AI Generate
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <Edit3 className="h-4 w-4" />
              Write My Own
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai-generate" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Story Title (Optional)</Label>
              <Input
                id="title"
                placeholder="Enter a title for your story (or we'll generate one)"
                value={storyData.title}
                onChange={(e) => updateStoryData({ title: e.target.value })}
                disabled={isLoading.script || isLoading.titleGen || apiKeysLoading}
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
                disabled={isLoading.script || apiKeysLoading}
              />
            </div>

            <Button 
              onClick={handleGenerateScript}
              disabled={!storyData.userPrompt.trim() || isLoading.script || apiKeysLoading || googleKeyMissing}
              className="w-full"
            >
              {isLoading.script || apiKeysLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {apiKeysLoading ? "Checking API Keys..." : "Generating Story..."}
                </>
              ) : (
                <>
                  <Bot className="mr-2 h-4 w-4" />
                  Generate Story Script
                </>
              )}
            </Button>
            {googleKeyMissing && (
              <p className="text-xs text-destructive text-center mt-2">
                Google API Key required for AI script generation. Please set it in <Link href="/settings" className="underline">Account Settings</Link>.
              </p>
            )}

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
          </TabsContent>

          <TabsContent value="manual" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="manual-title">Story Title *</Label>
              <div className="relative">
                <Input
                  id="manual-title"
                  placeholder="Enter your story title"
                  value={storyData.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  disabled={isLoading.scriptChunks || isLoading.save || apiKeysLoading}
                />
                {isAutoSaving && (
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-script">Story Script *</Label>
              <div className="relative">
                <Textarea
                  id="manual-script"
                  placeholder="Paste or type your complete story script here..."
                  value={manualScript}
                  onChange={(e) => handleManualScriptChange(e.target.value)}
                  rows={12}
                  disabled={isLoading.scriptChunks || isLoading.save || apiKeysLoading}
                  className="text-sm"
                />
                {isAutoSaving && (
                  <div className="absolute right-2 top-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground bg-background px-2 py-1 rounded">
                      <Save className="h-3 w-3" />
                      Auto-saving...
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Your story will automatically save as you type when both title and script are provided.
              </p>
            </div>

            <Button 
              onClick={handleContinueWithManualScript}
              disabled={!storyData.title.trim() || !manualScript.trim() || isLoading.scriptChunks || isLoading.save || apiKeysLoading || googleKeyMissing}
              className="w-full"
            >
              {isLoading.scriptChunks || isLoading.save || apiKeysLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {apiKeysLoading ? "Checking API Keys..." : "Processing Script..."}
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Continue with My Script
                </>
              )}
            </Button>
            {googleKeyMissing && (
              <p className="text-xs text-destructive text-center mt-2">
                Google API Key required for script processing. Please set it in <Link href="/settings" className="underline">Account Settings</Link>.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

