
"use client";

import type { Story } from "@/types/story"; // Import StoryCharacterLocationItemPrompts removed
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
// import {
//   Tooltip,
//   TooltipContent,
//   TooltipProvider,
//   TooltipTrigger,
// } from "@/components/ui/tooltip";
import {
  getStory,
  generateImageFromPrompt,
  saveStory,
} from "@/actions/storyActions"; 
import type { GeneratedImage } from "@/types/story"; 
import {
  // AlignCenter,
  // AlignJustify,
  // ArrowLeft,
  // BookOpen,
  // Clapperboard,
  Download,
  // Edit3,
  // Film,
  ImageIcon,
  Loader2,
  Music,
  Palette,
  // Save,
  Settings,
  Sparkles,
  Text,
  // Type,
  Video,
  // Wand2,
  // X,
  // ZoomIn,
  // ZoomOut,
  // Play,
  // Pause,
  // Maximize,
  // Check,
  // Trash2,
  // Edit2,
  // History,
  // Plus,
  // SidebarClose,
  SidebarOpen,
  // Copy,
  // Scissors,
  // Info,
  // Volume2,
  // Upload,
} from "lucide-react";
// import Image from "next/image";
// import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useState } from "react"; // Removed Fragment, useMemo as they aren't used here now
import { useToast } from "@/hooks/use-toast";
// import { Input } from "@/components/ui/input";
import { parseEntityReferences } from "./utils";
import StoryContent from "./components/StoryContent";
import VoicesContent from "./components/VoicesContent";
import AllMediaContent from "./components/AllMediaContent";
import EditTimelineItemPanelContent from "./components/EditTimelineItemPanelContent";
import VideoPageSidebar from "./components/VideoPageSidebar";
import VideoPreviewArea from "./components/VideoPreviewArea";
import VideoControls from "./components/VideoControls";
import TimelineStrip from "./components/TimelineStrip";
// import { Label } from "@/components/ui/label";
// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuTrigger,
// } from "@/components/ui/dropdown-menu";
// import { Textarea } from "@/components/ui/textarea";

const sidebarNavItems = [
  { name: "Story", icon: Text },
  { name: "Edit Image", icon: Palette },
  { name: "Voices", icon: Music, sectionBreak: true }, // Changed icon to Music for Voices for variety
  { name: "All Media", icon: Video }, // Changed icon to Video for All Media
  { name: "Settings", icon: Settings },
];

