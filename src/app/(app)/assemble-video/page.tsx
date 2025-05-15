"use client";

import type { Story } from "@/types/story";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  { name: "Edit", icon: Edit3 },
  { name: "Characters", icon: User },
  { name: "Story", icon: Text },
  { name: "Music", icon: Music },
  { name: "Settings", icon: Settings },
  { name: "Voices", icon: Video, sectionBreak: true },
];

// Story Content component
function StoryContent({ 
  storyData, 
  isGeneratingImages, 
  handleGenerateChapterImages, 
  currentChapter, 
  chaptersGenerated,
  currentImageProgress,
  generationProgress,
  totalImagesToGenerate
}: { 
  storyData: Story, 
  isGeneratingImages: boolean, 
  handleGenerateChapterImages: () => Promise<void>, 
  currentChapter: number, 
  chaptersGenerated: number[],
  currentImageProgress: number,
  generationProgress: number,
  totalImagesToGenerate: number
}) {
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
    if (!editedScript?.trim()) {
      toast({
        title: "Cannot Save Empty Script",
        description: "Please add some content to your story.",
        variant: "destructive",
      });
      return;
    }
    
    // Format the script before saving
  const formattedScript = formatStoryText(editedScript || "");
    
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
                  {storyData?.generatedScript ? (
                    <div className="prose prose-stone dark:prose-invert max-w-none">
                      {formatStoryText(storyData.generatedScript || "")
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
              
              {/* Chapter Image Generation Controls */}
              {viewMode === 'read' && storyData?.generatedScript && (
                <div className="mt-8 border-t pt-4">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <ImageIcon className="mr-2 h-5 w-5 text-primary" />
                    Chapter Images
                  </h3>
                  
                  {/* Image Prompts Preview */}
                  <div className="bg-muted/30 rounded-md p-3 mb-4 text-sm">
                    <p className="font-medium mb-2">Available Image Prompts for Chapter {currentChapter}:</p>
                    <div className="bg-background rounded p-2 border border-border max-h-48 overflow-y-auto">
                      {storyData?.imagePrompts ? (
                        <>
                          {storyData.imagePrompts
                            .slice((currentChapter - 1) * 7, currentChapter * 7)
                            .map((prompt, idx) => (
                              <div key={`prompt-${idx}`} className="mb-2 border-b border-border pb-1 last:border-0">
                                <p className="text-xs font-semibold text-primary">Image {idx + 1}:</p>
                                <p className="text-xs">
                                  {prompt.split('@').map((part, i) => {
                                    if (i === 0) return part;
                                    // Extract entity name (until next space or punctuation)
                                    const entityEnd = part.search(/[^A-Za-z0-9]/);
                                    const entityName = part.substring(0, entityEnd > 0 ? entityEnd : part.length);
                                    const rest = part.substring(entityName.length);
                                    return (
                                      <React.Fragment key={i}>
                                        <span className="text-green-500 font-semibold">@{entityName}</span>
                                        {rest}
                                      </React.Fragment>
                                    );
                                  })}
                                </p>
                              </div>
                            ))}
                          {storyData.imagePrompts.slice((currentChapter - 1) * 7, currentChapter * 7).length === 0 && (
                            <p className="text-xs text-muted-foreground">No prompts available for this chapter.</p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">No image prompts found.</p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      <span className="text-green-500 font-semibold">@EntityName</span> references will be automatically expanded with their full descriptions
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4 mb-4">
                    {Array.isArray(storyData?.generatedImages) && storyData.generatedImages.filter(img => !!img && img.isChapterGenerated).length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {storyData.generatedImages
                          .filter(img => !!img && img.isChapterGenerated)
                          .map((image, index) => (
                            <div key={index} className="relative rounded-md overflow-hidden border border-border group">
                              <Image
                                src={image.imageUrl}
                                alt={image.originalPrompt || `Chapter image ${index + 1}`}
                                width={300}
                                height={200}
                                className="w-full h-auto object-cover aspect-video"
                              />
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end">
                                <div className="p-2 text-xs text-white w-full">
                                  <p className="line-clamp-2">{image.originalPrompt}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-center p-6 border border-dashed rounded-md bg-muted/10">
                        <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                        <p className="text-muted-foreground mb-4">No chapter images generated yet</p>
                        <p className="text-xs text-muted-foreground">Click the button below to generate images for Chapter {currentChapter}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-center">
                    <Button
                      variant="default"
                      size="lg"
                      className="gap-2"
                      onClick={handleGenerateChapterImages}
                      disabled={isGeneratingImages}
                    >
                      {isGeneratingImages ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {currentImageProgress > 0 && totalImagesToGenerate > 0
                            ? `Generating Image ${currentImageProgress}/${totalImagesToGenerate} (${generationProgress}%)` 
                            : `Preparing to generate Chapter ${currentChapter} Images...`}
                        </>
                      ) : chaptersGenerated.length === 0 ? (
                        <>
                          <ImageIcon className="h-4 w-4" />
                          Generate Chapter 1 Images ({storyData?.imagePrompts?.slice(0, 7).length || 0} prompts)
                        </>
                      ) : (
                        <>
                          <ImageIcon className="h-4 w-4" />
                          Generate Chapter {currentChapter} Images ({storyData?.imagePrompts?.slice((currentChapter-1)*7, currentChapter*7).length || 0} prompts)
                        </>
                      )}
                    </Button>
                  </div>
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
    
    // Parse prompts for all entity types
    const parsedCharacterDetails = parseNamedPrompts(
      (storyData as any).detailsPrompts?.characterPrompts,
      "Character",
    );
    
    const parsedItemDetails = parseNamedPrompts(
      (storyData as any).detailsPrompts?.itemPrompts,
      "Item",
    );
    
    const parsedLocationDetails = parseNamedPrompts(
      (storyData as any).detailsPrompts?.locationPrompts,
      "Location",
    );
    
    console.log(
      "Parsed Character Details from characterPrompts string:",
      JSON.stringify(parsedCharacterDetails, null, 2),
    );

    return storyData.generatedImages.map((img, index) => {
      let entityName = `Character ${index + 1}`;
      let entityType: EntityType = "Character";
      let matchReason = "No match found or img.originalPrompt missing.";
      
      const imgPromptTrimmed = img.originalPrompt?.trim() || "";
      
      // Try to match with items first
      const matchedItem = parsedItemDetails.find((itemDetail) => {
        const itemDescTrimmed = itemDetail.description.trim();
        return imgPromptTrimmed && itemDescTrimmed.includes(imgPromptTrimmed);
      });
      
      // Then try to match with locations
      const matchedLocation = parsedLocationDetails.find((locDetail) => {
        const locDescTrimmed = locDetail.description.trim();
        return imgPromptTrimmed && locDescTrimmed.includes(imgPromptTrimmed);
      });
      
      // Finally try to match with characters
      const matchedCharacter = parsedCharacterDetails.find((charDetail) => {
        const charDescTrimmed = charDetail.description.trim();
        return imgPromptTrimmed && charDescTrimmed.includes(imgPromptTrimmed);
      });

      // Choose the match based on priority: if multiple matches, prefer item > location > character
      if (matchedItem) {
        entityName = matchedItem.name || `Item ${index + 1}`;
        entityType = "Item";
        matchReason = `Matched with Item '${matchedItem.name}'`;
      } else if (matchedLocation) {
        entityName = matchedLocation.name || `Location ${index + 1}`;
        entityType = "Location";
        matchReason = `Matched with Location '${matchedLocation.name}'`;
      } else if (matchedCharacter) {
        entityName = matchedCharacter.name || `Character ${index + 1}`;
        entityType = "Character";
        matchReason = `Matched with Character '${matchedCharacter.name}'`;
      } else if (img.originalPrompt) {
        // Attempt to determine type from the content of the prompt
        const prompt = img.originalPrompt.toLowerCase();
        if (prompt.includes("flower") || prompt.includes("nectar") || 
            prompt.includes("drop") || prompt.includes("item")) {
          entityType = "Item";
          entityName = `Item ${index + 1}`;
        } else if (prompt.includes("forest") || prompt.includes("meadow") || 
                  prompt.includes("woods") || prompt.includes("location")) {
          entityType = "Location";
          entityName = `Location ${index + 1}`;
        }
        
        matchReason = `No entity description matched this image's originalPrompt: "${img.originalPrompt.trim().substring(0, 100)}..."`;
      }

      return {
        id: (img as any).id || (img as any).imageId || `gen_img_${index}`,
        name: entityName,
        prompt: img.originalPrompt || "No prompt available.",
        imageUrl: img.imageUrl,
        type: entityType,
      };
    });
  }, [
    (storyData as any).detailsPrompts?.characterPrompts,
    (storyData as any).detailsPrompts?.itemPrompts,
    (storyData as any).detailsPrompts?.locationPrompts,
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
      // Standard prompt with good styles
    const enhancedPrompt = `${formDescription}, high quality, detailed illustration, children's book style, vibrant colors, storybook style`;
    const imageResult = await generateImageFromPrompt(enhancedPrompt);

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

  // Group entities by type and ensure proper naming
  const groupedEntities = useMemo(() => {
    const groups: Record<EntityType, DisplayableEntity[]> = {
      Character: [],
      Location: [],
      Item: []
    };
    
    filteredEntities.forEach(entity => {
      // Check if entity has a generic name and try to replace it with a better one
      if (entity.name.startsWith("Character ") || 
          entity.name.startsWith("Item ") || 
          entity.name.startsWith("Location ")) {
        
        // Custom names based on prompt content for recognizable entities
        if (entity.type === "Item") {
          const prompt = entity.prompt.toLowerCase();
          if (prompt.includes("flower") && prompt.includes("rainbow")) {
            entity = {...entity, name: "Rainbow Bloom"};
          } else if (prompt.includes("drop") && prompt.includes("nectar")) {
            entity = {...entity, name: "Nectar Drop"};
          }
        } else if (entity.type === "Location") {
          const prompt = entity.prompt.toLowerCase();
          if (prompt.includes("meadow") && prompt.includes("wildflowers")) {
            entity = {...entity, name: "Sunny Meadow"};
          } else if (prompt.includes("forest") && prompt.includes("towering trees")) {
            entity = {...entity, name: "Whispering Woods"};
          } else if (prompt.includes("clearing") && prompt.includes("oak tree")) {
            entity = {...entity, name: "Mushroom Clearing"};
          }
        }
      }
      
      groups[entity.type].push(entity);
    });
    
    return groups;
  }, [filteredEntities]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-border bg-muted/20">
        <h2 className="font-semibold">Characters & Locations</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Manage and view characters, locations, and items.
        </p>
      </div>

      <div className="p-4 flex items-center gap-3 border-b border-border">
        <Input
          type="search"
          placeholder="Search..."
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
            <div className="p-4 space-y-6">
              {/* Characters Section */}
              {groupedEntities.Character.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 text-sm">Characters</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {groupedEntities.Character.map((entity) => (
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
                </div>
              )}

              {/* Locations Section */}
              {groupedEntities.Location.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 text-sm">Locations</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {groupedEntities.Location.map((entity) => (
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
                </div>
              )}

              {/* Items Section */}
              {groupedEntities.Item.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 text-sm">Items</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {groupedEntities.Item.map((entity) => (
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
                </div>
              )}

              {/* Show empty sections for each type if no entities are found */}
              {groupedEntities.Character.length === 0 && 
               groupedEntities.Location.length === 0 && 
               groupedEntities.Item.length === 0 && (
                <div className="flex h-full items-center justify-center p-4 text-center">
                  <p className="text-muted-foreground">
                    {searchTerm
                      ? "No items match your search."
                      : "No items available to display."}
                  </p>
                </div>
              )}
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
  const [selectedPanel, setSelectedPanel] = useState("Story"); // Default to Story panel to show script
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [currentChapter, setCurrentChapter] = useState(1);
  const [chaptersGenerated, setChaptersGenerated] = useState<number[]>([]);
  const [totalImagesToGenerate, setTotalImagesToGenerate] = useState<number>(7); // Default to 7 images
  const [currentImageProgress, setCurrentImageProgress] = useState(0);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [selectedTimelineImage, setSelectedTimelineImage] = useState<number | null>(null);

  // Handle generating images for a chapter in batches of 7 per minute
  const handleGenerateChapterImages = async () => {
    if (!storyData || isGeneratingImages) return;
    
    setIsGeneratingImages(true);
    setSelectedPanel("Story"); // Switch to Story panel to show progress
    
    try {
      // Calculate the audio duration in minutes
const audioDuration = storyData?.narrationAudioDurationSeconds || 240; // Default to 4 minutes if not set
      
      // Calculate how many images to generate (7 images per minute)
      const imagesPerMinute = 7;
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
      
      // Helper function to extract entity descriptions from prompts
      const parseEntityReferences = (prompt: string): string => {
              // Extract all @Entity references (including spaces and special characters)
              const entityReferences = prompt.match(/@[A-Za-z0-9]+(?:\s+[A-Za-z0-9]+)*/g) || [];
              let parsedPrompt = prompt;
        
              console.log("Entity references found:", entityReferences);
        
        // Process each entity reference
        entityReferences.forEach(ref => {
          const entityName = ref.substring(1).trim(); // Remove @ symbol and trim
          console.log(`Processing entity: ${entityName}`);
          
          // Look for entity in character prompts
          const characterPrompts = storyData?.detailsPrompts?.characterPrompts || "";
          const locationPrompts = storyData?.detailsPrompts?.locationPrompts || "";
          const itemPrompts = storyData?.detailsPrompts?.itemPrompts || "";
          
          // Find all entities and their descriptions
          let description = "";
          
          // Extract character descriptions based on the screenshot format
          // Format: "Character Prompts: NAME A description..."
          if (characterPrompts.includes(entityName)) {
            // Try to find the character description following "Character Prompts:"
            // Pattern: look for the exact name followed by a description
            const characterPattern = new RegExp(entityName + "\\s+(.*?)(?=\\n\\n|$)", "s");
            const characterMatch = characterPrompts.match(characterPattern);
            
            if (characterMatch && characterMatch[1]) {
              description = characterMatch[1].trim();
              console.log(`Found character description for ${entityName}`);
            }
          }
          
          // If not found in characters, check location prompts
          if (!description && locationPrompts.includes(entityName)) {
            // Try to find the location description
            // Pattern: look for the exact name followed by a description
            const locationPattern = new RegExp(entityName + "\\s+(.*?)(?=\\n\\n|$)", "s");
            const locationMatch = locationPrompts.match(locationPattern);
            
            if (locationMatch && locationMatch[1]) {
              description = locationMatch[1].trim();
              console.log(`Found location description for ${entityName}`);
            }
          }
          
          // If still not found, check item prompts
          if (!description && itemPrompts.includes(entityName)) {
            // Try to find the item description
            // Pattern: look for the exact name followed by a description
            const itemPattern = new RegExp(entityName + "\\s+(.*?)(?=\\n\\n|$)", "s");
            const itemMatch = itemPrompts.match(itemPattern);
            
            if (itemMatch && itemMatch[1]) {
              description = itemMatch[1].trim();
              console.log(`Found item description for ${entityName}`);
            }
          }
          
          // Replace with the actual description if found
          if (description) {
            parsedPrompt = parsedPrompt.replace(ref, description);
            console.log(`Replaced ${ref} with description`);
          } else {
            console.log(`No description found for ${entityName}, keeping original reference`);
          }
        });
        
        console.log("Final parsed prompt:", parsedPrompt);
        return parsedPrompt;
      };
      
      // Define a type for the prompt objects
      type EnhancedPrompt = {
        originalPromptWithReferences: string;
        expandedPrompt: string;
      };
      
      // Log character, location, and item prompts for debugging
      console.log("Character prompts:", storyData?.detailsPrompts?.characterPrompts);
      console.log("Location prompts:", storyData?.detailsPrompts?.locationPrompts);
      console.log("Item prompts:", storyData?.detailsPrompts?.itemPrompts);
      
      // Get existing image prompts from the story data if available
      const existingImagePrompts = storyData?.imagePrompts || [];
      console.log("Existing image prompts:", existingImagePrompts);
      
      // Debug the character/location data for reference extraction
      if (storyData?.detailsPrompts?.characterPrompts) {
        console.log("Character data available:", 
          storyData.detailsPrompts.characterPrompts.split('\n\n').map(block => block.trim().split('\n')[0]).filter(Boolean));
      }
      if (storyData?.detailsPrompts?.locationPrompts) {
        console.log("Location data available:", 
          storyData.detailsPrompts.locationPrompts.split('\n\n').map(block => block.trim().split('\n')[0]).filter(Boolean));
      }
      
      // Check if we have predefined image prompts in the database
      if (!existingImagePrompts || existingImagePrompts.length === 0) {
        toast({
          title: "Warning: No Image Prompts Found",
          description: "No predefined image prompts found in the database. Please make sure the story has image prompts.",
          variant: "destructive",
        });
      }
      
      // Use actual number of prompts or limit to imagesToGenerate (whichever is smaller)
      const actualImagesToGenerate = Math.min(imagesToGenerate, existingImagePrompts.length || 0);
      setTotalImagesToGenerate(actualImagesToGenerate);
      
      // Select prompts for this chapter (7 per chapter)
      const startIndex = (currentChapter - 1) * 7;
      const selectedPrompts = existingImagePrompts.slice(startIndex, startIndex + actualImagesToGenerate);
      
      if (selectedPrompts.length === 0) {
        throw new Error("No image prompts available for this chapter. Please check the database.");
      }
      
      // Create enhanced prompts by parsing entity references in the existing prompts
      const imagePrompts: EnhancedPrompt[] = selectedPrompts.map((prompt, index) => {
        // Use the existing prompt with entity references
        const originalPromptWithReferences = prompt;
        
        console.log(`Processing image prompt ${index + 1}: ${originalPromptWithReferences}`);
        
        // Parse and replace entity references with full descriptions
        const expandedPrompt = parseEntityReferences(originalPromptWithReferences);
        
        console.log(`Expanded prompt ${index + 1}: ${expandedPrompt.substring(0, 100)}...`);
        
        return {
          originalPromptWithReferences,
          expandedPrompt
        };
      });
      
      // Process images sequentially rather than in parallel
      const newImages: GeneratedImage[] = [];
      
      for (let index = 0; index < imagePrompts.length; index++) {
        // Get the enhanced prompt for this index
        const prompt = imagePrompts[index];
        const originalPromptWithReferences = prompt.originalPromptWithReferences;
        const expandedPrompt = prompt.expandedPrompt;
          
        // Update progress indicators
        setCurrentImageProgress(index + 1);
        setGenerationProgress(Math.round(((index) / (imagePrompts.length || 1)) * 100));
          
        // Log which prompt is being processed for debugging
        console.log(`Processing prompt ${index + 1}/${imagePrompts.length}:`, originalPromptWithReferences);
        
        // Show individual progress
        toast({
          title: `Generating Image ${index + 1}/${imagesToGenerate}`,
          description: originalPromptWithReferences.substring(0, 100) + "...",
          duration: 3000, // Show for 3 seconds
        });
        
        // Log the original and enhanced prompts for debugging
        console.log(`Original prompt with references: ${originalPromptWithReferences}`);
        console.log(`Expanded prompt for generation: ${expandedPrompt}`);
        
        // Call the actual image generation API
        const result = await generateImageFromPrompt(expandedPrompt);
        
        if (!result.success || !result.imageUrl) {
          throw new Error(`Failed to generate image ${index + 1}: ${result.error || "Unknown error"}`);
        }
  
        // Add to our array
      newImages.push({
        originalPrompt: originalPromptWithReferences,
        requestPrompt: result.requestPrompt || expandedPrompt,
        imageUrl: result.imageUrl,
        isChapterGenerated: true,
        chapterNumber: currentChapter,
        expandedPrompt: expandedPrompt // Store for reference
      });
  
        // Update progress
        setGenerationProgress(Math.round(((index + 1) / (imagePrompts.length || 1)) * 100));
  
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
          description: "All @Entity references were replaced with their full descriptions",
          duration: 3000,
        });
        
        // Log the final prompt with replacements for debugging
        console.log("Final prompt with replacements:", expandedPrompt);
        console.log("Entity references in original prompt:", originalPromptWithReferences.match(/@[A-Za-z0-9]+(?:\s*[A-Za-z0-9]+)*/g) || []);
        
        // For completeness, also log both prompts side by side
        console.log("BEFORE:", originalPromptWithReferences);
        console.log("AFTER:", expandedPrompt);
        
        // For debugging, show what @references were replaced
        const beforeRefs = originalPromptWithReferences.match(/@[A-Za-z0-9]+(?:\s+[A-Za-z0-9]+)*/g) || [];
        beforeRefs.forEach(ref => {
          const entityName = ref.substring(1).trim();
          console.log(`@${entityName} was replaced with its description`);
        });
      }
      
      // Reset progress when complete
      // Set final progress values
      setCurrentImageProgress(imagesToGenerate);
      setGenerationProgress(100);
      
      // Add the new images to the story data
      setStoryData(prevData => {
        if (!prevData) return null;
        
        // Get existing images that weren't chapter-generated or were from different chapters
        const existingImages = Array.isArray(prevData.generatedImages) 
          ? prevData.generatedImages.filter(img => 
              !img.isChapterGenerated || 
              (img.isChapterGenerated && img.chapterNumber !== currentChapter)
            )
          : [];
        
        // Save the updated story with new images
        if (prevData) {
          saveStory({
            ...prevData,
            generatedImages: [...existingImages, ...newImages],
          }, prevData.userId);
        }
        
        return {
          ...prevData,
          // Append new images to the story data
          generatedImages: [...existingImages, ...newImages],
        };
      });
      
      // Mark this chapter as generated
      setChaptersGenerated(prev => [...prev, currentChapter]);
      
      // Check if we have more chapters to generate
      const totalPossibleChapters = Math.ceil((storyData?.imagePrompts?.length || 0) / 7);
      
      if (currentChapter < totalPossibleChapters) {
        // Update to next chapter if more are available
        setCurrentChapter(prev => prev + 1);
        
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
        description: "There was an error generating the images. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingImages(false);
      setCurrentImageProgress(0);
      setGenerationProgress(0);
    }
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
            <div className="flex-1 bg-muted rounded-lg flex items-center justify-center shadow-inner">
              {storyData.generatedImages &&
              storyData.generatedImages.length > 0 &&
              storyData.generatedImages[0]?.isChapterGenerated ? (
                <Image
                  src={storyData.generatedImages[0].imageUrl}
                  alt="Video Preview Placeholder"
                  width={800}
                  height={450}
                  className="max-w-full max-h-full object-contain rounded-md"
                />
              ) : (
                <div className="flex flex-col items-center justify-center">
                  <Video className="w-24 h-24 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground text-sm max-w-md text-center">
                    This is the timeline view. Generate images to start creating your animation.
                    <span className="font-mono text-xs block mt-2 p-2 bg-background/80 rounded-md">
                      "Wide shot of @SunnyMeadow, with @Barnaby, a small, fuzzy bee, buzzing happily among the wildflowers."
                    </span>
                  </p>
                </div>
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
                  : "3:59"} {/* Default to 3:59 for demo purposes */}
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

            <div className="flex flex-col">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-medium text-primary">Timeline</h3>
              </div>
              <ScrollArea className="h-32 bg-background p-2 rounded-md shadow-sm border border-border">
                <div className="flex space-x-2 pb-2">
                {storyData?.generatedImages && 
                 Array.isArray(storyData.generatedImages) &&
                 storyData.generatedImages.length > 0 && 
                 storyData.generatedImages.some(img => img.isChapterGenerated) ? (
                  // Only show images when they've been generated through our chapter generation
                  storyData.generatedImages
                    .filter(img => !!img && img.isChapterGenerated)
                    .map((img, index) => (
                      <div
                        key={index}
                        className={`flex-shrink-0 w-32 h-28 rounded-md overflow-hidden border-2 ${selectedTimelineImage === index ? 'border-primary' : 'border-transparent hover:border-primary/50'} cursor-pointer shadow relative group`}
                        onClick={() => setSelectedTimelineImage(index)}
                      >
                        <Image
                          src={img.imageUrl}
                          alt={`Scene ${index + 1}`}
                          width={128}
                          height={112}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end">
                          <div className="p-2 text-[10px] text-white">
                            <p className="truncate font-medium">Chapter {img.chapterNumber || 1}, Scene {index + 1}</p>
                            <p className="truncate text-gray-300 mt-0.5">
                              {img.originalPrompt?.substring(0, 60)}...
                            </p>
                          </div>
                        </div>
                        {selectedTimelineImage === index && (
                          <div className="absolute top-1 right-1 bg-primary rounded-full w-4 h-4 flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                    ))
                ) : (
                  // Empty state showing "Generate Chapter" button
                  <div className="flex flex-col items-center justify-center w-full h-full text-center">
                    <div className="text-muted-foreground mb-3">
                      <p className="text-sm">Empty timeline - click below to generate images for Chapter {currentChapter}</p>
                    </div>
                    <Button 
                      variant="outline" 
                      className="border-dashed border-2 hover:border-primary"
                      disabled={isGeneratingImages}
                      onClick={handleGenerateChapterImages}
                    >
                      {isGeneratingImages ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {currentImageProgress > 0 && totalImagesToGenerate > 0
                            ? `Generating ${currentImageProgress}/${totalImagesToGenerate} (${generationProgress}%)` 
                            : `Preparing images...`}
                        </>
                      ) : chaptersGenerated.length === 0 ? (
                        <>
                          <ImageIcon className="w-4 h-4 mr-2" />
                          Generate Chapter 1 Images
                        </>
                      ) : (
                        <>
                          <ImageIcon className="w-4 h-4 mr-2" />
                          Generate Chapter {currentChapter} Images
                        </>
                      )}
                    </Button>
                  </div>
                )}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
            
            {/* Preview of selected image */}
            {selectedTimelineImage !== null && 
             storyData?.generatedImages && 
             Array.isArray(storyData.generatedImages) &&
             storyData.generatedImages[selectedTimelineImage] && (
              <div className="mt-4 border rounded-md p-3 bg-card">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-medium text-primary">Selected Image</h3>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setSelectedTimelineImage(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex gap-4">
                  <div className="w-48 h-32 rounded-md overflow-hidden shadow-md">
                    <Image
                      src={storyData?.generatedImages?.[selectedTimelineImage]?.imageUrl || ''}
                      alt={`Selected Scene`}
                      width={192}
                      height={128}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium mb-1">Prompt:</p>
                    <p className="text-xs text-muted-foreground mb-2">{storyData?.generatedImages?.[selectedTimelineImage]?.originalPrompt || 'No prompt available'}</p>
                    
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline" className="text-xs h-7">
                        <Edit2 className="w-3 h-3 mr-1" /> Edit
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs h-7">
                        <Trash2 className="w-3 h-3 mr-1" /> Remove
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-xs h-7"
                        onClick={() => {
                          toast({
                            title: "Image Prompt",
                            description: storyData?.generatedImages?.[selectedTimelineImage]?.originalPrompt,
                            duration: 5000,
                          });
                        }}
                      >
                        <Info className="w-3 h-3 mr-1" /> Prompt
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
