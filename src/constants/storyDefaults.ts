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
};
