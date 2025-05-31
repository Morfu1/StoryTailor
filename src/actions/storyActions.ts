
"use server";

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';

// Import Input/Output schemas from the original flow files - STATIC IMPORTS
import {
  GenerateCharacterPromptsInputSchema as AICharacterPromptsInputSchema,
  GenerateCharacterPromptsOutputSchema as AICharacterPromptsOutputSchema
} from '@/ai/flows/generate-character-prompts';

import {
  GenerateImagePromptsInputSchema as AIImagePromptsInputSchema,
  GenerateImagePromptsOutputSchema as AIImagePromptsOutputSchema
} from '@/ai/flows/generate-image-prompts';

import {
  GenerateNarrationAudioInputSchema as AINarrationAudioInputSchema, // Note: This flow still exists but storyActions also implements direct calls
  GenerateNarrationAudioOutputSchema as AINarrationAudioOutputSchema, // Renamed to avoid conflict for direct calls
  type GenerateNarrationAudioInput as AINarrationAudioInputType, // Type for the flow
  type GenerateNarrationAudioOutput as AINarrationAudioOutputType // Type for the flow
} from '@/ai/flows/generate-narration-audio';


import {
  GenerateScriptInputSchema as AIScriptInputSchemaOriginal,
  GenerateScriptOutputSchema as AIScriptOutputSchemaOriginal
} from '@/ai/flows/generate-script';

import {
  GenerateTitleInputSchema as AITitleInputSchemaOriginal,
  GenerateTitleOutputSchema as AITitleOutputSchemaOriginal
} from '@/ai/flows/generate-title';

import {
  GenerateScriptChunksInputSchema as AIScriptChunksInputSchemaOriginal,
  GenerateScriptChunksOutputSchema as AIScriptChunksOutputSchemaOriginal
} from '@/ai/flows/generate-script-chunks';


