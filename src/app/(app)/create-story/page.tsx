
"use client";

import type { Story, GeneratedImage, StoryCharacterLocationItemPrompts, ElevenLabsVoice } from '@/types/story';
import type { NarrationChunk } from '@/types/narration';
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { splitScriptIntoChunks } from '@/utils/scriptSplitter'; // Keep for manual edit fallback
import { prepareScriptChunksAI, prepareScriptChunksSimple, calculateTotalNarrationDuration } from '@/utils/narrationUtils';
import { v4 as uuidv4 } from 'uuid';
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
import { Bot, Clapperboard, ImageIcon, Loader2, Mic, Save, Sparkles, FileText, Image as LucideImage, AlertCircle, CheckCircle, Info, Pencil, ListMusic, Upload, Film, Edit2, Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

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
  scriptChunks: [], // Initialize
  narrationChunks: [], // Initialize
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
  const [activeAccordionItem, setActiveAccordionItem] = useState<string | undefined>(`step-${currentStep}`);
  const [pageLoading, setPageLoading] = useState(true);
  const [imagesPerMinute, setImagesPerMinute] = useState(5);
  const [isSaveConfirmOpen, setIsSaveConfirmOpen] = useState(false);
  const [elevenLabsVoices, setElevenLabsVoices] = useState<ElevenLabsVoice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | undefined>(undefined);
  const [narrationSource, setNarrationSource] = useState<'generate' | 'upload'>('generate');
  const [uploadedAudioFileName, setUploadedAudioFileName] = useState<string | null>(null);
  const [isScriptManuallyEditing, setIsScriptManuallyEditing] = useState(false);
  const [isCharacterPromptsEditing, setIsCharacterPromptsEditing] = useState(false);
  const [isItemPromptsEditing, setIsItemPromptsEditing] = useState(false);
  const [isLocationPromptsEditing, setIsLocationPromptsEditing] = useState(false);
  const [isImagePromptEditing, setIsImagePromptEditing] = useState<boolean[]>([]);
  const [isGeneratingDetailImage, setIsGeneratingDetailImage] = useState<Record<string, boolean>>({});
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const [currentNarrationChunkIndex, setCurrentNarrationChunkIndex] = useState<number>(-1);
  const [processingAllMode, setProcessingAllMode] = useState<boolean>(false); // New state for "Generate All"

interface ParsedPrompt {
  name?: string;
  description: string;
  originalIndex: number; 
}

const parseNamedPrompts = (rawPrompts: string | undefined, type: 'Character' | 'Item' | 'Location'): ParsedPrompt[] => {
  if (!rawPrompts) return [];
  
  // Normalize escaped newlines to actual newlines
  let normalizedPrompts = rawPrompts.replace(/\\n/g, "\n");

  const cleanPrompts = normalizedPrompts
    .replace(/^(Character Prompts:|Item Prompts:|Location Prompts:)\s*\n*/i, '')
    .trim();

  if (!cleanPrompts) return [];

  return cleanPrompts.split(/\n\s*\n/) 
    .map((block, index) => {
      const lines = block.trim().split('\n').map(l => l.trim()).filter(l => l);
      if (lines.length === 0) {
        return null; 
      }

      let name: string | undefined = undefined;
      let description: string;

      if (lines.length > 1) {
        // Attempt to identify if the first line is a name.
        // This heuristic assumes a name is typically shorter and doesn't end with punctuation like a sentence.
        // And the subsequent lines form the description.
        const firstLineIsLikelyName = lines[0].length < 60 && !/[\.?!]$/.test(lines[0]) && lines.slice(1).join(' ').length > 0;

        if (firstLineIsLikelyName) {
          name = lines[0];
          description = lines.slice(1).join('\n');
        } else {
          description = lines.join('\n');
        }
      } else {
        description = lines[0];
      }
      
      if (!description && name) { // If parsing resulted in empty description but a name was found
        description = name;       // Treat the name as the description
        name = undefined;         // Clear the name
      }

      if (!description) return null; // If there's genuinely no description content

      return { name, description, originalIndex: index };
    })
    .filter(p => p !== null) as ParsedPrompt[];
};


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

    let initialStep = 1;
    if (storyId && user) {
      setPageLoading(true);
      setFirebaseError(null);
      
      getStory(storyId, user.uid)
        .then(async response => { // Make the callback async
          if (response.success && response.data) {
                    let loadedStory = response.data; // Use let to allow modification
                     if (loadedStory.createdAt && !(loadedStory.createdAt instanceof Date)) {
                        loadedStory.createdAt = (loadedStory.createdAt as any).toDate();
                    }
                    if (loadedStory.updatedAt && !(loadedStory.updatedAt instanceof Date)) {
                        loadedStory.updatedAt = (loadedStory.updatedAt as any).toDate();
                    }
                    
                    // Proactively prepare text chunks if script exists but chunks don't
                    if (loadedStory.generatedScript && (!loadedStory.narrationChunks || loadedStory.narrationChunks.length === 0)) {
                      console.log("Loaded story has script but no narration chunks. Attempting to prepare them now...");
                      try {
                        const newNarrationChunks = await prepareScriptChunksAI(loadedStory.generatedScript);
                        if (newNarrationChunks.length > 0) {
                          // Update the loadedStory object directly before setting state
                          loadedStory = { ...loadedStory, narrationChunks: newNarrationChunks };
                          toast({ title: 'Script Chunks Prepared', description: `AI created ${newNarrationChunks.length} text chunks for the loaded story.`, className: 'bg-primary text-primary-foreground'});
                        } else {
                          // Ensure narrationChunks is at least an empty array if AI returns nothing
                          loadedStory = { ...loadedStory, narrationChunks: [] };
                          toast({ title: 'Chunk Preparation Note', description: 'Could not automatically prepare text chunks for this loaded story (AI returned no chunks).', variant: 'default'});
                        }
                      } catch (error) {
                        console.error("Error proactively preparing chunks for loaded story:", error);
                        // Ensure narrationChunks is at least an empty array on error
                        loadedStory = { ...loadedStory, narrationChunks: [] };
                        toast({ title: 'Chunk Preparation Error', description: 'Failed to auto-prepare text chunks.', variant: 'destructive'});
                      }
                    }
                    
                    setStoryData(loadedStory); // This sets the initial loadedStory (potentially with new chunks)

                    if (loadedStory.elevenLabsVoiceId) {
                      setSelectedVoiceId(loadedStory.elevenLabsVoiceId);
                      setNarrationSource('generate');
                    } else if (loadedStory.narrationAudioUrl && (!loadedStory.narrationChunks || loadedStory.narrationChunks.length === 0) ) { // Only consider legacy URL if no chunks
                      setNarrationSource('upload'); // Or treat as legacy generated
                      setUploadedAudioFileName("Previously uploaded audio (legacy)");
                    }
            
                    // updateStoryData is redundant if setStoryData(loadedStory) is comprehensive
                    // updateStoryData({
                    //     generatedScript: loadedStory.generatedScript || undefined,
                    //     detailsPrompts: loadedStory.detailsPrompts || { characterPrompts: "", itemPrompts: "", locationPrompts: "" },
                    //     narrationChunks: loadedStory.narrationChunks || undefined // Ensure narrationChunks are part of the state
                    // });


                    // Determine initial step based on chunked narration primarily
                    if (loadedStory.imagePrompts && loadedStory.imagePrompts.length > 0) initialStep = 4; // Assuming images depend on prompts from chunks
                    else if (loadedStory.narrationChunks && loadedStory.narrationChunks.length > 0 && loadedStory.narrationChunks.every(c => c.audioUrl)) initialStep = 4; // All chunks narrated
                    else if (loadedStory.narrationChunks && loadedStory.narrationChunks.length > 0) initialStep = 3; // Chunks exist (text or partial audio)
                    else if (loadedStory.narrationAudioUrl) initialStep = 3; // Legacy audio
                    else if (loadedStory.detailsPrompts && (loadedStory.detailsPrompts.characterPrompts || loadedStory.detailsPrompts.itemPrompts || loadedStory.detailsPrompts.locationPrompts)) initialStep = 2;
                    else if (loadedStory.generatedScript) initialStep = 2; // Script exists, implies chunks can be made
                    else initialStep = 1;
            
            setCurrentStep(initialStep);
            setActiveAccordionItem(`step-${initialStep}`);
            if (loadedStory.imagePrompts) {
                setIsImagePromptEditing(Array(loadedStory.imagePrompts.length).fill(false));
            }

          } else {
            toast({ title: 'Error Loading Story', description: response.error || 'Failed to load story. Creating a new one.', variant: 'destructive' });
             setStoryData({...initialStoryState, userId: user.uid }); // Ensure all initial fields are reset
             setCurrentStep(1);
             setActiveAccordionItem('step-1');
          }
        })
        .catch(error => {
          console.error("Firebase connection error:", error);
          setFirebaseError("Connection to Firebase failed. If you're using an ad blocker or privacy extension, please disable it for this site.");
          toast({
            title: 'Firebase Connection Error',
            description: 'Connection to Firebase failed. If you are using an ad blocker or privacy extension, please disable it for this site.',
            variant: 'destructive'
          });
        })
        .finally(() => setPageLoading(false));
    } else {
       setPageLoading(false);
       if(user?.uid) {
        setStoryData(prev => ({...prev, userId: user.uid, generatedScript: prev.generatedScript || undefined}));
       }
       setCurrentStep(initialStep);
       setActiveAccordionItem(`step-${initialStep}`);
    }
  }, [storyId, user, router, toast, authLoading]);

  useEffect(() => {
    setActiveAccordionItem(`step-${currentStep}`);
  }, [currentStep]);

  // Effect to automatically process the next narration chunk WHEN IN "PROCESSING ALL" MODE
  useEffect(() => {
    if (processingAllMode && currentNarrationChunkIndex >= 0 && storyData.narrationChunks && currentNarrationChunkIndex < storyData.narrationChunks.length && (selectedVoiceId || storyData.elevenLabsVoiceId) && narrationSource === 'generate') {
      // Call handleGenerateNarration without an index to process the currentNarrationChunkIndex in sequence
      // The isLoading.narration check might be tricky here; handleGenerateNarration itself manages this.
      // We rely on handleGenerateNarration to advance currentNarrationChunkIndex or set it to -1.
      console.log(`useEffect detected processingAllMode for chunk index: ${currentNarrationChunkIndex}`);
      handleGenerateNarration();
    } else if (processingAllMode && currentNarrationChunkIndex === -1) {
      // This means the "Generate All" sequence has finished or was interrupted.
      console.log("useEffect detected end of processingAllMode sequence.");
      setProcessingAllMode(false); // Turn off "generate all" mode
      // isLoading.narration should have been set to false by handleGenerateNarration
      if (isLoading.narration) { // Safety check
          handleSetLoading('narration', false);
      }
    }
  }, [currentNarrationChunkIndex, processingAllMode, storyData.narrationChunks, storyData.elevenLabsVoiceId, selectedVoiceId, narrationSource]); // Removed isLoading.narration from deps, let handleGenerateNarration manage it.


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
      
      updateStoryData({
        generatedScript: scriptText,
        // scriptChunks: scriptChunks, // scriptChunks in storyData might be deprecated if narrationChunks holds the text
        narrationChunks
      });
      
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
    setIsCharacterPromptsEditing(false);
    setIsItemPromptsEditing(false);
    setIsLocationPromptsEditing(false);
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

  const handleGenerateIndividualDetailImage = async (promptType: 'Character' | 'Item' | 'Location', individualPrompt: string, index: number) => {
    const loadingKey = `${promptType}-${index}`;
    setIsGeneratingDetailImage(prev => ({ ...prev, [loadingKey]: true }));

    toast({ title: `Generating ${promptType} Image...`, description: `Prompt: "${individualPrompt.substring(0, 50)}..."` });
    // Pass userId and storyId to store images in Firebase Storage
    const result = await generateImageFromPrompt(individualPrompt, storyData.userId, storyData.id);

    if (result.success && result.imageUrl && result.requestPrompt) {
      const newImage: GeneratedImage = {
        originalPrompt: individualPrompt,
        requestPrompt: result.requestPrompt,
        imageUrl: result.imageUrl,
      };
      // Add to generatedImages, ensuring no duplicates for the exact same originalPrompt
      setStoryData(prev => ({
        ...prev,
        generatedImages: [
          ...(prev.generatedImages || []).filter(img => img.originalPrompt !== individualPrompt),
          newImage,
        ]
      }));
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
      
      setIsGeneratingDetailImage(prev => ({ ...prev, [key]: true })); // Show individual loading
      toast({ title: `Generating ${type} Image for ${name || `Prompt ${i+1}`}...`, description: `"${description.substring(0, 50)}..."`});
      // Pass userId and storyId to store images in Firebase Storage
      const result = await generateImageFromPrompt(description, storyData.userId, storyData.id); // Use description as the prompt
      if (result.success && result.imageUrl && result.requestPrompt) {
        newImages = newImages.filter(img => img.originalPrompt !== description); // Remove old if any
        newImages.push({ originalPrompt: description, requestPrompt: result.requestPrompt, imageUrl: result.imageUrl });
        successCount++;
      } else {
        errorCount++;
        toast({ title: `Error Generating ${type} Image for ${name || `Prompt ${i+1}`}`, description: result.error || `Failed for "${description.substring(0,50)}..."`, variant: 'destructive' });
      }
      setIsGeneratingDetailImage(prev => ({ ...prev, [key]: false }));
    }
    
    updateStoryData({ generatedImages: newImages });

    if (successCount > 0) {
      toast({ title: 'Finished Generating Images!', description: `${successCount} images generated. ${errorCount > 0 ? `${errorCount} errors.` : ''}`, className: errorCount === 0 ? 'bg-green-500 text-white' : 'bg-yellow-500 text-black' });
    } else if (errorCount > 0 && allParsedPrompts.length > 0) { // only show "all failed" if there were prompts to begin with
      toast({ title: 'Image Generation Failed', description: `All ${errorCount} image generations failed. Please check prompts and try again.`, variant: 'destructive' });
    } else if (allParsedPrompts.length > 0) { // If there were prompts but none were new/generated
       toast({ title: 'No New Images Generated', description: 'All detail prompts may have already been processed or there were no new prompts to process.', variant: 'default' });
    }


    handleSetLoading('allDetailImages', false);
  };

  const renderDetailPromptsWithImages = (promptsString: string | undefined, promptType: 'Character' | 'Item' | 'Location') => {
    if (!promptsString) {
      return <p className="text-xs text-muted-foreground">No {promptType.toLowerCase()} prompts available yet. Generate details first.</p>;
    }

    const parsedPrompts = parseNamedPrompts(promptsString, promptType);

    if (parsedPrompts.length === 0) {
      return <p className="text-xs text-muted-foreground">No {promptType.toLowerCase()} prompts found. Add some in the text area above, separating entries with a blank line.</p>;
    }

    return (
      <div className="space-y-3 mt-3">
        {parsedPrompts.map((promptDetail) => {
          const loadingKey = `${promptType}-${promptDetail.originalIndex}`;
          // individualPrompt for image generation is promptDetail.description
          const existingImage = storyData.generatedImages?.find(img => img.originalPrompt === promptDetail.description);
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
                onClick={() => handleGenerateIndividualDetailImage(promptType, promptDetail.description, promptDetail.originalIndex)}
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
                  <div className="relative aspect-video w-full max-w-sm overflow-hidden rounded-md border mt-1">
                    <Image
                      src={existingImage.imageUrl}
                      alt={`Generated image for ${promptType}: ${promptDetail.description.substring(0, 30)}...`}
                      fill
                      sizes="(max-width: 768px) 100vw, 400px"
                      style={{ objectFit: "contain" }} // Modern replacement for objectFit prop
                      className="bg-muted"
                      priority // Add priority to prevent LCP warnings
                      unoptimized // If using external URLs like picsum or if optimization causes issues
                    />
                  </div>
                   <p className="text-xs text-muted-foreground mt-1">Full prompt: "{existingImage.requestPrompt}"</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const handleGenerateNarration = async (specificChunkIndexToProcess?: number) => {
    if (narrationSource !== 'generate') return;
    // If a specific chunk is requested, ensure script and chunks exist for that index.
    // If "generate all" is implied (no specific index), ensure script exists.
    if (typeof specificChunkIndexToProcess === 'number') {
        if (!storyData.narrationChunks || !storyData.narrationChunks[specificChunkIndexToProcess]) {
            toast({ title: 'Error', description: 'Chunk not found for individual generation.', variant: 'destructive'});
            return;
        }
    } else if (!storyData.generatedScript) { // For "generate all" or initial prep
        toast({ title: 'No Script', description: 'Please generate a script first.', variant: 'destructive' });
        return;
    }
    
    handleSetLoading('narration', true); // General loading state

    // 1. Voice Loading/Selection (remains the same)
    if (!selectedVoiceId && !storyData.elevenLabsVoiceId) {
      const result = await generateNarrationAudio({ script: "Loading voices" }); // Script content doesn't matter here
      if (result.success && result.data && result.data.voices) {
        setElevenLabsVoices(result.data.voices);
        toast({ title: 'Voices Loaded', description: 'Please select a voice to generate narration.', className: 'bg-primary text-primary-foreground' });
      } else {
        toast({ title: 'Error Loading Voices', description: result.error || 'Failed to load voices.', variant: 'destructive' });
      }
      handleSetLoading('narration', false);
      return;
    }

    const voiceIdToUse = selectedVoiceId || storyData.elevenLabsVoiceId;
    if (!voiceIdToUse) {
      toast({ title: 'Voice Not Selected', description: 'Please select a voice first.', variant: 'destructive' });
      handleSetLoading('narration', false);
      return;
    }

    // Ensure narrationChunks exist (with text) before proceeding
    if (!storyData.narrationChunks || storyData.narrationChunks.length === 0) {
      if (storyData.generatedScript) {
        toast({ title: 'Preparing Chunks...', description: 'AI is splitting the script. Please wait.', className: 'bg-primary text-primary-foreground' });
        handleSetLoading('scriptChunksUpdate', true);
        try {
          const newNarrationChunks = await prepareScriptChunksAI(storyData.generatedScript);
          updateStoryData({ narrationChunks: newNarrationChunks });
          handleSetLoading('scriptChunksUpdate', false);
          if (newNarrationChunks.length > 0) {
            toast({ title: 'Script Chunks Ready!', description: `AI created ${newNarrationChunks.length} chunks. Now select a voice and generate audio.`, className: 'bg-primary text-primary-foreground' });
            // Don't proceed to audio generation immediately, let user click again after voice selection if needed.
            handleSetLoading('narration', false);
            return;
          } else {
            toast({ title: 'No Chunks Generated', description: 'AI could not split the script into chunks.', variant: 'destructive' });
            handleSetLoading('narration', false);
            return;
          }
        } catch (error) {
            toast({ title: 'Error Preparing Chunks', description: 'Failed to split script with AI.', variant: 'destructive' });
            handleSetLoading('scriptChunksUpdate', false);
            handleSetLoading('narration', false);
            return;
        }
      } else {
        toast({ title: 'No Script', description: 'Please generate a script first.', variant: 'destructive' });
        handleSetLoading('narration', false);
        return;
      }
    }
    
    // At this point, voice is selected, and narrationChunks (with text) should exist if we got this far.

    let chunkToProcessIndex = -1;

    if (typeof specificChunkIndexToProcess === 'number') {
      chunkToProcessIndex = specificChunkIndexToProcess;
      // If processing a single chunk, ensure currentNarrationChunkIndex reflects this specific chunk for UI feedback
      setCurrentNarrationChunkIndex(chunkToProcessIndex);
    } else { // "Generate All" flow
      if (currentNarrationChunkIndex === -1) { // If not already processing a sequence
        const firstUnprocessed = storyData.narrationChunks!.findIndex(chunk => !chunk.audioUrl);
        if (firstUnprocessed !== -1) {
          chunkToProcessIndex = firstUnprocessed;
          setCurrentNarrationChunkIndex(firstUnprocessed);
        } else { // All are already processed
          // Option to re-generate all: clear existing audio and start from 0
          const confirmReGenerate = storyData.narrationChunks!.every(c => c.audioUrl); // True if all have audio
          if (confirmReGenerate) {
             const resetChunks = storyData.narrationChunks!.map(c => ({...c, audioUrl: undefined, duration: undefined}));
             updateStoryData({ narrationChunks: resetChunks, narrationAudioDurationSeconds: 0 });
             chunkToProcessIndex = 0;
             setCurrentNarrationChunkIndex(0);
             toast({title: "Re-generating All Chunks", description: "Previous audio cleared.", className: "bg-primary text-primary-foreground"})
          } else {
            toast({ title: 'All Chunks Processed', description: 'All narration chunks already have audio.', className: 'bg-primary text-primary-foreground' });
            handleSetLoading('narration', false);
            return;
          }
        }
      } else { // Already in a "Generate All" sequence
        chunkToProcessIndex = currentNarrationChunkIndex;
      }
    }

    if (chunkToProcessIndex === -1 || !storyData.narrationChunks || !storyData.narrationChunks[chunkToProcessIndex]) {
      setCurrentNarrationChunkIndex(-1);
      if (typeof specificChunkIndexToProcess !== 'number') { // Part of "Generate All" flow that finished or had nothing to do
        setProcessingAllMode(false);
        if (storyData.narrationChunks?.every(c => c.audioUrl)) {
             setCurrentStep(4);
        }
      }
      handleSetLoading('narration', false);
      return;
    }
    
    // If this call is for a single chunk, ensure processingAllMode is false.
    if (typeof specificChunkIndexToProcess === 'number' && processingAllMode) {
      setProcessingAllMode(false); // Stop any "generate all" sequence if user clicks a single chunk.
    }
    
    const chunk = storyData.narrationChunks![chunkToProcessIndex]; // Assert narrationChunks is not null/undefined
    const result = await generateNarrationAudio({
      script: chunk.text,
      voiceId: voiceIdToUse,
      userId: storyData.userId,
      storyId: storyData.id, // Ensure storyData.id is available (it should be if saving is possible)
      chunkId: chunk.id
    });
    
    if (result.success && result.data && result.data.audioStorageUrl) { // Check for audioStorageUrl
      const updatedChunks = [...storyData.narrationChunks!];
      updatedChunks[chunkToProcessIndex] = {
        ...chunk,
        audioUrl: result.data.audioStorageUrl, // Use audioStorageUrl
        duration: result.data.duration
      };
      
      const totalDuration = calculateTotalNarrationDuration(updatedChunks);
      updateStoryData({
        narrationChunks: updatedChunks,
        narrationAudioDurationSeconds: totalDuration,
        elevenLabsVoiceId: voiceIdToUse
      });
      
      toast({
        title: `Chunk ${chunkToProcessIndex + 1} Generated!`,
        description: `Audio for chunk ${chunkToProcessIndex + 1} of ${storyData.narrationChunks.length} is ready.`,
        className: 'bg-primary text-primary-foreground'
      });
      
      if (typeof specificChunkIndexToProcess === 'number') {
        // Single chunk processed.
        setCurrentNarrationChunkIndex(-1); // Reset index, indicating no specific chunk is "active" for sequence.
        setProcessingAllMode(false); // Ensure "all" mode is off.
        handleSetLoading('narration', false);
      } else { // This was part of a "Generate All" sequence (processingAllMode should be true)
        const nextUnprocessed = updatedChunks.findIndex((c, idx) => idx > chunkToProcessIndex && !c.audioUrl);
        if (nextUnprocessed !== -1) {
          setCurrentNarrationChunkIndex(nextUnprocessed); // useEffect (with processingAllMode true) will pick this up
        } else { // No more unprocessed chunks after the current one in the sequence
          setCurrentNarrationChunkIndex(-1);
          setProcessingAllMode(false); // Sequence finished
          handleSetLoading('narration', false);
          if (updatedChunks.every(c => c.audioUrl)) {
             setCurrentStep(4);
             toast({ title: 'All Narration Generated!', description: 'Audio for all chunks is ready.', className: 'bg-primary text-primary-foreground' });
          }
        }
      }
    } else { // Audio generation for current chunk failed
      toast({
        title: 'Chunk Narration Error',
        description: result.error || `Failed to generate audio for chunk ${chunkToProcessIndex + 1}.`,
        variant: 'destructive'
      });
      setCurrentNarrationChunkIndex(-1);
      setProcessingAllMode(false); // Stop "all" mode on error
      handleSetLoading('narration', false);
    }
  };

  const handleAudioFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== "audio/mpeg") {
        toast({ title: "Invalid File Type", description: "Please upload an MP3 audio file.", variant: "destructive" });
        return;
      }
      if (file.size > 10 * 1024 * 1024) { 
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
            elevenLabsVoiceId: undefined, 
            });
            setUploadedAudioFileName(file.name);
            setCurrentStep(4); 
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
    
    // If we have narration chunks, use them to generate more targeted image prompts
    const scriptToUse = storyData.narrationChunks && storyData.narrationChunks.length > 0
      ? storyData.narrationChunks.map(chunk => chunk.text).join("\n\n")
      : storyData.generatedScript;
    
    const result = await generateImagePrompts({
      script: scriptToUse,
      characterPrompts: storyData.detailsPrompts.characterPrompts || '',
      locationPrompts: storyData.detailsPrompts.locationPrompts || '',
      itemPrompts: storyData.detailsPrompts.itemPrompts || '',
      audioDurationSeconds: storyData.narrationAudioDurationSeconds,
      imagesPerMinute: imagesPerMinute,
    });
    
    if (result.success && result.data) {
      // If we have narration chunks, try to align the number of image prompts with the number of chunks
      let imagePrompts = result.data.imagePrompts;
      
      if (storyData.narrationChunks && storyData.narrationChunks.length > 0) {
        // If we have more image prompts than chunks, trim the excess
        if (imagePrompts.length > storyData.narrationChunks.length) {
          imagePrompts = imagePrompts.slice(0, storyData.narrationChunks.length);
        }
        // If we have fewer image prompts than chunks, duplicate the last one to fill
        else if (imagePrompts.length < storyData.narrationChunks.length && imagePrompts.length > 0) {
          while (imagePrompts.length < storyData.narrationChunks.length) {
            imagePrompts.push(imagePrompts[imagePrompts.length - 1]);
          }
        }
      }
      
      updateStoryData({ imagePrompts });
      setIsImagePromptEditing(Array(imagePrompts.length).fill(false));
      toast({
        title: 'Image Prompts Generated!',
        description: `${imagePrompts.length} prompts for your animation visuals are ready.`,
        className: 'bg-primary text-primary-foreground'
      });
    } else {
      toast({ title: 'Error', description: result.error || 'Failed to generate image prompts.', variant: 'destructive' });
    }
    handleSetLoading('imagePrompts', false);
  };

  const handleImagePromptChange = (index: number, value: string) => {
    if (storyData.imagePrompts) {
      const updatedPrompts = [...storyData.imagePrompts];
      updatedPrompts[index] = value;
      updateStoryData({ imagePrompts: updatedPrompts });
    }
  };

  const toggleImagePromptEdit = (index: number) => {
    setIsImagePromptEditing(prev => {
        const newState = [...prev];
        newState[index] = !newState[index];
        return newState;
    });
  };


  const handleGenerateSingleImage = async (prompt: string, index: number) => {
    handleSetLoading(`image-${index}`, true);
    // Pass userId and storyId to store images in Firebase Storage
    const result = await generateImageFromPrompt(prompt, storyData.userId, storyData.id);
    if (result.success && result.imageUrl) {
      const newImage: GeneratedImage = { originalPrompt: prompt, requestPrompt: result.requestPrompt || prompt, imageUrl: result.imageUrl };
      const currentGeneratedImages = Array.isArray(storyData.generatedImages) ? storyData.generatedImages : [];
      
      let updatedImages = [...currentGeneratedImages];
      const existingImageIndexForPrompt = updatedImages.findIndex(img => img.originalPrompt === prompt);
      
      if (existingImageIndexForPrompt > -1) {
        updatedImages[existingImageIndexForPrompt] = newImage;
      } else {
         const newImagesArray = Array(storyData.imagePrompts?.length || 0).fill(null);
         currentGeneratedImages.forEach((img) => {
            if (img) { 
              const originalPromptIndex = storyData.imagePrompts?.indexOf(img.originalPrompt);
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
  };

  const handleGenerateAllImages = async () => {
    if (!storyData.imagePrompts || storyData.imagePrompts.length === 0) return;
    handleSetLoading('allImages', true);
    
    const currentGeneratedImages = Array.isArray(storyData.generatedImages) ? storyData.generatedImages : [];
    const imagesToGenerate = storyData.imagePrompts.map((prompt, index) => ({ prompt, index })).filter(
      p => !currentGeneratedImages.some(img => img && img.originalPrompt === p.prompt)
    );

    const results = await Promise.all(
      imagesToGenerate.map(async ({prompt, index}) => {
        handleSetLoading(`image-${index}`, true);
        // Pass userId and storyId to store images in Firebase Storage
        const result = await generateImageFromPrompt(prompt, storyData.userId, storyData.id);
        handleSetLoading(`image-${index}`, false);
        if (result.success && result.imageUrl) {
          return { prompt, imageUrl: result.imageUrl, requestPrompt: result.requestPrompt, success: true, index };
        }
        toast({ title: 'Image Generation Error', description: result.error || `Failed for prompt: \"${prompt.substring(0,30)}...\"`, variant: 'destructive' });
        return { prompt, success: false, index, error: result.error, requestPrompt: result.requestPrompt };
      })
    );

    const successfulNewImages = results.filter(r => r.success).map(r => ({
      originalPrompt: r.prompt,
      requestPrompt: r.requestPrompt || r.prompt,
      imageUrl: r.imageUrl!,
    }));
    
    if (successfulNewImages.length > 0) {
      setStoryData(prev => {
        const existingImages = Array.isArray(prev.generatedImages) ? prev.generatedImages.filter(img => img !== null) as GeneratedImage[] : []; 
        const combined = [...existingImages, ...successfulNewImages];
        const uniqueImagesByPrompt = Array.from(new Map(combined.map(img => [img.originalPrompt, img])).values());
        
        const orderedImages = prev.imagePrompts?.map(p => uniqueImagesByPrompt.find(img => img.originalPrompt === p)).filter(Boolean) as GeneratedImage[] || uniqueImagesByPrompt;
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

  const progressPercentage = ((currentStep -1) / 3) * 100; 

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

  const canAssembleVideo = storyData.imagePrompts && storyData.imagePrompts.length > 0 && storyData.id !== undefined;
  const isSaveButtonDisabled = !storyData.title?.trim() || isLoading.save || !user?.uid;

  const narrationButtonText = () => {
    if (isLoading.narration) {
      if (currentNarrationChunkIndex >= 0 && storyData.narrationChunks) {
        return `Processing Chunk ${currentNarrationChunkIndex + 1} of ${storyData.narrationChunks.length}...`;
      }
      return "Processing Narration...";
    }
    if (narrationSource === 'generate') {
      if (storyData.narrationChunks && storyData.narrationChunks.every(chunk => chunk.audioUrl)) {
        return "Re-generate All Narration Chunks";
      }
      if (storyData.narrationChunks && storyData.narrationChunks.length > 0) {
        // If some chunks are processed, but not all, or none are.
        const currentChunkToProcess = storyData.narrationChunks.findIndex(chunk => !chunk.audioUrl);
        if (currentChunkToProcess !== -1) {
             return `Generate Narration (Chunk ${currentChunkToProcess + 1}/${storyData.narrationChunks.length})`;
        }
        // This case should ideally be caught by "Re-generate All" if all are done.
        // Or if no chunks exist yet but script does.
      }
      if (elevenLabsVoices.length > 0 && (selectedVoiceId || storyData.elevenLabsVoiceId)) {
         if (storyData.generatedScript && (!storyData.narrationChunks || storyData.narrationChunks.length === 0)) {
            return "Prepare & Generate Narration Chunks";
         }
         return "Generate Narration for Chunks";
      }
      return "Load Voices & Prepare for Chunked Narration";
    }
    return "Generate Narration (AI)"; // Fallback for upload state, though button is disabled
  };

  const isNarrationButtonDisabled = narrationSource === 'upload' ||
                                  (isLoading.narration && processingAllMode) || // Disable main button if "all" is processing
                                  !storyData.generatedScript ||
                                  (narrationSource === 'generate' && elevenLabsVoices.length > 0 && !selectedVoiceId && !storyData.elevenLabsVoiceId && (!storyData.narrationChunks || storyData.narrationChunks.length === 0)) ||
                                  isLoading.narrationUpload;

  const isIndividualChunkButtonDisabled = (chunk: NarrationChunk, index: number): boolean => {
    if (narrationSource === 'upload') return true;
    if (!selectedVoiceId && !storyData.elevenLabsVoiceId) return true; // No voice selected
    if (processingAllMode) return true; // "Generate All" sequence is active, disable individual buttons to prevent interference
    
    // Disable if global loading is on for a *different* chunk or for the main "generate all" button (before sequence starts)
    if (isLoading.narration && currentNarrationChunkIndex !== index && currentNarrationChunkIndex !== -1) return true;
    // Disable if this specific chunk is currently being processed via the main "generate all" flow
    if (isLoading.narration && currentNarrationChunkIndex === index && processingAllMode) return true;


    // The button text changes to "Re-generate" if chunk.audioUrl exists, so we don't disable based on that.
    // Allow clicking if this specific chunk is loading via its own button.
    if (isLoading.narration && currentNarrationChunkIndex === index && !processingAllMode) return false;


    return false; // Otherwise, enable
  };


  return (
    <div className="container mx-auto max-w-5xl py-8">
      {/* Firebase error banner removed - now handled by FirebaseConnectionStatus component */}
      <Card className="shadow-2xl">
        <CardHeader className="bg-card-foreground/5">
          <CardTitle className="text-3xl font-bold tracking-tight text-primary flex items-center">
             <Sparkles className="w-8 h-8 mr-3 text-accent" />
            {storyData.id ? 'Edit Your Story' : 'Create a New Story'}
          </CardTitle>
          <CardDescription>
            Follow the steps below to bring your animated story to life. Click Save Story anytime to store your progress.
          </CardDescription>
           <div>
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
            <p className="text-xs text-muted-foreground mt-1">Step {currentStep} of 4</p>
          </div>

          <Accordion 
            type="single" 
            collapsible 
            value={activeAccordionItem} 
            className="w-full" 
            onValueChange={(value) => {
              if (isScriptManuallyEditing && activeAccordionItem === 'step-1' && value !== 'step-1') {
                setIsScriptManuallyEditing(false);
              }
              if (activeAccordionItem === 'step-2' && value !== 'step-2' && (isCharacterPromptsEditing || isItemPromptsEditing || isLocationPromptsEditing)) {
                setIsCharacterPromptsEditing(false);
                setIsItemPromptsEditing(false);
                setIsLocationPromptsEditing(false);
              }
              if (activeAccordionItem === 'step-4' && value !== 'step-4' && isImagePromptEditing.some(Boolean)) {
                setIsImagePromptEditing(Array(storyData.imagePrompts?.length || 0).fill(false));
              }
              setActiveAccordionItem(value); 
              if (value) {
                setCurrentStep(parseInt(value.split('-')[1]));
              }
            }}
          >
            {/* Step 1: User Prompt */}
            <AccordionItem value="step-1">
              <AccordionTrigger className="text-xl font-semibold hover:no-underline data-[state=open]:text-primary">
                <div className="flex items-center">
                  <Pencil className="w-6 h-6 mr-3" /> Step 1: Craft Your Story Idea &amp; Script
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
                {storyData.generatedScript !== undefined && (
                  <div className="mt-4">
                    <Label htmlFor="generatedScriptDisplayStep1" className="block text-md font-medium">Generated Story Script (Review)</Label>
                    <Textarea
                      id="generatedScriptDisplayStep1"
                      value={storyData.generatedScript}
                      readOnly={!isScriptManuallyEditing}
                      onChange={(e) => updateStoryData({ generatedScript: e.target.value })}
                      rows={10}
                      className={cn(
                        "text-base mt-1",
                        !isScriptManuallyEditing ? 'bg-muted/50' : 'bg-background ring-2 ring-primary'
                      )}
                    />
                  </div>
                )}
                <div className="flex space-x-2">
                    <Button onClick={handleGenerateScript} disabled={isLoading.script || !storyData.userPrompt.trim()} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                    {isLoading.script ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    {storyData.generatedScript !== undefined ? 'Re-generate Script &amp; Title' : 'Generate Script &amp; Title'}
                    </Button>
                    {storyData.generatedScript !== undefined && (
                        <Button
                            variant="outline"
                            onClick={async () => {
                              if (isScriptManuallyEditing && storyData.generatedScript) {
                                // When done editing, regenerate the script chunks using AI
                                handleSetLoading('scriptChunksUpdate', true);
                                try {
                                  const narrationChunks = await prepareScriptChunksAI(storyData.generatedScript);
                                  updateStoryData({
                                    // scriptChunks: regeneratedScriptChunks, // Deprecate if narrationChunks has text
                                    narrationChunks
                                  });
                                  toast({
                                    title: 'Script Chunks Updated (AI)',
                                    description: `AI created ${narrationChunks.length} chunks for narration.`,
                                    className: 'bg-primary text-primary-foreground'
                                  });
                                } catch (error) {
                                  console.error("Error updating script chunks with AI:", error);
                                  toast({ title: 'Error Updating Chunks', description: 'Could not update script chunks using AI.', variant: 'destructive' });
                                  // Optionally, fall back to simple splitting or leave chunks as they were
                                  // const simpleNarrationChunks = prepareScriptChunksSimple(storyData.generatedScript);
                                  // updateStoryData({ narrationChunks: simpleNarrationChunks });
                                  // toast({ title: 'Script Chunks Updated (Simple)', description: `Used simple splitting: ${simpleNarrationChunks.length} chunks.`, variant: 'default' });
                                } finally {
                                  handleSetLoading('scriptChunksUpdate', false);
                                }
                              } else if (isScriptManuallyEditing && !storyData.generatedScript) {
                                // Handle case where script might be empty after editing
                                updateStoryData({ narrationChunks: [] });
                                toast({ title: 'Script Empty', description: 'Script is empty, no chunks generated.', variant: 'default' });
                              }
                              setIsScriptManuallyEditing(!isScriptManuallyEditing);
                            }}
                            disabled={isLoading.script}
                        >
                            <Edit2 className="mr-2 h-4 w-4" />
                            {isScriptManuallyEditing ? 'Done Editing Script' : 'Edit Script Manually'}
                        </Button>
                    )}
                </div>
                 {storyData.generatedScript !== undefined && (
                   <p className="text-sm text-muted-foreground">
                     You can re-generate the script (which overwrites manual edits) or edit it manually. The updated script will be used in subsequent steps.
                   </p>
                 )}
              </AccordionContent>
            </AccordionItem>

            {/* Step 2: Generate Character, Item & Location Details */}
            <AccordionItem value="step-2" disabled={storyData.generatedScript === undefined}>
              <AccordionTrigger className="text-xl font-semibold hover:no-underline data-[state=open]:text-primary">
                <div className="flex items-center">
                  <Users className="w-6 h-6 mr-3" /> Step 2: Generate Character, Item &amp; Location Details
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                {storyData.generatedScript !== undefined ? (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Using the script generated in Step 1, we will now create detailed descriptions for characters, items, and locations. You can then generate images for each detail.
                    Using the script generated in Step 1, we will now create detailed descriptions for characters, items, and locations. You can then generate images for each detail.
                  </p>
                  <div className="flex space-x-2 mt-4">
                    <Button onClick={handleGenerateDetails} disabled={isLoading.details || !storyData.generatedScript} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                      {isLoading.details ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
                      {storyData.detailsPrompts && (storyData.detailsPrompts.characterPrompts || storyData.detailsPrompts.itemPrompts || storyData.detailsPrompts.locationPrompts) ? 'Re-generate Details' : 'Generate Details'}
                    </Button>
                    {storyData.detailsPrompts && (storyData.detailsPrompts.characterPrompts || storyData.detailsPrompts.itemPrompts || storyData.detailsPrompts.locationPrompts) && (
                      <Button onClick={handleGenerateAllDetailImages} disabled={isLoading.allDetailImages || isLoading.details} variant="outline">
                        {isLoading.allDetailImages ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-2 h-4 w-4" />}
                        Generate All Detail Images
                      </Button>
                    )}
                  </div>

                  {storyData.detailsPrompts && (storyData.detailsPrompts.characterPrompts || storyData.detailsPrompts.itemPrompts || storyData.detailsPrompts.locationPrompts) && (
                    <div className="mt-6">
                      <Label className="block text-md font-medium">Character, Item &amp; Location Prompts & Images (Review, Edit & Generate)</Label>
                       <Accordion type="multiple" className="w-full mt-1 bg-muted/30 rounded-md" defaultValue={['chars']}>
                          <AccordionItem value="chars">
                              <AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">View Character Prompts & Images</AccordionTrigger>
                              <AccordionContent className="px-3 pb-2">
                                  <div className="relative mb-2">
                                      <Textarea 
                                          value={storyData.detailsPrompts?.characterPrompts || ""} 
                                          readOnly={!isCharacterPromptsEditing}
                                          onChange={(e) => updateStoryData({ detailsPrompts: { ...(storyData.detailsPrompts || {}), characterPrompts: e.target.value } as StoryCharacterLocationItemPrompts })}
                                          onBlur={() => setIsCharacterPromptsEditing(false)}
                                          rows={5} 
                                          className={cn(
                                              "text-xs whitespace-pre-wrap w-full",
                                              isCharacterPromptsEditing ? 'bg-background ring-2 ring-primary' : 'bg-card border-transparent'
                                          )}
                                          placeholder="Character descriptions will appear here. Each description on a new line will be treated as a separate prompt for image generation."
                                      />
                                      <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => setIsCharacterPromptsEditing(!isCharacterPromptsEditing)}>
                                          <Pencil className="h-3 w-3" />
                                      </Button>
                                  </div>
                                  {renderDetailPromptsWithImages(storyData.detailsPrompts?.characterPrompts, "Character")}
                              </AccordionContent>
                          </AccordionItem>
                          <AccordionItem value="items">
                              <AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">View Item Prompts & Images</AccordionTrigger>
                              <AccordionContent className="px-3 pb-2">
                                  <div className="relative mb-2">
                                      <Textarea 
                                          value={storyData.detailsPrompts?.itemPrompts || ""} 
                                          readOnly={!isItemPromptsEditing}
                                          onChange={(e) => updateStoryData({ detailsPrompts: { ...(storyData.detailsPrompts || {}), itemPrompts: e.target.value } as StoryCharacterLocationItemPrompts })}
                                          onBlur={() => setIsItemPromptsEditing(false)}
                                          rows={5} 
                                          className={cn(
                                              "text-xs whitespace-pre-wrap w-full",
                                              isItemPromptsEditing ? 'bg-background ring-2 ring-primary' : 'bg-card border-transparent'
                                          )}
                                          placeholder="Item descriptions will appear here. Each description on a new line..."
                                      />
                                      <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => setIsItemPromptsEditing(!isItemPromptsEditing)}>
                                          <Pencil className="h-3 w-3" />
                                      </Button>
                                  </div>
                                  {renderDetailPromptsWithImages(storyData.detailsPrompts?.itemPrompts, "Item")}
                              </AccordionContent>
                          </AccordionItem>
                          <AccordionItem value="locations">
                              <AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">View Location Prompts & Images</AccordionTrigger>
                              <AccordionContent className="px-3 pb-2">
                                   <div className="relative mb-2">
                                      <Textarea 
                                          value={storyData.detailsPrompts?.locationPrompts || ""} 
                                          readOnly={!isLocationPromptsEditing}
                                          onChange={(e) => updateStoryData({ detailsPrompts: { ...(storyData.detailsPrompts || {}), locationPrompts: e.target.value } as StoryCharacterLocationItemPrompts })}
                                          onBlur={() => setIsLocationPromptsEditing(false)}
                                          rows={5} 
                                          className={cn(
                                              "text-xs whitespace-pre-wrap w-full",
                                              isLocationPromptsEditing ? 'bg-background ring-2 ring-primary' : 'bg-card border-transparent'
                                          )}
                                          placeholder="Location descriptions will appear here. Each description on a new line..."
                                      />
                                      <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => setIsLocationPromptsEditing(!isLocationPromptsEditing)}>
                                          <Pencil className="h-3 w-3" />
                                      </Button>
                                  </div>
                                  {renderDetailPromptsWithImages(storyData.detailsPrompts?.locationPrompts, "Location")}
                              </AccordionContent>
                          </AccordionItem>
                      </Accordion>
                    </div>
                  )}
                </div>
                ) : (
                  <p className="text-muted-foreground">Please generate a script in Step 1 first.</p>
                )}
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
                  <div>
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
                        {elevenLabsVoices.length > 0 && !storyData.elevenLabsVoiceId && ( 
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
                        <Button
                          onClick={() => {
                            // Determine if we should enter "processing all" mode
                            // This mode is for sequential generation of all unprocessed chunks.
                            if (storyData.generatedScript && (!storyData.narrationChunks || storyData.narrationChunks.length === 0)) {
                                // Case: Script exists, but chunks haven't been prepared yet.
                                // handleGenerateNarration will prepare them first. Then user might need to click again.
                                // Or, we can set processingAllMode to true if voice is selected, to auto-start after chunk prep.
                                if (selectedVoiceId || storyData.elevenLabsVoiceId) {
                                   setProcessingAllMode(true);
                                }
                            } else if (storyData.narrationChunks && storyData.narrationChunks.some(c => !c.audioUrl)) {
                                // Case: Chunks exist, and some are unprocessed.
                                setProcessingAllMode(true);
                            } else if (storyData.narrationChunks && storyData.narrationChunks.every(c => c.audioUrl)) {
                                // Case: All chunks have audio; this implies re-generate all.
                                setProcessingAllMode(true);
                            }
                            handleGenerateNarration(); // Call without index for "Generate All" / preparation logic
                          }}
                          disabled={isNarrationButtonDisabled || (isLoading.narration && processingAllMode)} // Disable if already processing all via this button
                          className="bg-accent hover:bg-accent/90 text-accent-foreground"
                        >
                            {/* Show loader if "processing all" mode is active and narration is loading */}
                            {isLoading.narration && processingAllMode ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ListMusic className="mr-2 h-4 w-4" />}
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

                    {/* Display script chunks for narration */}
                    {storyData.narrationChunks && storyData.narrationChunks.length > 0 && (
                      <div className="mt-6">
                        <Label className="block text-md font-medium">Script Chunks for Narration</Label>
                        <div className="space-y-3 mt-2 max-h-96 overflow-y-auto pr-2 rounded-md border p-3 bg-muted/20">
                          {storyData.narrationChunks.map((chunk, index) => (
                            <div key={chunk.id} className={`p-3 border rounded-md ${currentNarrationChunkIndex === index && isLoading.narration ? 'border-primary bg-primary/10 ring-2 ring-primary' : 'bg-card/50'}`}>
                              <div className="flex justify-between items-start mb-1">
                                <p className="text-sm font-semibold">Chunk {index + 1}</p>
                                <div className="flex items-center space-x-2">
                                  {currentNarrationChunkIndex === index && isLoading.narration && (
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                  )}
                                  {chunk.audioUrl && !(currentNarrationChunkIndex === index && isLoading.narration) && (
                                    <CheckCircle className="h-5 w-5 text-green-500" />
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground mb-2">{chunk.text}</p>
                              
                              {/* Individual Chunk Audio Player */}
                              {chunk.audioUrl && (
                                <div className="mt-2 mb-2">
                                  <audio controls src={chunk.audioUrl} className="w-full h-8" style={{ height: '32px' }}>
                                    Your browser does not support the audio element.
                                  </audio>
                                  {chunk.duration && (
                                    <p className="text-xs text-muted-foreground mt-1">Duration: {chunk.duration.toFixed(1)}s</p>
                                  )}
                                </div>
                              )}

                              {/* Button to generate/re-generate audio for this specific chunk */}
                              {narrationSource === 'generate' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleGenerateNarration(index)} // Pass the specific chunk index
                                  disabled={isIndividualChunkButtonDisabled(chunk, index)}
                                  className="text-xs py-1 h-auto"
                                >
                                  {/* Show loader if this specific chunk is processing (currentNarrationChunkIndex === index && isLoading.narration) */}
                                  {currentNarrationChunkIndex === index && isLoading.narration ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Mic className="mr-1 h-3 w-3" />}
                                  {chunk.audioUrl ? 'Re-generate Audio' : 'Generate Audio'}
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                        {storyData.narrationAudioDurationSeconds && storyData.narrationAudioDurationSeconds > 0 && (
                          <p className="text-sm font-semibold text-primary mt-2">
                            Total Estimated Narration Duration: {storyData.narrationAudioDurationSeconds.toFixed(1)} seconds
                          </p>
                        )}
                      </div>
                    )}

                    {/* Legacy single audio player for backward compatibility - show only if no narrationChunks array or it's empty AND old URL exists */}
                    {storyData.narrationAudioUrl && (!storyData.narrationChunks || storyData.narrationChunks.length === 0) && (
                        <div className="mt-6">
                            <Label className="block text-md font-medium">Current Narration Audio (Legacy)</Label>
                             <audio controls src={storyData.narrationAudioUrl} key={storyData.narrationAudioUrl} className="w-full mt-1">Your browser does not support the audio element.</audio>
                             <p className="text-sm text-muted-foreground mt-1">Duration: {storyData.narrationAudioDurationSeconds?.toFixed(2) || 'N/A'} seconds</p>
                        </div>
                    )}
                  </div>
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
                {(storyData.narrationAudioUrl || (storyData.narrationChunks && storyData.narrationChunks.length > 0 && storyData.narrationChunks.every(c => c.audioUrl))) ? (
                  <div>
                     <p className="text-sm text-muted-foreground mt-1">
                       {storyData.narrationChunks && storyData.narrationChunks.length > 0
                         ? `Based on ${storyData.narrationChunks.length} narration chunk(s), we'll generate corresponding image prompts.`
                         : `Audio Duration: ${storyData.narrationAudioDurationSeconds?.toFixed(2) || 'N/A'} seconds. Based on this, we'll generate prompts for images.`}
                     </p>
                    {/* Removed Images per Minute Input Field */}

                    <Button
                      onClick={handleGenerateImagePrompts}
                      disabled={isLoading.imagePrompts || !(storyData.narrationAudioDurationSeconds || (storyData.narrationChunks && storyData.narrationChunks.length > 0))}
                      className="mt-4 bg-accent hover:bg-accent/90 text-accent-foreground"
                    >
                      {isLoading.imagePrompts ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LucideImage className="mr-2 h-4 w-4" />}
                      {storyData.imagePrompts && storyData.imagePrompts.length > 0 ? 'Re-generate Image Prompts' : 'Generate Image Prompts'}
                    </Button>

                    {storyData.imagePrompts && storyData.imagePrompts.length > 0 && (
                      <div className="mt-6">
                        <Label className="block text-md font-medium">Generated Image Prompts (Review & Edit)</Label>
                        <div className="space-y-3 mt-2 max-h-96 overflow-y-auto pr-2 rounded-md border p-3 bg-muted/20">
                          {storyData.imagePrompts.map((prompt, index) => (
                            <div key={index} className="relative">
                              <Textarea
                                value={prompt}
                                readOnly={!isImagePromptEditing[index]}
                                onChange={(e) => handleImagePromptChange(index, e.target.value)}
                                onBlur={() => {
                                    if(isImagePromptEditing[index]) {
                                        toggleImagePromptEdit(index);
                                    }
                                }}
                                rows={3}
                                className={cn(
                                  "text-xs whitespace-pre-wrap w-full pr-8", // Added pr-8 for pencil icon space
                                  isImagePromptEditing[index] ? 'bg-background ring-2 ring-primary' : 'bg-card border-transparent'
                                )}
                                placeholder={`Image prompt ${index + 1}...`}
                              />
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="absolute top-1 right-1 h-6 w-6" 
                                onClick={() => toggleImagePromptEdit(index)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ): (
                     <p className="text-muted-foreground">Please generate or upload narration audio in Step 3 first.</p>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <Separator className="my-8" />

          <div className="flex justify-end items-center space-x-4">
             {canAssembleVideo && storyData.id && (
                <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Link href={`/assemble-video?storyId=${storyData.id}`}>
                    <Film className="mr-2 h-4 w-4" /> Assemble &amp; Export Video
                  </Link>
                </Button>
              )}
             {/* Conditional rendering for Save/Update button */}
             {storyData.id ? (
                // If storyData.id exists (Update Story case - no confirmation)
                <Button
                  size="lg"
                  disabled={isSaveButtonDisabled || isLoading.save}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleConfirmSaveStory} // Call save function directly
                >
                  {isLoading.save ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {isLoading.save ? 'Updating...' : 'Update Story'}
                </Button>
              ) : (
                // If storyData.id does not exist (Save New Story case - keep AlertDialog)
                <AlertDialog open={isSaveConfirmOpen} onOpenChange={setIsSaveConfirmOpen}>
                  <AlertDialogTrigger asChild>
                    <Button size="lg" disabled={isSaveButtonDisabled} className="bg-green-600 hover:bg-green-700 text-white">
                      <Save className="mr-2 h-4 w-4" />
                      {/* Text for new story save will always be 'Save New Story' here as storyData.id is false */}
                      {isLoading.save ? 'Saving...' : 'Save New Story'}
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
                      <AlertDialogAction 
                        onClick={handleConfirmSaveStory} 
                        disabled={isSaveButtonDisabled} // Preserves original disabled logic for this button
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {isLoading.save ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        Yes, Save Story
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
