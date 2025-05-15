"use client";

import type { Story } from "@/types/story";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { getStory } from "@/actions/storyActions";
import {
  ArrowLeft,
  Clapperboard,
  Download,
  Edit3,
  Film,
  ImageIcon,
  Loader2,
  Music,
  Settings,
  Sparkles,
  Text,
  User,
  Video,
  Wand2,
  ZoomIn,
  ZoomOut,
  Play,
  Pause,
  Maximize,
  History,
  SidebarClose,
  SidebarOpen,
  Trash2,
  Copy,
  Scissors,
  Volume2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";

const sidebarNavItems = [
  { name: "All Media", icon: Wand2 },
  { name: "Edit", icon: Edit3 },
  { name: "Characters", icon: User },
  { name: "Story", icon: Text },
  { name: "Music", icon: Music },
  { name: "Settings", icon: Settings },
  { name: "Voices", icon: Video, sectionBreak: true },
];

// Voice Settings content component
function VoicesContent({ storyData }: { storyData: Story }) {
  const voiceInfo = useMemo(() => {
    const voiceName = storyData.narrationVoice || "Narrator";
    const voiceId =
      storyData.narrationVoiceId || storyData.elevenLabsVoiceId || "Unknown";
    const duration = storyData.narrationAudioDurationSeconds
      ? `${Math.floor(storyData.narrationAudioDurationSeconds / 60)}:${(storyData.narrationAudioDurationSeconds % 60).toString().padStart(2, "0")}`
      : "0:00";
    const hasAudio = !!storyData.narrationAudioUrl;

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
                      src={storyData.narrationAudioUrl}
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

const parseNamedPrompts = (rawPrompts: string | undefined, type: 'Character' | 'Item' | 'Location'): ParsedPrompt[] => {
  if (!rawPrompts) return [];

  const cleanPrompts = rawPrompts
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
        const firstLineIsLikelyName = lines[0].length < 60 && !/[\\.\\?!]$/.test(lines[0]) && lines.slice(1).join(' ').length > 0;

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
// End of copied code

function CharactersPanelContent({ storyData }: { storyData: Story }) {
  const displayableCharacters = useMemo(() => {
    if (!storyData.generatedImages?.length) {
      return [];
    }

    // Use the robust parser
    const parsedCharacterDetails = parseNamedPrompts((storyData as any).detailsPrompts?.characterPrompts, 'Character');

    return storyData.generatedImages.map((img, index) => {
      let characterName = `Character ${index + 1}`; // Default name
      let characterFullDescription = img.originalPrompt || "No description available."; // Default to image's own prompt

      // Find the parsed character detail that corresponds to this image.
      // The image's `originalPrompt` should be contained within the character's full `description` from parsedCharacterDetails.
      const matchedCharacter = parsedCharacterDetails.find(charDetail =>
        img.originalPrompt && charDetail.description.trim().includes(img.originalPrompt.trim())
      );

      if (matchedCharacter) {
        characterName = matchedCharacter.name || `Character ${index + 1}`; // Use parsed name
        // If you want to display the full description from parsedCharacterDetails instead of img.originalPrompt:
        // characterFullDescription = matchedCharacter.description; 
      }

      return {
        id: (img as any).id || (img as any).imageId || `gen_img_${index}`,
        name: characterName,
        prompt: img.originalPrompt || "No prompt available.", // This is the prompt associated directly with the image generation
        imageUrl: img.imageUrl,
      };
    });
  }, [(storyData as any).detailsPrompts?.characterPrompts, storyData.generatedImages]);

  return (
    <div className="h-full">
      <div className="rounded-lg border border-border shadow-sm h-full flex flex-col">
        <div className="p-3 border-b border-border bg-muted/20">
          <h2 className="font-semibold">Characters</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            View generated character images and their prompts
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {displayableCharacters.length > 0 ? (
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                {displayableCharacters.map((character) => (
                  <div
                    key={character.id} 
                    className="flex items-start gap-3 p-3 border border-border rounded-md bg-background hover:shadow-sm transition-shadow"
                  >
                    <div className="w-32 h-24 bg-muted/50 rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {character.imageUrl ? (
                        <Image
                          src={character.imageUrl}
                          alt={character.name}
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
                      <h4 className="font-semibold text-sm">
                        {character.name}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-words">
                        {character.prompt}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <ScrollBar orientation="vertical" />
            </ScrollArea>
          ) : (
            <div className="flex h-full items-center justify-center p-4">
              <p className="text-muted-foreground">
                No generated images found in story data.
              </p>
            </div>
          )}
        </div>
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
  const [selectedPanel, setSelectedPanel] = useState("Voices"); // Default to Voices panel

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
      {/* Column 1: Sidebar / Menu */}
      <div className="w-52 bg-background border-r border-border flex flex-col">
        {/* Top Bar with Back Button */}
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

        {/* Menu Area */}
        <div className="flex flex-col h-full">
          {/* Menu Items */}
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

          {/* History at bottom */}
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
          >
            <Download className="w-4 h-4 mr-2" />
            Export (Coming Soon)
          </Button>
        </div>

        {/* Container for columns 2 & 3 */}
        <div className="flex-1 flex overflow-hidden">
          {/* Column 2: Panel Content (Voice Settings when Voices is selected) */}
          <div className="w-2/5 p-4 overflow-auto border-r border-border">
            {selectedPanel === "Voices" ? (
              <VoicesContent storyData={storyData} />
            ) : selectedPanel === "Characters" ? (
              <CharactersPanelContent storyData={storyData} />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Select an option from the sidebar to view settings
              </div>
            )}
          </div>

          {/* Column 3: Video Preview & Timeline (always visible) */}
          <div className="w-3/5 flex flex-col p-4 gap-4 overflow-hidden">
            {/* Video Preview */}
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

            {/* Timeline Controls */}
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
                {storyData.narrationAudioDurationSeconds
                  ? (storyData.narrationAudioDurationSeconds / 60)
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

            {/* Timeline */}
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
