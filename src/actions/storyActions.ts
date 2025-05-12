"use server";

import { generateScript as aiGenerateScript, type GenerateScriptInput } from '@/ai/flows/generate-script';
import { generateCharacterPrompts as aiGenerateCharacterPrompts, type GenerateCharacterPromptsInput } from '@/ai/flows/generate-character-prompts';
import { generateNarrationAudio as aiGenerateNarrationAudio, type GenerateNarrationAudioInput } from '@/ai/flows/generate-narration-audio';
import { generateImagePrompts as aiGenerateImagePrompts, type GenerateImagePromptsInput } from '@/ai/flows/generate-image-prompts';

import type { Story } from '@/types/story';
import { db, auth } from '@/lib/firebase'; // Assuming auth can be used server-side if needed or user ID is passed
import { collection, addDoc, updateDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';


// Helper to get current user ID (example, adjust based on your auth setup for server actions)
async function getCurrentUserId(): Promise<string | null> {
  // This is tricky for server actions without session cookies.
  // For now, assume userId is passed in or handle auth state appropriately.
  // If using Firebase Admin SDK on a backend, you could verify ID tokens.
  // For client-driven server actions, the client should provide the user ID.
  // For this example, we'll assume userId is passed to functions that need it.
  // For Firebase client SDK, auth.currentUser is only available client-side.
  return null; // Placeholder
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
    // The placeholder audio is very short. Actual duration would come from a real audio file.
    // For now, let's set a mock duration if we get the placeholder.
    let duration = 30; // Default mock duration
    if (result.audioDataUri === 'data:audio/mp3;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAAA') {
      duration = 5; // Mock duration for placeholder
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
    if (storyData.id) {
      // Update existing story
      const storyRef = doc(db, "stories", storyData.id);
      await updateDoc(storyRef, {
        ...storyData,
        userId, // Ensure userId is correctly set
        updatedAt: serverTimestamp(),
      });
      revalidatePath('/dashboard');
      revalidatePath(`/create-story?storyId=${storyData.id}`);
      return { success: true, storyId: storyData.id };
    } else {
      // Create new story
      const docRef = await addDoc(collection(db, "stories"), {
        ...storyData,
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      revalidatePath('/dashboard');
      return { success: true, storyId: docRef.id };
    }
  } catch (error) {
    console.error("Error saving story to Firestore:", error);
    return { success: false, error: "Failed to save story." };
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
      // Convert Firestore Timestamps to Date objects for client-side usage if necessary
      // This often happens automatically with Firestore SDK or needs manual conversion depending on setup
      // For server actions returning to client, it's safer to ensure serializable data.
      // However, for this structure, client components will handle date display.
      return { success: true, data: story };
    } else {
      return { success: false, error: "Story not found." };
    }
  } catch (error) {
    console.error("Error fetching story from Firestore:", error);
    return { success: false, error: "Failed to fetch story." };
  }
}

// Placeholder for image generation - in a real app, this would call a text-to-image model
export async function generateImageFromPrompt(prompt: string): Promise<{ success: boolean, imageUrl?: string, error?: string, dataAiHint?: string }> {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Extract keywords from prompt for picsum.photos. Simple extraction logic.
  // Example: "Wide front shot of @Rusty standing proudly in a sunlit clearing of the @Forest"
  // -> keywords: "fox forest"
  let keywords = "abstract"; // Default
  const mentionedItems = prompt.match(/@\w+/g); // E.g. ["@Rusty", "@Forest"]
  if (mentionedItems && mentionedItems.length > 0) {
      keywords = mentionedItems.map(item => item.substring(1).toLowerCase()).slice(0,2).join(" ");
  } else {
      // Fallback: try to get first few nouns
      const words = prompt.toLowerCase().split(" ");
      const commonWords = ["a", "an", "the", "of", "in", "is", "and", "shot", "at", "with"];
      const meaningfulWords = words.filter(w => !commonWords.includes(w) && w.length > 3);
      if (meaningfulWords.length > 0) {
          keywords = meaningfulWords.slice(0,2).join(" ");
      }
  }


  // For now, return a placeholder image from picsum.photos
  const width = 512;
  const height = 512;
  // const imageUrl = `https://picsum.photos/seed/${encodeURIComponent(prompt.slice(0,10))}/${width}/${height}`;
  // The above seed doesn't work well with keywords for picsum. Picsum doesn't have keyword search.
  // Using the hint for future replacement. For now, a random image.
  const imageUrl = `https://picsum.photos/${width}/${height}?random=${Math.random()}`;


  return { success: true, imageUrl, dataAiHint: keywords };
}
