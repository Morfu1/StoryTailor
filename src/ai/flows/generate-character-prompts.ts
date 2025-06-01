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

import {
  type GenerateCharacterPromptsInput,
  type GenerateCharacterPromptsOutput,
} from './generate-character-prompts-types';
import { generateCharacterPromptsFlow } from './character-prompts-flow-definition';

export async function generateCharacterPrompts(
  input: GenerateCharacterPromptsInput
): Promise<GenerateCharacterPromptsOutput> {
  return generateCharacterPromptsFlow(input);
}

