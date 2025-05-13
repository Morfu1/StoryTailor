"use server";

import { generateScript as aiGenerateScript, type GenerateScriptInput } from '@/ai/flows/generate-script';
import { generateCharacterPrompts as aiGenerateCharacterPrompts, type GenerateCharacterPromptsInput } from '@/ai/flows/generate-character-prompts';
import { generateNarrationAudio as aiGenerateNarrationAudio, type GenerateNarrationAudioInput } from '@/ai/flows/generate-narration-audio';
import { generateImagePrompts as aiGenerateImagePrompts, type GenerateImagePromptsInput } from '@/ai/flows/generate-image-prompts';

import type { Story } from '@/types/story';
import { db } from '@/lib/firebase'; 
import { collection, addDoc, updateDoc, doc, serverTimestamp, getDoc, type FirestoreError } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';


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

export async function saveStory(storyData: Story, userId: string): Promise<{ success: boolean; storyId?: string; error?: string }> {
  if (!userId) {
    return { success: false, error: "User not authenticated." };
  }

  try {
    // Prepare data by removing id for create, and ensuring only valid fields are passed
    const dataToSave: any = { ...storyData };
    if (!storyData.id) { // For new story
      delete dataToSave.id; // addDoc generates ID, so remove if present
      dataToSave.createdAt = serverTimestamp();
    }
    dataToSave.userId = userId; // Ensure userId is correctly set from the authenticated user
    dataToSave.updatedAt = serverTimestamp();

    // Firestore does not allow undefined values. Filter them out.
    for (const key in dataToSave) {
        if (dataToSave[key] === undefined) {
            delete dataToSave[key];
        }
    }


    if (storyData.id) {
      // Update existing story
      const storyRef = doc(db, "stories", storyData.id);
      await updateDoc(storyRef, dataToSave);
      revalidatePath('/dashboard');
      revalidatePath(`/create-story?storyId=${storyData.id}`);
      return { success: true, storyId: storyData.id };
    } else {
      // Create new story
      const docRef = await addDoc(collection(db, "stories"), dataToSave);
      revalidatePath('/dashboard');
      return { success: true, storyId: docRef.id };
    }
  } catch (error) {
    console.error("Error saving story to Firestore:", error);
    let errorMessage = "Failed to save story.";
    // Try to get more specific error message from FirebaseError
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
        // This is an application-level check. Firestore rules should primarily enforce this.
        return { success: false, error: "Unauthorized access to story." };
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
