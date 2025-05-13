
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
if (typeof dbAdmin === 'undefined') {
  console.error("[storyActions Module Load] CRITICAL: dbAdmin from @/lib/firebaseAdmin is UNDEFINED. All Firestore admin operations will fail with 'Database connection not available'. Check firebaseAdmin.ts logs for errors, especially GOOGLE_APPLICATION_CREDENTIALS configuration.");
} else {
  console.log("[storyActions Module Load] dbAdmin from @/lib/firebaseAdmin is (at least initially) DEFINED. Firestore admin operations should be possible.");
}


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
  } catch (error) {
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

export async function saveStory(storyData: Story, authenticatedUserId: string): Promise<{ success: boolean; storyId?: string; error?: string }> {
  console.log("[saveStory Action] Initiated. Authenticated User ID:", authenticatedUserId);
  
  if (!dbAdmin) {
    console.error("[saveStory Action] Firebase Admin SDK (dbAdmin) is not initialized. Cannot save story. This usually means GOOGLE_APPLICATION_CREDENTIALS is not set correctly or the service account key is invalid/inaccessible by the server. Check server logs for firebaseAdmin.ts output.");
    return { success: false, error: "Server configuration error: Database connection not available. Please contact support or check server logs." };
  }
  if (!authenticatedUserId || typeof authenticatedUserId !== 'string' || authenticatedUserId.trim() === '') {
    console.error("[saveStory Action] Error: Authenticated User ID is invalid or missing:", authenticatedUserId);
    return { success: false, error: "User not authenticated or user ID is invalid." };
  }

  console.log("[saveStory Action] Received storyData.id for save/update:", storyData.id); 

  try {
    const payload: any = {
      ...storyData, 
      userId: authenticatedUserId, 
      title: storyData.title || "Untitled Story",
      userPrompt: storyData.userPrompt || "",
      updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp() as AdminTimestamp, 
    };

    delete payload.id; 

    if (storyData.id) { 
      if (storyData.createdAt) {
        payload.createdAt = storyData.createdAt instanceof Date 
          ? firebaseAdmin.firestore.Timestamp.fromDate(storyData.createdAt) as AdminTimestamp
          : storyData.createdAt as AdminTimestamp;
      } else {
        console.warn(`[saveStory Action] Existing story ${storyData.id} is missing createdAt. Setting it now.`);
        payload.createdAt = firebaseAdmin.firestore.FieldValue.serverTimestamp() as AdminTimestamp;
      }
    } else { 
      payload.createdAt = firebaseAdmin.firestore.FieldValue.serverTimestamp() as AdminTimestamp;
    }
    
    Object.keys(payload).forEach(key => {
      if (payload[key] === undefined) {
        delete payload[key]; 
      }
    });
    
    console.log("[saveStory Action] Final payload to Firestore:", JSON.stringify(payload, null, 2));
    
    if (storyData.id) {
      console.log(`[saveStory Action] Attempting to UPDATE story with ID: ${storyData.id} in collection "stories"`);
      const storyRef = dbAdmin.collection("stories").doc(storyData.id);
      await storyRef.update(payload);
      console.log(`[saveStory Action] Successfully UPDATED story ${storyData.id}`);
      revalidatePath('/dashboard');
      revalidatePath(`/create-story?storyId=${storyData.id}`);
      return { success: true, storyId: storyData.id };
    } else {
      console.log(`[saveStory Action] Attempting to CREATE new story in collection "stories"`);
      const docRef = await dbAdmin.collection("stories").add(payload);
      console.log(`[saveStory Action] Successfully CREATED new story with ID: ${docRef.id}`);
      revalidatePath('/dashboard');
      return { success: true, storyId: docRef.id };
    }
  } catch (error) {
    console.error("[saveStory Action] Error saving story to Firestore (Admin SDK):", error);
    let errorMessage = "Failed to save story.";
    const firebaseError = error as FirebaseErrorWithCode;
    if (firebaseError && firebaseError.code) {
      errorMessage = `Failed to save story (Admin SDK error): ${firebaseError.message} (Code: ${firebaseError.code})`;
    } else if (error instanceof Error) {
      errorMessage = `Failed to save story (Admin SDK error): ${error.message}`;
    }
    console.error("[saveStory Action] Full error object:", JSON.stringify(error, null, 2));
    return { success: false, error: errorMessage };
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
      
      if (story.userId !== userId) {
        console.warn(`[getStory Action] Unauthorized attempt to access story ${storyId} by user ${userId}. Story belongs to ${story.userId}`);
        return { success: false, error: "Unauthorized access to story." };
      }

      // Convert Admin Timestamps to Date objects for client-side use
      if (story.createdAt && story.createdAt instanceof firebaseAdmin.firestore.Timestamp) {
        story.createdAt = (story.createdAt as AdminTimestamp).toDate();
      }
      if (story.updatedAt && story.updatedAt instanceof firebaseAdmin.firestore.Timestamp) {
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
