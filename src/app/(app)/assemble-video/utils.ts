import type { Story } from "@/types/story";

// Interface for parsed prompts
export interface ParsedPrompt {
  name?: string;
  description: string;
  originalIndex: number;
}

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

/**
 * Parses entity references in a prompt and replaces them with their descriptions
 * @param prompt The prompt containing entity references
 * @param storyData The story data containing entity descriptions
 * @returns The parsed prompt with entity references replaced
 */
export const parseEntityReferences = (prompt: string, storyData: Story | null): string => {
  if (!storyData) return prompt;
  
  // Extract all @Entity references (including spaces and special characters)
  const entityReferences =
    prompt.match(/@[A-Za-z0-9]+(?:\\s+[A-Za-z0-9]+)*/g) || [];
  let parsedPrompt = prompt;

  console.log("Entity references found:", entityReferences);

  // Process each entity reference
  entityReferences.forEach((ref) => {
    const entityName = ref.substring(1).trim(); // Remove @ symbol and trim
    console.log(`Processing entity: ${entityName}`);

    // Look for entity in character prompts
    const characterPrompts =
      storyData?.detailsPrompts?.characterPrompts || "";
    const locationPrompts = storyData?.detailsPrompts?.locationPrompts || "";
    const itemPrompts = storyData?.detailsPrompts?.itemPrompts || "";

    // Find all entities and their descriptions
    let description = "";

    // Extract character descriptions based on the screenshot format
    // Format: "Character Prompts: NAME A description..."
    if (characterPrompts.includes(entityName)) {
      // Try to find the character description following "Character Prompts:"
      // Pattern: look for the exact name followed by a description
      const characterPattern = new RegExp(
        entityName + "\\s+(.*?)(?=\\n\\n|$)",
        "s",
      );
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
      const locationPattern = new RegExp(
        entityName + "\\s+(.*?)(?=\\n\\n|$)",
        "s",
      );
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
      const itemPattern = new RegExp(
        entityName + "\\s+(.*?)(?=\\n\\n|$)",
        "s",
      );
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
      console.log(
        `No description found for ${entityName}, keeping original reference`,
      );
    }
  });

  console.log("Final parsed prompt:", parsedPrompt);
  return parsedPrompt;
};
