/**
 * Types related to narration processing
 */

export interface NarrationChunk {
  id: string;
  text: string;
  audioUrl?: string;
  duration?: number;
  index: number;
}

export interface ChunkedNarration {
  chunks: NarrationChunk[];
  totalDuration?: number;
}