import {z} from 'genkit';

export const GenerateScriptInputSchema = z.object({
  prompt: z
    .string()
    .describe(
      'A detailed prompt including themes, character descriptions, and story twists for the animated video script.'
    ),
});
export type GenerateScriptInput = z.infer<typeof GenerateScriptInputSchema>;

export const GenerateScriptOutputSchema = z.object({
  script: z
    .string()
    .describe('The generated script for the animated video, tailored for children and adults, and narrated by a single voice.'),
});
export type GenerateScriptOutput = z.infer<typeof GenerateScriptOutputSchema>;