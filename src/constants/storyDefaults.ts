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
  perplexityModel: 'sonar', // Updated default Perplexity model
  googleScriptModel: 'gemini-1.5-flash', // Default Google script model
};
