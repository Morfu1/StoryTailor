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
  saveStory,
  updateStoryTimeline,
} from '@/actions/baserowStoryActions'; // Corrected import path
import { generateImageFromPrompt } from "@/actions/storyActions"; // Kept for this function
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
  Music2, // For Narration track icon in page.tsx
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
import React, { useEffect, useState, useRef } from "react"; // Removed Fragment, useMemo as they aren't used here now
import { DndContext, DragEndEvent, closestCenter } from "@dnd-kit/core"; // Added DndContext and DragEndEvent
import { useToast } from "@/hooks/use-toast";
// import { Input } from "@/components/ui/input";
import { parseEntityReferences } from "./utils";
import StoryContent from "./components/StoryContent";
import VoicesContent from "./components/VoicesContent";
import AllMediaContent from "./components/AllMediaContent";
import EditTimelineItemPanelContent from "./components/EditTimelineItemPanelContent";
import VideoPageSidebar from "./components/VideoPageSidebar";
import VideoPreviewArea from "./components/VideoPreviewArea";
// import VideoControls from "./components/VideoControls"; // Unused
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

// Define types for tracks and media items for page-level state
// These should ideally be in a shared types file, but for now, define here.
export interface PageTimelineMediaItem { // Renamed to avoid conflict if types are merged later
  id: string; // Unique ID for this item on the timeline
  type: 'image' | 'audio' | 'text';
  originalIndex?: number; // For images/texts from storyData.generatedImages
  sourceId?: string; // ID of the source media item from AllMediaContent (e.g., `media-image-${originalIndex}`)
  imageUrl?: string;
  audioUrl?: string; // For audio items
  scriptSegment?: string;
  title?: string; // e.g., from image prompt
  // Timeline specific properties
  startTime?: number; // In seconds from the beginning of the track/timeline
  duration?: number;  // In seconds
  ui?: {
    width?: string | number; // Visual width on the timeline
    marginLeft?: string | number; // Space before this item
    // Potentially other UI related states like color, etc.
  };
}

