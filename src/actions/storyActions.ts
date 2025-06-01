"use server";

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';

// Import Input/Output schemas from the original flow files - STATIC IMPORTS
import {
  GenerateCharacterPromptsInputSchema as AICharacterPromptsInputSchemaOriginal,
  GenerateCharacterPromptsOutputSchema as AICharacterPromptsOutputSchemaOriginal
} from '@/ai/flows/generate-character-prompts-types';

import {
  GenerateImagePromptsInputSchema as AIImagePromptsInputSchemaOriginal,
  GenerateImagePromptsOutputSchema as AIImagePromptsOutputSchemaOriginal
} from '@/ai/flows/generate-image-prompts-types';

import {
  GenerateNarrationAudioInputSchema as AINarrationAudioInputSchemaFlow, // Renaming to match schema convention
  GenerateNarrationAudioOutputSchema as AINarrationAudioOutputSchemaFlow, // Renaming to match schema convention
  type GenerateNarrationAudioInput as AINarrationAudioInputType,
  type GenerateNarrationAudioOutput as AINarrationAudioOutputType
} from '@/ai/flows/generate-narration-audio-types';


import {
  GenerateScriptInputSchema as AIScriptInputSchemaOriginal,
  GenerateScriptOutputSchema as AIScriptOutputSchemaOriginal
} from '@/ai/flows/generate-script-types';

import {
  GenerateTitleInputSchema as AITitleInputSchemaOriginal,
  GenerateTitleOutputSchema as AITitleOutputSchemaOriginal
} from '@/ai/flows/generate-title-types';

import {
  GenerateScriptChunksInputSchema as AIScriptChunksInputSchemaOriginal,
  GenerateScriptChunksOutputSchema as AIScriptChunksOutputSchemaOriginal
} from '@/ai/flows/generate-script-chunks-types';

import {
  AITitleInputSchema,
  AITitleOutputSchema,
  GenerateTitleInputServerSchema,
  type GenerateTitleInput,
  AIScriptInputSchema,
  AIScriptOutputSchema,
  GenerateScriptInputServerSchema,
  type GenerateScriptInput,
  AICharacterPromptsInputSchema,
  AICharacterPromptsOutputSchema,
  GenerateCharacterPromptsInputServerSchema,
  type GenerateCharacterPromptsInput,
  AIImagePromptsInputSchema,
  AIImagePromptsOutputSchema,
  GenerateImagePromptsInputServerSchema,
  type GenerateImagePromptsInput,
  AIScriptChunksInputSchema,
  AIScriptChunksOutputSchema,
  GenerateScriptChunksInputServerSchema,
  type GenerateScriptChunksInput
} from './storyActionSchemas';