import { firebaseAdmin, dbAdmin } from '@/lib/firebaseAdmin';
import type { Story, ElevenLabsVoice, GeneratedImage } from '@/types/story';
import type { Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { getStorage as getAdminStorage } from 'firebase-admin/storage';
import { revalidatePath } from 'next/cache';
import { getUserApiKeys } from './apiKeyActions';
import type { UserApiKeys } from '@/types/apiKeys'; // For API key types

// Schemas to be used in server actions, possibly extended if needed
// Add checks for undefined schemas, though static imports should prevent this.
const AITitleInputSchema = AITitleInputSchemaOriginal || z.object({ userPrompt: z.string() });
const AITitleOutputSchema = AITitleOutputSchemaOriginal || z.object({ title: z.string() });
const GenerateTitleInputServerSchema = AITitleInputSchema.extend({ userId: z.string() });
export type GenerateTitleInput = z.infer<typeof GenerateTitleInputServerSchema>;

const AIScriptInputSchema = AIScriptInputSchemaOriginal || z.object({ prompt: z.string() });
const AIScriptOutputSchema = AIScriptOutputSchemaOriginal || z.object({ script: z.string() });
const GenerateScriptInputServerSchema = AIScriptInputSchema.extend({ userId: z.string() });
export type GenerateScriptInput = z.infer<typeof GenerateScriptInputServerSchema>;

// AICharacterPromptsInputSchema is already imported and named
const GenerateCharacterPromptsInputServerSchema = AICharacterPromptsInputSchema.extend({ userId: z.string() });
export type GenerateCharacterPromptsInput = z.infer<typeof GenerateCharacterPromptsInputServerSchema>;

// AIImagePromptsInputSchema is already imported and named
const GenerateImagePromptsInputServerSchema = AIImagePromptsInputSchema.extend({ userId: z.string() });
export type GenerateImagePromptsInput = z.infer<typeof GenerateImagePromptsInputServerSchema>;

const AIScriptChunksInputSchema = AIScriptChunksInputSchemaOriginal || z.object({ script: z.string() });
const AIScriptChunksOutputSchema = AIScriptChunksOutputSchemaOriginal || z.object({ scriptChunks: z.array(z.string()), error: z.string().optional() });
const GenerateScriptChunksInputServerSchema = AIScriptChunksInputSchema.extend({ userId: z.string() });
export type GenerateScriptChunksInput = z.infer<typeof GenerateScriptChunksInputServerSchema>;


// Prompt templates (extracted or simplified from original flow files)
const titlePromptTemplate = `You are an expert at creating catchy and concise titles for stories.
Based on the user's story prompt, generate a short title (ideally 3-7 words, maximum 10 words) that captures the essence of the story.
User Prompt: "{{userPrompt}}"
Generated Title:`;

const scriptPromptTemplate = `You are a script writer for animated videos. Your task is to generate a script based on the user's prompt.
The script should be engaging for both children and adults, and should follow the themes, character descriptions, and story twists provided in the prompt.
Importantly, the entire script must be written from the perspective of a single narrator. Do not include character dialogues unless the narrator is quoting them. The narrative should flow as if one person is telling the entire story.
Ensure the script maintains a specific word count for optimal engagement.
User Prompt: {{{prompt}}}
Generated Script (for single narrator):`;

const characterPromptsPromptTemplate = `You are an expert prompt engineer specializing in creating descriptions for text-to-image AI models (like DALL-E, Midjourney, or Flux Dex model).
Based on the following story script, generate detailed visual descriptions for the main characters, key items, and important locations.
These descriptions will be used as prompts for an AI image generator to create visuals for the story.

{{#if stylePrompt}}
**ARTISTIC STYLE REQUIREMENTS:**
Incorporate these style characteristics into all descriptions: {{{stylePrompt}}}
Ensure that character, item, and location descriptions align with this artistic style while maintaining their unique features.
{{/if}}

Script:
{{{script}}}

Instructions for output:
1.  For each category (Characters, Items, Locations), provide a heading (e.g., "Character Prompts:", "Item Prompts:", "Location Prompts:"). This heading MUST be part of the string for that category and appear at the very beginning of that category's section.
2.  Under each heading, list the entities. For each entity:
    *   **First line:** The name of the character, item, or location. Names should be easy to convert to @ references (e.g., "Rosie Recycle" → @RosieRecycle, "Old Man Grumbles" → @OldManGrumbles, "Magic Sword" → @MagicSword).
    *   **Subsequent lines:** Starting on the line immediately following the name, provide a detailed visual description suitable for a text-to-image model. This description MUST:
        *   Be entirely in **lowercase**.
        *   Be a **single sentence**.
        *   **Not end** with any punctuation marks like '.', '?', or '!'.
        *   **MANDATORY for characters**: Include specific physical traits for consistency:
            - Hair color and style (e.g., "brown hair", "blonde hair", "curly red hair", "long black hair")
            - Eye color (e.g., "blue eyes", "green eyes", "brown eyes")
            - Skin tone if relevant (e.g., "pale skin", "tan skin", "dark skin")
            - Age descriptors (e.g., "young girl", "elderly man", "teenage boy")
            - Key identifying features (clothing, accessories, distinctive marks)
        *   Focus on visual attributes: appearance, attire, textures, colors, age, mood, specific features, and any other visual details. Be descriptive and evocative.
3.  Ensure **exactly one blank line** separates each complete entity's entry (name + description) from the next entity within the same category. Do not use more than one blank line.

Example of desired output format and style (the content below is an example of the style and formatting you should follow, generate your own content based on the script):

Character Prompts:
Ember
a tiny house cat-sized dragon with dull smoky grey scales, large hopeful bright orange eyes, small crumpled wings, a perpetually worried expression, blunt claws and tiny teeth

Ignis
an ancient wise dragon with cooled lava-colored scales cracked and weathered with age, glowing inner fire eyes, long braided beard with glittering obsidian beads, carrying a gnarled staff of petrified wood

Rosie Recycle
a young girl with curly brown hair and bright green eyes, wearing goggles made from repurposed clear soda bottles, a cape fashioned from colorful recycled newspapers, pale skin with a determined expression and her outfit adorned with recycling symbols

Item Prompts:
Gnarled Staff
a staff made of dark petrified wood gnarled and twisted with age it might have a faintly glowing crystal or ancient rune carved at its tip emitting a soft light

Obsidian Beads
small polished beads of pure black obsidian reflecting light with a glassy sheen they could be intricately braided into a character's beard or hair or part of a necklace

Location Prompts:
Desolate Village
a small somber village with simple run-down huts made of rough-hewn wood and deteriorating thatch the surrounding landscape is barren and dusty perhaps with a few dead trees a sense of gloom and despair hangs heavy in the air colors are muted primarily browns greys and faded earth tones

Volcanic Peak
a towering jagged mountain its peak perpetually wreathed in thick dark smoke and a faint ominous red glow from within the slopes are steep and treacherous covered in loose scree sharp volcanic rock and patches of grey ash no vegetation is visible

Now, generate the character, item, and location prompts based on the provided script, adhering strictly to the format, style, and level of detail exemplified above. For characters, ensure you include specific physical traits (hair color/style, eye color, skin tone, age) for consistency across image generations. Use lowercase, single-sentence, no-punctuation-ending descriptions.
`;

const imagePromptsPromptTemplate = `You are an expert at creating detailed image prompts optimized for FLUX AI model through PicsArt API. Your goal is to generate prompts that correlate with narration chunks using FLUX-specific techniques.

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
"Close-up shot of @Luna looking up in wonder at floating golden sparkles around her. She's standing in @EnchantedForest clearing with dappled sunlight filtering through ancient oak trees. @MagicalSparkles dance around her hands. Warm, magical lighting with soft shadows."

**Character Consistency Examples:**
- "@Whiskers sits alertly"
- "@Fuzzy bounces playfully"

**CRITICAL REQUIREMENTS:**
- Always use '@' prefix before character names (e.g., @Luna, @Hero, @Villain)
- Always use '@' prefix before location names (e.g., @Castle, @Forest, @Bedroom)
- Always use '@' prefix before important item names (e.g., @Sword, @Crown, @Book)
- Extract character, location, and item names from the provided reference descriptions
- NEVER include character/item/location descriptions when using @placeholders - the @placeholder will be expanded with the full description automatically
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
When referencing characters, items, or locations in your image prompts, you MUST ONLY use entities that exist in the reference sections above, prefixed with @. 

MANDATORY RULES:
1. ONLY use @placeholders for entities listed in the CHARACTER REFERENCE, LOCATION REFERENCE, and ITEM REFERENCE sections
2. NEVER create @placeholders for entities not in these reference sections
3. Convert entity names to PascalCase when creating @references (e.g., "Old Man Grumbles" becomes @OldManGrumbles)
4. Do NOT include descriptions alongside @placeholders - they will be expanded automatically

For example, if the character reference shows:
"Rosie Recycle
a young girl with..."

Then use: @RosieRecycle (no description needed)

If the character reference shows:
"Old Man Grumbles  
an elderly man with..."

Then use: @OldManGrumbles (no description needed)

**CHARACTER CONSISTENCY REQUIREMENTS:**
- Character descriptions are automatically provided through @placeholders
- Focus on character actions, emotions, and interactions with environment
- Use @placeholders for all characters, items, and locations from the reference sections
- Do not duplicate descriptions that are already in the @placeholder expansions

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
2. "actionPrompts": An array of exactly {{numImages}} strings, each describing simple character movements for that scene`;

const scriptChunksPromptTemplate = `You are a movie director and script editor who thinks visually. Your task is to split the following story script into meaningful visual scenes/chunks. Each chunk will have a corresponding image generated and narration audio, so think like you're creating an animated storybook.

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
`;


function getStorageBucket(): string | undefined {
  return process.env?.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
}

export async function generateTitle(input: GenerateTitleInput): Promise<{ success: boolean, data?: AITitleOutputSchemaOriginal, error?: string }> {
  const userKeysResult = await getUserApiKeys(input.userId);
  if (!userKeysResult.success || !userKeysResult.data?.googleApiKey) {
    return { success: false, error: "Google API key not configured by user. Please set it in Account Settings." };
  }
  const userGoogleKey = userKeysResult.data.googleApiKey;

  try {
    const localAi = genkit({ plugins: [googleAI({ apiKey: userGoogleKey })], model: 'googleai/gemini-2.0-flash' });
    const prompt = titlePromptTemplate.replace('{{userPrompt}}', input.userPrompt);
    const { output } = await localAi.generate({ prompt, output: { schema: AITitleOutputSchema, format: 'json' } });
    
    if (!output?.title) {
      const promptWords = input.userPrompt.split(' ').slice(0, 5).join(' ');
      return { success: true, data: { title: `${promptWords}... (Draft)` } };
    }
    return { success: true, data: output };
  } catch (error) {
    console.error("Error in generateTitle AI call:", error);
    return { success: false, error: "Failed to generate title with user's key." };
  }
}

export async function generateScript(input: GenerateScriptInput): Promise<{ success: boolean, data?: AIScriptOutputSchemaOriginal, error?: string }> {
  const userKeysResult = await getUserApiKeys(input.userId);
  if (!userKeysResult.success || !userKeysResult.data?.googleApiKey) {
    return { success: false, error: "Google API key not configured by user. Please set it in Account Settings." };
  }
  const userGoogleKey = userKeysResult.data.googleApiKey;

  try {
    const localAi = genkit({ plugins: [googleAI({ apiKey: userGoogleKey })], model: 'googleai/gemini-2.0-flash' });
    const prompt = scriptPromptTemplate.replace('{{{prompt}}}', input.prompt);
    const { output } = await localAi.generate({ prompt, output: { schema: AIScriptOutputSchema, format: 'json' } });
    return { success: true, data: output! };
  } catch (error) {
    console.error("Error in generateScript AI call:", error);
    return { success: false, error: "Failed to generate script with user's key." };
  }
}

export async function generateCharacterPrompts(input: GenerateCharacterPromptsInput): Promise<{ success: boolean, data?: AICharacterPromptsOutputSchema, error?: string }> {
  const userKeysResult = await getUserApiKeys(input.userId);
  if (!userKeysResult.success || !userKeysResult.data?.googleApiKey) {
    return { success: false, error: "Google API key not configured by user. Please set it in Account Settings." };
  }
  const userGoogleKey = userKeysResult.data.googleApiKey;

  try {
    const localAi = genkit({ plugins: [googleAI({ apiKey: userGoogleKey })], model: 'googleai/gemini-2.0-flash' });
    
    let stylePromptText: string | undefined;
    if (input.imageStyleId) {
      try {
        const { getStylePromptForProvider } = await import('@/utils/imageStyleUtils');
        stylePromptText = getStylePromptForProvider(input.imageStyleId as any, input.imageProvider || 'picsart');
      } catch (error) {
        console.warn('Failed to get style prompt for character generation:', error);
      }
    }

    let finalPrompt = characterPromptsPromptTemplate.replace('{{{script}}}', input.script);
    if (stylePromptText) {
        finalPrompt = finalPrompt.replace('{{#if stylePrompt}}**ARTISTIC STYLE REQUIREMENTS:** {{{stylePrompt}}}{{/if}}', `**ARTISTIC STYLE REQUIREMENTS:** ${stylePromptText}`);
    } else {
        finalPrompt = finalPrompt.replace('{{#if stylePrompt}}**ARTISTIC STYLE REQUIREMENTS:** {{{stylePrompt}}}{{/if}}', '');
    }
    
    const { output } = await localAi.generate({ prompt: finalPrompt, output: { schema: AICharacterPromptsOutputSchema, format: 'json' } });
    return { success: true, data: output! };
  } catch (error) {
    console.error("Error in generateCharacterPrompts AI call:", error);
    return { success: false, error: "Failed to generate character/item/location prompts with user's key." };
  }
}


// Helper function to estimate duration from audio data URI (MP3 or WAV)
function getMp3DurationFromDataUri(dataUri: string): number {
  try {
    let base64Data: string;
    let estimatedBytesPerSecond: number;

    if (dataUri.startsWith('data:audio/mpeg;base64,')) {
      base64Data = dataUri.substring('data:audio/mpeg;base64,'.length);
      const estimatedBitrateKbps = 128;
      estimatedBytesPerSecond = (estimatedBitrateKbps * 1000) / 8;
    } else if (dataUri.startsWith('data:audio/wav;base64,')) {
      base64Data = dataUri.substring('data:audio/wav;base64,'.length);
      estimatedBytesPerSecond = 48000; 
    } else {
      console.warn('Cannot estimate duration: Unsupported audio format in data URI.');
      return 30; 
    }

    const binaryData = Buffer.from(base64Data, 'base64');
    const durationSeconds = binaryData.length / estimatedBytesPerSecond;

    if (base64Data === 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAAA') {
        console.warn('Placeholder WAV audio detected, setting duration to 1s.');
        return 1;
    }
    if (binaryData.length < 1000 && durationSeconds < 1) { 
        console.warn('Very short audio detected, possibly placeholder or error. Setting duration to 1s.');
        return 1;
    }

    return Math.max(1, parseFloat(durationSeconds.toFixed(2))); 
  } catch (e) {
    console.error('Error estimating MP3 duration:', e);
    return 30;
  }
}

export interface GenerateNarrationAudioActionInput extends AINarrationAudioInputType { // Use flow's input type
  userId?: string; 
  storyId?: string;
  chunkId?: string;
}

export async function generateNarrationAudio(actionInput: GenerateNarrationAudioActionInput): Promise<{ success: boolean; data?: { audioStorageUrl?: string; voices?: ElevenLabsVoice[]; duration?: number }; error?: string }> {
  if (!actionInput.userId) {
    return { success: false, error: "User ID is required for narration generation." };
  }

  try {
    const userKeysResult = await getUserApiKeys(actionInput.userId);
    if (!userKeysResult.success || !userKeysResult.data) {
      return { success: false, error: "Could not fetch user API keys. " + (userKeysResult.error || "") };
    }
    const userApiKeys = userKeysResult.data;

    let serviceApiKey: string | undefined;
    const modelToUse = actionInput.ttsModel || 'elevenlabs';

    if (modelToUse === 'elevenlabs') {
      serviceApiKey = userApiKeys.elevenLabsApiKey;
      if (!serviceApiKey) {
        return { success: false, error: "ElevenLabs API key not configured by user. Please set it in Account Settings." };
      }
    } else if (modelToUse === 'google') {
      // For Google TTS, ensure the Google API key (often used for Gemini) is available
      serviceApiKey = userApiKeys.googleApiKey || userApiKeys.geminiApiKey; 
      if (!serviceApiKey) {
        return { success: false, error: "Google API key for TTS not configured by user. Please set it in Account Settings." };
      }
    }

    // Construct the input for the original flow, ensuring 'apiKey' is part of the schema or handled within the flow.
    // The flow 'generate-narration-audio' should be adapted to use the apiKey passed in its input.
    const aiFlowInput: AINarrationAudioInputType = {
      script: actionInput.script,
      voiceId: actionInput.voiceId,
      ttsModel: modelToUse,
      googleApiModel: actionInput.googleApiModel,
      languageCode: actionInput.languageCode,
      apiKey: serviceApiKey // Pass the user's key to the flow
    };
    
    // Call the original flow
    const { generateNarrationAudio: aiGenerateNarrationAudio } = await import('@/ai/flows/generate-narration-audio');
    const result: AINarrationAudioOutputType = await aiGenerateNarrationAudio(aiFlowInput);


    if (result.error) {
      return { success: false, error: result.error };
    }

    if (result.audioDataUri) {
      const duration = getMp3DurationFromDataUri(result.audioDataUri);
      if (actionInput.userId && actionInput.storyId && actionInput.chunkId) {
        try {
          const fileExtension = result.audioDataUri.startsWith('data:audio/wav;base64,') ? 'wav' : 'mp3';
          const filename = `narration_chunk_${actionInput.chunkId}.${fileExtension}`;
          const storageUrl = await uploadAudioToFirebaseStorage(result.audioDataUri, actionInput.userId, actionInput.storyId, filename);
          console.log(`Uploaded narration chunk ${actionInput.chunkId} to: ${storageUrl}`);
          return { success: true, data: { audioStorageUrl: storageUrl, duration } };
        } catch (uploadError) {
          console.error(`Failed to upload narration chunk ${actionInput.chunkId} to Firebase Storage:`, uploadError);
          return { success: false, error: `Failed to upload audio for chunk ${actionInput.chunkId}: ${(uploadError as Error).message}` };
        }
      } else {
        console.warn("generateNarrationAudio action: audioDataUri present but missing userId, storyId, or chunkId for storage.");
        return { success: true, data: { audioStorageUrl: result.audioDataUri, duration } }; 
      }
    }
    
    if (result.voices) { 
      return { success: true, data: { voices: result.voices as ElevenLabsVoice[] } };
    }
    
    return { success: false, error: "Unknown error from narration generation." };

  } catch (error) {
    console.error("Error in generateNarrationAudio action:", error);
    return { success: false, error: "Failed to process narration audio request." };
  }
}

export interface VoicePreviewInput {
  voiceId: string;
  ttsModel: 'elevenlabs' | 'google';
  googleApiModel?: string;
  languageCode?: string;
  demoText?: string;
  userId?: string;
}

export async function generateVoicePreview(input: VoicePreviewInput): Promise<{ success: boolean; audioDataUri?: string; error?: string }> {
  if (!input.userId) {
    return { success: false, error: "User ID is required for voice preview." };
  }
  
  try {
    const userKeysResult = await getUserApiKeys(input.userId);
    if (!userKeysResult.success || !userKeysResult.data) {
      return { success: false, error: "Could not fetch user API keys for preview. " + (userKeysResult.error || "") };
    }
    const userApiKeys = userKeysResult.data;

    let serviceApiKey: string | undefined;
    if (input.ttsModel === 'elevenlabs') {
      serviceApiKey = userApiKeys.elevenLabsApiKey;
      if (!serviceApiKey) {
        return { success: false, error: "ElevenLabs API key not configured by user for preview. Please set it in Account Settings." };
      }
    } else if (input.ttsModel === 'google') {
      serviceApiKey = userApiKeys.googleApiKey || userApiKeys.geminiApiKey;
      if (!serviceApiKey) {
        return { success: false, error: "Google API key for TTS preview not configured by user. Please set it in Account Settings." };
      }
    }

    const demoText = input.demoText || "Hello! This is a preview of how this voice sounds. I hope you like it!";
    
    const aiFlowInput: AINarrationAudioInputType = {
      script: demoText,
      voiceId: input.voiceId,
      ttsModel: input.ttsModel,
      googleApiModel: input.googleApiModel,
      languageCode: input.languageCode,
      apiKey: serviceApiKey,
    };

    const { generateNarrationAudio: aiGenerateNarrationAudio } = await import('@/ai/flows/generate-narration-audio');
    const result: AINarrationAudioOutputType = await aiGenerateNarrationAudio(aiFlowInput);

    if (result.error) {
      return { success: false, error: result.error };
    }

    if (result.audioDataUri) {
      return { success: true, audioDataUri: result.audioDataUri };
    }

    return { success: false, error: "No audio data returned from voice preview generation." };
  } catch (error) {
    console.error("Error in generateVoicePreview action:", error);
    return { success: false, error: "Failed to generate voice preview." };
  }
}


export async function generateImagePrompts(input: GenerateImagePromptsInput): Promise<{ success: boolean, data?: AIImagePromptsOutputSchema, error?: string }> {
    const userKeysResult = await getUserApiKeys(input.userId);
    if (!userKeysResult.success || !userKeysResult.data?.googleApiKey) { // Uses Google API key for prompt generation
      return { success: false, error: "Google API key for prompt generation not configured by user. Please set it in Account Settings." };
    }
    const userGoogleKey = userKeysResult.data.googleApiKey;

    try {
        const localAi = genkit({ plugins: [googleAI({ apiKey: userGoogleKey })], model: 'googleai/gemini-2.0-flash', })
        
        let numImages: number;
        let chunksDataForPrompt: Array<{text: string; duration: number; promptCount: number}> | undefined;

        if (input.narrationChunks && input.narrationChunks.length > 0) {
            chunksDataForPrompt = input.narrationChunks.map(chunk => {
                let promptCount: number;
                if (chunk.duration <= 5) promptCount = 1;
                else if (chunk.duration <= 10) promptCount = chunk.text.length > 100 ? 2 : 1;
                else if (chunk.duration <= 15) promptCount = 2;
                else promptCount = 3;
                return { text: chunk.text, duration: chunk.duration, promptCount };
            });
            numImages = chunksDataForPrompt.reduce((total, chunk) => total + chunk.promptCount, 0);
        } else {
            numImages = Math.max(1, Math.ceil(input.audioDurationSeconds * (5 / 60)));
        }

        let finalPrompt = imagePromptsPromptTemplate
            .replace('{{{characterPrompts}}}', input.characterPrompts || '')
            .replace('{{{locationPrompts}}}', input.locationPrompts || '')
            .replace('{{{itemPrompts}}}', input.itemPrompts || '')
            .replace('{{{script}}}', input.script);
        
        if (chunksDataForPrompt) {
            const chunkDetailsText = chunksDataForPrompt.map((c, i) => `Chunk ${i}: "${c.text}" (Duration: ${c.duration}s, Required prompts: ${c.promptCount})`).join('\n');
            finalPrompt = finalPrompt.replace('{{#if chunksData}}Chunk Details:{{#each chunksData}}...{{/each}}{{else}}Fallback Mode{{/if}}', `Chunk Details:\n${chunkDetailsText}`);
        } else {
            finalPrompt = finalPrompt.replace('{{#if chunksData}}Chunk Details:{{#each chunksData}}...{{/each}}{{else}}Fallback Mode{{/if}}', `Fallback Mode: Analyze the script and identify ${numImages} key scenes...`);
        }
        finalPrompt = finalPrompt.replace('{{numImages}}', numImages.toString());


        const { output } = await localAi.generate({
            prompt: finalPrompt,
            output: { schema: AIImagePromptsOutputSchema, format: 'json' },
            config: { temperature: 0.7, maxOutputTokens: 4096 }
        });

        if (!output || !Array.isArray(output.imagePrompts)) {
          console.warn("Image prompt generation did not return the expected array structure. Output:", output);
          return { success: false, error: "AI did not return valid image prompts." };
        }
        
        return { success: true, data: output };
    } catch (error) {
        console.error("Error in generateImagePrompts AI call:", error);
        return { success: false, error: "Failed to generate image prompts with user's key." };
    }
}

export async function generateScriptChunks(input: GenerateScriptChunksInput): Promise<{ success: boolean, data?: Omit<AIScriptChunksOutputSchemaOriginal, 'error'>, error?: string }> {
    const userKeysResult = await getUserApiKeys(input.userId);
    if (!userKeysResult.success || !userKeysResult.data?.googleApiKey) {
      return { success: false, error: "Google API key not configured by user. Please set it in Account Settings." };
    }
    const userGoogleKey = userKeysResult.data.googleApiKey;

    try {
        const localAi = genkit({ plugins: [googleAI({ apiKey: userGoogleKey })], model: 'googleai/gemini-2.0-flash' });
        const prompt = scriptChunksPromptTemplate.replace('{{{script}}}', input.script);

        const { output } = await localAi.generate({
            prompt,
            output: { schema: AIScriptChunksOutputSchema, format: 'json' },
            config: { temperature: 0.3, maxOutputTokens: 2048 }
        });

        if (output && output.scriptChunks && Array.isArray(output.scriptChunks)) {
          const nonEmptyChunks = output.scriptChunks.filter(chunk => chunk.trim().length > 0);
          return { success: true, data: { scriptChunks: nonEmptyChunks } };
        }
        console.error('AI did not return the expected scriptChunks array:', output);
        return { success: false, error: 'Failed to parse script chunks from AI response.' };
    } catch (error) {
        console.error("Error in generateScriptChunks AI call:", error);
        return { success: false, error: "Failed to generate script chunks with user's key." };
    }
}


interface FirebaseErrorWithCode extends Error {
  code?: string;
}


async function refreshFirebaseStorageUrl(url: string, userId: string, storyId: string, filePath?: string): Promise<string | null> {
  if (!url || typeof url !== 'string') return null;
  
  const bucketName = getStorageBucket();
  if (!bucketName || !url.includes(bucketName)) return null;
  
  try {
    console.log(`[refreshFirebaseStorageUrl] Refreshing signed URL for: ${url}`);
    
    if (!firebaseAdmin.apps.length || !firebaseAdmin.app()) {
      console.error("[refreshFirebaseStorageUrl] Firebase Admin SDK app is not initialized.");
      return null;
    }
    
    const adminAppInstance = firebaseAdmin.app();
    const storage = getAdminStorage(adminAppInstance);
    const bucket = storage.bucket(bucketName);
    
    if (!filePath) {
      try {
        const urlObj = new URL(url);
        const pathMatch = urlObj.pathname.match(/\/o\/(.+?)(?:\?|$)/);
        if (pathMatch && pathMatch[1]) {
          filePath = decodeURIComponent(pathMatch[1]);
          console.log(`[refreshFirebaseStorageUrl] Extracted file path from URL: ${filePath}`);
        } else {
          console.warn(`[refreshFirebaseStorageUrl] Unable to extract file path from URL: ${url}`);
          return null;
        }
      } catch (error) {
        console.warn(`[refreshFirebaseStorageUrl] URL parsing failed for: ${url}`, error);
        return null;
      }
    }
    
    const file = bucket.file(filePath);
    
    const [exists] = await file.exists();
    if (!exists) {
      console.warn(`[refreshFirebaseStorageUrl] File does not exist at path: ${filePath}`);
      return null;
    }
    
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 1000 * 60 * 60 * 24 * 7 
    });
    
    console.log(`[refreshFirebaseStorageUrl] Generated new signed URL valid for 7 days: ${signedUrl}`);
    return signedUrl;
  } catch (error) {
    console.error("[refreshFirebaseStorageUrl] Error refreshing signed URL:", error);
    return null;
  }
}

