"use server";

import { baserowService } from '@/lib/baserow';
import { minioService } from '@/lib/minio';
import type { Story, PageTimelineTrack } from '@/types/story';
import { revalidatePath } from 'next/cache';

interface BaserowErrorWithCode extends Error {
  code?: string | number;
}

/**
 * Transform Firebase Story structure to Baserow row format
 */
function transformStoryToBaserow(story: Story): Record<string, unknown> {
  console.log('[transformStoryToBaserow] Saving voice settings:', {
    selectedTtsModel: story.selectedTtsModel,
    selectedGoogleTtsModel: story.selectedGoogleTtsModel,
    selectedGoogleVoiceId: story.selectedGoogleVoiceId,
    narrationVoice: story.narrationVoice
  });
  const baserowRow: Record<string, unknown> = {
    firebase_story_id: story.id || '',
    user_id: story.userId,
    Title: story.title,
    content: story.userPrompt,
    'Single select': story.status && ['draft', 'generating', 'completed', 'error'].includes(story.status) ? story.status : 'draft', // Map to Baserow status field
    created_at: story.createdAt instanceof Date ? story.createdAt.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    updated_at: new Date().toISOString().split('T')[0],
    narration_audio_url: story.narrationAudioUrl || '',
    generated_images: story.generatedImages ? JSON.stringify(story.generatedImages) : '',
    narration_chunks: story.narrationChunks ? JSON.stringify(story.narrationChunks) : '',
    spanish_narration_chunks: story.spanishNarrationChunks ? JSON.stringify(story.spanishNarrationChunks) : '',
    romanian_narration_chunks: story.romanianNarrationChunks ? JSON.stringify(story.romanianNarrationChunks) : '',
    timeline_tracks: story.timelineTracks ? JSON.stringify(story.timelineTracks) : '',
    // TODO: Add these fields to Baserow table
    // image_prompts: story.imagePrompts ? JSON.stringify(story.imagePrompts) : '',
    // action_prompts: story.actionPrompts ? JSON.stringify(story.actionPrompts) : '',
    image_style_id: story.imageStyleId || '',
    eleven_labs_voice_id: story.elevenLabsVoiceId || '',
    narration_voice: story.narrationVoice || '',
    // details_prompts: story.detailsPrompts ? JSON.stringify(story.detailsPrompts) : '',
    settings: JSON.stringify({
      narrationAudioDurationSeconds: story.narrationAudioDurationSeconds,
      imageProvider: story.imageProvider,
      aiProvider: story.aiProvider,
      perplexityModel: story.perplexityModel,
      googleScriptModel: story.googleScriptModel,
      imagePromptsData: story.imagePromptsData,
      generatedScript: story.generatedScript, // Store generated script in settings JSON
      detailsPrompts: story.detailsPrompts, // Store details prompts in settings JSON
      imagePrompts: story.imagePrompts, // Store image prompts in settings JSON
      actionPrompts: story.actionPrompts, // Store action prompts in settings JSON
      audioGenerationService: story.audioGenerationService, // Track TTS service used
      audioModel: story.audioModel, // Track audio model used
      detailImageProvider: story.detailImageProvider, // Track detail image provider
      detailImageModel: story.detailImageModel, // Track detail image model
      sceneImageProvider: story.sceneImageProvider, // Track scene image provider
      sceneImageModel: story.sceneImageModel, // Track scene image model
      selectedTtsModel: story.selectedTtsModel, // TTS model choice (elevenlabs/google)
      selectedGoogleTtsModel: story.selectedGoogleTtsModel, // Google TTS model
      selectedGoogleVoiceId: story.selectedGoogleVoiceId // Google voice ID
    })
  };

  // Remove empty/undefined fields
  Object.keys(baserowRow).forEach(key => {
    if (baserowRow[key] === undefined || baserowRow[key] === null || baserowRow[key] === '') {
      delete baserowRow[key];
    }
  });

  return baserowRow;
}

