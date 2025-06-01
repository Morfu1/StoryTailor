'use server';

/**
 * @fileOverview Intelligently splits a story script into meaningful chunks for narration and image generation.
 *
 * - generateScriptChunks - An AI flow that splits a script.
 * - GenerateScriptChunksInput - The input type for the function.
 * - GenerateScriptChunksOutput - The output type for the function.
 */

import {
  type GenerateScriptChunksInput,
  type GenerateScriptChunksOutput,
} from './generate-script-chunks-types';
import { generateScriptChunksPrompt } from './script-chunks-definition';

export async function generateScriptChunks(
  input: GenerateScriptChunksInput
): Promise<GenerateScriptChunksOutput> {
  try {
    const { output } = await generateScriptChunksPrompt(input);
    if (output && output.scriptChunks && Array.isArray(output.scriptChunks)) {
      // Filter out any empty strings that might be returned
      const nonEmptyChunks = output.scriptChunks.filter(chunk => chunk.trim().length > 0);
      return { scriptChunks: nonEmptyChunks };
    }
    console.error('AI did not return the expected scriptChunks array:', output);
    return { scriptChunks: [], error: 'Failed to parse script chunks from AI response.' };
  } catch (error) {
    console.error('Error in generateScriptChunks AI flow:', error);
    return { scriptChunks: [], error: 'An error occurred while splitting the script with AI.' };
  }
}