export default function AssembleVideoPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const storyId = searchParams.get("storyId");
  const { toast } = useToast();

  const [storyData, setStoryData] = useState<Story | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedPanel, setSelectedPanel] = useState("Story"); 
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [currentChapter, setCurrentChapter] = useState(1);
  const [chaptersGenerated, setChaptersGenerated] = useState<number[]>([]);
  const [totalImagesToGenerate, setTotalImagesToGenerate] = useState<number>(7); 
  const [currentImageProgress, setCurrentImageProgress] = useState(0);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [selectedTimelineImage, setSelectedTimelineImage] = useState<
    number | null
  >(null);
  const [editedPrompt, setEditedPrompt] = useState<string>("");
  const [isEditingImage, setIsEditingImage] = useState(false);

  useEffect(() => {
    if (
      selectedTimelineImage !== null &&
      storyData?.generatedImages?.[selectedTimelineImage]
    ) {
      setEditedPrompt(
        storyData.generatedImages[selectedTimelineImage].originalPrompt || "",
      );
    }
  }, [selectedTimelineImage, storyData?.generatedImages]);

  
  const handleGenerateChapterImages = async () => {
    if (!storyData || isGeneratingImages) return;

    setIsGeneratingImages(true);
    setSelectedPanel("Story"); 

    try {
      
      const audioDuration = storyData?.narrationAudioDurationSeconds || 240; 
      const imagesToGenerate = 7;
      setTotalImagesToGenerate(imagesToGenerate);

      toast({
        title: `Generating Chapter ${currentChapter}`,
        description: `Creating images for Chapter ${currentChapter}.`,
      });

      type EnhancedPrompt = {
        originalPromptWithReferences: string;
        expandedPrompt: string;
      };

      const existingImagePrompts = storyData?.imagePrompts || [];
      if (!existingImagePrompts || existingImagePrompts.length === 0) {
         toast({
          title: "No Image Prompts",
          description: "Cannot generate chapter images without image prompts defined in the story.",
          variant: "destructive",
        });
        setIsGeneratingImages(false);
        return;
      }


      const startIndex = (currentChapter - 1) * imagesToGenerate;
      const promptsForChapter = existingImagePrompts.slice(
        startIndex,
        startIndex + imagesToGenerate,
      );

      if (promptsForChapter.length === 0) {
        toast({
          title: "No More Prompts",
          description: `No image prompts available for Chapter ${currentChapter}. All available prompts might have been used.`,
          variant: "default",
        });
        setIsGeneratingImages(false);
        return;
      }
      
      setTotalImagesToGenerate(promptsForChapter.length);


      const imagePrompts: EnhancedPrompt[] = promptsForChapter.map(
        (promptText) => {
          const expandedPrompt = parseEntityReferences(
            promptText,
            storyData,
          );
          return {
            originalPromptWithReferences: promptText,
            expandedPrompt,
          };
        },
      );

      const newImagesBatch: GeneratedImage[] = [];

      for (let index = 0; index < imagePrompts.length; index++) {
        const currentPrompt = imagePrompts[index];
        setCurrentImageProgress(index + 1);
        setGenerationProgress(
          Math.round(((index + 1) / imagePrompts.length) * 100),
        );

        toast({
          title: `Generating Image ${index + 1}/${imagePrompts.length}`,
          description: currentPrompt.originalPromptWithReferences.substring(0, 100) + "...",
          duration: 4000, 
        });
        
        // Append styles for PicsArt
        const finalApiPrompt = `${currentPrompt.expandedPrompt}, 3D, Cartoon, High Quality, detailed illustration`;
        const result = await generateImageFromPrompt(finalApiPrompt);

        if (!result.success || !result.imageUrl) {
          throw new Error(
            `Failed to generate image ${index + 1}: ${result.error || "Unknown error"}`,
          );
        }
        
        newImagesBatch.push({
          originalPrompt: currentPrompt.originalPromptWithReferences, 
          requestPrompt: result.requestPrompt || finalApiPrompt, 
          imageUrl: result.imageUrl,
          isChapterGenerated: true,
          chapterNumber: currentChapter,
          expandedPrompt: currentPrompt.expandedPrompt, 
          history: [],
        });

        toast({
          title: `Image ${index + 1}/${imagePrompts.length} Generated!`,
          description: `Created from: ${currentPrompt.originalPromptWithReferences.substring(0, 50)}...`,
          duration: 2000,
          className: "bg-green-500 text-white",
        });
      }
      
      setGenerationProgress(100);

      setStoryData((prevData) => {
        if (!prevData) return null;
        const updatedStory = {
          ...prevData,
          generatedImages: [...(prevData.generatedImages || []), ...newImagesBatch],
        };
        saveStoryData(updatedStory); // Async save, don't await here to keep UI responsive
        return updatedStory;
      });

      setChaptersGenerated((prev) => [...prev, currentChapter]);
      const totalPossibleChapters = Math.ceil(
        (storyData?.imagePrompts?.length || 0) / imagesToGenerate,
      );

      if (currentChapter < totalPossibleChapters) {
        setCurrentChapter((prev) => prev + 1);
        toast({
          title: "Chapter Images Complete!",
          description: `Generated ${newImagesBatch.length} images for Chapter ${currentChapter -1}. Ready for Chapter ${currentChapter}.`,
          className: "bg-green-500 text-white",
          duration: 5000,
        });
      } else {
        toast({
          title: "All Chapter Images Generated!",
          description: `Generated all available chapter images.`,
          className: "bg-green-500 text-white",
          duration: 5000,
        });
      }
      setSelectedPanel("All Media"); 
    } catch (error) {
      console.error("Error generating images:", error);
      toast({
        title: "Image Generation Failed",
        description: (error as Error).message || "There was an error generating the images. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingImages(false);
      setCurrentImageProgress(0);
      setGenerationProgress(0);
    }
  };

  const handleEditGenerate = async () => {
    if (
      selectedTimelineImage === null ||
      !storyData ||
      !storyData.generatedImages
    )
      return;

    setIsEditingImage(true);
    toast({
      title: "Generating Edited Image...",
      description: "Replacing the image in the timeline.",
    });

    try {
      const currentImage = storyData.generatedImages[selectedTimelineImage];
      if (!currentImage) throw new Error("Selected image not found");

      const expandedPrompt = parseEntityReferences(editedPrompt, storyData);
      const finalPrompt = `${expandedPrompt}, 3D, Cartoon, High Quality, detailed illustration`; // Added styles

      const result = await generateImageFromPrompt(finalPrompt);

      if (!result.success || !result.imageUrl) {
        throw new Error(result.error || "Failed to generate edited image.");
      }

      const newImageData: GeneratedImage = {
        ...currentImage,
        originalPrompt: editedPrompt, 
        requestPrompt: result.requestPrompt || finalPrompt,
        imageUrl: result.imageUrl,
        expandedPrompt: expandedPrompt,
        history: [
          ...(currentImage.history || []).slice(-4), // Keep last 4 + new current
          {
            imageUrl: currentImage.imageUrl,
            originalPrompt: currentImage.originalPrompt,
            timestamp: new Date(),
          },
        ],
      };

      setStoryData((prevData) => {
        if (!prevData || !prevData.generatedImages) return null;
        const updatedImages = [...prevData.generatedImages];
        updatedImages[selectedTimelineImage] = newImageData;
        const updatedStory = { ...prevData, generatedImages: updatedImages };
        saveStoryData(updatedStory);
        return updatedStory;
      });

      toast({
        title: "Image Updated!",
        description:
          "The timeline image has been replaced with the new version.",
        className: "bg-green-500 text-white",
      });
    } catch (error: any) {
      console.error("Error generating edited image:", error);
      toast({
        title: "Edited Image Generation Failed",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsEditingImage(false);
    }
  };

  const handleRevertToHistory = async (historyIndex: number) => {
    if (
      selectedTimelineImage === null ||
      !storyData ||
      !storyData.generatedImages
    )
      return;

    const currentImage = storyData.generatedImages[selectedTimelineImage];
    if (
      !currentImage ||
      !currentImage.history ||
      !currentImage.history[historyIndex]
    ) {
      toast({
        title: "Error",
        description: "Could not find historical image.",
        variant: "destructive",
      });
      return;
    }

    const historicalImage = currentImage.history[historyIndex];
    const newHistory = currentImage.history.filter((_, idx) => idx !== historyIndex);
    // Add current image to history before reverting
     newHistory.push({ 
        imageUrl: currentImage.imageUrl, 
        originalPrompt: currentImage.originalPrompt, 
        timestamp: new Date() 
    });


    const revertedImageData: GeneratedImage = {
      ...currentImage,
      originalPrompt: historicalImage.originalPrompt,
      imageUrl: historicalImage.imageUrl,
      // expandedPrompt: // Need to decide if we re-parse or store historical expandedPrompt
      history: newHistory.slice(-5),
    };

    setEditedPrompt(revertedImageData.originalPrompt); 

    setStoryData((prevData) => {
      if (!prevData || !prevData.generatedImages) return null;
      const updatedImages = [...prevData.generatedImages];
      updatedImages[selectedTimelineImage] = revertedImageData;
      const updatedStory = { ...prevData, generatedImages: updatedImages };
      saveStoryData(updatedStory);
      return updatedStory;
    });

    toast({
      title: "Image Reverted",
      description: "Image reverted to selected historical version.",
      className: "bg-green-500 text-white",
    });
  };

  
  const saveStoryData = async (updatedStory: Story | null) => {
    if (!updatedStory || !user?.uid) {
        toast({title: "Error", description: "Cannot save, story data or user ID is missing.", variant: "destructive"});
        return;
    }
    try {
      const result = await saveStory(updatedStory, user.uid);
      if (!result.success) {
          toast({ title: "Save Error", description: result.error || "Failed to save story to database.", variant: "destructive"});
      } else {
          console.log("Story data saved successfully via Assemble Page action.");
      }
    } catch (error) {
      console.error("Error saving story data from assemble page:", error);
      toast({
        title: "Error Saving Data",
        description: "There was a problem saving your story data.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }

    if (!storyId) {
      toast({
        title: "Error",
        description: "No story ID provided.",
        variant: "destructive",
      });
      router.replace("/dashboard");
      return;
    }

    setPageLoading(true);
    getStory(storyId, user.uid)
      .then((response) => {
        if (response.success && response.data) {
          setStoryData(response.data);
          // Determine current chapter based on generated images
          if (response.data.generatedImages && response.data.imagePrompts) {
            const generatedChapterNumbers = response.data.generatedImages
              .filter(img => img.isChapterGenerated && typeof img.chapterNumber === 'number')
              .map(img => img.chapterNumber as number);
            const maxGeneratedChapter = generatedChapterNumbers.length > 0 ? Math.max(...generatedChapterNumbers) : 0;
            
            const totalPossibleChapters = Math.ceil((response.data.imagePrompts.length || 0) / 7);
            if (maxGeneratedChapter < totalPossibleChapters) {
              setCurrentChapter(maxGeneratedChapter + 1);
            } else {
              setCurrentChapter(totalPossibleChapters > 0 ? totalPossibleChapters : 1); // Or indicate completion
            }
            setChaptersGenerated([...new Set(generatedChapterNumbers)]);
          }

        } else {
          toast({
            title: "Error Loading Story",
            description: response.error || "Failed to load story data.",
            variant: "destructive",
          });
          router.replace("/dashboard");
        }
      })
      .finally(() => setPageLoading(false));
  }, [storyId, user, router, toast, authLoading]);

  if (pageLoading || authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="ml-4 text-xl text-foreground">Loading Video Editor...</p>
      </div>
    );
  }

  if (!storyData) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-xl text-destructive">Could not load story data.</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-var(--header-height,4rem))] bg-secondary text-foreground">
      {isSidebarOpen && (
        <VideoPageSidebar
          selectedPanel={selectedPanel}
          setSelectedPanel={setSelectedPanel}
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          storyId={storyId}
          sidebarNavItems={sidebarNavItems}
        />
      )}
      <div className="flex-1 flex flex-col">
        <div className="bg-background border-b border-border p-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            {!isSidebarOpen && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSidebarOpen(true)}
                className="mr-2"
              >
                <SidebarOpen className="h-5 w-5" />
              </Button>
            )}
            <Sparkles className="w-6 h-6 text-primary" />
            <h1
              className="text-lg font-semibold truncate"
              title={storyData.title}
            >
              {storyData.title}
            </h1>
          </div>
          <Button
            variant="default"
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
            disabled // Temporarily disable export
          >
            <Download className="w-4 h-4 mr-2" />
            Export (Coming Soon)
          </Button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-2/5 p-4 overflow-auto border-r border-border bg-background/30"> {/* Changed background */}
            {selectedPanel === "All Media" ? (
              <AllMediaContent storyData={storyData} />
            ) : selectedPanel === "Edit Image" ? (
              <EditTimelineItemPanelContent
                storyData={storyData}
                selectedTimelineImage={selectedTimelineImage}
                editedPrompt={editedPrompt}
                setEditedPrompt={setEditedPrompt}
                handleEditGenerate={handleEditGenerate}
                isEditingImage={isEditingImage}
                handleRevertToHistory={handleRevertToHistory}
              />
            ) : selectedPanel === "Voices" ? (
              <VoicesContent storyData={storyData} />
            ) : selectedPanel === "Story" ? (
              storyData ? (
                <StoryContent
                  storyData={storyData}
                  isGeneratingImages={isGeneratingImages}
                  handleGenerateChapterImages={handleGenerateChapterImages}
                  currentChapter={currentChapter}
                  chaptersGenerated={chaptersGenerated}
                  currentImageProgress={currentImageProgress}
                  generationProgress={generationProgress}
                  totalImagesToGenerate={totalImagesToGenerate}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              )
            ) : ( // Fallback for settings or any other panel
              <div className="flex h-full items-center justify-center p-6 text-center rounded-lg border border-border shadow-sm bg-card">
                <Settings className="w-12 h-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-sm">
                  {selectedPanel} settings will be available here. <br/> This section is under construction.
                </p>
              </div>
            )}
          </div>

          <div className="w-3/5 flex flex-col p-4 gap-4 overflow-hidden">
            <VideoPreviewArea storyData={storyData} selectedTimelineImage={selectedTimelineImage} />
            <VideoControls storyData={storyData} />
            <TimelineStrip
              storyData={storyData}
              selectedTimelineImage={selectedTimelineImage}
              setSelectedTimelineImage={setSelectedTimelineImage}
              setSelectedPanel={setSelectedPanel}
              isGeneratingImages={isGeneratingImages}
              handleGenerateChapterImages={handleGenerateChapterImages}
              currentChapter={currentChapter}
              chaptersGenerated={chaptersGenerated}
              currentImageProgress={currentImageProgress}
              totalImagesToGenerate={totalImagesToGenerate}
              generationProgress={generationProgress}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

    