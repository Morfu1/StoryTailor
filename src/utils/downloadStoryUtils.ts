import JSZip from 'jszip';
import { Story } from '@/types/story';

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
  
  // Copy PCM data
  const headerArray = new Uint8Array(buffer, 0, headerSize);
  const dataArray = new Uint8Array(buffer, headerSize);
  const pcmArray = new Uint8Array(pcmData);
  dataArray.set(pcmArray);
  
  return buffer;
}

export async function downloadStoryAsZip(storyData: Story) {
  if (!storyData.title) {
    throw new Error('Story must have a title to download');
  }

  const zip = new JSZip();
  
  // Helper function to safely fetch file from URL
  const fetchFile = async (url: string, isAudio = false): Promise<Blob | null> => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`Failed to fetch file from ${url}`);
        return null;
      }
      
      if (isAudio) {
        // Handle audio files - check if it's raw PCM from Google TTS or complete file from ElevenLabs
        const arrayBuffer = await response.arrayBuffer();
        const view = new Uint8Array(arrayBuffer);
        
        // Check for WAV header (RIFF)
        const isWav = view[0] === 0x52 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x46;
        
        // Check for MP3 header (ID3 tag or MP3 frame sync)
        const isMp3 = (view[0] === 0x49 && view[1] === 0x44 && view[2] === 0x33) || // ID3 tag
                      (view[0] === 0xFF && (view[1] & 0xE0) === 0xE0); // MP3 frame sync
        
        if (isWav) {
          // Already a complete WAV file
          return new Blob([arrayBuffer], { type: 'audio/wav' });
        } else if (isMp3) {
          // Complete MP3 file from ElevenLabs - return as is
          return new Blob([arrayBuffer], { type: 'audio/mpeg' });
        } else {
          // This is raw PCM data from Google TTS, add WAV headers
          console.log('Converting raw PCM data from Google TTS to WAV format for download');
          const wavBuffer = addWavHeadersToBuffer(arrayBuffer);
          return new Blob([wavBuffer], { type: 'audio/wav' });
        }
      } else {
        return await response.blob();
      }
    } catch (error) {
      console.warn(`Error fetching file from ${url}:`, error);
      return null;
    }
  };

  // Helper function to extract filename from URL
  const getFilenameFromUrl = (url: string, fallbackName: string): string => {
    try {
      const urlPath = new URL(url).pathname;
      const filename = urlPath.split('/').pop();
      return filename || fallbackName;
    } catch {
      return fallbackName;
    }
  };

  // 1. Character_Locations_Items_Images folder
  const charactersImagesFolder = zip.folder('Character_Locations_Items_Images');
  
  // Filter for detail images (character/location/item images)
  // These are images whose originalPrompt is NOT in the imagePrompts array (scene prompts)
  if (charactersImagesFolder && storyData.generatedImages) {
    const scenePrompts = storyData.imagePrompts || [];
    const detailImages = storyData.generatedImages.filter(image => 
      image.originalPrompt && !scenePrompts.includes(image.originalPrompt)
    );
    
    for (let i = 0; i < detailImages.length; i++) {
      const image = detailImages[i];
      if (image.imageUrl) {
        const imageBlob = await fetchFile(image.imageUrl);
        if (imageBlob) {
          const filename = getFilenameFromUrl(image.imageUrl, `detail_${i + 1}.jpg`);
          const safeName = image.originalPrompt.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '_');
          charactersImagesFolder.file(`detail_${i + 1}_${safeName}_${filename}`, imageBlob);
        }
      }
    }
  }

  // 2. Character_Locations_Items_Prompts folder
  const charactersPromptsFolder = zip.folder('Character_Locations_Items_Prompts');
  if (charactersPromptsFolder && storyData.detailsPrompts) {
    let detailPrompts = '=== STORY DETAILS PROMPTS ===\n\n';
    
    if (storyData.detailsPrompts.characterPrompts) {
      detailPrompts += '=== CHARACTER PROMPTS ===\n\n';
      detailPrompts += storyData.detailsPrompts.characterPrompts + '\n\n';
    }

    if (storyData.detailsPrompts.locationPrompts) {
      detailPrompts += '=== LOCATION PROMPTS ===\n\n';
      detailPrompts += storyData.detailsPrompts.locationPrompts + '\n\n';
    }

    if (storyData.detailsPrompts.itemPrompts) {
      detailPrompts += '=== ITEM PROMPTS ===\n\n';
      detailPrompts += storyData.detailsPrompts.itemPrompts + '\n\n';
    }

    charactersPromptsFolder.file('character_locations_items_prompts.txt', detailPrompts);
  }

  // 3. Scene_Images folder
  const sceneImagesFolder = zip.folder('Scene_Images');
  if (sceneImagesFolder && storyData.imagePrompts && storyData.generatedImages) {
    const allGeneratedImages = storyData.generatedImages;

    for (let sceneIndex = 0; sceneIndex < storyData.imagePrompts.length; sceneIndex++) {
      const currentScenePrompt = storyData.imagePrompts[sceneIndex];
      
      // Find the image that matches this specific scene prompt.
      // This assumes that 'originalPrompt' on a GeneratedImage is the main scene prompt from Step 4.
      const imageForScene = allGeneratedImages.find(img => img.originalPrompt === currentScenePrompt);

      if (imageForScene && imageForScene.imageUrl) {
        const imageBlob = await fetchFile(imageForScene.imageUrl);
        if (imageBlob) {
          const baseFilename = getFilenameFromUrl(imageForScene.imageUrl, `image.jpg`);
          const chapterInfo = imageForScene.chapterNumber ? `_chapter_${imageForScene.chapterNumber}` : '';
          // Use sceneIndex + 1 for 1-based scene numbering in filename, ensuring correct order
          sceneImagesFolder.file(`scene_${sceneIndex + 1}${chapterInfo}_${baseFilename}`, imageBlob);
        }
      } else {
        // Log a warning if an image for a specific scene prompt isn't found.
        // This helps in debugging but doesn't stop the zip creation for other available images.
        console.warn(`[DownloadZip] No image found for scene ${sceneIndex + 1} (prompt: "${currentScenePrompt.substring(0, 50)}...")`);
      }
    }
  }

  // 4. Scene_Prompts folder
  const scenePromptsFolder = zip.folder('Scene_Prompts');
  if (scenePromptsFolder && storyData.imagePrompts) {
    let scenePrompts = '=== SCENE IMAGE PROMPTS ===\n\n';
    storyData.imagePrompts.forEach((prompt: string, index: number) => {
      scenePrompts += `Scene ${index + 1}:\n${prompt}\n\n`;
    });
    scenePromptsFolder.file('scene_image_prompts.txt', scenePrompts);
  }

  // NEW: Action_Prompts folder
  const actionPromptsFolder = zip.folder('Action_prompts');
  if (actionPromptsFolder && storyData.actionPrompts && storyData.actionPrompts.length > 0) {
    let actionPromptsText = '=== ACTION PROMPTS ===\n\n';
    storyData.actionPrompts.forEach((prompt, index) => {
      // Assuming sceneIndex in ActionPrompt is 0-based, so adding 1 for display
      // Or if actionPrompts are already ordered, use the loop index.
      // The ActionPrompt interface has sceneIndex, let's use that if available and reliable,
      // otherwise, the array index + 1 is a good fallback.
      // For now, using index + 1 as a simple approach.
      actionPromptsText += `Scene ${prompt.sceneIndex !== undefined ? prompt.sceneIndex + 1 : index + 1}:\n${prompt.actionDescription}\n\n`;
    });
    actionPromptsFolder.file('action_prompts.txt', actionPromptsText);
  }

  // 5. Scene_Audio folder
  const sceneAudioFolder = zip.folder('Scene_Audio');
  if (sceneAudioFolder && storyData.narrationChunks) {
    for (let i = 0; i < storyData.narrationChunks.length; i++) {
      const chunk = storyData.narrationChunks[i];
      if (chunk.audioUrl) {
        const audioBlob = await fetchFile(chunk.audioUrl, true);
        if (audioBlob) {
          // Use appropriate extension based on the blob type
          const extension = audioBlob.type === 'audio/mpeg' ? 'mp3' : 'wav';
          sceneAudioFolder.file(`chunk_${i + 1}.${extension}`, audioBlob);
        }
      }
    }
  }

  // Add main narration audio if exists
  if (sceneAudioFolder && storyData.narrationAudioUrl) {
    const mainAudioBlob = await fetchFile(storyData.narrationAudioUrl, true);
    if (mainAudioBlob) {
      // Use appropriate extension based on the blob type
      const extension = mainAudioBlob.type === 'audio/mpeg' ? 'mp3' : 'wav';
      sceneAudioFolder.file(`full_narration.${extension}`, mainAudioBlob);
    }
  }

  // 6. Story_Text folder
  const storyTextFolder = zip.folder('Story_Text');
  if (storyTextFolder) {
    // Main story text
    if (storyData.generatedScript) {
      storyTextFolder.file('story_script.txt', storyData.generatedScript);
    }

    // Audio chunks text
    if (storyData.narrationChunks && storyData.narrationChunks.length > 0) {
      let chunksText = '=== AUDIO CHUNKS ===\n\n';
      storyData.narrationChunks.forEach((chunk: any, index: number) => {
        chunksText += `Chunk ${index + 1}:\n${chunk.text}\n\n`;
      });
      storyTextFolder.file('audio_chunks.txt', chunksText);
    }

    // Initial prompt
    if (storyData.userPrompt) {
      storyTextFolder.file('initial_prompt.txt', storyData.userPrompt);
    }
  }

  // 7. Tools_Used folder
  const toolsUsedFolder = zip.folder('Tools_Used');
  if (toolsUsedFolder) {
    let toolsInfo = '=== AI TOOLS USED ===\n\n';

    // Audio AI details
    if (storyData.elevenLabsVoiceId) {
      toolsInfo += '=== AUDIO GENERATION ===\n';
      toolsInfo += 'Service: ElevenLabs\n';
      toolsInfo += `Voice ID: ${storyData.elevenLabsVoiceId}\n`;
      toolsInfo += 'Language: English\n';
      toolsInfo += 'Format: MP3\n\n';
    }

    // Image AI details
    if (storyData.generatedImages && storyData.generatedImages.length > 0) {
      toolsInfo += '=== IMAGE GENERATION ===\n';
      toolsInfo += 'Service: Flux (via Replicate)\n';
      toolsInfo += 'Model: flux-schnell\n';
      toolsInfo += 'Format: JPEG\n';
      toolsInfo += 'Resolution: 1024x1024\n\n';
    }

    // Story generation details
    toolsInfo += '=== STORY GENERATION ===\n';
    toolsInfo += 'Service: Google Gemini (via Genkit)\n';
    toolsInfo += 'Model: gemini-1.5-flash\n\n';

    toolsUsedFolder.file('ai_tools_details.txt', toolsInfo);
  }

  // Generate and download the zip file
  const content = await zip.generateAsync({ type: 'blob' });
  
  // Create download link
  const url = window.URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${storyData.title.replace(/[^a-zA-Z0-9]/g, '_')}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
