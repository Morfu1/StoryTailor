
import type { Story, GeneratedImage } from '@/types/story';

export interface ParsedPrompt {
  name?: string;
  description: string;
  originalIndex: number; 
}

// Helper function to extract meaningful keywords from text for image prompt variations
export const extractKeywordsFromText = (text: string): string => {
  if (!text || text.length < 5) return '';
  
  // Extract nouns, adjectives, and verbs using basic heuristics
  // Look for phrases that might represent visual elements
  const sentences = text.split(/[.!?]\s+/);
  if (sentences.length === 0) return '';
  
  // Find the most descriptive sentence (usually one with the most visual words)
  const descriptiveSentence = sentences.reduce((best, current) => {
    const visualWords = (current.match(/(?:look|see|appear|bright|dark|color|red|blue|green|yellow|gold|silver|shine|glow|sparkle|face|eyes|hands|sky|mountain|river|tree|flower|castle|building)/gi) || []).length;
    const bestVisualWords = (best.match(/(?:look|see|appear|bright|dark|color|red|blue|green|yellow|gold|silver|shine|glow|sparkle|face|eyes|hands|sky|mountain|river|tree|flower|castle|building)/gi) || []).length;
    return visualWords > bestVisualWords ? current : best;
  }, sentences[0]);
  
  // Extract a key phrase (3-6 words) from the most descriptive sentence
  const words = descriptiveSentence.split(/\s+/);
  if (words.length <= 6) return descriptiveSentence.trim();
  
  // Find the most interesting segment of the sentence
  for (let i = 0; i < words.length - 5; i++) {
    const segment = words.slice(i, i + 6).join(' ');
    if (segment.match(/(?:look|see|appear|bright|dark|color|red|blue|green|yellow|gold|silver|shine|glow|sparkle|face|eyes|hands|sky|mountain|river|tree|flower|castle|building)/gi)) {
      return segment.trim();
    }
  }
  
  // Fallback to a simple 6-word phrase if no visual elements found
  return words.slice(0, 6).join(' ').trim();
};

export const parseNamedPrompts = (rawPrompts: string | undefined): ParsedPrompt[] => {
  if (!rawPrompts) return [];
  
  // Normalize escaped newlines to actual newlines
  const normalizedPrompts = rawPrompts.replace(/\\n/g, "\n");

  const cleanPrompts = normalizedPrompts
    .replace(/^(Character Prompts:|Item Prompts:|Location Prompts:)\s*\n*/i, '')
    .trim();

  if (!cleanPrompts) return [];

  return cleanPrompts.split(/\n\s*\n/) 
    .map((block, index) => {
      const lines = block.trim().split('\n').map(l => l.trim()).filter(l => l);
      if (lines.length === 0) {
        return null; 
      }

      let name: string | undefined = undefined;
      let description: string;

      if (lines.length > 1) {
        // Attempt to identify if the first line is a name.
        // This heuristic assumes a name is typically shorter and doesn't end with punctuation like a sentence.
        // And the subsequent lines form the description.
        const firstLineIsLikelyName = lines[0].length < 60 && !/[\.?!]$/.test(lines[0]) && lines.slice(1).join(' ').length > 0;

        if (firstLineIsLikelyName) {
          name = lines[0];
          description = lines.slice(1).join('\n');
        } else {
          description = lines.join('\n');
        }
      } else {
        description = lines[0];
      }
      
      if (!description && name) { // If parsing resulted in empty description but a name was found
        description = name;       // Treat the name as the description
        name = undefined;         // Clear the name
      }

      if (!description) return null; // If there's genuinely no description content

      return { name, description, originalIndex: index };
    })
    .filter(p => p !== null) as ParsedPrompt[];
};

// Helper function to categorize images based on their source
export const categorizeImages = (storyData: Story) => {
  const characters: GeneratedImage[] = [];
  const locations: GeneratedImage[] = [];
  const items: GeneratedImage[] = [];
  const scenes: GeneratedImage[] = [];

  if (!storyData.generatedImages || storyData.generatedImages.length === 0) {
    return { characters, locations, items, scenes };
  }

  // Get parsed prompts from step 2 to identify detail images
  const characterPrompts = parseNamedPrompts(storyData.detailsPrompts?.characterPrompts);
  const locationPrompts = parseNamedPrompts(storyData.detailsPrompts?.locationPrompts);
  const itemPrompts = parseNamedPrompts(storyData.detailsPrompts?.itemPrompts);

  const characterDescriptions = new Set(characterPrompts.map(p => p.description));
  const locationDescriptions = new Set(locationPrompts.map(p => p.description));
  const itemDescriptions = new Set(itemPrompts.map(p => p.description));
  
  // Track processed images by URL to avoid duplicates if multiple categories match (unlikely with sceneIndex)
  const processedImageUrls = new Set<string>();

  storyData.generatedImages.forEach((image) => {
    if (!image.imageUrl || processedImageUrls.has(image.imageUrl)) {
      return; // Skip if no URL or already processed
    }

    let categorized = false;
    // Check if it's a detail image (sceneIndex is usually undefined or -1 for detail images)
    if (image.sceneIndex === undefined || image.sceneIndex < 0) {
      if (characterDescriptions.has(image.originalPrompt)) {
        characters.push(image);
        categorized = true;
      } else if (locationDescriptions.has(image.originalPrompt)) {
        locations.push(image);
        categorized = true;
      } else if (itemDescriptions.has(image.originalPrompt)) {
        items.push(image);
        categorized = true;
      }
    }
    // If it was categorized as a detail image, mark URL as processed
    if (categorized) {
      processedImageUrls.add(image.imageUrl);
    }
  });

  // For scene images, iterate through the canonical image prompts (storyData.imagePrompts)
  // and find the corresponding generated image by its sceneIndex.
  if (storyData.imagePrompts && storyData.generatedImages) {
    storyData.imagePrompts.forEach((_canonicalPromptText, sceneIdx) => {
      const imageForScene = storyData.generatedImages?.find(
        (img) => img.sceneIndex === sceneIdx && img.imageUrl
      );
      if (imageForScene && !processedImageUrls.has(imageForScene.imageUrl)) {
        // Ensure it hasn't been accidentally categorized as a detail image
        // (e.g., if a scene prompt accidentally matched a detail prompt text)
        scenes.push(imageForScene);
        processedImageUrls.add(imageForScene.imageUrl); // Mark as processed for scenes
      }
    });
  }
  
  return { characters, locations, items, scenes };
};


