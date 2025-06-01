import {z} from 'genkit';

export const GenerateCharacterPromptsInputSchema = z.object({
  script: z.string().describe('The main script of the story.'),
  imageStyleId: z.string().optional().describe('The image style ID to apply to the visual descriptions.'),
  imageProvider: z.enum(['picsart', 'gemini', 'imagen3']).default('picsart').describe('The AI provider for image generation to tailor style prompts.'),
});
export type GenerateCharacterPromptsInput = z.infer<typeof GenerateCharacterPromptsInputSchema>;

export const GenerateCharacterPromptsOutputSchema = z.object({
  characterPrompts: z.string().describe('A string containing visual descriptions for characters, formatted for text-to-image models. Each character entry starts with its name on a new line, followed by its description on subsequent lines. Entities are separated by a blank line. Example: "Character Prompts:\\nEmber\\nA tiny, house cat-sized dragon...\\n\\nIgnis\\nAn ancient, wise dragon..."'),
  itemPrompts: z.string().describe('A string containing visual descriptions for items, formatted for text-to-image models. Each item entry starts with its name on a new line, followed by its description. Entities are separated by a blank line. Example: "Item Prompts:\\nGnarled Staff\\nA staff made of dark, petrified wood..."'),
  locationPrompts: z.string().describe('A string containing visual descriptions for locations, formatted for text-to-image models. Each location entry starts with its name on a new line, followed by its description. Entities are separated by a blank line. Example: "Location Prompts:\\nDesolate Village\\nA small, somber village..."'),
});
export type GenerateCharacterPromptsOutput = z.infer<typeof GenerateCharacterPromptsOutputSchema>;