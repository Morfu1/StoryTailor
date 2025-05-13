
'use server';

/**
 * @fileOverview A flow to generate a catchy and concise title for a story based on a user prompt.
 *
 * - generateTitle - A function that generates a story title.
 * - GenerateTitleInput - The input type for the generateTitle function.
 * - GenerateTitleOutput - The return type for the generateTitle function.
 */

import {ai} from '@/ai/genkit';
import {z}from 'genkit';

const GenerateTitleInputSchema = z.object({
  userPrompt: z
    .string()
    .describe(
      'The user-provided prompt or summary of the story idea.'
    ),
});
export type GenerateTitleInput = z.infer<typeof GenerateTitleInputSchema>;

const GenerateTitleOutputSchema = z.object({
  title: z
    .string()
    .describe('A short, catchy, and relevant title for the story, under 10 words.'),
});
export type GenerateTitleOutput = z.infer<typeof GenerateTitleOutputSchema>;

export async function generateTitle(input: GenerateTitleInput): Promise<GenerateTitleOutput> {
  return generateTitleFlow(input);
}

const generateTitlePrompt = ai.definePrompt({
  name: 'generateTitlePrompt',
  input: {schema: GenerateTitleInputSchema},
  output: {schema: GenerateTitleOutputSchema},
  prompt: `You are an expert at creating catchy and concise titles for stories.
Based on the user's story prompt, generate a short title (ideally 3-7 words, maximum 10 words) that captures the essence of the story.
The title should be engaging and appropriate for a story.

User Prompt:
"{{userPrompt}}"

Generated Title:`,
});

const generateTitleFlow = ai.defineFlow(
  {
    name: 'generateTitleFlow',
    inputSchema: GenerateTitleInputSchema,
    outputSchema: GenerateTitleOutputSchema,
  },
  async input => {
    const {output} = await generateTitlePrompt(input);
    if (!output?.title) {
        // Fallback title in case the LLM fails or returns an empty title
        const promptWords = input.userPrompt.split(' ').slice(0, 5).join(' ');
        return { title: `${promptWords}... (Draft)` };
    }
    return output;
  }
);

