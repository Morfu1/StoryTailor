'use server';

/**
 * @fileOverview Generates a sequence of image prompts tailored to the narration based on audio duration.
 *
 * - generateImagePrompts - A function that generates image prompts for animation.
 * - GenerateImagePromptsInput - The input type for the generateImagePrompts function.
 * - GenerateImagePromptsOutput - The return type for the generateImagePrompts function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import Handlebars from 'handlebars';

// Register Handlebars helper at the module level
Handlebars.registerHelper('range', function (count) {
  const array = [];
  for (let i = 0; i < count; i++) {
    array.push(i);
  }
  return array;
});

const GenerateImagePromptsInputSchema = z.object({
  script: z.string().describe('The animation script to base the image prompts on.'),
  characterPrompts: z.string().describe('Prompts describing all characters.'),
  locationPrompts: z.string().describe('Prompts describing all locations.'),
  itemPrompts: z.string().describe('Prompts describing all items.'),
  audioDurationSeconds: z.number().describe('The duration of the narration audio in seconds.'),
  imagesPerMinute: z
    .number()
    .default(5)
    .describe('The number of images to generate per minute of audio.'),
});
export type GenerateImagePromptsInput = z.infer<typeof GenerateImagePromptsInputSchema>;

const GenerateImagePromptsOutputSchema = z.object({
  imagePrompts: z.array(z.string()).describe('The generated image prompts.'),
});
export type GenerateImagePromptsOutput = z.infer<typeof GenerateImagePromptsOutputSchema>;

export async function generateImagePrompts(
  input: GenerateImagePromptsInput
): Promise<GenerateImagePromptsOutput> {
  return generateImagePromptsFlow(input);
}

const generateImagePromptsPrompt = ai.definePrompt({
  name: 'generateImagePromptsPrompt',
  input: {schema: GenerateImagePromptsInputSchema.extend({ numImages: z.number() })}, // Add numImages to prompt input
  output: {schema: GenerateImagePromptsOutputSchema},
  prompt: `You are an expert at creating detailed and evocative image prompts for animation frames based on a given script, character descriptions, location descriptions and item descriptions. Your goal is to generate a sequence of prompts that, when used with a text-to-image model, will produce visually coherent and engaging scenes for an animation.

Instructions:

1.  Determine the number of images needed based on the audio duration and the desired images per minute.
2.  Analyze the script and identify key scenes that need to be visualized.
3.  Create a specific image prompt for each of those scenes, incorporating known character, location and item descriptions.
4.  Each prompt should include:
    *   A shot type (e.g., "Wide front shot", "Medium side shot", "Close-up at eye-level", "Wide panoramic high-angle shot")
    *   A description of the subject and its action in the scene
    *   A description of the environment.
    *   References to the character, location, and item descriptions in the format @characterName, @locationName, @itemName.


Here are the character descriptions:

{{{characterPrompts}}}

Here are the location descriptions:

{{{locationPrompts}}}

Here are the item descriptions:

{{{itemPrompts}}}

Here is the script:

{{{script}}}


Based on the script and the provided descriptions, generate {{numImages}} image prompts:

{{#each (range numImages)}}
{{@index + 1}}: 
{{/each}}
`,
  config: {
    temperature: 0.7,
    maxOutputTokens: 2048,
  },
});

const generateImagePromptsFlow = ai.defineFlow(
  {
    name: 'generateImagePromptsFlow',
    inputSchema: GenerateImagePromptsInputSchema,
    outputSchema: GenerateImagePromptsOutputSchema,
  },
  async input => {
    const numImages = Math.ceil(input.audioDurationSeconds * (input.imagesPerMinute / 60));

    const {output} = await generateImagePromptsPrompt({
      ...input,
      numImages,
    });

    // The output schema expects an array of strings for imagePrompts.
    // If the LLM returns a single string with prompts separated by newlines (or numbered lines),
    // we need to parse it into an array.
    // Assuming the prompt output is structured like:
    // 1: Prompt 1 text
    // 2: Prompt 2 text
    // ...
    // Or if it directly returns an array in the output object that matches the schema.
    // The current schema specifies `output: {schema: GenerateImagePromptsOutputSchema}`,
    // so the LLM should attempt to return an object like `{ imagePrompts: ["prompt1", "prompt2"] }`.
    
    let imagePromptsArray: string[] = [];

    if (output && Array.isArray(output.imagePrompts)) {
        imagePromptsArray = output.imagePrompts.filter(prompt => typeof prompt === 'string' && prompt.trim() !== '');
    } else if (output && typeof (output as any) === 'string') { 
      // Fallback if the LLM returns a single string instead of the structured output
      // This might happen if the LLM doesn't fully adhere to the output schema instructions.
      const rawStringOutput = (output as any) as string;
      imagePromptsArray = rawStringOutput
        .split(/\n\d+:\s*|\n-\s*/) // Split by newline followed by number and colon, or newline and dash
        .map(prompt => prompt.trim())
        .filter(prompt => prompt.length > 0);
    } else if (output && output.imagePrompts && typeof output.imagePrompts === 'string') {
        // If imagePrompts is a single string with newlines
        imagePromptsArray = (output.imagePrompts as string)
          .split(/\n\d+:\s*|\n-\s*/)
          .map(prompt => prompt.trim())
          .filter(prompt => prompt.length > 0);
    }


    // Ensure we adhere to the output schema even if parsing fails or returns unexpected structure
    if (!imagePromptsArray || imagePromptsArray.length === 0) {
        // Log an issue or return a specific error structure if needed,
        // for now, returning an empty array to satisfy the schema.
        console.warn("Image prompt generation resulted in an empty or unparseable list.");
        return { imagePrompts: [] };
    }
    
    return {imagePrompts: imagePromptsArray};
  }
);
