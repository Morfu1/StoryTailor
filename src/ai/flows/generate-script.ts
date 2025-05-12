'use server';

/**
 * @fileOverview A flow to generate a script for an animated video based on user input.
 *
 * - generateScript - A function that generates an animated video script.
 * - GenerateScriptInput - The input type for the generateScript function.
 * - GenerateScriptOutput - The return type for the generateScript function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateScriptInputSchema = z.object({
  prompt: z
    .string()
    .describe(
      'A detailed prompt including themes, character descriptions, and story twists for the animated video script.'
    ),
});
export type GenerateScriptInput = z.infer<typeof GenerateScriptInputSchema>;

const GenerateScriptOutputSchema = z.object({
  script: z
    .string()
    .describe('The generated script for the animated video, tailored for children and adults.'),
});
export type GenerateScriptOutput = z.infer<typeof GenerateScriptOutputSchema>;

export async function generateScript(input: GenerateScriptInput): Promise<GenerateScriptOutput> {
  return generateScriptFlow(input);
}

const generateScriptPrompt = ai.definePrompt({
  name: 'generateScriptPrompt',
  input: {schema: GenerateScriptInputSchema},
  output: {schema: GenerateScriptOutputSchema},
  prompt: `You are a script writer for animated videos. Your task is to generate a script based on the user's prompt. The script should be engaging for both children and adults, and should follow the themes, character descriptions, and story twists provided in the prompt. Ensure the script maintains a specific word count for optimal engagement.

User Prompt: {{{prompt}}}

Generated Script:`, //Just generate a script.
});

const generateScriptFlow = ai.defineFlow(
  {
    name: 'generateScriptFlow',
    inputSchema: GenerateScriptInputSchema,
    outputSchema: GenerateScriptOutputSchema,
  },
  async input => {
    const {output} = await generateScriptPrompt(input);
    return output!;
  }
);