/**
 * Transform Baserow row to Firebase Story structure
 */
function transformBaserowToStory(row: Record<string, unknown>): Story {
  const story: Story = {
    id: (row.firebase_story_id as string) || (row.id as number)?.toString(),
    userId: row.user_id as string,
    title: row.Title as string,
    userPrompt: row.content as string,
    status: row['Single select'] as string,
    createdAt: row.created_at ? new Date(row.created_at as string) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at as string) : new Date(),
    narrationAudioUrl: row.narration_audio_url as string,
    generatedImages: row.generated_images ? JSON.parse(row.generated_images as string) : [],
    narrationChunks: row.narration_chunks ? JSON.parse(row.narration_chunks as string) : [],
    spanishNarrationChunks: row.spanish_narration_chunks ? JSON.parse(row.spanish_narration_chunks as string) : [],
    romanianNarrationChunks: row.romanian_narration_chunks ? JSON.parse(row.romanian_narration_chunks as string) : [],
    timelineTracks: row.timeline_tracks ? JSON.parse(row.timeline_tracks as string) : [],
    // TODO: Add these fields to Baserow table
    // imagePrompts: row.image_prompts ? JSON.parse(row.image_prompts) : [],
    // actionPrompts: row.action_prompts ? JSON.parse(row.action_prompts) : [],
    imageStyleId: row.image_style_id as string,
    elevenLabsVoiceId: row.eleven_labs_voice_id as string,
    narrationVoice: row.narration_voice as string,
    // detailsPrompts: row.details_prompts ? JSON.parse(row.details_prompts) : undefined
  };

  // Parse settings JSON
  if (row.settings) {
    try {
      const settings = JSON.parse(row.settings as string);
      console.log('[transformBaserowToStory] Parsed settings:', {
        selectedTtsModel: settings.selectedTtsModel,
        selectedGoogleTtsModel: settings.selectedGoogleTtsModel,
        selectedGoogleVoiceId: settings.selectedGoogleVoiceId
      });
      story.narrationAudioDurationSeconds = settings.narrationAudioDurationSeconds;
      story.imageProvider = settings.imageProvider;
      story.aiProvider = settings.aiProvider;
      story.perplexityModel = settings.perplexityModel;
      story.googleScriptModel = settings.googleScriptModel;
      story.imagePromptsData = settings.imagePromptsData;
      story.generatedScript = settings.generatedScript; // Read generated script from settings
      story.detailsPrompts = settings.detailsPrompts; // Read details prompts from settings
      story.imagePrompts = settings.imagePrompts; // Read image prompts from settings
      story.actionPrompts = settings.actionPrompts; // Read action prompts from settings
      story.audioGenerationService = settings.audioGenerationService; // Read TTS service used
      story.audioModel = settings.audioModel; // Read audio model used
      story.detailImageProvider = settings.detailImageProvider; // Read detail image provider
      story.detailImageModel = settings.detailImageModel; // Read detail image model
      story.sceneImageProvider = settings.sceneImageProvider; // Read scene image provider
      story.sceneImageModel = settings.sceneImageModel; // Read scene image model
      story.selectedTtsModel = settings.selectedTtsModel; // Read TTS model choice
      story.selectedGoogleTtsModel = settings.selectedGoogleTtsModel; // Read Google TTS model
      story.selectedGoogleVoiceId = settings.selectedGoogleVoiceId; // Read Google voice ID
      console.log('[transformBaserowToStory] Assigned to story:', {
        selectedTtsModel: story.selectedTtsModel,
        selectedGoogleTtsModel: story.selectedGoogleTtsModel,
        selectedGoogleVoiceId: story.selectedGoogleVoiceId
      });
    } catch (error) {
      console.warn('Failed to parse settings JSON:', error);
    }
  }

  return story;
}

/**
 * Upload audio data URI to MinIO and return the URL
 */