export async function getStory(storyId: string, userId: string): Promise<{ success: boolean; data?: Story; error?: string }> {
  if (!dbAdmin) {
    console.error("[getStory Action] Firebase Admin SDK (dbAdmin) is not initialized. Cannot fetch story. Check server logs for firebaseAdmin.ts output.");
    return { success: false, error: "Server configuration error: Database connection not available. Please contact support or check server logs." };
  }
  if (!userId) {
    console.warn("[getStory Action] Attempt to fetch story without userId.");
    return { success: false, error: "User not authenticated." };
  }
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Firebase connection timeout")), 10000);
    });
    
    const fetchPromise = async () => {
      if (!dbAdmin) {
        throw new Error("Firebase Admin SDK not initialized");
      }
      const storyRef = dbAdmin.collection("stories").doc(storyId);
      const docSnap = await storyRef.get();
      return { docSnap, storyRef };
    };
    
    const { docSnap, storyRef } = await Promise.race([fetchPromise(), timeoutPromise]);

    if (docSnap.exists) {
      const storyData = docSnap.data();
      const story = { id: docSnap.id, ...storyData } as Story;
      
      if (story.userId !== userId && storyData?.['_testMarker'] !== "BASIC_SAVE_TEST_DOCUMENT_V2") {
        console.warn(`[getStory Action] User ${userId} fetched story ${storyId} belonging to ${story.userId}. This is expected if rules permit or for admin access.`);
      }

      if (story.createdAt && typeof (story.createdAt as any).toDate === 'function') {
        story.createdAt = (story.createdAt as AdminTimestamp).toDate();
      }
      if (story.updatedAt && typeof (story.updatedAt as any).toDate === 'function') {
        story.updatedAt = (story.updatedAt as AdminTimestamp).toDate();
      }
      
      if (story.narrationAudioUrl) {
        const refreshedUrl = await refreshFirebaseStorageUrl(story.narrationAudioUrl, userId, storyId);
        if (refreshedUrl) {
          console.log(`[getStory Action] Refreshed narrationAudioUrl from: ${story.narrationAudioUrl} to: ${refreshedUrl}`);
          story.narrationAudioUrl = refreshedUrl;
          await storyRef.update({ narrationAudioUrl: refreshedUrl });
        }
      }
      
      if (story.narrationChunks && Array.isArray(story.narrationChunks) && story.narrationChunks.length > 0) {
        let hasUpdatedChunks = false;
        const refreshedChunks = await Promise.all(story.narrationChunks.map(async (chunk) => {
          if (chunk && chunk.audioUrl) {
            const refreshedUrl = await refreshFirebaseStorageUrl(chunk.audioUrl, userId, storyId);
            if (refreshedUrl) {
              console.log(`[getStory Action] Refreshed chunk audio URL from: ${chunk.audioUrl} to: ${refreshedUrl}`);
              hasUpdatedChunks = true;
              return { ...chunk, audioUrl: refreshedUrl };
            }
          }
          return chunk;
        }));
        
        if (hasUpdatedChunks) {
          story.narrationChunks = refreshedChunks;
          await storyRef.update({ narrationChunks: refreshedChunks });
        }
      }
      
      if (story.generatedImages && Array.isArray(story.generatedImages) && story.generatedImages.length > 0) {
        let hasUpdatedImages = false;
        const refreshedImages = await Promise.all(story.generatedImages.map(async (image) => {
          if (image && image.imageUrl) {
            const refreshedUrl = await refreshFirebaseStorageUrl(image.imageUrl, userId, storyId);
            if (refreshedUrl) {
              console.log(`[getStory Action] Refreshed image URL from: ${image.imageUrl} to: ${refreshedUrl}`);
              hasUpdatedImages = true;
              return { ...image, imageUrl: refreshedUrl };
            }
          }
          return image;
        }));
        
        if (hasUpdatedImages) {
          story.generatedImages = refreshedImages;
          await storyRef.update({ generatedImages: refreshedImages });
        }
      }
      
      return { success: true, data: story };
    } else {
      return { success: false, error: "Story not found." };
    }
  } catch (error) {
    console.error("[getStory Action] Error fetching story from Firestore (Admin SDK):", error);
    let errorMessage = "Failed to fetch story.";
    const firebaseError = error as FirebaseErrorWithCode;
    
    if (error instanceof Error && error.message === "Firebase connection timeout") {
      console.error("[getStory Action] Firebase connection timed out. Possible network or ad blocker issue.");
      return {
        success: false,
        error: "Connection to Firebase timed out. If you're using an ad blocker or privacy extension, please disable it for this site."
      };
    } else if (firebaseError && firebaseError.code) {
      errorMessage = `Failed to fetch story (Admin SDK): ${firebaseError.message} (Code: ${firebaseError.code})`;
      if (firebaseError.code === 'permission-denied' || (typeof firebaseError.code === 'number' && firebaseError.code === 7)) {
        console.error("[getStory Action] PERMISSION DENIED while fetching. Check Firestore rules and IAM for service account.");
      } else if (firebaseError.code === 'unavailable' || firebaseError.code === 'resource-exhausted') {
        return {
          success: false,
          error: "Firebase connection unavailable. If you're using an ad blocker or privacy extension, please disable it for this site."
        };
      }
    } else if (error instanceof Error) {
      errorMessage = `Failed to fetch story (Admin SDK): ${error.message}`;
      if (error.message.includes('network') ||
          error.message.includes('connection') ||
          error.message.includes('ERR_BLOCKED_BY_CLIENT') ||
          error.message.includes('ERR_HTTP2_PROTOCOL_ERROR')) {
        return {
          success: false,
          error: "Firebase connection failed. If you're using an ad blocker or privacy extension, please disable it for this site."
        };
      }
    }
    return { success: false, error: errorMessage };
  }
}

