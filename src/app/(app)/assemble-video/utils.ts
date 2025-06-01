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
  // type: "Character" | "Item" | "Location", // Unused parameter
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
  
  // Allow alphanumeric characters and dots in entity references.
  // Ensures that a trailing period (sentence punctuation) isn't captured as part of the name.
  const entityRegex = /@([A-Za-z0-9]+(?:[.][A-Za-z0-9]+)*)/g;

  console.log("[parseEntityReferences] Input prompt:", prompt);
  console.log("[parseEntityReferences] Has character prompts:", !!storyData?.detailsPrompts?.characterPrompts);

  const entityNames = extractEntityNames(storyData);
  console.log("[parseEntityReferences] Available entities:", entityNames);

  const characterPrompts = storyData?.detailsPrompts?.characterPrompts || "";
  const locationPrompts = storyData?.detailsPrompts?.locationPrompts || "";
  const itemPrompts = storyData?.detailsPrompts?.itemPrompts || "";

  const parsedPrompt = prompt.replace(entityRegex, (matchedRef, capturedName) => {
    const originalRef = `@${capturedName}`; // Reconstruct the full @reference
    console.log(`[parseEntityReferences] Processing entity reference: ${originalRef} (captured name: ${capturedName})`);

    let description = "";
    let actualEntityName: string | null = null;
    let entityType: 'character' | 'item' | 'location' | null = null;

    // Check characters
    for (const charName of entityNames.characters) {
      const generatedRef = nameToReference(charName);
      console.log(`[DEBUG] Comparing prompt ref "${originalRef}" (lowercase: "${originalRef.toLowerCase()}") with generated ref "${generatedRef}" (lowercase: "${generatedRef.toLowerCase()}") for character "${charName}" (Original: "${charName}")`);
      if (generatedRef.toLowerCase() === originalRef.toLowerCase()) {
        actualEntityName = charName;
        entityType = 'character';
        break;
      }
    }

    // Check items if not found
    if (!actualEntityName) {
      for (const itemName of entityNames.items) {
        const generatedRef = nameToReference(itemName);
        console.log(`[DEBUG] Comparing prompt ref "${originalRef}" (lowercase: "${originalRef.toLowerCase()}") with generated ref "${generatedRef}" (lowercase: "${generatedRef.toLowerCase()}") for item "${itemName}" (Original: "${itemName}")`);
        if (generatedRef.toLowerCase() === originalRef.toLowerCase()) {
          actualEntityName = itemName;
          entityType = 'item';
          break;
        }
      }
    }

    // Check locations if not found
    if (!actualEntityName) {
      for (const locName of entityNames.locations) {
        const generatedRef = nameToReference(locName);
        console.log(`[DEBUG] Comparing prompt ref "${originalRef}" (lowercase: "${originalRef.toLowerCase()}") with generated ref "${generatedRef}" (lowercase: "${generatedRef.toLowerCase()}") for location "${locName}" (Original: "${locName}")`);
        if (generatedRef.toLowerCase() === originalRef.toLowerCase()) {
          actualEntityName = locName;
          entityType = 'location';
          break;
        }
      }
    }

    console.log(`[parseEntityReferences] For ref "${originalRef}", found matching entity: "${actualEntityName}" of type: ${entityType}`);

    if (actualEntityName && entityType) {
      const promptsSection = entityType === 'character' ? characterPrompts :
                            entityType === 'item' ? itemPrompts : locationPrompts;
      const entityPattern = new RegExp(
        actualEntityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "\\s*\\n+(.*?)(?=\\n\\n|$)",
        "s",
      );
      const entityMatch = promptsSection.match(entityPattern);
      if (entityMatch && entityMatch[1]) {
        description = entityMatch[1].trim();
        console.log(`[parseEntityReferences] Found ${entityType} description for ${actualEntityName}: "${description.substring(0, 100)}..."`);
      }
    }

    if (description) {
      console.log(`[parseEntityReferences] Replacing "${originalRef}" with description (${description.length} chars)`);
      return description; // Return the description for replacement
    } else {
      console.log(`[parseEntityReferences] No description found for "${originalRef}", keeping original reference.`);
      return originalRef; // Return the original reference if no description found
    }
  });

  console.log("[parseEntityReferences] Final parsed prompt:", parsedPrompt);
  return parsedPrompt;
};
