
import { v4 as uuidv4 } from 'uuid';
import type { NarrationChunk } from '@/types/narration';
import { generateScriptChunks as aiGenerateScriptChunks } from '@/actions/storyActions';

/**
 * Prepare script chunks for narration using AI.
 * @param script The full story script.
 * @param userId The ID of the user making the request (for API key retrieval).
 * @param targetChunks Optional: This parameter might be used by the AI as a hint, but the AI will ultimately decide the chunks.
 * @param aiProvider The AI provider to use ('google' or 'perplexity').
 * @param perplexityModel The specific Perplexity model to use, if applicable.
 * @param googleScriptModel The specific Google model to use, if applicable.
 * @returns Promise resolving to an array of NarrationChunk objects.
 */
export async function prepareScriptChunksAI(
  script: string,
  userId: string,
  aiProvider?: 'google' | 'perplexity',
  perplexityModel?: string,
  googleScriptModel?: string
): Promise<NarrationChunk[]> {
  if (!script) return [];

  try {
    // Call the AI flow (server action) to get intelligently split chunks
    const result = await aiGenerateScriptChunks({
      script,
      userId,
      aiProvider: aiProvider || 'google', // Default to google if not provided
      perplexityModel,
      googleScriptModel
    });

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
      // Note: AI provider fallback is handled in storyActions.ts
      // If we reach here, both primary and fallback AI providers failed
      console.warn("AI chunk generation failed (including fallbacks), falling back to simple chunking");
      return prepareScriptChunksSimple(script);
    }
  } catch (error) {
    console.error("Error calling AI for script chunking:", error);
    // If it's an API key error, re-throw it
    if (error instanceof Error && error.message.toLowerCase().includes("api key not configured")) {
      throw error;
    }
    // For other errors, fallback to simple chunking
    // Note: AI provider fallback is handled in storyActions.ts  
    console.warn("AI script chunking failed (including fallbacks), falling back to simple chunking");
    return prepareScriptChunksSimple(script);
  }
}

export function prepareScriptChunksSimple(script: string): NarrationChunk[] {
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
