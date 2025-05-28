"use client";

import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
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
import { Button } from '@/components/ui/button';
import { cleanupBrokenImages, getStory } from '@/actions/storyActions';
import { prepareScriptChunksAI } from '@/utils/narrationUtils';
import { determineCurrentStep } from '@/utils/storyHelpers';
import { Loader2, RefreshCw, Trash2, Save, Film } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

// Hooks
import { useStoryState } from '@/hooks/useStoryState';

// Components
import { StoryPromptStep } from '@/components/create-story/StoryPromptStep';
import { StoryDetailsStep } from '@/components/create-story/StoryDetailsStep';
import { NarrationStep } from '@/components/create-story/NarrationStep';
import { ImageGenerationStep } from '@/components/create-story/ImageGenerationStep';
import { FinalReviewStep } from '@/components/create-story/FinalReviewStep';

export default function CreateStoryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const storyId = searchParams.get('storyId');
  const { toast } = useToast();

  const storyState = useStoryState(user?.uid);

  const {
    storyData,
    setStoryData,
    currentStep,
    setCurrentStep,
    activeAccordionItem,
    setActiveAccordionItem,
    pageLoading,
    setPageLoading,
    firebaseError,
    setFirebaseError,
    isSaveConfirmOpen,
    setIsSaveConfirmOpen,
    setSelectedVoiceId,
    setNarrationSource,
    setUploadedAudioFileName,
    setIsImagePromptEditing,
    handleSetLoading
  } = storyState;

  // Handle authentication and story loading
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }

    let initialStep = 1;
    if (storyId && user) {
      setPageLoading(true);
      setFirebaseError(null);
      
      getStory(storyId, user.uid)
        .then(async response => {
          if (response.success && response.data) {
            let loadedStory = response.data;
            console.log('=== LOADED STORY FROM FIRESTORE ===');
            console.log('Story ID:', storyId);
            console.log('Full story data:', loadedStory);

            // Handle timestamp conversion
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
                  loadedStory = { ...loadedStory, narrationChunks: newNarrationChunks };
                  toast({ 
                    title: 'Script Chunks Prepared', 
                    description: `AI created ${newNarrationChunks.length} text chunks for the loaded story.`, 
                    className: 'bg-primary text-primary-foreground'
                  });
                } else {
                  loadedStory = { ...loadedStory, narrationChunks: [] };
                  toast({ 
                    title: 'Chunk Preparation Note', 
                    description: 'Could not automatically prepare text chunks for this loaded story (AI returned no chunks).', 
                    variant: 'default'
                  });
                }
              } catch (error) {
                console.error("Error proactively preparing chunks for loaded story:", error);
                loadedStory = { ...loadedStory, narrationChunks: [] };
                toast({ 
                  title: 'Chunk Preparation Error', 
                  description: 'Failed to auto-prepare text chunks.', 
                  variant: 'destructive'
                });
              }
            }
            
            // Auto-clean corrupted images before setting state
            if (loadedStory.generatedImages && Array.isArray(loadedStory.generatedImages)) {
              const cleanImages = loadedStory.generatedImages.filter(img => 
                img.imageUrl && !img.imageUrl.includes('.mp3')
              );
              
              if (cleanImages.length !== loadedStory.generatedImages.length) {
                console.log(`[Story Load] Auto-cleaned ${loadedStory.generatedImages.length - cleanImages.length} corrupted images`);
                loadedStory = { ...loadedStory, generatedImages: cleanImages };
              }
            }
            
            setStoryData(loadedStory);

            // Set up voice and audio states
            if (loadedStory.elevenLabsVoiceId) {
              setSelectedVoiceId(loadedStory.elevenLabsVoiceId);
              setNarrationSource('generate');
            } else if (loadedStory.narrationAudioUrl && (!loadedStory.narrationChunks || loadedStory.narrationChunks.length === 0)) {
              setNarrationSource('upload');
              setUploadedAudioFileName("Previously uploaded audio (legacy)");
            }

            // Determine initial step based on completion status
            initialStep = determineCurrentStep(loadedStory);
            setCurrentStep(initialStep);
            setActiveAccordionItem(`step-${initialStep}`);
            
            if (loadedStory.imagePrompts) {
              setIsImagePromptEditing(Array(loadedStory.imagePrompts.length).fill(false));
            }
          } else {
            toast({ 
              title: 'Error Loading Story', 
              description: response.error || 'Failed to load story. Creating a new one.', 
              variant: 'destructive' 
            });
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
      setCurrentStep(initialStep);
      setActiveAccordionItem(`step-${initialStep}`);
    }
  }, [storyId, user, router, toast, authLoading]);

  // Track the last auto-expanded step to avoid conflicts with manual control
  const lastAutoExpandedStep = useRef(currentStep);
  
  // Only auto-expand accordion when step changes due to completing a step
  useEffect(() => {
    const newValue = `step-${currentStep}`;
    // Only auto-expand if currentStep increased (step completion) and it's different from last auto-expanded
    if (currentStep > lastAutoExpandedStep.current) {
      lastAutoExpandedStep.current = currentStep;
      setActiveAccordionItem(newValue);
    }
  }, [currentStep, setActiveAccordionItem]);

  const handleCleanupImages = async () => {
    if (!storyData.id || !storyData.userId) return;
    
    handleSetLoading('cleanup', true);
    try {
      const result = await cleanupBrokenImages(storyData.id, storyData.userId);
      if (result.success) {
        toast({ 
          title: 'Images Cleaned Up', 
          description: 'Corrupted images have been removed.', 
          className: 'bg-green-500 text-white' 
        });
        // Reload the story to reflect changes
        if (storyId) {
          const reloadResult = await getStory(storyId, storyData.userId);
          if (reloadResult.success && reloadResult.data) {
            setStoryData(reloadResult.data);
          }
        }
      } else {
        toast({ 
          title: 'Cleanup Failed', 
          description: result.error || 'Failed to clean up images.', 
          variant: 'destructive' 
        });
      }
    } catch (error) {
      console.error('Error cleaning up images:', error);
      toast({ 
        title: 'Cleanup Error', 
        description: 'An unexpected error occurred during cleanup.', 
        variant: 'destructive' 
      });
    }
    handleSetLoading('cleanup', false);
    setIsSaveConfirmOpen(false);
  };

  if (authLoading || pageLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (firebaseError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-lg font-semibold mb-2">Connection Error</h2>
            <p className="text-muted-foreground mb-4">{firebaseError}</p>
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Create Your Story</h1>
          <p className="text-muted-foreground">
            Follow the steps below to create your personalized story with AI-generated narration and images.
          </p>
        </div>

        {/* Story Creation Steps */}
        <Accordion 
          type="single" 
          value={activeAccordionItem} 
          onValueChange={setActiveAccordionItem}
          collapsible
          className="space-y-4"
        >
          <AccordionItem value="step-1" className="border rounded-lg">
            <AccordionTrigger className="px-6 hover:no-underline">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  1
                </div>
                <span>Story Prompt & Script Generation</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <StoryPromptStep storyState={storyState} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="step-2" className="border rounded-lg">
            <AccordionTrigger className="px-6 hover:no-underline">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  2
                </div>
                <span>Character & Scene Details</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <StoryDetailsStep storyState={storyState} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="step-3" className="border rounded-lg">
            <AccordionTrigger className="px-6 hover:no-underline">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  3
                </div>
                <span>Narration Generation</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <NarrationStep storyState={storyState} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="step-4" className="border rounded-lg">
            <AccordionTrigger className="px-6 hover:no-underline">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= 4 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  4
                </div>
                <span>Scene Image Generation</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <ImageGenerationStep storyState={storyState} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="step-5" className="border rounded-lg">
            <AccordionTrigger className="px-6 hover:no-underline">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= 5 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  5
                </div>
                <span>Final Review & Export</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <FinalReviewStep storyState={storyState} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Persistent Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <Button 
            onClick={async () => {
              if (!storyData.userId) {
                toast({ title: 'Error', description: 'User not authenticated.', variant: 'destructive' });
                return;
              }

              handleSetLoading('save', true);
              
              try {
                const { saveStory } = await import('@/actions/storyActions');
                const result = await saveStory(storyData, storyData.userId);
                if (result.success) {
                  toast({ 
                    title: 'Story Saved!', 
                    description: 'Your story has been saved successfully.', 
                    className: 'bg-green-500 text-white' 
                  });
                } else {
                  toast({ 
                    title: 'Save Failed', 
                    description: result.error || 'Failed to save story.', 
                    variant: 'destructive' 
                  });
                }
              } catch (error) {
                console.error('Error saving story:', error);
                toast({ 
                  title: 'Save Error', 
                  description: 'An unexpected error occurred while saving.', 
                  variant: 'destructive' 
                });
              }
              
              handleSetLoading('save', false);
            }}
            disabled={storyState.isLoading.save || !storyData.title}
            className="flex-1"
          >
            {storyState.isLoading.save ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Story
              </>
            )}
          </Button>
          
          {storyData.id && (
            <Button variant="outline" asChild>
              <Link href={`/story/${storyData.id}`}>
                <Film className="mr-2 h-4 w-4" />
                View Story
              </Link>
            </Button>
          )}
        </div>

        {/* Cleanup Dialog */}
        <AlertDialog open={isSaveConfirmOpen} onOpenChange={setIsSaveConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clean Up Corrupted Images</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove any corrupted or invalid images from your story. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleCleanupImages}>
                <Trash2 className="mr-2 h-4 w-4" />
                Clean Up Images
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
