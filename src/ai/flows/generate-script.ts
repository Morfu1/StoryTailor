'use server';

/**
 * @fileOverview A flow to generate a script for an animated video based on user input.
 *
 * - generateScript - A function that generates an animated video script.
 * - GenerateScriptInput - The input type for the generateScript function.
 * - GenerateScriptOutput - The return type for the generateScript function.
 */

import {
  type GenerateScriptInput,
  type GenerateScriptOutput,
} from './generate-script-types';
import { generateScriptFlow } from './script-flow-definition';

export async function generateScript(input: GenerateScriptInput): Promise<GenerateScriptOutput> {
  return generateScriptFlow(input);
}
