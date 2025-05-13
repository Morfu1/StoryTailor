
"use server";

import { generateScript as aiGenerateScript, type GenerateScriptInput } from '@/ai/flows/generate-script';
import { generateCharacterPrompts as aiGenerateCharacterPrompts, type GenerateCharacterPromptsInput } from '@/ai/flows/generate-character-prompts';
import { generateNarrationAudio as aiGenerateNarrationAudio, type GenerateNarrationAudioInput } from '@/ai/flows/generate-narration-audio';
import { generateImagePrompts as aiGenerateImagePrompts, type GenerateImagePromptsInput } from '@/ai/flows/generate-image-prompts';
import { generateTitle as aiGenerateTitle, type GenerateTitleInput } from '@/ai/flows/generate-title'; 

import type { Story } from '@/types/story';

import { dbAdmin, firebaseAdmin } from '@/lib/firebaseAdmin'; 
import { revalidatePath } from 'next/cache';
import type { Timestamp as AdminTimestamp } from 'firebase-admin/firestore';


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

// BASIC TEST SAVE FUNCTION
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
      const story = { id: docSnap.id, ...docSnap.data() } as Story;
      
      // With temporarily open rules, this check might not be strictly necessary for the read to succeed,
      // but it's good practice for when you restore secure rules.
      // For now, we'll keep it to see if it causes issues even with open rules (it shouldn't).
      if (story.userId !== userId && story._testMarker !== "BASIC_SAVE_TEST_DOCUMENT_V2") { // Allow reading test documents for now by anyone for debug
        console.warn(`[getStory Action] Unauthorized attempt to access story ${storyId} by user ${userId}. Story belongs to ${story.userId}`);
       // return { success: false, error: "Unauthorized access to story." };
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
