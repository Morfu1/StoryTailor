import {z} from 'genkit';

export const GenerateScriptChunksInputSchema = z.object({
  script: z.string().describe('The full story script to be split into chunks.'),
  // Optional: Add a hint for the desired number of chunks if needed, e.g., based on story length or user preference.
  // targetChunkCount: z.number().optional().describe('An approximate target number of chunks.'),
});
export type GenerateScriptChunksInput = z.infer<typeof GenerateScriptChunksInputSchema>;

export const GenerateScriptChunksOutputSchema = z.object({
  scriptChunks: z.array(z.string()).describe('An array of script chunks, where each chunk is a string.'),
  error: z.string().optional().describe('An error message if splitting failed.'),
});
export type GenerateScriptChunksOutput = z.infer<typeof GenerateScriptChunksOutputSchema>;