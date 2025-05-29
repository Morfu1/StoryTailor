'use server';

/**
 * @fileOverview Generates a sequence of image prompts tailored to the narration based on audio duration.
 *
 * - generateImagePrompts - A function that generates image prompts for animation.
 * - GenerateImagePromptsInput - The input type for the generateImagePrompts function.
 * - GenerateImagePromptsOutput - The return type for the generateImagePrompts function.
 * 
 * IMPORTANT: After updating character consistency requirements, you must:
 * 1. Re-generate character prompts with specific physical traits (hair/fur color, eye color, accessories)
 * 2. Re-generate all character, location, and item images to ensure consistency
 * 3. Update existing stories to use the new consistent character descriptions
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

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
  isPicsart: z.boolean().optional().describe('Whether the image provider is PicsArt.'),
});
export type GenerateImagePromptsInput = z.infer<typeof GenerateImagePromptsInputSchema>;

const GenerateImagePromptsOutputSchema = z.object({
  imagePrompts: z.array(z.string()).describe('The generated image prompts as an array of strings.'),
  actionPrompts: z.array(z.string()).describe('Simple action descriptions for character movements in each scene.'),
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
  prompt: `You are an expert at creating detailed image prompts optimized for FLUX AI model through PicsArt API. Your goal is to generate prompts that correlate with narration chunks using FLUX-specific techniques.

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

{{#if isPicsart}}
**FLUX DEV OPTIMIZED PROMPTING FOR PICSART:**
FLUX is exceptionally good at understanding natural language. Use this structure with entity references:

1. **Entity Reference System**: Use '@' prefix for all characters, locations, and items (e.g., @CharacterName, @LocationName, @ItemName)
2. **Natural Language Approach**: Write prompts as if describing a scene to a human
3. **Subject-Action-Environment Pattern**: Start with the main subject, describe what they're doing, then the environment
4. **Specific Visual Details**: Include lighting, camera angles, and artistic style

**Flux-Optimized Structure with Entity References:**
"[Camera shot] of @CharacterName [action/emotion/pose] in @LocationName. [Interaction with @ItemName if relevant]. [Lighting description]. [Additional details]."

**Example:**
"Close-up shot of @Luna, a young girl with curly brown hair and bright green eyes, looking up in wonder at floating golden sparkles around her. She's standing in @EnchantedForest clearing with dappled sunlight filtering through ancient oak trees. @MagicalSparkles dance around her hands. Warm, magical lighting with soft shadows."

**Character Consistency Examples:**
- "@whiskers, a sleek 3yo charcoal grey cat with short smooth fur and piercing green eyes wearing a navy blue collar, sits alertly"
- "@fuzzy, a small 1yo white kitten with long wavy fur and big blue eyes wearing a pastel pink collar with a tiny bell, bounces playfully"

**CRITICAL REQUIREMENTS:**
- Always use '@' prefix before character names (e.g., @Luna, @Hero, @Villain)
- Always use '@' prefix before location names (e.g., @Castle, @Forest, @Bedroom)
- Always use '@' prefix before important item names (e.g., @Sword, @Crown, @Book)
- Extract character, location, and item names from the provided reference descriptions
- Use present tense for actions
- Be specific about emotions and expressions
- Include environmental context and lighting

**ABSOLUTELY FORBIDDEN - DO NOT INCLUDE:**
- Any artistic style descriptors (NO "Digital painting style", "3D rendered", "cartoon style", etc.)
- Art medium references (NO "watercolor", "oil painting", "comic book style", etc.)
- Software references (NO "Unreal Engine", "Blender", "Photoshop", etc.)
- Quality descriptors (NO "highly detailed", "8K", "photorealistic", etc.)
- The artistic style will be handled separately by the system through model configuration, NOT in the prompt text

**STYLE HANDLING PHILOSOPHY:**
Style is applied systematically through the imageStyleUtils system after prompt generation. This ensures scene prompts remain clean and focused on content while style is consistently applied across all generated images.

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
Analyze the script and identify {{numImages}} key scenes that need visualization using FLUX-optimized natural language descriptions.
{{/if}}

**CHARACTER REFERENCE:**
{{{characterPrompts}}}

**CRITICAL NAMING CONSISTENCY:**
When referencing characters, items, or locations in your image prompts, you MUST use the exact names as they appear in the reference sections above, prefixed with @. 

For example, if the character reference shows:
"Rosie Recycle
a young girl with..."

Then in your image prompts, use: @RosieRecycle (no spaces, PascalCase)

If the character reference shows:
"Old Man Grumbles  
an elderly man with..."

Then in your image prompts, use: @OldManGrumbles (no spaces, PascalCase)

ALWAYS convert multi-word names to PascalCase (FirstSecondThird) when creating @ references.

**CHARACTER CONSISTENCY REQUIREMENTS:**
- Always include specific physical traits for consistency: hair/fur color, eye color, distinctive features
- Add identifying accessories or clothing when present (collars, jewelry, clothing items)
- Use age-appropriate descriptors (young, elderly, toddler, etc.)
- Include unique physical characteristics that make each character recognizable
- Keep descriptions concise but distinctive (focus on 2-3 key visual elements)
- Examples: "a sleek charcoal grey cat with green eyes and a navy collar", "a young girl with curly brown hair and bright green eyes"

**REGENERATION NOTICE:**
⚠️ After implementing these character consistency requirements, you MUST regenerate:
1. All character prompt descriptions to include specific physical traits
2. All character reference images with consistent visual features
3. All location and item images to match the updated style
4. Existing story content to use the new consistent character descriptions

**LOCATION REFERENCE:**
{{{locationPrompts}}}

**ITEM REFERENCE:**
{{{itemPrompts}}}

**STORY SCRIPT:**
{{{script}}}

{{#if chunksData}}
**INSTRUCTIONS:**
For each narration chunk, create {{#each chunksData}}{{promptCount}} prompt(s) for chunk {{@index}}, {{/each}} ensuring they match the narrative content and flow smoothly between scenes. Focus on key emotional moments, character interactions, and scene transitions.

Total prompts needed: {{numImages}}

**ALSO GENERATE ACTION PROMPTS:**
For each image prompt, create a corresponding simple action description that describes the specific movements/actions characters perform in that scene. These are for animation purposes.

Action prompts should be:
- Simple, clear descriptions of character movements
- Focus on physical actions (walking, jumping, blinking, tail wagging, etc.)
- Describe what each character does in that specific scene
- Keep them concise and animation-focused

Examples:
- "The kitten's fur gently rises and falls as it sleeps."
- "The kitten leaps forward and waves its paws."
- "The white kitten takes a few steps forward and wags its tail. The grey cat blinks and turns its head."

{{else}}
Generate exactly {{numImages}} FLUX-optimized image prompts based on the script's key visual moments.
{{/if}}

**OUTPUT FORMAT:**
Return your response as a JSON object with two keys:
1. "imagePrompts": An array of exactly {{numImages}} strings, each optimized for FLUX AI model
2. "actionPrompts": An array of exactly {{numImages}} strings, each describing simple character movements for that scene`,
  config: {
    temperature: 0.7,
    maxOutputTokens: 4096,
  },
});

const generateImagePromptsFlow = ai.defineFlow(
  {
    name: 'generateImagePromptsFlow',
    inputSchema: GenerateImagePromptsInputSchema,
    outputSchema: GenerateImagePromptsOutputSchema,
  },
  async input => {
    console.log('=== IMAGE PROMPTS AI FLOW STARTED ===');
    console.log('Environment check:', {
      hasGoogleApiKey: !!process.env.GOOGLE_API_KEY,
      hasGeminiApiKey: !!process.env.GEMINI_API_KEY,
      hasGoogleGenaiApiKey: !!process.env.GOOGLE_GENAI_API_KEY
    });
    console.log('Input received:', {
      scriptLength: input.script?.length,
      hasCharacterPrompts: !!input.characterPrompts,
      hasLocationPrompts: !!input.locationPrompts,
      hasItemPrompts: !!input.itemPrompts,
      audioDurationSeconds: input.audioDurationSeconds,
      narrationChunksCount: input.narrationChunks?.length,
      imageProvider: input.imageProvider
    });
    
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

    console.log('Calling AI with:', {
      numImages,
      chunksDataLength: chunksData?.length,
      inputPreview: {
        scriptPreview: input.script.substring(0, 100) + '...',
        characterPrompts: input.characterPrompts.substring(0, 50) + '...',
        imageProvider: input.imageProvider
      }
    });

    const {output} = await generateImagePromptsPrompt({
      ...input,
      numImages,
      chunksData,
      isPicsart: input.imageProvider === 'picsart',
    });
    
    console.log('AI Response received:', {
      outputType: typeof output,
      isArray: Array.isArray(output),
      hasImagePrompts: output?.imagePrompts ? 'yes' : 'no',
      hasActionPrompts: output?.actionPrompts ? 'yes' : 'no',
      imagePromptsType: typeof output?.imagePrompts,
      imagePromptsLength: Array.isArray(output?.imagePrompts) ? output.imagePrompts.length : 'not array',
      actionPromptsLength: Array.isArray(output?.actionPrompts) ? output.actionPrompts.length : 'not array'
    });
    
    let imagePromptsArray: string[] = [];
    let actionPromptsArray: string[] = [];

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

    // Handle action prompts
    if (output && Array.isArray(output.actionPrompts)) {
        actionPromptsArray = output.actionPrompts.map(prompt => String(prompt).trim()).filter(prompt => prompt !== '');
    } else {
        // Generate fallback action prompts if AI didn't provide them
        actionPromptsArray = imagePromptsArray.map((_, index) => `Character performs action in scene ${index + 1}.`);
    }

    // Ensure we adhere to the output schema even if parsing fails or returns unexpected structure
    if (!imagePromptsArray || imagePromptsArray.length === 0) {
        console.error("Image prompt generation resulted in an empty or unparseable list even after fallbacks.");
        console.error("AI Output:", output);
        throw new Error("Failed to generate a valid list of image prompts. The AI did not return any usable image prompts.");
    }

    // Ensure action prompts match image prompts length
    if (actionPromptsArray.length !== imagePromptsArray.length) {
        console.warn(`Action prompts length (${actionPromptsArray.length}) doesn't match image prompts length (${imagePromptsArray.length}). Adjusting...`);
        // Pad or trim action prompts to match
        while (actionPromptsArray.length < imagePromptsArray.length) {
            actionPromptsArray.push(`Character performs action in scene ${actionPromptsArray.length + 1}.`);
        }
        actionPromptsArray = actionPromptsArray.slice(0, imagePromptsArray.length);
    }
    
    return {
        imagePrompts: imagePromptsArray,
        actionPrompts: actionPromptsArray
    };
  }
);
