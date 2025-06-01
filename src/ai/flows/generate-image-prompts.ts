'use server';

/**
 * @fileOverview Generates a sequence of image prompts tailored to the narration based on audio duration.
 *
 * - generateImagePrompts - A function that generates image prompts for animation.
 * - GenerateImagePromptsInput - The input type for the generateImagePrompts function.
 * - GenerateImagePromptsOutput - The return type for the generateImagePrompts function.
 * 
 * IMPORTANT: After updating character consistency requirements, you must:
 * 1. Re-generate character prompts with specific physical traits (hair/fur color, eye color, accessories)
 * 2. Re-generate all character, location, and item images to ensure consistency
 * 3. Update existing stories to use the new consistent character descriptions
 */

import {
  type GenerateImagePromptsInput,
  type GenerateImagePromptsOutput,
} from './generate-image-prompts-types';
import { generateImagePromptsFlow } from './image-prompts-flow-definition';

export async function generateImagePrompts(
  input: GenerateImagePromptsInput
): Promise<GenerateImagePromptsOutput> {
  return generateImagePromptsFlow(input);
}