export async function generateImageFromGemini(
  originalPrompt: string,
  userId: string, 
  storyId?: string
): Promise<{ success: boolean; imageUrl?: string; error?: string; requestPrompt?: string }> {
  const userKeysResult = await getUserApiKeys(userId);
  if (!userKeysResult.success || !userKeysResult.data?.geminiApiKey) {
    return { success: false, error: "Gemini API key not configured by user. Please set it in Account Settings." };
  }
  const apiKey = userKeysResult.data.geminiApiKey;

  const styles = "3D, Cartoon, High Quality, 16:9 aspect ratio, detailed, sharp, professional photography";
  const requestPrompt = originalPrompt ? `${originalPrompt}, ${styles}` : styles;

  try {
    console.log(`Calling Gemini API with prompt: "${requestPrompt}" using user's key.`);
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: requestPrompt }
          ]
        }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API Error Response:", errorText);
      return { success: false, error: `Gemini API request failed: ${response.status}`, requestPrompt };
    }

    const result = await response.json();
    const candidate = result.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    
    let imageData = null;
    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        imageData = part.inlineData.data;
        break;
      }
    }

    if (!imageData) {
      return { success: false, error: "No image data returned from Gemini API", requestPrompt };
    }

    if (userId && storyId) {
      try {
        const safePrompt = originalPrompt.substring(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const imageName = `gemini_${Date.now()}_${safePrompt}`;
        const imageBuffer = Buffer.from(imageData, 'base64');
        const firebaseUrl = await uploadImageBufferToFirebaseStorage(imageBuffer, userId, storyId, imageName, 'image/png');
        return { success: true, imageUrl: firebaseUrl, requestPrompt };
      } catch (uploadError) {
        console.error("Error uploading image to Firebase Storage:", uploadError);
        return { success: true, imageUrl: `data:image/png;base64,${imageData}`, requestPrompt };
      }
    }
    return { success: true, imageUrl: `data:image/png;base64,${imageData}`, requestPrompt };
  } catch (error: any) {
    console.error("Error calling Gemini API:", error);
    return { success: false, error: error.message || "An unknown error occurred while generating the image.", requestPrompt };
  }
}

