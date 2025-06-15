import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {
  GenerateCharacterPromptsInputSchema,
  type GenerateCharacterPromptsInput,
  GenerateCharacterPromptsOutputSchema,
  type GenerateCharacterPromptsOutput,
} from './generate-character-prompts-types';

const prompt = ai.definePrompt({
  name: 'generateCharacterPromptsPrompt',
  input: {schema: GenerateCharacterPromptsInputSchema.extend({
    stylePrompt: z.string().optional().describe('Style characteristics to incorporate into descriptions.'),
  })},
  output: {schema: GenerateCharacterPromptsOutputSchema},
  prompt: `You are an expert prompt engineer specializing in creating descriptions for text-to-image AI models (like DALL-E, Midjourney, or Flux Dex model).
Based on the following story script, generate detailed visual descriptions for ALL characters, items, and locations mentioned in the script - including main characters, background characters, creatures, groups, objects, and places.
These descriptions will be used as prompts for an AI image generator to create visuals for the story.

{{#if stylePrompt}}
**ARTISTIC STYLE REQUIREMENTS:**
Incorporate these style characteristics into all descriptions: {{{stylePrompt}}}
Ensure that character, item, and location descriptions align with this artistic style while maintaining their unique features.
{{/if}}

Script:
{{{script}}}

{{#if chunks}}
**NARRATION CHUNKS:**
{{#each chunks}}
Chunk {{@index}}: "{{this}}"
{{/each}}
{{/if}}

**CRITICAL REQUIREMENT - COMPLETE ENTITY EXTRACTION:**
You MUST extract and create prompts for EVERY character, creature, group, item, and location mentioned anywhere in the script AND in the narration chunks above. This includes:
- Main protagonists and antagonists
- Background characters, side characters, minor characters
- Creatures, animals, mythical beings, groups (like "elder griffins", "village children", "forest animals")
- All items, objects, tools, magical items mentioned
- All locations, places, settings, rooms, landscapes mentioned

**ANALYSIS PROCESS:**
1. First, read through the entire script to identify all entities
2. Then, carefully examine each narration chunk for additional entities, details, or variations
3. Create comprehensive descriptions that cover ALL entities found in both script and chunks

If you miss ANY entity that appears in the script OR chunks, the image generation system will break. Be exhaustive.

**CRITICAL FORMATTING REQUIREMENTS:**
Your output MUST follow this EXACT format. Do NOT use asterisks (*) or other formatting symbols. Use ONLY plain text.

Instructions for output:
1.  For each category (Characters, Items, Locations), provide a heading (e.g., "Character Prompts:", "Item Prompts:", "Location Prompts:"). This heading MUST be part of the string for that category and appear at the very beginning of that category's section.
2.  Under each heading, list the entities. For each entity:
    *   **First line:** The EXACT name of the character, item, or location in plain text (NO asterisks, NO formatting symbols). Names should be easy to convert to @ references (e.g., "Rosie Recycle" → @RosieRecycle, "Old Man Grumbles" → @OldManGrumbles, "Magic Sword" → @MagicSword).
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

**EXACT FORMAT EXAMPLE:**
Follow this format PRECISELY. Do NOT add asterisks, formatting symbols, or extra text:

Character Prompts:
Ember
a tiny house cat-sized dragon with dull smoky grey scales, large hopeful bright orange eyes, small crumpled wings, a perpetually worried expression, blunt claws and tiny teeth

Ignis
an ancient wise dragon with cooled lava-colored scales cracked and weathered with age, glowing inner fire eyes, long braided beard with glittering obsidian beads, carrying a gnarled staff of petrified wood

Elder Griffins
massive ancient flying creatures with weathered golden feathers streaked with silver, piercing amber eyes full of ancient wisdom, powerful talons and broad wings that span great distances

**WRONG FORMAT EXAMPLES (DO NOT DO THIS):**
❌ Character: **
❌ Character Prompt 4: **
❌ **Ember**
❌ Character: Ember

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

export const generateCharacterPromptsFlow = ai.defineFlow(
  {
    name: 'generateCharacterPromptsFlow',
    inputSchema: GenerateCharacterPromptsInputSchema,
    outputSchema: GenerateCharacterPromptsOutputSchema,
  },
  async (input: GenerateCharacterPromptsInput): Promise<GenerateCharacterPromptsOutput> => {
    // Get style prompt if style ID is provided
    let stylePrompt: string | undefined;
    if (input.imageStyleId) {
      try {
        const { getStylePromptForProvider } = await import('@/utils/imageStyleUtils');
        stylePrompt = getStylePromptForProvider(input.imageStyleId as string, input.imageProvider);
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