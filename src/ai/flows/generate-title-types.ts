import {z} from 'genkit';

export const GenerateTitleInputSchema = z.object({
  userPrompt: z
    .string()
    .describe(
      'The user-provided prompt or summary of the story idea.'
    ),
});
export type GenerateTitleInput = z.infer<typeof GenerateTitleInputSchema>;

export const GenerateTitleOutputSchema = z.object({
  title: z
    .string()
    .describe('A short, catchy, and relevant title for the story, under 10 words.'),
});
export type GenerateTitleOutput = z.infer<typeof GenerateTitleOutputSchema>;