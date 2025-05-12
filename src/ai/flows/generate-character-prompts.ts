// Use server directive
'use server';

/**
 * @fileOverview Generates character, item, and location prompts based on a given script.
 *
 * - generateCharacterPrompts - A function that generates character, item, and location prompts.
 * - GenerateCharacterPromptsInput - The input type for the generateCharacterPrompts function.
 * - GenerateCharacterPromptsOutput - The output type for the generateCharacterPrompts function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateCharacterPromptsInputSchema = z.object({
  script: z.string().describe('The main script of the story.'),
});
export type GenerateCharacterPromptsInput = z.infer<typeof GenerateCharacterPromptsInputSchema>;

const GenerateCharacterPromptsOutputSchema = z.object({
  characterPrompts: z.string().describe('Prompts for the characters in the story.'),
  itemPrompts: z.string().describe('Prompts for the items in the story.'),
  locationPrompts: z.string().describe('Prompts for the locations in the story.'),
});
export type GenerateCharacterPromptsOutput = z.infer<typeof GenerateCharacterPromptsOutputSchema>;

export async function generateCharacterPrompts(
  input: GenerateCharacterPromptsInput
): Promise<GenerateCharacterPromptsOutput> {
  return generateCharacterPromptsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCharacterPromptsPrompt',
  input: {schema: GenerateCharacterPromptsInputSchema},
  output: {schema: GenerateCharacterPromptsOutputSchema},
  prompt: `You are a creative assistant helping to generate prompts for a children's story.

  Based on the following script, generate detailed prompts for the characters, items, and locations described.

  Script: {{{script}}}

  Format your response as follows:

  Character Prompts:
  [Character prompt 1]
  [Character prompt 2]
  ...

  Item Prompts:
  [Item prompt 1]
  [Item prompt 2]
  ...

  Location Prompts:
  [Location prompt 1]
  [Location prompt 2]
  ...`,
});

const generateCharacterPromptsFlow = ai.defineFlow(
  {
    name: 'generateCharacterPromptsFlow',
    inputSchema: GenerateCharacterPromptsInputSchema,
    outputSchema: GenerateCharacterPromptsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
