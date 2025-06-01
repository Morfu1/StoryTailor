
"use client";

import React, { useState, useMemo } from "react";
import type { Story, StoryCharacterLocationItemPrompts } from "@/types/story";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { generateImageFromPrompt } from "@/actions/storyActions";
import { parseNamedPrompts } from "@/utils/storyHelpers";
import {
  ArrowLeft,
  ImageIcon,
  Loader2,
  Plus,
  // Trash2, // Unused
  Upload,
} from "lucide-react";
import Image from "next/image";

type PanelView = "list" | "form";
export type EntityType = "Character" | "Location" | "Item";

interface CharactersPanelContentProps {
  storyData: Story;
  onCharacterCreated: (characterData: {
    name: string;
    description: string;
    imageUrl: string;
    requestPrompt?: string;
    type: EntityType;
  }) => Promise<void> | void;
}

interface DisplayableEntity {
  id: string;
  name: string;
  prompt: string; // This is the description of the entity
  imageUrl?: string;
  type: EntityType;
}

export default function CharactersPanelContent({
  storyData,
  onCharacterCreated,
}: CharactersPanelContentProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [panelView, setPanelView] = useState<PanelView>("list");
  const [formEntityType, setFormEntityType] = useState<EntityType | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const MAX_DESC_LENGTH = 300; // Increased max length for detailed prompts
  const [isSaving, setIsSaving] = useState(false);
  
  // Locally added entities are those created directly in this panel,
  // not yet persisted or for quick additions before a full save.
  // For this refactor, we'll primarily rely on storyData and assume onCharacterCreated updates it.
  // If local optimistic updates are needed before save, this state can be used more extensively.


  const baseDisplayableEntities = useMemo(() => {
    const entities: DisplayableEntity[] = [];
    const details = storyData.detailsPrompts as StoryCharacterLocationItemPrompts | undefined;

    const processPrompts = (promptString: string | undefined, type: EntityType) => {
      if (!promptString) return;
      const parsed = parseNamedPrompts(promptString);
      parsed.forEach((p, index) => {
        // Find an image where the 'originalPrompt' (which is the entity description) matches
        const image = storyData.generatedImages?.find(img => img.originalPrompt === p.description);
        entities.push({
          id: `${type.toLowerCase()}-${p.name || p.originalIndex}-${index}`, // More unique ID
          name: p.name || `${type} ${p.originalIndex + 1}`,
          prompt: p.description,
          imageUrl: image?.imageUrl,
          type: type,
        });
      });
    };

    processPrompts(details?.characterPrompts, "Character");
    processPrompts(details?.itemPrompts, "Item");
    processPrompts(details?.locationPrompts, "Location");
    
    return entities;
  }, [storyData.detailsPrompts, storyData.generatedImages]);


  const allDisplayableEntities = useMemo(() => {
    // For now, assuming onCharacterCreated updates storyData, so locallyAddedEntities might be redundant
    // if changes are immediately reflected in storyData.
    // If optimistic updates are needed, locallyAddedEntities would be merged here.
    return [...baseDisplayableEntities];
  }, [baseDisplayableEntities]);

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
      // The prompt sent to image generation should be the description itself.
      // Styles like "high quality, detailed..." can be appended by the generateImageFromPrompt action or here.
      const imageGenPrompt = `${formDescription}, high quality, detailed illustration, children's book style, vibrant colors, storybook style`;
      const imageResult = await generateImageFromPrompt(imageGenPrompt, storyData.userId, storyData.id);

      if (!imageResult.success || !imageResult.imageUrl) {
        toast({
          title: `Image Generation Failed for ${formEntityType}`,
          description: imageResult.error || "Could not generate image.",
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }

      // The onCharacterCreated function expects 'description' to be the core description
      // and 'requestPrompt' to be what was actually sent to the image gen API.
      await onCharacterCreated({
        name: formName,
        description: formDescription, // This is the core description for the entity
        imageUrl: imageResult.imageUrl,
        requestPrompt: imageResult.requestPrompt || imageGenPrompt, // What was sent to PicsArt
        type: formEntityType,
      });

      toast({
        title: `${formEntityType} Created!`,
        description: `${formName} has been created with a generated image. Save the story to persist.`,
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

  // Moved groupedEntities useMemo hook before conditional return
  const groupedEntities = useMemo(() => {
    const groups: Record<EntityType, DisplayableEntity[]> = {
      Character: [],
      Location: [],
      Item: [],
    };
    filteredEntities.forEach((entity) => {
      groups[entity.type].push(entity);
    });
    return groups;
  }, [filteredEntities]);

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
        </div>
        <ScrollArea className="flex-1 p-4 space-y-4">
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
              {formEntityType} Description (This will be used for image generation)
            </Label>
            <Textarea
              id="entityDescription"
              value={formDescription}
              onChange={(e) => {
                if (e.target.value.length <= MAX_DESC_LENGTH) {
                  setFormDescription(e.target.value);
                }
              }}
              placeholder={`Enter detailed visual description for the ${formEntityType.toLowerCase()}...`}
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
              disabled={isSaving || !formName.trim() || !formDescription.trim()}
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {isSaving
                ? `Generating & Saving ${formEntityType}...`
                : `Generate Image & Add ${formEntityType}`}
            </Button>
          </div>
        </ScrollArea>
      </div>
    );
  }

  // const groupedEntities = useMemo(() => { // Moved earlier
  //   const groups: Record<EntityType, DisplayableEntity[]> = {
  //     Character: [],
  //     Location: [],
  //     Item: [],
  //   };
  //   filteredEntities.forEach((entity) => {
  //     groups[entity.type].push(entity);
  //   });
  //   return groups;
  // }, [filteredEntities]);

  const entityTypes: EntityType[] = ["Character", "Location", "Item"];

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-border bg-muted/20">
        <h2 className="font-semibold">Characters, Locations & Items</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Manage visual descriptions and generated images for story elements.
        </p>
      </div>

      <div className="p-4 flex items-center gap-3 border-b border-border">
        <Input
          type="search"
          placeholder="Search by name or description..."
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

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {entityTypes.map((type) => {
            const entitiesOfType = groupedEntities[type];
            if (entitiesOfType.length === 0 && !searchTerm) return null; // Don't render empty sections if not searching

            return (
              <div key={type}>
                <h3 className="font-semibold mb-3 text-sm">{type}s</h3>
                {entitiesOfType.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {entitiesOfType.map((entity) => (
                      <div
                        key={entity.id}
                        className="flex items-start gap-3 p-3 border border-border rounded-md bg-background hover:shadow-md transition-shadow"
                      >
                        <div className="w-32 h-24 bg-muted/50 rounded overflow-hidden flex-shrink-0 flex items-center justify-center border">
                          {entity.imageUrl ? (
                            <Image
                              src={entity.imageUrl}
                              alt={entity.name}
                              width={128}
                              height={96}
                              objectFit="contain"
                              className="rounded"
                            />
                          ) : (
                            <div className="w-full h-full bg-muted flex items-center justify-center text-center text-xs text-muted-foreground p-1">
                              <ImageIcon className="w-8 h-8 mr-1 text-muted-foreground/50" />
                              Image not generated
                            </div>
                          )}
                        </div>
                        <div className="flex-grow min-w-0"> {/* Added min-w-0 for truncation */}
                          <h4 className="font-semibold text-sm truncate" title={entity.name}>
                            {entity.name}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-words line-clamp-3" title={entity.prompt}>
                            {entity.prompt}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : searchTerm ? (
                     <p className="text-sm text-muted-foreground text-center py-4">No {type.toLowerCase()}s match your search.</p>
                ) : null}
              </div>
            );
          })}

          {filteredEntities.length === 0 && searchTerm && (
            <div className="flex h-40 items-center justify-center p-4 text-center">
              <p className="text-muted-foreground">
                No items match your search term &quot;{searchTerm}&quot;.
              </p>
            </div>
          )}
           {allDisplayableEntities.length === 0 && !searchTerm && (
            <div className="flex h-40 items-center justify-center p-4 text-center">
                <p className="text-muted-foreground">
                    No characters, items, or locations defined yet. <br/>
                    You can generate them in &quot;Create Story&quot; (Step 2), or add new ones here.
                </p>
            </div>
           )}
        </div>
        <ScrollBar orientation="vertical" />
      </ScrollArea>
    </div>
  );
}

    