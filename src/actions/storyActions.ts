

"use server";

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import { runFlow } from '@genkit-ai/flow';

// Import Input/Output schemas from the original flow files - STATIC IMPORTS
import {
  type GenerateNarrationAudioInput as AINarrationAudioInputType,
  type GenerateNarrationAudioOutput as AINarrationAudioOutputType
} from '@/ai/flows/generate-narration-audio-types';

// Removed Original and ServerSchema imports as they are unused or superseded

import {
  AITitleOutputSchema,
  type GenerateTitleInput,
  AIScriptOutputSchema,
  type GenerateScriptInput,
  AICharacterPromptsOutputSchema,
  type GenerateCharacterPromptsInput,
  AIImagePromptsOutputSchema,
  type GenerateImagePromptsInput,
  AIScriptChunksOutputSchema,
  type GenerateScriptChunksInput
} from './storyActionSchemas';


// import { firebaseAdmin, dbAdmin } from '@/lib/firebaseAdmin'; // Unused based on lint
import type { ElevenLabsVoice } from '@/types/story'; // Story, AdminTimestamp might be used later
// import type { Timestamp as AdminTimestamp } from 'firebase-admin/firestore'; // Unused based on lint
// import { revalidatePath } from 'next/cache'; // Unused based on lint
import { getUserApiKeys } from './apiKeyActions';
// import type { UserApiKeys } from '@/types/apiKeys'; // Unused based on lint
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
'These descriptions will be used as an AI image generator to create visuals for the story.\n\n' +
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


const imagePromptsPromptTemplate = `You are an expert at creating detailed image prompts optimized for various AI image generation models.
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
**Narration Chunk {{@index}} (Duration: {{duration}}s, Required prompts: {{promptCount}}):**
"{{text}}"

**For THIS CHUNK, generate {{promptCount}} image prompt(s). Each prompt MUST:**
1.  **Visualize THIS CHUNK's content**: The image should depict characters, actions, and settings explicitly mentioned or clearly implied in THIS narration chunk.
2.  **Include a SPECIFIC Location**: Use an @LocationName from the LOCATION REFERENCE. If no location is directly mentioned in the chunk, infer the most logical @LocationName based on the chunk's content, the overall story script, and available location references. DO NOT invent new locations; use only those in the LOCATION REFERENCE.
3.  **Follow Prompt Structure**: "[Camera shot, e.g., Wide shot, Close-up] of @CharacterName [action/emotion/pose, e.g., looking thoughtful, running quickly] IN @LocationName. [Interaction with @ItemName if relevant, e.g., holding @MagicWand]. [Lighting/mood, e.g., Sunny morning, Dark and stormy night]. [Key visual details from THIS narration chunk]."
    *   Example: "Eye-level medium shot of @Rusty trotting through @ForestPath IN @WhisperingWoods. He is sniffing the ground curiously. Morning light filters through the canopy."
4.  **Use @Placeholders Correctly**: ONLY use @placeholders for entities listed in the CHARACTER, LOCATION, and ITEM REFERENCE sections. Convert entity names to PascalCase for @references (e.g., "Old Man Grumbles" becomes @OldManGrumbles). Do NOT include descriptions alongside @placeholders; they will be expanded automatically.
5.  **No Style Descriptors**: ABSOLUTELY DO NOT include artistic style descriptors (like "3D rendered", "cartoon style", "photorealistic", "watercolor"). Style is handled separately.
6.  **Natural Language**: Write prompts as if describing a scene to a human. Use present tense.
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

**OUTPUT FORMAT (Strict JSON):**
Return your response as a JSON object with two keys:
1.  "imagePrompts": An array of strings, where each string is an image prompt. The total number of image prompts must be exactly {{numImages}}.
2.  "actionPrompts": An array of strings, where each string is an action prompt corresponding to the image prompt at the same index. The total number of action prompts must also be exactly {{numImages}}.
`;

