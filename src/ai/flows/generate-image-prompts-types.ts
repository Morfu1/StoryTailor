import {z} from 'genkit';

export const GenerateImagePromptsInputSchema = z.object({
  script: z.string().describe('The animation script to base the image prompts on.'),
  characterPrompts: z.string().describe('Prompts describing all characters.'),
  locationPrompts: z.string().describe('Prompts describing all locations.'),
  itemPrompts: z.string().describe('Prompts describing all items.'),
  audioDurationSeconds: z.number().describe('The duration of the narration audio in seconds.'),
  narrationChunks: z.array(z.object({
    text: z.string(),
    duration: z.number(),
    audioUrl: z.string().optional(),
  })).optional().describe('Array of narration chunks with text and duration.'),
  imageProvider: z.enum(['picsart', 'gemini', 'imagen3']).default('picsart').describe('The AI provider for image generation.'),
  isPicsart: z.boolean().optional().describe('Whether the image provider is PicsArt.'),
});
export type GenerateImagePromptsInput = z.infer<typeof GenerateImagePromptsInputSchema>;

export const GenerateImagePromptsOutputSchema = z.object({
  imagePrompts: z.array(z.string()).describe('The generated image prompts as an array of strings.'),
  actionPrompts: z.array(z.string()).describe('Simple action descriptions for character movements in each scene.'),
});
export type GenerateImagePromptsOutput = z.infer<typeof GenerateImagePromptsOutputSchema>;