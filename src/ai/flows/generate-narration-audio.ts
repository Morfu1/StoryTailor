'use server';

/**
 * @fileOverview Generates narration audio from a script using the ElevenLabs API.
 * Can also list available voices from ElevenLabs.
 *
 * - generateNarrationAudio - A function that handles narration audio generation or voice listing.
 * - GenerateNarrationAudioInput - The input type for the function.
 * - GenerateNarrationAudioOutput - The output type for the function.
 * - ElevenLabsVoiceSchema - Zod schema for an ElevenLabs voice.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { ElevenLabsVoice } from '@/types/story'; // Using type from story.ts

const ElevenLabsVoiceSchema = z.object({
  voice_id: z.string(),
  name: z.string(),
  category: z.string().optional(),
  // available_for_tiers: z.array(z.string()).optional(),
  // preview_url: z.string().optional(),
});

const GenerateNarrationAudioInputSchema = z.object({
  script: z.string().describe('The script to generate narration audio from.'),
  voiceId: z.string().optional().describe('The ElevenLabs voice ID to use for generation. If not provided, the flow will list available voices.'),
});
export type GenerateNarrationAudioInput = z.infer<typeof GenerateNarrationAudioInputSchema>;

const GenerateNarrationAudioOutputSchema = z.object({
  audioDataUri: z
    .string()
    .optional()
    .describe(
      'The narration audio as a data URI (audio/mpeg). Expected format: \'data:audio/mpeg;base64,<encoded_data>\'.'
    ),
  voices: z.array(ElevenLabsVoiceSchema).optional().describe('A list of available ElevenLabs voices.'),
  error: z.string().optional().describe('An error message if generation or listing failed.'),
});
export type GenerateNarrationAudioOutput = z.infer<typeof GenerateNarrationAudioOutputSchema>;


export async function generateNarrationAudio(input: GenerateNarrationAudioInput): Promise<GenerateNarrationAudioOutput> {
  return generateNarrationAudioFlow(input);
}

const generateNarrationAudioFlow = ai.defineFlow(
  {
    name: 'generateNarrationAudioFlow',
    inputSchema: GenerateNarrationAudioInputSchema,
    outputSchema: GenerateNarrationAudioOutputSchema,
  },
  async (input: GenerateNarrationAudioInput): Promise<GenerateNarrationAudioOutput> => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.error('ElevenLabs API key is not configured.');
      return { error: 'ElevenLabs API key is not configured.' };
    }

    if (input.voiceId) {
      // Generate audio
      try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${input.voiceId}`, {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': apiKey,
          },
          body: JSON.stringify({
            text: input.script,
            model_id: 'eleven_multilingual_v2', // Or another suitable model
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
            },
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          console.error(`ElevenLabs TTS API error: ${response.status} ${response.statusText}`, errorBody);
          return { error: `ElevenLabs TTS API error: ${response.status} - ${errorBody || response.statusText}` };
        }

        const audioBuffer = await response.arrayBuffer();
        const base64Audio = Buffer.from(audioBuffer).toString('base64');
        const audioDataUri = `data:audio/mpeg;base64,${base64Audio}`;
        
        return { audioDataUri };

      } catch (err) {
        console.error('Error calling ElevenLabs TTS API:', err);
        return { error: 'Failed to generate audio. ' + (err instanceof Error ? err.message : String(err)) };
      }
    } else {
      // List voices
      try {
        const response = await fetch('https://api.elevenlabs.io/v1/voices', {
          headers: {
            'Accept': 'application/json',
            'xi-api-key': apiKey,
          },
        });

        if (!response.ok) {
          const errorBody = await response.text();
          console.error(`ElevenLabs Voices API error: ${response.status} ${response.statusText}`, errorBody);
          return { error: `ElevenLabs Voices API error: ${response.status} - ${errorBody || response.statusText}` };
        }

        const data = await response.json();
        // Filter for "premade" voices as a proxy for generally available/free voices.
        // The API might change, so this filtering logic might need adjustment.
        const premadeVoices = (data.voices as ElevenLabsVoice[]).filter(voice => voice.category === 'premade' || !voice.category); // Include those without category as well for safety

        return { voices: premadeVoices };

      } catch (err) {
        console.error('Error calling ElevenLabs Voices API:', err);
        return { error: 'Failed to list voices. ' + (err instanceof Error ? err.message : String(err)) };
      }
    }
  }
);