export async function generateImageFromImagen3(
  originalPrompt: string,
  userId: string, 
  storyId?: string,
  styleId?: string
): Promise<{ success: boolean; imageUrl?: string; error?: string; requestPrompt?: string }> {
  const userKeysResult = await getUserApiKeys(userId);
  if (!userKeysResult.success || !userKeysResult.data?.googleApiKey) {
    return { success: false, error: "Google API key for Imagen3 not configured by user. Please set it in Account Settings." };
  }
  const apiKey = userKeysResult.data.googleApiKey; 

  let requestPrompt = originalPrompt;
  if (userId && storyId) {
    try {
      const storyResult = await getStory(storyId, userId);
      if (storyResult.success && storyResult.data) {
        const { nameToReference, extractEntityNames } = await import('@/app/(app)/assemble-video/utils');
        const entityReferences = originalPrompt.match(/@[A-Za-z0-9]+/g) || [];
        if (entityReferences.length > 0) {
          const entityNames = extractEntityNames(storyResult.data);
          let placeholderDescriptions = "";
          for (const ref of entityReferences) {
            const entityName = ref.substring(1).trim();
            let actualEntityName: string | null = null;
            let entityType: 'character' | 'item' | 'location' | null = null;
            for (const characterName of entityNames.characters) { if (nameToReference(characterName) === ref) { actualEntityName = characterName; entityType = 'character'; break; } }
            if (!actualEntityName) { for (const itemName of entityNames.items) { if (nameToReference(itemName) === ref) { actualEntityName = itemName; entityType = 'item'; break; } } }
            if (!actualEntityName) { for (const locationName of entityNames.locations) { if (nameToReference(locationName) === ref) { actualEntityName = locationName; entityType = 'location'; break; } } }
            if (actualEntityName && entityType) {
              const promptsSection = entityType === 'character' ? storyResult.data.detailsPrompts?.characterPrompts || '' : entityType === 'item' ? storyResult.data.detailsPrompts?.itemPrompts || '' : storyResult.data.detailsPrompts?.locationPrompts || '';
              const entityPattern = new RegExp(actualEntityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "\\s*\\n+(.*?)(?=\\n\\n|$)", "s");
              const entityMatch = promptsSection.match(entityPattern);
              if (entityMatch && entityMatch[1]) {
                placeholderDescriptions += `${actualEntityName}, ${entityMatch[1].trim()}\n-----------\n`;
              }
            }
          }
          if (placeholderDescriptions) { requestPrompt = `${placeholderDescriptions}${originalPrompt}`; }
        }
      }
    } catch (error) { console.warn("[generateImageFromImagen3] Error processing placeholders:", error); }
  }
  
  if (styleId) {
    try {
      const { applyStyleToPrompt } = await import('@/utils/imageStyleUtils');
      requestPrompt = applyStyleToPrompt(requestPrompt || originalPrompt, styleId as any, 'imagen3');
    } catch (error) { console.warn("[generateImageFromImagen3] Failed to apply style:", error); }
  } else if (userId && storyId) {
    try {
      const storyResult = await getStory(storyId, userId);
      if (storyResult.success && storyResult.data?.imageStyleId) {
        const { applyStyleToPrompt } = await import('@/utils/imageStyleUtils');
        requestPrompt = applyStyleToPrompt(requestPrompt || originalPrompt, storyResult.data.imageStyleId as any, 'imagen3');
      }
    } catch (error) { console.warn("[generateImageFromImagen3] Failed to apply style from story:", error); }
  }

  try {
    console.log(`Calling Imagen 3 API with prompt: "${requestPrompt}" using user's key.`);
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt: requestPrompt }],
        parameters: { sampleCount: 1, aspectRatio: "16:9", personGeneration: "ALLOW_ADULT" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Imagen 3 API Error Response:", errorText);
      return { success: false, error: `Imagen 3 API request failed: ${response.status}`, requestPrompt };
    }
    const result = await response.json();
    const predictions = result.predictions;
    if (!predictions || predictions.length === 0) {
      return { success: false, error: "No image data returned from Imagen 3 API", requestPrompt };
    }
    const imageData = predictions[0]?.bytesBase64Encoded;
    if (!imageData) {
      return { success: false, error: "No image bytes in Imagen 3 response", requestPrompt };
    }

    if (userId && storyId) {
      try {
        const safePrompt = originalPrompt.substring(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const imageName = `imagen3_${Date.now()}_${safePrompt}`;
        const imageBuffer = Buffer.from(imageData, 'base64');
        const firebaseUrl = await uploadImageBufferToFirebaseStorage(imageBuffer, userId, storyId, imageName, 'image/png');
        return { success: true, imageUrl: firebaseUrl, requestPrompt };
      } catch (uploadError) {
        console.error("Error uploading image to Firebase Storage:", uploadError);
        return { success: true, imageUrl: `data:image/png;base64,${imageData}`, requestPrompt };
      }
    }
    return { success: true, imageUrl: `data:image/png;base64,${imageData}`, requestPrompt };
  } catch (error: any) {
    console.error("Error calling Imagen 3 API:", error);
    return { success: false, error: error.message || "An unknown error occurred while generating the image.", requestPrompt };
  }
}

