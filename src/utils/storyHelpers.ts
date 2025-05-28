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

export const parseNamedPrompts = (rawPrompts: string | undefined, type: 'Character' | 'Item' | 'Location'): ParsedPrompt[] => {
  if (!rawPrompts) return [];
  
  // Normalize escaped newlines to actual newlines
  let normalizedPrompts = rawPrompts.replace(/\\n/g, "\n");

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

  if (!storyData.generatedImages) {
    return { characters, locations, items, scenes };
  }

  console.log('=== CATEGORIZE IMAGES DEBUG ===');
  console.log('Total generatedImages:', storyData.generatedImages.length);

  // Get parsed prompts from step 2
  const characterPrompts = parseNamedPrompts(storyData.detailsPrompts?.characterPrompts, 'Character');
  const locationPrompts = parseNamedPrompts(storyData.detailsPrompts?.locationPrompts, 'Location');
  const itemPrompts = parseNamedPrompts(storyData.detailsPrompts?.itemPrompts, 'Item');

  console.log('Character prompts:', characterPrompts.map(p => p.description));
  console.log('Location prompts:', locationPrompts.map(p => p.description));
  console.log('Item prompts:', itemPrompts.map(p => p.description));
  console.log('Scene prompts:', storyData.imagePrompts || []);

  // Create sets for quick lookup
  const characterDescriptions = new Set(characterPrompts.map(p => p.description));
  const locationDescriptions = new Set(locationPrompts.map(p => p.description));
  const itemDescriptions = new Set(itemPrompts.map(p => p.description));
  const scenePrompts = new Set(storyData.imagePrompts || []);

  // Track processed images to avoid duplicates by both URL and prompt
  const processedUrls = new Set<string>();
  const processedPrompts = new Set<string>();
  
  storyData.generatedImages.forEach((image, index) => {
    console.log(`Processing image ${index}: URL=${image.imageUrl}, Prompt="${image.originalPrompt}"`);
    
    // Skip if we've already processed this image URL or this prompt
    if (processedUrls.has(image.imageUrl) || processedPrompts.has(image.originalPrompt)) {
      console.log(`  ⚠️ Skipping duplicate - URL: ${processedUrls.has(image.imageUrl)}, Prompt: ${processedPrompts.has(image.originalPrompt)}`);
      return;
    }
    processedUrls.add(image.imageUrl);
    processedPrompts.add(image.originalPrompt);
    
    if (characterDescriptions.has(image.originalPrompt)) {
      console.log(`  ✅ Added to characters: "${image.originalPrompt}"`);
      characters.push(image);
    } else if (locationDescriptions.has(image.originalPrompt)) {
      console.log(`  ✅ Added to locations: "${image.originalPrompt}"`);
      locations.push(image);
    } else if (itemDescriptions.has(image.originalPrompt)) {
      console.log(`  ✅ Added to items: "${image.originalPrompt}"`);
      items.push(image);
    } else if (scenePrompts.has(image.originalPrompt)) {
      console.log(`  ✅ Added to scenes: "${image.originalPrompt}"`);
      scenes.push(image);
    } else {
      console.log(`  ❌ No category match for: "${image.originalPrompt}"`);
    }
  });

  console.log('Final counts - Characters:', characters.length, 'Locations:', locations.length, 'Items:', items.length, 'Scenes:', scenes.length);
  return { characters, locations, items, scenes };
};

// Helper function to get scene name for a prompt
export const getSceneName = (prompt: string, index: number): string => {
  return `Scene ${index + 1}`;
};

// Helper function to count scene images (matching categorizeImages logic)
export const countSceneImages = (storyData: Story): number => {
  if (!storyData.generatedImages) {
    return 0;
  }

  const scenePrompts = new Set(storyData.imagePrompts || []);
  
  // Track processed images to avoid duplicates by both URL and prompt (same as categorizeImages)
  const processedUrls = new Set<string>();
  const processedPrompts = new Set<string>();
  
  let sceneCount = 0;
  
  storyData.generatedImages.forEach((image) => {
    // Skip if we've already processed this image URL or this prompt
    if (processedUrls.has(image.imageUrl) || processedPrompts.has(image.originalPrompt)) {
      return;
    }
    processedUrls.add(image.imageUrl);
    processedPrompts.add(image.originalPrompt);
    
    if (scenePrompts.has(image.originalPrompt)) {
      sceneCount++;
    }
  });

  return sceneCount;
};

// Helper function to count detail images (non-scene images)
export const countDetailImages = (storyData: Story): number => {
  if (!storyData.generatedImages) {
    return 0;
  }

  const scenePrompts = new Set(storyData.imagePrompts || []);
  
  // Track processed images to avoid duplicates by both URL and prompt (same as categorizeImages)
  const processedUrls = new Set<string>();
  const processedPrompts = new Set<string>();
  
  let detailCount = 0;
  
  storyData.generatedImages.forEach((image) => {
    // Skip if we've already processed this image URL or this prompt
    if (processedUrls.has(image.imageUrl) || processedPrompts.has(image.originalPrompt)) {
      return;
    }
    processedUrls.add(image.imageUrl);
    processedPrompts.add(image.originalPrompt);
    
    // Count as detail image if it's NOT a scene image
    if (!scenePrompts.has(image.originalPrompt)) {
      detailCount++;
    }
  });

  return detailCount;
};

// Helper function to determine the appropriate step based on story completion
export const determineCurrentStep = (storyData: Story): number => {
  if (storyData.generatedImages && storyData.generatedImages.length > 0 && 
      storyData.imagePrompts && storyData.generatedImages.length === storyData.imagePrompts.length) {
    // All images generated - show step 5 (last completed step)
    return 5; 
  } else if (storyData.imagePrompts && storyData.imagePrompts.length > 0) {
    // Image prompts exist but not all images generated - show step 5 (next step to work on)
    return 5; 
  } else if (storyData.narrationChunks && storyData.narrationChunks.length > 0 && storyData.narrationChunks.every(c => c.audioUrl)) {
    // All narration chunks completed - show step 4 (next step to work on)
    return 4; 
  } else if (storyData.narrationAudioUrl) {
    // Legacy audio exists - show step 4 (next step to work on)
    return 4; 
  } else if (storyData.narrationChunks && storyData.narrationChunks.length > 0) {
    // Chunks exist but not all narrated - show step 3 (current step to work on)
    return 3; 
  } else if (storyData.detailsPrompts && (storyData.detailsPrompts.characterPrompts || storyData.detailsPrompts.itemPrompts || storyData.detailsPrompts.locationPrompts)) {
    // Details prompts exist - show step 3 (next step to work on)
    return 3; 
  } else if (storyData.generatedScript) {
    // Script exists - show step 2 (next step to work on)
    return 2; 
  } else {
    // No progress - show step 1
    return 1;
  }
};

// Helper function to estimate duration from MP3 data URI (client-side)
export const getMp3DurationFromDataUriClient = (dataUri: string): Promise<number> => {
  return new Promise((resolve, reject) => {
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
