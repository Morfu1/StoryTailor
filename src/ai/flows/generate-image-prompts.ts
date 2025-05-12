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

// Register Handlebars helper at the module level (though not strictly used in the revised prompt, kept for potential future use or other prompts)
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
  imagePrompts: z.array(z.string()).describe('The generated image prompts as an array of strings.'),
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
  prompt: `You are an expert at creating detailed and evocative image prompts for animation frames based on a given script, character descriptions, location descriptions, and item descriptions. Your goal is to generate a sequence of prompts that, when used with a text-to-image model, will produce visually coherent and engaging scenes for an animation.

Instructions:
1.  Analyze the script and identify {{numImages}} key scenes that need to be visualized.
2.  For each scene, create a specific image prompt.
3.  Each image prompt should include:
    *   A shot type (e.g., "Wide front shot", "Medium side shot", "Close-up at eye-level", "Wide panoramic high-angle shot").
    *   A description of the subject and its action in the scene.
    *   A description of the environment.
    *   References to the character, location, and item descriptions using the format @characterName, @locationName, or @itemName where appropriate. Use the exact names provided in the descriptions.

Character Descriptions:
{{{characterPrompts}}}

Location Descriptions:
{{{locationPrompts}}}

Item Descriptions:
{{{itemPrompts}}}

Script:
{{{script}}}

Based on the script and the provided descriptions, generate exactly {{numImages}} image prompts.
Return your response as a JSON object with a single key "imagePrompts". The value of "imagePrompts" MUST be an array of strings, where each string is one of the generated image prompts.
Ensure the array contains exactly {{numImages}} prompt strings. Each string in the array should be a complete, detailed prompt suitable for a text-to-image model.
`,
  config: {
    temperature: 0.7,
    maxOutputTokens: 2048, // Increased slightly in case of very detailed prompts
  },
});

const generateImagePromptsFlow = ai.defineFlow(
  {
    name: 'generateImagePromptsFlow',
    inputSchema: GenerateImagePromptsInputSchema,
    outputSchema: GenerateImagePromptsOutputSchema,
  },
  async input => {
    const numImages = Math.max(1, Math.ceil(input.audioDurationSeconds * (input.imagesPerMinute / 60))); // Ensure at least 1 image if duration > 0

    const {output} = await generateImagePromptsPrompt({
      ...input,
      numImages,
    });
    
    let imagePromptsArray: string[] = [];

    if (output && Array.isArray(output.imagePrompts)) {
        imagePromptsArray = output.imagePrompts.map(prompt => String(prompt).trim()).filter(prompt => prompt !== '');
    } else {
        // This block might be hit if the LLM fails to adhere to the JSON object structure
        // despite the prompt and output schema.
        console.warn("Image prompt generation did not return the expected array structure. Output:", output);
        // Attempt to parse if `output` itself is a string (less likely with schema adherence)
        if (typeof output === 'string') {
             imagePromptsArray = (output as string)
            .split(/\n\d+:\s*|\n-\s*|\n\n/) // Split by newline, number and colon, or newline and dash, or double newline
            .map(prompt => prompt.trim())
            .filter(prompt => prompt.length > 0 && !/^\d+:\s*$/.test(prompt) && !/^-\s*$/.test(prompt) ); // Filter out empty or only-marker lines
        } else if (output && typeof (output as any).imagePrompts === 'string') {
            // If imagePrompts field is a string with newlines
             imagePromptsArray = ((output as any).imagePrompts as string)
            .split(/\n\d+:\s*|\n-\s*|\n\n/)
            .map(prompt => prompt.trim())
            .filter(prompt => prompt.length > 0 && !/^\d+:\s*$/.test(prompt) && !/^-\s*$/.test(prompt) );
        }
    }

    // Ensure we adhere to the output schema even if parsing fails or returns unexpected structure
    if (!imagePromptsArray || imagePromptsArray.length === 0) {
        console.warn("Image prompt generation resulted in an empty or unparseable list even after fallbacks.");
        // Consider throwing an error here if an empty list is unacceptable
        // For now, returning an empty array to satisfy the schema.
        // throw new Error("Failed to generate a valid list of image prompts.");
        return { imagePrompts: [] }; 
    }
    
    return {imagePrompts: imagePromptsArray};
  }
);
