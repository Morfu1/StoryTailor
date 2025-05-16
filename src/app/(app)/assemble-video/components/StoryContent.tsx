"use client";

import React, { useEffect, useState } from "react";
import type { Story } from "@/types/story";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { saveStory } from "@/actions/storyActions";
import {
  AlignCenter,
  AlignJustify,
  BookOpen,
  Edit3,
  ImageIcon,
  Loader2,
  Save,
  Type,
  X,
} from "lucide-react";
import Image from "next/image";

interface StoryContentProps {
  storyData: Story;
  isGeneratingImages: boolean;
  handleGenerateChapterImages: () => Promise<void>;
  currentChapter: number;
  chaptersGenerated: number[];
  currentImageProgress: number;
  generationProgress: number;
  totalImagesToGenerate: number;
}

export default function StoryContent({
  storyData,
  isGeneratingImages,
  handleGenerateChapterImages,
  currentChapter,
  chaptersGenerated,
  currentImageProgress,
  generationProgress,
  totalImagesToGenerate,
}: StoryContentProps) {
  const [fontSize, setFontSize] = useState<"sm" | "base" | "lg" | "xl">("base");
  const [viewMode, setViewMode] = useState<"read" | "edit">("read");
  const [editedScript, setEditedScript] = useState<string>("");
  const [paragraphStyle, setParagraphStyle] = useState<
    "indented" | "block" | "justified"
  >("indented");
  const [showTooltips, setShowTooltips] = useState(true);
  const { toast } = useToast();

  // Function to automatically format the story text with proper paragraph breaks
  const formatStoryText = (text: string): string => {
    if (!text) return "";

    // Normalize line endings
    let formattedText = text.replace(/\r\n/g, "\n");

    // Replace multiple blank lines with exactly two newlines
    formattedText = formattedText.replace(/\n{3,}/g, "\n\n");

    // Ensure paragraph breaks have double newlines
    formattedText = formattedText
      .split(/\n\s*\n/)
      .map((para) => para.trim())
      .join("\n\n");

    // Ensure the formatted text doesn't have leading/trailing whitespace
    return formattedText.trim();
  };

  // Get CSS classes for the selected paragraph style
  const getParagraphStyleClass = (isFirstLine: boolean = false) => {
    switch (paragraphStyle) {
      case "indented":
        return isFirstLine ? "text-indent-4" : "";
      case "block":
        return "mb-4";
      case "justified":
        return "text-justify mb-4";
      default:
        return isFirstLine ? "text-indent-4" : "";
    }
  };

  // Add custom CSS for text formatting
  useEffect(() => {
    // Add custom CSS for text formatting if not already present
    if (!document.getElementById("story-formatting-css")) {
      const style = document.createElement("style");
      style.id = "story-formatting-css";
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
      const style = document.getElementById("story-formatting-css");
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
      generatedScript: formattedScript,
    };

    // Update the displayed text with the formatted version
    setEditedScript(formattedScript);

    toast({
      title: "Saving Script...",
      description: "Updating your story in the database",
    });

    try {
      const result = await saveStory(updatedStory, storyData.userId);
      if (result.success) {
        toast({
          title: "Script Saved",
          description: "Your story has been updated successfully.",
          className: "bg-green-500 text-white",
        });
        setViewMode("read");
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
      case "sm":
        return "text-sm";
      case "lg":
        return "text-lg";
      case "xl":
        return "text-xl";
      default:
        return "text-base";
    }
  };

  return (
    <div className="h-full">
      <div className="rounded-lg border border-border shadow-sm h-full flex flex-col">
        <div className="p-3 border-b border-border bg-muted/20 flex justify-between items-center">
          <div>
            <h2 className="font-semibold">Story Content</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {viewMode === "read"
                ? "Read your story script"
                : "Edit your story script"}
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
                <DropdownMenuItem onClick={() => setFontSize("sm")}>
                  Small Text
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFontSize("base")}>
                  Normal Text
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFontSize("lg")}>
                  Large Text
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFontSize("xl")}>
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
                <DropdownMenuItem onClick={() => setParagraphStyle("indented")}>
                  <span
                    className={paragraphStyle === "indented" ? "font-bold" : ""}
                  >
                    Indented Paragraphs
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setParagraphStyle("block")}>
                  <span
                    className={paragraphStyle === "block" ? "font-bold" : ""}
                  >
                    Block Paragraphs
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setParagraphStyle("justified")}
                >
                  <span
                    className={
                      paragraphStyle === "justified" ? "font-bold" : ""
                    }
                  >
                    Justified Text
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {viewMode === "edit" && (
              <TooltipProvider>
                <Tooltip open={showTooltips}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setEditedScript(formatStoryText(editedScript))
                      }
                    >
                      <AlignCenter className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      Auto-format text with proper paragraph breaks and spacing
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {viewMode === "read" ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setViewMode("edit")}
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
                    setEditedScript(storyData.generatedScript || "");
                    setViewMode("read");
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

              {viewMode === "read" ? (
                <div
                  className={`whitespace-pre-line rounded-md border border-border bg-card p-4 ${getFontSizeClass()} ${paragraphStyle === "justified" ? "text-justify" : ""}`}
                >
                  {storyData?.generatedScript ? (
                    <div className="prose prose-stone dark:prose-invert max-w-none">
                      {formatStoryText(storyData.generatedScript || "")
                        .split("\n\n")
                        .map((paragraph, paraIndex) => (
                          <div key={paraIndex} className="mb-6">
                            {paragraph.split("\n").map((line, lineIndex) => (
                              <p
                                key={`${paraIndex}-${lineIndex}`}
                                className={`${lineIndex === 0 ? getParagraphStyleClass(true) : getParagraphStyleClass()} ${line.trim() === "" ? "h-2" : ""}`}
                              >
                                {line.trim() === "" ? "\u00A0" : line}
                              </p>
                            ))}
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic">
                      No script content available
                    </p>
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
              {viewMode === "read" && storyData?.generatedScript && (
                <div className="mt-8 border-t pt-4">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <ImageIcon className="mr-2 h-5 w-5 text-primary" />
                    Chapter Images
                  </h3>

                  {/* Image Prompts Preview */}
                  <div className="bg-muted/30 rounded-md p-3 mb-4 text-sm">
                    <p className="font-medium mb-2">
                      Available Image Prompts for Chapter {currentChapter}:
                    </p>
                    <div className="bg-background rounded p-2 border border-border max-h-48 overflow-y-auto">
                      {storyData?.imagePrompts ? (
                        <>
                          {storyData.imagePrompts
                            .slice((currentChapter - 1) * 7, currentChapter * 7)
                            .map((prompt, idx) => (
                              <div
                                key={`prompt-${idx}`}
                                className="mb-2 border-b border-border pb-1 last:border-0"
                              >
                                <p className="text-xs font-semibold text-primary">
                                  Image {idx + 1}:
                                </p>
                                <p className="text-xs">
                                  {prompt.split("@").map((part, i) => {
                                    if (i === 0) return part;
                                    // Extract entity name (until next space or punctuation)
                                    const entityEnd =
                                      part.search(/[^A-Za-z0-9]/);
                                    const entityName = part.substring(
                                      0,
                                      entityEnd > 0 ? entityEnd : part.length,
                                    );
                                    const rest = part.substring(
                                      entityName.length,
                                    );
                                    return (
                                      <React.Fragment key={i}>
                                        <span className="text-green-500 font-semibold">
                                          @{entityName}
                                        </span>
                                        {rest}
                                      </React.Fragment>
                                    );
                                  })}
                                </p>
                              </div>
                            ))}
                          {storyData.imagePrompts.slice(
                            (currentChapter - 1) * 7,
                            currentChapter * 7,
                          ).length === 0 && (
                            <p className="text-xs text-muted-foreground">
                              No prompts available for this chapter.
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No image prompts found.
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      <span className="text-green-500 font-semibold">
                        @EntityName
                      </span>{" "}
                      references will be automatically expanded with their full
                      descriptions
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 mb-4">
                    {Array.isArray(storyData?.generatedImages) &&
                    storyData.generatedImages.filter(
                      (img) => !!img && img.isChapterGenerated,
                    ).length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {storyData.generatedImages
                          .filter((img) => !!img && img.isChapterGenerated)
                          .map((image, index) => (
                            <div
                              key={index}
                              className="relative rounded-md overflow-hidden border border-border group"
                            >
                              <Image
                                src={image.imageUrl}
                                alt={
                                  image.originalPrompt ||
                                  `Chapter image ${index + 1}`
                                }
                                width={300}
                                height={200}
                                className="w-full h-auto object-cover aspect-video"
                              />
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end">
                                <div className="p-2 text-xs text-white w-full">
                                  <p className="line-clamp-2">
                                    {image.originalPrompt}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-center p-6 border border-dashed rounded-md bg-muted/10">
                        <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                        <p className="text-muted-foreground mb-4">
                          No chapter images generated yet
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Click the button below to generate images for Chapter{" "}
                          {currentChapter}
                        </p>
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
                          Generate Chapter 1 Images (
                          {storyData?.imagePrompts?.slice(0, 7).length ||
                            0}{" "}
                          prompts)
                        </>
                      ) : (
                        <>
                          <ImageIcon className="h-4 w-4" />
                          Generate Chapter {currentChapter} Images (
                          {storyData?.imagePrompts?.slice(
                            (currentChapter - 1) * 7,
                            currentChapter * 7,
                          ).length || 0}{" "}
                          prompts)
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {viewMode === "read" && storyData.generatedScript && (
                <div className="mt-4 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setViewMode("edit")}
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