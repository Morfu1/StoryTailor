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
  imageStyleId: z.string().optional().describe('The image style ID to apply to the visual descriptions.'),
  imageProvider: z.enum(['picsart', 'gemini', 'imagen3']).default('picsart').describe('The AI provider for image generation to tailor style prompts.'),
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
  input: {schema: GenerateCharacterPromptsInputSchema.extend({
    stylePrompt: z.string().optional().describe('Style characteristics to incorporate into descriptions.'),
  })},
  output: {schema: GenerateCharacterPromptsOutputSchema},
  prompt: `You are an expert prompt engineer specializing in creating descriptions for text-to-image AI models (like DALL-E, Midjourney, or Flux Dex model).
Based on the following story script, generate detailed visual descriptions for the main characters, key items, and important locations.
These descriptions will be used as prompts for an AI image generator to create visuals for the story.

{{#if stylePrompt}}
**ARTISTIC STYLE REQUIREMENTS:**
Incorporate these style characteristics into all descriptions: {{{stylePrompt}}}
Ensure that character, item, and location descriptions align with this artistic style while maintaining their unique features.
{{/if}}

Script:
{{{script}}}

Instructions for output:
1.  For each category (Characters, Items, Locations), provide a heading (e.g., "Character Prompts:", "Item Prompts:", "Location Prompts:"). This heading MUST be part of the string for that category and appear at the very beginning of that category's section.
2.  Under each heading, list the entities. For each entity:
    *   **First line:** The name of the character, item, or location. Names should be easy to convert to @ references (e.g., "Rosie Recycle" → @RosieRecycle, "Old Man Grumbles" → @OldManGrumbles, "Magic Sword" → @MagicSword).
    *   **Subsequent lines:** Starting on the line immediately following the name, provide a detailed visual description suitable for a text-to-image model. This description MUST:
        *   Be entirely in **lowercase**.
        *   Be a **single sentence**.
        *   **Not end** with any punctuation marks like '.', '?', or '!'.
        *   **MANDATORY for characters**: Include specific physical traits for consistency:
            - Hair color and style (e.g., "brown hair", "blonde hair", "curly red hair", "long black hair")
            - Eye color (e.g., "blue eyes", "green eyes", "brown eyes")
            - Skin tone if relevant (e.g., "pale skin", "tan skin", "dark skin")
            - Age descriptors (e.g., "young girl", "elderly man", "teenage boy")
            - Key identifying features (clothing, accessories, distinctive marks)
        *   Focus on visual attributes: appearance, attire, textures, colors, age, mood, specific features, and any other visual details. Be descriptive and evocative.
3.  Ensure **exactly one blank line** separates each complete entity's entry (name + description) from the next entity within the same category. Do not use more than one blank line.

Example of desired output format and style (the content below is an example of the style and formatting you should follow, generate your own content based on the script):

Character Prompts:
Ember
a tiny house cat-sized dragon with dull smoky grey scales, large hopeful bright orange eyes, small crumpled wings, a perpetually worried expression, blunt claws and tiny teeth

Ignis
an ancient wise dragon with cooled lava-colored scales cracked and weathered with age, glowing inner fire eyes, long braided beard with glittering obsidian beads, carrying a gnarled staff of petrified wood

Rosie Recycle
a young girl with curly brown hair and bright green eyes, wearing goggles made from repurposed clear soda bottles, a cape fashioned from colorful recycled newspapers, pale skin with a determined expression and her outfit adorned with recycling symbols

Item Prompts:
Gnarled Staff
a staff made of dark petrified wood gnarled and twisted with age it might have a faintly glowing crystal or ancient rune carved at its tip emitting a soft light

Obsidian Beads
small polished beads of pure black obsidian reflecting light with a glassy sheen they could be intricately braided into a character's beard or hair or part of a necklace

Location Prompts:
Desolate Village
a small somber village with simple run-down huts made of rough-hewn wood and deteriorating thatch the surrounding landscape is barren and dusty perhaps with a few dead trees a sense of gloom and despair hangs heavy in the air colors are muted primarily browns greys and faded earth tones

Volcanic Peak
a towering jagged mountain its peak perpetually wreathed in thick dark smoke and a faint ominous red glow from within the slopes are steep and treacherous covered in loose scree sharp volcanic rock and patches of grey ash no vegetation is visible

Now, generate the character, item, and location prompts based on the provided script, adhering strictly to the format, style, and level of detail exemplified above. For characters, ensure you include specific physical traits (hair color/style, eye color, skin tone, age) for consistency across image generations. Use lowercase, single-sentence, no-punctuation-ending descriptions.
`,
});

const generateCharacterPromptsFlow = ai.defineFlow(
  {
    name: 'generateCharacterPromptsFlow',
    inputSchema: GenerateCharacterPromptsInputSchema,
    outputSchema: GenerateCharacterPromptsOutputSchema,
  },
  async input => {
    // Get style prompt if style ID is provided
    let stylePrompt: string | undefined;
    if (input.imageStyleId) {
      try {
        const { getStylePromptForProvider } = await import('@/utils/imageStyleUtils');
        stylePrompt = getStylePromptForProvider(input.imageStyleId as any, input.imageProvider);
        console.log('Applied style prompt for character generation:', stylePrompt);
      } catch (error) {
        console.warn('Failed to get style prompt for character generation:', error);
      }
    }

    const {output} = await prompt({
      ...input,
      stylePrompt,
    });
    
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