async function uploadAudioToMinIO(audioDataUri: string, userId: string, storyId: string, filename: string): Promise<string> {
  let base64Data: string;
  let contentType: string;

  if (audioDataUri.startsWith('data:audio/mpeg;base64,')) {
    base64Data = audioDataUri.substring('data:audio/mpeg;base64,'.length);
    contentType = 'audio/mpeg';
  } else if (audioDataUri.startsWith('data:audio/wav;base64,')) {
    base64Data = audioDataUri.substring('data:audio/wav;base64,'.length);
    contentType = 'audio/wav';
  } else {
    throw new Error('Invalid audio data URI format.');
  }

  const audioBuffer = Buffer.from(base64Data, 'base64');
  const filePath = minioService.generateFilePath(userId, storyId, filename, 'audio');
  
  await minioService.uploadFile(filePath, audioBuffer, contentType);
  
  // Return a presigned URL that expires in 7 days (matching Firebase behavior)
  return await minioService.getSignedUrl(filePath, 7 * 24 * 60 * 60);
}

// NOTE: refreshMinIOUrl function removed as URL refresh logic is temporarily disabled to prevent infinite loops

export async function getStory(storyId: string, userId: string): Promise<{ success: boolean; data?: Story; error?: string }> {
  if (!userId) {
    console.warn("[getStory Action] Attempt to fetch story without userId.");
    return { success: false, error: "User not authenticated." };
  }

  try {
    // Find the story by searching through all stories for the firebase_story_id
    let story: Story | null = null;
    let baserowRowId: string | null = null;
    
    // Always search by firebase_story_id first since that's what we typically have
    const stories = await baserowService.getStories(userId); // Only get stories for this user
    const matchingRow = stories.find((row: Record<string, unknown>) => row.firebase_story_id === storyId);
    
    if (matchingRow) {
      story = transformBaserowToStory(matchingRow);
      baserowRowId = (matchingRow.id as number).toString(); // Store the actual Baserow row ID for updates
    } else {
      // Fallback: try as Baserow row ID (for legacy compatibility)
      try {
        const row = await baserowService.getStory(storyId);
        if (row && row.user_id === userId) { // Security check here too
          story = transformBaserowToStory(row);
          baserowRowId = storyId; // It's already a Baserow row ID
        }
      } catch {
        // If both approaches fail, story doesn't exist
      }
    }

    if (!story) {
      return { success: false, error: "Story not found." };
    }

    // Security check (redundant but safe)
    if (story.userId !== userId) {
      return { success: false, error: "Unauthorized: You can only access your own stories." };
    }

    const needsUpdate = false;
    const updates: Record<string, unknown> = {};

    // TODO: Temporarily disabled URL refresh logic to prevent infinite loop
    // The URL refresh logic needs to be fixed to only update when URLs are actually expired
    
    /* DISABLED - CAUSING INFINITE LOOP
    // Refresh signed URLs for narration audio
    if (story.narrationAudioUrl) {
      const refreshedUrl = await refreshMinIOUrl(story.narrationAudioUrl);
      if (refreshedUrl && refreshedUrl !== story.narrationAudioUrl) {
        story.narrationAudioUrl = refreshedUrl;
        updates.narration_audio_url = refreshedUrl;
        needsUpdate = true;
      }
    }

    // Refresh signed URLs for narration chunks
    if (story.narrationChunks && Array.isArray(story.narrationChunks) && story.narrationChunks.length > 0) {
      let hasUpdatedChunks = false;
      const refreshedChunks = await Promise.all(story.narrationChunks.map(async (chunk) => {
        if (chunk && chunk.audioUrl) {
          const refreshedUrl = await refreshMinIOUrl(chunk.audioUrl);
          if (refreshedUrl && refreshedUrl !== chunk.audioUrl) {
            hasUpdatedChunks = true;
            return { ...chunk, audioUrl: refreshedUrl };
          }
        }
        return chunk;
      }));

      if (hasUpdatedChunks) {
        story.narrationChunks = refreshedChunks;
        updates.narration_chunks = JSON.stringify(refreshedChunks);
        needsUpdate = true;
      }
    }

    // Refresh signed URLs for generated images
    if (story.generatedImages && Array.isArray(story.generatedImages) && story.generatedImages.length > 0) {
      let hasUpdatedImages = false;
      const refreshedImages = await Promise.all(story.generatedImages.map(async (image) => {
        if (image && image.imageUrl) {
          const refreshedUrl = await refreshMinIOUrl(image.imageUrl);
          if (refreshedUrl && refreshedUrl !== image.imageUrl) {
            hasUpdatedImages = true;
            return { ...image, imageUrl: refreshedUrl };
          }
        }
        return image;
      }));

      if (hasUpdatedImages) {
        story.generatedImages = refreshedImages;
        updates.generated_images = JSON.stringify(refreshedImages);
        needsUpdate = true;
      }
    }

    // Refresh signed URLs for Spanish narration chunks
    if (story.spanishNarrationChunks && Array.isArray(story.spanishNarrationChunks) && story.spanishNarrationChunks.length > 0) {
      let hasUpdatedSpanishChunks = false;
      const refreshedSpanishChunks = await Promise.all(story.spanishNarrationChunks.map(async (chunk) => {
        if (chunk && chunk.audioUrl) {
          const refreshedUrl = await refreshMinIOUrl(chunk.audioUrl);
          if (refreshedUrl && refreshedUrl !== chunk.audioUrl) {
            hasUpdatedSpanishChunks = true;
            return { ...chunk, audioUrl: refreshedUrl };
          }
        }
        return chunk;
      }));

      if (hasUpdatedSpanishChunks) {
        story.spanishNarrationChunks = refreshedSpanishChunks;
        updates.spanish_narration_chunks = JSON.stringify(refreshedSpanishChunks);
        needsUpdate = true;
      }
    }

    // Refresh signed URLs for Romanian narration chunks
    if (story.romanianNarrationChunks && Array.isArray(story.romanianNarrationChunks) && story.romanianNarrationChunks.length > 0) {
      let hasUpdatedRomanianChunks = false;
      const refreshedRomanianChunks = await Promise.all(story.romanianNarrationChunks.map(async (chunk) => {
        if (chunk && chunk.audioUrl) {
          const refreshedUrl = await refreshMinIOUrl(chunk.audioUrl);
          if (refreshedUrl && refreshedUrl !== chunk.audioUrl) {
            hasUpdatedRomanianChunks = true;
            return { ...chunk, audioUrl: refreshedUrl };
          }
        }
        return chunk;
      }));

      if (hasUpdatedRomanianChunks) {
        story.romanianNarrationChunks = refreshedRomanianChunks;
        updates.romanian_narration_chunks = JSON.stringify(refreshedRomanianChunks);
        needsUpdate = true;
      }
    }
    */

    // Update story in Baserow if URLs were refreshed (use the correct Baserow row ID)
    if (needsUpdate && baserowRowId) {
      try {
        updates.updated_at = new Date().toISOString().split('T')[0];
        await baserowService.updateStory(baserowRowId, updates);
        console.log(`[getStory Action] Refreshed and updated URLs for story ${storyId} (row ${baserowRowId})`);
      } catch (updateError) {
        console.error(`[getStory Action] Failed to update story ${storyId} with refreshed URLs:`, updateError);
      }
    }

    return { success: true, data: story };
    
  } catch (error) {
    console.error("[getStory Action] Error fetching story from Baserow:", error);
    let errorMessage = "Failed to fetch story.";
    
    const baserowError = error as BaserowErrorWithCode;
    if (baserowError && baserowError.code) {
      errorMessage = `Failed to fetch story (Baserow Error): ${baserowError.message} (Code: ${baserowError.code})`;
    } else if (error instanceof Error) {
      errorMessage = `Failed to fetch story: ${error.message}`;
    }
    
    return { success: false, error: errorMessage };
  }
}

