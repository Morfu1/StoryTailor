import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {
  GenerateImagePromptsInputSchema,
  type GenerateImagePromptsInput,
  GenerateImagePromptsOutputSchema,
  type GenerateImagePromptsOutput,
} from './generate-image-prompts-types';

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
  prompt: `You are an expert at creating detailed image prompts optimized for various AI image generation models.
Your goal is to generate prompts that VISUALIZE specific NARRATION CHUNKS from a story.

**REFERENCES (Use these for @EntityName placeholders):**
CHARACTER REFERENCE:
{{{characterPrompts}}}

LOCATION REFERENCE:
{{{locationPrompts}}}

ITEM REFERENCE:
{{{itemPrompts}}}

**FULL STORY SCRIPT (for context):**
{{{script}}}

**INSTRUCTIONS FOR IMAGE PROMPT GENERATION:**

{{#if chunksData}}
**SOUND CHUNK CORRELATION MODE:**
You MUST generate prompts that DIRECTLY VISUALIZE the content of EACH narration chunk provided below.
For each chunk, you need to generate a specific number of image prompts as indicated.

{{#each chunksData}}
**Narration Chunk {{@index}} (Duration: {{duration}}s):**
"{{text}}"

**FOCUS EXCLUSIVELY ON THIS CHUNK:**
**IGNORE ALL OTHER CHUNKS WHILE PROCESSING THIS ONE.**

**CONTENT-BASED IMAGE ANALYSIS:**
Analyze THIS chunk and determine how many distinct visual moments it contains:
- 1 image: Single scene, moment, or action (e.g., contemplation, one continuous action)
- 2 images: Two clear visual moments or scene transitions (e.g., approach + arrival, before + after)
- 3 images: Multiple distinct actions or significant scene changes (e.g., action sequence with clear steps)

**MANDATORY CONTENT CHECK:**
Before writing each prompt, ask yourself: "Does this image prompt directly show what happens in THIS specific chunk text?" If no, rewrite it.

**For THIS CHUNK, generate 1-3 image prompt(s) based on your analysis above. Each prompt MUST:**
1.  **Visualize ONLY THIS CHUNK's content**: The image must depict ONLY what happens in the text above. Do NOT include actions, characters, or elements from other chunks. If this chunk mentions "elder griffins tracing spirals", your prompt must show griffins flying. If this chunk mentions "Solin gazing at blue sky", show Solin looking up. The image should depict characters, actions, and settings explicitly mentioned or clearly implied in THIS narration chunk ONLY.
2.  **Include a SPECIFIC Location**: Use an @LocationName from the LOCATION REFERENCE. If no location is directly mentioned in the chunk, infer the most logical @LocationName based on the chunk's content, the overall story script, and available location references. DO NOT invent new locations; use only those in the LOCATION REFERENCE.
3.  **Follow Enhanced Prompt Structure**: Create professional, cinematic prompts using this structure:
    "[CAMERA COMPOSITION] of @CharacterName [SPECIFIC ACTION/EMOTION] in @LocationName. [ATMOSPHERIC CONDITIONS]. [EMOTIONAL UNDERTONE from chunk]. [KEY VISUAL DETAIL from chunk]."
    
    **CAMERA COMPOSITION OPTIONS:**
    - Wide establishing shot (shows full scene context and character relationships)
    - Medium shot (focuses on character interaction and dialogue)
    - Close-up shot (captures emotional moments and character focus)
    - Over-the-shoulder shot (creates intimacy and perspective)
    - Low angle shot (shows power dynamics, makes subject appear strong)
    - High angle shot (shows vulnerability, makes subject appear small)
    - Eye-level shot (neutral, natural perspective)
    
    **ATMOSPHERIC CONDITIONS (choose based on chunk mood):**
    - Lighting: "Golden hour light", "Soft morning light", "Dramatic shadows", "Moonlit night"
    - Weather: "Gentle breeze", "Storm approaching", "Clear skies", "Misty atmosphere"
    - Time: "Dawn breaking", "Sunset glow", "Midday brightness", "Twilight hour"
    
    **ENHANCED EXAMPLES:**
    - "Wide establishing shot of @Rusty exploring cautiously in @WhisperingWoods. Morning mist filters through ancient trees. Sense of mystery and discovery. His nose twitches as he follows an intriguing scent trail."
    - "Close-up shot of @Solin gazing upward with wonder in @DawnwingValley. Brilliant blue sky above. Feeling of limitless possibility. His eyes reflect dreams of soaring."
4.  **SIMPLICITY RULE - Maximum 4 Placeholders**: Use AT MOST 4 @placeholders per prompt (not always 4, but never exceed 4). Focus on the most essential elements from the chunk. Quality over quantity.

5.  **CRITICAL: Use @Placeholders Instead of Full Names**: For ANY entity mentioned in the CHARACTER, LOCATION, and ITEM REFERENCE sections above, you MUST use @placeholder format, NOT the full entity name. Convert entity names to PascalCase for @references:
    *   "Zara" → @Zara
    *   "ALEX" → @ALEX  
    *   "Zara's Backyard" → @ZarasBackyard
    *   "Old Man Grumbles" → @OldManGrumbles
    *   "Magic Sword" → @MagicSword
    Do NOT write the full entity name or description in the prompt; use ONLY the @placeholder. The descriptions will be expanded automatically during image generation.

6.  **Professional Visual Quality Guidelines**:
    - Extract emotional undertones directly from the chunk text (joy, tension, mystery, wonder, etc.)
    - Choose atmospheric conditions that enhance the chunk's mood
    - Select camera angles that best serve the narrative moment
    - Focus on ONE primary action or moment per prompt
    - Avoid overcomplicated scenes - clarity beats complexity

7.  **No Style Descriptors**: ABSOLUTELY DO NOT include artistic style descriptors (like "3D rendered", "cartoon style", "photorealistic", "watercolor"). Style is handled separately.

8.  **Natural Language**: Write prompts as if describing a scene to a human director. Use present tense and active voice.
---
{{/each}}

**ALSO GENERATE CORRESPONDING ACTION PROMPTS:**
For EACH image prompt you create above, also generate a simple action description for animation purposes.
Action prompts should be:
- Simple, clear descriptions of character movements/actions in that specific scene.
- Focus on physical actions (e.g., "@Rusty is walking", "@Owl blinks slowly", "@Squirrel scurries up a tree").
- Keep them concise and animation-focused.

{{else}}
**FALLBACK MODE (No narration chunks provided):**
Analyze the full STORY SCRIPT and identify {{numImages}} key scenes that need visualization.
For each scene, generate one image prompt and one corresponding action prompt, following all the rules above (especially including a @LocationName and adhering to the prompt structure).
{{/if}}

**CHUNK-CONTENT SYNCHRONIZATION EXAMPLES:**
❌ WRONG APPROACH: Creating prompts based on overall story knowledge
✅ CORRECT APPROACH: Creating prompts based ONLY on this chunk's text

**Example:**
Chunk 3: "High overhead, elder griffins traced lazy spirals while recounting centuries-old legends"
✅ CORRECT: "Wide shot of @ElderGriffins flying in lazy spirals overhead in @DawnwingValley. Ancient creatures soaring majestically."
❌ WRONG: "Medium shot of @Vivi and @Bramble gripping @PatchworkKite in @DawnwingValley" (this is from a different chunk!)

**EXAMPLES OF CORRECT @PLACEHOLDER USAGE:**
✅ CORRECT: "Wide shot of @Zara rushing to help @ALEX in @ZarasBackyard. Sunny afternoon."
❌ WRONG: "Wide shot of Zara rushing to help ALEX in Zara's Backyard. Sunny afternoon."
❌ WRONG: "Wide shot of Zara rushing to help ALEX in @Zara's Backyard. Sunny afternoon."
❌ WRONG: "Wide shot of Zara rushing to help ALEX in @Zara'sBackyard. Sunny afternoon."
❌ WRONG: "Wide shot of a young inventor rushing to help a robot in a backyard. Sunny afternoon."

✅ CORRECT: "Close-up of @ALEX holding @LearningPods in its metallic hands."
❌ WRONG: "Close-up of ALEX holding Learning Pods in its metallic hands."

✅ CORRECT: "Medium shot of @Zara examining @ALEX in @ZarasBackyard." (use lowercase "in")
❌ WRONG: "Medium shot of @Zara examining @ALEX IN @ZarasBackyard." (avoid uppercase "IN")

**CONTENT-BASED EXAMPLES:**
✅ SINGLE MOMENT: "Solin gazed upward, dreaming of flight" → 1 image (one contemplative scene)
✅ TWO MOMENTS: "Solin climbed the cliff, then gasped at the view" → 2 images (climbing + arriving)  
✅ THREE MOMENTS: "Solin ran to the edge, leaped boldly, then soared through clouds" → 3 images (run + leap + soar)

**OUTPUT FORMAT (Strict JSON - NO COMMENTS ALLOWED):**
Return ONLY valid JSON with NO comments, explanations, or additional text.
Your response must be EXACTLY this format:

{
  "imagePrompts": ["prompt1", "prompt2", "..."],
  "actionPrompts": ["action1", "action2", "..."]
}

CRITICAL REQUIREMENTS:
- NO comments like "// Chunk 8" or "/* explanation */"
- NO extra text before or after the JSON
- NO explanations inside the JSON  
- Generate exactly as many prompts as your content analysis determined (1-3 per chunk)
- Each imagePrompts array entry must have a corresponding actionPrompts entry
- Each prompt must be a single string with no line breaks
`,
  config: {
    temperature: 0.7,
    maxOutputTokens: 4096,
  },
});

export const generateImagePromptsFlow = ai.defineFlow(
  {
    name: 'generateImagePromptsFlow',
    inputSchema: GenerateImagePromptsInputSchema,
    outputSchema: GenerateImagePromptsOutputSchema,
  },
  async (input: GenerateImagePromptsInput): Promise<GenerateImagePromptsOutput> => {
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
