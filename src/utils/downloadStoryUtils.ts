import JSZip from 'jszip';
import { Story } from '@/types/story';

export async function downloadStoryAsZip(storyData: Story) {
  if (!storyData.title) {
    throw new Error('Story must have a title to download');
  }

  const zip = new JSZip();
  
  // Helper function to safely fetch file from URL
  const fetchFile = async (url: string): Promise<Blob | null> => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`Failed to fetch file from ${url}`);
        return null;
      }
      return await response.blob();
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
  if (sceneImagesFolder && storyData.generatedImages) {
    // Filter for scene images - these are images whose originalPrompt matches the imagePrompts array
    const scenePrompts = storyData.imagePrompts || [];
    const sceneImages = storyData.generatedImages.filter(image => 
      image.originalPrompt && scenePrompts.includes(image.originalPrompt)
    );
    
    for (let i = 0; i < sceneImages.length; i++) {
      const image = sceneImages[i];
      if (image.imageUrl) {
        const imageBlob = await fetchFile(image.imageUrl);
        if (imageBlob) {
          const filename = getFilenameFromUrl(image.imageUrl, `scene_${i + 1}.jpg`);
          const chapterInfo = image.chapterNumber ? `_chapter_${image.chapterNumber}` : '';
          sceneImagesFolder.file(`scene_${i + 1}${chapterInfo}_${filename}`, imageBlob);
        }
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

  // 5. Scene_Audio folder
  const sceneAudioFolder = zip.folder('Scene_Audio');
  if (sceneAudioFolder && storyData.narrationChunks) {
    for (let i = 0; i < storyData.narrationChunks.length; i++) {
      const chunk = storyData.narrationChunks[i];
      if (chunk.audioUrl) {
        const audioBlob = await fetchFile(chunk.audioUrl);
        if (audioBlob) {
          const filename = getFilenameFromUrl(chunk.audioUrl, `chunk_${i + 1}.mp3`);
          sceneAudioFolder.file(`chunk_${i + 1}_${filename}`, audioBlob);
        }
      }
    }
  }

  // Add main narration audio if exists
  if (sceneAudioFolder && storyData.narrationAudioUrl) {
    const mainAudioBlob = await fetchFile(storyData.narrationAudioUrl);
    if (mainAudioBlob) {
      const filename = getFilenameFromUrl(storyData.narrationAudioUrl, 'full_narration.mp3');
      sceneAudioFolder.file(`full_narration_${filename}`, mainAudioBlob);
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
