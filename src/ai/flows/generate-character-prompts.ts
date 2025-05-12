// Use server directive
'use server';

/**
 * @fileOverview Generates character, item, and location prompts based on a given script,
 * formatted as visual descriptions for text-to-image AI models.
 *
 * - generateCharacterPrompts - A function that generates character, item, and location visual prompts.
 * - GenerateCharacterPromptsInput - The input type for the generateCharacterPrompts function.
 * - GenerateCharacterPromptsOutput - The output type for the generateCharacterPrompts function.
 */

import {ai} from '@/ai/genkit';
import {z}from 'genkit';

const GenerateCharacterPromptsInputSchema = z.object({
  script: z.string().describe('The main script of the story.'),
});
export type GenerateCharacterPromptsInput = z.infer<typeof GenerateCharacterPromptsInputSchema>;

const GenerateCharacterPromptsOutputSchema = z.object({
  characterPrompts: z.string().describe('A string containing visual descriptions for characters, formatted for text-to-image models. Each character entry starts with its name on a new line, followed by its description on subsequent lines. Entities are separated by a blank line. Example: "Character Prompts:\\nEmber\\nA tiny, house cat-sized dragon...\\n\\nIgnis\\nAn ancient, wise dragon..."'),
  itemPrompts: z.string().describe('A string containing visual descriptions for items, formatted for text-to-image models. Each item entry starts with its name on a new line, followed by its description. Entities are separated by a blank line. Example: "Item Prompts:\\nGnarled Staff\\nA staff made of dark, petrified wood..."'),
  locationPrompts: z.string().describe('A string containing visual descriptions for locations, formatted for text-to-image models. Each location entry starts with its name on a new line, followed by its description. Entities are separated by a blank line. Example: "Location Prompts:\\nDesolate Village\\nA small, somber village..."'),
});
export type GenerateCharacterPromptsOutput = z.infer<typeof GenerateCharacterPromptsOutputSchema>;

export async function generateCharacterPrompts(
  input: GenerateCharacterPromptsInput
): Promise<GenerateCharacterPromptsOutput> {
  return generateCharacterPromptsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCharacterPromptsPrompt',
  input: {schema: GenerateCharacterPromptsInputSchema},
  output: {schema: GenerateCharacterPromptsOutputSchema},
  prompt: `You are an expert prompt engineer specializing in creating descriptions for text-to-image AI models (like DALL-E, Midjourney, or Flux Dex model).
Based on the following story script, generate detailed visual descriptions for the main characters, key items, and important locations.
These descriptions will be used as prompts for an AI image generator to create visuals for the story.

Script:
{{{script}}}

Instructions for output:
1.  For each category (Characters, Items, Locations), provide a heading (e.g., "Character Prompts:", "Item Prompts:", "Location Prompts:"). This heading MUST be part of the string for that category and appear at the very beginning of that category's section.
2.  Under each heading, list the entities. For each entity:
    *   **First line:** The name of the character, item, or location. This name MUST be on its own dedicated line.
    *   **Subsequent lines:** Starting on the line immediately following the name, provide a detailed visual description suitable for a text-to-image model. Focus on visual attributes: appearance, attire, textures, colors, age, mood, specific features, and any other visual details. Be descriptive and evocative.
3.  Ensure **exactly one blank line** separates each complete entity's entry (name + description) from the next entity within the same category. Do not use more than one blank line.

Example of desired output format and style (the content below is an example of the style and formatting you should follow, generate your own content based on the script):

Character Prompts:
Ember
A tiny, house cat-sized dragon with scales of a dull, smoky grey. His eyes are large and hopeful, a bright orange color. His wings are small and slightly crumpled, and he has a perpetually worried expression. His claws are blunt and his teeth are tiny.

Ignis
An ancient, wise dragon with scales the color of cooled lava, cracked and weathered with age. His eyes glow with inner fire, and his beard is long and braided with glittering obsidian beads. He carries a gnarled staff of petrified wood.

Villagers
A group of despondent villagers, appearing pale and gaunt. Their clothes are drab and colorless, hanging loosely on their frames. Their faces are etched with sadness, and their eyes are dull and lifeless.

Item Prompts:
Gnarled Staff
A staff made of dark, petrified wood, gnarled and twisted with age. It might have a faintly glowing crystal or ancient rune carved at its tip, emitting a soft light.

Obsidian Beads
Small, polished beads of pure black obsidian, reflecting light with a glassy sheen. They could be intricately braided into a character's beard or hair, or part of a necklace.

Location Prompts:
Desolate Village
A small, somber village with simple, run-down huts made of rough-hewn wood and deteriorating thatch. The surrounding landscape is barren and dusty, perhaps with a few dead trees. A sense of gloom and despair hangs heavy in the air. Colors are muted, primarily browns, greys, and faded earth tones.

Volcanic Peak
A towering, jagged mountain, its peak perpetually wreathed in thick, dark smoke and a faint, ominous red glow from within. The slopes are steep and treacherous, covered in loose scree, sharp volcanic rock, and patches of grey ash. No vegetation is visible.

Now, generate the character, item, and location prompts based on the provided script, adhering strictly to the format, style, and level of detail exemplified above.
`,
});

const generateCharacterPromptsFlow = ai.defineFlow(
  {
    name: 'generateCharacterPromptsFlow',
    inputSchema: GenerateCharacterPromptsInputSchema,
    outputSchema: GenerateCharacterPromptsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    // Ensure the output is not null and adheres to the schema.
    // The LLM should return an object with characterPrompts, itemPrompts, and locationPrompts strings.
    if (!output || typeof output.characterPrompts !== 'string' || typeof output.itemPrompts !== 'string' || typeof output.locationPrompts !== 'string') {
        // Fallback or error handling if the LLM output is not as expected.
        // For simplicity, returning potentially partial or empty results, but logging an error.
        console.error("LLM output for generateCharacterPromptsFlow did not match the expected schema:", output);
        return {
            characterPrompts: output?.characterPrompts || "",
            itemPrompts: output?.itemPrompts || "",
            locationPrompts: output?.locationPrompts || "",
        };
    }
    return output;
  }
);