import { firebaseAdmin, dbAdmin } from '@/lib/firebaseAdmin';
import type { Story, ElevenLabsVoice, GeneratedImage } from '@/types/story';
import type { Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
// import { getStorage as getAdminStorage } from 'firebase-admin/storage'; Removed unused import
import { revalidatePath } from 'next/cache';
import { getUserApiKeys } from './apiKeyActions';
import type { UserApiKeys } from '@/types/apiKeys';
import { 
  uploadAudioToFirebaseStorage, 
  uploadImageToFirebaseStorage, 
  uploadImageBufferToFirebaseStorage 
} from './firebaseStorageActions'; // Import necessary storage actions

// Prompt templates (extracted or simplified from original flow files)
const titlePromptTemplate = 'You are an expert at creating catchy and concise titles for stories.\n' +
'Based on the user\'s story prompt, generate a short title (ideally 3-7 words, maximum 10 words) that captures the essence of the story.\n' +
'User Prompt: "{{userPrompt}}"\n' +
'Generated Title:';

const scriptPromptTemplate = 'You are a script writer for animated videos. Your task is to generate a script based on the user\'s prompt.\n' +
'The script should be engaging for both children and adults, and should follow the themes, character descriptions, and story twists provided in the prompt.\n' +
'Importantly, the entire script must be written from the perspective of a single narrator. Do not include character dialogues unless the narrator is quoting them. The narrative should flow as if one person is telling the entire story.\n' +
'Ensure the script maintains a specific word count for optimal engagement.\n' +
'User Prompt: {{{prompt}}}\n' +
'Generated Script (for single narrator):';

const characterPromptsPromptTemplate = 'You are an expert prompt engineer specializing in creating descriptions for text-to-image AI models (like DALL-E, Midjourney, or Flux Dex model).\n' +
'Based on the following story script, generate detailed visual descriptions for the main characters, key items, and important locations.\n' +
'These descriptions will be used as prompts for an AI image generator to create visuals for the story.\n\n' +
'{{#if stylePrompt}}\n' +
'**ARTISTIC STYLE REQUIREMENTS:**\n' +
'Incorporate these style characteristics into all descriptions: {{{stylePrompt}}}\n' +
'Ensure that character, item, and location descriptions align with this artistic style while maintaining their unique features.\n' +
'{{/if}}\n\n' +
'Script:\n' +
'{{{script}}}\n\n' +
'Instructions for output:\n' +
'1.  For each category (Characters, Items, Locations), provide a heading (e.g., "Character Prompts:", "Item Prompts:", "Location Prompts:"). This heading MUST be part of the string for that category and appear at the very beginning of that category\'s section.\n' +
'2.  Under each heading, list the entities. For each entity:\n' +
'    *   **First line:** The name of the character, item, or location. Names should be easy to convert to @ references (e.g., "Rosie Recycle" → @RosieRecycle, "Old Man Grumbles" → @OldManGrumbles, "Magic Sword" → @MagicSword).\n' +
'    *   **Subsequent lines:** Starting on the line immediately following the name, provide a detailed visual description suitable for a text-to-image model. This description MUST:\n' +
'        *   Be entirely in **lowercase**.\n' +
'        *   Be a **single sentence**.\n' +
'        *   **Not end** with any punctuation marks like \'.\', \'?\', or \'!\'.\n' +
'        *   **MANDATORY for characters**: Include specific physical traits for consistency:\n' +
'            - Hair color and style (e.g., "brown hair", "blonde hair", "curly red hair", "long black hair")\n' +
'            - Eye color (e.g., "blue eyes", "green eyes", "brown eyes")\n' +
'            - Skin tone if relevant (e.g., "pale skin", "tan skin", "dark skin")\n' +
'            - Age descriptors (e.g., "young girl", "elderly man", "teenage boy")\n' +
'            - Key identifying features (clothing, accessories, distinctive marks)\n' +
'        *   Focus on visual attributes: appearance, attire, textures, colors, age, mood, specific features, and any other visual details. Be descriptive and evocative.\n' +
'3.  Ensure **exactly one blank line** separates each complete entity\'s entry (name + description) from the next entity within the same category. Do not use more than one blank line.\n\n' +
'Example of desired output format and style (the content below is an example of the style and formatting you should follow, generate your own content based on the script):\n\n' +
'Character Prompts:\n' +
'Ember\n' +
'a tiny house cat-sized dragon with dull smoky grey scales, large hopeful bright orange eyes, small crumpled wings, a perpetually worried expression, blunt claws and tiny teeth\n\n' +
'Ignis\n' +
'an ancient wise dragon with cooled lava-colored scales cracked and weathered with age, glowing inner fire eyes, long braided beard with glittering obsidian beads, carrying a gnarled staff of petrified wood\n\n' +
'Rosie Recycle\n' +
'a young girl with curly brown hair and bright green eyes, wearing goggles made from repurposed clear soda bottles, a cape fashioned from colorful recycled newspapers, pale skin with a determined expression and her outfit adorned with recycling symbols\n\n' +
'Item Prompts:\n' +
'Gnarled Staff\n' +
'a staff made of dark petrified wood gnarled and twisted with age it might have a faintly glowing crystal or ancient rune carved at its tip emitting a soft light\n\n' +
'Obsidian Beads\n' +
'small polished beads of pure black obsidian reflecting light with a glassy sheen they could be intricately braided into a character\'s beard or hair or part of a necklace\n\n' +
'Location Prompts:\n' +
'Desolate Village\n' +
'a small somber village with simple run-down huts made of rough-hewn wood and deteriorating thatch the surrounding landscape is barren and dusty perhaps with a few dead trees a sense of gloom and despair hangs heavy in the air colors are muted primarily browns greys and faded earth tones\n\n' +
'Volcanic Peak\n' +
'a towering jagged mountain its peak perpetually wreathed in thick dark smoke and a faint ominous red glow from within the slopes are steep and treacherous covered in loose scree sharp volcanic rock and patches of grey ash no vegetation is visible\n\n' +
'Now, generate the character, item, and location prompts based on the provided script, adhering strictly to the format, style, and level of detail exemplified above. For characters, ensure you include specific physical traits (hair color/style, eye color, skin tone, age) for consistency across image generations. Use lowercase, single-sentence, no-punctuation-ending descriptions.\n';


const imagePromptsPromptTemplate = 'You are an expert at creating detailed image prompts optimized for FLUX AI model through PicsArt API. Your goal is to generate prompts that correlate with narration chunks using FLUX-specific techniques.\n\n' +
'{{#if chunksData}}\n' +
'**SOUND CHUNK CORRELATION MODE:**\n' +
'You must generate prompts that correlate with the provided narration chunks. Each chunk has:\n' +
'- Text content to analyze\n' +
'- Duration in seconds\n' +
'- Required number of prompts based on duration\n\n' +
'Chunk Details:\n' +
'{{#each chunksData}}\n' +
'Chunk {{@index}}: "{{text}}" (Duration: {{duration}}s, Required prompts: {{promptCount}})\n' +
'{{/each}}\n\n' +
'{{#if isPicsart}}\n' +
'**FLUX DEV OPTIMIZED PROMPTING FOR PICSART:**\n' +
'FLUX is exceptionally good at understanding natural language. Use this structure with entity references:\n\n' +
'1. **Entity Reference System**: Use \'@\' prefix for all characters, locations, and items (e.g., @CharacterName, @LocationName, @ItemName)\n' +
'2. **Natural Language Approach**: Write prompts as if describing a scene to a human\n' +
'3. **Subject-Action-Environment Pattern**: Start with the main subject, describe what they\'re doing, then the environment\n' +
'4. **Specific Visual Details**: Include lighting, camera angles, and artistic style\n\n' +
'**Flux-Optimized Structure with Entity References:**\n' +
'"[Camera shot] of @CharacterName [action/emotion/pose] in @LocationName. [Interaction with @ItemName if relevant]. [Lighting description]. [Additional details]."\n\n' +
'**Example:**\n' +
'"Close-up shot of @Luna looking up in wonder at floating golden sparkles around her. She\'s standing in @EnchantedForest clearing with dappled sunlight filtering through ancient oak trees. @MagicalSparkles dance around her hands. Warm, magical lighting with soft shadows."\n\n' +
'**Character Consistency Examples:**\n' +
'- "@Whiskers sits alertly"\n' +
'- "@Fuzzy bounces playfully"\n\n' +
'**CRITICAL REQUIREMENTS:**\n' +
'- Always use \'@\' prefix before character names (e.g., @Luna, @Hero, @Villain)\n' +
'- Always use \'@\' prefix before location names (e.g., @Castle, @Forest, @Bedroom)\n' +
'- Always use \'@\' prefix before important item names (e.g., @Sword, @Crown, @Book)\n' +
'- Extract character, location, and item names from the provided reference descriptions\n' +
'- NEVER include character/item/location descriptions when using @placeholders - the @placeholder will be expanded with the full description automatically\n' +
'- Use present tense for actions\n' +
'- Be specific about emotions and expressions\n' +
'- Include environmental context and lighting\n\n' +
'**ABSOLUTELY FORBIDDEN - DO NOT INCLUDE:**\n' +
'- Any artistic style descriptors (NO "Digital painting style", "3D rendered", "cartoon style", etc.)\n' +
'- Art medium references (NO "watercolor", "oil painting", "comic book style", etc.)\n' +
'- Software references (NO "Unreal Engine", "Blender", "Photoshop", etc.)\n' +
'- Quality descriptors (NO "highly detailed", "8K", "photorealistic", etc.)\n' +
'- The artistic style will be handled separately by the system through model configuration, NOT in the prompt text\n\n' +
'**STYLE HANDLING PHILOSOPHY:**\n' +
'Style is applied systematically through the imageStyleUtils system after prompt generation. This ensures scene prompts remain clean and focused on content while style is consistently applied across all generated images.\n\n' +
'{{else}}\n' +
'**GOOGLE/GEMINI PROMPTING STRUCTURE:**\n' +
'For Google providers, use more detailed cinematic descriptions with:\n' +
'- Camera angles and shot types\n' +
'- Lighting and mood descriptions\n' +
'- Detailed scene composition\n' +
'- Character emotions and expressions\n' +
'{{/if}}\n\n' +
'{{else}}\n' +
'**FALLBACK MODE (when no chunks provided):**\n' +
'Analyze the script and identify {{numImages}} key scenes that need visualization using FLUX-optimized natural language descriptions.\n' +
'{{/if}}\n\n' +
'**CHARACTER REFERENCE:**\n' +
'{{{characterPrompts}}}\n\n' +
'**CRITICAL NAMING CONSISTENCY:**\n' +
'When referencing characters, items, or locations in your image prompts, you MUST ONLY use entities that exist in the reference sections above, prefixed with @.\n\n' +
'MANDATORY RULES:\n' +
'1. ONLY use @placeholders for entities listed in the CHARACTER REFERENCE, LOCATION REFERENCE, and ITEM REFERENCE sections\n' +
'2. NEVER create @placeholders for entities not in these reference sections\n' +
'3. Convert entity names to PascalCase when creating @references (e.g., "Old Man Grumbles" becomes @OldManGrumbles)\n' +
'4. Do NOT include descriptions alongside @placeholders - they will be expanded automatically\n\n' +
'For example, if the character reference shows:\n' +
'"Rosie Recycle\n' +
'a young girl with..."\n\n' +
'Then use: @RosieRecycle (no description needed)\n\n' +
'If the character reference shows:\n' +
'"Old Man Grumbles\n' +
'an elderly man with..."\n\n' +
'Then use: @OldManGrumbles (no description needed)\n\n' +
'**CHARACTER CONSISTENCY REQUIREMENTS:**\n' +
'- Character descriptions are automatically provided through @placeholders\n' +
'- Focus on character actions, emotions, and interactions with environment\n' +
'- Use @placeholders for all characters, items, and locations from the reference sections\n' +
'- Do not duplicate descriptions that are already in the @placeholder expansions\n\n' +
'**REGENERATION NOTICE:**\n' +
'⚠️ After implementing these character consistency requirements, you MUST regenerate:\n' +
'1. All character prompt descriptions to include specific physical traits\n' +
'2. All character reference images with consistent visual features\n' +
'3. All location and item images to match the updated style\n' +
'4. Existing story content to use the new consistent character descriptions\n\n' +
'**LOCATION REFERENCE:**\n' +
'{{{locationPrompts}}}\n\n' +
'**ITEM REFERENCE:**\n' +
'{{{itemPrompts}}}\n\n' +
'**STORY SCRIPT:**\n' +
'{{{script}}}\n\n' +
'{{#if chunksData}}\n' +
'**INSTRUCTIONS:**\n' +
'For each narration chunk, create {{#each chunksData}}{{promptCount}} prompt(s) for chunk {{@index}}, {{/each}} ensuring they match the narrative content and flow smoothly between scenes. Focus on key emotional moments, character interactions, and scene transitions.\n\n' +
'Total prompts needed: {{numImages}}\n\n' +
'**ALSO GENERATE ACTION PROMPTS:**\n' +
'For each image prompt, create a corresponding simple action description that describes the specific movements/actions characters perform in that scene. These are for animation purposes.\n\n' +
'Action prompts should be:\n' +
'- Simple, clear descriptions of character movements\n' +
'- Focus on physical actions (walking, jumping, blinking, tail wagging, etc.)\n' +
'- Describe what each character does in that specific scene\n' +
'- Keep them concise and animation-focused\n\n' +
'Examples:\n' +
'- "The kitten\'s fur gently rises and falls as it sleeps."\n' +
'- "The kitten leaps forward and waves its paws."\n' +
'- "The white kitten takes a few steps forward and wags its tail. The grey cat blinks and turns its head."\n\n' +
'{{else}}\n' +
'Generate exactly {{numImages}} FLUX-optimized image prompts based on the script\'s key visual moments.\n' +
'{{/if}}\n\n' +
'**OUTPUT FORMAT:**\n' +
'Return your response as a JSON object with two keys:\n' +
'1. "imagePrompts": An array of exactly {{numImages}} strings, each optimized for FLUX AI model\n' +
'2. "actionPrompts": An array of exactly {{numImages}} strings, each describing simple character movements for that scene';

const scriptChunksPromptTemplate = 'You are a movie director and script editor who thinks visually. Your task is to split the following story script into meaningful visual scenes/chunks. Each chunk will have a corresponding image generated and narration audio, so think like you\'re creating an animated storybook.\n\n' +
'Think like a movie director analyzing a script:\n' +
'- What would each scene look like visually?\n' +
'- Where are the natural visual transitions?\n' +
'- What moments need their own "frame" or "shot"?\n' +
'- How can you group sentences that paint the same visual picture?\n\n' +
'Instructions:\n' +
'1. Read the entire script and visualize it as an animated story with scenes.\n' +
'2. Split into chunks that represent distinct visual scenes or moments - NOT sentence by sentence.\n' +
'3. Each chunk should paint a clear, cohesive visual picture that an AI can generate as a single image.\n' +
'4. Group related sentences together if they describe the same scene, character introduction, or visual moment.\n' +
'5. Aim for chunks that are suitable for a single narration segment and a single accompanying image. This means chunks shouldn\'t be too long or too short.\n' +
'6. Each chunk should be 1-3 sentences, but prioritize visual coherence over sentence count.\n\n' +
'Script to split:\n' +
'{{{script}}}\n\n' +
'Return your response as a JSON object with a single key "scriptChunks". The value of "scriptChunks" MUST be an array of strings, where each string is one of the generated script chunks. Do not include numbering or any other formatting within the chunk strings themselves.\n' +
'Example of a good split for a segment:\n' +
'Original: "Lilly\'s eyes sparkled. \'Does the Rainbow Route have puddles?!\' \'Oh, yes,\' Mama Duck chuckled, \'plenty of puddles. But it’s also full of surprises.\'"\n' +
'Split into:\n' +
'- "Lilly’s eyes sparkled. ‘Does the Rainbow Route have puddles?!’"\n' +
'- "‘Oh, yes,’ Mama Duck chuckled, ‘plenty of puddles. But it’s also full of surprises.’"\n';


export async function generateTitle(input: GenerateTitleInput): Promise<{ success: boolean, data?: z.infer<typeof AITitleOutputSchema>, error?: string }> {
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

export async function generateScript(input: GenerateScriptInput): Promise<{ success: boolean, data?: z.infer<typeof AIScriptOutputSchema>, error?: string }> {
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

export async function generateCharacterPrompts(input: GenerateCharacterPromptsInput): Promise<{ success: boolean, data?: z.infer<typeof AICharacterPromptsOutputSchema>, error?: string }> {
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

export interface GenerateNarrationAudioActionInput extends AINarrationAudioInputType {
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
      serviceApiKey = userApiKeys.googleApiKey || userApiKeys.geminiApiKey;
      if (!serviceApiKey) {
        return { success: false, error: "Google API key for TTS not configured by user. Please set it in Account Settings." };
      }
    }

    const aiFlowInput: AINarrationAudioInputType = {
      script: actionInput.script,
      voiceId: actionInput.voiceId,
      ttsModel: modelToUse,
      googleApiModel: actionInput.googleApiModel,
      languageCode: actionInput.languageCode,
      apiKey: serviceApiKey
    };

    const { generateNarrationAudio: aiGenerateNarrationAudioFlow } = await import('@/ai/flows/generate-narration-audio');
    const result: AINarrationAudioOutputType = await aiGenerateNarrationAudioFlow(aiFlowInput);


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

    const { generateNarrationAudio: aiGenerateNarrationAudioFlow } = await import('@/ai/flows/generate-narration-audio');
    const result: AINarrationAudioOutputType = await aiGenerateNarrationAudioFlow(aiFlowInput);

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


export async function generateImagePrompts(input: GenerateImagePromptsInput): Promise<{ success: boolean, data?: z.infer<typeof AIImagePromptsOutputSchema>, error?: string }> {
    const userKeysResult = await getUserApiKeys(input.userId);
    if (!userKeysResult.success || !userKeysResult.data?.googleApiKey) {
      return { success: false, error: "Google API key for prompt generation not configured by user. Please set it in Account Settings." };
    }
    const userGoogleKey = userKeysResult.data.googleApiKey;

    try {
        const localAi = genkit({ plugins: [googleAI({ apiKey: userGoogleKey })], model: 'googleai/gemini-2.0-flash', })

        let numImages: number;
        let chunksDataForPrompt: Array<{text: string; duration: number; promptCount: number}> | undefined;

        if (input.narrationChunks && input.narrationChunks.length > 0) {
            chunksDataForPrompt = input.narrationChunks.map((chunk: { text: string; duration: number; audioUrl?: string }) => {
                let promptCount: number;
                if (chunk.duration <= 5) promptCount = 1;
                else if (chunk.duration <= 10) promptCount = chunk.text.length > 100 ? 2 : 1;
                else if (chunk.duration <= 15) promptCount = 2;
                else promptCount = 3;
                return { text: chunk.text, duration: chunk.duration, promptCount };
            });
            numImages = chunksDataForPrompt!.reduce((total, chunk) => total + chunk.promptCount, 0);
        } else {
            numImages = Math.max(1, Math.ceil(input.audioDurationSeconds * (5 / 60)));
        }

        let finalPrompt = imagePromptsPromptTemplate
            .replace('{{{characterPrompts}}}', input.characterPrompts || '')
            .replace('{{{locationPrompts}}}', input.locationPrompts || '')
            .replace('{{{itemPrompts}}}', input.itemPrompts || '')
            .replace('{{{script}}}', input.script);

        if (chunksDataForPrompt) {
            const chunkDetailsText = chunksDataForPrompt.map((c, i) => `Chunk ${i}: "${c.text}" (Duration: ${c.duration}s, Required prompts: ${c.promptCount})`).join('\\n');
            finalPrompt = finalPrompt.replace('{{#if chunksData}}Chunk Details:{{#each chunksData}}...{{/each}}{{else}}Fallback Mode{{/if}}', `Chunk Details:\\n${chunkDetailsText}`);
        } else {
            finalPrompt = finalPrompt.replace('{{#if chunksData}}Chunk Details:{{#each chunksData}}...{{/each}}{{else}}Fallback Mode{{/if}}', `Fallback Mode: Analyze the script and identify ${numImages} key scenes...`);
        }
        // Replace numImages in the prompt body and isPicsart condition
        finalPrompt = finalPrompt.replace(/{{numImages}}/g, numImages.toString());
        finalPrompt = finalPrompt.replace('{{#if isPicsart}}', input.isPicsart ? '' : '{{#if false}}'); // Effectively remove picsart block if not isPicsart
        finalPrompt = finalPrompt.replace('{{/if}}', input.isPicsart ? '' : '{{/if}}');


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

export async function generateScriptChunks(input: GenerateScriptChunksInput): Promise<{ success: boolean, data?: Omit<z.infer<typeof AIScriptChunksOutputSchema>, 'error'>, error?: string }> {
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
          const nonEmptyChunks = output.scriptChunks.filter((chunk: string) => chunk.trim().length > 0);
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
      const { getStory } = await import('@/actions/firestoreStoryActions'); // Local import for cyclic dep avoidance
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
              const entityPattern = new RegExp(actualEntityName.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&') + "\\\\s*\\\\n+(.*?)(?=\\\\n\\\\n|$)", "s");
              const entityMatch = promptsSection.match(entityPattern);
              if (entityMatch && entityMatch[1]) {
                placeholderDescriptions += `${actualEntityName}, ${entityMatch[1].trim()}\\n-----------\\n`;
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
      const { getStory } = await import('@/actions/firestoreStoryActions'); // Local import
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
      const { getStory } = await import('@/actions/firestoreStoryActions'); // Local import for cyclic dep avoidance
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
      const { getStory } = await import('@/actions/firestoreStoryActions'); // Local import
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
