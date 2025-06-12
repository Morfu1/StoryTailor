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
  aiProvider: 'google',
  perplexityModel: 'sonar-reasoning-pro', // Updated default Perplexity model
  googleScriptModel: 'gemini-2.5-flash-preview-05-20', // Default Google script model
};
