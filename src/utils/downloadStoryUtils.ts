
import JSZip from 'jszip';
import { Story, GeneratedImage } from '@/types/story'; // Added GeneratedImage

/**
 * Expand entity references like Picsart does - replace @references with full descriptions
 */
/* async function expandEntityReferencesForExport(prompt: string, storyData: Story): Promise<string> {
  try {
    const { parseEntityReferences } = await import('@/app/(app)/assemble-video/utils');
    return parseEntityReferences(prompt, storyData);
  } catch (error) {
    console.warn('Failed to expand entity references:', error);
    return prompt;
  }
} */

/**
 * Expand entity references like Imagen3 does - replace @references with entity names only
 */
/* async function expandEntityNamesOnlyForExport(prompt: string, storyData: Story): Promise<string> {
  try {
    const { extractEntityNames, nameToReference } = await import('@/app/(app)/assemble-video/utils');
    
    // Helper function to normalize references for robust comparison
    const normalizeRefForComparison = (ref: string): string => {
      if (!ref.startsWith('@')) return ref.toLowerCase().replace(/[^a-z0-9]/g, '');
      return '@' + ref.substring(1).toLowerCase().replace(/[^a-z0-9]/g, '');
    };
    
    let expandedPrompt = prompt;
    const entityReferencesInPrompt = Array.from(new Set(prompt.match(/@[A-Za-z0-9_]+/g) || []));
    const { characters, items, locations } = extractEntityNames(storyData);
    
    for (const ref of entityReferencesInPrompt) {
      let actualEntityName: string | null = null;
      
      const normalizedRef = normalizeRefForComparison(ref);
      
      // Check all entity types with case-insensitive matching
      const allEntityNames = [...characters, ...items, ...locations];
      for (const storyEntityName of allEntityNames) {
        const generatedRef = nameToReference(storyEntityName);
        const normalizedGeneratedRef = normalizeRefForComparison(generatedRef);
        if (normalizedGeneratedRef === normalizedRef) {
          actualEntityName = storyEntityName;
          break;
        }
      }
      
      if (actualEntityName) {
        expandedPrompt = expandedPrompt.replace(ref, actualEntityName);
      }
    }
    
    return expandedPrompt;
  } catch (error) {
    console.warn('Failed to expand entity names:', error);
    return prompt;
  }
} */

/**
 * Generate the full prompt with entity references + style that would be sent to Picsart
 */
async function generateFullPicsartPromptForExport(prompt: string, storyData: Story, style: string): Promise<string> {
  try {
    const { parseEntityReferences } = await import('@/app/(app)/assemble-video/utils');
    
    // First expand entity references
    let expandedPrompt = prompt;
    if (storyData.detailsPrompts) {
      expandedPrompt = parseEntityReferences(prompt, storyData);
    }
    
    // Then apply style
    if (style) {
      // Simply append the style string to the expanded prompt
      expandedPrompt = `${expandedPrompt}, ${style}`;
    }
    
    return expandedPrompt;
  } catch (error) {
    console.warn('Failed to generate full Picsart prompt:', error);
    return prompt;
  }
}

/**
 * Generate the full structured prompt that would be sent to Imagen 3
 */