export interface PageTimelineTrack { // Renamed
  id: string; // e.g., "video-track-1", "narration-track-1"
  type: 'video' | 'narration' | 'audio' | 'text';
  name: string;
  icon: React.ElementType;
  items: PageTimelineMediaItem[];
  height: string;
  accepts: Array<'image' | 'audio' | 'text'>; // Types of media this track can accept
  emptyStateMessage: string;
  showGenerateButton?: boolean;
}


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
  const [currentChapter] = useState(1); // setCurrentChapter was unused
  // const [chaptersGenerated, setChaptersGenerated] = useState<number[]>([]); // Unused
  const [totalImagesToGenerate, setTotalImagesToGenerate] = useState<number>(7);
  const [currentImageProgress, setCurrentImageProgress] = useState(0);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [selectedTimelineImage, setSelectedTimelineImage] = useState<
    number | null
  >(null);
  const [editedPrompt, setEditedPrompt] = useState<string>("");
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [dynamicTimelineTracks, setDynamicTimelineTracks] = useState<PageTimelineTrack[]>([]);
  const [selectedTimelineItemKey, setSelectedTimelineItemKey] = useState<string | null>(null);
  const [timelineModified, setTimelineModified] = useState<boolean>(false);

  const isInitialMount = useRef(true);
  const isStoryDataDrivenUpdate = useRef(false);

  // Function to get script segment (similar to the one in TimelineStrip)
  // This might be better placed in utils.ts if used in multiple places
  const getScriptSegmentForImage = (
    imageIndexInFilteredArray: number,
    totalFilteredImages: number,
    script?: string
  ): string => {
    if (!script || totalFilteredImages === 0) return "";
    const scriptLength = script.length;
    const segmentLength = Math.floor(scriptLength / totalFilteredImages);
    const start = imageIndexInFilteredArray * segmentLength;
    const end = (imageIndexInFilteredArray + 1) * segmentLength;
    if (imageIndexInFilteredArray === totalFilteredImages - 1) return script.substring(start);
    return script.substring(start, end) + (end < scriptLength ? "..." : "");
  };


  // Initialize/Update dynamicTimelineTracks based on storyData
  useEffect(() => {
    isStoryDataDrivenUpdate.current = true; // Set flag before any update

    if (storyData) {
      // Helper to map icon names back to components
      const getIconComponentFromName = (iconName?: string): React.ElementType => {
        if (iconName === "Video") return Video;
        if (iconName === "Music2") return Music2;
        if (iconName === "Text") return Text;
        // Add more mappings if other icons are used
        return ImageIcon; // Default icon
      };

      if (storyData.timelineTracks && storyData.timelineTracks.length > 0) {
        // Rehydrate from saved timelineTracks
        const rehydratedTracks: PageTimelineTrack[] = storyData.timelineTracks.map(storedTrack => ({
          id: storedTrack.id,
          type: storedTrack.type,
          name: storedTrack.name,
          icon: getIconComponentFromName(storedTrack.iconName),
          items: storedTrack.items.map(item => ({ // Ensure items are correctly mapped
            id: item.id,
            type: item.type,
            originalIndex: item.originalIndex,
            sourceId: item.sourceId,
            imageUrl: item.imageUrl,
            audioUrl: item.audioUrl, // Make sure this is in PageTimelineMediaItem if used
            scriptSegment: item.scriptSegment,
            title: item.title,
            startTime: item.startTime,
            duration: item.duration,
            ui: item.ui,
          })),
          height: storedTrack.height,
          accepts: storedTrack.accepts,
          emptyStateMessage: storedTrack.emptyStateMessage,
          showGenerateButton: storedTrack.showGenerateButton,
        }));
        setDynamicTimelineTracks(rehydratedTracks);
      } else {
        // Fallback to generating initial tracks if no saved timelineTracks
        const imagesToShow = storyData.generatedImages?.filter(
          (img): img is GeneratedImage => !!img && img.isChapterGenerated === true
        ) || [];

        const initialTrackConfigs: Omit<PageTimelineTrack, 'items' | 'emptyStateMessage' | 'showGenerateButton'>[] = [
          { id: "video-track-1", type: "video", name: "Video 1", icon: Video, height: "h-[90px]", accepts: ['image'] },
          { id: "narration-track-1", type: "narration", name: "Narration", icon: Music2, height: "h-[40px]", accepts: ['audio'] },
          { id: "text-track-1", type: "text", name: "Script", icon: Text, height: "h-[60px]", accepts: ['text'] },
        ];

        const newTracks = initialTrackConfigs.map(config => {
          let items: PageTimelineMediaItem[] = [];
          let emptyStateMessage = `${config.name} track.`;
          let showGenerateButton = false;

          if (config.type === 'video' && imagesToShow.length > 0) {
            items = imagesToShow.map((img) => { // index removed as it was unused
              const originalImageIndex = storyData.generatedImages?.findIndex(
                (originalImg) => originalImg.imageUrl === img.imageUrl && originalImg.originalPrompt === img.originalPrompt
              );
              return {
                id: `img-${originalImageIndex}-${Date.now()}-${Math.random().toString(36).substring(2,7)}`, // More unique ID
                type: 'image',
                originalIndex: originalImageIndex,
                imageUrl: img.imageUrl,
                title: img.originalPrompt?.substring(0,30) + "...",
              };
            });
          } else if (config.type === 'video' && imagesToShow.length === 0) {
              emptyStateMessage = `Image track empty. Generate images for Chapter ${currentChapter}.`;
              showGenerateButton = true;
          }

          if (config.type === 'text' && imagesToShow.length > 0 && storyData.generatedScript) {
            items = imagesToShow.map((img, filteredIndex) => { // filteredIndex unused
              const originalImageIndex = storyData.generatedImages?.findIndex(
                (originalImg) => originalImg.imageUrl === img.imageUrl && originalImg.originalPrompt === img.originalPrompt
              );
              return {
                id: `text-${originalImageIndex}-${Date.now()}-${Math.random().toString(36).substring(2,7)}`, // More unique ID
                type: 'text',
                originalIndex: originalImageIndex,
                scriptSegment: getScriptSegmentForImage(filteredIndex, imagesToShow.length, storyData.generatedScript),
                title: `Script for scene ${originalImageIndex !== undefined ? originalImageIndex + 1 : filteredIndex + 1}`
              };
            });
          } else if (config.type === 'text' && (imagesToShow.length === 0 || !storyData.generatedScript)) {
              emptyStateMessage = "Script snippets will appear here once images are generated.";
          }

          if (config.type === 'narration') {
            if (storyData.narrationAudioUrl) {
              items = [{
                id: 'narration-audio-main',
                type: 'audio',
                title: 'Main Narration',
                audioUrl: storyData.narrationAudioUrl, // Add audioUrl here
                duration: storyData.narrationAudioDurationSeconds, // Add duration
              }];
              emptyStateMessage = "Narration audio loaded.";
            } else {
              emptyStateMessage = "No narration audio available for this story.";
            }
          }
          return { ...config, items, emptyStateMessage, showGenerateButton };
        });
        setDynamicTimelineTracks(newTracks);
      }
    } else {
      setDynamicTimelineTracks([]); // Clear tracks if no storyData
    }
  }, [storyData, currentChapter]); // Removed getScriptSegmentForImage from deps as it's stable if defined outside or memoized


  // Effect to save timeline changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (isStoryDataDrivenUpdate.current) {
      isStoryDataDrivenUpdate.current = false; // Reset flag
      return; // Don't save if tracks were just updated based on storyData load/change
    }

    if (pageLoading || !storyData || !user?.uid || !storyId || !timelineModified) {
      console.log("Timeline save skipped: conditions not met", {
        pageLoading,
        storyDataExists: !!storyData,
        userUidExists: !!user?.uid,
        storyIdExists: !!storyId,
        timelineModified
      });
      return;
    }

    const saveCurrentTimeline = async () => {
      const getIconNameString = (iconComponent: React.ElementType): string => {
        // Direct mapping for known icons used in tracks
        if (iconComponent === Video) return "Video";
        if (iconComponent === Music2) return "Music2";
        if (iconComponent === Text) return "Text";

        // Fallback for other components (less likely for current track setup)
        // Check for displayName first, then function name
        const iconWithDisplayName = iconComponent as React.FC & { displayName?: string };
        if (iconWithDisplayName.displayName && typeof iconWithDisplayName.displayName === 'string') {
          return iconWithDisplayName.displayName;
        }
        if (typeof iconComponent === 'function' && iconComponent.name && typeof iconComponent.name === 'string') {
          return iconComponent.name;
        }
        return "UnknownIcon"; // Default if no name can be reliably extracted
      };

      const tracksToSave: Story['timelineTracks'] = dynamicTimelineTracks.map(track => {
        const { icon, ...restOfTrack } = track;
        return {
          ...restOfTrack,
          iconName: getIconNameString(icon),
          items: track.items.map(item => ({
            ...item,
            // Ensure any transformations for item properties are done here if needed
            // For example, if PageTimelineMediaItem in types/story.ts has properties
            // not present or differently named in the local PageTimelineMediaItem.
            // Currently, they seem compatible enough for a direct spread.
          })),
        };
      });

      if (tracksToSave && storyId && user?.uid) {
        console.log("Attempting to save timeline state:", tracksToSave);
        try {
          const result = await updateStoryTimeline(storyId, user.uid, tracksToSave);
          if (result.success) {
            toast({ title: "Timeline Saved!", description: "Your timeline changes have been saved.", duration: 2000 });
            setTimelineModified(false); // Reset the modified flag after successful save
          } else {
            toast({ title: "Error Saving Timeline", description: result.error || "An unknown error occurred.", variant: "destructive" });
          }
        } catch (e) {
            console.error("Exception during updateStoryTimeline:", e);
            toast({ title: "Error Saving Timeline", description: "A client-side error occurred.", variant: "destructive" });
        }
      } else {
        console.log("Timeline save skipped: missing data for save operation", { tracksToSave, storyId, userUid: user?.uid });
      }
    };

    // Debounce save if necessary, for now direct call
    const debounceTimeout = setTimeout(() => {
        saveCurrentTimeline();
    }, 1000); // Debounce save by 1 second

    return () => clearTimeout(debounceTimeout);

  }, [dynamicTimelineTracks, storyId, user, pageLoading, storyData, toast, timelineModified]); // Added timelineModified to dependencies


  useEffect(() => {
    if (
      selectedTimelineImage !== null &&
      storyData?.generatedImages?.[selectedTimelineImage]
    ) {
      setEditedPrompt(
        storyData.generatedImages[selectedTimelineImage].originalPrompt || "",
      );
      // If an originalIndex is selected, try to find its corresponding unique key in dynamicTimelineTracks
      if (selectedTimelineImage !== null) {
        let foundKey: string | null = null;
        for (const track of dynamicTimelineTracks) {
          const item = track.items.find(i => i.originalIndex === selectedTimelineImage);
          if (item) {
            foundKey = item.id;
            break;
          }
        }
        setSelectedTimelineItemKey(foundKey);
      }

    } else if (selectedTimelineImage === null) {
        // If originalIndex selection is cleared, clear unique key selection too
        setSelectedTimelineItemKey(null);
    }
  }, [selectedTimelineImage, storyData?.generatedImages, dynamicTimelineTracks]);

  const handleDeleteItemFromTimeline = React.useCallback((itemIdToDelete?: string) => {
    const keyToDelete = itemIdToDelete || selectedTimelineItemKey;
    if (!keyToDelete) {
      toast({ title: "No item selected", description: "Please select an item on the timeline to delete.", variant: "default", duration: 2000 });
      return;
    }

    setDynamicTimelineTracks(prevTracks => {
      const updatedTracks = prevTracks.map(track => ({
        ...track,
        items: track.items.filter(item => item.id !== keyToDelete),
      }));
      setTimelineModified(true); // Mark timeline as modified
      return updatedTracks;
    });

    toast({ title: "Item Deleted", description: `Item removed from the timeline.`, duration: 2000 });
    setSelectedTimelineItemKey(null);
    setSelectedTimelineImage(null); // Also clear the originalIndex based selection
    setSelectedPanel("All Media"); // Switch panel as Edit Image might no longer be relevant
  }, [selectedTimelineItemKey, toast, setSelectedTimelineItemKey, setSelectedTimelineImage, setSelectedPanel]);

  // Keyboard listener for delete
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.key === "Delete" || event.key === "Backspace") && selectedTimelineItemKey) {
        // Prevent deletion if an input field is focused
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || (activeElement as HTMLElement).isContentEditable)) {
          return;
        }
        event.preventDefault(); // Prevent browser back navigation on Backspace
        handleDeleteItemFromTimeline();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedTimelineItemKey, handleDeleteItemFromTimeline]);


  const handleGenerateChapterImages = async () => {
    if (!storyData || isGeneratingImages) return;

    setIsGeneratingImages(true);
    setSelectedPanel("Story");

    try {

      // const audioDuration = storyData?.narrationAudioDurationSeconds || 240; // Unused
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
            originalPromptWithReferences: promptText, // Store the original prompt with @references
            expandedPrompt: expandedPrompt, // Store the expanded prompt
          };
        },
      );

      const newImages: GeneratedImage[] = [];
      setCurrentImageProgress(0);
      setGenerationProgress(0);

      for (let i = 0; i < imagePrompts.length; i++) {
        const { originalPromptWithReferences, expandedPrompt } = imagePrompts[i];
        setCurrentImageProgress(i + 1);
        const progressPercentage = ((i + 1) / imagePrompts.length) * 100;
        setGenerationProgress(progressPercentage);

        const result = await generateImageFromPrompt(
          expandedPrompt, // This is the prompt to send to the AI
          user!.uid,
          storyData.id,
          storyData.imageProvider as 'picsart' | 'gemini' | 'imagen3' || "picsart",
          storyData.imageStyleId
          // chapterNumber is not a direct param of generateImageFromPrompt
          // It's metadata we add to the GeneratedImage object later
        );

        if (result.success && result.imageUrl) {
          newImages.push({
            sceneIndex: i, // Use the loop index as scene index
            requestPrompt: result.requestPrompt || expandedPrompt, // Store the prompt sent to API
            originalPrompt: originalPromptWithReferences, // Store original prompt with @references
            imageUrl: result.imageUrl,
            isChapterGenerated: true, // Mark as generated for this chapter
            chapterNumber: currentChapter, // Assign current chapter number
          });
        } else {
          toast({
            title: `Error Generating Image ${i + 1}`,
            description:
              result.error || "Failed to generate an image for this prompt.",
            variant: "destructive",
          });
          // Optionally, decide if you want to stop or continue on error
        }
      }

      setStoryData((prevData) => {
        if (!prevData) return null;
        // Filter out any placeholder/undefined images before adding new ones
        const existingValidImages = prevData.generatedImages?.filter(img => img && img.imageUrl) || [];
        return {
          ...prevData,
          generatedImages: [...existingValidImages, ...newImages],
        };
      });

      // Save the updated story data with new images
      if (storyData && user?.uid) {
        const storyToSave = {
          ...storyData,
          generatedImages: [...(storyData.generatedImages?.filter(img => img && img.imageUrl) || []), ...newImages],
        };
        await saveStory(storyToSave, user.uid);
      }


      // setChaptersGenerated((prev: number[]) => [...new Set([...prev, currentChapter])]); // Removed as chaptersGenerated state is unused
      toast({
        title: `Chapter ${currentChapter} Images Generated!`,
        description: `${newImages.length} images added to your story.`,
        className: "bg-green-500 text-white",
      });
    } catch (error) {
      console.error("Error generating chapter images:", error);
      toast({
        title: "Image Generation Failed",
        description: "An unexpected error occurred.",
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
      !storyData?.generatedImages?.[selectedTimelineImage] ||
      !editedPrompt
    ) {
      toast({
        title: "Cannot Generate",
        description:
          "No image selected or prompt is empty. Please select an image and ensure the prompt is filled.",
        variant: "destructive",
      });
      return;
    }

    setIsEditingImage(true);
    toast({
      title: "Generating New Image...",
      description: "Please wait while the new image is being created.",
    });

    try {
      // Expand the edited prompt (which might contain @references)
      const finalPromptToGenerate = parseEntityReferences(
        editedPrompt, // This is the user-edited prompt with @references
        storyData
      );

      const result = await generateImageFromPrompt(
        finalPromptToGenerate, // This is the prompt to send to the AI
        user!.uid,
        storyData.id,
        storyData.imageProvider as 'picsart' | 'gemini' | 'imagen3' || "picsart",
        storyData.imageStyleId
        // chapterNumber is not a direct param of generateImageFromPrompt
      );

      if (result.success && result.imageUrl) {
        const newImage: GeneratedImage = {
          sceneIndex: storyData.generatedImages[selectedTimelineImage].sceneIndex,
          requestPrompt: result.requestPrompt || finalPromptToGenerate, // Store the prompt sent to API
          originalPrompt: editedPrompt, // This is the prompt with @references
          imageUrl: result.imageUrl,
          isChapterGenerated: storyData.generatedImages[selectedTimelineImage].isChapterGenerated,
          chapterNumber: storyData.generatedImages[selectedTimelineImage].chapterNumber,
        };

        setStoryData((prevData) => {
          if (!prevData) return null;
          const updatedImages = [...(prevData.generatedImages || [])];
          updatedImages[selectedTimelineImage] = newImage;
          return { ...prevData, generatedImages: updatedImages };
        });

        // Save the updated story data
        if (storyData && user?.uid) {
            const storyToSave = {
                ...storyData,
                generatedImages: [...(storyData.generatedImages || [])]
            };
            storyToSave.generatedImages[selectedTimelineImage] = newImage;
            await saveStory(storyToSave, user.uid);
        }


        toast({
          title: "Image Updated!",
          description: "The selected image has been regenerated.",
          className: "bg-green-500 text-white",
        });
      } else {
        toast({
          title: "Error Regenerating Image",
          description: result.error || "Failed to regenerate the image.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error regenerating image:", error);
      toast({
        title: "Image Regeneration Failed",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsEditingImage(false);
    }
  };

  const handleRevertToHistory = async (historyIndex: number) => {
    if (
      selectedTimelineImage === null ||
      !storyData?.generatedImages?.[selectedTimelineImage]?.history ||
      !storyData.generatedImages[selectedTimelineImage].history![historyIndex]
    ) {
      toast({
        title: "Cannot Revert",
        description: "Selected image or history version not found.",
        variant: "destructive",
      });
      return;
    }

    const historyImage =
      storyData.generatedImages[selectedTimelineImage].history![historyIndex];

    toast({
      title: "Reverting Image...",
      description: "Updating image to selected history version.",
    });

    // Create the updated image object based on the history
    const revertedImage: GeneratedImage = {
      sceneIndex: storyData.generatedImages[selectedTimelineImage].sceneIndex,
      requestPrompt: historyImage.requestPrompt || historyImage.originalPrompt,
      imageUrl: historyImage.imageUrl,
      originalPrompt: historyImage.originalPrompt, // Use history's original prompt
      isChapterGenerated: storyData.generatedImages[selectedTimelineImage].isChapterGenerated,
      chapterNumber: storyData.generatedImages[selectedTimelineImage].chapterNumber,
      history: storyData.generatedImages[selectedTimelineImage].history,
    };

    setStoryData((prevData) => {
      if (!prevData) return null;
      const updatedImages = [...(prevData.generatedImages || [])];
      updatedImages[selectedTimelineImage] = revertedImage;
      return { ...prevData, generatedImages: updatedImages };
    });

    // Save the updated story data
    if (storyData && user?.uid) {
        const storyToSave = {
            ...storyData,
            generatedImages: [...(storyData.generatedImages || [])]
        };
        storyToSave.generatedImages[selectedTimelineImage] = revertedImage;
        await saveStory(storyToSave, user.uid);
    }


    toast({
      title: "Image Reverted!",
      description: "Image has been updated from history.",
      className: "bg-green-500 text-white",
    });
    // Update editedPrompt to reflect the reverted image's prompt
    setEditedPrompt(historyImage.originalPrompt || "");
  };


  // Helper to get the currently selected item's width from timelineTracks
  // const getSelectedItemWidth = (): number => { // Unused
  //   if (!selectedTimelineItemKey) return 100; // Default or some indicator of no selection
  //
  //   for (const track of dynamicTimelineTracks) {
  //     const item = track.items.find(i => i.id === selectedTimelineItemKey);
  //     if (item && item.ui?.width) {
  //       if (typeof item.ui.width === 'number') return item.ui.width;
  //       if (typeof item.ui.width === 'string' && item.ui.width.endsWith('%')) {
  //         return parseInt(item.ui.width.replace('%', ''), 10);
  //       }
  //     }
  //   }
  //   return 100; // Default if not found or not a percentage
  // };

  // Helper to get the currently selected item's margin from timelineTracks
  // const getSelectedItemMargin = (): number => { // Unused
  //   if (!selectedTimelineItemKey) return 0; // Default or some indicator of no selection
  //
  //   for (const track of dynamicTimelineTracks) {
  //     const item = track.items.find(i => i.id === selectedTimelineItemKey);
  //     if (item && item.ui?.marginLeft) {
  //       if (typeof item.ui.marginLeft === 'number') return item.ui.marginLeft;
  //       if (typeof item.ui.marginLeft === 'string' && item.ui.marginLeft.endsWith('%')) {
  //         return parseInt(item.ui.marginLeft.replace('%', ''), 10);
  //       }
  //     }
  //   }
  //   return 0; // Default if not found or not a percentage
  // };


  // const handleUpdateItemWidth = (itemId: string, width: number) => { // Unused
  //   setDynamicTimelineTracks(prevTracks => {
  //     const updatedTracks = prevTracks.map(track => ({
  //       ...track,
  //       items: track.items.map(item => {
  //         if (item.id === itemId) {
  //           return {
  //             ...item,
  //             ui: { ...item.ui, width: `${width}%` },
  //           };
  //         }
  //         return item;
  //       }),
  //     }));
  //     setTimelineModified(true); // Mark timeline as modified
  //     return updatedTracks;
  //   });
  // };


  // const handleUpdateItemMargin = (margin: number) => { // Unused
  //   if (!selectedTimelineItemKey) return;
  //
  //   setDynamicTimelineTracks((prevTracks: PageTimelineTrack[]) => {
  //     const updatedTracks = prevTracks.map((track: PageTimelineTrack) => ({
  //       ...track,
  //       items: track.items.map((item: PageTimelineMediaItem) => {
  //         if (item.id === selectedTimelineItemKey) {
  //           return {
  //             ...item,
  //             ui: { ...item.ui, marginLeft: `${margin}%` },
  //           };
  //         }
  //         return item;
  //       }),
  //     }));
  //     setTimelineModified(true); // Mark timeline as modified
  //     return updatedTracks;
  //   });
  // };

  // const saveStoryData = async (updatedStory: Story | null) => { // Unused
  //   if (updatedStory && user?.uid) {
  //     const result = await saveStory(updatedStory, user.uid);
// if (!result.success) {
// toast({
// title: "Error Saving Story",
// description: result.error || "Failed to save story updates.",
// variant: "destructive",
// });
// }
// }
// };


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
          // Initialize chaptersGenerated based on existing images
          const generatedChapters = new Set<number>();
          response.data.generatedImages?.forEach(img => {
            if (img && typeof img.chapterNumber === 'number') {
              generatedChapters.add(img.chapterNumber);
            }
          });
          // setChaptersGenerated(Array.from(generatedChapters)); // Removed as chaptersGenerated state is unused

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
  }, [storyId, user, authLoading, router, toast]);

  if (pageLoading || authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!storyData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Story not found or an error occurred.</p>
      </div>
    );
  }


  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const activeItemId = String(active.id); // e.g., "media-image-0" or "timeline-item-video-track-1-img-0-1627..."
      const overTrackId = String(over.id); // e.g., "video-track-1-droppable"

      // Find the source item details (from AllMediaContent or another track)
      let sourceItem: PageTimelineMediaItem | undefined;
      let sourceTrackId: string | undefined;

      if (activeItemId.startsWith("media-")) { // Item dragged from AllMediaContent
        const parts = activeItemId.split('-'); // "media", "image", "0"
        const type = parts[1] as 'image' | 'audio' | 'text'; // Assuming type is always present
        const originalIndex = parseInt(parts[2], 10);

        if (type === 'image' && storyData.generatedImages && storyData.generatedImages[originalIndex]) {
          const imgData = storyData.generatedImages[originalIndex];
          sourceItem = {
            id: `img-${originalIndex}-${Date.now()}-${Math.random().toString(36).substring(2,7)}`, // New unique ID for timeline
            type: 'image',
            originalIndex: originalIndex,
            sourceId: activeItemId,
            imageUrl: imgData.imageUrl,
            title: imgData.originalPrompt?.substring(0,30) + "...",
          };
        }
        // Add similar logic for 'audio' or 'text' if they can be dragged from AllMediaContent
      } else if (activeItemId.startsWith("timeline-item-")) { // Item dragged from another track
         const parts = activeItemId.split('-'); // "timeline", "item", "video", "track", "1", "img-0-..."
         sourceTrackId = `${parts[2]}-${parts[3]}-${parts[4]}`; // e.g. "video-track-1"
         const actualItemId = parts.slice(5).join('-'); // e.g. "img-0-..."

        for (const track of dynamicTimelineTracks) {
          if (track.id === sourceTrackId) {
            sourceItem = track.items.find((item: PageTimelineMediaItem) => item.id === actualItemId);
            break;
          }
        }
      }


      if (sourceItem) {
        setDynamicTimelineTracks((prevTracks: PageTimelineTrack[]) => {
          let newTracks = [...prevTracks];

          // Remove from source track if it was an internal move
          if (sourceTrackId) {
            newTracks = newTracks.map(track => {
              if (track.id === sourceTrackId) {
                return { ...track, items: track.items.filter((item: PageTimelineMediaItem) => item.id !== sourceItem!.id) };
              }
              return track;
            });
          }

          // Add to destination track
          const targetTrackIdClean = overTrackId.replace('-droppable', '');
          newTracks = newTracks.map(track => {
            if (track.id === targetTrackIdClean && track.accepts.includes(sourceItem!.type)) {
              // Check if item already exists (by sourceId if from AllMedia, or id if internal move)
              const itemExists = track.items.some((item: PageTimelineMediaItem) =>
                (sourceItem!.sourceId && item.sourceId === sourceItem!.sourceId) ||
                (!sourceItem!.sourceId && item.id === sourceItem!.id)
              );
              if (!itemExists) {
                return { ...track, items: [...track.items, sourceItem!] };
              } else {
                toast({ title: "Item Exists", description: "This item is already on the track.", variant: "default", duration: 2000});
              }
            }
            return track;
          });
          setTimelineModified(true); // Mark timeline as modified
          return newTracks;
        });
      }
    }
  };


  return (
    <DndContext onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
      <div className="flex h-[calc(100vh-var(--header-height,4rem))] bg-secondary text-foreground">
        {/* Column 1: Sidebar / Menu */}
        {isSidebarOpen && (
          <VideoPageSidebar
            storyId={storyId}
            sidebarNavItems={sidebarNavItems}
            selectedPanel={selectedPanel}
            setSelectedPanel={setSelectedPanel}
            isSidebarOpen={isSidebarOpen}
            setIsSidebarOpen={setIsSidebarOpen}
          />
        )}

        {/* Top Bar for columns 2 & 3 */}
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
              // onClick={handleExportVideo} // Placeholder for export functionality
              disabled // Disable until export is implemented
            >
              <Download className="w-4 h-4 mr-2" />
              Export Video
            </Button>
          </div>

          {/* Container for columns 2 & 3 */}
          <div className="flex-1 flex overflow-hidden">
            {/* Column 2: Panel Content */}
            <div className="w-2/5 p-4 overflow-y-auto border-r border-border bg-background">
              {selectedPanel === "Story" && storyData ? (
                <StoryContent
                  storyData={storyData}
                  isGeneratingImages={isGeneratingImages}
                  handleGenerateChapterImages={handleGenerateChapterImages}
                  currentChapter={currentChapter}
                  // chaptersGenerated={chaptersGenerated} // Prop removed from StoryContent
                  currentImageProgress={currentImageProgress}
                  generationProgress={generationProgress}
                  totalImagesToGenerate={totalImagesToGenerate}
                />
              ) : selectedPanel === "Edit Image" ? (
                <EditTimelineItemPanelContent
                  storyData={storyData}
                  selectedTimelineImage={selectedTimelineImage}
                  editedPrompt={editedPrompt}
                  setEditedPrompt={setEditedPrompt}
                  isEditingImage={isEditingImage}
                  handleEditGenerate={handleEditGenerate}
                  handleRevertToHistory={handleRevertToHistory}
                  // selectedTimelineItemKey is not a prop of EditTimelineItemPanelContent
                  // dynamicTimelineTracks is not a prop of EditTimelineItemPanelContent
                  // The component uses selectedTimelineImage (index) to fetch image data
                  // Width/Margin handlers are optional and seem to be for a different context or need adjustment
                  // For now, let's pass what's defined.
                  // selectedItemWidth and selectedItemMargin are also props of the component,
                  // but they are not being explicitly passed from the parent here.
                  // The component has defaults for them.
                  // If they need to be controlled from here, state variables would be needed.
                  // handleUpdateItemWidth={(width: number) => handleUpdateItemWidth(selectedTimelineItemKey!, width)} // Assuming selectedTimelineItemKey is valid when this is called
                  // handleUpdateItemMargin={handleUpdateItemMargin} // This already uses selectedTimelineItemKey internally
                />
              ) : selectedPanel === "Voices" && storyData ? (
                <VoicesContent storyData={storyData} />
              ) : selectedPanel === "All Media" && storyData ? (
                <AllMediaContent
                  storyData={storyData}
                  // onSelectItem and onDeleteItem are not props of AllMediaContent
                  // This component is for displaying draggable media.
                  // Selection/deletion is handled by TimelineStrip or other interactions.
                />
              ) : selectedPanel === "Settings" ? (
                <div className="p-4">
                  <h3 className="text-lg font-semibold">Settings</h3>
                  <p className="text-muted-foreground">
                    Video settings and preferences will go here.
                  </p>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  Select an option from the sidebar.
                </div>
              )}
            </div>

            {/* Column 3: Video Preview & Timeline (always visible) */}
            <div className="w-3/5 flex flex-col p-4 gap-4 overflow-hidden">
              <div className="h-full w-full flex flex-col items-center"> {/* New Inner Wrapper for layout */}
                <VideoPreviewArea
                  storyData={storyData}
                  selectedTimelineImage={selectedTimelineImage}
                  // selectedTimelineItemKey is not a prop of VideoPreviewArea
                  // dynamicTimelineTracks is not a prop of VideoPreviewArea
                  // The component uses selectedTimelineImage (index)
                />
                {/* <VideoControls /> */} {/* Temporarily removed */}
                <TimelineStrip
                  timelineTracks={dynamicTimelineTracks}
                  storyData={storyData}
                  // onSelectItem is not a direct prop. Selection is handled by TrackLane calling:
                  selectedTimelineImage={selectedTimelineImage}
                  setSelectedTimelineImage={setSelectedTimelineImage}
                  selectedTimelineItemKey={selectedTimelineItemKey}
                  setSelectedTimelineItemKey={setSelectedTimelineItemKey}
                  setSelectedPanel={setSelectedPanel} // Pass to allow TrackLane to open Edit panel
                  handleDeleteItemFromTimeline={handleDeleteItemFromTimeline}
                  // setTracks and setTimelineModified are not props of TimelineStrip.
                  // Reordering is handled by DndContext in page.tsx.
                  // TimelineStrip needs other props for its internal logic and for TrackLane:
                  isGeneratingImages={isGeneratingImages}
                  handleGenerateChapterImages={handleGenerateChapterImages}
                  currentChapter={currentChapter}
                  // handleUpdateItemWidth can be passed if TrackLane needs it directly
                  // For now, assuming TrackLane's existing props are sufficient or it calls parent functions
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </DndContext>
  );
}
