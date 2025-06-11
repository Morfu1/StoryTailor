
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
import { cleanupBrokenImages, getStory, deleteStory, saveStory } from '@/actions/firestoreStoryActions'; // Updated import
import { getUserApiKeys } from '@/actions/apiKeyActions';
import { listGoogleScriptModels } from '@/actions/storyActions'; // Removed listPerplexityModels
import { prepareScriptChunksAI } from '@/utils/narrationUtils';
import { determineCurrentStep } from '@/utils/storyHelpers';
import { Loader2, RefreshCw, Trash2, Save, Film, Download, Settings } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

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
    handleSetLoading,
    userApiKeys,
    setUserApiKeys,
    apiKeysLoading,
    setApiKeysLoading,
    aiProvider, // Added for model fetching logic
    setAvailableGoogleScriptModels, // Added
    setIsLoadingGoogleScriptModels, // Added
    // Removed Perplexity model state setters as they are no longer fetched dynamically
  } = storyState;

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Fetch User API Keys
  useEffect(() => {
    if (user && !userApiKeys && !apiKeysLoading) { 
      setApiKeysLoading(true); 
      getUserApiKeys(user.uid).then(result => {
        if (result.success && result.data) {
          setUserApiKeys(result.data);
        } else {
          setUserApiKeys({}); 
          toast({ title: "Could not load your API keys", description: result.error || "Please configure them in Account Settings.", variant: "default" });
        }
      }).catch(err => {
        console.error("Error fetching user API keys:", err);
        setUserApiKeys({});
        toast({ title: "Error Loading API Keys", description: "An unexpected error occurred.", variant: "destructive" });
      }).finally(() => {
        setApiKeysLoading(false); 
      });
    } else if (!user && userApiKeys) {
      // Clear API keys if user logs out
      setUserApiKeys(null);
    }
  }, [user, userApiKeys, apiKeysLoading, setUserApiKeys, setApiKeysLoading, toast]);


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
      
      getStory(storyId, user.uid) // Uses getStory from firestoreStoryActions
        .then(async response => {
          if (response.success && response.data) {
            let loadedStory = response.data;
            console.log('=== LOADED STORY FROM FIRESTORE ===');
            console.log('Story ID:', storyId);
            // console.log('Full story data:', loadedStory); // Avoid logging full story data

            if (loadedStory.createdAt && typeof (loadedStory.createdAt as { toDate?: () => Date })?.toDate === 'function') {
              loadedStory.createdAt = (loadedStory.createdAt as { toDate: () => Date }).toDate();
            }
            if (loadedStory.updatedAt && typeof (loadedStory.updatedAt as { toDate?: () => Date })?.toDate === 'function') {
              loadedStory.updatedAt = (loadedStory.updatedAt as { toDate: () => Date }).toDate();
            }
            
            if (loadedStory.generatedScript && (!loadedStory.narrationChunks || loadedStory.narrationChunks.length === 0)) {
              console.log("Loaded story has script but no narration chunks. Attempting to prepare them now...");
              try {
                const newNarrationChunks = await prepareScriptChunksAI(
                  loadedStory.generatedScript,
                  user.uid,
                  loadedStory.aiProvider, // Pass AI provider from loaded story
                  undefined, // Perplexity model no longer supported
                  loadedStory.googleScriptModel // Pass Google model
                );
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
              } catch (error: unknown) {
                 // Check if the error is due to missing API key
                if (error instanceof Error && error.message && error.message.toLowerCase().includes("api key not configured")) {
                   toast({ title: "Action Required", description: "Google API key needed to prepare script chunks. Please set it in Account Settings.", variant: "destructive" });
                } else {
                  console.error("Error proactively preparing chunks for loaded story:", error);
                  toast({ title: 'Chunk Preparation Error', description: 'Failed to auto-prepare text chunks.', variant: 'destructive' });
                }
                loadedStory = { ...loadedStory, narrationChunks: [] };
              }
            }
            
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

            if (loadedStory.elevenLabsVoiceId) {
              setSelectedVoiceId(loadedStory.elevenLabsVoiceId);
              setNarrationSource('generate');
            } else if (loadedStory.narrationAudioUrl && (!loadedStory.narrationChunks || loadedStory.narrationChunks.length === 0)) {
              setNarrationSource('upload');
              setUploadedAudioFileName("Previously uploaded audio (legacy)");
            }

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
  }, [storyId, user, router, toast, authLoading, setPageLoading, setFirebaseError, setStoryData, setSelectedVoiceId, setNarrationSource, setUploadedAudioFileName, setCurrentStep, setActiveAccordionItem, setIsImagePromptEditing]);


  const lastAutoExpandedStep = useRef(currentStep);
  
  useEffect(() => {
    const newValue = `step-${currentStep}`;
    if (currentStep > lastAutoExpandedStep.current) {
      lastAutoExpandedStep.current = currentStep;
      setActiveAccordionItem(newValue);
    }
  }, [currentStep, setActiveAccordionItem]);

  // Fetch Google Script Models
  useEffect(() => {
    if (user && userApiKeys?.googleApiKey && aiProvider === 'google') {
      setIsLoadingGoogleScriptModels(true);
      listGoogleScriptModels(user.uid)
        .then(result => {
          if (result.success && result.models) {
            setAvailableGoogleScriptModels(result.models);
          } else {
            setAvailableGoogleScriptModels([]); // Set to empty array on failure to avoid undefined issues
            toast({ title: "Could not load Google models", description: result.error || "Failed to fetch model list.", variant: "default" });
          }
        })
        .catch(err => {
          console.error("Error fetching Google script models:", err);
          setAvailableGoogleScriptModels([]);
          toast({ title: "Error Loading Google Models", description: "An unexpected error occurred.", variant: "destructive" });
        })
        .finally(() => {
          setIsLoadingGoogleScriptModels(false);
        });
    }
  }, [user, userApiKeys, aiProvider, setIsLoadingGoogleScriptModels, setAvailableGoogleScriptModels, toast]);

  // Removed useEffect for fetching Perplexity models

  const handleCleanupImages = async () => {
    if (!storyData.id || !storyData.userId) return;
    
    handleSetLoading('cleanup', true);
    try {
      const result = await cleanupBrokenImages(storyData.id);
      if (result.success) {
        toast({
          title: 'Images Cleaned Up', 
          description: 'Corrupted images have been removed.', 
          className: 'bg-green-500 text-white' 
        });
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

  const handleDeleteStory = async () => {
    if (!storyData.id || !storyData.userId) {
      toast({ title: 'Error', description: 'Story ID or user ID is missing.', variant: 'destructive' });
      return;
    }
    
    handleSetLoading('delete', true);
    try {
      const result = await deleteStory(storyData.id, storyData.userId);
      if (result.success) {
        toast({ 
          title: 'Story Deleted!', 
          description: 'Your story has been permanently deleted.', 
          className: 'bg-green-500 text-white' 
        });
        router.push('/dashboard');
      } else {
        toast({ 
          title: 'Delete Failed', 
          description: result.error || 'Failed to delete story.', 
          variant: 'destructive' 
        });
      }
    } catch (error) {
      console.error('Error deleting story:', error);
      toast({ 
        title: 'Delete Error', 
        description: 'An unexpected error occurred during deletion.', 
        variant: 'destructive' 
      });
    }
    handleSetLoading('delete', false);
    setIsDeleteConfirmOpen(false);
  };

  if (authLoading || pageLoading || apiKeysLoading) { 
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="ml-2">{apiKeysLoading ? "Loading API key status..." : authLoading ? "Authenticating..." : "Loading story..."}</p>
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
  
  // Generic message for missing API keys
  const MissingApiKeyMessage = () => (
    <div className="mt-2 p-3 bg-yellow-100 border border-yellow-300 text-yellow-700 rounded-md text-sm">
      One or more API keys required for this step are missing. Please configure them in your{' '}
      <Link href="/settings" className="font-semibold underline hover:text-yellow-800">
        Account Settings <Settings size={14} className="inline-block ml-1" />
      </Link>
      .
    </div>
  );


  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">{storyData.title || "Create Your Story"}</h1>
          <p className="text-muted-foreground">
            Follow the steps below to create your personalized story with AI-generated narration and images.
          </p>
        </div>

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
              {!userApiKeys?.googleApiKey && !apiKeysLoading && <MissingApiKeyMessage />}
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
               {!userApiKeys?.googleApiKey && !apiKeysLoading && <MissingApiKeyMessage />}
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
              {storyState.narrationSource === 'generate' && 
               ((storyState.selectedTtsModel === 'elevenlabs' && !userApiKeys?.elevenLabsApiKey) || 
                (storyState.selectedTtsModel === 'google' && !userApiKeys?.googleApiKey)) && 
               !apiKeysLoading && <MissingApiKeyMessage />}
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
              {((!userApiKeys?.googleApiKey) || // For prompt generation
                (storyState.imageProvider === 'picsart' && !userApiKeys?.picsartApiKey) ||
                (storyState.imageProvider === 'gemini' && !userApiKeys?.geminiApiKey) ||
                (storyState.imageProvider === 'imagen3' && !userApiKeys?.googleApiKey) 
              ) && !apiKeysLoading && <MissingApiKeyMessage />}
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

        <div className="flex gap-3 pt-4 border-t flex-wrap">
          <Button 
            onClick={async () => {
              if (!storyData.userId) {
                toast({ title: 'Error', description: 'User not authenticated.', variant: 'destructive' });
                return;
              }

              handleSetLoading('save', true);
              
              try {
                // Use the statically imported saveStory from firestoreStoryActions
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

          <Button 
            variant="outline"
            onClick={async () => {
              if (!storyData.title) {
                toast({ title: 'Error', description: 'Story must have a title to download.', variant: 'destructive' });
                return;
              }

              handleSetLoading('download', true);
              
              try {
                const { downloadStoryAsZip } = await import('@/utils/downloadStoryUtils');
                await downloadStoryAsZip(storyData);
                toast({ 
                  title: 'Download Started!', 
                  description: 'Your story zip file is being prepared for download.', 
                  className: 'bg-green-500 text-white' 
                });
              } catch (error) {
                console.error('Error downloading story:', error);
                toast({ 
                  title: 'Download Error', 
                  description: 'An unexpected error occurred while preparing the download.', 
                  variant: 'destructive' 
                });
              }
              
              handleSetLoading('download', false);
            }}
            disabled={storyState.isLoading.download || !storyData.title}
          >
            {storyState.isLoading.download ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Download Story
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
          
          {storyData.id && (
            <Button 
              variant="destructive" 
              onClick={() => setIsDeleteConfirmOpen(true)}
              disabled={storyState.isLoading.delete}
            >
              {storyState.isLoading.delete ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Story
                </>
              )}
            </Button>
          )}
        </div>

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

        <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Story Permanently</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &quot;<strong>{storyData.title}</strong>&quot;? This action cannot be undone and will permanently delete the story and all its associated files (images, audio, etc.).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteStory}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Permanently
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

