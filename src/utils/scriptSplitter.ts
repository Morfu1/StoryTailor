/**
 * Utility functions to split a story script into smaller chunks for narration and image generation
 */

/**
 * Split a story script into smaller chunks for narration and image generation
 * @param script The full story script to split
 * @returns An array of script chunks
 */
export function splitScriptIntoChunks(script: string): string[] {
  if (!script || typeof script !== 'string') {
    return [];
  }

  // First, normalize line endings
  const normalizedScript = script.replace(/\r\n/g, '\n');

  // Split by sentences, considering various punctuation marks that end sentences
  // This regex looks for: 
  // - A sentence ending punctuation (., !, ?)
  // - Followed by a space or end of string
  // - And captures the sentence including the punctuation
  const sentenceRegex = /[^.!?]+[.!?](?:\s|$)/g;
  const sentences = normalizedScript.match(sentenceRegex) || [];

  // Clean up the sentences (trim whitespace)
  const cleanedSentences = sentences.map(sentence => sentence.trim());

  // Group sentences into logical chunks
  // For now, we'll use a simple approach: each sentence is a chunk
  // In a more advanced implementation, we could group related sentences together
  
  // Filter out empty chunks
  const chunks = cleanedSentences.filter(chunk => chunk.length > 0);

  // If no chunks were found (perhaps due to unusual formatting),
  // fall back to splitting by paragraphs
  if (chunks.length === 0) {
    const paragraphs = normalizedScript.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    return paragraphs;
  }

  return chunks;
}

/**
 * Combine script chunks into a single script
 * @param chunks Array of script chunks
 * @returns Combined script
 */
export function combineScriptChunks(chunks: string[]): string {
  if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
    return '';
  }
  
  return chunks.join(' ');
}

/**
 * Split a script into chunks with a target number of chunks
 * @param script The full story script to split
 * @param targetChunks The target number of chunks to create
 * @returns An array of script chunks
 */
export function splitScriptWithTargetChunks(script: string, targetChunks: number): string[] {
  if (!script || typeof script !== 'string' || targetChunks <= 0) {
    return [];
  }

  // First get all individual sentences
  const allSentences = splitScriptIntoChunks(script);
  
  if (allSentences.length <= targetChunks) {
    // If we already have fewer sentences than target chunks, return as is
    return allSentences;
  }
  
  // Calculate how many sentences should be in each chunk
  const sentencesPerChunk = Math.ceil(allSentences.length / targetChunks);
  
  // Group sentences into chunks
  const result: string[] = [];
  
  for (let i = 0; i < allSentences.length; i += sentencesPerChunk) {
    const chunkSentences = allSentences.slice(i, i + sentencesPerChunk);
    result.push(chunkSentences.join(' '));
  }
  
  return result;
}