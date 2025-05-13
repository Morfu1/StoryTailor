"use server";

import { generateScript as aiGenerateScript, type GenerateScriptInput } from '@/ai/flows/generate-script';
import { generateCharacterPrompts as aiGenerateCharacterPrompts, type GenerateCharacterPromptsInput } from '@/ai/flows/generate-character-prompts';
import { generateNarrationAudio as aiGenerateNarrationAudio, type GenerateNarrationAudioInput } from '@/ai/flows/generate-narration-audio';
import { generateImagePrompts as aiGenerateImagePrompts, type GenerateImagePromptsInput } from '@/ai/flows/generate-image-prompts';
import { generateTitle as aiGenerateTitle, type GenerateTitleInput } from '@/ai/flows/generate-title'; 

import type { Story } from '@/types/story';
import { db } from '@/lib/firebase'; 
import { collection, addDoc, updateDoc, doc, serverTimestamp, getDoc, type FirestoreError, Timestamp } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';


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

export async function saveStory(storyData: Story, authenticatedUserId: string): Promise<{ success: boolean; storyId?: string; error?: string }> {
  if (!authenticatedUserId || typeof authenticatedUserId !== 'string' || authenticatedUserId.trim() === '') {
    console.error("[saveStory Action] Error: Authenticated User ID is invalid or missing:", authenticatedUserId);
    return { success: false, error: "User not authenticated or user ID is invalid." };
  }

  try {
    // Construct the base payload, ensuring required fields and validated authenticatedUserId are used.
    // Optional fields from storyData are included if they exist.
    const payload: any = {
      userId: authenticatedUserId, // Always use the UID of the authenticated user making the request
      title: storyData.title || "Untitled Story",
      userPrompt: storyData.userPrompt || "",
      updatedAt: serverTimestamp() as Timestamp,
    };

    // Add optional fields from storyData if they are defined
    if (storyData.generatedScript !== undefined) payload.generatedScript = storyData.generatedScript;
    if (storyData.detailsPrompts !== undefined) payload.detailsPrompts = storyData.detailsPrompts;
    if (storyData.narrationAudioUrl !== undefined) payload.narrationAudioUrl = storyData.narrationAudioUrl;
    if (storyData.narrationAudioDurationSeconds !== undefined) payload.narrationAudioDurationSeconds = storyData.narrationAudioDurationSeconds;
    if (storyData.imagePrompts !== undefined) payload.imagePrompts = storyData.imagePrompts;
    if (storyData.generatedImages !== undefined) payload.generatedImages = storyData.generatedImages;
    // videoUrl is not used yet

    // Remove any remaining undefined properties to prevent Firestore errors
    Object.keys(payload).forEach(key => {
      if (payload[key] === undefined) {
        delete payload[key];
      }
    });
    
    if (storyData.id) {
      // Update existing story
      const storyRef = doc(db, "stories", storyData.id);
      
      // Preserve existing createdAt timestamp if it exists on the storyData passed from client
      // This ensures we don't accidentally remove it or try to set it to serverTimestamp() on update.
      if (storyData.createdAt) {
        payload.createdAt = storyData.createdAt instanceof Date ? Timestamp.fromDate(storyData.createdAt) : storyData.createdAt;
      } else {
        // If storyData from client doesn't have createdAt (e.g., it was never set or an old doc),
        // we don't add it to the update payload to avoid issues.
        // Firestore update will merge, so existing createdAt (if any on doc) remains.
      }

      await updateDoc(storyRef, payload);
      revalidatePath('/dashboard');
      revalidatePath(`/create-story?storyId=${storyData.id}`);
      return { success: true, storyId: storyData.id };
    } else {
      // Create new story
      payload.createdAt = serverTimestamp() as Timestamp; // Set createdAt for new stories
      const docRef = await addDoc(collection(db, "stories"), payload);
      revalidatePath('/dashboard');
      return { success: true, storyId: docRef.id };
    }
  } catch (error) {
    console.error("[saveStory Action] Error saving story to Firestore:", error);
    let errorMessage = "Failed to save story.";
    const firebaseError = error as FirestoreError;
    if (firebaseError && firebaseError.code) {
      errorMessage = `Failed to save story: ${firebaseError.message} (Code: ${firebaseError.code})`;
    } else if (error instanceof Error) {
      errorMessage = `Failed to save story: ${error.message}`;
    }
    return { success: false, error: errorMessage };
  }
}

export async function getStory(storyId: string, userId: string): Promise<{ success: boolean; data?: Story; error?: string }> {
   if (!userId) {
    return { success: false, error: "User not authenticated." };
  }
  try {
    const storyRef = doc(db, "stories", storyId);
    const docSnap = await getDoc(storyRef);

    if (docSnap.exists()) {
      const story = { id: docSnap.id, ...docSnap.data() } as Story;
      if (story.userId !== userId) {
        return { success: false, error: "Unauthorized access to story." };
      }
      if (story.createdAt && story.createdAt instanceof Timestamp) {
        story.createdAt = story.createdAt.toDate();
      }
      if (story.updatedAt && story.updatedAt instanceof Timestamp) {
        story.updatedAt = story.updatedAt.toDate();
      }
      return { success: true, data: story };
    } else {
      return { success: false, error: "Story not found." };
    }
  } catch (error) {
    console.error("Error fetching story from Firestore:", error);
    let errorMessage = "Failed to fetch story.";
    const firebaseError = error as FirestoreError;
    if (firebaseError && firebaseError.code) {
      errorMessage = `Failed to fetch story: ${firebaseError.message} (Code: ${firebaseError.code})`;
    } else if (error instanceof Error) {
      errorMessage = `Failed to fetch story: ${error.message}`;
    }
    return { success: false, error: errorMessage };
  }
}

export async function generateImageFromPrompt(prompt: string): Promise<{ success: boolean, imageUrl?: string, error?: string, dataAiHint?: string }> {
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  let keywords = "abstract"; 
  const mentionedItems = prompt.match(/@\w+/g); 
  if (mentionedItems && mentionedItems.length > 0) {
      keywords = mentionedItems.map(item => item.substring(1).toLowerCase()).slice(0,2).join(" ");
  } else {
      const words = prompt.toLowerCase().split(" ");
      const commonWords = ["a", "an", "the", "of", "in", "is", "and", "shot", "at", "with"];
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
