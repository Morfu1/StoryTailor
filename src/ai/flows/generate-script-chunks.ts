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
    prompt: `You are an expert script editor. Your task is to split the following story script into meaningful chunks. These chunks will be used for generating narration audio and corresponding images for an animated story.

Instructions:
1.  Read the entire script carefully to understand the narrative flow, scenes, and logical breaks.
2.  Split the script into a sequence of text chunks.
3.  Each chunk MUST represent a complete thought or a small, self-contained part of a scene. Ensure sentences are not cut off mid-way.
4.  Prioritize splitting at natural breaks in dialogue, action, or scene changes.
5.  Aim for chunks that are suitable for a single narration segment and a single accompanying image. This means chunks shouldn't be too long or too short. A typical chunk might be 1-3 sentences.
6.  The example provided by the user had a story split into 14 chunks. Use this as a general guideline for the granularity of splitting, but adapt to the specific script's length and content.

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