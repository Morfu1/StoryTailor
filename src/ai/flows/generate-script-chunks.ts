'use server';

/**
 * @fileOverview Intelligently splits a story script into meaningful chunks for narration and image generation.
 *
 * - generateScriptChunks - An AI flow that splits a script.
 * - GenerateScriptChunksInput - The input type for the function.
 * - GenerateScriptChunksOutput - The output type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateScriptChunksInputSchema = z.object({
  script: z.string().describe('The full story script to be split into chunks.'),
  // Optional: Add a hint for the desired number of chunks if needed, e.g., based on story length or user preference.
  // targetChunkCount: z.number().optional().describe('An approximate target number of chunks.'),
});
export type GenerateScriptChunksInput = z.infer<typeof GenerateScriptChunksInputSchema>;

const GenerateScriptChunksOutputSchema = z.object({
  scriptChunks: z.array(z.string()).describe('An array of script chunks, where each chunk is a string.'),
  error: z.string().optional().describe('An error message if splitting failed.'),
});
export type GenerateScriptChunksOutput = z.infer<typeof GenerateScriptChunksOutputSchema>;

const generateScriptChunksPrompt = ai.definePrompt(
  {
    name: 'generateScriptChunksPrompt',
    input: { schema: GenerateScriptChunksInputSchema },
    output: { schema: GenerateScriptChunksOutputSchema },
    prompt: `You are a movie director and script editor who thinks visually. Your task is to split the following story script into meaningful visual scenes/chunks. Each chunk will have a corresponding image generated and narration audio, so think like you're creating an animated storybook.

Think like a movie director analyzing a script:
- What would each scene look like visually?
- Where are the natural visual transitions?
- What moments need their own "frame" or "shot"?
- How can you group sentences that paint the same visual picture?

Instructions:
1. Read the entire script and visualize it as an animated story with scenes.
2. Split into chunks that represent distinct visual scenes or moments - NOT sentence by sentence.
3. Each chunk should paint a clear, cohesive visual picture that an AI can generate as a single image.
4. Group related sentences together if they describe the same scene, character introduction, or visual moment.
5. Aim for chunks that are suitable for a single narration segment and a single accompanying image. This means chunks shouldn't be too long or too short.
6. Each chunk should be 1-3 sentences, but prioritize visual coherence over sentence count.

Script to split:
{{{script}}}

Return your response as a JSON object with a single key "scriptChunks". The value of "scriptChunks" MUST be an array of strings, where each string is one of the generated script chunks. Do not include numbering or any other formatting within the chunk strings themselves.
Example of a good split for a segment:
Original: "Lilly's eyes sparkled. 'Does the Rainbow Route have puddles?!' 'Oh, yes,' Mama Duck chuckled, 'plenty of puddles. But it’s also full of surprises.'"
Split into:
- "Lilly’s eyes sparkled. ‘Does the Rainbow Route have puddles?!’"
- "‘Oh, yes,’ Mama Duck chuckled, ‘plenty of puddles. But it’s also full of surprises.’"
`,
    config: {
      temperature: 0.3, // Lower temperature for more deterministic and structured output
      maxOutputTokens: 2048, 
    },
  }
);

export async function generateScriptChunks(
  input: GenerateScriptChunksInput
): Promise<GenerateScriptChunksOutput> {
  try {
    const { output } = await generateScriptChunksPrompt(input);
    if (output && output.scriptChunks && Array.isArray(output.scriptChunks)) {
      // Filter out any empty strings that might be returned
      const nonEmptyChunks = output.scriptChunks.filter(chunk => chunk.trim().length > 0);
      return { scriptChunks: nonEmptyChunks };
    }
    console.error('AI did not return the expected scriptChunks array:', output);
    return { scriptChunks: [], error: 'Failed to parse script chunks from AI response.' };
  } catch (error) {
    console.error('Error in generateScriptChunks AI flow:', error);
    return { scriptChunks: [], error: 'An error occurred while splitting the script with AI.' };
  }
}