// Helper function to get scene name for a prompt
export const getSceneName = (prompt: string, index: number): string => {
  // index is the position in the scenes array in the FinalReviewStep
  // which now matches the original order in imagePrompts
  return `Scene ${index + 1}`;
};

// Helper function to count scene images (matching categorizeImages logic)
export const countSceneImages = (storyData: Story): number => {
  if (!storyData.generatedImages || !storyData.imagePrompts) {
    return 0;
  }
  let count = 0;
  storyData.imagePrompts.forEach((_prompt, sceneIdx) => {
    if (storyData.generatedImages?.some(img => img.sceneIndex === sceneIdx && img.imageUrl)) {
      count++;
    }
  });
  return count;
};

// Helper function to count detail images (non-scene images)
export const countDetailImages = (storyData: Story): number => {
  if (!storyData.generatedImages) {
    return 0;
  }

  const characterPrompts = parseNamedPrompts(storyData.detailsPrompts?.characterPrompts);
  const locationPrompts = parseNamedPrompts(storyData.detailsPrompts?.locationPrompts);
  const itemPrompts = parseNamedPrompts(storyData.detailsPrompts?.itemPrompts);

  const characterDescriptions = new Set(characterPrompts.map(p => p.description));
  const locationDescriptions = new Set(locationPrompts.map(p => p.description));
  const itemDescriptions = new Set(itemPrompts.map(p => p.description));
  
  let detailCount = 0;
  const processedUrls = new Set<string>();

  storyData.generatedImages.forEach((image) => {
    if (!image.imageUrl || processedUrls.has(image.imageUrl)) return;

    if (image.sceneIndex === undefined || image.sceneIndex < 0) { // Check if it's likely a detail image
      if (characterDescriptions.has(image.originalPrompt) ||
          locationDescriptions.has(image.originalPrompt) ||
          itemDescriptions.has(image.originalPrompt)) {
        detailCount++;
        processedUrls.add(image.imageUrl);
      }
    }
  });
  return detailCount;
};

// Helper function to determine the appropriate step based on story completion
export const determineCurrentStep = (storyData: Story): number => {
  if (storyData.generatedImages && storyData.generatedImages.length > 0 && 
      storyData.imagePrompts && countSceneImages(storyData) === storyData.imagePrompts.length && storyData.imagePrompts.length > 0) {
    return 5; 
  } else if (storyData.imagePrompts && storyData.imagePrompts.length > 0) {
    return 4; // If prompts exist, user is on or past step 4 (working on generating images)
  } else if (storyData.narrationChunks && storyData.narrationChunks.length > 0 && storyData.narrationChunks.every(c => c.audioUrl)) {
    return 4; 
  } else if (storyData.narrationAudioUrl) {
    return 4; 
  } else if (storyData.narrationChunks && storyData.narrationChunks.length > 0) {
    return 3; 
  } else if (storyData.detailsPrompts && (storyData.detailsPrompts.characterPrompts || storyData.detailsPrompts.itemPrompts || storyData.detailsPrompts.locationPrompts)) {
    return 3; 
  } else if (storyData.generatedScript) {
    return 2; 
  } else {
    return 1;
  }
};

// Helper function to estimate duration from MP3 data URI (client-side)
export const getMp3DurationFromDataUriClient = (dataUri: string): Promise<number> => {
  return new Promise((resolve) => {
    if (!dataUri.startsWith('data:audio/mpeg;base64,')) {
      console.warn('Cannot estimate duration: Not an MP3 data URI.');
      resolve(30); // Default duration
      return;
    }
    const audio = document.createElement('audio');
    audio.src = dataUri;
    audio.onloadedmetadata = () => {
      if (audio.duration === Infinity || !audio.duration) {
        // Fallback for browsers that struggle with data URI duration
        const base64Data = dataUri.substring('data:audio/mpeg;base64,'.length);
        const kbytes = Math.ceil(((base64Data.length / 4) * 3) / 1024); // Estimate kbytes
        const estimatedDuration = Math.max(1, Math.floor(kbytes / 16)); // Approx 128kbps
        console.warn(`Could not get precise duration, estimated: ${estimatedDuration}s`);
        resolve(estimatedDuration);
      } else {
        resolve(parseFloat(audio.duration.toFixed(2)));
      }
    };
    audio.onerror = (e) => {
      console.error('Error loading audio for duration calculation:', e);
      const base64Data = dataUri.substring('data:audio/mpeg;base64,'.length);
      const kbytes = Math.ceil(((base64Data.length / 4) * 3) / 1024);
      const estimatedDuration = Math.max(1, Math.floor(kbytes / 16));
      resolve(estimatedDuration); 
    };
  });
};