export async function generateImageFromPrompt(
  originalPrompt: string,
  userId: string, 
  storyId?: string,
  provider: 'picsart' | 'gemini' | 'imagen3' = 'picsart',
  styleId?: string
): Promise<{ success: boolean; imageUrl?: string; error?: string; requestPrompt?: string }> {
  if (provider === 'gemini') {
    return generateImageFromGemini(originalPrompt, userId, storyId);
  }
  
  if (provider === 'imagen3') {
    return generateImageFromImagen3(originalPrompt, userId, storyId, styleId);
  }
  
  const userKeysResult = await getUserApiKeys(userId);
  if (!userKeysResult.success || !userKeysResult.data?.picsartApiKey) {
    return { success: false, error: "Picsart API key not configured by user. Please set it in Account Settings." };
  }
  const picsartApiKey = userKeysResult.data.picsartApiKey;

  let processedPrompt = originalPrompt;
  if (userId && storyId) {
    try {
      const storyResult = await getStory(storyId, userId);
      if (storyResult.success && storyResult.data) {
        const { parseEntityReferences } = await import('@/app/(app)/assemble-video/utils');
        processedPrompt = parseEntityReferences(originalPrompt, storyResult.data);
      }
    } catch (error) { console.warn("Failed to replace placeholders, using original prompt:", error); }
  }

  let finalPrompt = processedPrompt || "high quality image";
  if (styleId) {
    try {
      const { applyStyleToPrompt } = await import('@/utils/imageStyleUtils');
      finalPrompt = applyStyleToPrompt(finalPrompt, styleId as any, provider);
    } catch (error) { console.warn("Failed to apply style:", error); }
  } else if (userId && storyId) {
    try {
      const storyResult = await getStory(storyId, userId);
      if (storyResult.success && storyResult.data?.imageStyleId) {
        const { applyStyleToPrompt } = await import('@/utils/imageStyleUtils');
        finalPrompt = applyStyleToPrompt(finalPrompt, storyResult.data.imageStyleId as any, provider);
      }
    } catch (error) { console.warn("Failed to apply style from story:", error); }
  }
  
  const requestPrompt = finalPrompt;
  const negativePrompt = "ugly, tiling, poorly drawn hands, poorly drawn feet, poorly drawn face, out of frame, extra limbs, disfigured, deformed, body out of frame, blurry, bad anatomy, blurred, watermark, grainy, signature, cut off, draft, low quality, worst quality, SFW, text, words, letters, nsfw, nude";
  const width = 1024; const height = 576; const count = 1;

  try {
    console.log(`Calling Picsart API with prompt: "${requestPrompt}" using user's key.`);
    const response = await fetch("https://genai-api.picsart.io/v1/text2image", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-picsart-api-key": picsartApiKey },
      body: JSON.stringify({ prompt: requestPrompt, negativePrompt, width, height, count }),
    });

    const responseText = await response.text();
    if (!response.ok) {
      console.error("PicsArt API Error Response Text:", responseText);
      let errorData;
      try { errorData = JSON.parse(responseText); } catch (e) { errorData = { message: `PicsArt API request failed with status ${response.status}. Response: ${responseText}` }; }
      return { success: false, error: errorData.message || errorData.title || `PicsArt API request failed: ${response.status}`, requestPrompt };
    }

    const result = JSON.parse(responseText);
    if (response.status === 202 && result.status === 'ACCEPTED' && result.inference_id) {
      const pollResult = await pollForPicsArtImage(result.inference_id, picsartApiKey!, requestPrompt);
      if (pollResult.success && pollResult.imageUrl && userId && storyId) {
        try {
          const safePrompt = originalPrompt.substring(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase();
          const imageName = `${Date.now()}_${safePrompt}`;
          const firebaseUrl = await uploadImageToFirebaseStorage(pollResult.imageUrl, userId, storyId, imageName);
          return { success: true, imageUrl: firebaseUrl, requestPrompt: pollResult.requestPrompt };
        } catch (uploadError) {
          console.error("Error uploading image to Firebase Storage:", uploadError);
          return pollResult;
        }
      }
      return pollResult;
    } else if (response.ok && result.data && Array.isArray(result.data) && result.data.length > 0 && result.data[0].url) {
      if (userId && storyId) {
        try {
          const safePrompt = originalPrompt.substring(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase();
          const imageName = `${Date.now()}_${safePrompt}`;
          const firebaseUrl = await uploadImageToFirebaseStorage(result.data[0].url, userId, storyId, imageName);
          return { success: true, imageUrl: firebaseUrl, requestPrompt };
        } catch (uploadError) {
          console.error("Error uploading image to Firebase Storage:", uploadError);
          return { success: true, imageUrl: result.data[0].url, requestPrompt };
        }
      }
      return { success: true, imageUrl: result.data[0].url, requestPrompt };
    } else {
      const errorDetail = `Status: ${response.status}, Body: ${JSON.stringify(result)}`;
      return { success: false, error: `Unexpected response format from PicsArt API after POST. Details: ${errorDetail}`, requestPrompt };
    }
  } catch (error: any) {
    console.error("Error calling PicsArt API:", error);
    return { success: false, error: error.message || "An unknown error occurred while generating the image.", requestPrompt };
  }
}

async function pollForPicsArtImage(
  inferenceId: string,
  apiKey: string,
  requestPrompt: string,
  maxAttempts = 20,
  delayMs = 6000
): Promise<{ success: boolean; imageUrl?: string; error?: string; requestPrompt?: string }> {
  const pollingUrl = `https://genai-api.picsart.io/v1/text2image/inferences/${inferenceId}`;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(pollingUrl, { method: "GET", headers: { "x-picsart-api-key": apiKey } });
      const responseText = await response.text();
      let result;
      try { result = JSON.parse(responseText); } catch (e) {
        if (response.status === 202 && attempt < maxAttempts) { await new Promise(resolve => setTimeout(resolve, delayMs)); continue; }
        return { success: false, error: `PicsArt Polling: Failed to parse JSON. Status: ${response.status}, Body: ${responseText}`, requestPrompt };
      }
      if (response.status === 200) {
        let imageUrl: string | undefined;
        if (result.data && result.data.url) { imageUrl = result.data.url; } 
        else if (result.data && Array.isArray(result.data) && result.data.length > 0 && result.data[0].url) { imageUrl = result.data[0].url; } 
        else if (result.url) { imageUrl = result.url; }
        if (imageUrl) { return { success: true, imageUrl, requestPrompt }; } 
        else { return { success: false, error: "PicsArt Polling: Image success (200 OK) but no URL found.", requestPrompt }; }
      } else if (response.status === 202) {
        if (attempt < maxAttempts) { await new Promise(resolve => setTimeout(resolve, delayMs)); }
      } else {
        return { success: false, error: `PicsArt Polling: Request failed with status ${response.status}. Details: ${JSON.stringify(result)}`, requestPrompt };
      }
    } catch (error: any) {
      if (attempt >= maxAttempts) { return { success: false, error: `PicsArt Polling: Error after multiple attempts: ${error.message}`, requestPrompt }; }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  return { success: false, error: "Image generation timed out after polling.", requestPrompt };
}

async function uploadImageToFirebaseStorage(imageUrl: string, userId: string, storyId: string, imageName: string): Promise<string> {
  if (!firebaseAdmin.apps.length || !firebaseAdmin.app()) { throw new Error("Firebase Admin SDK app not initialized."); }
  const adminAppInstance = firebaseAdmin.app();
  const storage = getAdminStorage(adminAppInstance);
  const bucketName = getStorageBucket();
  if (!bucketName) { throw new Error("Firebase Storage bucket name not configured."); }
  const bucket = storage.bucket(bucketName);
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) { throw new Error(`Failed to fetch image from URL: ${response.statusText}`); }
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const filePath = `users/${userId}/stories/${storyId}/images/${imageName}.jpg`;
    const file = bucket.file(filePath);
    await file.save(imageBuffer, { metadata: { contentType: contentType } });
    const [signedUrl] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 1000 * 60 * 60 * 24 * 7 });
    return signedUrl;
  } catch (error) { throw error; }
}

