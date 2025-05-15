"use client";

import type { Story } from "@/types/story";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
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
  History,
  Plus,
  SidebarClose,
  SidebarOpen,
  Trash2,
  Copy,
  Scissors,
  Volume2,
  Upload,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";

const sidebarNavItems = [
  { name: "All Media", icon: Wand2 },
  { name: "Edit", icon: Edit3 },
  { name: "Characters", icon: User },
  { name: "Story", icon: Text },
  { name: "Music", icon: Music },
  { name: "Settings", icon: Settings },
  { name: "Voices", icon: Video, sectionBreak: true },
];

// Story Content component
function StoryContent({ storyData }: { storyData: Story }) {
  const [fontSize, setFontSize] = useState<'sm'|'base'|'lg'|'xl'>('base');
  const [viewMode, setViewMode] = useState<'read'|'edit'>('read');
  const [editedScript, setEditedScript] = useState<string>('');
  const [paragraphStyle, setParagraphStyle] = useState<'indented'|'block'|'justified'>('indented');
  const [showTooltips, setShowTooltips] = useState(true);
  const { toast } = useToast();
  
  // Function to automatically format the story text with proper paragraph breaks
  const formatStoryText = (text: string): string => {
    if (!text) return '';
    
    // Normalize line endings
    let formattedText = text.replace(/\r\n/g, '\n');
    
    // Replace multiple blank lines with exactly two newlines
    formattedText = formattedText.replace(/\n{3,}/g, '\n\n');
    
    // Ensure paragraph breaks have double newlines
    formattedText = formattedText
      .split(/\n\s*\n/)
      .map(para => para.trim())
      .join('\n\n');
    
    // Ensure the formatted text doesn't have leading/trailing whitespace
    return formattedText.trim();
  };
  
  // Get CSS classes for the selected paragraph style
  const getParagraphStyleClass = (isFirstLine: boolean = false) => {
    switch (paragraphStyle) {
      case 'indented': 
        return isFirstLine ? 'text-indent-4' : '';
      case 'block':
        return 'mb-4';
      case 'justified':
        return 'text-justify mb-4';
      default:
        return isFirstLine ? 'text-indent-4' : '';
    }
  };
  
  // Add custom CSS for text formatting
  useEffect(() => {
    // Add custom CSS for text formatting if not already present
    if (!document.getElementById('story-formatting-css')) {
      const style = document.createElement('style');
      style.id = 'story-formatting-css';
      style.textContent = `
        .text-indent-4 {
          text-indent: 1.5rem;
        }
        .text-justify {
          text-align: justify;
        }
      `;
      document.head.appendChild(style);
    }
    
    // Show tooltips initially and hide after 8 seconds
    const timer = setTimeout(() => {
      setShowTooltips(false);
    }, 8000);
    
    return () => {
      clearTimeout(timer);
      // Clean up on component unmount
      const style = document.getElementById('story-formatting-css');
      if (style) {
        document.head.removeChild(style);
      }
    };
  }, []);
  
  useEffect(() => {
    if (storyData.generatedScript) {
      // Format the script when it's first loaded
      const formattedScript = formatStoryText(storyData.generatedScript);
      setEditedScript(formattedScript);
    }
  }, [storyData.generatedScript]);
  
  const handleSaveScript = async () => {
    if (!editedScript.trim()) {
      toast({
        title: "Cannot Save Empty Script",
        description: "Please add some content to your story.",
        variant: "destructive",
      });
      return;
    }
    
    // Format the script before saving
    const formattedScript = formatStoryText(editedScript);
    
    // Create a copy of storyData with the updated script
    const updatedStory = {
      ...storyData,
      generatedScript: formattedScript
    };
    
    // Update the displayed text with the formatted version
    setEditedScript(formattedScript);
    
    toast({ 
      title: "Saving Script...",
      description: "Updating your story in the database" 
    });
    
    try {
      const result = await saveStory(updatedStory, storyData.userId);
      if (result.success) {
        toast({
          title: "Script Saved",
          description: "Your story has been updated successfully.",
          className: "bg-green-500 text-white",
        });
        setViewMode('read');
      } else {
        toast({
          title: "Error Saving Script",
          description: result.error || "Failed to save your story.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error saving script:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while saving.",
        variant: "destructive",
      });
    }
  };

  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'sm': return 'text-sm';
      case 'lg': return 'text-lg';
      case 'xl': return 'text-xl';
      default: return 'text-base';
    }
  };
  
  return (
    <div className="h-full">
      <div className="rounded-lg border border-border shadow-sm h-full flex flex-col">
        <div className="p-3 border-b border-border bg-muted/20 flex justify-between items-center">
          <div>
            <h2 className="font-semibold">Story Content</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {viewMode === 'read' ? 'Read your story script' : 'Edit your story script'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Type className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setFontSize('sm')}>
                  Small Text
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFontSize('base')}>
                  Normal Text
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFontSize('lg')}>
                  Large Text
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFontSize('xl')}>
                  Extra Large Text
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <TooltipProvider>
              <Tooltip open={showTooltips}>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <AlignJustify className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Choose paragraph formatting style</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <AlignJustify className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setParagraphStyle('indented')}>
                  <span className={paragraphStyle === 'indented' ? 'font-bold' : ''}>Indented Paragraphs</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setParagraphStyle('block')}>
                  <span className={paragraphStyle === 'block' ? 'font-bold' : ''}>Block Paragraphs</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setParagraphStyle('justified')}>
                  <span className={paragraphStyle === 'justified' ? 'font-bold' : ''}>Justified Text</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {viewMode === 'edit' && (
              <TooltipProvider>
                <Tooltip open={showTooltips}>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditedScript(formatStoryText(editedScript))}
                    >
                      <AlignCenter className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Auto-format text with proper paragraph breaks and spacing</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {viewMode === 'read' ? (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setViewMode('edit')}
                title="Edit Story"
              >
                <Edit3 className="h-4 w-4" />
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => {
                    setEditedScript(storyData.generatedScript || '');
                    setViewMode('read');
                  }}
                  title="Cancel Editing"
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={handleSaveScript}
                  title="Save Changes"
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
        
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2 flex items-center">
                <BookOpen className="mr-2 h-5 w-5 text-primary" />
                {storyData.title}
              </h3>
              
              {viewMode === 'read' ? (
                <div className={`whitespace-pre-line rounded-md border border-border bg-card p-4 ${getFontSizeClass()} ${paragraphStyle === 'justified' ? 'text-justify' : ''}`}>
                  {storyData.generatedScript ? (
                    <div className="prose prose-stone dark:prose-invert max-w-none">
                      {formatStoryText(storyData.generatedScript)
                        .split('\n\n')
                        .map((paragraph, paraIndex) => (
                          <div key={paraIndex} className="mb-6">
                            {paragraph.split('\n').map((line, lineIndex) => (
                              <p 
                                key={`${paraIndex}-${lineIndex}`} 
                                className={`${lineIndex === 0 ? getParagraphStyleClass(true) : getParagraphStyleClass()} ${line.trim() === '' ? 'h-2' : ''}`}
                              >
                                {line.trim() === '' ? '\u00A0' : line}
                              </p>
                            ))}
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic">No script content available</p>
                  )}
                </div>
              ) : (
                <div className="rounded-md border border-border bg-card p-2">
                  <Textarea 
                    value={editedScript} 
                    onChange={(e) => setEditedScript(e.target.value)}
                    className={`min-h-[400px] ${getFontSizeClass()} whitespace-pre-line p-2`}
                    placeholder="Start writing your story script here..."
                  />
                </div>
              )}
              
              {viewMode === 'read' && storyData.generatedScript && (
                <div className="mt-4 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setViewMode('edit')}
                  >
                    <Edit3 className="mr-1 h-3 w-3" />
                    Edit Script
                  </Button>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

// Voice Settings content component
function VoicesContent({ storyData }: { storyData: Story }) {
  const voiceInfo = useMemo(() => {
    const voiceName = storyData.narrationVoice || "Narrator";
    const voiceId =
      storyData.narrationVoiceId ||
      (storyData as any).elevenLabsVoiceId ||
      "Unknown";
    const duration = (storyData as any).narrationAudioDurationSeconds
      ? `${Math.floor((storyData as any).narrationAudioDurationSeconds / 60)}:${((storyData as any).narrationAudioDurationSeconds % 60).toString().padStart(2, "0")}`
      : "0:00";
    const hasAudio = !!(storyData as any).narrationAudioUrl;

    return { voiceName, voiceId, duration, hasAudio };
  }, [storyData]);

  return (
    <div className="h-full">
      <div className="rounded-lg border border-border shadow-sm h-full">
        <div className="p-3 border-b border-border bg-muted/20">
          <h2 className="font-semibold">Voice Settings</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage voice settings for your story narration
          </p>
        </div>

        <div className="p-4">
          <h3 className="text-sm font-medium mb-3">Narrator Voice</h3>

          <div className="space-y-4">
            <div className="bg-muted/20 p-4 rounded-md border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Narrator</h4>
                  <p className="text-xs text-muted-foreground">
                    Voice used for story narration
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">Default Voice</p>
                  <p className="text-xs text-muted-foreground">
                    No voice selection
                  </p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-border flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <div className="text-xs text-muted-foreground">
                  Audio Duration: {voiceInfo.duration}
                </div>

                {voiceInfo.hasAudio ? (
                  <div className="flex items-center gap-2">
                    <audio
                      controls
                      src={(storyData as any).narrationAudioUrl}
                      className="h-7 w-full sm:w-48"
                    >
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground italic">
                    No audio available
                  </div>
                )}
              </div>
            </div>

            <div className="bg-muted/20 p-3 rounded-md border border-border border-dashed">
              <div className="text-center py-3">
                <p className="text-muted-foreground text-sm">
                  Character voices coming soon
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  You'll be able to assign different voices to each character
                </p>
                <Button variant="outline" size="sm" className="mt-3" disabled>
                  <User className="h-4 w-4 mr-2" />
                  Add Character Voice
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Interface and Function copied from StoryTailor/src/app/(app)/create-story/page.tsx
interface ParsedPrompt {
  name?: string;
  description: string;
  originalIndex: number;
}

const parseNamedPrompts = (
  rawPrompts: string | undefined,
  type: "Character" | "Item" | "Location",
): ParsedPrompt[] => {
  if (!rawPrompts) return [];
  
  // Normalize escaped newlines to actual newlines
  let normalizedPrompts = rawPrompts.replace(/\\n/g, "\n");

  const cleanPrompts = normalizedPrompts
    .replace(/^(Character Prompts:|Item Prompts:|Location Prompts:)\s*\n*/i, "")
    .trim();

  if (!cleanPrompts) return [];

  return cleanPrompts
    .split(/\n\s*\n/)
    .map((block, index) => {
      const lines = block
        .trim()
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l);
      if (lines.length === 0) {
        return null;
      }

      let name: string | undefined = undefined;
      let description: string;

      if (lines.length > 1) {
        const firstLineIsLikelyName =
          lines[0].length < 60 &&
          !/[\.?!]$/.test(lines[0]) &&
          lines.slice(1).join(" ").length > 0;

        if (firstLineIsLikelyName) {
          name = lines[0];
          description = lines.slice(1).join("\n");
        } else {
          description = lines.join("\n");
        }
      } else {
        description = lines[0];
      }

      if (!description && name) {
        description = name;
        name = undefined;
      }

      if (!description) return null;

      return { name, description, originalIndex: index };
    })
    .filter((p) => p !== null) as ParsedPrompt[];
};
// End of copied code

// Component for "All Media" Panel
function AllMediaContent({ storyData }: { storyData: Story }) {
  const images = storyData.generatedImages || [];
  const narrationAudioUrl =
    (storyData as any).narrationAudioUrl ||
    (storyData as any).detailsPrompts?.narrationAudioUrl;

  return (
    <div className="h-full">
      <div className="rounded-lg border border-border shadow-sm h-full flex flex-col">
        <div className="p-3 border-b border-border bg-muted/20">
          <h2 className="font-semibold">All Media</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Browse all generated images and audio for your story.
          </p>
        </div>

        <ScrollArea className="flex-1 p-4 space-y-6">
          <div>
            <h3 className="text-md font-semibold mb-2">Generated Images</h3>
            {images.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {images.map((img, index) => (
                  <div
                    key={
                      (img as any).id ||
                      (img as any).imageId ||
                      `all-media-img-${index}`
                    }
                    className="aspect-video rounded-md overflow-hidden border border-input shadow-sm hover:shadow-lg transition-shadow relative bg-muted/20 flex items-center justify-center"
                  >
                    {img?.imageUrl ? (
                      <Image
                        src={img.imageUrl}
                        alt={
                          img.originalPrompt?.substring(0, 40) ||
                          `Image ${index + 1}`
                        }
                        layout="fill"
                        objectFit="contain"
                        className="rounded-sm"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-10 h-10 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No images have been generated yet.
              </p>
            )}
          </div>

          <div>
            <h3 className="text-md font-semibold mb-2">Main Narration Audio</h3>
            {narrationAudioUrl ? (
              <div>
                <audio controls src={narrationAudioUrl} className="w-full h-10">
                  Your browser does not support the audio element.
                </audio>
                {(storyData as any).narrationAudioDurationSeconds && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Duration:{" "}
                    {Math.floor(
                      (storyData as any).narrationAudioDurationSeconds / 60,
                    )}
                    :
                    {((storyData as any).narrationAudioDurationSeconds % 60)
                      .toString()
                      .padStart(2, "0")}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No main narration audio available.
              </p>
            )}
          </div>

          <div>
            <h3 className="text-md font-semibold mb-2">
              Sound Effects & Other Audio Clips
            </h3>
            <div className="p-6 border border-dashed rounded-md bg-muted/20 text-center">
              <Music className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Display for individual sound effects (e.g., "glow", "steps on
                path") will be implemented here once the data structure is
                available.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                (This requires a dedicated field in the Story object, like
                `storyData.soundEffects` an array of audio clips with
                names/URLs)
              </p>
            </div>
          </div>
          <ScrollBar orientation="vertical" />
        </ScrollArea>
      </div>
    </div>
  );
}

type PanelView = "list" | "form";
type EntityType = "Character" | "Location" | "Item";

// Define props type for CharactersPanelContent
interface CharactersPanelContentProps {
  storyData: Story;
  onCharacterCreated: (characterData: {
    name: string;
    description: string; // This is the original prompt used for image generation
    imageUrl: string;
    requestPrompt?: string; // The prompt that was actually sent to the image generation API
    type: EntityType;
  }) => Promise<void> | void; // Can be async
}

interface DisplayableEntity {
  id: string;
  name: string;
  prompt: string;
  imageUrl?: string;
  type: EntityType;
}

function CharactersPanelContent({
  storyData,
  onCharacterCreated,
}: CharactersPanelContentProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [panelView, setPanelView] = useState<PanelView>("list");
  const [formEntityType, setFormEntityType] = useState<EntityType | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const MAX_DESC_LENGTH = 200;
  const [isSaving, setIsSaving] = useState(false);
  const [locallyAddedEntities, setLocallyAddedEntities] = useState<
    DisplayableEntity[]
  >([]);

  const baseDisplayableEntities = useMemo(() => {
    if (!storyData.generatedImages?.length) {
      return [];
    }
    const parsedCharacterDetails = parseNamedPrompts(
      (storyData as any).detailsPrompts?.characterPrompts,
      "Character",
    );
    console.log(
      "Parsed Character Details from characterPrompts string:",
      JSON.stringify(parsedCharacterDetails, null, 2),
    );

    return storyData.generatedImages.map((img, index) => {
      let characterName = `Character ${index + 1}`;
      let matchReason = "No match found or img.originalPrompt missing.";

      //console.log(`\nProcessing Image Index ${index}:`, JSON.stringify(img, null, 2));

      const matchedCharacter = parsedCharacterDetails.find((charDetail) => {
        const imgPromptTrimmed = img.originalPrompt?.trim();
        const charDescTrimmed = charDetail.description.trim();
        const isIncluded =
          imgPromptTrimmed && charDescTrimmed.includes(imgPromptTrimmed);

        // if (imgPromptTrimmed) {
        //   console.log(`  Comparing img.originalPrompt: "${imgPromptTrimmed}" with charDetail.name: "${charDetail.name}", charDetail.description: "${charDescTrimmed.substring(0,100)}..." -> included: ${isIncluded}`);
        // }

        return isIncluded;
      });

      if (matchedCharacter) {
        characterName = matchedCharacter.name || `Character ${index + 1}`;
        matchReason = `Matched with '${matchedCharacter.name}' because its description included image's originalPrompt.`;
      } else if (img.originalPrompt) {
        matchReason = `No character description from parsed prompts included this image's originalPrompt: "${img.originalPrompt.trim().substring(0, 100)}..."`;
      }

      // console.log(`  ==> Final Name for Image Index ${index} (URL: ${img.imageUrl?.substring(img.imageUrl.length - 20)}): ${characterName}. Reason: ${matchReason}`);

      return {
        id: (img as any).id || (img as any).imageId || `gen_img_${index}`,
        name: characterName,
        prompt: img.originalPrompt || "No prompt available.",
        imageUrl: img.imageUrl,
        type: "Character" as EntityType,
      };
    });
  }, [
    (storyData as any).detailsPrompts?.characterPrompts,
    storyData.generatedImages,
  ]);

  const allDisplayableEntities = useMemo(() => {
    return [...locallyAddedEntities, ...baseDisplayableEntities];
  }, [locallyAddedEntities, baseDisplayableEntities]);

  const filteredEntities = useMemo(() => {
    return allDisplayableEntities.filter((entity) => {
      if (!searchTerm.trim()) return true;
      const lowerSearchTerm = searchTerm.toLowerCase();
      return (
        entity.name.toLowerCase().includes(lowerSearchTerm) ||
        entity.prompt.toLowerCase().includes(lowerSearchTerm)
      );
    });
  }, [allDisplayableEntities, searchTerm]);

  const handleNewEntity = (type: EntityType) => {
    setFormEntityType(type);
    setFormName("");
    setFormDescription("");
    setPanelView("form");
  };

  const handleBackToList = () => {
    setPanelView("list");
    setFormEntityType(null);
  };

  const handleSaveEntity = async () => {
    if (!formEntityType || !formName.trim() || !formDescription.trim()) {
      toast({
        title: "Missing Information",
        description: `Please provide a name and description for the new ${formEntityType?.toLowerCase()}.`,
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    toast({
      title: `Generating image for ${formEntityType}...`,
      description: "Please wait.",
    });
    try {
      const imageResult = await generateImageFromPrompt(formDescription);

      if (!imageResult.success || !imageResult.imageUrl) {
        toast({
          title: `Image Generation Failed for ${formEntityType}`,
          description: imageResult.error || "Could not generate image.",
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }

      const newCharacterData = {
        name: formName,
        description: formDescription, // This is the original prompt
        imageUrl: imageResult.imageUrl,
        requestPrompt: imageResult.requestPrompt || formDescription, // Fallback if not provided
        type: formEntityType,
      };

      onCharacterCreated(newCharacterData); // Call parent to update storyData

      toast({
        title: `${formEntityType} Created!`,
        description: `${formName} has been created with a generated image.`,
        className: "bg-green-500 text-white",
      });

      handleBackToList();
    } catch (error) {
      console.error(`Error saving ${formEntityType}:`, error);
      toast({
        title: `Error Saving ${formEntityType}`,
        description: "An unexpected error occurred during the save process.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (panelView === "form" && formEntityType) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b border-border bg-muted/20 flex items-center justify-between">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBackToList}
              className="mr-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h2 className="font-semibold">New {formEntityType}</h2>
            <span className="ml-2 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
              {formEntityType}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => console.log("Delete action placeholder")}
          >
            <Trash2 className="w-5 h-5 text-destructive/70 hover:text-destructive" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <Label htmlFor="entityName" className="text-sm font-medium">
              {formEntityType} Name
            </Label>
            <Input
              id="entityName"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder={`Enter ${formEntityType.toLowerCase()} name`}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="entityDescription" className="text-sm font-medium">
              {formEntityType} Description
            </Label>
            <Textarea
              id="entityDescription"
              value={formDescription}
              onChange={(e) => {
                if (e.target.value.length <= MAX_DESC_LENGTH) {
                  setFormDescription(e.target.value);
                }
              }}
              placeholder={`Enter ${formEntityType.toLowerCase()} description...`}
              rows={6}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">
              {formDescription.length}/{MAX_DESC_LENGTH}
            </p>
          </div>
          <div className="flex justify-between items-center pt-2">
            <Button
              variant="outline"
              onClick={() => console.log("Upload action placeholder")}
              disabled={isSaving}
            >
              <Upload className="w-4 h-4 mr-2" /> Upload Image (UI Only)
            </Button>
            <Button
              onClick={handleSaveEntity}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {isSaving
                ? `Saving ${formEntityType}...`
                : `Save ${formEntityType}`}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-border bg-muted/20">
        <h2 className="font-semibold">Characters</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Manage and view character details.
        </p>
      </div>

      <div className="p-4 flex items-center gap-3 border-b border-border">
        <Input
          type="search"
          placeholder="Search characters..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="h-9 flex-grow"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="default"
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground h-9"
            >
              <Plus className="w-4 h-4 mr-2" />
              New
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleNewEntity("Character")}>
              Character
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNewEntity("Location")}>
              Location
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNewEntity("Item")}>
              Item
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredEntities.length > 0 ? (
          <ScrollArea className="h-full">
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredEntities.map((entity) => (
                <div
                  key={entity.id}
                  className="flex items-start gap-3 p-3 border border-border rounded-md bg-background hover:shadow-sm transition-shadow"
                >
                  <div className="w-32 h-24 bg-muted/50 rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {entity.imageUrl ? (
                      <Image
                        src={entity.imageUrl}
                        alt={entity.name}
                        layout="intrinsic"
                        width={128}
                        height={96}
                        objectFit="contain"
                        className="rounded"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center text-center text-xs text-muted-foreground p-1">
                        <ImageIcon className="w-8 h-8 mr-1 text-muted-foreground/50" />
                        Image not available
                      </div>
                    )}
                  </div>
                  <div className="flex-grow">
                    <h4 className="font-semibold text-sm">{entity.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-words">
                      {entity.prompt}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center">
            <p className="text-muted-foreground">
              {searchTerm
                ? "No items match your search."
                : "No items available to display."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
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
  const [selectedPanel, setSelectedPanel] = useState("All Media"); // Default to All Media panel

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
            typeof storyDataAfterOptimisticUpdate === 'object' &&
            'id' in storyDataAfterOptimisticUpdate &&
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
      <div className="w-52 bg-background border-r border-border flex flex-col">
        <div className="p-3 border-b border-border flex justify-between items-center">
          <Link
            href={`/create-story?storyId=${storyId}`}
            className="flex items-center text-sm text-primary hover:underline"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Story Editor
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden"
          >
            <SidebarClose className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex flex-col h-full">
          <div className="p-2">
            {sidebarNavItems.map((item, index) => (
              <React.Fragment key={index}>
                {item.sectionBreak && <hr className="my-2 border-border" />}
                <Button
                  variant="ghost"
                  className={`w-full justify-start ${selectedPanel === item.name ? "bg-accent/20 text-foreground" : "text-muted-foreground"} hover:text-foreground hover:bg-accent/10`}
                  onClick={() => setSelectedPanel(item.name)}
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.name}
                </Button>
              </React.Fragment>
            ))}
          </div>

          <div className="mt-auto p-2">
            <Card>
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-sm">History</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground p-3 max-h-32 overflow-y-auto space-y-2">
                <p>
                  Previous versions of images will appear here. (Placeholder)
                </p>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-1 my-1 border rounded bg-muted/50">
                    History item {i}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

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
            ) : selectedPanel === "Voices" ? (
              <VoicesContent storyData={storyData} />
            ) : selectedPanel === "Characters" ? (
              <CharactersPanelContent
                storyData={storyData}
                onCharacterCreated={handleNewCharacterCreated}
              />
            ) : selectedPanel === "Story" ? (
              <StoryContent storyData={storyData} />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Select an option from the sidebar to view settings.
              </div>
            )}
          </div>

          <div className="w-3/5 flex flex-col p-4 gap-4 overflow-hidden">
            <div className="flex-1 bg-muted rounded-lg flex items-center justify-center shadow-inner">
              {storyData.generatedImages &&
              storyData.generatedImages.length > 0 &&
              storyData.generatedImages[0] ? (
                <Image
                  src={storyData.generatedImages[0].imageUrl}
                  alt="Video Preview Placeholder"
                  width={800}
                  height={450}
                  className="max-w-full max-h-full object-contain rounded-md"
                />
              ) : (
                <Video className="w-24 h-24 text-muted-foreground/50" />
              )}
            </div>

            <div className="bg-background p-2 rounded-md shadow-sm border border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" disabled>
                  <Play className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" disabled>
                  <Pause className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" disabled>
                  <Scissors className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" disabled>
                  <Trash2 className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" disabled>
                  <Copy className="w-5 h-5" />
                </Button>
              </div>
              <span className="text-sm text-muted-foreground">
                0:00 /{" "}
                {(storyData as any).narrationAudioDurationSeconds
                  ? ((storyData as any).narrationAudioDurationSeconds / 60)
                      .toFixed(2)
                      .replace(".", ":")
                  : "0:00"}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" disabled>
                  <History className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" disabled>
                  <ZoomOut className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" disabled>
                  <ZoomIn className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" disabled>
                  <Maximize className="w-5 h-5" />
                </Button>
              </div>
            </div>

            <ScrollArea className="h-32 bg-background p-2 rounded-md shadow-sm border border-border">
              <div className="flex space-x-2 pb-2">
                {storyData.generatedImages?.map((img, index) => (
                  <div
                    key={index}
                    className="flex-shrink-0 w-32 h-28 rounded-md overflow-hidden border-2 border-transparent hover:border-primary cursor-pointer shadow"
                  >
                    {img ? (
                      <Image
                        src={img.imageUrl}
                        alt={`Scene ${index + 1}`}
                        width={112}
                        height={112}
                        objectFit="cover"
                        className="w-full h-full"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>
                ))}
                {(!storyData.generatedImages ||
                  storyData.generatedImages.length === 0) && (
                  <div className="text-muted-foreground text-sm p-4">
                    No images to display in timeline.
                  </div>
                )}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
}
