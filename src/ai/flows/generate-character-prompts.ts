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
import {z}from 'genkit';

const GenerateCharacterPromptsInputSchema = z.object({
  script: z.string().describe('The main script of the story.'),
});
export type GenerateCharacterPromptsInput = z.infer<typeof GenerateCharacterPromptsInputSchema>;

const GenerateCharacterPromptsOutputSchema = z.object({
  characterPrompts: z.string().describe('Prompts for the characters in the story, with each character name on a new line followed by its description.'),
  itemPrompts: z.string().describe('Prompts for the items in the story, with each item name on a new line followed by its description.'),
  locationPrompts: z.string().describe('Prompts for the locations in the story, with each location name on a new line followed by its description.'),
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

For each character, item, and location, provide its name on one line, followed by its detailed description on subsequent lines. Ensure a clear separation between entries.

Format your response as follows:

Character Prompts:
[Name of Character 1]
[Description of Character 1...]

[Name of Character 2]
[Description of Character 2...]
...

Item Prompts:
[Name of Item 1]
[Description of Item 1...]

[Name of Item 2]
[Description of Item 2...]
...

Location Prompts:
[Name of Location 1]
[Description of Location 1...]

[Name of Location 2]
[Description of Location 2...]
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
