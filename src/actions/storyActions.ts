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
      if (firebaseError.code === 'permission-denied' || (typeof firebaseError.code === 'number' && firebaseError.code === 7)) {
        console.error("[getStory Action] PERMISSION DENIED while fetching. Check Firestore rules and IAM for service account.");
      }
    } else if (error instanceof Error) {
      errorMessage = `Failed to fetch story (Admin SDK): ${error.message}`;
    }
    return { success: false, error: errorMessage };
  }
}

export async function generateImageFromPrompt(
  originalPrompt: string
): Promise<{ success: boolean; imageUrl?: string; error?: string; requestPrompt?: string }> {
  const apiKey = process.env.PICSART_API_KEY;

  if (!apiKey) {
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
        "x-picsart-api-key": apiKey,
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
      return await pollForPicsArtImage(result.inference_id, apiKey!, requestPrompt); // apiKey is checked for null/undefined at the start
    } else if (response.ok && result.data && Array.isArray(result.data) && result.data.length > 0 && result.data[0].url) {
      // This handles a less likely case where the API might return image data directly on a successful POST (e.g. status 200).
      // The primary documentation for text2image suggests a 202 response.
      console.log("PicsArt API returned image data directly on POST:", result.data[0].url);
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
