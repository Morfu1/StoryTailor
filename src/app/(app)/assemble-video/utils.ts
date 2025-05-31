import type { Story } from "@/types/story";

// Interface for parsed prompts
export interface ParsedPrompt {
  name?: string;
  description: string;
  originalIndex: number;
}

// Helper function to convert names to @ reference format
export const nameToReference = (name: string): string => {
  // Allow alphanumeric characters and dots in references
  return '@' + name.replace(/\s+/g, '').replace(/[^A-Za-z0-9.]/g, '');
};

// Helper function to extract entity names from prompts
export const extractEntityNames = (storyData: Story | null): { characters: string[], items: string[], locations: string[] } => {
  if (!storyData?.detailsPrompts) {
    return { characters: [], items: [], locations: [] };
  }

  const extractNamesFromSection = (section: string): string[] => {
    if (!section) return [];
    
    const cleanSection = section.replace(/^(Character Prompts:|Item Prompts:|Location Prompts:)\s*\n*/i, '').trim();
    if (!cleanSection) return [];
    
    return cleanSection
      .split(/\n\s*\n/)
      .map(block => {
        const lines = block.trim().split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length === 0) return null;
        
        const firstLine = lines[0];
        // Check if first line looks like a name (short, no punctuation at end)
        if (firstLine.length < 60 && !/[\.?!]$/.test(firstLine)) {
          return firstLine;
        }
        return null;
      })
      .filter(name => name !== null) as string[];
  };

  return {
    characters: extractNamesFromSection(storyData.detailsPrompts.characterPrompts || ''),
    items: extractNamesFromSection(storyData.detailsPrompts.itemPrompts || ''),
    locations: extractNamesFromSection(storyData.detailsPrompts.locationPrompts || '')
  };
};

/**
 * Parses named prompts from a raw string
 * @param rawPrompts The raw prompts string
 * @param type The type of entity (Character, Item, or Location)
 * @returns Array of parsed prompts
 */
export const parseNamedPrompts = (
  rawPrompts: string | undefined,
  type: "Character" | "Item" | "Location",
): ParsedPrompt[] => {
  if (!rawPrompts) return [];

  // Normalize escaped newlines to actual newlines
  const normalizedPrompts = rawPrompts.replace(/\\n/g, "\n");

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

/**
 * Parses entity references in a prompt and replaces them with their descriptions
 * @param prompt The prompt containing entity references
 * @param storyData The story data containing entity descriptions
 * @returns The parsed prompt with entity references replaced
 */
export const parseEntityReferences = (prompt: string, storyData: Story | null): string => {
  if (!storyData) return prompt;
  
  // Extract all @Entity references
  // Allow alphanumeric characters and dots in entity references
  const entityReferences = prompt.match(/@[A-Za-z0-9.]+/g) || [];
  let parsedPrompt = prompt;

  console.log("[parseEntityReferences] Entity references found:", entityReferences);
  console.log("[parseEntityReferences] Input prompt:", prompt);
  console.log("[parseEntityReferences] Has character prompts:", !!storyData?.detailsPrompts?.characterPrompts);

  // Get all actual entity names from the story
  const entityNames = extractEntityNames(storyData);
  console.log("[parseEntityReferences] Available entities:", entityNames);

  // Process each entity reference
  entityReferences.forEach((ref) => {
    const entityName = ref.substring(1).trim(); // Remove @ symbol and trim
    console.log(`[parseEntityReferences] Processing entity: ${entityName}`);

    // Look for entity in character prompts
    const characterPrompts =
      storyData?.detailsPrompts?.characterPrompts || "";
    const locationPrompts = storyData?.detailsPrompts?.locationPrompts || "";
    const itemPrompts = storyData?.detailsPrompts?.itemPrompts || "";

    console.log(`[parseEntityReferences] Character prompts length:`, characterPrompts.length);
    if (characterPrompts.length > 0) {
      console.log(`[parseEntityReferences] Character prompts preview:`, characterPrompts.substring(0, 200));
    }

    // Find all entities and their descriptions
    let description = "";

    // Find the matching actual entity name
    let actualEntityName: string | null = null;
    let entityType: 'character' | 'item' | 'location' | null = null;

    // Check characters
    for (const characterName of entityNames.characters) {
      if (nameToReference(characterName) === ref) {
        actualEntityName = characterName;
        entityType = 'character';
        break;
      }
    }

    // Check items if not found in characters
    if (!actualEntityName) {
      for (const itemName of entityNames.items) {
        if (nameToReference(itemName) === ref) {
          actualEntityName = itemName;
          entityType = 'item';
          break;
        }
      }
    }

    // Check locations if not found in items
    if (!actualEntityName) {
      for (const locationName of entityNames.locations) {
        if (nameToReference(locationName) === ref) {
          actualEntityName = locationName;
          entityType = 'location';
          break;
        }
      }
    }

    console.log(`[parseEntityReferences] Found matching entity: "${actualEntityName}" of type: ${entityType}`);

    if (actualEntityName && entityType) {
      // Get the appropriate prompts section
      const promptsSection = entityType === 'character' ? characterPrompts :
                            entityType === 'item' ? itemPrompts : locationPrompts;

      // Find the description for this entity
      const entityPattern = new RegExp(
        actualEntityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "\\s*\\n+(.*?)(?=\\n\\n|$)",
        "s",
      );
      const entityMatch = promptsSection.match(entityPattern);

      if (entityMatch && entityMatch[1]) {
        description = entityMatch[1].trim();
        console.log(`[parseEntityReferences] Found ${entityType} description for ${actualEntityName}:`, description.substring(0, 100));
      }
    }



    // Replace with the actual description if found
    if (description) {
      parsedPrompt = parsedPrompt.replace(ref, description);
      console.log(`[parseEntityReferences] Replaced ${ref} with description (${description.length} chars)`);
    } else {
      console.log(
        `[parseEntityReferences] No description found for ${entityName}, keeping original reference`,
      );
    }
  });

  console.log("[parseEntityReferences] Final parsed prompt:", parsedPrompt);
  return parsedPrompt;
};