export async function saveStory(storyData: Story, userId: string): Promise<{ success: boolean; storyId?: string; error?: string; data?: { narrationAudioUrl?: string } }> {
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    return { success: false, error: "User not authenticated or user ID is invalid." };
  }

  const storyIdForPath = storyData.id || `story_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const processedStoryData = { ...storyData };
  let newNarrationUrl: string | undefined = undefined;

  // Handle audio upload to MinIO
  if (processedStoryData.narrationAudioUrl && processedStoryData.narrationAudioUrl.startsWith('data:audio/')) {
    try {
      const fileExtension = processedStoryData.narrationAudioUrl.startsWith('data:audio/wav') ? 'wav' : 'mp3';
      const defaultFilename = `uploaded_narration.${fileExtension}`;
      const storageUrl = await uploadAudioToMinIO(processedStoryData.narrationAudioUrl, userId, storyIdForPath, defaultFilename);
      processedStoryData.narrationAudioUrl = storageUrl;
      newNarrationUrl = storageUrl;
    } catch (uploadError: unknown) {
      let detailedErrorMessage = "Failed to upload narration audio";
      if (uploadError instanceof Error) {
        detailedErrorMessage += `: ${uploadError.message}`;
      } else {
        detailedErrorMessage += `: ${String(uploadError)}`;
      }
      return { success: false, error: detailedErrorMessage };
    }
  }

  // Set timestamps
  processedStoryData.updatedAt = new Date();
  if (!storyData.id && !processedStoryData.createdAt) {
    processedStoryData.createdAt = new Date();
  }

  try {
    if (storyData.id) {
      // Update existing story - need to find the Baserow row ID
      try {
        // First try to get by Baserow ID
        let baserowRowId: string | null = null;
        let existingStory: Story | null = null;
        
        try {
          const row = await baserowService.getStory(storyData.id);
          if (row) {
            baserowRowId = storyData.id; // It's already a Baserow row ID
            existingStory = transformBaserowToStory(row);
          }
        } catch {
          // If not found by Baserow ID, try by firebase_story_id
          const stories = await baserowService.getStories();
          const matchingRow = stories.find((row: Record<string, unknown>) => row.firebase_story_id === storyData.id);
          if (matchingRow) {
            baserowRowId = (matchingRow.id as number).toString(); // Use the Baserow row ID
            existingStory = transformBaserowToStory(matchingRow);
          }
        }
        
        if (!baserowRowId || !existingStory) {
          return { success: false, error: "Story not found. Cannot update." };
        }

        if (existingStory.userId !== userId) {
          return { success: false, error: "Unauthorized: You can only update your own stories." };
        }

        // Preserve original creation timestamp
        processedStoryData.createdAt = existingStory.createdAt;

        const baserowData = transformStoryToBaserow(processedStoryData);
        await baserowService.updateStory(baserowRowId, baserowData);
      } catch (updateError) {
        console.error('Error updating story:', updateError);
        return { success: false, error: `Failed to update story: ${updateError instanceof Error ? updateError.message : 'Unknown error'}` };
      }

      revalidatePath('/dashboard');
      revalidatePath(`/create-story?storyId=${storyData.id}`);
      return { 
        success: true, 
        storyId: storyData.id, 
        data: { narrationAudioUrl: newNarrationUrl || storyData.narrationAudioUrl } 
      };
    } else {
      // Create new story - first check for duplicates
      try {
        const existingStories = await baserowService.getStories(userId);
        const isDuplicate = existingStories.some((story: Record<string, unknown>) => 
          story.user_id === userId && 
          story.Title === processedStoryData.title?.trim() &&
          story.content === processedStoryData.userPrompt?.trim()
        );
        
        if (isDuplicate) {
          console.warn(`[saveStory] Duplicate story detected for user ${userId}: "${processedStoryData.title}"`);
          return { success: false, error: "A story with this title and content already exists." };
        }
      } catch (duplicateCheckError) {
        console.warn('[saveStory] Failed to check for duplicates, proceeding with creation:', duplicateCheckError);
        // Continue with creation if duplicate check fails
      }
      
      const baserowData = transformStoryToBaserow(processedStoryData);
      baserowData.firebase_story_id = storyIdForPath; // Set the ID for new stories
      
      await baserowService.createStory(baserowData);
      
      revalidatePath('/dashboard');
      return { 
        success: true, 
        storyId: storyIdForPath, 
        data: { narrationAudioUrl: newNarrationUrl } 
      };
    }
  } catch (error) {
    let errorMessage = "Failed to save story.";
    const baserowError = error as BaserowErrorWithCode;
    
    if (baserowError && baserowError.code) {
      errorMessage = `Failed to save story (Baserow Error): ${baserowError.message} (Code: ${baserowError.code})`;
    } else if (error instanceof Error) {
      errorMessage = `Failed to save story: ${error.message}`;
    }
    
    return { success: false, error: errorMessage };
  }
}

export async function updateStoryTimeline(
  storyId: string,
  userId: string,
  timelineTracks: PageTimelineTrack[]
): Promise<{ success: boolean; error?: string }> {
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    return { success: false, error: "User not authenticated or user ID is invalid." };
  }
  
  if (!storyId) {
    return { success: false, error: "Story ID is required to update the timeline." };
  }

  try {
    // Find the actual Baserow row ID - same logic as in saveStory and deleteStory
    let baserowRowId: string | null = null;
    let existingStory: Story | null = null;
    
    try {
      const row = await baserowService.getStory(storyId);
      if (row) {
        baserowRowId = storyId; // It's already a Baserow row ID
        existingStory = transformBaserowToStory(row);
      }
    } catch {
      // If not found by Baserow ID, try by firebase_story_id
      const stories = await baserowService.getStories();
      const matchingRow = stories.find((row: Record<string, unknown>) => row.firebase_story_id === storyId);
      if (matchingRow) {
        baserowRowId = (matchingRow.id as number).toString(); // Use the Baserow row ID
        existingStory = transformBaserowToStory(matchingRow);
      }
    }
    
    if (!baserowRowId || !existingStory) {
      return { success: false, error: "Story not found. Cannot update timeline." };
    }

    if (existingStory.userId !== userId) {
      return { success: false, error: "Unauthorized: You can only update the timeline of your own stories." };
    }

    const updates = {
      timeline_tracks: JSON.stringify(timelineTracks),
      updated_at: new Date().toISOString().split('T')[0]
    };

    await baserowService.updateStory(baserowRowId, updates);

    revalidatePath(`/assemble-video?storyId=${storyId}`);
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    let errorMessage = "Failed to update story timeline.";
    const baserowError = error as BaserowErrorWithCode;
    
    if (baserowError && baserowError.code) {
      errorMessage = `Failed to update story timeline (Baserow Error): ${baserowError.message} (Code: ${baserowError.code})`;
    } else if (error instanceof Error) {
      errorMessage = `Failed to update story timeline: ${error.message}`;
    }
    
    return { success: false, error: errorMessage };
  }
}

export async function deleteStory(
  storyId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    return { success: false, error: "User not authenticated or user ID is invalid." };
  }
  
  if (!storyId) {
    return { success: false, error: "Story ID is required to delete the story." };
  }

  try {
    // Find the actual Baserow row ID - same logic as in saveStory
    let baserowRowId: string | null = null;
    let existingStory: Story | null = null;
    
    try {
      const row = await baserowService.getStory(storyId);
      if (row) {
        baserowRowId = storyId; // It's already a Baserow row ID
        existingStory = transformBaserowToStory(row);
      }
    } catch {
      // If not found by Baserow ID, try by firebase_story_id
      const stories = await baserowService.getStories();
      const matchingRow = stories.find((row: Record<string, unknown>) => row.firebase_story_id === storyId);
      if (matchingRow) {
        baserowRowId = (matchingRow.id as number).toString(); // Use the Baserow row ID
        existingStory = transformBaserowToStory(matchingRow);
      }
    }
    
    if (!baserowRowId || !existingStory) {
      return { success: false, error: "Story not found." };
    }

    if (existingStory.userId !== userId) {
      return { success: false, error: "Unauthorized: You can only delete your own stories." };
    }

    // Delete associated files from MinIO (non-blocking)
    try {
      console.log(`[deleteStory] Attempting to clean up storage files for story: ${storyId}`);
      const files = await minioService.listFiles(`users/${userId}/stories/${storyId}/`);
      if (files.length > 0) {
        await Promise.all(files.map(filePath => minioService.deleteFile(filePath)));
        console.log(`[deleteStory] Successfully deleted ${files.length} storage files`);
      } else {
        console.log(`[deleteStory] No storage files found to delete`);
      }
    } catch (storageError) {
      console.warn('[deleteStory] Failed to delete some storage files (this does not affect story deletion):', storageError);
      // Continue with story deletion even if storage cleanup fails
    }

    await baserowService.deleteStory(baserowRowId);

    revalidatePath('/dashboard');
    revalidatePath(`/create-story?storyId=${storyId}`);
    return { success: true };
  } catch (error) {
    let errorMessage = "Failed to delete story.";
    const baserowError = error as BaserowErrorWithCode;
    
    if (baserowError && baserowError.code) {
      errorMessage = `Failed to delete story (Baserow Error): ${baserowError.message} (Code: ${baserowError.code})`;
    } else if (error instanceof Error) {
      errorMessage = `Failed to delete story: ${error.message}`;
    }
    
    return { success: false, error: errorMessage };
  }
}

export async function getUserStories(userId: string): Promise<{ success: boolean; data?: Story[]; error?: string }> {
  if (!userId) {
    return { success: false, error: "User ID is required" };
  }

  try {
    const rows = await baserowService.getStories(userId);
    const stories = rows.map(transformBaserowToStory).sort((a, b) => {
      // Sort by updatedAt descending (most recent first) so that newly opened/edited stories appear at the top
      const aTime = a.updatedAt instanceof Date ? a.updatedAt.getTime() : 0;
      const bTime = b.updatedAt instanceof Date ? b.updatedAt.getTime() : 0;
      return bTime - aTime;
    });
    
    return { success: true, data: stories };
  } catch (error) {
    console.error('Error fetching user stories:', error);
    return { success: false, error: 'Failed to fetch stories' };
  }
}

export async function cleanupBrokenImages(storyId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const story = await baserowService.getStory(storyId);
    if (!story) {
      return { success: false, error: "Story not found" };
    }

    let updated = false;
    const updates: Record<string, unknown> = {};

    // Parse and clean generated images
    if (story.generated_images) {
      try {
        const generatedImages = JSON.parse(story.generated_images as string);
        if (Array.isArray(generatedImages)) {
          const cleanGeneratedImages = generatedImages.filter((img: { imageUrl?: string }) => {
            if (img && img.imageUrl && typeof img.imageUrl === 'string') {
              if (img.imageUrl.includes('aicdn.picsart.com')) { return false; }
              if (img.imageUrl.includes('.mp3')) { return false; }
            }
            return true;
          });
          
          if (cleanGeneratedImages.length !== generatedImages.length) {
            updates.generated_images = JSON.stringify(cleanGeneratedImages);
            updated = true;
          }
        }
      } catch (parseError) {
        console.warn('Failed to parse generated_images JSON:', parseError);
      }
    }

    if (updated) {
      updates.updated_at = new Date().toISOString().split('T')[0];
      await baserowService.updateStory(storyId, updates);
    }

    return { success: true };
  } catch (error: unknown) {
    let errorMessage = "Failed to cleanup broken images";
    if (error instanceof Error) {
      errorMessage += `: ${error.message}`;
    } else {
      errorMessage += `: ${String(error)}`;
    }
    return { success: false, error: errorMessage };
  }
}
