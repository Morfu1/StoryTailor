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
import { firebaseAdmin, dbAdmin } from '@/lib/firebaseAdmin';
import type { Story, ElevenLabsVoice } from '@/types/story';
import type { Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { getStorage as getAdminStorage } from 'firebase-admin/storage';
import { revalidatePath } from 'next/cache';

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

// Helper function to estimate duration from MP3 data URI
// This is a very rough estimation and might not be accurate.
// A proper solution would involve an audio library to parse MP3 metadata.
function getMp3DurationFromDataUri(dataUri: string): number {
  try {
    if (!dataUri.startsWith('data:audio/mpeg;base64,')) {
      console.warn('Cannot estimate duration: Not an MP3 data URI.');
      return 30; // Default duration
    }
    const base64Data = dataUri.substring('data:audio/mpeg;base64,'.length);
    const binaryData = Buffer.from(base64Data, 'base64');
    
    // Extremely rough estimate: 128 kbps CBR would be 16000 bytes per second.
    // This is highly inaccurate for VBR or different bitrates.
    const estimatedBitrateKbps = 128;
    const bytesPerSecond = (estimatedBitrateKbps * 1000) / 8;
    const durationSeconds = binaryData.length / bytesPerSecond;

    // If it's the placeholder silent audio, set duration to 1 sec to avoid issues.
    if (base64Data === 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAAA') { // This is a WAV placeholder, not MP3
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


export async function generateNarrationAudio(input: GenerateNarrationAudioInput): Promise<{ success: boolean; data?: { audioDataUri?: string; voices?: ElevenLabsVoice[]; duration?: number }; error?: string }> {
  try {
    const result: GenerateNarrationAudioOutput = await aiGenerateNarrationAudio(input);

    if (result.error) {
      return { success: false, error: result.error };
    }

    if (result.audioDataUri) {
      const duration = getMp3DurationFromDataUri(result.audioDataUri);
      return { success: true, data: { audioDataUri: result.audioDataUri, duration } };
    }
    
    if (result.voices) {
      return { success: true, data: { voices: result.voices as ElevenLabsVoice[] } };
    }
    
    // Should not happen if schema is correct and flow behaves
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

interface FirebaseErrorWithCode extends Error {
  code?: string;
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
    const storyRef = dbAdmin.collection("stories").doc(storyId);
    const docSnap = await storyRef.get();

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
      return { success: true, data: story };
    } else {
      return { success: false, error: "Story not found." };
    }
  } catch (error) {
    console.error("[getStory Action] Error fetching story from Firestore (Admin SDK):", error);
    let errorMessage = "Failed to fetch story.";
    const firebaseError = error as FirebaseErrorWithCode;
    if (firebaseError && firebaseError.code) {
      errorMessage = `Failed to fetch story (Admin SDK): ${firebaseError.message} (Code: ${firebaseError.code})`;
       if (firebaseError.code === 'permission-denied' || firebaseError.code === 7) {
        console.error("[getStory Action] PERMISSION DENIED while fetching. Check Firestore rules and IAM for service account.");
      }
    } else if (error instanceof Error) {
      errorMessage = `Failed to fetch story (Admin SDK): ${error.message}`;
    }
    return { success: false, error: errorMessage };
  }
}

export async function generateImageFromPrompt(prompt: string): Promise<{ success: boolean, imageUrl?: string, error?: string, dataAiHint?: string }> {
  // Placeholder - simulate AI image generation
  await new Promise(resolve => setTimeout(resolve, 1500)); 
  
  let keywords = "abstract"; 
  const mentionedItems = prompt.match(/@\w+/g); 
  if (mentionedItems && mentionedItems.length > 0) {
      keywords = mentionedItems.map(item => item.substring(1).toLowerCase()).slice(0,2).join(" ");
  } else {
      const words = prompt.toLowerCase().split(" ");
      const commonWords = ["a", "an", "the", "of", "in", "is", "and", "shot", "at", "with", "scene", "visualize", "generate"];
      const meaningfulWords = words.filter(w => !commonWords.includes(w) && w.length > 3);
      if (meaningfulWords.length > 0) {
          keywords = meaningfulWords.slice(0,2).join(" ");
      }
  }

  const width = 512;
  const height = 512;
  const imageUrl = `https://picsum.photos/${width}/${height}?random=${Math.random()}`;

  return { success: true, imageUrl, dataAiHint: keywords };
}


async function uploadAudioToFirebaseStorage(audioDataUri: string, userId: string, storyId: string): Promise<string> {
  console.log('[uploadAudioToFirebaseStorage] Initiating audio upload...');
  if (!firebaseAdmin.apps.length || !firebaseAdmin.app()) {
    console.error("[uploadAudioToFirebaseStorage] CRITICAL: Firebase Admin SDK app is not initialized. Cannot perform storage operations.");
    throw new Error("Firebase Admin SDK app is not initialized for storage operations.");
  }
  const adminAppInstance = firebaseAdmin.app();
  const storage = getAdminStorage(adminAppInstance);

  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (!bucketName || bucketName.trim() === "") {
    console.error("[uploadAudioToFirebaseStorage] CRITICAL: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET environment variable is not set or is empty. Cannot determine storage bucket.");
    throw new Error("Firebase Storage bucket name is not configured. Please set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET in your .env.local file.");
  }
  console.log(`[uploadAudioToFirebaseStorage] INFO: Attempting to use Firebase Storage bucket: '${bucketName}'`);

  const bucket = storage.bucket(bucketName);

  if (!audioDataUri.startsWith('data:audio/mpeg;base64,')) {
    console.error('[uploadAudioToFirebaseStorage] ERROR: Invalid audio data URI format.');
    throw new Error('Invalid audio data URI format. Expected data:audio/mpeg;base64,...');
  }

  const base64Data = audioDataUri.substring('data:audio/mpeg;base64,'.length);
  const audioBuffer = Buffer.from(base64Data, 'base64');
  
  const filePath = `users/${userId}/stories/${storyId}/narration.mp3`;
  const file = bucket.file(filePath);

  console.log(`[uploadAudioToFirebaseStorage] INFO: Uploading audio buffer (${audioBuffer.length} bytes) to gs://${bucketName}/${filePath}`);

  await file.save(audioBuffer, {
    metadata: {
      contentType: 'audio/mpeg',
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
      const storageUrl = await uploadAudioToFirebaseStorage(processedStoryData.narrationAudioUrl, userId, storyIdForPath);
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
      if (firebaseError.code === 'permission-denied' || firebaseError.code === 7) { 
        console.error("[saveStory Action] PERMISSION DENIED. This likely means the Admin SDK service account lacks Firestore write permissions for the target path, OR a Firestore rule is somehow still blocking (though Admin SDK usually bypasses rules). Check IAM for the service account and Firestore rules for 'stories' collection.");
      } else if (firebaseError.code === 'unauthenticated' || firebaseError.code === 16) { 
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
