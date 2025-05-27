"use server";

import type { GenerateCharacterPromptsInput } from '@/ai/flows/generate-character-prompts';
import { generateCharacterPrompts as aiGenerateCharacterPrompts } from '@/ai/flows/generate-character-prompts';
import type { GenerateImagePromptsInput } from '@/ai/flows/generate-image-prompts';
import { generateImagePrompts as aiGenerateImagePrompts } from '@/ai/flows/generate-image-prompts';
import type { GenerateNarrationAudioInput, GenerateNarrationAudioOutput } from '@/ai/flows/generate-narration-audio';
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

// Environment variable getters to prevent serialization issues
function getGeminiApiKey(): string | undefined {
  return process.env?.GEMINI_API_KEY;
}

function getPicsartApiKey(): string | undefined {
  return process.env?.PICSART_API_KEY;
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
  try {
    const result = await aiGenerateTitle(input);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error in generateTitle AI flow:", error);
    return { success: false, error: "Failed to generate title." };
  }
}

export async function generateScript(input: GenerateScriptInput) {
  try {
    const result = await aiGenerateScript(input);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error in generateScript AI flow:", error);
    return { success: false, error: "Failed to generate script." };
  }
}

export async function generateCharacterPrompts(input: GenerateCharacterPromptsInput) {
  try {
    const result = await aiGenerateCharacterPrompts(input);
    return { success: true, data: result };
  } catch (error)    {
    console.error("Error in generateCharacterPrompts AI flow:", error);
    return { success: false, error: "Failed to generate character/item/location prompts." };
  }
}

// Helper function to estimate duration from audio data URI (MP3 or WAV)
// This is a very rough estimation and might not be accurate.
// A proper solution would involve an audio library to parse audio metadata.
function getMp3DurationFromDataUri(dataUri: string): number {
  try {
    let base64Data: string;
    let estimatedBytesPerSecond: number;

    if (dataUri.startsWith('data:audio/mpeg;base64,')) {
      // MP3 format
      base64Data = dataUri.substring('data:audio/mpeg;base64,'.length);
      // Extremely rough estimate: 128 kbps CBR would be 16000 bytes per second.
      const estimatedBitrateKbps = 128;
      estimatedBytesPerSecond = (estimatedBitrateKbps * 1000) / 8;
    } else if (dataUri.startsWith('data:audio/wav;base64,')) {
      // WAV format (uncompressed PCM, typically from Google TTS)
      base64Data = dataUri.substring('data:audio/wav;base64,'.length);
      // WAV PCM at 24kHz, 16-bit, mono = 24000 * 2 = 48000 bytes per second
      estimatedBytesPerSecond = 48000; // Assuming Google TTS 24kHz 16-bit mono
    } else {
      console.warn('Cannot estimate duration: Unsupported audio format in data URI.');
      return 30; // Default duration
    }

    const binaryData = Buffer.from(base64Data, 'base64');
    const durationSeconds = binaryData.length / estimatedBytesPerSecond;

    // If it's the placeholder silent audio, set duration to 1 sec to avoid issues.
    if (base64Data === 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAAA') { // This is a WAV placeholder
        console.warn('Placeholder WAV audio detected, setting duration to 1s.');
        return 1;
    }
    if (binaryData.length < 1000 && durationSeconds < 1) { // very short, likely placeholder or error
        console.warn('Very short audio detected, possibly placeholder or error. Setting duration to 1s.');
        return 1;
    }

    return Math.max(1, parseFloat(durationSeconds.toFixed(2))); // Ensure at least 1 second
  } catch (e) {
    console.error('Error estimating MP3 duration:', e);
    return 30; // Default on error
  }
}


// Define a new input type for the server action that includes storage parameters
export interface GenerateNarrationAudioActionInput extends GenerateNarrationAudioInput {
  userId?: string;
  storyId?: string;
  chunkId?: string; // Or chunkIndex: number
  ttsModel?: 'elevenlabs' | 'google';
  googleApiModel?: string;
  languageCode?: string;
}

