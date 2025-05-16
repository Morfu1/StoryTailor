"use client";

import type { Story } from "@/types/story";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getStory,
  generateImageFromPrompt,
  saveStory,
} from "@/actions/storyActions"; // Assuming functions are in storyActions
import type { GeneratedImage } from "@/types/story"; // Assuming Story is imported elsewhere
import {
  AlignCenter,
  AlignJustify,
  ArrowLeft,
  BookOpen,
  Clapperboard,
  Download,
  Edit3,
  Film,
  ImageIcon,
  Loader2,
  Music,
  Palette,
  Save,
  Settings,
  Sparkles,
  Text,
  Type,
  User,
  Video,
  Wand2,
  X,
  ZoomIn,
  ZoomOut,
  Play,
  Pause,
  Maximize,
  Check,
  Trash2,
  Edit2,
  History,
  Plus,
  SidebarClose,
  SidebarOpen,
  Copy,
  Scissors,
  Info,
  Volume2,
  Upload,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Fragment, useEffect, useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { parseNamedPrompts, parseEntityReferences } from "./utils";
import StoryContent from "./components/StoryContent";
import VoicesContent from "./components/VoicesContent";
import AllMediaContent from "./components/AllMediaContent";
import CharactersPanelContent, { EntityType } from "./components/CharactersPanelContent";
import EditTimelineItemPanelContent from "./components/EditTimelineItemPanelContent";
import VideoPageSidebar from "./components/VideoPageSidebar";
import VideoPreviewArea from "./components/VideoPreviewArea";
import VideoControls from "./components/VideoControls";
import TimelineStrip from "./components/TimelineStrip";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";

const sidebarNavItems = [
  { name: "All Media", icon: Wand2 },
  // { name: "Edit", icon: Edit3 }, // This will be our new panel, let's rename or use a different icon later if needed
  { name: "Edit Image", icon: ImageIcon }, // New panel for editing timeline items
  { name: "Characters", icon: User },
  { name: "Story", icon: Text },
  { name: "Music", icon: Music },
  { name: "Settings", icon: Settings },
  { name: "Voices", icon: Video, sectionBreak: true },
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
  const [selectedPanel, setSelectedPanel] = useState("Story"); // Default to Story panel to show script
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [currentChapter, setCurrentChapter] = useState(1);
  const [chaptersGenerated, setChaptersGenerated] = useState<number[]>([]);
  const [totalImagesToGenerate, setTotalImagesToGenerate] = useState<number>(7); // Default to 7 images
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

  // Handle generating images for a chapter in batches of 7 per minute
  const handleGenerateChapterImages = async () => {
    if (!storyData || isGeneratingImages) return;

    setIsGeneratingImages(true);
    setSelectedPanel("Story"); // Switch to Story panel to show progress

    try {
      // Calculate the audio duration in minutes
      const audioDuration = storyData?.narrationAudioDurationSeconds || 240; // Default to 4 minutes if not set

      // We'll use 7 images per chapter, regardless of audio duration
      const imagesToGenerate = 7;
      setTotalImagesToGenerate(imagesToGenerate);

      toast({
        title: `Generating Chapter ${currentChapter}`,
        description: `Creating images for Chapter ${currentChapter}.`,
      });

      // Generate prompts based on story content and characters
      const script = storyData?.generatedScript || "";
      const title = storyData?.title || "Story";

      // Update UI state with total images to generate
      setTotalImagesToGenerate(imagesToGenerate);

      // Define a type for the prompt objects
      type EnhancedPrompt = {
        originalPromptWithReferences: string;
        expandedPrompt: string;
      };

      // Log character, location, and item prompts for debugging
      console.log(
        "Character prompts:",
        storyData?.detailsPrompts?.characterPrompts,
      );
      console.log(
        "Location prompts:",
        storyData?.detailsPrompts?.locationPrompts,
      );
      console.log("Item prompts:", storyData?.detailsPrompts?.itemPrompts);

      // Get existing image prompts from the story data if available
      const existingImagePrompts = storyData?.imagePrompts || [];
      console.log("Existing image prompts:", existingImagePrompts);

      // Debug the character/location data for reference extraction
      if (storyData?.detailsPrompts?.characterPrompts) {
        console.log(
          "Character data available:",
          storyData.detailsPrompts.characterPrompts
            .split("\n\n")
            .map((block) => block.trim().split("\n")[0])
            .filter(Boolean),
        );
      }
      if (storyData?.detailsPrompts?.locationPrompts) {
        console.log(
          "Location data available:",
          storyData.detailsPrompts.locationPrompts
            .split("\n\n")
            .map((block) => block.trim().split("\n")[0])
            .filter(Boolean),
        );
      }

      // Check if we have predefined image prompts in the database
      if (!existingImagePrompts || existingImagePrompts.length === 0) {
        toast({
          title: "Warning: No Image Prompts Found",
          description:
            "No predefined image prompts found in the database. Please make sure the story has image prompts.",
          variant: "destructive",
        });
      }

      // Use actual number of prompts or limit to imagesToGenerate (whichever is smaller)
      const actualImagesToGenerate = Math.min(
        imagesToGenerate,
        existingImagePrompts.length || 0,
      );
      setTotalImagesToGenerate(actualImagesToGenerate);

      // Select prompts for this chapter (7 per chapter)
      const startIndex = (currentChapter - 1) * 7;
      const selectedPrompts = existingImagePrompts.slice(
        startIndex,
        startIndex + actualImagesToGenerate,
      );

      if (selectedPrompts.length === 0) {
        throw new Error(
          "No image prompts available for this chapter. Please check the database.",
        );
      }

      // Create enhanced prompts by parsing entity references in the existing prompts
      const imagePrompts: EnhancedPrompt[] = selectedPrompts.map(
        (prompt, index) => {
          // Use the existing prompt with entity references
          const originalPromptWithReferences = prompt;

          console.log(
            `Processing image prompt ${index + 1}: ${originalPromptWithReferences}`,
          );

          // Parse and replace entity references with full descriptions
          const expandedPrompt = parseEntityReferences(
            originalPromptWithReferences,
            storyData,
          );

          console.log(
            `Expanded prompt ${index + 1}: ${expandedPrompt.substring(0, 100)}...`,
          );

          return {
            originalPromptWithReferences,
            expandedPrompt,
          };
        },
      );

      // Process images sequentially rather than in parallel
      const newImages: GeneratedImage[] = [];

      for (let index = 0; index < imagePrompts.length; index++) {
        // Get the enhanced prompt for this index
        const prompt = imagePrompts[index];
        const originalPromptWithReferences =
          prompt.originalPromptWithReferences;
        const expandedPrompt = prompt.expandedPrompt;

        // Update progress indicators
        setCurrentImageProgress(index + 1);
        setGenerationProgress(
          Math.round((index / (imagePrompts.length || 1)) * 100),
        );

        // Log which prompt is being processed for debugging
        console.log(
          `Processing prompt ${index + 1}/${imagePrompts.length}:`,
          originalPromptWithReferences,
        );

        // Show individual progress
        toast({
          title: `Generating Image ${index + 1}/${imagesToGenerate}`,
          description: originalPromptWithReferences.substring(0, 100) + "...",
          duration: 3000, // Show for 3 seconds
        });

        // Log the original and enhanced prompts for debugging
        console.log(
          `Original prompt with references: ${originalPromptWithReferences}`,
        );
        console.log(`Expanded prompt for generation: ${expandedPrompt}`);

        // Call the actual image generation API
        const result = await generateImageFromPrompt(expandedPrompt);

        if (!result.success || !result.imageUrl) {
          throw new Error(
            `Failed to generate image ${index + 1}: ${result.error || "Unknown error"}`,
          );
        }

        // Add to our array
        newImages.push({
          originalPrompt: originalPromptWithReferences,
          requestPrompt: result.requestPrompt || expandedPrompt,
          imageUrl: result.imageUrl,
          isChapterGenerated: true,
          chapterNumber: currentChapter,
          expandedPrompt: expandedPrompt, // Store for reference
        });

        // Update progress
        setGenerationProgress(
          Math.round(((index + 1) / (imagePrompts.length || 1)) * 100),
        );

        // Show success toast for each image
        toast({
          title: `Image ${index + 1}/${imagesToGenerate} Generated`,
          description: `Created from: ${originalPromptWithReferences.substring(0, 50)}...`,
          duration: 2000,
          className: "bg-green-500 text-white",
        });

        // Add a second toast with more detail about entity replacements
        toast({
          title: "Entity References Replaced",
          description:
            "All @Entity references were replaced with their full descriptions",
          duration: 3000,
        });

        // Log the final prompt with replacements for debugging
        console.log("Final prompt with replacements:", expandedPrompt);
        console.log(
          "Entity references in original prompt:",
          originalPromptWithReferences.match(
            /@[A-Za-z0-9]+(?:\\s+[A-Za-z0-9]+)*/g,
          ) || [],
        );

        // For completeness, also log both prompts side by side
        console.log("BEFORE:", originalPromptWithReferences);
        console.log("AFTER:", expandedPrompt);

        // For debugging, show what @references were replaced
        const beforeRefs =
          originalPromptWithReferences.match(
            /@[A-Za-z0-9]+(?:\\s+[A-Za-z0-9]+)*/g,
          ) || [];
        beforeRefs.forEach((ref) => {
          const entityName = ref.substring(1).trim();
          console.log(`@${entityName} was replaced with its description`);
        });

        newImages.push({
          originalPrompt: originalPromptWithReferences,
          requestPrompt: result.requestPrompt || expandedPrompt,
          imageUrl: result.imageUrl,
          isChapterGenerated: true,
          chapterNumber: currentChapter,
          expandedPrompt: expandedPrompt, // Store for reference
          history: [], // Initialize history
        });
      }

      // Reset progress when complete
      // Set final progress values
      setCurrentImageProgress(imagesToGenerate);
      setGenerationProgress(100);

      // Add the new images to the story data
      setStoryData((prevData) => {
        if (!prevData) return null;

        // Get existing images that weren't chapter-generated or were from different chapters
        const existingImages = Array.isArray(prevData.generatedImages)
          ? prevData.generatedImages.filter(
              (img) =>
                !img.isChapterGenerated ||
                (img.isChapterGenerated &&
                  img.chapterNumber !== currentChapter),
            )
          : [];

        // Save the updated story with new images
        if (prevData) {
          saveStory(
            {
              ...prevData,
              generatedImages: [...existingImages, ...newImages],
            },
            prevData.userId,
          );
        }

        return {
          ...prevData,
          // Append new images to the story data
          generatedImages: [...existingImages, ...newImages],
        };
      });

      // Mark this chapter as generated
      setChaptersGenerated((prev) => [...prev, currentChapter]);

      // Check if we have more chapters to generate
      const totalPossibleChapters = Math.ceil(
        (storyData?.imagePrompts?.length || 0) / 7,
      );

      if (currentChapter < totalPossibleChapters) {
        // Update to next chapter if more are available
        setCurrentChapter((prev) => prev + 1);

        toast({
          title: "Chapter Images Complete",
          description: `Generated ${actualImagesToGenerate} images for Chapter ${currentChapter}. ${totalPossibleChapters - currentChapter} more chapters available.`,
          className: "bg-green-500 text-white",
          duration: 5000,
        });
      } else {
        toast({
          title: "All Chapter Images Complete",
          description: `Generated all available chapter images (${currentChapter} chapters total).`,
          className: "bg-green-500 text-white",
          duration: 5000,
        });
      }

      // Switch to the Timeline panel to show the results
      setSelectedPanel("All Media");
    } catch (error) {
      console.error("Error generating images:", error);
      toast({
        title: "Image Generation Failed",
        description:
          "There was an error generating the images. Please try again.",
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

      // Use the same entity parsing logic
      const expandedPrompt = parseEntityReferences(editedPrompt, storyData);
      const finalPrompt = `${expandedPrompt}, high quality, 3D, cartoon`;

      console.log("Generating EDITED image with prompt:", finalPrompt);
      const result = await generateImageFromPrompt(finalPrompt);

      if (!result.success || !result.imageUrl) {
        throw new Error(result.error || "Failed to generate edited image.");
      }

      // Create new image data
      const newImageData: GeneratedImage = {
        ...currentImage,
        originalPrompt: editedPrompt, // The potentially edited prompt
        requestPrompt: result.requestPrompt || finalPrompt,
        imageUrl: result.imageUrl,
        expandedPrompt: expandedPrompt,
        history: [
          ...(currentImage.history || []), // Keep existing history
          {
            // Add current state to history
            imageUrl: currentImage.imageUrl,
            originalPrompt: currentImage.originalPrompt,
            timestamp: new Date(),
          },
        ].slice(-5), // Keep last 5 history items
      };

      // Update storyData
      setStoryData((prevData) => {
        if (!prevData || !prevData.generatedImages) return null;
        const updatedImages = [...prevData.generatedImages];
        updatedImages[selectedTimelineImage] = newImageData;
        return { ...prevData, generatedImages: updatedImages };
      });

      await saveStoryData(storyData); // Save to DB

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

    // Create new image data from history
    const revertedImageData: GeneratedImage = {
      ...currentImage,
      originalPrompt: historicalImage.originalPrompt,
      imageUrl: historicalImage.imageUrl,
      // Remove the reverted item from history to avoid duplicates if re-edited
      history: currentImage.history.filter((_, idx) => idx !== historyIndex),
      // Add current state to history before reverting
      // history: [
      //   ...(currentImage.history.filter((_, idx) => idx !== historyIndex) || []),
      //   {
      //     imageUrl: currentImage.imageUrl,
      //     originalPrompt: currentImage.originalPrompt,
      //     timestamp: new Date()
      //   }
      // ].slice(-5),
    };

    setEditedPrompt(revertedImageData.originalPrompt); // Update the textarea

    setStoryData((prevData) => {
      if (!prevData || !prevData.generatedImages) return null;
      const updatedImages = [...prevData.generatedImages];
      updatedImages[selectedTimelineImage] = revertedImageData;
      return { ...prevData, generatedImages: updatedImages };
    });

    await saveStoryData(storyData);

    toast({
      title: "Image Reverted",
      description: "Image reverted to selected historical version.",
      className: "bg-green-500 text-white",
    });
  };

  // Update story data in the database
  const saveStoryData = async (updatedStory: Story) => {
    try {
      await saveStory(updatedStory, updatedStory.userId);
    } catch (error) {
      console.error("Error saving story data:", error);
      toast({
        title: "Error Saving Data",
        description: "There was a problem saving your story data.",
        variant: "destructive",
      });
    }
  };

  // Define how to handle a newly created character
  const handleNewCharacterCreated = async (characterData: {
    name: string;
    description: string;
    imageUrl: string;
    requestPrompt?: string;
    type: EntityType;
  }) => {
    // Optimistic UI update first
    let storyDataAfterOptimisticUpdate: Story | null = null;

    setStoryData((prevStoryData) => {
      if (!prevStoryData) return null;

      const newGeneratedImage: GeneratedImage = {
        originalPrompt: characterData.description,
        requestPrompt: characterData.requestPrompt || characterData.description,
        imageUrl: characterData.imageUrl,
      };
      const updatedGeneratedImages = [
        ...(prevStoryData.generatedImages || []),
        newGeneratedImage,
      ];

      let updatedCharacterPrompts =
        (prevStoryData.detailsPrompts as any)?.characterPrompts || "";
      if (characterData.type === "Character") {
        // Construct the new entry: Name on the first line, description on subsequent lines.
        const newEntry = `${characterData.name}\n${characterData.description}`;

        // Ensure a robust separator: always two newlines if there's existing content.
        if (updatedCharacterPrompts.trim() === "") {
          updatedCharacterPrompts = newEntry;
        } else {
          // Remove any trailing newlines/whitespace from existing prompts, then add two newlines, then the new entry.
          updatedCharacterPrompts = `${updatedCharacterPrompts.trimEnd()}\n\n${newEntry}`;
        }
      }

      const updatedDetailsPrompts = {
        ...((prevStoryData.detailsPrompts as any) || {}), // Guard against non-object spread
        characterPrompts: updatedCharacterPrompts,
        // Preserve other prompt types if they exist
        itemPrompts: (prevStoryData.detailsPrompts as any)?.itemPrompts,
        locationPrompts: (prevStoryData.detailsPrompts as any)?.locationPrompts,
      };

      storyDataAfterOptimisticUpdate = {
        ...prevStoryData,
        generatedImages: updatedGeneratedImages,
        detailsPrompts: updatedDetailsPrompts,
      };
      return storyDataAfterOptimisticUpdate;
    });

    // Now, attempt to save to the database
    if (storyDataAfterOptimisticUpdate && user?.uid) {
      try {
        // Ensure storyDataAfterOptimisticUpdate is an object before spreading
        if (
          typeof storyDataAfterOptimisticUpdate !== "object" ||
          storyDataAfterOptimisticUpdate === null
        ) {
          toast({
            title: "Error",
            description: "Invalid story data.",
            variant: "destructive",
          });
          return;
        }
        // Since we've verified it's a non-null object, we can safely cast it as Story
        const storyData = storyDataAfterOptimisticUpdate as Story;
        // Ensure the storyId is included if it exists, for updates
        const storyToSave = {
          ...storyData,
          id: storyId || undefined,
        };

        toast({ title: "Saving to Database...", description: "Please wait." });
        const saveResult = await saveStory(storyToSave, user.uid);

        if (saveResult.success && saveResult.storyId) {
          toast({
            title: "Successfully Saved to Database!",
            description: `${characterData.name} details are now stored.`,
            className: "bg-green-500 text-white",
          });
          if (!storyId && saveResult.storyId) {
            router.replace(`/assemble-video?storyId=${saveResult.storyId}`, {
              scroll: false,
            });
          }
          // Guard access to .id on storyDataAfterOptimisticUpdate
          if (
            saveResult.storyId &&
            storyDataAfterOptimisticUpdate &&
            typeof storyDataAfterOptimisticUpdate === "object" &&
            "id" in storyDataAfterOptimisticUpdate &&
            (storyDataAfterOptimisticUpdate as Story).id !== saveResult.storyId
          ) {
            setStoryData((prev) =>
              prev ? { ...prev, id: saveResult.storyId } : null,
            );
          }
        } else {
          toast({
            title: "Database Save Failed",
            description:
              saveResult.error ||
              "Could not save the new character to the database. The change is currently local.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error during saveStory:", error);
        toast({
          title: "Database Save Error",
          description:
            "An unexpected error occurred while saving to the database.",
          variant: "destructive",
        });
      }
    } else if (!user?.uid) {
      toast({
        title: "User Not Authenticated",
        description:
          "Cannot save to database. Please ensure you are logged in.",
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
          >
            <Download className="w-4 h-4 mr-2" />
            Export (Coming Soon)
          </Button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-2/5 p-4 overflow-auto border-r border-border">
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
            ) : selectedPanel === "Characters" ? (
              <CharactersPanelContent
                storyData={storyData}
                onCharacterCreated={handleNewCharacterCreated}
              />
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
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Select an option from the sidebar to view settings.
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
            {/* The Edit Timeline Item panel is now part of the left sidebar content */}
          </div>
        </div>
      </div>
    </div>
  );
}
