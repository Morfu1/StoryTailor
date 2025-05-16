"use client";

import React, { useState, useMemo } from "react";
import type { Story } from "@/types/story";
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
import { parseNamedPrompts } from "../utils"; // Adjusted path
import {
  ArrowLeft,
  ImageIcon,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import Image from "next/image";

type PanelView = "list" | "form";
export type EntityType = "Character" | "Location" | "Item"; // Exporting for potential use elsewhere

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
  prompt: string;
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

      const matchedItem = parsedItemDetails.find((itemDetail) => {
        const itemDescTrimmed = itemDetail.description.trim();
        return imgPromptTrimmed && itemDescTrimmed.includes(imgPromptTrimmed);
      });

      const matchedLocation = parsedLocationDetails.find((locDetail) => {
        const locDescTrimmed = locDetail.description.trim();
        return imgPromptTrimmed && locDescTrimmed.includes(imgPromptTrimmed);
      });

      const matchedCharacter = parsedCharacterDetails.find((charDetail) => {
        const charDescTrimmed = charDetail.description.trim();
        return imgPromptTrimmed && charDescTrimmed.includes(imgPromptTrimmed);
      });

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
        const prompt = img.originalPrompt.toLowerCase();
        if (
          prompt.includes("flower") ||
          prompt.includes("nectar") ||
          prompt.includes("drop") ||
          prompt.includes("item")
        ) {
          entityType = "Item";
          entityName = `Item ${index + 1}`;
        } else if (
          prompt.includes("forest") ||
          prompt.includes("meadow") ||
          prompt.includes("woods") ||
          prompt.includes("location")
        ) {
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
        description: formDescription,
        imageUrl: imageResult.imageUrl,
        requestPrompt: imageResult.requestPrompt || formDescription,
        type: formEntityType,
      };

      onCharacterCreated(newCharacterData);

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

  const groupedEntities = useMemo(() => {
    const groups: Record<EntityType, DisplayableEntity[]> = {
      Character: [],
      Location: [],
      Item: [],
    };

    filteredEntities.forEach((entity) => {
      if (
        entity.name.startsWith("Character ") ||
        entity.name.startsWith("Item ") ||
        entity.name.startsWith("Location ")
      ) {
        if (entity.type === "Item") {
          const prompt = entity.prompt.toLowerCase();
          if (prompt.includes("flower") && prompt.includes("rainbow")) {
            entity = { ...entity, name: "Rainbow Bloom" };
          } else if (prompt.includes("drop") && prompt.includes("nectar")) {
            entity = { ...entity, name: "Nectar Drop" };
          }
        } else if (entity.type === "Location") {
          const prompt = entity.prompt.toLowerCase();
          if (prompt.includes("meadow") && prompt.includes("wildflowers")) {
            entity = { ...entity, name: "Sunny Meadow" };
          } else if (
            prompt.includes("forest") &&
            prompt.includes("towering trees")
          ) {
            entity = { ...entity, name: "Whispering Woods" };
          } else if (
            prompt.includes("clearing") &&
            prompt.includes("oak tree")
          ) {
            entity = { ...entity, name: "Mushroom Clearing" };
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
                          <h4 className="font-semibold text-sm">
                            {entity.name}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-words">
                            {entity.prompt}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                          <h4 className="font-semibold text-sm">
                            {entity.name}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-words">
                            {entity.prompt}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                          <h4 className="font-semibold text-sm">
                            {entity.name}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-words">
                            {entity.prompt}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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