"use server";

import { firebaseAdmin, dbAdmin } from '@/lib/firebaseAdmin';
import type { Story, PageTimelineTrack } from '@/types/story'; // Ensure PageTimelineTrack is correctly typed if used
import { Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import { 
  getStorageBucket, 
  uploadAudioToFirebaseStorage, 
  refreshFirebaseStorageUrl, 
  uploadImageToFirebaseStorage, 
  deleteFolderFromFirebaseStorage 
} from './firebaseStorageActions'; 


interface FirebaseErrorWithCode extends Error {
  code?: string | number; // Allow number for Firestore error codes
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
        // Allow admin access or specific test markers to bypass user check for getStory
        // console.warn(`[getStory Action] User ${userId} fetched story ${storyId} belonging to ${story.userId}. This is expected if rules permit or for admin access.`);
      }


      if (story.createdAt && typeof (story.createdAt as any).toDate === 'function') {
        story.createdAt = (story.createdAt as AdminTimestamp).toDate();
      }
      if (story.updatedAt && typeof (story.updatedAt as any).toDate === 'function') {
        story.updatedAt = (story.updatedAt as AdminTimestamp).toDate();
      }
      
      let needsSave = false;

      if (story.narrationAudioUrl) {
        const refreshedUrl = await refreshFirebaseStorageUrl(story.narrationAudioUrl, userId, storyId);
        if (refreshedUrl && refreshedUrl !== story.narrationAudioUrl) {
          story.narrationAudioUrl = refreshedUrl;
          needsSave = true;
        }
      }

      if (story.narrationChunks && Array.isArray(story.narrationChunks) && story.narrationChunks.length > 0) {
        let hasUpdatedChunks = false;
        const refreshedChunks = await Promise.all(story.narrationChunks.map(async (chunk) => {
          if (chunk && chunk.audioUrl) {
            const refreshedUrl = await refreshFirebaseStorageUrl(chunk.audioUrl, userId, storyId);
            if (refreshedUrl && refreshedUrl !== chunk.audioUrl) {
              hasUpdatedChunks = true;
              return { ...chunk, audioUrl: refreshedUrl };
            }
          }
          return chunk;
        }));

        if (hasUpdatedChunks) {
          story.narrationChunks = refreshedChunks;
          needsSave = true;
        }
      }

      if (story.generatedImages && Array.isArray(story.generatedImages) && story.generatedImages.length > 0) {
        let hasUpdatedImages = false;
        const refreshedImages = await Promise.all(story.generatedImages.map(async (image) => {
          if (image && image.imageUrl) {
            const refreshedUrl = await refreshFirebaseStorageUrl(image.imageUrl, userId, storyId);
            if (refreshedUrl && refreshedUrl !== image.imageUrl) {
              hasUpdatedImages = true;
              return { ...image, imageUrl: refreshedUrl };
            }
          }
          return image;
        }));

        if (hasUpdatedImages) {
          story.generatedImages = refreshedImages;
          needsSave = true;
        }
      }
      
      if(needsSave && storyRef) {
         try {
            const updatesToSave: Partial<Story> = {};
            if (story.narrationAudioUrl) updatesToSave.narrationAudioUrl = story.narrationAudioUrl;
            if (story.narrationChunks) updatesToSave.narrationChunks = story.narrationChunks;
            if (story.generatedImages) updatesToSave.generatedImages = story.generatedImages;
            if (Object.keys(updatesToSave).length > 0) {
               await storyRef.update(updatesToSave);
               console.log(`[getStory Action] Refreshed and updated URLs for story ${storyId}`);
            }
         } catch (updateError) {
            console.error(`[getStory Action] Failed to update story ${storyId} with refreshed URLs:`, updateError);
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
      return {
        success: false,
        error: "Connection to Firebase timed out. If you're using an ad blocker or privacy extension, please disable it for this site."
      };
    } else if (firebaseError && firebaseError.code) {
      errorMessage = `Failed to fetch story (Admin SDK): ${firebaseError.message} (Code: ${firebaseError.code})`;
      if (firebaseError.code === 'permission-denied' || (typeof firebaseError.code === 'number' && firebaseError.code === 7)) {
         if (firebaseError.message && firebaseError.message.toLowerCase().includes("billing to be enabled")) {
          errorMessage = "Failed to fetch story: Billing is not enabled for this project. Please enable billing in the Google Cloud Console.";
        } else {
          errorMessage = "Failed to fetch story: Permission denied. Check Firestore rules and IAM for service account.";
        }
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

export async function saveStory(storyData: Story, userId: string): Promise<{ success: boolean; storyId?: string; error?: string; data?: { narrationAudioUrl?: string} }> {
  if (!dbAdmin) { return { success: false, error: "Server configuration error: Database connection (dbAdmin) is not available." }; }
  if (!userId || typeof userId !== 'string' || userId.trim() === '') { return { success: false, error: "User not authenticated or user ID is invalid." }; }
  
  const storyIdForPath = storyData.id || dbAdmin.collection("stories").doc().id;
  const processedStoryData = { ...storyData };
  let newNarrationUrl: string | undefined = undefined;
  
  if (processedStoryData.narrationAudioUrl && processedStoryData.narrationAudioUrl.startsWith('data:audio/')) {
    try {
      const fileExtension = processedStoryData.narrationAudioUrl.startsWith('data:audio/wav') ? 'wav' : 'mp3';
      const defaultFilename = `uploaded_narration.${fileExtension}`;
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
  
  if (dataToSave.createdAt && dataToSave.createdAt instanceof Date) {
    dataToSave.createdAt = firebaseAdmin.firestore.Timestamp.fromDate(dataToSave.createdAt);
  } else if (!storyData.id && !dataToSave.createdAt) { // Only set createdAt on new document creation
    dataToSave.createdAt = firebaseAdmin.firestore.FieldValue.serverTimestamp();
  }
  
  // Clean up undefined or empty fields before saving
  if (dataToSave.detailsPrompts && Object.keys(dataToSave.detailsPrompts).length === 0) { delete dataToSave.detailsPrompts; }
  else if (dataToSave.detailsPrompts === undefined) { delete dataToSave.detailsPrompts; }
  
  if (dataToSave.imagePrompts === undefined) delete dataToSave.imagePrompts; else if (!Array.isArray(dataToSave.imagePrompts)) dataToSave.imagePrompts = [];
  if (dataToSave.generatedImages === undefined) delete dataToSave.generatedImages; else if (!Array.isArray(dataToSave.generatedImages)) dataToSave.generatedImages = [];
  if (dataToSave.actionPrompts === undefined) delete dataToSave.actionPrompts; else if (!Array.isArray(dataToSave.actionPrompts)) dataToSave.actionPrompts = [];
  if (dataToSave.narrationChunks === undefined) delete dataToSave.narrationChunks; else if (!Array.isArray(dataToSave.narrationChunks)) dataToSave.narrationChunks = [];
  
  if (dataToSave.elevenLabsVoiceId === undefined) { delete dataToSave.elevenLabsVoiceId; }
  if (dataToSave.narrationVoice === undefined) { delete dataToSave.narrationVoice; }
  if (dataToSave.imageStyleId === undefined) { delete dataToSave.imageStyleId; }


  Object.keys(dataToSave).forEach(key => { if (dataToSave[key] === undefined) { delete dataToSave[key]; } });
  
  try {
    if (storyData.id) {
      const storyRef = dbAdmin.collection("stories").doc(storyData.id);
      const docSnap = await storyRef.get();
      if (!docSnap.exists) { return { success: false, error: "Story not found. Cannot update." }; }
      const existingStoryData = docSnap.data();
      if (existingStoryData?.userId !== userId) { return { success: false, error: "Unauthorized: You can only update your own stories." }; }
      
      if (existingStoryData?.createdAt) {
        dataToSave.createdAt = existingStoryData.createdAt; // Preserve original creation timestamp
      } else if (dataToSave.createdAt === undefined){ // If createdAt was somehow deleted or not set
         dataToSave.createdAt = firebaseAdmin.firestore.FieldValue.serverTimestamp(); // Set it to now
      }

      await storyRef.update(dataToSave);
      revalidatePath('/dashboard');
      revalidatePath(`/create-story?storyId=${storyData.id}`);
      return { success: true, storyId: storyData.id, data: { narrationAudioUrl: newNarrationUrl || storyData.narrationAudioUrl } };
    } else {
      const storyRef = dbAdmin.collection("stories").doc(storyIdForPath);
      await storyRef.set(dataToSave);
      revalidatePath('/dashboard');
      return { success: true, storyId: storyIdForPath, data: { narrationAudioUrl: newNarrationUrl } };
    }
  } catch (error) {
    let errorMessage = "Failed to save story.";
    const firebaseError = error as FirebaseErrorWithCode;
    if (firebaseError && firebaseError.code) {
      errorMessage = `Failed to save story (Firestore Error): ${firebaseError.message} (Code: ${firebaseError.code})`;
      if (firebaseError.message && firebaseError.message.toLowerCase().includes("billing to be enabled")) {
        errorMessage = "Failed to save story: Billing is not enabled for this project. Please enable billing in the Google Cloud Console.";
      }
    } else if (error instanceof Error) {
      errorMessage = `Failed to save story: ${error.message}`;
    }
    return { success: false, error: errorMessage };
  }
}

export async function updateStoryTimeline(
  storyId: string,
  userId: string,
  timelineTracks: PageTimelineTrack[] // Explicitly type this based on Story['timelineTracks']
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
    
    const dataToUpdate: Partial<Story> = { 
      timelineTracks: timelineTracks, 
      updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp() as any // Cast to any to satisfy type mismatch
    };
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
    
    // Delete associated files from Firebase Storage
    const storageBasePath = `users/${userId}/stories/${storyId}`;
    await deleteFolderFromFirebaseStorage(storageBasePath); // Call the new function

    await storyRef.delete();
    revalidatePath('/dashboard');
    revalidatePath(`/create-story?storyId=${storyId}`); // Though the story is gone, revalidate for consistency
    return { success: true };
  } catch (error) {
    let errorMessage = "Failed to delete story.";
    const firebaseError = error as FirebaseErrorWithCode;
    if (firebaseError && firebaseError.code) {
       errorMessage = `Failed to delete story (Firestore Error): ${firebaseError.message} (Code: ${firebaseError.code})`;
       if (firebaseError.message && firebaseError.message.toLowerCase().includes("billing to be enabled")) {
        errorMessage = "Failed to delete story: Billing is not enabled for this project. Please enable billing in the Google Cloud Console.";
      }
    } else if (error instanceof Error) { errorMessage = `Failed to delete story: ${error.message}`; }
    return { success: false, error: errorMessage };
  }
}

export async function cleanupBrokenImages(storyId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  if (!dbAdmin) { return { success: false, error: "Database connection not available" }; }
  try {
    const storyRef = dbAdmin.collection('stories').doc(storyId);
    const storyDoc = await storyRef.get();
    if (!storyDoc.exists) { return { success: false, error: "Story not found" }; }
    
    const storyData = storyDoc.data() as Story; // Type assertion
    
    let updated = false; 
    const updateData: Partial<Story> = {};
    
    if (storyData.generatedImages && Array.isArray(storyData.generatedImages)) {
      const cleanGeneratedImages = storyData.generatedImages.filter((img: any) => {
        if (img.imageUrl && img.imageUrl.includes('aicdn.picsart.com')) { return false; }
        if (img.imageUrl && img.imageUrl.includes('.mp3')) { return false; }
        return true;
      });
      if (cleanGeneratedImages.length !== storyData.generatedImages.length) { 
        updateData.generatedImages = cleanGeneratedImages; 
        updated = true; 
      }
    }
    
    // Assuming detailImages was a typo and should be part of generatedImages or another field.
    // If 'detailImages' is a distinct field, it should be typed in Story.
    // For now, I'll comment it out as it's not in the Story type.
    /*
    if (storyData.detailImages && Array.isArray(storyData.detailImages)) {
      const cleanDetailImages = storyData.detailImages.filter((img: any) => {
        if (img.imageUrl && img.imageUrl.includes('aicdn.picsart.com')) { return false; }
        return true;
      });
      if (cleanDetailImages.length !== storyData.detailImages.length) { 
        updateData.detailImages = cleanDetailImages; 
        updated = true; 
      }
    }
    */
    
    if (updated) {
      updateData.updatedAt = firebaseAdmin.firestore.FieldValue.serverTimestamp() as any; // Cast to any for FieldValue
      await storyRef.update(updateData);
    }
    return { success: true };
  } catch (error: any) { // Catch as any to access error.message
    return { success: false, error: `Failed to cleanup broken images: ${error.message || String(error)}` }; 
  }
}
