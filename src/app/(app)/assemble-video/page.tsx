
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
  updateStoryTimeline,
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
  const [dynamicTimelineTracks, setDynamicTimelineTracks] = useState<PageTimelineTrack[]>([]);
  const [selectedTimelineItemKey, setSelectedTimelineItemKey] = useState<string | null>(null); // For unique ID based selection
  const [timelineModified, setTimelineModified] = useState(false); // Track if timeline was modified by user

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
            items = imagesToShow.map((img, filteredIndex) => {
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
            items = imagesToShow.map((img, filteredIndex) => {
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
        if ((iconComponent as any).displayName && typeof (iconComponent as any).displayName === 'string') {
          return (iconComponent as any).displayName;
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

  const handleDeleteItemFromTimeline = (itemIdToDelete?: string) => {
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
  };

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const draggedItemSourceData = active.data.current as { type: 'image' | 'audio'; url: string; originalIndex?: number; prompt?: string; } | undefined;
      const targetTrackId = over.id.toString(); // Ensure it's a string
      const targetTrack = dynamicTimelineTracks.find(t => t.id === targetTrackId);

      if (!draggedItemSourceData || !targetTrack) {
        console.warn("DragEnd: Missing dragged item data or target track not found.", { draggedItemSourceData, targetTrackId, dynamicTimelineTracks });
        return;
      }
      
      const itemType = draggedItemSourceData.type;

      if (!targetTrack.accepts.includes(itemType)) {
        toast({
          title: "Cannot Drop Here",
          description: `The '${targetTrack.name}' track does not accept '${itemType}' items.`,
          variant: "destructive",
          duration: 3000,
        });
        return;
      }

      const newTimelineItem: PageTimelineMediaItem = {
        id: `${itemType}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, // More robust unique ID
        type: itemType,
        sourceId: active.id.toString(),
        imageUrl: itemType === 'image' ? draggedItemSourceData.url : undefined,
        // audioUrl: itemType === 'audio' ? draggedItemSourceData.url : undefined, // If we add audio items
        title: draggedItemSourceData.prompt ? (draggedItemSourceData.prompt.substring(0, 30) + "...") : `New ${itemType}`,
        originalIndex: draggedItemSourceData.originalIndex,
        // Default duration/startTime can be set here, e.g., based on item type or a default value
        duration: itemType === 'image' ? 5 : 10, // Example: 5s for images, 10s for audio
        startTime: 0, // Placeholder, actual positioning logic will be more complex
      };

      setDynamicTimelineTracks(prevTracks => {
        setTimelineModified(true); // Mark timeline as modified when items are added
        return prevTracks.map(track => {
          if (track.id === targetTrackId) {
            // Add to the end for now. Later, we'll need to insert at a specific position.
            return { ...track, items: [...track.items, newTimelineItem] };
          }
          return track;
        });
      });

      toast({
        title: "Item Added to Timeline!",
        description: `${newTimelineItem.title} added to ${targetTrack.name}.`,
        duration: 3000,
      });
      console.log("Added to timeline:", newTimelineItem, "Target track:", targetTrackId);
    }
  };

  return (
    <DndContext onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
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

            <div className="w-3/5 flex flex-col p-4 overflow-hidden">
              <VideoPreviewArea storyData={storyData} selectedTimelineImage={selectedTimelineImage} className="flex-[3] min-h-0" />
              <TimelineStrip
                // storyData is still needed for some parts like narration URL, script, etc.
                // but the tracks themselves will come from dynamicTimelineTracks
                storyData={storyData}
                timelineTracks={dynamicTimelineTracks}
                selectedTimelineImage={selectedTimelineImage}
                setSelectedTimelineImage={setSelectedTimelineImage}
                selectedTimelineItemKey={selectedTimelineItemKey}
                setSelectedTimelineItemKey={setSelectedTimelineItemKey}
                handleDeleteItemFromTimeline={handleDeleteItemFromTimeline}
                setSelectedPanel={setSelectedPanel}
                isGeneratingImages={isGeneratingImages}
                handleGenerateChapterImages={handleGenerateChapterImages}
                currentChapter={currentChapter}
                className="flex-[2] min-h-0"
              />
            </div>
          </div>
        </div>
      </div>
    </DndContext>
  );
}

    