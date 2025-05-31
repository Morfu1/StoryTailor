
"use server";

import type { GenerateCharacterPromptsInput } from '@/ai/flows/generate-character-prompts';
import { generateCharacterPrompts as aiGenerateCharacterPrompts } from '@/ai/flows/generate-character-prompts';
import type { GenerateImagePromptsInput } from '@/ai/flows/generate-image-prompts';
import { generateImagePrompts as aiGenerateImagePrompts } from '@/ai/flows/generate-image-prompts';
import type { GenerateNarrationAudioInput, GenerateNarrationAudioOutput } from '@/ai/flows/generate-narration-audio'; // Input will be extended for API keys
import { generateNarrationAudio as aiGenerateNarrationAudio } from '@/ai/flows/generate-narration-audio';
import type { GenerateScriptInput } from '@/ai/flows/generate-script';
import { generateScript as aiGenerateScript } from '@/ai/flows/generate-script';
import type { GenerateTitleInput } from '@/ai/flows/generate-title';
import { generateTitle as aiGenerateTitle } from '@/ai/flows/generate-title';
import type { GenerateScriptChunksInput } from '@/ai/flows/generate-script-chunks';
import { generateScriptChunks as aiGenerateScriptChunks } from '@/ai/flows/generate-script-chunks';
import { firebaseAdmin, dbAdmin } from '@/lib/firebaseAdmin';
import type { Story, ElevenLabsVoice } from '@/types/story';
import type { Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { getStorage as getAdminStorage } from 'firebase-admin/storage';
import { revalidatePath } from 'next/cache';
import { getUserApiKeys } from './apiKeyActions'; // Import the action to get user API keys

// Environment variable getters (only for global/app-owned keys)
function getAppGoogleApiKey(): string | undefined {
  // This key is for app-level Genkit flows, not user-specific Google TTS
  return process.env?.GOOGLE_API_KEY;
}

function getStorageBucket(): string | undefined {
  return process.env?.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
}

// Log dbAdmin status when this module is loaded (server-side)
console.log('---------------------------------------------------------------------');
console.log('[storyActions Module Load] Checking dbAdmin status...');
if (typeof dbAdmin === 'undefined') {
  console.error("[storyActions Module Load] CRITICAL: `dbAdmin` from @/lib/firebaseAdmin is UNDEFINED at module load time. All Firestore admin operations will fail. Check firebaseAdmin.ts logs for errors, especially GOOGLE_APPLICATION_CREDENTIALS configuration and Admin SDK initialization.");
} else {
  console.log("[storyActions Module Load] INFO: `dbAdmin` from @/lib/firebaseAdmin is DEFINED at module load time. Firestore admin operations should be possible IF SDK was fully initialized.");
}
console.log('---------------------------------------------------------------------');


export async function generateTitle(input: GenerateTitleInput) {
  // This Genkit flow uses the global GOOGLE_API_KEY
  try {
    const result = await aiGenerateTitle(input);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error in generateTitle AI flow:", error);
    return { success: false, error: "Failed to generate title." };
  }
}

export async function generateScript(input: GenerateScriptInput) {
  // This Genkit flow uses the global GOOGLE_API_KEY
  try {
    const result = await aiGenerateScript(input);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error in generateScript AI flow:", error);
    return { success: false, error: "Failed to generate script." };
  }
}

export async function generateCharacterPrompts(input: GenerateCharacterPromptsInput) {
  // This Genkit flow uses the global GOOGLE_API_KEY
  try {
    const result = await aiGenerateCharacterPrompts(input);
    return { success: true, data: result };
  } catch (error)    {
    console.error("Error in generateCharacterPrompts AI flow:", error);
    return { success: false, error: "Failed to generate character/item/location prompts." };
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


export interface GenerateNarrationAudioActionInput extends GenerateNarrationAudioInput {
  userId?: string; // userId is crucial for fetching API keys
  storyId?: string;
  chunkId?: string;
  // ttsModel, googleApiModel, languageCode are already in GenerateNarrationAudioInput
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
      serviceApiKey = userApiKeys.googleApiKey; // Or geminiApiKey if specific for Google TTS via Gemini
      if (!serviceApiKey) {
        return { success: false, error: "Google API key for TTS not configured by user. Please set it in Account Settings." };
      }
    }

    const aiFlowInput: GenerateNarrationAudioInput = {
      script: actionInput.script,
      voiceId: actionInput.voiceId,
      ttsModel: modelToUse,
      googleApiModel: actionInput.googleApiModel,
      languageCode: actionInput.languageCode,
      // Pass the fetched API key to the flow
      apiKey: serviceApiKey 
    };
    
    const result: GenerateNarrationAudioOutput = await aiGenerateNarrationAudio(aiFlowInput);

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
    
    if (result.voices) { // This branch is for listing ElevenLabs voices, doesn't need user key if the flow handles it.
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
  userId?: string; // Add userId to fetch API keys for preview
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
      serviceApiKey = userApiKeys.googleApiKey;
      if (!serviceApiKey) {
        return { success: false, error: "Google API key for TTS preview not configured by user. Please set it in Account Settings." };
      }
    }

    const demoText = input.demoText || "Hello! This is a preview of how this voice sounds. I hope you like it!";
    
    const aiFlowInput: GenerateNarrationAudioInput = {
      script: demoText,
      voiceId: input.voiceId,
      ttsModel: input.ttsModel,
      googleApiModel: input.googleApiModel,
      languageCode: input.languageCode,
      apiKey: serviceApiKey,
    };

    const result: GenerateNarrationAudioOutput = await aiGenerateNarrationAudio(aiFlowInput);

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


export async function generateImagePrompts(input: GenerateImagePromptsInput) {
  // This Genkit flow uses the global GOOGLE_API_KEY
  try {
    console.log('=== SERVER ACTION: generateImagePrompts ===');
    console.log('Received input:', {
      scriptLength: input.script?.length,
      imageProvider: input.imageProvider,
      narrationChunksCount: input.narrationChunks?.length,
      audioDurationSeconds: input.audioDurationSeconds
    });
    
    const result = await aiGenerateImagePrompts(input);
    
    console.log('AI flow result:', {
      success: !!result,
      imagePromptsCount: result.imagePrompts?.length,
      hasImagePrompts: !!result.imagePrompts
    });
    
    return { success: true, data: result };
  } catch (error) {
    console.error("Error in generateImagePrompts AI flow:", error);
    console.error("Error details:", {
      name: (error as Error)?.name,
      message: (error as Error)?.message,
      stack: (error as Error)?.stack
    });
    return { success: false, error: "Failed to generate image prompts." };
  }
}

export async function generateScriptChunks(input: GenerateScriptChunksInput) {
  // This Genkit flow uses the global GOOGLE_API_KEY
  try {
    const result = await aiGenerateScriptChunks(input);
    if (result.error) {
      return { success: false, error: result.error };
    }
    return { success: true, data: { scriptChunks: result.scriptChunks } };
  } catch (error) {
    console.error("Error in generateScriptChunks action:", error);
    return { success: false, error: "Failed to generate script chunks." };
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
  userId: string, // Changed from optional to required
  storyId?: string
): Promise<{ success: boolean; imageUrl?: string; error?: string; requestPrompt?: string }> {
  const userKeysResult = await getUserApiKeys(userId);
  if (!userKeysResult.success || !userKeysResult.data) {
    return { success: false, error: "Could not fetch user API keys for Gemini. " + (userKeysResult.error || "") };
  }
  const apiKey = userKeysResult.data.geminiApiKey || userKeysResult.data.googleApiKey;

  if (!apiKey) {
    console.error("User has not configured a Gemini/Google API key.");
    return { success: false, error: "Gemini/Google API key not configured by user. Please set it in Account Settings." };
  }

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
  userId: string, // Changed from optional to required
  storyId?: string,
  styleId?: string
): Promise<{ success: boolean; imageUrl?: string; error?: string; requestPrompt?: string }> {
  const userKeysResult = await getUserApiKeys(userId);
  if (!userKeysResult.success || !userKeysResult.data) {
    return { success: false, error: "Could not fetch user API keys for Imagen3. " + (userKeysResult.error || "") };
  }
  const apiKey = userKeysResult.data.googleApiKey; // Assuming Imagen3 uses the general Google API key

  if (!apiKey) {
    console.error("User has not configured a Google API key for Imagen3.");
    return { success: false, error: "Google API key for Imagen3 not configured by user. Please set it in Account Settings." };
  }

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
  userId: string, // Changed from optional to required
  storyId?: string,
  provider: 'picsart' | 'gemini' | 'imagen3' = 'picsart',
  styleId?: string
): Promise<{ success: boolean; imageUrl?: string; error?: string; requestPrompt?: string }> {
  if (provider === 'gemini') {
    // generateImageFromGemini now requires userId
    return generateImageFromGemini(originalPrompt, userId, storyId);
  }
  
  if (provider === 'imagen3') {
    // generateImageFromImagen3 now requires userId
    return generateImageFromImagen3(originalPrompt, userId, storyId, styleId);
  }
  
  // Picsart implementation
  const userKeysResult = await getUserApiKeys(userId);
  if (!userKeysResult.success || !userKeysResult.data) {
    return { success: false, error: "Could not fetch user API keys for Picsart. " + (userKeysResult.error || "") };
  }
  const picsartApiKey = userKeysResult.data.picsartApiKey;

  if (!picsartApiKey) {
    console.error("User has not configured a Picsart API key.");
    return { success: false, error: "Picsart API key not configured by user. Please set it in Account Settings." };
  }

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

    