export async function generateNarrationAudio(actionInput: GenerateNarrationAudioActionInput): Promise<{ success: boolean; data?: { audioStorageUrl?: string; voices?: ElevenLabsVoice[]; duration?: number }; error?: string }> {
  try {
    // Prepare input for the AI flow
    const aiFlowInput: GenerateNarrationAudioInput = {
      script: actionInput.script,
      voiceId: actionInput.voiceId,
      ttsModel: actionInput.ttsModel || 'elevenlabs',
      googleApiModel: actionInput.googleApiModel,
      languageCode: actionInput.languageCode,
    };
    const result: GenerateNarrationAudioOutput = await aiGenerateNarrationAudio(aiFlowInput);

    if (result.error) {
      return { success: false, error: result.error };
    }

    if (result.audioDataUri) {
      const duration = getMp3DurationFromDataUri(result.audioDataUri);
      // If userId, storyId, and chunkId are provided, upload to storage
      if (actionInput.userId && actionInput.storyId && actionInput.chunkId) {
        try {
          // Determine file extension based on the data URI format
          const fileExtension = result.audioDataUri.startsWith('data:audio/wav;base64,') ? 'wav' : 'mp3';
          const filename = `narration_chunk_${actionInput.chunkId}.${fileExtension}`;
          const storageUrl = await uploadAudioToFirebaseStorage(result.audioDataUri, actionInput.userId, actionInput.storyId, filename);
          console.log(`Uploaded narration chunk ${actionInput.chunkId} to: ${storageUrl}`);
          return { success: true, data: { audioStorageUrl: storageUrl, duration } };
        } catch (uploadError) {
          console.error(`Failed to upload narration chunk ${actionInput.chunkId} to Firebase Storage:`, uploadError);
          // Fallback: return data URI if upload fails? Or just error? For now, error.
          return { success: false, error: `Failed to upload audio for chunk ${actionInput.chunkId}: ${(uploadError as Error).message}` };
        }
      } else {
        // This case should ideally not happen if we always want to store generated audio for chunks.
        // If it's just listing voices, this part is skipped.
        // If it's generating audio but without storage info, it's a problem for document size.
        // For now, we'll assume if audioDataUri is present, storage info should also be present for chunks.
        // However, the voice listing part of the flow doesn't produce audioDataUri.
        console.warn("generateNarrationAudio action: audioDataUri present but missing userId, storyId, or chunkId for storage. Returning data URI (not recommended for chunks).");
        // To strictly enforce storage for generated audio, we might error here if storage params are missing.
        // For now, to maintain compatibility with potential non-chunked use or voice listing:
        return { success: true, data: { audioStorageUrl: result.audioDataUri, duration } }; // Effectively still a data URI if not uploaded
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


export async function generateImagePrompts(input: GenerateImagePromptsInput) {
  try {
    const result = await aiGenerateImagePrompts(input);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error in generateImagePrompts AI flow:", error);
    return { success: false, error: "Failed to generate image prompts." };
  }
}

export async function generateScriptChunks(input: GenerateScriptChunksInput) {
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


// Helper function to check if a URL is a Firebase Storage URL and refresh it if needed
async function refreshFirebaseStorageUrl(url: string, userId: string, storyId: string, filePath?: string): Promise<string | null> {
  if (!url || typeof url !== 'string') return null;
  
  // Check if this is a Firebase Storage URL
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
    
    // If filePath is not provided, try to extract it from the URL or use default path
    if (!filePath) {
      // Try to extract the file path from the URL
      try {
        // Parse the URL to extract the path
        const urlObj = new URL(url);
        const pathMatch = urlObj.pathname.match(/\/o\/(.+?)(?:\?|$)/);
        if (pathMatch && pathMatch[1]) {
          // Firebase Storage URLs encode the path, so decode it
          filePath = decodeURIComponent(pathMatch[1]);
          console.log(`[refreshFirebaseStorageUrl] Extracted file path from URL: ${filePath}`);
        } else {
          // Default to narration.mp3 if path extraction fails
          filePath = `users/${userId}/stories/${storyId}/narration.mp3`;
          console.log(`[refreshFirebaseStorageUrl] Using default narration path: ${filePath}`);
        }
      } catch (error) {
        // If URL parsing fails, use default path
        filePath = `users/${userId}/stories/${storyId}/narration.mp3`;
        console.log(`[refreshFirebaseStorageUrl] URL parsing failed, using default path: ${filePath}`);
      }
    }
    
    const file = bucket.file(filePath);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      console.warn(`[refreshFirebaseStorageUrl] File does not exist at path: ${filePath}`);
      return null;
    }
    
    // Generate a new signed URL
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 1000 * 60 * 60 * 24 * 7 // 7 days expiry
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
    // Add timeout to detect connection issues faster
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
    
    // Race between the fetch and the timeout
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
      
      // Refresh the narration audio URL if it's a Firebase Storage URL
      if (story.narrationAudioUrl) {
        const refreshedUrl = await refreshFirebaseStorageUrl(story.narrationAudioUrl, userId, storyId);
        if (refreshedUrl) {
          console.log(`[getStory Action] Refreshed narrationAudioUrl from: ${story.narrationAudioUrl} to: ${refreshedUrl}`);
          story.narrationAudioUrl = refreshedUrl;
          
          // Update the story in Firestore with the new URL
          await storyRef.update({ narrationAudioUrl: refreshedUrl });
        }
      }
      
      // Refresh the character/item/location image URLs if they exist
      if (story.generatedImages && Array.isArray(story.generatedImages) && story.generatedImages.length > 0) {
        let hasUpdatedImages = false;
        
        // Create a new array with refreshed URLs
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
        
        // Update the story data with refreshed image URLs
        if (hasUpdatedImages) {
          story.generatedImages = refreshedImages;
          
          // Update the story in Firestore with the new image URLs
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
      
      // Check for common connection error patterns
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
  userId?: string,
  storyId?: string
): Promise<{ success: boolean; imageUrl?: string; error?: string; requestPrompt?: string }> {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    console.error("Gemini API key is not configured.");
    return { success: false, error: "Gemini API key is not configured." };
  }

  const styles = "3D, Cartoon, High Quality, 16:9 aspect ratio, detailed, sharp, professional photography";
  const requestPrompt = originalPrompt ? `${originalPrompt}, ${styles}` : styles;

  try {
    console.log(`Calling Gemini API with prompt: "${requestPrompt}"`);
    
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
    console.log("Gemini API Response:", result);

    // Extract image data from response
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

    // Convert base64 to blob URL or upload to Firebase
    if (userId && storyId) {
      try {
        // Create a safe filename from the prompt
        const safePrompt = originalPrompt.substring(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const imageName = `gemini_${Date.now()}_${safePrompt}`;
        
        // Convert base64 to buffer and upload to Firebase Storage
        const imageBuffer = Buffer.from(imageData, 'base64');
        const firebaseUrl = await uploadImageBufferToFirebaseStorage(imageBuffer, userId, storyId, imageName, 'image/png');
        
        return {
          success: true,
          imageUrl: firebaseUrl,
          requestPrompt
        };
      } catch (uploadError) {
        console.error("Error uploading image to Firebase Storage:", uploadError);
        // If upload fails, return base64 data URL
        return { 
          success: true, 
          imageUrl: `data:image/png;base64,${imageData}`, 
          requestPrompt 
        };
      }
    }
    
    return { 
      success: true, 
      imageUrl: `data:image/png;base64,${imageData}`, 
      requestPrompt 
    };

  } catch (error: any) {
    console.error("Error calling Gemini API:", error);
    return { success: false, error: error.message || "An unknown error occurred while generating the image.", requestPrompt };
  }
}

export async function generateImageFromImagen3(
  originalPrompt: string,
  userId?: string,
  storyId?: string
): Promise<{ success: boolean; imageUrl?: string; error?: string; requestPrompt?: string }> {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    console.error("Gemini API key is not configured.");
    return { success: false, error: "Gemini API key is not configured." };
  }

  const styles = "3D, Cartoon, High Quality";
  const requestPrompt = originalPrompt ? `${originalPrompt}, ${styles}` : styles;

  try {
    console.log(`Calling Imagen 3 API with prompt: "${requestPrompt}"`);
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [{
          prompt: requestPrompt
        }],
        parameters: {
          sampleCount: 1,
          aspectRatio: "16:9",
          personGeneration: "ALLOW_ADULT"
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Imagen 3 API Error Response:", errorText);
      return { success: false, error: `Imagen 3 API request failed: ${response.status}`, requestPrompt };
    }

    const result = await response.json();
    console.log("Imagen 3 API Response:", result);

    // Extract image data from response
    const predictions = result.predictions;
    if (!predictions || predictions.length === 0) {
      return { success: false, error: "No image data returned from Imagen 3 API", requestPrompt };
    }

    const imageData = predictions[0]?.bytesBase64Encoded;
    if (!imageData) {
      return { success: false, error: "No image bytes in Imagen 3 response", requestPrompt };
    }

    // Convert base64 to blob URL or upload to Firebase
    if (userId && storyId) {
      try {
        // Create a safe filename from the prompt
        const safePrompt = originalPrompt.substring(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const imageName = `imagen3_${Date.now()}_${safePrompt}`;
        
        // Convert base64 to buffer and upload to Firebase Storage
        const imageBuffer = Buffer.from(imageData, 'base64');
        const firebaseUrl = await uploadImageBufferToFirebaseStorage(imageBuffer, userId, storyId, imageName, 'image/png');
        
        return {
          success: true,
          imageUrl: firebaseUrl,
          requestPrompt
        };
      } catch (uploadError) {
        console.error("Error uploading image to Firebase Storage:", uploadError);
        // If upload fails, return base64 data URL
        return { 
          success: true, 
          imageUrl: `data:image/png;base64,${imageData}`, 
          requestPrompt 
        };
      }
    }
    
    return { 
      success: true, 
      imageUrl: `data:image/png;base64,${imageData}`, 
      requestPrompt 
    };

  } catch (error: any) {
    console.error("Error calling Imagen 3 API:", error);
    return { success: false, error: error.message || "An unknown error occurred while generating the image.", requestPrompt };
  }
}

export async function generateImageFromPrompt(
  originalPrompt: string,
  userId?: string,
  storyId?: string,
  provider: 'picsart' | 'gemini' | 'imagen3' = 'picsart'
): Promise<{ success: boolean; imageUrl?: string; error?: string; requestPrompt?: string }> {
  if (provider === 'gemini') {
    return generateImageFromGemini(originalPrompt, userId, storyId);
  }
  
  if (provider === 'imagen3') {
    return generateImageFromImagen3(originalPrompt, userId, storyId);
  }
  
  // Original Picsart implementation
  const picsartApiKey = getPicsartApiKey();

  if (!picsartApiKey) {
    console.error("PicsArt API key is not configured.");
    return { success: false, error: "PicsArt API key is not configured." };
  }

  const styles = "3D, Cartoon, High Quality";
  // Ensure originalPrompt is not empty before adding styles
  const requestPrompt = originalPrompt ? `${originalPrompt}, ${styles}` : styles;
  
  // A more concise negative prompt, focusing on common issues.
  // The SDK example used: Yup.string().min(7).max(100).required() for negativePrompt,
  // implying it shouldn't be empty if provided. For robust behavior, we can set a default.
  const negativePrompt = "ugly, tiling, poorly drawn hands, poorly drawn feet, poorly drawn face, out of frame, extra limbs, disfigured, deformed, body out of frame, blurry, bad anatomy, blurred, watermark, grainy, signature, cut off, draft, low quality, worst quality, SFW, text, words, letters, nsfw, nude";
  const width = 1024; // As requested: 16:9
  const height = 576; // As requested: 16:9
  const count = 1; // Generate one image per prompt

  try {
    console.log(`Calling PicsArt API with prompt: "${requestPrompt}"`);
    const response = await fetch("https://genai-api.picsart.io/v1/text2image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-picsart-api-key": picsartApiKey,
      },
      body: JSON.stringify({
        prompt: requestPrompt,
        negativePrompt, // Ensure this is not empty if the API strictly requires it
        width,
        height,
        count,
        // model: "Flux" // Model is not a direct parameter in the SDK, might be inferred or part of base URL/key config
        // styles: ["3D", "Cartoon", "High Quality"] // Styles are often part of the prompt or separate parameters; here, appended to prompt.
      }),
    });

    const responseText = await response.text(); // Read response text for better debugging

    if (!response.ok) {
      console.error("PicsArt API Error Response Text:", responseText);
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch (e) {
        errorData = { message: `PicsArt API request failed with status ${response.status}. Response: ${responseText}` };
      }
      return { success: false, error: errorData.message || errorData.title || `PicsArt API request failed: ${response.status}`, requestPrompt };
    }

    const result = JSON.parse(responseText);
    console.log("PicsArt API POST Response Body:", result);

    // PicsArt text2image POST call returns 202 Accepted with an inference_id for async processing.
    if (response.status === 202 && result.status === 'ACCEPTED' && result.inference_id) {
      console.log(`PicsArt API job accepted with inference ID: ${result.inference_id}. Starting polling.`);
      const pollResult = await pollForPicsArtImage(result.inference_id, picsartApiKey!, requestPrompt); // picsartApiKey is checked for null/undefined at the start
      
      // If image generation was successful and we have userId and storyId, upload to Firebase Storage
      if (pollResult.success && pollResult.imageUrl && userId && storyId) {
        try {
          // Create a safe filename from the prompt
          const safePrompt = originalPrompt.substring(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase();
          const imageName = `${Date.now()}_${safePrompt}`;
          
          // Upload the image to Firebase Storage
          const firebaseUrl = await uploadImageToFirebaseStorage(pollResult.imageUrl, userId, storyId, imageName);
          
          // Return the Firebase Storage URL instead of the original URL
          return {
            success: true,
            imageUrl: firebaseUrl,
            requestPrompt: pollResult.requestPrompt
          };
        } catch (uploadError) {
          console.error("Error uploading image to Firebase Storage:", uploadError);
          // If upload fails, still return the original URL so the user can see the image
          return pollResult;
        }
      }
      
      return pollResult;
    } else if (response.ok && result.data && Array.isArray(result.data) && result.data.length > 0 && result.data[0].url) {
      // This handles a less likely case where the API might return image data directly on a successful POST (e.g. status 200).
      // The primary documentation for text2image suggests a 202 response.
      console.log("PicsArt API returned image data directly on POST:", result.data[0].url);
      
      // If we have userId and storyId, upload to Firebase Storage
      if (userId && storyId) {
        try {
          // Create a safe filename from the prompt
          const safePrompt = originalPrompt.substring(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase();
          const imageName = `${Date.now()}_${safePrompt}`;
          
          // Upload the image to Firebase Storage
          const firebaseUrl = await uploadImageToFirebaseStorage(result.data[0].url, userId, storyId, imageName);
          
          // Return the Firebase Storage URL instead of the original URL
          return {
            success: true,
            imageUrl: firebaseUrl,
            requestPrompt
          };
        } catch (uploadError) {
          console.error("Error uploading image to Firebase Storage:", uploadError);
          // If upload fails, still return the original URL so the user can see the image
          return { success: true, imageUrl: result.data[0].url, requestPrompt };
        }
      }
      
      return { success: true, imageUrl: result.data[0].url, requestPrompt };
    } else {
      // If POST was 'ok' (2xx) but not the expected 202 with 'ACCEPTED' status & inference_id,
      // and not a direct data response, then it's an unexpected format.
      const errorDetail = `Status: ${response.status}, Body: ${JSON.stringify(result)}`;
      console.error(`PicsArt API POST response was 'ok' but in an unexpected format: ${errorDetail}`);
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
  maxAttempts = 20, // Approx 2 minutes if delay is 6 seconds
  delayMs = 6000 // 6 seconds delay between polls
): Promise<{ success: boolean; imageUrl?: string; error?: string; requestPrompt?: string }> {
  const pollingUrl = `https://genai-api.picsart.io/v1/text2image/inferences/${inferenceId}`;
  console.log(`Starting polling for inference ID: ${inferenceId} at URL: ${pollingUrl}`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`Polling attempt ${attempt}/${maxAttempts} for inference ID: ${inferenceId}`);
    try {
      const response = await fetch(pollingUrl, {
        method: "GET",
        headers: {
          "x-picsart-api-key": apiKey,
        },
      });

      const responseText = await response.text();
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        console.error(`PicsArt Polling: Failed to parse JSON response (Attempt ${attempt}). Status: ${response.status}, Response: ${responseText}`);
        // If parsing fails on a 202, we might want to continue polling
        if (response.status === 202 && attempt < maxAttempts) {
           await new Promise(resolve => setTimeout(resolve, delayMs));
           continue;
        }
        return { success: false, error: `PicsArt Polling: Failed to parse JSON response. Status: ${response.status}, Body: ${responseText}`, requestPrompt };
      }
      
      console.log(`PicsArt Polling (Attempt ${attempt}) - Status: ${response.status}, Body:`, result);

      if (response.status === 200) { // Success
        // Assuming the successful response structure contains the image URL.
        // Based on typical API patterns and trying to be flexible:
        let imageUrl: string | undefined;
        if (result.data && result.data.url) { // e.g., { data: { url: "..." } }
            imageUrl = result.data.url;
        } else if (result.data && Array.isArray(result.data) && result.data.length > 0 && result.data[0].url) { // e.g., { data: [{ url: "..." }] }
            imageUrl = result.data[0].url;
        } else if (result.url) { // e.g., { url: "..." }
            imageUrl = result.url;
        }


        if (imageUrl) {
          console.log(`PicsArt Polling: Image ready for inference ID ${inferenceId}. URL: ${imageUrl}`);
          return { success: true, imageUrl, requestPrompt };
        } else {
          console.error(`PicsArt Polling: Image success response (200 OK) did not contain expected image URL structure. Inference ID: ${inferenceId}. Response:`, result);
          return { success: false, error: "PicsArt Polling: Image success response (200 OK) but no URL found.", requestPrompt };
        }
      } else if (response.status === 202) { // Accepted, still processing
        console.log(`PicsArt Polling: Image for inference ID ${inferenceId} is still processing (status 202). Waiting...`);
        // Optional: Check result.status if the body of 202 contains more detailed status e.g. result.status === "PROCESSING"
        if (result && result.status && result.status !== 'PROCESSING' && result.status !== 'PENDING' && result.status !== 'ACCEPTED') {
            // If status is something else like FAILED even with HTTP 202, it might be an issue.
            console.warn(`PicsArt Polling: Inference ID ${inferenceId} returned 202 but with body status: ${result.status}. Treating as still processing for now.`);
        }
        // Wait before next attempt, unless it's the last one
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      } else { // Other error statuses (4xx, 5xx)
        console.error(`PicsArt Polling: Request failed for inference ID ${inferenceId}. Status: ${response.status}. Response:`, result);
        return { success: false, error: `PicsArt Polling: Request failed with status ${response.status}. Details: ${JSON.stringify(result)}`, requestPrompt };
      }
    } catch (error: any) {
      console.error(`PicsArt Polling: Error during fetch for inference ID ${inferenceId} (Attempt ${attempt}):`, error);
      // If it's the last attempt or a critical error, return failure
      if (attempt >= maxAttempts) {
        return { success: false, error: `PicsArt Polling: An error occurred after multiple attempts: ${error.message}`, requestPrompt };
      }
      // Wait before retrying on general error
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  console.log(`PicsArt Polling: Max attempts reached for inference ID ${inferenceId}. Image generation timed out.`);
  return { success: false, error: "Image generation timed out after polling.", requestPrompt };
}

// Function to upload image to Firebase Storage
async function uploadImageToFirebaseStorage(imageUrl: string, userId: string, storyId: string, imageName: string): Promise<string> {
  console.log('[uploadImageToFirebaseStorage] Initiating image upload...');
  if (!firebaseAdmin.apps.length || !firebaseAdmin.app()) {
    console.error("[uploadImageToFirebaseStorage] CRITICAL: Firebase Admin SDK app is not initialized. Cannot perform storage operations.");
    throw new Error("Firebase Admin SDK app is not initialized for storage operations.");
  }
  const adminAppInstance = firebaseAdmin.app();
  const storage = getAdminStorage(adminAppInstance);

  const bucketName = getStorageBucket();

  if (!bucketName || bucketName.trim() === "") {
    console.error("[uploadImageToFirebaseStorage] CRITICAL: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET environment variable is not set or is empty. Cannot determine storage bucket.");
    throw new Error("Firebase Storage bucket name is not configured. Please set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET in your .env.local file.");
  }
  console.log(`[uploadImageToFirebaseStorage] INFO: Attempting to use Firebase Storage bucket: '${bucketName}'`);

  const bucket = storage.bucket(bucketName);

  try {
    // Fetch the image from the URL
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image from URL: ${response.statusText}`);
    }
    
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    // Create a unique file path for the image
    const filePath = `users/${userId}/stories/${storyId}/images/${imageName}.jpg`;
    const file = bucket.file(filePath);

    console.log(`[uploadImageToFirebaseStorage] INFO: Uploading image buffer (${imageBuffer.length} bytes) to gs://${bucketName}/${filePath}`);

    await file.save(imageBuffer, {
      metadata: {
        contentType: contentType,
      },
    });

    // Using getSignedUrl for better security
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 1000 * 60 * 60 * 24 * 7 // 7 days expiry for simplicity
    });

    console.log(`[uploadImageToFirebaseStorage] SUCCESS: Image uploaded to ${filePath}. Signed URL (valid for 7 days): ${signedUrl}`);
    return signedUrl;
  } catch (error) {
    console.error("[uploadImageToFirebaseStorage] ERROR: Failed to upload image:", error);
    throw error;
  }
}

async function uploadImageBufferToFirebaseStorage(imageBuffer: Buffer, userId: string, storyId: string, imageName: string, contentType: string): Promise<string> {
  console.log('[uploadImageBufferToFirebaseStorage] Initiating image buffer upload...');
  if (!firebaseAdmin.apps.length || !firebaseAdmin.app()) {
    console.error("[uploadImageBufferToFirebaseStorage] CRITICAL: Firebase Admin SDK app is not initialized. Cannot perform storage operations.");
    throw new Error("Firebase Admin SDK app is not initialized for storage operations.");
  }
  const adminAppInstance = firebaseAdmin.app();
  const storage = getAdminStorage(adminAppInstance);

  const bucketName = getStorageBucket();

  if (!bucketName || bucketName.trim() === "") {
    console.error("[uploadImageBufferToFirebaseStorage] CRITICAL: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET environment variable is not set or is empty. Cannot determine storage bucket.");
    throw new Error("Firebase Storage bucket name is not configured. Please set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET in your .env.local file.");
  }
  console.log(`[uploadImageBufferToFirebaseStorage] INFO: Attempting to use Firebase Storage bucket: '${bucketName}'`);

  const bucket = storage.bucket(bucketName);

  try {
    // Create a unique file path for the image
    const filePath = `users/${userId}/stories/${storyId}/images/${imageName}.png`;
    const file = bucket.file(filePath);

    console.log(`[uploadImageBufferToFirebaseStorage] INFO: Uploading image buffer (${imageBuffer.length} bytes) to gs://${bucketName}/${filePath}`);

    await file.save(imageBuffer, {
      metadata: {
        contentType: contentType,
      },
    });

    // Using getSignedUrl for better security
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 1000 * 60 * 60 * 24 * 7 // 7 days expiry for simplicity
    });

    console.log(`[uploadImageBufferToFirebaseStorage] SUCCESS: Image uploaded to ${filePath}. Signed URL (valid for 7 days): ${signedUrl}`);
    return signedUrl;
  } catch (error) {
    console.error("[uploadImageBufferToFirebaseStorage] ERROR: Failed to upload image:", error);
    throw error;
  }
}

async function uploadAudioToFirebaseStorage(audioDataUri: string, userId: string, storyId: string, filename: string): Promise<string> {
  console.log(`[uploadAudioToFirebaseStorage] Initiating audio upload for filename: ${filename}...`);
  if (!firebaseAdmin.apps.length || !firebaseAdmin.app()) {
    console.error("[uploadAudioToFirebaseStorage] CRITICAL: Firebase Admin SDK app is not initialized. Cannot perform storage operations.");
    throw new Error("Firebase Admin SDK app is not initialized for storage operations.");
  }
  const adminAppInstance = firebaseAdmin.app();
  const storage = getAdminStorage(adminAppInstance);

  const bucketName = getStorageBucket();

  if (!bucketName || bucketName.trim() === "") {
    console.error("[uploadAudioToFirebaseStorage] CRITICAL: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET environment variable is not set or is empty. Cannot determine storage bucket.");
    throw new Error("Firebase Storage bucket name is not configured. Please set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET in your .env.local file.");
  }
  console.log(`[uploadAudioToFirebaseStorage] INFO: Attempting to use Firebase Storage bucket: '${bucketName}'`);

  const bucket = storage.bucket(bucketName);

  let base64Data: string;
  let contentType: string;

  if (audioDataUri.startsWith('data:audio/mpeg;base64,')) {
    base64Data = audioDataUri.substring('data:audio/mpeg;base64,'.length);
    contentType = 'audio/mpeg';
  } else if (audioDataUri.startsWith('data:audio/wav;base64,')) {
    base64Data = audioDataUri.substring('data:audio/wav;base64,'.length);
    contentType = 'audio/wav';
  } else {
    console.error('[uploadAudioToFirebaseStorage] ERROR: Invalid audio data URI format.');
    throw new Error('Invalid audio data URI format. Expected data:audio/mpeg;base64,... or data:audio/wav;base64,...');
  }
  const audioBuffer = Buffer.from(base64Data, 'base64');
  
  // Use the provided filename and store chunks in a dedicated subfolder
  const filePath = `users/${userId}/stories/${storyId}/narration_chunks/${filename}`;
  const file = bucket.file(filePath);

  console.log(`[uploadAudioToFirebaseStorage] INFO: Uploading audio buffer (${audioBuffer.length} bytes) to gs://${bucketName}/${filePath}`);

  await file.save(audioBuffer, {
    metadata: {
      contentType: contentType,
    },
  });

  // Using getSignedUrl for better security
  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 1000 * 60 * 60 * 24 * 7 // 7 days expiry for simplicity
  });

  console.log(`[uploadAudioToFirebaseStorage] SUCCESS: Audio uploaded to ${filePath}. Signed URL (valid for 7 days): ${signedUrl}`);
  return signedUrl;
}


// Helper function to clean up broken image URLs
export async function cleanupBrokenImages(storyId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  console.log(`[cleanupBrokenImages] Starting cleanup for story ${storyId}, user ${userId}`);
  console.log(`[cleanupBrokenImages] dbAdmin status:`, !!dbAdmin);
  
  if (!dbAdmin) {
    console.error(`[cleanupBrokenImages] Database connection not available`);
    return { success: false, error: "Database connection not available" };
  }

  try {
    const storyRef = dbAdmin.collection('stories').doc(storyId);
    const storyDoc = await storyRef.get();
    
    if (!storyDoc.exists) {
      return { success: false, error: "Story not found" };
    }

    const storyData = storyDoc.data() as any; // Use any to handle extra properties
    let updated = false;
    const updateData: any = {};

    // Clean up generated images
    if (storyData.generatedImages && Array.isArray(storyData.generatedImages)) {
      const cleanGeneratedImages = storyData.generatedImages.filter((img: any) => {
        // Remove PicsArt URLs that might be broken
        if (img.imageUrl && img.imageUrl.includes('aicdn.picsart.com')) {
          console.log(`[cleanupBrokenImages] Removing broken PicsArt URL: ${img.imageUrl}`);
          return false;
        }
        // Remove audio files that got corrupted as image URLs
        if (img.imageUrl && img.imageUrl.includes('.mp3')) {
          console.log(`[cleanupBrokenImages] Removing corrupted audio file as image: ${img.imageUrl}`);
          return false;
        }
        return true;
      });
      
      if (cleanGeneratedImages.length !== storyData.generatedImages.length) {
        updateData.generatedImages = cleanGeneratedImages;
        updated = true;
      }
    }

    // Clean up detail images (if they exist as a custom property)
    if (storyData.detailImages && Array.isArray(storyData.detailImages)) {
      const cleanDetailImages = storyData.detailImages.filter((img: any) => {
        // Remove PicsArt URLs that might be broken
        if (img.imageUrl && img.imageUrl.includes('aicdn.picsart.com')) {
          console.log(`[cleanupBrokenImages] Removing broken PicsArt detail URL: ${img.imageUrl}`);
          return false;
        }
        return true;
      });
      
      if (cleanDetailImages.length !== storyData.detailImages.length) {
        updateData.detailImages = cleanDetailImages;
        updated = true;
      }
    }

    if (updated) {
      updateData.updatedAt = firebaseAdmin.firestore.FieldValue.serverTimestamp();
      await storyRef.update(updateData);
      console.log(`[cleanupBrokenImages] Successfully cleaned up broken images for story ${storyId}`);
    } else {
      console.log(`[cleanupBrokenImages] No broken images found for story ${storyId}`);
    }

    return { success: true };
  } catch (error) {
    console.error(`[cleanupBrokenImages] Error cleaning up story ${storyId}:`, error);
    return { success: false, error: `Failed to cleanup broken images: ${error}` };
  }
}

export async function saveStory(storyData: Story, userId: string): Promise<{ success: boolean; storyId?: string; error?: string, data?: { narrationAudioUrl?: string} }> {
  console.log('---------------------------------------------------------------------');
  console.log("[saveStory Action] Initiated. User ID:", userId, "Story ID (if exists):", storyData.id);
  
  if (!dbAdmin) {
    const errorMessage = "Server configuration error: Database connection (dbAdmin) is not available. Firebase Admin SDK might not be initialized. Check server logs for firebaseAdmin.ts output.";
    console.error("[saveStory Action] CRITICAL ERROR:", errorMessage);
    return { success: false, error: errorMessage };
  }
   console.log("[saveStory Action] INFO: dbAdmin is DEFINED.");

  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    console.error("[saveStory Action] Error: Authenticated User ID is invalid or missing:", userId);
    return { success: false, error: "User not authenticated or user ID is invalid." };
  }

  const storyIdForPath = storyData.id || dbAdmin.collection("stories").doc().id; 

  let processedStoryData = { ...storyData };
  let newNarrationUrl: string | undefined = undefined;

  if (processedStoryData.narrationAudioUrl && processedStoryData.narrationAudioUrl.startsWith('data:audio/mpeg;base64,')) {
    try {
      console.log("[saveStory Action] INFO: narrationAudioUrl is a data URI. Attempting upload to Firebase Storage.");
      const defaultFilename = "uploaded_narration.mp3"; // Or simply "narration.mp3"
      const storageUrl = await uploadAudioToFirebaseStorage(processedStoryData.narrationAudioUrl, userId, storyIdForPath, defaultFilename);
      processedStoryData.narrationAudioUrl = storageUrl; // Update with the actual storage URL
      newNarrationUrl = storageUrl;
      console.log("[saveStory Action] SUCCESS: Audio successfully uploaded. narrationAudioUrl updated to Firebase Storage URL:", storageUrl);
    } catch (uploadError: any) {
      console.error("[saveStory Action] ERROR: Error uploading narration audio to Firebase Storage:", uploadError);
      // Attempt to parse Firebase Storage error if possible
      let detailedErrorMessage = `Failed to upload narration audio: ${uploadError.message || String(uploadError)}`;
      if (uploadError.errors && Array.isArray(uploadError.errors) && uploadError.errors.length > 0) {
        detailedErrorMessage += ` Details: ${uploadError.errors.map((e: any) => e.message || JSON.stringify(e)).join(', ')}`;
      } else if (uploadError.code) {
        detailedErrorMessage += ` (Code: ${uploadError.code})`;
      }
      console.error("[saveStory Action] Full Upload Error Object:", JSON.stringify(uploadError, null, 2));
      return { success: false, error: detailedErrorMessage };
    }
  } else {
    console.log("[saveStory Action] INFO: narrationAudioUrl is not a new data URI or is undefined. Skipping Firebase Storage upload for audio. Current URL:", processedStoryData.narrationAudioUrl);
  }


  const dataToSave: any = {
    ...processedStoryData,
    userId: userId, 
    updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
  };

  if (dataToSave.id) {
    delete dataToSave.id; 
  }

  if (dataToSave.createdAt && dataToSave.createdAt instanceof Date) {
    dataToSave.createdAt = firebaseAdmin.firestore.Timestamp.fromDate(dataToSave.createdAt);
  }
  
  if (dataToSave.detailsPrompts && Object.keys(dataToSave.detailsPrompts).length === 0) {
    delete dataToSave.detailsPrompts;
  } else if (dataToSave.detailsPrompts === undefined) {
    delete dataToSave.detailsPrompts;
  }

  if (dataToSave.imagePrompts === undefined) delete dataToSave.imagePrompts;
  else if (!Array.isArray(dataToSave.imagePrompts)) dataToSave.imagePrompts = []; 

  if (dataToSave.generatedImages === undefined) delete dataToSave.generatedImages;
  else if (!Array.isArray(dataToSave.generatedImages)) dataToSave.generatedImages = []; 

  if (dataToSave.elevenLabsVoiceId === undefined) {
    delete dataToSave.elevenLabsVoiceId;
  }


  Object.keys(dataToSave).forEach(key => {
    if (dataToSave[key] === undefined) {
      console.log(`[saveStory Action] DEBUG: Deleting undefined key: ${key} from dataToSave.`);
      delete dataToSave[key];
    }
  });
  
  console.log("[saveStory Action] INFO: Data prepared for Firestore:", JSON.stringify(dataToSave, null, 2));


  try {
    if (storyData.id) { 
      console.log(`[saveStory Action] INFO: Attempting to UPDATE document 'stories/${storyData.id}'`);
      const storyRef = dbAdmin.collection("stories").doc(storyData.id);
      
      const docSnap = await storyRef.get();
      if (!docSnap.exists) {
        console.error(`[saveStory Action] ERROR: Story with ID ${storyData.id} not found for update.`);
        return { success: false, error: "Story not found. Cannot update." };
      }
      const existingStoryData = docSnap.data();
      if (existingStoryData?.userId !== userId) {
        console.error(`[saveStory Action] ERROR: User ${userId} attempting to update story ${storyData.id} owned by ${existingStoryData?.userId}.`);
        return { success: false, error: "Unauthorized: You can only update your own stories." };
      }
      if ('createdAt' in dataToSave && existingStoryData?.createdAt) {
         delete dataToSave.createdAt; 
         console.log("[saveStory Action] DEBUG: Removed 'createdAt' from update payload as it already exists.");
      }


      await storyRef.update(dataToSave);
      console.log(`[saveStory Action] SUCCESS: Document 'stories/${storyData.id}' updated.`);
      revalidatePath('/dashboard');
      revalidatePath(`/create-story?storyId=${storyData.id}`);
      return { success: true, storyId: storyData.id, data: { narrationAudioUrl: newNarrationUrl || storyData.narrationAudioUrl } };
    } else {
      dataToSave.createdAt = firebaseAdmin.firestore.FieldValue.serverTimestamp(); 
      console.log("[saveStory Action] INFO: Attempting to ADD new document to 'stories' collection with ID:", storyIdForPath);
      const storyRef = dbAdmin.collection("stories").doc(storyIdForPath);
      await storyRef.set(dataToSave);
      console.log(`[saveStory Action] SUCCESS: Document added to 'stories' with ID: ${storyIdForPath}`);
      revalidatePath('/dashboard');
      return { success: true, storyId: storyIdForPath, data: { narrationAudioUrl: newNarrationUrl } };
    }
  } catch (error) {
    console.error("[saveStory Action] ERROR: Error during Firestore operation:", error);
    let errorMessage = "Failed to save story.";
    const firebaseError = error as FirebaseErrorWithCode;

    if (firebaseError && firebaseError.code) {
      errorMessage = `Failed to save story (Firestore Error): ${firebaseError.message} (Code: ${firebaseError.code})`;
      if (firebaseError.code === 'permission-denied' || (typeof firebaseError.code === 'number' && firebaseError.code === 7)) { 
        console.error("[saveStory Action] PERMISSION DENIED. This likely means the Admin SDK service account lacks Firestore write permissions for the target path, OR a Firestore rule is somehow still blocking (though Admin SDK usually bypasses rules). Check IAM for the service account and Firestore rules for 'stories' collection.");
      } else if (firebaseError.code === 'unauthenticated' || (typeof firebaseError.code === 'number' && firebaseError.code === 16)) { 
         console.error("[saveStory Action] UNAUTHENTICATED: This indicates an issue with Admin SDK authentication, possibly related to credentials or token.");
      }
    } else if (error instanceof Error) {
      errorMessage = `Failed to save story: ${error.message}`;
    }
    console.error("[saveStory Action] Full error object during Firestore operation:", JSON.stringify(error, null, 2));
    return { success: false, error: errorMessage };
  } finally {
     console.log('---------------------------------------------------------------------');
     console.log("[saveStory Action] Completed.");
     console.log('---------------------------------------------------------------------');
  }
}
export async function updateStoryTimeline(
  storyId: string,
  userId: string,
  timelineTracks: Story['timelineTracks']
): Promise<{ success: boolean; error?: string }> {
  console.log('---------------------------------------------------------------------');
  console.log("[updateStoryTimeline Action] Initiated. User ID:", userId, "Story ID:", storyId);

  if (!dbAdmin) {
    const errorMessage = "Server configuration error: Database connection (dbAdmin) is not available. Firebase Admin SDK might not be initialized. Check server logs for firebaseAdmin.ts output.";
    console.error("[updateStoryTimeline Action] CRITICAL ERROR:", errorMessage);
    return { success: false, error: errorMessage };
  }
  console.log("[updateStoryTimeline Action] INFO: dbAdmin is DEFINED.");

  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    console.error("[updateStoryTimeline Action] Error: Authenticated User ID is invalid or missing:", userId);
    return { success: false, error: "User not authenticated or user ID is invalid." };
  }

  if (!storyId) {
    console.error("[updateStoryTimeline Action] Error: Story ID is missing.");
    return { success: false, error: "Story ID is required to update the timeline." };
  }

  try {
    const storyRef = dbAdmin.collection("stories").doc(storyId);
    const docSnap = await storyRef.get();

    if (!docSnap.exists) {
      console.error(`[updateStoryTimeline Action] ERROR: Story with ID ${storyId} not found for update.`);
      return { success: false, error: "Story not found. Cannot update timeline." };
    }

    const existingStoryData = docSnap.data();
    if (existingStoryData?.userId !== userId) {
      console.error(`[updateStoryTimeline Action] ERROR: User ${userId} attempting to update timeline for story ${storyId} owned by ${existingStoryData?.userId}.`);
      return { success: false, error: "Unauthorized: You can only update the timeline of your own stories." };
    }

    const dataToUpdate = {
      timelineTracks: timelineTracks,
      updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
    };

    console.log(`[updateStoryTimeline Action] INFO: Attempting to UPDATE timeline for document 'stories/${storyId}'`);
    await storyRef.update(dataToUpdate);
    console.log(`[updateStoryTimeline Action] SUCCESS: Timeline for document 'stories/${storyId}' updated.`);

    // Revalidate the page where the timeline is displayed
    revalidatePath(`/assemble-video?storyId=${storyId}`);
    // Potentially revalidate other paths if the timeline affects them, e.g., a dashboard view
    revalidatePath('/dashboard');


    return { success: true };

  } catch (error) {
    console.error("[updateStoryTimeline Action] ERROR: Error during Firestore operation:", error);
    let errorMessage = "Failed to update story timeline.";
    const firebaseError = error as FirebaseErrorWithCode;

    if (firebaseError && firebaseError.code) {
      errorMessage = `Failed to update story timeline (Firestore Error): ${firebaseError.message} (Code: ${firebaseError.code})`;
      if (firebaseError.code === 'permission-denied' || (typeof firebaseError.code === 'number' && firebaseError.code === 7)) {
        console.error("[updateStoryTimeline Action] PERMISSION DENIED. Check IAM for the service account and Firestore rules.");
      }
    } else if (error instanceof Error) {
      errorMessage = `Failed to update story timeline: ${error.message}`;
    }
    console.error("[updateStoryTimeline Action] Full error object during Firestore operation:", JSON.stringify(error, null, 2));
    return { success: false, error: errorMessage };
  } finally {
    console.log('---------------------------------------------------------------------');
    console.log("[updateStoryTimeline Action] Completed.");
    console.log('---------------------------------------------------------------------');
  }
}
