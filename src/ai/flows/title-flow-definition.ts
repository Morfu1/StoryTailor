import {ai} from '@/ai/genkit';
import {
  GenerateTitleInputSchema,
  type GenerateTitleInput,
  GenerateTitleOutputSchema,
  type GenerateTitleOutput,
} from './generate-title-types';

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

export const generateTitleFlow = ai.defineFlow(
  {
    name: 'generateTitleFlow',
    inputSchema: GenerateTitleInputSchema,
    outputSchema: GenerateTitleOutputSchema,
  },
  async (input: GenerateTitleInput): Promise<GenerateTitleOutput> => {
    const {output} = await generateTitlePrompt(input);
    if (!output?.title) {
        // Fallback title in case the LLM fails or returns an empty title
        const promptWords = input.userPrompt.split(' ').slice(0, 5).join(' ');
        return { title: `${promptWords}... (Draft)` };
    }
    return output;
  }
);