import { z } from 'zod';

// Import Original Schemas to be extended or used as fallbacks
import {
  GenerateCharacterPromptsInputSchema as AICharacterPromptsInputSchemaOriginal,
  GenerateCharacterPromptsOutputSchema as AICharacterPromptsOutputSchemaOriginal
} from '@/ai/flows/generate-character-prompts-types';

import {
  GenerateImagePromptsInputSchema as AIImagePromptsInputSchemaOriginal,
  GenerateImagePromptsOutputSchema as AIImagePromptsOutputSchemaOriginal
} from '@/ai/flows/generate-image-prompts-types';

import {
  GenerateScriptInputSchema as AIScriptInputSchemaOriginal,
  GenerateScriptOutputSchema as AIScriptOutputSchemaOriginal
} from '@/ai/flows/generate-script-types';

import {
  GenerateTitleInputSchema as AITitleInputSchemaOriginal,
  GenerateTitleOutputSchema as AITitleOutputSchemaOriginal
} from '@/ai/flows/generate-title-types';

import {
  GenerateScriptChunksInputSchema as AIScriptChunksInputSchemaOriginal,
  GenerateScriptChunksOutputSchema as AIScriptChunksOutputSchemaOriginal
} from '@/ai/flows/generate-script-chunks-types';

// Title Schemas
export const AITitleInputSchema = AITitleInputSchemaOriginal || z.object({
  userPrompt: z.string().describe('The user-provided prompt or summary of the story idea.')
});
export const AITitleOutputSchema = AITitleOutputSchemaOriginal || z.object({
  title: z.string().describe('A short, catchy, and relevant title for the story, under 10 words.')
});
export const GenerateTitleInputServerSchema = AITitleInputSchema.extend({
  userId: z.string(),
  aiProvider: z.enum(['google', 'perplexity']).optional(),
  perplexityModel: z.string().optional(),
  googleScriptModel: z.string().optional(),
});
export type GenerateTitleInput = z.infer<typeof GenerateTitleInputServerSchema>;

// Script Schemas
export const AIScriptInputSchema = AIScriptInputSchemaOriginal || z.object({
  prompt: z.string().describe('A detailed prompt including themes, character descriptions, and story twists for the animated video script.')
});
export const AIScriptOutputSchema = AIScriptOutputSchemaOriginal || z.object({
  script: z.string().describe('The generated script for the animated video, tailored for children and adults, and narrated by a single voice.')
});
export const GenerateScriptInputServerSchema = AIScriptInputSchema.extend({
  userId: z.string(),
  aiProvider: z.enum(['google', 'perplexity']).optional(),
  perplexityModel: z.string().optional(),
  googleScriptModel: z.string().optional(),
});
export type GenerateScriptInput = z.infer<typeof GenerateScriptInputServerSchema>;

// Character Prompts Schemas
export const AICharacterPromptsInputSchema = AICharacterPromptsInputSchemaOriginal || z.object({
  script: z.string().describe('The main script of the story.'),
  imageStyleId: z.string().optional().describe('The image style ID to apply to the visual descriptions.'),
  imageProvider: z.enum(['picsart', 'gemini', 'imagen3']).default('picsart').describe('The AI provider for image generation to tailor style prompts.'),
});
export const AICharacterPromptsOutputSchema = AICharacterPromptsOutputSchemaOriginal || z.object({
  characterPrompts: z.string().describe('Visual descriptions for characters.'),
  itemPrompts: z.string().describe('Visual descriptions for items.'),
  locationPrompts: z.string().describe('Visual descriptions for locations.'),
});
export const GenerateCharacterPromptsInputServerSchema = AICharacterPromptsInputSchema.extend({
  userId: z.string(),
  aiProvider: z.enum(['google', 'perplexity']).optional(),
  perplexityModel: z.string().optional(),
  googleScriptModel: z.string().optional(),
});
export type GenerateCharacterPromptsInput = z.infer<typeof GenerateCharacterPromptsInputServerSchema>;

// Image Prompts Schemas
export const AIImagePromptsInputSchema = AIImagePromptsInputSchemaOriginal || z.object({
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
export const AIImagePromptsOutputSchema = AIImagePromptsOutputSchemaOriginal || z.object({
  imagePrompts: z.array(z.string()).describe('The generated image prompts as an array of strings.'),
  actionPrompts: z.array(z.string()).describe('Simple action descriptions for character movements in each scene.'),
});
export const GenerateImagePromptsInputServerSchema = AIImagePromptsInputSchema.extend({
  userId: z.string(),
  aiProvider: z.enum(['google', 'perplexity']).optional(),
  perplexityModel: z.string().optional(),
  googleScriptModel: z.string().optional(),
});
export type GenerateImagePromptsInput = z.infer<typeof GenerateImagePromptsInputServerSchema>;

// Script Chunks Schemas
export const AIScriptChunksInputSchema = AIScriptChunksInputSchemaOriginal || z.object({
  script: z.string().describe('The full story script to be split into chunks.')
});
export const AIScriptChunksOutputSchema = AIScriptChunksOutputSchemaOriginal || z.object({
  scriptChunks: z.array(z.string()).describe('An array of script chunks, where each string is one of the generated script chunks.'),
  error: z.string().optional().describe('An error message if splitting failed.')
});
export const GenerateScriptChunksInputServerSchema = AIScriptChunksInputSchema.extend({
  userId: z.string(),
  aiProvider: z.enum(['google', 'perplexity']).optional(),
  perplexityModel: z.string().optional(),
  googleScriptModel: z.string().optional(),
});
export type GenerateScriptChunksInput = z.infer<typeof GenerateScriptChunksInputServerSchema>;

// Spanish Translation Schemas
export const AISpanishTranslationInputSchema = z.object({
  userId: z.string().describe('User ID for API key access'),
  chunks: z.array(z.object({
    id: z.string(),
    text: z.string(),
    index: z.number()
  })).describe('Array of English narration chunks to translate'),
  aiProvider: z.enum(['google', 'perplexity']).default('google').describe('AI provider to use for translation'),
  googleScriptModel: z.string().optional().describe('Google model for translation'),
  perplexityModel: z.string().optional().describe('Perplexity model for translation')
});

export const AISpanishTranslationOutputSchema = z.object({
  spanishChunks: z.array(z.object({
    id: z.string(),
    text: z.string(),
    index: z.number()
  })).describe('Array of Spanish translated chunks'),
  error: z.string().optional().describe('Error message if translation failed')
});

export type GenerateSpanishTranslationInput = z.infer<typeof AISpanishTranslationInputSchema>;