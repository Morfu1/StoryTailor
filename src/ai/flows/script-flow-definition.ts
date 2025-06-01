import {ai} from '@/ai/genkit';
import {
  GenerateScriptInputSchema,
  type GenerateScriptInput,
  GenerateScriptOutputSchema,
  type GenerateScriptOutput,
} from './generate-script-types';

const generateScriptPrompt = ai.definePrompt({
  name: 'generateScriptPrompt',
  input: {schema: GenerateScriptInputSchema},
  output: {schema: GenerateScriptOutputSchema},
  prompt: `You are a script writer for animated videos. Your task is to generate a script based on the user's prompt.
The script should be engaging for both children and adults, and should follow the themes, character descriptions, and story twists provided in the prompt.
Importantly, the entire script must be written from the perspective of a single narrator. Do not include character dialogues unless the narrator is quoting them. The narrative should flow as if one person is telling the entire story.
Ensure the script maintains a specific word count for optimal engagement.

User Prompt: {{{prompt}}}

Generated Script (for single narrator):`,
});

export const generateScriptFlow = ai.defineFlow(
  {
    name: 'generateScriptFlow',
    inputSchema: GenerateScriptInputSchema,
    outputSchema: GenerateScriptOutputSchema,
  },
  async (input: GenerateScriptInput): Promise<GenerateScriptOutput> => {
    const {output} = await generateScriptPrompt(input);
    return output!;
  }
);