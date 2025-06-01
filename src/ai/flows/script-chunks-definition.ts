import {ai} from '@/ai/genkit';
import {
  GenerateScriptChunksInputSchema,
  GenerateScriptChunksOutputSchema,
} from './generate-script-chunks-types';

export const generateScriptChunksPrompt = ai.definePrompt(
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