async function uploadImageBufferToFirebaseStorage(imageBuffer: Buffer, userId: string, storyId: string, imageName: string, contentType: string): Promise<string> {
  if (!firebaseAdmin.apps.length || !firebaseAdmin.app()) { throw new Error("Firebase Admin SDK app not initialized."); }
  const adminAppInstance = firebaseAdmin.app();
  const storage = getAdminStorage(adminAppInstance);
  const bucketName = getStorageBucket();
  if (!bucketName) { throw new Error("Firebase Storage bucket name not configured."); }
  const bucket = storage.bucket(bucketName);
  try {
    const filePath = `users/${userId}/stories/${storyId}/images/${imageName}.png`;
    const file = bucket.file(filePath);
    await file.save(imageBuffer, { metadata: { contentType: contentType } });
    const [signedUrl] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 1000 * 60 * 60 * 24 * 7 });
    return signedUrl;
  } catch (error) { throw error; }
}

async function uploadAudioToFirebaseStorage(audioDataUri: string, userId: string, storyId: string, filename: string): Promise<string> {
  if (!firebaseAdmin.apps.length || !firebaseAdmin.app()) { throw new Error("Firebase Admin SDK app not initialized."); }
  const adminAppInstance = firebaseAdmin.app();
  const storage = getAdminStorage(adminAppInstance);
  const bucketName = getStorageBucket();
  if (!bucketName) { throw new Error("Firebase Storage bucket name not configured."); }
  const bucket = storage.bucket(bucketName);
  let base64Data: string; let contentType: string;
  if (audioDataUri.startsWith('data:audio/mpeg;base64,')) { base64Data = audioDataUri.substring('data:audio/mpeg;base64,'.length); contentType = 'audio/mpeg'; } 
  else if (audioDataUri.startsWith('data:audio/wav;base64,')) { base64Data = audioDataUri.substring('data:audio/wav;base64,'.length); contentType = 'audio/wav'; } 
  else { throw new Error('Invalid audio data URI format.'); }
  const audioBuffer = Buffer.from(base64Data, 'base64');
  const filePath = `users/${userId}/stories/${storyId}/narration_chunks/${filename}`;
  const file = bucket.file(filePath);
  await file.save(audioBuffer, { metadata: { contentType: contentType } });
  const [signedUrl] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 1000 * 60 * 60 * 24 * 7 });
  return signedUrl;
}

export async function cleanupBrokenImages(storyId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  if (!dbAdmin) { return { success: false, error: "Database connection not available" }; }
  try {
    const storyRef = dbAdmin.collection('stories').doc(storyId);
    const storyDoc = await storyRef.get();
    if (!storyDoc.exists) { return { success: false, error: "Story not found" }; }
    const storyData = storyDoc.data() as any;
    let updated = false; const updateData: any = {};
    if (storyData.generatedImages && Array.isArray(storyData.generatedImages)) {
      const cleanGeneratedImages = storyData.generatedImages.filter((img: any) => {
        if (img.imageUrl && img.imageUrl.includes('aicdn.picsart.com')) { return false; }
        if (img.imageUrl && img.imageUrl.includes('.mp3')) { return false; }
        return true;
      });
      if (cleanGeneratedImages.length !== storyData.generatedImages.length) { updateData.generatedImages = cleanGeneratedImages; updated = true; }
    }
    if (storyData.detailImages && Array.isArray(storyData.detailImages)) {
      const cleanDetailImages = storyData.detailImages.filter((img: any) => {
        if (img.imageUrl && img.imageUrl.includes('aicdn.picsart.com')) { return false; }
        return true;
      });
      if (cleanDetailImages.length !== storyData.detailImages.length) { updateData.detailImages = cleanDetailImages; updated = true; }
    }
    if (updated) {
      updateData.updatedAt = firebaseAdmin.firestore.FieldValue.serverTimestamp();
      await storyRef.update(updateData);
    }
    return { success: true };
  } catch (error) { return { success: false, error: `Failed to cleanup broken images: ${error}` }; }
}