async function generateFullImagenPromptForExport(prompt: string, storyData: Story, style: string): Promise<string> {
  try {
    const { extractEntityNames, nameToReference } = await import('@/app/(app)/assemble-video/utils');
    
    const descriptionParts: string[] = [];
    let actionPromptPart = prompt;
    
    // Helper function to normalize references for robust comparison
    const normalizeRefForComparison = (ref: string): string => {
      if (!ref.startsWith('@')) return ref.toLowerCase().replace(/[^a-z0-9]/g, '');
      return '@' + ref.substring(1).toLowerCase().replace(/[^a-z0-9]/g, '');
    };
    
    if (storyData.detailsPrompts) {
      const entityReferencesInPrompt = Array.from(new Set(prompt.match(/@[A-Za-z0-9_]+/g) || []));
      const { characters, items, locations } = extractEntityNames(storyData);
      
      for (const ref of entityReferencesInPrompt) {
        let actualEntityName: string | null = null;
        let entityType: 'character' | 'item' | 'location' | null = null;
        let descriptionText: string | null = null;
        
        const normalizedRef = normalizeRefForComparison(ref);
        
        // Find the entity with case-insensitive matching
        // Check characters
        for (const storyEntityName of characters) {
          const generatedRef = nameToReference(storyEntityName);
          const normalizedGeneratedRef = normalizeRefForComparison(generatedRef);
          if (normalizedGeneratedRef === normalizedRef) {
            actualEntityName = storyEntityName;
            entityType = 'character';
            break;
          }
        }
        
        // Check items if not found
        if (!actualEntityName) {
          for (const storyEntityName of items) {
            const generatedRef = nameToReference(storyEntityName);
            const normalizedGeneratedRef = normalizeRefForComparison(generatedRef);
            if (normalizedGeneratedRef === normalizedRef) {
              actualEntityName = storyEntityName;
              entityType = 'item';
              break;
            }
          }
        }
        
        // Check locations if not found
        if (!actualEntityName) {
          for (const storyEntityName of locations) {
            const generatedRef = nameToReference(storyEntityName);
            const normalizedGeneratedRef = normalizeRefForComparison(generatedRef);
            if (normalizedGeneratedRef === normalizedRef) {
              actualEntityName = storyEntityName;
              entityType = 'location';
              break;
            }
          }
        }
        
        if (actualEntityName && entityType) {
          // Extract description from the appropriate prompts section
          const promptsSection = entityType === 'character' ? storyData.detailsPrompts.characterPrompts :
                                entityType === 'item' ? storyData.detailsPrompts.itemPrompts :
                                storyData.detailsPrompts.locationPrompts;
          
          if (promptsSection) {
            const escapedEntityName = actualEntityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const entityPattern = new RegExp(`^\\s*${escapedEntityName}\\s*\\n(.*?)(?=\\n\\n|$)`, "ms");
            const entityMatch = promptsSection.match(entityPattern);
            
            if (entityMatch && entityMatch[1]) {
              descriptionText = entityMatch[1].trim();
              descriptionParts.push(`Entity: ${actualEntityName}\nDescription: ${descriptionText}`);
              actionPromptPart = actionPromptPart.replace(ref, actualEntityName);
            }
          }
        }
      }
    }
    
    const structuredPromptParts: string[] = [];
    if (descriptionParts.length > 0) {
      structuredPromptParts.push(descriptionParts.join('\n-----\n'));
    }
    structuredPromptParts.push(actionPromptPart);
    
    let basePrompt = structuredPromptParts.join('\n-----\n');
    
    if (style) {
      basePrompt += `\n-----\nUse the following artistic style:\n${style}`;
    }
    
    return basePrompt;
  } catch (error) {
    console.warn('Failed to generate full Imagen prompt:', error);
    return prompt;
  }
}

/**
 * Add WAV headers to raw PCM data from Google TTS
 * Google TTS returns 24kHz, 16-bit, mono PCM data
 */
function addWavHeadersToBuffer(pcmData: ArrayBuffer): ArrayBuffer {
  const pcmBytes = pcmData.byteLength;
  const sampleRate = 24000; // Google TTS uses 24kHz
  const numChannels = 1; // Mono
  const bitsPerSample = 16; // 16-bit
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  
  // WAV header is 44 bytes
  const headerSize = 44;
  const fileSize = headerSize + pcmBytes;
  
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);
  
  // RIFF header
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, fileSize - 8, true); // File size - 8
  view.setUint32(8, 0x57415645, false); // "WAVE"
  
  // fmt chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // Audio format (1 = PCM)
  view.setUint16(22, numChannels, true); // Number of channels
  view.setUint32(24, sampleRate, true); // Sample rate
  view.setUint32(28, byteRate, true); // Byte rate
  view.setUint16(32, blockAlign, true); // Block align
  view.setUint16(34, bitsPerSample, true); // Bits per sample
  
  // data chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, pcmBytes, true); // Data size
  
  const dataArray = new Uint8Array(buffer, headerSize);
  const pcmArray = new Uint8Array(pcmData);
  dataArray.set(pcmArray);
  
  return buffer;
}

