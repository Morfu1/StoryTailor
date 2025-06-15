import type { Story } from '@/types/story';

export const initialStoryState: Story = {
  userId: '',
  title: '',
  userPrompt: '',
  generatedScript: undefined,
  detailsPrompts: undefined,
  narrationAudioUrl: undefined,
  narrationAudioDurationSeconds: undefined,
  elevenLabsVoiceId: undefined,
  imagePrompts: [],
  generatedImages: [],
  scriptChunks: [], // Initialize
  narrationChunks: [], // Initialize
  // Step 1: Script generation model selections
  aiProvider: 'google',
  perplexityModel: 'sonar-reasoning-pro', // Updated default Perplexity model
  googleScriptModel: 'gemini-2.5-flash-preview-05-20', // Default Google script model
  
  // Step 3: TTS model selections
  selectedTtsModel: 'google', // Default to Google TTS
  selectedGoogleTtsModel: 'gemini-2.5-flash-preview-tts', // Default Google TTS model
  
  // Step 4: Image generation model selections
  imageProvider: 'picsart', // Default image provider
};
