
"use server";

import type { GenerateCharacterPromptsInput } from '@/ai/flows/generate-character-prompts';
import { generateCharacterPrompts as aiGenerateCharacterPrompts } from '@/ai/flows/generate-character-prompts';
import type { GenerateImagePromptsInput } from '@/ai/flows/generate-image-prompts';
import { generateImagePrompts as aiGenerateImagePrompts } from '@/ai/flows/generate-image-prompts';
import type { GenerateNarrationAudioInput } from '@/ai/flows/generate-narration-audio';
import { generateNarrationAudio as aiGenerateNarrationAudio } from '@/ai/flows/generate-narration-audio';
import type { GenerateScriptInput } from '@/ai/flows/generate-script';
import { generateScript as aiGenerateScript } from '@/ai/flows/generate-script';
import type { GenerateTitleInput } from '@/ai/flows/generate-title';
import { generateTitle as aiGenerateTitle } from '@/ai/flows/generate-title';
import { firebaseAdmin, dbAdmin } from '@/lib/firebaseAdmin';
import type { Story } from '@/types/story';
import type { Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
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

export async function generateNarrationAudio(input: GenerateNarrationAudioInput) {
  try {
    const result = await aiGenerateNarrationAudio(input);
    let duration = 30; 
    if (result.audioDataUri === 'data:audio/mp3;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAAA') {
      duration = 5; 
    }
    return { success: true, data: { ...result, duration } };
  } catch (error) {
    console.error("Error in generateNarrationAudio AI flow:", error);
    return { success: false, error: "Failed to generate narration audio." };
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

// BASIC TEST SAVE FUNCTION - MINIMALIST APPROACH TO TEST ADMIN SDK CONNECTION
// This function is now commented out to use the original saveStory.
/*
export async function saveStory(storyData: Story, authenticatedUserId: string): Promise<{ success: boolean; storyId?: string; error?: string }> {
  console.log('---------------------------------------------------------------------');
  console.log("[saveStory Action - BASIC TEST] Initiated.");
  console.log("[saveStory Action - BASIC TEST] Authenticated User ID:", authenticatedUserId);
  console.log("[saveStory Action - BASIC TEST] Received Story Title:", storyData.title);
  console.log('---------------------------------------------------------------------');
  
  if (!dbAdmin) {
    const errorMessage = "Server configuration error: Database connection (dbAdmin) is not available. Firebase Admin SDK might not be initialized. Check server logs for firebaseAdmin.ts output.";
    console.error("[saveStory Action - BASIC TEST] CRITICAL ERROR:", errorMessage);
    console.error("[saveStory Action - BASIC TEST] This usually means GOOGLE_APPLICATION_CREDENTIALS is not set correctly, the service account key is invalid/inaccessible, or the Admin SDK failed to initialize for other reasons detailed in firebaseAdmin.ts logs.");
    return { success: false, error: errorMessage };
  }
  console.log("[saveStory Action - BASIC TEST] INFO: `dbAdmin` IS defined. Proceeding with Firestore operation.");

  if (!authenticatedUserId || typeof authenticatedUserId !== 'string' || authenticatedUserId.trim() === '') {
    console.error("[saveStory Action - BASIC TEST] Error: Authenticated User ID is invalid or missing:", authenticatedUserId);
    return { success: false, error: "User not authenticated or user ID is invalid." };
  }

  // For this basic test, we will only save a minimal document.
  const testPayload: any = {
    userId: authenticatedUserId,
    title: storyData.title || `Test Story ${new Date().toISOString()}`,
    userPrompt: storyData.userPrompt || "Test prompt",
    createdAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
    _testMarker: "BASIC_SAVE_TEST_DOCUMENT_V2"
  };

  try {
    console.log("[saveStory Action - BASIC TEST] Attempting to ADD new document to 'stories' collection with payload:", JSON.stringify(testPayload, null, 2));
    const docRef = await dbAdmin.collection("stories").add(testPayload);
    console.log(`[saveStory Action - BASIC TEST] SUCCESS: Document written to 'stories' collection with ID: ${docRef.id}`);
    revalidatePath('/dashboard');
    return { success: true, storyId: docRef.id };

  } catch (error) {
    console.error("[saveStory Action - BASIC TEST] Error during Firestore .add() operation:", error);
    let errorMessage = "Failed to save test story.";
    const firebaseError = error as FirebaseErrorWithCode;

    if (firebaseError && firebaseError.code) {
      errorMessage = `Failed to save test story (Firestore Error): ${firebaseError.message} (Code: ${firebaseError.code})`;
      if (firebaseError.code === 'permission-denied' || firebaseError.code === 7) {
        console.error("[saveStory Action - BASIC TEST] PERMISSION DENIED: This means the Admin SDK connected to Firestore, but the authenticated service account does not have permission to write to the 'stories' collection. Check Firestore Security Rules (ensure they are temporarily open for this test as instructed) AND IAM permissions for the service account in GCP console.");
      } else if (firebaseError.code === 'unauthenticated' || firebaseError.code === 16) {
         console.error("[saveStory Action - BASIC TEST] UNAUTHENTICATED: This indicates an issue with Admin SDK authentication, possibly related to credentials.");
      }
    } else if (error instanceof Error) {
      errorMessage = `Failed to save test story: ${error.message}`;
    }
    console.error("[saveStory Action - BASIC TEST] Full error object:", JSON.stringify(error, null, 2));
    return { success: false, error: errorMessage };
  } finally {
    console.log('---------------------------------------------------------------------');
    console.log("[saveStory Action - BASIC TEST] Completed.");
    console.log('---------------------------------------------------------------------');
  }
}
*/

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
      
      // Basic check against tampering or rule bypass, though Admin SDK typically bypasses rules.
      // If story.userId is not what's expected, log a warning.
      // For a test document, this check might be relaxed or specific.
      if (story.userId !== userId && storyData?.['_testMarker'] !== "BASIC_SAVE_TEST_DOCUMENT_V2") { 
        console.warn(`[getStory Action] User ${userId} fetched story ${storyId} belonging to ${story.userId}. This is expected if rules permit or for admin access.`);
      }

      // Convert Firestore Timestamps to JS Date objects if they exist
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


// Original saveStory function restored
export async function saveStory(storyData: Story, userId: string): Promise<{ success: boolean; storyId?: string; error?: string }> {
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

  // Prepare data, ensuring userId is always from the authenticated context
  // And timestamps are handled correctly
  const dataToSave: any = {
    ...storyData,
    userId: userId, // Crucial: Always use the authenticated userId
    updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
  };

  // Remove id from data if it's there, as it's the document key
  if (dataToSave.id) {
    delete dataToSave.id; 
  }

  // Convert Date objects from client to Firestore Timestamps if they exist
  // For new documents, createdAt will be set by FieldValue.serverTimestamp()
  // For updates, if createdAt was passed as Date, convert it. Otherwise, it remains as Firestore Timestamp
  if (dataToSave.createdAt && dataToSave.createdAt instanceof Date) {
    dataToSave.createdAt = firebaseAdmin.firestore.Timestamp.fromDate(dataToSave.createdAt);
  }
  // updatedAt is always set to serverTimestamp
  
  // Ensure detailsPrompts are stored correctly (object or delete if empty/undefined)
  if (dataToSave.detailsPrompts && Object.keys(dataToSave.detailsPrompts).length === 0) {
    delete dataToSave.detailsPrompts;
  } else if (dataToSave.detailsPrompts === undefined) {
    delete dataToSave.detailsPrompts;
  }

  // Ensure imagePrompts and generatedImages are arrays or delete if undefined
  if (dataToSave.imagePrompts === undefined) delete dataToSave.imagePrompts;
  else if (!Array.isArray(dataToSave.imagePrompts)) dataToSave.imagePrompts = []; // Ensure it's an array

  if (dataToSave.generatedImages === undefined) delete dataToSave.generatedImages;
  else if (!Array.isArray(dataToSave.generatedImages)) dataToSave.generatedImages = []; // Ensure it's an array


  Object.keys(dataToSave).forEach(key => {
    if (dataToSave[key] === undefined) {
      console.log(`[saveStory Action] Deleting undefined key: ${key}`);
      delete dataToSave[key];
    }
  });
  
  console.log("[saveStory Action] Data prepared for Firestore:", JSON.stringify(dataToSave, null, 2));


  try {
    if (storyData.id) {
      // Update existing story
      console.log(`[saveStory Action] Attempting to UPDATE document 'stories/${storyData.id}'`);
      const storyRef = dbAdmin.collection("stories").doc(storyData.id);
      
      // Fetch the document first to check ownership - crucial for security with Admin SDK
      const docSnap = await storyRef.get();
      if (!docSnap.exists) {
        console.error(`[saveStory Action] Error: Story with ID ${storyData.id} not found for update.`);
        return { success: false, error: "Story not found. Cannot update." };
      }
      const existingStoryData = docSnap.data();
      if (existingStoryData?.userId !== userId) {
        console.error(`[saveStory Action] Error: User ${userId} attempting to update story ${storyData.id} owned by ${existingStoryData?.userId}.`);
        return { success: false, error: "Unauthorized: You can only update your own stories." };
      }
      // Do not update createdAt on existing documents unless specifically intended
      if ('createdAt' in dataToSave && existingStoryData?.createdAt) {
         delete dataToSave.createdAt; 
      }


      await storyRef.update(dataToSave);
      console.log(`[saveStory Action] SUCCESS: Document 'stories/${storyData.id}' updated.`);
      revalidatePath('/dashboard');
      revalidatePath(`/create-story?storyId=${storyData.id}`);
      return { success: true, storyId: storyData.id };
    } else {
      // Create new story
      dataToSave.createdAt = firebaseAdmin.firestore.FieldValue.serverTimestamp(); // Set createdAt for new stories
      console.log("[saveStory Action] Attempting to ADD new document to 'stories' collection");
      const docRef = await dbAdmin.collection("stories").add(dataToSave);
      console.log(`[saveStory Action] SUCCESS: Document added to 'stories' with ID: ${docRef.id}`);
      revalidatePath('/dashboard');
      return { success: true, storyId: docRef.id };
    }
  } catch (error) {
    console.error("[saveStory Action] Error during Firestore operation:", error);
    let errorMessage = "Failed to save story.";
    const firebaseError = error as FirebaseErrorWithCode;

    if (firebaseError && firebaseError.code) {
      errorMessage = `Failed to save story (Firestore Error): ${firebaseError.message} (Code: ${firebaseError.code})`;
      if (firebaseError.code === 'permission-denied' || firebaseError.code === 7) { // Code 7 is PERMISSION_DENIED
        console.error("[saveStory Action] PERMISSION DENIED. This likely means the Admin SDK service account lacks Firestore write permissions for the target path, OR a Firestore rule is somehow still blocking (though Admin SDK usually bypasses rules). Check IAM for the service account and Firestore rules for 'stories' collection.");
      } else if (firebaseError.code === 'unauthenticated' || firebaseError.code === 16) { // Code 16 is UNAUTHENTICATED
         console.error("[saveStory Action] UNAUTHENTICATED: This indicates an issue with Admin SDK authentication, possibly related to credentials or token.");
      }
    } else if (error instanceof Error) {
      errorMessage = `Failed to save story: ${error.message}`;
    }
    console.error("[saveStory Action] Full error object:", JSON.stringify(error, null, 2));
    return { success: false, error: errorMessage };
  } finally {
     console.log('---------------------------------------------------------------------');
     console.log("[saveStory Action] Completed.");
     console.log('---------------------------------------------------------------------');
  }
}

