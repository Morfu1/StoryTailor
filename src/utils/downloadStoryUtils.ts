
import JSZip from 'jszip';
import { Story, GeneratedImage } from '@/types/story'; // Added GeneratedImage

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

  const zip = new JSZip();
  
  const fetchFile = async (url: string, isAudio = false): Promise<Blob | null> => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`Failed to fetch file from ${url}`);
        return null;
      }
      
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
        return await response.blob();
      }
    } catch (error) {
      console.warn(`Error fetching file from ${url}:`, error);
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

  const charactersImagesFolder = zip.folder('Character_Locations_Items_Images');
  if (charactersImagesFolder && storyData.generatedImages) {
    const detailImages = storyData.generatedImages.filter(image => 
      (image.sceneIndex === undefined || image.sceneIndex < 0) && image.imageUrl
    );
    
    for (let i = 0; i < detailImages.length; i++) {
      const image = detailImages[i];
      const imageBlob = await fetchFile(image.imageUrl!);
      if (imageBlob) {
        const filename = getFilenameFromUrl(image.imageUrl!, `detail_${i + 1}.jpg`);
        const safeName = image.originalPrompt.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '_');
        charactersImagesFolder.file(`detail_${i + 1}_${safeName}_${filename}`, imageBlob);
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
    storyData.generatedImages.forEach(img => {
      if (img.sceneIndex !== undefined && img.sceneIndex >= 0 && img.imageUrl) {
        // If an image for this sceneIndex already exists, this logic will take the last one encountered,
        // which should be the most recent if array is ordered by generation or update time.
        sceneImagesMap.set(img.sceneIndex, img);
      }
    });

    for (let sceneIdx = 0; sceneIdx < storyData.imagePrompts.length; sceneIdx++) {
      const imageForScene = sceneImagesMap.get(sceneIdx);
      if (imageForScene) {
        const imageBlob = await fetchFile(imageForScene.imageUrl);
        if (imageBlob) {
          const baseFilename = getFilenameFromUrl(imageForScene.imageUrl, `image.jpg`);
          const chapterInfo = imageForScene.chapterNumber ? `_chapter_${imageForScene.chapterNumber}` : '';
          sceneImagesFolder.file(`scene_${sceneIdx + 1}${chapterInfo}_${baseFilename}`, imageBlob);
        }
      } else {
        console.warn(`[DownloadZip] No image found for scene index ${sceneIdx}.`);
      }
    }
  }

  const scenePromptsFolder = zip.folder('Scene_Prompts');
  if (scenePromptsFolder && storyData.imagePrompts) {
    let scenePromptsText = '=== SCENE IMAGE PROMPTS ===\n\n';
    storyData.imagePrompts.forEach((prompt: string, index: number) => {
      scenePromptsText += `Scene ${index + 1}:\n${prompt}\n\n`;
    });
    scenePromptsFolder.file('scene_image_prompts.txt', scenePromptsText);
  }

  const actionPromptsFolder = zip.folder('Action_prompts');
  if (actionPromptsFolder && storyData.actionPrompts && storyData.actionPrompts.length > 0) {
    let actionPromptsText = '=== ACTION PROMPTS ===\n\n';
    // Sort action prompts by sceneIndex to ensure correct order in the text file
    const sortedActionPrompts = [...storyData.actionPrompts].sort((a, b) => (a.sceneIndex || 0) - (b.sceneIndex || 0));
    sortedActionPrompts.forEach((prompt) => {
      actionPromptsText += `Scene ${prompt.sceneIndex !== undefined ? prompt.sceneIndex + 1 : 'N/A'}:\nAction: ${prompt.actionDescription}\nOriginal Prompt: ${prompt.originalPrompt}\nNarration Chunk: ${prompt.chunkText}\n\n`;
    });
    actionPromptsFolder.file('action_prompts.txt', actionPromptsText);
  }

  const sceneAudioFolder = zip.folder('Scene_Audio');
  if (sceneAudioFolder && storyData.narrationChunks) {
    for (let i = 0; i < storyData.narrationChunks.length; i++) {
      const chunk = storyData.narrationChunks[i];
      if (chunk.audioUrl) {
        const audioBlob = await fetchFile(chunk.audioUrl, true);
        if (audioBlob) {
          const extension = audioBlob.type === 'audio/mpeg' ? 'mp3' : 'wav';
          sceneAudioFolder.file(`chunk_${chunk.index !== undefined ? chunk.index + 1 : i + 1}.${extension}`, audioBlob);
        }
      }
    }
  }

  if (sceneAudioFolder && storyData.narrationAudioUrl) {
    const mainAudioBlob = await fetchFile(storyData.narrationAudioUrl, true);
    if (mainAudioBlob) {
      const extension = mainAudioBlob.type === 'audio/mpeg' ? 'mp3' : 'wav';
      sceneAudioFolder.file(`full_narration.${extension}`, mainAudioBlob);
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
    if (storyData.elevenLabsVoiceId || (storyData.narrationVoice && storyData.narrationVoice.toLowerCase().includes('google'))) {
      toolsInfo += '=== AUDIO GENERATION ===\n';
      toolsInfo += `Service: ${storyData.elevenLabsVoiceId ? 'ElevenLabs' : 'Google TTS'}\n`;
      if(storyData.elevenLabsVoiceId) toolsInfo += `Voice ID: ${storyData.elevenLabsVoiceId}\n`;
      if(storyData.narrationVoice && storyData.narrationVoice.toLowerCase().includes('google')) toolsInfo += `Voice Name: ${storyData.narrationVoice}\n`;
      toolsInfo += 'Format: MP3 or WAV\n\n';
    }
    if (storyData.imageProvider) {
      toolsInfo += '=== IMAGE GENERATION ===\n';
      toolsInfo += `Service: ${storyData.imageProvider}\n`;
      if(storyData.imageStyleId) toolsInfo += `Style ID: ${storyData.imageStyleId}\n`;
      toolsInfo += 'Format: PNG/JPEG\n\n';
    }
    toolsInfo += '=== STORY GENERATION ===\nService: Google Gemini (via Genkit)\nModel: gemini-1.5-flash (or equivalent based on implementation)\n\n';
    toolsUsedFolder.file('ai_tools_details.txt', toolsInfo);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const url = window.URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${storyData.title.replace(/[^a-zA-Z0-9]/g, '_')}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
