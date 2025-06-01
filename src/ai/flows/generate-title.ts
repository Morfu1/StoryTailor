
'use server';

/**
 * @fileOverview A flow to generate a catchy and concise title for a story based on a user prompt.
 *
 * - generateTitle - A function that generates a story title.
 * - GenerateTitleInput - The input type for the generateTitle function.
 * - GenerateTitleOutput - The return type for the generateTitle function.
 */

import {
  type GenerateTitleInput,
  type GenerateTitleOutput,
} from './generate-title-types';
import { generateTitleFlow } from './title-flow-definition';

export async function generateTitle(input: GenerateTitleInput): Promise<GenerateTitleOutput> {
  return generateTitleFlow(input);
}

