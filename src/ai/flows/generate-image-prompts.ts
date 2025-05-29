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
  narrationChunks: z.array(z.object({
    text: z.string(),
    duration: z.number(),
    audioUrl: z.string().optional(),
  })).optional().describe('Array of narration chunks with text and duration.'),
  imageProvider: z.enum(['picsart', 'gemini', 'imagen3']).default('picsart').describe('The AI provider for image generation.'),
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
  input: {schema: GenerateImagePromptsInputSchema.extend({ 
    numImages: z.number(),
    chunksData: z.array(z.object({
      text: z.string(),
      duration: z.number(),
      promptCount: z.number(),
    })).optional()
  })},
  output: {schema: GenerateImagePromptsOutputSchema},
  prompt: `You are an expert at creating detailed and evocative image prompts for animation frames. Your goal is to generate prompts that correlate with narration chunks and use provider-specific techniques.

{{#if chunksData}}
**SOUND CHUNK CORRELATION MODE:**
You must generate prompts that correlate with the provided narration chunks. Each chunk has:
- Text content to analyze
- Duration in seconds
- Required number of prompts based on duration

Chunk Details:
{{#each chunksData}}
Chunk {{@index}}: "{{text}}" (Duration: {{duration}}s, Required prompts: {{promptCount}})
{{/each}}

{{#if (eq imageProvider "picsart")}}
**PICSART PROMPTING STRUCTURE:**
For each required prompt, use this structure:
1. Character Prompt: @CharacterName (reference character descriptions)
2. Background Prompt: @LocationName (reference location descriptions)  
3. Action Prompt: @CharacterName is [simple present-tense description of action]

Example format:
"Closeup shot at eye-level of @Fuzzy's sleeping face, her long, wavy fur gently rising and falling with each breath. Sunlight begins to spill over her, illuminating her pastel pink collar. @Fuzzy is lying down, sleeping, surrounded by soft toys and blankets. It is morning."
{{else}}
**GOOGLE/GEMINI PROMPTING STRUCTURE:**
For Google providers, use more detailed cinematic descriptions with:
- Camera angles and shot types
- Lighting and mood descriptions
- Detailed scene composition
- Character emotions and expressions
{{/if}}

{{else}}
**FALLBACK MODE (when no chunks provided):**
Analyze the script and identify {{numImages}} key scenes that need visualization.
{{/if}}

Character Descriptions:
{{{characterPrompts}}}

Location Descriptions:
{{{locationPrompts}}}

Item Descriptions:
{{{itemPrompts}}}

Script:
{{{script}}}

{{#if chunksData}}
Generate prompts for each chunk according to the required count. Total expected: {{numImages}} prompts.
{{else}}
Generate exactly {{numImages}} image prompts based on the script.
{{/if}}

Return your response as a JSON object with a single key "imagePrompts". The value MUST be an array of exactly {{numImages}} strings.
`,
  config: {
    temperature: 0.7,
    maxOutputTokens: 3072,
  },
});

const generateImagePromptsFlow = ai.defineFlow(
  {
    name: 'generateImagePromptsFlow',
    inputSchema: GenerateImagePromptsInputSchema,
    outputSchema: GenerateImagePromptsOutputSchema,
  },
  async input => {
    let numImages: number;
    let chunksData: Array<{text: string; duration: number; promptCount: number}> | undefined;

    if (input.narrationChunks && input.narrationChunks.length > 0) {
      // Calculate prompts based on sound chunks and their durations
      chunksData = input.narrationChunks.map(chunk => {
        let promptCount: number;
        if (chunk.duration <= 5) {
          promptCount = 1;
        } else if (chunk.duration <= 10) {
          // 1 or 2 prompts depending on text complexity - for now, default to 1
          promptCount = chunk.text.length > 100 ? 2 : 1;
        } else if (chunk.duration <= 15) {
          promptCount = 2;
        } else {
          promptCount = 3;
        }
        return {
          text: chunk.text,
          duration: chunk.duration,
          promptCount
        };
      });
      
      numImages = chunksData.reduce((total, chunk) => total + chunk.promptCount, 0);
      console.log(`Generating ${numImages} prompts for ${chunksData.length} chunks`, chunksData);
    } else {
      // Fallback to original logic (5 images per minute default)
      numImages = Math.max(1, Math.ceil(input.audioDurationSeconds * (5 / 60)));
      console.log(`Fallback: Generating ${numImages} prompts for ${input.audioDurationSeconds}s audio`);
    }

    const {output} = await generateImagePromptsPrompt({
      ...input,
      numImages,
      chunksData,
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
        } else if (output && typeof (output as unknown as {imagePrompts: string}).imagePrompts === 'string') {
            // If imagePrompts field is a string with newlines
             imagePromptsArray = ((output as unknown as {imagePrompts: string}).imagePrompts as string)
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