// Helper function to extract JSON from Perplexity responses that may contain reasoning tags and markdown code blocks
function extractJsonFromPerplexityResponse(responseText: string): string {
  let cleanedText = responseText;
  
  // Step 1: If the response has <think> tags, extract content after </think>
  if (cleanedText.includes('<think>') && cleanedText.includes('</think>')) {
    const afterThinkMatch = cleanedText.match(/<\/think>\s*([\s\S]*)/);
    if (afterThinkMatch && afterThinkMatch[1]) {
      cleanedText = afterThinkMatch[1].trim();
    }
  }
  
  // Step 2: Remove markdown code block formatting if present
  if (cleanedText.includes('```json') || cleanedText.includes('```')) {
    // Extract content between code block markers
    const codeBlockMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      cleanedText = codeBlockMatch[1].trim();
    } else {
      // If there's a starting ``` but no ending, just remove the starting marker
      cleanedText = cleanedText.replace(/```(?:json)?\s*/, '').trim();
    }
  }
  
  // Step 3: Try to find JSON within the cleaned response by looking for { and }
  const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }
  
  // If no JSON patterns found, return the cleaned text
  return cleanedText;
}

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

  if (input.aiProvider === 'perplexity') {
    if (!userKeysResult.success || !userKeysResult.data?.perplexityApiKey) {
      return { success: false, error: "Perplexity API key not configured by user. Please set it in Account Settings." };
    }
    try {
      const { generateWithPerplexity } = await import('../ai/genkit'); // Corrected path

      const promptText = titlePromptTemplate.replace('{{userPrompt}}', input.userPrompt);

      const messages = [
        { role: 'system' as const, content: 'You are an expert at creating catchy and concise titles for stories. Generate a short title (ideally 3-7 words, maximum 10 words).' },
        { role: 'user' as const, content: promptText }
      ];

      const titleText = await runFlow(generateWithPerplexity, {
        modelName: input.perplexityModel || 'sonar-reasoning-pro', // Default model
        messages: messages,
        userId: input.userId,
      });

      return { success: true, data: { title: titleText } }; // Wrapped to match AITitleOutputSchema

    } catch (error) {
      console.error("Error in generateTitle with Perplexity AI call:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate title with Perplexity.";
      return { success: false, error: errorMessage };
    }
  } else { // Default to Google AI
    if (!userKeysResult.success || !userKeysResult.data?.googleApiKey) {
      return { success: false, error: "Google API key not configured by user. Please set it in Account Settings." };
    }
    const userGoogleKey = userKeysResult.data.googleApiKey;

    try {
      const modelName = input.googleScriptModel || 'gemini-2.5-flash-preview-05-20'; // Default if not provided
      const localAi = genkit({ plugins: [googleAI({ apiKey: userGoogleKey })], model: `googleai/${modelName}` });
      const prompt = titlePromptTemplate.replace('{{userPrompt}}', input.userPrompt);
      const { output } = await localAi.generate({ prompt, output: { schema: AITitleOutputSchema, format: 'json' } });

      if (!output?.title) {
        const promptWords = input.userPrompt.split(' ').slice(0, 5).join(' ');
        return { success: true, data: { title: `${promptWords}... (Draft)` } };
      }
      return { success: true, data: output };
    } catch (error) {
      console.error("Error in generateTitle AI call (Google):", error);
      return { success: false, error: "Failed to generate title with user's Google key." };
    }
  }
}

export async function generateScript(input: GenerateScriptInput): Promise<{ success: boolean, data?: z.infer<typeof AIScriptOutputSchema>, error?: string }> {
  const userKeysResult = await getUserApiKeys(input.userId);

  if (input.aiProvider === 'perplexity') {
    if (!userKeysResult.success || !userKeysResult.data?.perplexityApiKey) {
      return { success: false, error: "Perplexity API key not configured by user. Please set it in Account Settings." };
    }
    try {
      const { generateWithPerplexity } = await import('../ai/genkit'); // Corrected path

      const promptText = scriptPromptTemplate.replace('{{{prompt}}}', input.prompt);

      const messages = [
        { role: 'system' as const, content: 'You are a script writer for animated videos. Your task is to generate a script based on the user prompt. The script should be engaging for both children and adults. The entire script must be written from the perspective of a single narrator.' },
        { role: 'user' as const, content: promptText }
      ];

      const scriptText = await runFlow(generateWithPerplexity, {
        modelName: input.perplexityModel || 'sonar-reasoning-pro', // Default model
        messages: messages,
        userId: input.userId,
      });

      return { success: true, data: { script: scriptText } }; // Wrapped to match AIScriptOutputSchema

    } catch (error) {
      console.error("Error in generateScript with Perplexity AI call:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate script with Perplexity.";
      return { success: false, error: errorMessage };
    }
  } else { // Default to Google AI
    if (!userKeysResult.success || !userKeysResult.data?.googleApiKey) {
      return { success: false, error: "Google API key not configured by user. Please set it in Account Settings." };
    }
    const userGoogleKey = userKeysResult.data.googleApiKey;

    try {
      const modelName = input.googleScriptModel || 'gemini-2.5-flash-preview-05-20'; // Default if not provided
      const localAi = genkit({ plugins: [googleAI({ apiKey: userGoogleKey })], model: `googleai/${modelName}` });
      const prompt = scriptPromptTemplate.replace('{{{prompt}}}', input.prompt);
      const { output } = await localAi.generate({ prompt, output: { schema: AIScriptOutputSchema, format: 'json' } });
      return { success: true, data: output! };
    } catch (error) {
      console.error("Error in generateScript AI call (Google):", error);
      return { success: false, error: "Failed to generate script with user's Google key." };
    }
  }
}

export async function generateCharacterPrompts(input: GenerateCharacterPromptsInput): Promise<{ success: boolean, data?: z.infer<typeof AICharacterPromptsOutputSchema>, error?: string }> {
  const userKeysResult = await getUserApiKeys(input.userId);
  if (!userKeysResult.success || !userKeysResult.data) {
    return { success: false, error: "Could not fetch user API keys." };
  }
  const userApiKeys = userKeysResult.data;

  let stylePromptText: string | undefined;
  if (input.imageStyleId) {
    try {
      const { getStylePromptForProvider } = await import('@/utils/imageStyleUtils');
      stylePromptText = getStylePromptForProvider(input.imageStyleId as string, input.imageProvider || 'picsart');
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

  if (input.aiProvider === 'perplexity') {
    if (!userApiKeys.perplexityApiKey) {
      return { success: false, error: "Perplexity API key not configured by user. Please set it in Account Settings." };
    }
    try {
      const { generateWithPerplexity } = await import('../ai/genkit');
      const messages = [
        { role: 'system' as const, content: 'You are an expert prompt engineer. Follow the instructions precisely to generate character, item, and location prompts based on the script.' },
        { role: 'user' as const, content: finalPrompt }
      ];
      const resultText = await runFlow(generateWithPerplexity, {
        modelName: input.perplexityModel || 'sonar-reasoning-pro', // Default Perplexity model
        messages: messages,
        userId: input.userId,
      });
      // First, try to extract JSON from reasoning tags if present
      const cleanedResultText = extractJsonFromPerplexityResponse(resultText);
      
      // Try to parse as JSON first
      try {
        const parsedJson = JSON.parse(cleanedResultText);
        if (parsedJson.characterPrompts || parsedJson.itemPrompts || parsedJson.locationPrompts) {
          return { success: true, data: parsedJson };
        }
      } catch {
        // Not JSON, continue with text parsing
      }
      
      // Fallback to text-based parsing for headings format
      const characterPrompts = cleanedResultText.match(/Character Prompts:\s*([\s\S]*?)(Item Prompts:|Location Prompts:|$)/)?.[1]?.trim() || '';
      const itemPrompts = cleanedResultText.match(/Item Prompts:\s*([\s\S]*?)(Location Prompts:|$)/)?.[1]?.trim() || '';
      const locationPrompts = cleanedResultText.match(/Location Prompts:\s*([\s\S]*?$)/)?.[1]?.trim() || '';
      
      if (!characterPrompts && !itemPrompts && !locationPrompts) {
        console.warn("Could not parse Perplexity output for character prompts. Raw output:", cleanedResultText);
        return { success: false, error: "Failed to parse character prompts from Perplexity. Output might be partial or malformed. Raw: " + cleanedResultText.substring(0, 100) + "..." };
      }

      return { success: true, data: { characterPrompts, itemPrompts, locationPrompts } };

    } catch (error) {
      console.error("Error in generateCharacterPrompts with Perplexity AI call:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate character prompts with Perplexity.";
      return { success: false, error: errorMessage };
    }
  } else { // Default to Google AI
    if (!userApiKeys.googleApiKey) {
      return { success: false, error: "Google API key not configured by user. Please set it in Account Settings." };
    }
    try {
      const modelName = input.googleScriptModel || 'gemini-2.5-flash-preview-05-20';
      const localAi = genkit({ plugins: [googleAI({ apiKey: userApiKeys.googleApiKey })], model: `googleai/${modelName}` });
      const { output } = await localAi.generate({ prompt: finalPrompt, output: { schema: AICharacterPromptsOutputSchema, format: 'json' } });
      return { success: true, data: output! };
    } catch (error) {
      console.error("Error in generateCharacterPrompts AI call (Google):", error);
      return { success: false, error: "Failed to generate character/item/location prompts with Google." };
    }
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
  if (!userKeysResult.success || !userKeysResult.data) {
    return { success: false, error: "Could not fetch user API keys." };
  }
  const userApiKeys = userKeysResult.data;

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
  
  const templateInput = {
      characterPrompts: input.characterPrompts || '',
      locationPrompts: input.locationPrompts || '',
      itemPrompts: input.itemPrompts || '',
      script: input.script,
      chunksData: chunksDataForPrompt,
      numImages: numImages,
      isPicsart: input.isPicsart,
      imageProvider: input.imageProvider
  };

  let finalPrompt = imagePromptsPromptTemplate;
  for (const key in templateInput) {
      if (Object.prototype.hasOwnProperty.call(templateInput, key) && key !== 'chunksData') {
          const value = (templateInput as Record<string, unknown>)[key];
          if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
              finalPrompt = finalPrompt.replace(new RegExp(`{{{${key}}}}`, 'g'), String(value));
              finalPrompt = finalPrompt.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
          }
      }
  }

  if (chunksDataForPrompt) {
      let chunkDetailsBlock = "";
      chunksDataForPrompt.forEach((chunk, index) => {
          chunkDetailsBlock += `**Narration Chunk ${index} (Duration: ${chunk.duration}s, Required prompts: ${chunk.promptCount}):**\n"${chunk.text}"\n\n`;
          chunkDetailsBlock += `**For THIS CHUNK, generate ${chunk.promptCount} image prompt(s). Each prompt MUST:**\n`;
          chunkDetailsBlock += `1.  Directly visualize the events, characters, and setting described in THIS CHUNK.\n`;
          chunkDetailsBlock += `2.  Include a specific @LocationName. If the location is not explicitly stated in the chunk, infer the most logical @LocationName based on the chunk's content, the overall story script, and available location references. DO NOT invent new locations; use only those in the LOCATION REFERENCE.\n`;
          chunkDetailsBlock += `3.  Follow Prompt Structure: "[Camera shot, e.g., Wide shot, Close-up] of @CharacterName [action/emotion/pose, e.g., looking thoughtful, running quickly] IN @LocationName. [Interaction with @ItemName if relevant, e.g., holding @MagicWand]. [Lighting/mood, e.g., Sunny morning, Dark and stormy night]. [Key visual details from THIS narration chunk]."\n`;
          chunkDetailsBlock += `    *   Example: "Eye-level medium shot of @Rusty trotting through @ForestPath IN @WhisperingWoods. He is sniffing the ground curiously. Morning light filters through the canopy."\n`;
          chunkDetailsBlock += `4.  Use @Placeholders Correctly: ONLY use @placeholders for entities listed in the CHARACTER, LOCATION, and ITEM REFERENCE sections. Convert entity names to PascalCase for @references (e.g., "Old Man Grumbles" becomes @OldManGrumbles). Do NOT include descriptions alongside @placeholders; they will be expanded automatically.\n`;
          chunkDetailsBlock += `5.  No Style Descriptors: ABSOLUTELY DO NOT include artistic style descriptors (like "3D rendered", "cartoon style", "photorealistic", "watercolor"). Style is handled separately.\n`;
          chunkDetailsBlock += `6.  Natural Language: Write prompts as if describing a scene to a human. Use present tense.\n---\n`;
      });
      const chunkLogicRegex = /\{\{#if chunksData\}\}(.|\n)*?\{\{\/if\}\}/;
      const ifBlockContent = (imagePromptsPromptTemplate.match(chunkLogicRegex)?.[0] || "")
          .replace(/\{\{#if chunksData\}\}/, '')
          .replace(/\{\{\/if\}\}/, '')
          .replace(/\{\{#each chunksData\}\}(.|\n)*?\{\{\/each\}\}/, chunkDetailsBlock)
          .replace(/\{\{else\}\}(.|\n)*$/, '');
      finalPrompt = finalPrompt.replace(chunkLogicRegex, ifBlockContent);
  } else {
      const fallbackRegex = /\{\{#if chunksData\}\}(.|\n)*?\{\{else\}\}((.|\n)*?)\{\{\/if\}\}/;
      const fallbackMatch = finalPrompt.match(fallbackRegex);
      if (fallbackMatch && fallbackMatch[2]) {
          finalPrompt = finalPrompt.replace(fallbackRegex, fallbackMatch[2].trim());
      }
  }
  
  const config = { temperature: 0.7, maxOutputTokens: 4096 };

  if (input.aiProvider === 'perplexity') {
    if (!userApiKeys.perplexityApiKey) {
      return { success: false, error: "Perplexity API key not configured by user. Please set it in Account Settings." };
    }
    try {
      const { generateWithPerplexity } = await import('../ai/genkit');
      
      // For large requests (>12 chunks), process in batches to avoid token limits
      if (chunksDataForPrompt && chunksDataForPrompt.length > 12) {
        console.log(`Processing ${chunksDataForPrompt.length} chunks in batches for Perplexity`);
        const batchSize = 8; // Process 8 chunks at a time
        const allImagePrompts: string[] = [];
        const allActionPrompts: string[] = [];
        
        for (let i = 0; i < chunksDataForPrompt.length; i += batchSize) {
          const chunkBatch = chunksDataForPrompt.slice(i, i + batchSize);
          const batchNumImages = chunkBatch.reduce((total, chunk) => total + chunk.promptCount, 0);
          
          // Create batch-specific prompt
          const batchTemplateInput = {
            ...templateInput,
            chunksData: chunkBatch,
            numImages: batchNumImages
          };
          
          let batchPrompt = imagePromptsPromptTemplate;
          for (const key in batchTemplateInput) {
            if (Object.prototype.hasOwnProperty.call(batchTemplateInput, key) && key !== 'chunksData') {
              const value = (batchTemplateInput as Record<string, unknown>)[key];
              if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                batchPrompt = batchPrompt.replace(new RegExp(`{{{${key}}}}`, 'g'), String(value));
                batchPrompt = batchPrompt.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
              }
            }
          }
          
          // Process chunksData for this batch
          let chunkDetailsBlock = "";
          chunkBatch.forEach((chunk, index) => {
            const globalIndex = i + index; // Use global index for consistency
            chunkDetailsBlock += `**Narration Chunk ${globalIndex} (Duration: ${chunk.duration}s, Required prompts: ${chunk.promptCount}):**\n"${chunk.text}"\n\n`;
            chunkDetailsBlock += `**For THIS CHUNK, generate ${chunk.promptCount} image prompt(s). Each prompt MUST:**\n`;
            chunkDetailsBlock += `1.  Directly visualize the events, characters, and setting described in THIS CHUNK.\n`;
            chunkDetailsBlock += `2.  Include a specific @LocationName. If the location is not explicitly stated in the chunk, infer the most logical @LocationName based on the chunk's content, the overall story script, and available location references. DO NOT invent new locations; use only those in the LOCATION REFERENCE.\n`;
            chunkDetailsBlock += `3.  Follow Prompt Structure: "[Camera shot, e.g., Wide shot, Close-up] of @CharacterName [action/emotion/pose, e.g., looking thoughtful, running quickly] IN @LocationName. [Interaction with @ItemName if relevant, e.g., holding @MagicWand]. [Lighting/mood, e.g., Sunny morning, Dark and stormy night]. [Key visual details from THIS narration chunk]."\n`;
            chunkDetailsBlock += `    *   Example: "Eye-level medium shot of @Rusty trotting through @ForestPath IN @WhisperingWoods. He is sniffing the ground curiously. Morning light filters through the canopy."\n`;
            chunkDetailsBlock += `4.  Use @Placeholders Correctly: ONLY use @placeholders for entities listed in the CHARACTER, LOCATION, and ITEM REFERENCE sections. Convert entity names to PascalCase for @references (e.g., "Old Man Grumbles" becomes @OldManGrumbles). Do NOT include descriptions alongside @placeholders; they will be expanded automatically.\n`;
            chunkDetailsBlock += `5.  No Style Descriptors: ABSOLUTELY DO NOT include artistic style descriptors (like "3D rendered", "cartoon style", "photorealistic", "watercolor"). Style is handled separately.\n`;
            chunkDetailsBlock += `6.  Natural Language: Write prompts as if describing a scene to a human. Use present tense.\n---\n`;
          });
          
          const chunkLogicRegex = /\{\{#if chunksData\}\}(.|\n)*?\{\{\/if\}\}/;
          const ifBlockContent = (batchPrompt.match(chunkLogicRegex)?.[0] || "")
            .replace(/\{\{#if chunksData\}\}/, '')
            .replace(/\{\{\/if\}\}/, '')
            .replace(/\{\{#each chunksData\}\}(.|\n)*?\{\{\/each\}\}/, chunkDetailsBlock)
            .replace(/\{\{else\}\}(.|\n)*$/, '');
          batchPrompt = batchPrompt.replace(chunkLogicRegex, ifBlockContent);
          
          const messages = [
            { role: 'system' as const, content: 'You are an expert at creating detailed image prompts. Follow the instructions precisely. Return a JSON object with "imagePrompts" and "actionPrompts" arrays.' },
            { role: 'user' as const, content: batchPrompt }
          ];
          
          const resultText = await runFlow(generateWithPerplexity, {
            modelName: input.perplexityModel || 'sonar-reasoning-pro',
            messages: messages,
            userId: input.userId,
          });
          
          const extractedJson = extractJsonFromPerplexityResponse(resultText);
          const batchOutput = JSON.parse(extractedJson) as z.infer<typeof AIImagePromptsOutputSchema>;
          
          if (!batchOutput || !Array.isArray(batchOutput.imagePrompts) || !Array.isArray(batchOutput.actionPrompts)) {
            console.warn(`Batch ${Math.floor(i/batchSize) + 1} did not return valid structure:`, batchOutput);
            continue; // Skip this batch but continue with others
          }
          
          allImagePrompts.push(...batchOutput.imagePrompts);
          allActionPrompts.push(...batchOutput.actionPrompts);
          
          console.log(`Batch ${Math.floor(i/batchSize) + 1} completed: ${batchOutput.imagePrompts.length} prompts`);
        }
        
        if (allImagePrompts.length === 0) {
          return { success: false, error: "Failed to generate any image prompts in batch processing." };
        }
        
        return { success: true, data: { imagePrompts: allImagePrompts, actionPrompts: allActionPrompts } };
      }
      
      // Original single request for smaller chunk counts (≤12 chunks)
      const messages = [
        { role: 'system' as const, content: 'You are an expert at creating detailed image prompts. Follow the instructions precisely. Return a JSON object with "imagePrompts" and "actionPrompts" arrays.' },
        { role: 'user' as const, content: finalPrompt }
      ];
      const resultText = await runFlow(generateWithPerplexity, {
        modelName: input.perplexityModel || 'sonar-reasoning-pro',
        messages: messages,
        userId: input.userId,
      });
      try {
        const extractedJson = extractJsonFromPerplexityResponse(resultText);
        const parsedOutput = JSON.parse(extractedJson) as z.infer<typeof AIImagePromptsOutputSchema>;
        if (!parsedOutput || !Array.isArray(parsedOutput.imagePrompts) || !Array.isArray(parsedOutput.actionPrompts)) {
          console.warn("Perplexity image prompt generation did not return the expected array structure. Output:", parsedOutput);
          return { success: false, error: "Perplexity AI did not return valid image/action prompts." };
        }
        return { success: true, data: parsedOutput };
      } catch (e) {
        console.error("Failed to parse JSON from Perplexity for image prompts:", resultText, e);
        return { success: false, error: "Failed to parse image prompts from Perplexity. Output was not valid JSON." };
      }
    } catch (error) {
      console.error("Error in generateImagePrompts with Perplexity AI call:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate image prompts with Perplexity.";
      return { success: false, error: errorMessage };
    }
  } else { // Default to Google AI
    if (!userApiKeys.googleApiKey) {
      return { success: false, error: "Google API key for prompt generation not configured by user. Please set it in Account Settings." };
    }
    try {
      const modelName = input.googleScriptModel || 'gemini-2.5-flash-preview-05-20';
      const localAi = genkit({ plugins: [googleAI({ apiKey: userApiKeys.googleApiKey })], model: `googleai/${modelName}` });
      const { output } = await localAi.generate({ prompt: finalPrompt, output: { schema: AIImagePromptsOutputSchema, format: 'json' }, config });
      
      if (!output || !Array.isArray(output.imagePrompts) || !Array.isArray(output.actionPrompts)) {
        console.warn("Google image prompt generation did not return the expected array structure. Output:", output);
        return { success: false, error: "Google AI did not return valid image/action prompts." };
      }
      return { success: true, data: output };
    } catch (error) {
      console.error("Error in generateImagePrompts AI call (Google):", error);
      return { success: false, error: "Failed to generate image prompts with Google." };
    }
  }
}

export async function generateScriptChunks(input: GenerateScriptChunksInput): Promise<{ success: boolean, data?: Omit<z.infer<typeof AIScriptChunksOutputSchema>, 'error'>, error?: string }> {
  const userKeysResult = await getUserApiKeys(input.userId);
  if (!userKeysResult.success || !userKeysResult.data) {
    return { success: false, error: "Could not fetch user API keys." };
  }
  const userApiKeys = userKeysResult.data;
  const prompt = scriptChunksPromptTemplate.replace('{{{script}}}', input.script);
  const config = { temperature: 0.3, maxOutputTokens: 2048 };

  if (input.aiProvider === 'perplexity') {
    if (!userApiKeys.perplexityApiKey) {
      return { success: false, error: "Perplexity API key not configured by user. Please set it in Account Settings." };
    }
    try {
      const { generateWithPerplexity } = await import('../ai/genkit');
      const messages = [
        { role: 'system' as const, content: 'You are a movie director and script editor. Follow the instructions precisely to split the script into meaningful visual chunks. Return a JSON object with a single key "scriptChunks" which is an array of strings.' },
        { role: 'user' as const, content: prompt }
      ];
      const resultText = await runFlow(generateWithPerplexity, {
        modelName: input.perplexityModel || 'sonar-reasoning-pro',
        messages: messages,
        userId: input.userId,
      });
      
      try {
        const extractedJson = extractJsonFromPerplexityResponse(resultText);
        const parsedOutput = JSON.parse(extractedJson) as z.infer<typeof AIScriptChunksOutputSchema>;
        if (parsedOutput?.error) {
          return { success: false, error: parsedOutput.error };
        }
        if (parsedOutput?.scriptChunks && Array.isArray(parsedOutput.scriptChunks)) {
          const nonEmptyChunks = parsedOutput.scriptChunks.filter((chunk: string) => chunk.trim().length > 0);
          if (nonEmptyChunks.length === 0) {
            return { success: false, error: "Perplexity AI returned no script chunks or only empty chunks." };
          }
          return { success: true, data: { scriptChunks: nonEmptyChunks } };
        }
        console.error('Perplexity AI did not return the expected scriptChunks array:', parsedOutput);
        return { success: false, error: 'Failed to parse script chunks from Perplexity AI response.' };
      } catch (e) {
        console.error("Failed to parse JSON from Perplexity for script chunks:", resultText, e);
        return { success: false, error: "Failed to parse script chunks from Perplexity. Output was not valid JSON." };
      }

    } catch (error) {
      console.error("Error in generateScriptChunks with Perplexity AI call:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate script chunks with Perplexity.";
      return { success: false, error: errorMessage };
    }
  } else { // Default to Google AI
    if (!userApiKeys.googleApiKey) {
      return { success: false, error: "Google API key not configured by user. Please set it in Account Settings." };
    }
    try {
      const modelName = input.googleScriptModel || 'gemini-2.5-flash-preview-05-20';
      const localAi = genkit({ plugins: [googleAI({ apiKey: userApiKeys.googleApiKey })], model: `googleai/${modelName}` });
      const { output } = await localAi.generate({ prompt, output: { schema: AIScriptChunksOutputSchema, format: 'json' }, config });

      if (output?.error) {
        return { success: false, error: output.error };
      }
      if (output?.scriptChunks && Array.isArray(output.scriptChunks)) {
        const nonEmptyChunks = output.scriptChunks.filter((chunk: string) => chunk.trim().length > 0);
        if (nonEmptyChunks.length === 0) {
            return { success: false, error: "Google AI returned no script chunks or only empty chunks." };
        }
        return { success: true, data: { scriptChunks: nonEmptyChunks } };
      }
      console.error('Google AI did not return the expected scriptChunks array:', output);
      return { success: false, error: 'Failed to parse script chunks from Google AI response.' };
    } catch (error) {
      console.error("Error in generateScriptChunks AI call (Google):", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate script chunks with Google.";
      if (errorMessage.toLowerCase().includes("api key not configured")) {
          return { success: false, error: "Google API key not configured. Please set it in Account Settings." };
      }
      return { success: false, error: errorMessage };
    }
  }
}


// interface FirebaseErrorWithCode extends Error { // ESLint: defined but never used
//   code?: string;
// }


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
      console.error("No image data from Gemini. Full API response:", JSON.stringify(result, null, 2));
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
  } catch (error: unknown) {
    console.error("Error calling Gemini API:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred while generating the image.";
    return { success: false, error: message, requestPrompt };
  }
}

export async function generateImageFromImagen3(
  originalPrompt: string, // This is the prompt with @placeholders, e.g. "@Mika sniffs @JuicyApple"
  userId: string,
  storyId?: string,
  styleId?: string
): Promise<{ success: boolean; imageUrl?: string; error?: string; requestPrompt?: string; expandedPrompt?: string }> {
  const userKeysResult = await getUserApiKeys(userId);
  if (!userKeysResult.success || !userKeysResult.data?.googleApiKey) {
    return { success: false, error: "Google API key for Imagen3 not configured by user. Please set it in Account Settings." };
  }
  const apiKey = userKeysResult.data.googleApiKey;

  const descriptionParts: string[] = [];
  let actionPromptPart = originalPrompt; // Start with the original prompt containing @placeholders

  if (userId && storyId) {
    try {
      const { getStory } = await import('@/actions/firestoreStoryActions'); 
      const storyResult = await getStory(storyId, userId);
      if (storyResult.success && storyResult.data) {
        const { nameToReference, extractEntityNames } = await import('@/app/(app)/assemble-video/utils');
        const entityReferencesInPrompt = Array.from(new Set(originalPrompt.match(/@[A-Za-z0-9_]+/g) || [])); // Unique references, exclude dots that might be punctuation
        
        const allEntityNamesFromStory = extractEntityNames(storyResult.data);
        
        // Helper function to normalize references for robust comparison (matching utils.ts)
        const normalizeRefForComparison = (ref: string): string => {
          if (!ref.startsWith('@')) return ref.toLowerCase().replace(/[^a-z0-9]/g, '');
          return '@' + ref.substring(1).toLowerCase().replace(/[^a-z0-9]/g, '');
        };
        
        if (entityReferencesInPrompt.length > 0) {
            descriptionParts.push("Here are the descriptions of the entities involved:");
        }

        for (const ref of entityReferencesInPrompt) {
          let actualEntityName: string | null = null;
          let entityType: 'character' | 'item' | 'location' | null = null;
          let descriptionText: string | null = null;

          const normalizedRef = normalizeRefForComparison(ref);

          // Check characters with case-insensitive matching
          for (const charName of allEntityNamesFromStory.characters) { 
            const generatedRef = nameToReference(charName);
            const normalizedGeneratedRef = normalizeRefForComparison(generatedRef);
            if (normalizedGeneratedRef === normalizedRef) { 
              actualEntityName = charName; 
              entityType = 'character'; 
              break; 
            } 
          }
          
          // Check items if not found
          if (!actualEntityName) { 
            for (const itemName of allEntityNamesFromStory.items) { 
              const generatedRef = nameToReference(itemName);
              const normalizedGeneratedRef = normalizeRefForComparison(generatedRef);
              if (normalizedGeneratedRef === normalizedRef) { 
                actualEntityName = itemName; 
                entityType = 'item'; 
                break; 
              } 
            } 
          }
          
          // Check locations if not found
          if (!actualEntityName) { 
            for (const locName of allEntityNamesFromStory.locations) { 
              const generatedRef = nameToReference(locName);
              const normalizedGeneratedRef = normalizeRefForComparison(generatedRef);
              if (normalizedGeneratedRef === normalizedRef) { 
                actualEntityName = locName; 
                entityType = 'location'; 
                break; 
              } 
            } 
          }
          
          if (actualEntityName && entityType) {
            const promptsSection = entityType === 'character' ? storyResult.data.detailsPrompts?.characterPrompts || ''
                                : entityType === 'item' ? storyResult.data.detailsPrompts?.itemPrompts || ''
                                : storyResult.data.detailsPrompts?.locationPrompts || '';
            
            const escapedEntityName = actualEntityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const entityPattern = new RegExp(`^\\s*${escapedEntityName}\\s*\\n(.*?)(?=\\n\\n|$)`, "ms");
            const entityMatch = promptsSection.match(entityPattern);
            
            if (entityMatch && entityMatch[1]) {
              descriptionText = entityMatch[1].trim();
              descriptionParts.push(`Entity: ${actualEntityName}\nDescription: ${descriptionText}`);
              actionPromptPart = actionPromptPart.replace(ref, actualEntityName);
            } else {
              console.warn(`[Imagen3] No description found for ${entityType} "${actualEntityName}" (ref: ${ref}). Name will remain in scene instruction.`);
              descriptionParts.push(`Entity: ${actualEntityName}\nDescription: (No detailed description provided for direct API use)`);
            }
          } else {
            console.warn(`[Imagen3] Entity for reference "${ref}" not found in story data. Ref will remain in scene instruction.`);
          }
        }
      } else {
        console.warn("[Imagen3] Failed to get story data for placeholder expansion.");
      }
    } catch (error) { console.warn("[generateImageFromImagen3] Error processing placeholders:", error); }
  }
  
  const structuredPromptParts: string[] = [];
  if (descriptionParts.length > 0) {
    structuredPromptParts.push(descriptionParts.join('\n-----\n')); // Join descriptions with separator
  }
  structuredPromptParts.push("Now, generate an image depicting the following scene:");
  structuredPromptParts.push(actionPromptPart); // Add the (potentially modified) action prompt
  
  let basePrompt = structuredPromptParts.join('\n\n'); // Join sections with double newline

  // Apply style
  let styleStringApplicable: string | undefined;
  if (styleId) {
    try {
      const { getStylePromptForProvider } = await import('@/utils/imageStyleUtils');
      styleStringApplicable = getStylePromptForProvider(styleId as string, 'imagen3');
    } catch (error) { console.warn("[generateImageFromImagen3] Failed to apply style from styleId:", error); }
  } else if (userId && storyId) {
    try {
      const { getStory } = await import('@/actions/firestoreStoryActions'); 
      const storyResult = await getStory(storyId, userId);
      if (storyResult.success && storyResult.data?.imageStyleId) {
        const { getStylePromptForProvider } = await import('@/utils/imageStyleUtils');
        styleStringApplicable = getStylePromptForProvider(storyResult.data.imageStyleId as string, 'imagen3');
      }
    } catch (error) { console.warn("[generateImageFromImagen3] Failed to apply style from story:", error); }
  }

  if (styleStringApplicable) {
    basePrompt += `\n\nUse the following artistic style:\n${styleStringApplicable}`;
  }
  
  const requestPromptWithStyle = basePrompt;
  const expandedPromptForExport = requestPromptWithStyle; // Store the full structured prompt with style

  try {
    console.log(`Calling Imagen 3 API with structured prompt: \n"${requestPromptWithStyle}"\nUsing user's key.`);
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt: requestPromptWithStyle }],
        parameters: { 
          sampleCount: 1, 
          aspectRatio: "16:9", 
          personGeneration: "ALLOW_ALL", 
          safetySettings: [ 
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          ],
        }
      }),
    });

    const result = await response.json(); 

    if (!response.ok) {
      console.error("Imagen 3 API Error Response:", JSON.stringify(result, null, 2));
      return { success: false, error: `Imagen 3 API request failed: ${response.status} - ${result?.error?.message || 'Unknown error'}`, requestPrompt: requestPromptWithStyle, expandedPrompt: expandedPromptForExport };
    }
    
    const predictions = result.predictions;
    if (!predictions || predictions.length === 0) {
      console.error("Imagen 3 API returned no predictions. Full response:", JSON.stringify(result, null, 2));
      return { success: false, error: "No image data returned from Imagen 3 API", requestPrompt: requestPromptWithStyle, expandedPrompt: expandedPromptForExport };
    }
    const imageData = predictions[0]?.bytesBase64Encoded;
    if (!imageData) {
      console.error("Imagen 3 API returned prediction but no image bytes. Full response:", JSON.stringify(result, null, 2));
      return { success: false, error: "No image bytes in Imagen 3 response", requestPrompt: requestPromptWithStyle, expandedPrompt: expandedPromptForExport };
    }

    if (userId && storyId) {
      try {
        const safePrompt = originalPrompt.substring(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const imageName = `imagen3_${Date.now()}_${safePrompt}`;
        const imageBuffer = Buffer.from(imageData, 'base64');
        const firebaseUrl = await uploadImageBufferToFirebaseStorage(imageBuffer, userId, storyId, imageName, 'image/png');
        return { success: true, imageUrl: firebaseUrl, requestPrompt: requestPromptWithStyle, expandedPrompt: expandedPromptForExport };
      } catch (uploadError) {
        console.error("Error uploading image to Firebase Storage:", uploadError);
        return { success: true, imageUrl: `data:image/png;base64,${imageData}`, requestPrompt: requestPromptWithStyle, expandedPrompt: expandedPromptForExport };
      }
    }
    return { success: true, imageUrl: `data:image/png;base64,${imageData}`, requestPrompt: requestPromptWithStyle, expandedPrompt: expandedPromptForExport };
  } catch (error: unknown) {
    console.error("Error calling Imagen 3 API:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred while generating the image.";
    return { success: false, error: message, requestPrompt: requestPromptWithStyle, expandedPrompt: expandedPromptForExport };
  }
}

export async function generateImageFromPrompt(
  originalPrompt: string,
  userId: string,
  storyId?: string,
  provider: 'picsart' | 'gemini' | 'imagen3' = 'picsart',
  styleId?: string
): Promise<{ success: boolean; imageUrl?: string; error?: string; requestPrompt?: string; expandedPrompt?: string }> {
  if (provider === 'gemini') {
    return generateImageFromGemini(originalPrompt, userId, storyId);
  }

  if (provider === 'imagen3') {
    // For Imagen3, originalPrompt is the scene instruction with @placeholders
    // It will be structured internally by generateImageFromImagen3
    return generateImageFromImagen3(originalPrompt, userId, storyId, styleId);
  }

  // Picsart provider logic
  const userKeysResult = await getUserApiKeys(userId);
  if (!userKeysResult.success || !userKeysResult.data?.picsartApiKey) {
    return { success: false, error: "Picsart API key not configured by user. Please set it in Account Settings." };
  }
  const picsartApiKey = userKeysResult.data.picsartApiKey;

  let processedPrompt = originalPrompt; // This is the prompt with @placeholders
  if (userId && storyId) {
    try {
      const { getStory } = await import('@/actions/firestoreStoryActions'); 
      const storyResult = await getStory(storyId, userId);
      if (storyResult.success && storyResult.data) {
        const { parseEntityReferences } = await import('@/app/(app)/assemble-video/utils');
        // For Picsart (Flux), we expand the @references directly into the prompt.
        processedPrompt = parseEntityReferences(originalPrompt, storyResult.data);
      }
    } catch (error) { console.warn("Failed to replace placeholders for Picsart, using original prompt:", error); }
  }

  let finalPrompt = processedPrompt || "high quality image";
  if (styleId) {
    try {
      const { applyStyleToPrompt } = await import('@/utils/imageStyleUtils');
      finalPrompt = applyStyleToPrompt(finalPrompt, styleId as string, provider);
    } catch (error) { console.warn("Failed to apply style for Picsart:", error); }
  } else if (userId && storyId) {
    try {
      const { getStory } = await import('@/actions/firestoreStoryActions'); 
      const storyResult = await getStory(storyId, userId);
      if (storyResult.success && storyResult.data?.imageStyleId) {
        const { applyStyleToPrompt } = await import('@/utils/imageStyleUtils');
        finalPrompt = applyStyleToPrompt(finalPrompt, storyResult.data.imageStyleId as string, provider);
      }
    } catch (error) { console.warn("Failed to apply style from story for Picsart:", error); }
  }

  const requestPrompt = finalPrompt;
  const expandedPromptForExport = finalPrompt; // Store the full prompt with entity references + style that's sent to API
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
      let errorData: { message?: string; title?: string; };
      try { errorData = JSON.parse(responseText); } catch { errorData = { message: `PicsArt API request failed with status ${response.status}. Response: ${responseText}` }; }
      return { success: false, error: errorData.message || errorData.title || `PicsArt API request failed: ${response.status}`, requestPrompt, expandedPrompt: expandedPromptForExport };
    }

    const result = JSON.parse(responseText);
    if (response.status === 202 && result.status === 'ACCEPTED' && result.inference_id) {
      const pollResult = await pollForPicsArtImage(result.inference_id, picsartApiKey!, requestPrompt, expandedPromptForExport);
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
          return { success: true, imageUrl: firebaseUrl, requestPrompt, expandedPrompt: expandedPromptForExport };
        } catch (uploadError) {
          console.error("Error uploading image to Firebase Storage:", uploadError);
          return { success: true, imageUrl: result.data[0].url, requestPrompt, expandedPrompt: expandedPromptForExport };
        }
      }
      return { success: true, imageUrl: result.data[0].url, requestPrompt, expandedPrompt: expandedPromptForExport };
    } else {
      const errorDetail = `Status: ${response.status}, Body: ${JSON.stringify(result)}`;
      return { success: false, error: `Unexpected response format from PicsArt API after POST. Details: ${errorDetail}`, requestPrompt, expandedPrompt: expandedPromptForExport };
    }
  } catch (error: unknown) {
    console.error("Error calling PicsArt API:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred while generating the image.";
    return { success: false, error: message, requestPrompt, expandedPrompt: expandedPromptForExport };
  }
}

async function pollForPicsArtImage(
  inferenceId: string,
  apiKey: string,
  requestPrompt: string,
  expandedPrompt: string,
  maxAttempts = 20,
  delayMs = 6000
): Promise<{ success: boolean; imageUrl?: string; error?: string; requestPrompt?: string; expandedPrompt?: string }> {
  const pollingUrl = `https://genai-api.picsart.io/v1/text2image/inferences/${inferenceId}`;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(pollingUrl, { method: "GET", headers: { "x-picsart-api-key": apiKey } });
      const responseText = await response.text();
      let result;
      try {
        result = JSON.parse(responseText);
      } catch {
        if (response.status === 202 && attempt < maxAttempts) { await new Promise(resolve => setTimeout(resolve, delayMs)); continue; }
        return { success: false, error: `PicsArt Polling: Failed to parse JSON. Status: ${response.status}, Body: ${responseText}`, requestPrompt, expandedPrompt };
      }
      if (response.status === 200) {
        let imageUrl: string | undefined;
        if (result.data && result.data.url) { imageUrl = result.data.url; }
        else if (result.data && Array.isArray(result.data) && result.data.length > 0 && result.data[0].url) { imageUrl = result.data[0].url; }
        else if (result.url) { imageUrl = result.url; }
        if (imageUrl) { return { success: true, imageUrl, requestPrompt, expandedPrompt }; }
        else { return { success: false, error: "PicsArt Polling: Image success (200 OK) but no URL found.", requestPrompt, expandedPrompt }; }
      } else if (response.status === 202) {
        if (attempt < maxAttempts) { await new Promise(resolve => setTimeout(resolve, delayMs)); }
      } else {
        return { success: false, error: `PicsArt Polling: Request failed with status ${response.status}. Details: ${JSON.stringify(result)}`, requestPrompt, expandedPrompt };
      }
    } catch (error: unknown) {
      if (attempt >= maxAttempts) {
        const message = error instanceof Error ? error.message : "PicsArt Polling: Error after multiple attempts";
        return { success: false, error: message, requestPrompt, expandedPrompt };
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  return { success: false, error: "Image generation timed out after polling.", requestPrompt, expandedPrompt };
}

export async function listGoogleScriptModels(userId: string): Promise<{ success: boolean; models?: Array<{ id: string; name: string }>; error?: string }> {
  const userKeysResult = await getUserApiKeys(userId);
  if (!userKeysResult.success || !userKeysResult.data?.googleApiKey) {
    return { success: false, error: "Google API key not configured by user. Please set it in Account Settings." };
  }
  const apiKey = userKeysResult.data.googleApiKey;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Failed to fetch Google models:", response.status, errorBody);
      return { success: false, error: `Failed to fetch Google models: ${response.status}` };
    }
    const data = await response.json();
    
    const scriptModels = data.models
      .filter((model: {supportedGenerationMethods?: string[], name: string}) => model.supportedGenerationMethods && model.supportedGenerationMethods.includes('generateContent') && model.name.includes('gemini')) // Filter for gemini models supporting generateContent
      .map((model: {name: string, displayName?: string}) => ({
        id: model.name.startsWith('models/') ? model.name.substring('models/'.length) : model.name, // Strip "models/" prefix for Genkit compatibility
        name: model.displayName || model.name,
      }))
      .sort((a: {name: string}, b: {name: string}) => a.name.localeCompare(b.name)); // Sort by display name

    return { success: true, models: scriptModels };
  } catch (error) {
    console.error("Error listing Google script models:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred while fetching Google models.";
    return { success: false, error: errorMessage };
  }
}

export async function listPerplexityModels(userId: string): Promise<{ success: boolean; models?: Array<{ id: string; name: string }>; error?: string }> {
  const userKeysResult = await getUserApiKeys(userId);
  if (!userKeysResult.success || !userKeysResult.data?.perplexityApiKey) {
    return { success: false, error: "Perplexity API key not configured by user. Please set it in Account Settings." };
  }
  const apiKey = userKeysResult.data.perplexityApiKey;

  try {
    // Note: The Perplexity API documentation should be checked for the correct endpoint and response structure.
    // This is an assumed endpoint and structure.
    const response = await fetch(`https://api.perplexity.ai/models`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Failed to fetch Perplexity models:", response.status, errorBody);
      return { success: false, error: `Failed to fetch Perplexity models: ${response.status}` };
    }
    const data = await response.json();
    
    // Assuming the API returns a list of models, potentially under a 'data' key,
    // and each model object has an 'id' and a 'name' or 'display_name'.
    // This mapping might need adjustment based on the actual API response.
    const modelsArray = data.data || data.models || data; // Try common structures
    if (!Array.isArray(modelsArray)) {
      console.error("Perplexity models response is not an array:", data);
      return { success: false, error: "Unexpected response format from Perplexity models API." };
    }

    const scriptModels = modelsArray
      .map((model: {id: string, name?: string, display_name?: string}) => ({
        id: model.id,
        // Prefer a display name if available, otherwise use id.
        // Some Perplexity models might have more user-friendly names.
        name: model.name || model.display_name || model.id,
      }))
      .sort((a: {name: string}, b: {name: string}) => a.name.localeCompare(b.name));

    return { success: true, models: scriptModels };
  } catch (error) {
    console.error("Error listing Perplexity script models:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred while fetching Perplexity models.";
    return { success: false, error: errorMessage };
  }
}
