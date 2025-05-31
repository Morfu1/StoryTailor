
import { v4 as uuidv4 } from 'uuid';
import type { NarrationChunk } from '@/types/narration';
import { generateScriptChunks as aiGenerateScriptChunks } from '@/actions/storyActions';

/**
 * Prepare script chunks for narration using AI.
 * @param script The full story script.
 * @param userId The ID of the user making the request (for API key retrieval).
 * @param targetChunks Optional: This parameter might be used by the AI as a hint, but the AI will ultimately decide the chunks.
 * @returns Promise resolving to an array of NarrationChunk objects.
 */
export async function prepareScriptChunksAI(script: string, userId: string, targetChunks?: number): Promise<NarrationChunk[]> {
  if (!script) return [];

  try {
    // Call the AI flow (server action) to get intelligently split chunks
    // The server action now requires userId
    const result = await aiGenerateScriptChunks({ script, userId });

    if (result.success && result.data && result.data.scriptChunks) {
      const textChunks = result.data.scriptChunks;
      // Convert to NarrationChunk objects
      return textChunks.map((text, index) => ({
        id: uuidv4(),
        text,
        index,
      }));
    } else {
      console.error("Failed to generate script chunks with AI:", result.error);
      // If the error is due to a missing API key, re-throw it or return an object indicating the issue
      if (result.error && result.error.toLowerCase().includes("api key not configured")) {
        throw new Error(result.error);
      }
      return [];
    }
  } catch (error) {
    console.error("Error calling AI for script chunking:", error);
    // Re-throw the error so the calling function can handle it (e.g., show a specific toast)
    throw error;
  }
}

export function prepareScriptChunksSimple(script: string, targetChunks?: number): NarrationChunk[] {
  if (!script) return [];
  const textChunks = script.split('. ').map(s => s.trim()).filter(s => s.length > 0);
  return textChunks.map((text, index) => ({
    id: uuidv4(),
    text,
    index,
  }));
}

export function estimateChunkDuration(text: string): number {
  if (!text) return 0;
  const wordsPerSecond = 2.6;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, wordCount / wordsPerSecond);
}

export function calculateTotalNarrationDuration(chunks: NarrationChunk[]): number {
  if (!chunks || !Array.isArray(chunks)) return 0;
  return chunks.reduce((total, chunk) => {
    return total + (chunk.duration || estimateChunkDuration(chunk.text));
  }, 0);
}