export async function saveStory(storyData: Story, userId: string): Promise<{ success: boolean; storyId?: string; error?: string, data?: { narrationAudioUrl?: string} }> {
  if (!dbAdmin) { return { success: false, error: "Server configuration error: Database connection (dbAdmin) is not available." }; }
  if (!userId || typeof userId !== 'string' || userId.trim() === '') { return { success: false, error: "User not authenticated or user ID is invalid." }; }
  const storyIdForPath = storyData.id || dbAdmin.collection("stories").doc().id; 
  const processedStoryData = { ...storyData };
  let newNarrationUrl: string | undefined = undefined;
  if (processedStoryData.narrationAudioUrl && processedStoryData.narrationAudioUrl.startsWith('data:audio/mpeg;base64,')) {
    try {
      const defaultFilename = "uploaded_narration.mp3";
      const storageUrl = await uploadAudioToFirebaseStorage(processedStoryData.narrationAudioUrl, userId, storyIdForPath, defaultFilename);
      processedStoryData.narrationAudioUrl = storageUrl;
      newNarrationUrl = storageUrl;
    } catch (uploadError: any) {
      let detailedErrorMessage = `Failed to upload narration audio: ${uploadError.message || String(uploadError)}`;
      if (uploadError.errors && Array.isArray(uploadError.errors) && uploadError.errors.length > 0) { detailedErrorMessage += ` Details: ${uploadError.errors.map((e: any) => e.message || JSON.stringify(e)).join(', ')}`; } 
      else if (uploadError.code) { detailedErrorMessage += ` (Code: ${uploadError.code})`; }
      return { success: false, error: detailedErrorMessage };
    }
  }
  const dataToSave: any = { ...processedStoryData, userId: userId, updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp() };
  if (dataToSave.id) { delete dataToSave.id; }
  if (dataToSave.createdAt && dataToSave.createdAt instanceof Date) { dataToSave.createdAt = firebaseAdmin.firestore.Timestamp.fromDate(dataToSave.createdAt); }
  if (dataToSave.detailsPrompts && Object.keys(dataToSave.detailsPrompts).length === 0) { delete dataToSave.detailsPrompts; } 
  else if (dataToSave.detailsPrompts === undefined) { delete dataToSave.detailsPrompts; }
  if (dataToSave.imagePrompts === undefined) delete dataToSave.imagePrompts; else if (!Array.isArray(dataToSave.imagePrompts)) dataToSave.imagePrompts = []; 
  if (dataToSave.generatedImages === undefined) delete dataToSave.generatedImages; else if (!Array.isArray(dataToSave.generatedImages)) dataToSave.generatedImages = []; 
  if (dataToSave.elevenLabsVoiceId === undefined) { delete dataToSave.elevenLabsVoiceId; }
  Object.keys(dataToSave).forEach(key => { if (dataToSave[key] === undefined) { delete dataToSave[key]; } });
  try {
    if (storyData.id) { 
      const storyRef = dbAdmin.collection("stories").doc(storyData.id);
      const docSnap = await storyRef.get();
      if (!docSnap.exists) { return { success: false, error: "Story not found. Cannot update." }; }
      const existingStoryData = docSnap.data();
      if (existingStoryData?.userId !== userId) { return { success: false, error: "Unauthorized: You can only update your own stories." }; }
      if ('createdAt' in dataToSave && existingStoryData?.createdAt) { delete dataToSave.createdAt; }
      await storyRef.update(dataToSave);
      revalidatePath('/dashboard');
      revalidatePath(`/create-story?storyId=${storyData.id}`);
      return { success: true, storyId: storyData.id, data: { narrationAudioUrl: newNarrationUrl || storyData.narrationAudioUrl } };
    } else {
      dataToSave.createdAt = firebaseAdmin.firestore.FieldValue.serverTimestamp(); 
      const storyRef = dbAdmin.collection("stories").doc(storyIdForPath);
      await storyRef.set(dataToSave);
      revalidatePath('/dashboard');
      return { success: true, storyId: storyIdForPath, data: { narrationAudioUrl: newNarrationUrl } };
    }
  } catch (error) {
    let errorMessage = "Failed to save story.";
    const firebaseError = error as FirebaseErrorWithCode;
    if (firebaseError && firebaseError.code) { errorMessage = `Failed to save story (Firestore Error): ${firebaseError.message} (Code: ${firebaseError.code})`; } 
    else if (error instanceof Error) { errorMessage = `Failed to save story: ${error.message}`; }
    return { success: false, error: errorMessage };
  }
}

export async function updateStoryTimeline(
  storyId: string,
  userId: string,
  timelineTracks: Story['timelineTracks']
): Promise<{ success: boolean; error?: string }> {
  if (!dbAdmin) { return { success: false, error: "Server configuration error: Database connection (dbAdmin) is not available." }; }
  if (!userId || typeof userId !== 'string' || userId.trim() === '') { return { success: false, error: "User not authenticated or user ID is invalid." }; }
  if (!storyId) { return { success: false, error: "Story ID is required to update the timeline." }; }
  try {
    const storyRef = dbAdmin.collection("stories").doc(storyId);
    const docSnap = await storyRef.get();
    if (!docSnap.exists) { return { success: false, error: "Story not found. Cannot update timeline." }; }
    const existingStoryData = docSnap.data();
    if (existingStoryData?.userId !== userId) { return { success: false, error: "Unauthorized: You can only update the timeline of your own stories." }; }
    const dataToUpdate = { timelineTracks: timelineTracks, updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp() };
    await storyRef.update(dataToUpdate);
    revalidatePath(`/assemble-video?storyId=${storyId}`);
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    let errorMessage = "Failed to update story timeline.";
    const firebaseError = error as FirebaseErrorWithCode;
    if (firebaseError && firebaseError.code) { errorMessage = `Failed to update story timeline (Firestore Error): ${firebaseError.message} (Code: ${firebaseError.code})`; } 
    else if (error instanceof Error) { errorMessage = `Failed to update story timeline: ${error.message}`; }
    return { success: false, error: errorMessage };
  }
}

export async function deleteStory(
  storyId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  if (!dbAdmin) { return { success: false, error: "Server configuration error: Database connection (dbAdmin) is not available." }; }
  if (!userId || typeof userId !== 'string' || userId.trim() === '') { return { success: false, error: "User not authenticated or user ID is invalid." }; }
  if (!storyId) { return { success: false, error: "Story ID is required to delete the story." }; }
  try {
    const storyRef = dbAdmin.collection("stories").doc(storyId);
    const docSnap = await storyRef.get();
    if (!docSnap.exists) { return { success: false, error: "Story not found." }; }
    const existingStoryData = docSnap.data();
    if (existingStoryData?.userId !== userId) { return { success: false, error: "Unauthorized: You can only delete your own stories." }; }
    const bucketName = getStorageBucket();
    if (!bucketName) { return { success: false, error: "Firebase Storage bucket name is not configured." }; }
    const adminAppInstance = firebaseAdmin.app();
    const storage = getAdminStorage(adminAppInstance);
    const bucket = storage.bucket(bucketName);
    const storageBasePath = `users/${userId}/stories/${storyId}`;
    try {
      const [files] = await bucket.getFiles({ prefix: storageBasePath });
      if (files.length > 0) {
        const deletePromises = files.map(file => file.delete().catch(error => console.error(`Failed to delete file ${file.name}:`, error)));
        await Promise.all(deletePromises);
      }
    } catch (storageError) { console.error(`Error deleting storage files for story ${storyId}:`, storageError); }
    await storyRef.delete();
    revalidatePath('/dashboard');
    revalidatePath(`/create-story?storyId=${storyId}`);
    return { success: true };
  } catch (error) {
    let errorMessage = "Failed to delete story.";
    const firebaseError = error as FirebaseErrorWithCode;
    if (firebaseError && firebaseError.code) { errorMessage = `Failed to delete story (Firestore Error): ${firebaseError.message} (Code: ${firebaseError.code})`; } 
    else if (error instanceof Error) { errorMessage = `Failed to delete story: ${error.message}`; }
    return { success: false, error: errorMessage };
  }
}
    

    
