import {z} from 'genkit';

export const ElevenLabsVoiceSchema = z.object({
  voice_id: z.string(),
  name: z.string(),
  category: z.string().optional(),
});

export const GenerateNarrationAudioInputSchema = z.object({
  script: z.string().describe('The script to generate narration audio from.'),
  voiceId: z.string().optional().describe('The voice ID to use (ElevenLabs ID or Google voice name).'),
  ttsModel: z.enum(['elevenlabs', 'google']).optional().describe('The TTS model to use. Defaults to elevenlabs.'),
  googleApiModel: z.string().optional().describe('The specific Google API model to use (e.g., gemini-2.5-flash-preview-tts).'),
  languageCode: z.string().optional().describe('The BCP-47 language code for Google TTS (e.g., en-US).'),
  apiKey: z.string().optional().describe('The API key for the selected TTS service (ElevenLabs or Google).'),
});
export type GenerateNarrationAudioInput = z.infer<typeof GenerateNarrationAudioInputSchema>;

export const GenerateNarrationAudioOutputSchema = z.object({
  audioDataUri: z
    .string()
    .optional()
    .describe(
      'The narration audio as a data URI. Expected format: \'data:<mime_type>;base64,<encoded_data>\'.'
    ),
  voices: z.array(ElevenLabsVoiceSchema).optional().describe('A list of available ElevenLabs voices.'),
  error: z.string().optional().describe('An error message if generation or listing failed.'),
});
export type GenerateNarrationAudioOutput = z.infer<typeof GenerateNarrationAudioOutputSchema>;