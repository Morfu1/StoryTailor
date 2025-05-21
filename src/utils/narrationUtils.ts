import { v4 as uuidv4 } from 'uuid';
// We might still keep splitScriptIntoChunks for fallback or other purposes,
// but the primary path will use the AI flow.
// import { splitScriptIntoChunks } from './scriptSplitter';
import type { NarrationChunk } from '@/types/narration';
import { generateScriptChunks as aiGenerateScriptChunks } from '@/actions/storyActions'; // Import the action

/**
 * Prepare script chunks for narration using AI.
 * @param script The full story script.
 * @param targetChunks Optional: This parameter might be used by the AI as a hint, but the AI will ultimately decide the chunks.
 * @returns Promise resolving to an array of NarrationChunk objects.
 */
export async function prepareScriptChunksAI(script: string, targetChunks?: number): Promise<NarrationChunk[]> {
  if (!script) return [];

  try {
    // Call the AI flow to get intelligently split chunks
    const result = await aiGenerateScriptChunks({ script }); // Pass targetChunks if the AI flow supports it as a hint

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
      // Fallback to a simpler splitting mechanism if AI fails, or return empty array
      // For now, returning empty to indicate failure at AI step.
      // Consider using the old splitScriptIntoChunks here as a fallback.
      return [];
    }
  } catch (error) {
    console.error("Error calling AI for script chunking:", error);
    return []; // Or handle error more gracefully
  }
}

// Keep the old function for now, maybe rename it or make it internal if it's only a fallback
/**
 * Prepare script chunks for narration (simple split)
 * @param script The full story script
 * @param targetChunks Optional target number of chunks (if not provided, will use natural sentence breaks)
 * @returns Array of NarrationChunk objects
 */
export function prepareScriptChunksSimple(script: string, targetChunks?: number): NarrationChunk[] {
  if (!script) return [];
  
  // This uses the non-AI splitter from scriptSplitter.ts
  // You'll need to ensure splitScriptIntoChunks is available if you use this.
  // For now, let's assume it's not the primary path.
  // const textChunks = targetChunks
  //   ? splitScriptIntoChunks(script).slice(0, targetChunks)
  //   : splitScriptIntoChunks(script);
  
  // Placeholder if splitScriptIntoChunks is removed or not imported:
  const textChunks = script.split('. ').map(s => s.trim()).filter(s => s.length > 0);


  // Convert to NarrationChunk objects
  return textChunks.map((text, index) => ({
    id: uuidv4(),
    text,
    index,
  }));
}

/**
 * Calculate the estimated duration of a text chunk in seconds
 * This is a very rough estimation based on average reading speed
 * @param text The text to estimate duration for
 * @returns Estimated duration in seconds
 */
export function estimateChunkDuration(text: string): number {
  if (!text) return 0;
  
  // Average reading speed is about 150-160 words per minute for narration
  // So about 2.5-2.7 words per second
  const wordsPerSecond = 2.6;
  
  // Count words (split by spaces and filter out empty strings)
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  
  // Calculate duration with a minimum of 1 second
  return Math.max(1, wordCount / wordsPerSecond);
}

/**
 * Calculate the total duration of all narration chunks
 * @param chunks Array of narration chunks
 * @returns Total duration in seconds
 */
export function calculateTotalNarrationDuration(chunks: NarrationChunk[]): number {
  if (!chunks || !Array.isArray(chunks)) return 0;
  
  return chunks.reduce((total, chunk) => {
    return total + (chunk.duration || estimateChunkDuration(chunk.text));
  }, 0);
}