export async function downloadStoryAsZip(storyData: Story) {
  if (!storyData.title) {
    throw new Error('Story must have a title to download');
  }

  console.log('[ZIP] Starting download for story:', {
    title: storyData.title,
    imagePromptsCount: storyData.imagePrompts?.length || 0,
    generatedImagesCount: storyData.generatedImages?.length || 0,
    hasSceneImages: storyData.generatedImages?.some(img => img.sceneIndex !== null && img.sceneIndex !== undefined && img.sceneIndex >= 0)
  });

  const zip = new JSZip();
  
  const fetchFile = async (url: string, isAudio = false): Promise<Blob | null> => {
    // Check if this is a Minio URL that might need special handling
    const isMinioUrl = url.includes('minio-api.holoanima.com');
    
    try {
      if (!url || typeof url !== 'string') {
        console.warn(`[ZIP] Invalid URL provided:`, url);
        return null;
      }
      
      // Validate URL format
      try {
        new URL(url);
      } catch (urlError) {
        console.warn(`[ZIP] Malformed URL:`, url, urlError);
        return null;
      }
      
      console.log(`[ZIP] Fetching ${isAudio ? 'audio' : 'image'} from:`, url);
      
      if (isMinioUrl && !isAudio) {
        console.log(`[ZIP] Detected Minio image URL - will handle content-type detection properly`);
      }
      
      // Add headers for better compatibility - use original URL to preserve Minio signatures
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': isAudio ? 'audio/*' : 'image/*',
        }
      });
      
      if (!response.ok) {
        console.warn(`[ZIP] Failed to fetch file from ${url} - Status: ${response.status} ${response.statusText}`);
        return null;
      }
      
      console.log(`[ZIP] Successfully fetched file, content-type: ${response.headers.get('content-type')}, size: ${response.headers.get('content-length') || 'unknown'}`);
    
      
      if (isAudio) {
        const arrayBuffer = await response.arrayBuffer();
        const view = new Uint8Array(arrayBuffer);
        const isWav = view[0] === 0x52 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x46;
        const isMp3 = (view[0] === 0x49 && view[1] === 0x44 && view[2] === 0x33) || 
                      (view[0] === 0xFF && (view[1] & 0xE0) === 0xE0);
        
        if (isWav) return new Blob([arrayBuffer], { type: 'audio/wav' });
        if (isMp3) return new Blob([arrayBuffer], { type: 'audio/mpeg' });
        
        const wavBuffer = addWavHeadersToBuffer(arrayBuffer);
        return new Blob([wavBuffer], { type: 'audio/wav' });
      } else {
        // For images, ensure proper MIME type detection
        const contentType = response.headers.get('content-type');
        const arrayBuffer = await response.arrayBuffer();
        
        // Always detect image type from file signature for better reliability
        const view = new Uint8Array(arrayBuffer);
        let mimeType = 'application/octet-stream';
        
        // Check for common image signatures
        if (view[0] === 0xFF && view[1] === 0xD8) {
          mimeType = 'image/jpeg';
        } else if (view[0] === 0x89 && view[1] === 0x50 && view[2] === 0x4E && view[3] === 0x47) {
          mimeType = 'image/png';
        } else if (view[0] === 0x47 && view[1] === 0x49 && view[2] === 0x46) {
          mimeType = 'image/gif';
        } else if (view[0] === 0x57 && view[1] === 0x45 && view[2] === 0x42 && view[3] === 0x50) {
          mimeType = 'image/webp';
        } else if (contentType && (contentType.startsWith('image/') || contentType.includes('image'))) {
          // Only use content-type if we can't detect from signature and it claims to be an image
          mimeType = contentType;
        }
        
        console.log(`[ZIP] Detected image type: ${mimeType} from signature (content-type was: ${contentType})`);
        const blob = new Blob([arrayBuffer], { type: mimeType });
        // Add detected MIME type as a property for filename extension detection
        (blob as Blob & { detectedMimeType?: string }).detectedMimeType = mimeType;
        return blob;
      }
    } catch (error) {
      console.warn(`[ZIP] Error fetching file from ${url}:`, error);
      
      // Try a simpler fetch as fallback for images
      if (!isAudio) {
        try {
          console.log(`[ZIP] Trying fallback fetch for image: ${url}`);
          const fallbackResponse = await fetch(url, { mode: 'cors' });
          if (fallbackResponse.ok) {
            const blob = await fallbackResponse.blob();
            console.log(`[ZIP] Fallback fetch successful, blob type: ${blob.type}, size: ${blob.size}`);
            return blob;
          }
        } catch (fallbackError) {
          console.warn(`[ZIP] Fallback fetch also failed:`, fallbackError);
        }
      }
      
      return null;
    }
  };

  const getFilenameFromUrl = (url: string, fallbackName: string): string => {
    try {
      const urlPath = new URL(url).pathname;
      const filename = urlPath.split('/').pop();
      return filename || fallbackName;
    } catch {
      return fallbackName;
    }
  };

  const getFileExtensionFromMimeType = (mimeType: string): string => {
    switch (mimeType) {
      case 'image/jpeg':
        return '.jpg';
      case 'image/png':
        return '.png';
      case 'image/gif':
        return '.gif';
      case 'image/webp':
        return '.webp';
      default:
        return '.jpg'; // fallback to jpg
    }
  };

  const getProperFilename = (url: string, blob: Blob, fallbackName: string): string => {
    const urlFilename = getFilenameFromUrl(url, fallbackName);
    
    // Check if the filename already has an extension
    if (urlFilename.includes('.') && !urlFilename.endsWith('/')) {
      return urlFilename;
    }
    
    // If no extension, add one based on the detected MIME type
    const detectedMimeType = (blob as Blob & { detectedMimeType?: string }).detectedMimeType || blob.type;
    const extension = getFileExtensionFromMimeType(detectedMimeType);
    
    console.log(`[ZIP] Adding extension ${extension} to filename: ${urlFilename} (MIME: ${detectedMimeType})`);
    return urlFilename + extension;
  };

  const charactersImagesFolder = zip.folder('Character_Locations_Items_Images');
  if (charactersImagesFolder && storyData.generatedImages) {
    const detailImages = storyData.generatedImages.filter(image => 
      (image.sceneIndex === undefined || image.sceneIndex < 0) && image.imageUrl
    );
    
    for (let i = 0; i < detailImages.length; i++) {
      const image = detailImages[i];
      try {
        const imageBlob = await fetchFile(image.imageUrl!);
        if (imageBlob && imageBlob.size > 0) {
          const filename = getProperFilename(image.imageUrl!, imageBlob, `detail_${i + 1}.jpg`);
          const safeName = (image.originalPrompt || '').substring(0, 50).replace(/[^a-zA-Z0-9]/g, '_');
          charactersImagesFolder.file(`detail_${i + 1}_${safeName}_${filename}`, imageBlob);
          console.log(`[ZIP] Successfully added detail image ${i + 1} (${imageBlob.size} bytes)`);
        } else {
          console.warn(`[ZIP] Failed to fetch or empty detail image ${i + 1}`);
        }
      } catch (error) {
        console.error(`[ZIP] Error processing detail image ${i + 1}:`, error);
      }
    }
  }

  const charactersPromptsFolder = zip.folder('Character_Locations_Items_Prompts');
  if (charactersPromptsFolder && storyData.detailsPrompts) {
    let detailPromptsText = '=== STORY DETAILS PROMPTS ===\n\n';
    if (storyData.detailsPrompts.characterPrompts) {
      detailPromptsText += '=== CHARACTER PROMPTS ===\n\n' + storyData.detailsPrompts.characterPrompts + '\n\n';
    }
    if (storyData.detailsPrompts.locationPrompts) {
      detailPromptsText += '=== LOCATION PROMPTS ===\n\n' + storyData.detailsPrompts.locationPrompts + '\n\n';
    }
    if (storyData.detailsPrompts.itemPrompts) {
      detailPromptsText += '=== ITEM PROMPTS ===\n\n' + storyData.detailsPrompts.itemPrompts + '\n\n';
    }
    charactersPromptsFolder.file('character_locations_items_prompts.txt', detailPromptsText);
  }

  const sceneImagesFolder = zip.folder('Scene_Images');
  if (sceneImagesFolder && storyData.imagePrompts && storyData.generatedImages) {
    // Create a map of sceneIndex to GeneratedImage for quick lookup and ensure we only get one image per sceneIndex
    const sceneImagesMap = new Map<number, GeneratedImage>();
    
    // First, let's debug what images we have
    console.log('[ZIP] All generated images:', storyData.generatedImages.map(img => ({
      sceneIndex: img.sceneIndex,
      hasUrl: !!img.imageUrl,
      prompt: img.originalPrompt?.substring(0, 50),
      url: img.imageUrl?.substring(0, 100)
    })));
    
    storyData.generatedImages.forEach(img => {
      // Use explicit null check - sceneIndex can be 0 which is falsy but valid
      if (img.sceneIndex !== null && img.sceneIndex !== undefined && img.sceneIndex >= 0 && img.imageUrl) {
        console.log(`[ZIP] Mapping scene ${img.sceneIndex} to image: ${img.originalPrompt?.substring(0, 50)}...`);
        // If an image for this sceneIndex already exists, this logic will take the last one encountered,
        // which should be the most recent if array is ordered by generation or update time.
        sceneImagesMap.set(img.sceneIndex, img);
      }
    });

    console.log(`[ZIP] Found ${sceneImagesMap.size} actual scene images for ${storyData.imagePrompts.length} total scenes`);

    // Only process scenes that actually have generated images - don't create fake ones
    for (const [sceneIdx, imageForScene] of sceneImagesMap.entries()) {
      try {
        const imageBlob = await fetchFile(imageForScene.imageUrl);
        if (imageBlob && imageBlob.size > 0) {
          const baseFilename = getProperFilename(imageForScene.imageUrl, imageBlob, `scene_${sceneIdx + 1}.jpg`);
          const chapterInfo = imageForScene.chapterNumber ? `_chapter_${imageForScene.chapterNumber}` : '';
          sceneImagesFolder.file(`scene_${sceneIdx + 1}${chapterInfo}_${baseFilename}`, imageBlob);
          console.log(`[ZIP] Successfully added scene ${sceneIdx + 1} image (${imageBlob.size} bytes)`);
        } else {
          console.warn(`[ZIP] Failed to fetch or empty image for scene ${sceneIdx + 1}`);
        }
      } catch (error) {
        console.error(`[ZIP] Error processing image for scene ${sceneIdx + 1}:`, error);
      }
    }
    
    console.log(`[ZIP] Added ${sceneImagesMap.size} actual scene images (no fake ones created)`);
    
    if (sceneImagesMap.size < storyData.imagePrompts.length) {
      console.log(`[ZIP] Note: Story has ${storyData.imagePrompts.length} image prompts but only ${sceneImagesMap.size} generated scene images`);
    }
  }

  const scenePromptsFolder = zip.folder('Scene_Prompts');
  if (scenePromptsFolder && storyData.imagePrompts) {
    let scenePromptsText = '=== SCENE IMAGE PROMPTS ===\n\n';
    
    for (let index = 0; index < storyData.imagePrompts.length; index++) {
      const prompt = storyData.imagePrompts[index];
      
      // Find narration chunk number for this scene
      const relatedActionPrompt = storyData.actionPrompts?.find(ap => ap.sceneIndex === index);
      const chunkNumber = relatedActionPrompt?.chunkIndex !== undefined ? relatedActionPrompt.chunkIndex + 1 : 'N/A';
      
      scenePromptsText += `Scene ${index + 1}:\n`;
      scenePromptsText += `Narration Chunk ${chunkNumber}\n`;
      scenePromptsText += `Original Prompt: ${prompt}\n`;
      scenePromptsText += `********************\n`;
      
      // Always generate the COMPLETE prompts that get sent to each AI
      try {
        let picsartExpanded = prompt;
        let imagenExpanded = prompt;
        
        if (storyData.detailsPrompts) {
          // Get style for both providers
          let picsartStyle = '';
          let imagenStyle = '';
          
          if (storyData.imageStyleId && storyData.imageStyleId !== 'undefined' && storyData.imageStyleId !== 'null') {
            const { getStylePromptForProvider } = await import('@/utils/imageStyleUtils');
            picsartStyle = getStylePromptForProvider(storyData.imageStyleId, 'picsart');
            imagenStyle = getStylePromptForProvider(storyData.imageStyleId, 'imagen3');
          } else {
            // Use default style
            const { getStylePromptForProvider } = await import('@/utils/imageStyleUtils');
            picsartStyle = getStylePromptForProvider(undefined, 'picsart');
            imagenStyle = getStylePromptForProvider(undefined, 'imagen3');
          }
          
          // For Picsart: Generate the complete prompt with entity descriptions + style (what actually gets sent to Picsart API)
          picsartExpanded = await generateFullPicsartPromptForExport(prompt, storyData, picsartStyle);
          
          // For Imagen 3: Generate the complete structured prompt (what actually gets sent to Imagen3 API)
          imagenExpanded = await generateFullImagenPromptForExport(prompt, storyData, imagenStyle);
        }
        
        scenePromptsText += `Picsart Expanded Prompt: ${picsartExpanded}\n`;
        scenePromptsText += `********************\n`;
        scenePromptsText += `Imagen 3 Expanded Prompt: \n${imagenExpanded}\n`;
      } catch (error) {
        console.warn('Failed to generate expanded prompts for export:', error);
        scenePromptsText += `Note: Could not generate expanded prompts. Original prompt preserved above.\n`;
      }
      

      scenePromptsText += '\n';
    }
    
    scenePromptsFolder.file('scene_image_prompts.txt', scenePromptsText);
  }

  const actionPromptsFolder = zip.folder('Action_prompts');
  if (actionPromptsFolder && storyData.actionPrompts && storyData.actionPrompts.length > 0) {
    let actionPromptsText = '=== ACTION PROMPTS ===\n\n';
    let actionPromptsOnlyText = '=== ACTION PROMPTS  ONLY===\n\n';
    
    // Sort action prompts by sceneIndex to ensure correct order in the text file
    const sortedActionPrompts = [...storyData.actionPrompts].sort((a, b) => (a.sceneIndex || 0) - (b.sceneIndex || 0));
    
    sortedActionPrompts.forEach((prompt) => {
      const chunkNumber = prompt.chunkIndex !== undefined ? prompt.chunkIndex + 1 : 'N/A';
      const sceneNumber = prompt.sceneIndex !== undefined ? prompt.sceneIndex + 1 : 'N/A';
      
      // Original format for action_prompts.txt
      actionPromptsText += `Scene ${sceneNumber}:\nAction: ${prompt.actionDescription}\nOriginal Prompt: ${prompt.originalPrompt}\nNarration Chunk ${chunkNumber}: ${prompt.chunkText}\n\n`;
      
      // New format for action_prompt_only.txt - just scene number and action description
      actionPromptsOnlyText += `Scene ${sceneNumber}:\n${prompt.actionDescription}\n\n`;
    });
    
    actionPromptsFolder.file('action_prompts.txt', actionPromptsText);
    actionPromptsFolder.file('action_prompt_only.txt', actionPromptsOnlyText);
    
    console.log('[ZIP] Added both action_prompts.txt and action_prompt_only.txt files');
  }

  const sceneAudioFolder = zip.folder('Scene_Audio');
  if (sceneAudioFolder && storyData.narrationChunks) {
    for (let i = 0; i < storyData.narrationChunks.length; i++) {
      const chunk = storyData.narrationChunks[i];
      if (chunk.audioUrl) {
        try {
          const audioBlob = await fetchFile(chunk.audioUrl, true);
          if (audioBlob && audioBlob.size > 0) {
            const extension = audioBlob.type === 'audio/mpeg' ? 'mp3' : 'wav';
            sceneAudioFolder.file(`chunk_${chunk.index !== undefined ? chunk.index + 1 : i + 1}.${extension}`, audioBlob);
            console.log(`[ZIP] Successfully added audio chunk ${i + 1} (${audioBlob.size} bytes)`);
          } else {
            console.warn(`[ZIP] Failed to fetch or empty audio chunk ${i + 1}`);
          }
        } catch (error) {
          console.error(`[ZIP] Error processing audio chunk ${i + 1}:`, error);
        }
      }
    }
  }

  if (sceneAudioFolder && storyData.narrationAudioUrl) {
    try {
      const mainAudioBlob = await fetchFile(storyData.narrationAudioUrl, true);
      if (mainAudioBlob && mainAudioBlob.size > 0) {
        const extension = mainAudioBlob.type === 'audio/mpeg' ? 'mp3' : 'wav';
        sceneAudioFolder.file(`full_narration.${extension}`, mainAudioBlob);
        console.log(`[ZIP] Successfully added full narration (${mainAudioBlob.size} bytes)`);
      } else {
        console.warn(`[ZIP] Failed to fetch or empty full narration audio`);
      }
    } catch (error) {
      console.error(`[ZIP] Error processing full narration audio:`, error);
    }
  }

  const storyTextFolder = zip.folder('Story_Text');
  if (storyTextFolder) {
    if (storyData.generatedScript) {
      storyTextFolder.file('story_script.txt', storyData.generatedScript);
    }
    if (storyData.narrationChunks && storyData.narrationChunks.length > 0) {
      let chunksText = '=== AUDIO CHUNKS ===\n\n';
      storyData.narrationChunks.forEach((chunk, index) => {
        chunksText += `Chunk ${chunk.index !== undefined ? chunk.index + 1 : index + 1}:\n${chunk.text}\n\n`;
      });
      storyTextFolder.file('audio_chunks.txt', chunksText);
    }
    if (storyData.userPrompt) {
      storyTextFolder.file('initial_prompt.txt', storyData.userPrompt);
    }
  }

  const toolsUsedFolder = zip.folder('Tools_Used');
  if (toolsUsedFolder) {
    let toolsInfo = '=== AI TOOLS USED ===\n\n';
    
    // Audio Generation Details
    if (storyData.narrationAudioUrl || storyData.narrationChunks) {
      toolsInfo += '=== AUDIO GENERATION ===\n';
      
      // Use the tracked service (now properly saved) or fallback to detection
      const audioService = storyData.audioGenerationService || 
        (storyData.elevenLabsVoiceId && !storyData.narrationVoice ? 'elevenlabs' : 'google');
      
      if (audioService === 'elevenlabs') {
        toolsInfo += `Service: ElevenLabs\n`;
        toolsInfo += `Voice ID: ${storyData.elevenLabsVoiceId || storyData.narrationVoice}\n`;
        toolsInfo += `Model: ${storyData.audioModel || 'Eleven Turbo v2.5'}\n`;
        toolsInfo += `Output Format: MP3 (44.1kHz)\n\n`;
      } else if (audioService === 'google') {
        toolsInfo += `Service: Google Text-to-Speech\n`;
        toolsInfo += `Voice: ${storyData.narrationVoice || storyData.elevenLabsVoiceId}\n`;
        toolsInfo += `Model: ${storyData.audioModel || 'Unknown Google TTS Model'}\n`;
        toolsInfo += `Output Format: WAV (24kHz, 16-bit)\n\n`;
      } else {
        toolsInfo += `Service: Unknown\n`;
        if (storyData.narrationVoice) toolsInfo += `Voice: ${storyData.narrationVoice}\n`;
        if (storyData.elevenLabsVoiceId) toolsInfo += `Voice ID: ${storyData.elevenLabsVoiceId}\n`;
        toolsInfo += `Output Format: Audio file generated\n\n`;
      }
    }
    
    // Image Generation Details
    if (storyData.generatedImages && storyData.generatedImages.length > 0) {
      // Check for character/location/item images
      const detailImages = storyData.generatedImages.filter(image => 
        (image.sceneIndex === undefined || image.sceneIndex < 0)
      );
      
      // Check for scene images  
      const sceneImages = storyData.generatedImages.filter(image => 
        image.sceneIndex !== undefined && image.sceneIndex >= 0
      );
      
      if (detailImages.length > 0) {
        toolsInfo += '=== CHARACTER/LOCATION/ITEM IMAGE GENERATION ===\n';
        
        // Use tracked provider (now properly saved) or fallback
        const detailService = storyData.detailImageProvider || storyData.imageProvider || 'Unknown';
        const detailModel = storyData.detailImageModel || 
          (detailService === 'picsart' ? 'Picsart AI Image Generator' : 
           detailService === 'imagen3' ? 'Google Imagen 3' : 'Unknown');
        
        toolsInfo += `Service: ${detailService.charAt(0).toUpperCase() + detailService.slice(1)}\n`;
        toolsInfo += `Model: ${detailModel}\n`;
        
        toolsInfo += `Images Generated: ${detailImages.length}\n`;
        if(storyData.imageStyleId) toolsInfo += `Style ID: ${storyData.imageStyleId}\n`;
        
        // Get actual dimensions from the first image if available
        const firstDetailImage = detailImages[0];
        if (firstDetailImage?.width && firstDetailImage?.height) {
          toolsInfo += `Output Format: JPEG/PNG (${firstDetailImage.width}×${firstDetailImage.height})\n\n`;
        } else {
          toolsInfo += `Output Format: JPEG/PNG\n\n`;
        }
      }
      
      if (sceneImages.length > 0) {
        toolsInfo += '=== SCENE IMAGE GENERATION ===\n';
        
        // Use tracked provider (now properly saved) or fallback
        const sceneService = storyData.sceneImageProvider || storyData.imageProvider || 'Unknown';
        const sceneModel = storyData.sceneImageModel || 
          (sceneService === 'picsart' ? 'Picsart AI Image Generator' : 
           sceneService === 'imagen3' ? 'Google Imagen 3' : 'Unknown');
        
        toolsInfo += `Service: ${sceneService.charAt(0).toUpperCase() + sceneService.slice(1)}\n`;
        toolsInfo += `Model: ${sceneModel}\n`;
        
        toolsInfo += `Images Generated: ${sceneImages.length}\n`;
        if(storyData.imageStyleId) toolsInfo += `Style ID: ${storyData.imageStyleId}\n`;
        
        // Get actual dimensions from the first scene image if available
        const firstSceneImage = sceneImages[0];
        if (firstSceneImage?.width && firstSceneImage?.height) {
          toolsInfo += `Output Format: JPEG/PNG (${firstSceneImage.width}×${firstSceneImage.height})\n\n`;
        } else {
          toolsInfo += `Output Format: JPEG/PNG\n\n`;
        }
      }
    }
    
    // Story Generation Details
    toolsInfo += '=== STORY GENERATION ===\n';
    toolsInfo += `Service: Google Gemini (via Firebase Genkit)\n`;
    
    if (storyData.googleScriptModel) {
      toolsInfo += `Model: ${storyData.googleScriptModel}\n`;
    } else {
      toolsInfo += `Model: gemini-2.0-flash-exp\n`;
    }
    
    if (storyData.aiProvider === 'perplexity' && storyData.perplexityModel) {
      toolsInfo += `\n=== ALTERNATIVE STORY GENERATION ===\n`;
      toolsInfo += `Service: Perplexity AI\n`;
      toolsInfo += `Model: ${storyData.perplexityModel}\n`;
    }
    
    toolsInfo += '\n';
    toolsUsedFolder.file('ai_tools_details.txt', toolsInfo);
  }

  try {
    console.log('[ZIP] Starting ZIP file generation...');
    const content = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 6
      }
    });
    
    console.log(`[ZIP] ZIP file generated successfully, size: ${content.size} bytes`);
    
    if (content.size === 0) {
      throw new Error('Generated ZIP file is empty');
    }
    
    const url = window.URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${storyData.title.replace(/[^a-zA-Z0-9]/g, '_')}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    console.log('[ZIP] Download initiated successfully');
  } catch (error) {
    console.error('[ZIP] Error generating or downloading ZIP file:', error);
    throw new Error(`Failed to create ZIP file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
