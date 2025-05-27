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
  voiceId: z.string().optional().describe('The voice ID to use (ElevenLabs ID or Google voice name).'),
  ttsModel: z.enum(['elevenlabs', 'google']).optional().describe('The TTS model to use. Defaults to elevenlabs.'),
  googleApiModel: z.string().optional().describe('The specific Google API model to use (e.g., gemini-2.5-flash-preview-tts).'),
  languageCode: z.string().optional().describe('The BCP-47 language code for Google TTS (e.g., en-US).'),
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
    const modelToUse = input.ttsModel || 'elevenlabs';

    if (modelToUse === 'google') {
      const googleApiKey = process.env.GOOGLE_API_KEY;
      if (!googleApiKey) {
        console.error('Google API key (GOOGLE_API_KEY) is not configured in environment variables.');
        return { error: 'Google API key is not configured. Please ensure GOOGLE_API_KEY is set in your environment.' };
      }
      if (!input.script) {
        return { error: 'Script is required for Google TTS.' };
      }

      try {
        const googleApiModelToUse = input.googleApiModel || 'gemini-2.5-flash-preview-tts';
        console.log(`[generateNarrationAudioFlow] Calling Google TTS (${googleApiModelToUse}) for script: "${input.script}" with voice: ${input.voiceId || 'default'}, lang: ${input.languageCode || 'auto'}`);
        console.log(`[generateNarrationAudioFlow] Full script text (${input.script.length} chars): "${input.script}"`);
        
        // Validate script content
        if (!input.script || input.script.trim().length === 0) {
          console.error('[generateNarrationAudioFlow] Script is empty or whitespace only');
          return { error: 'Script is empty or contains only whitespace' };
        }
        
        if (input.script.length < 5) {
          console.warn('[generateNarrationAudioFlow] Script is very short, this might cause TTS issues');
        }
        
        // Check for incomplete sentences (common cause of OTHER finish reason)
        if (input.script.endsWith('...') || !input.script.match(/[.!?]$/)) {
          console.warn('[generateNarrationAudioFlow] Script appears to be incomplete or truncated');
          // Try to complete the sentence by adding a period if it doesn't end with punctuation
          if (!input.script.match(/[.!?]$/)) {
            input.script = input.script.trim() + '.';
            console.log('[generateNarrationAudioFlow] Added period to complete sentence');
          }
        }
        
        // Check for potentially problematic content that might trigger safety filters
        const potentialIssues: string[] = [];
        if (input.script.includes('Unit ') || input.script.includes('unit ')) {
          potentialIssues.push('military/technical unit references');
        }
        if (/\d{3,}/.test(input.script)) {
          potentialIssues.push('numeric codes/identifiers');
        }
        if (potentialIssues.length > 0) {
          console.warn(`[generateNarrationAudioFlow] Potential content issues detected: ${potentialIssues.join(', ')}`);
        }
        
        const voiceConfig: { name: string; languageCode?: string } = {
          name: input.voiceId || "Zephyr", // Default to Zephyr if no voiceId, API expects short names
        };
        if (input.languageCode) {
          voiceConfig.languageCode = input.languageCode;
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${googleApiModelToUse}:generateContent?key=${googleApiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: input.script }]
              }
            ],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: voiceConfig.name
                  }
                }
              }
            }
          }),
        });

        if (!response.ok) {
          let errorBodyText = await response.text();
          let errorDetail = errorBodyText;
          try {
            const errorJson = JSON.parse(errorBodyText);
            errorDetail = errorJson.error?.message || errorBodyText;
          } catch (e) { /* ignore parsing error, use raw text */ }
          console.error(`Google TTS API error: ${response.status} ${response.statusText}`, errorDetail);
          return { error: `Google TTS API error: ${response.status} - ${errorDetail}` };
        }

        const result = await response.json();
        const candidate = result.candidates?.[0];
        const finishReason = candidate?.finishReason;
        const audioData = candidate?.content?.parts?.[0]?.inlineData?.data;
        
        // Check if generation completed successfully
        // Valid completion reasons are 'STOP' (successful completion) and undefined/null (default success)
        if (finishReason && finishReason !== 'STOP') {
          console.error(`[generateNarrationAudioFlow] Google TTS generation failed with finish reason: ${finishReason}`, result);
          
          // If this is a content issue with "Unit XXX" pattern, try a sanitized version
          if (finishReason === 'OTHER' && (input.script.includes('Unit ') || input.script.includes('unit '))) {
            console.log('[generateNarrationAudioFlow] Attempting content sanitization for potential safety filter issue');
            
            // Replace "Unit XXX" with more generic terms
            let sanitizedScript = input.script
              .replace(/Unit\s+\d+/gi, 'our team')
              .replace(/unit\s+\d+/gi, 'our team');
            
            console.log(`[generateNarrationAudioFlow] Retry with sanitized script: "${sanitizedScript}"`);
            
            // Retry with sanitized content
            try {
              const retryResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${googleApiModelToUse}:generateContent?key=${googleApiKey}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    contents: [{
                      parts: [{
                        text: sanitizedScript
                      }]
                    }],
                    generationConfig: {
                      temperature: 0.2,
                      candidateCount: 1,
                      ...voiceConfig,
                    },
                  }),
                }
              );
              
              if (retryResponse.ok) {
                const retryResult = await retryResponse.json();
                const retryFinishReason = retryResult.candidates?.[0]?.finishReason;
                const retryAudioData = retryResult.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
                
                if (retryAudioData && (!retryFinishReason || retryFinishReason === 'STOP')) {
                  console.log('[generateNarrationAudioFlow] Sanitized content successful');
                  const audioDataUri = `data:audio/wav;base64,${retryAudioData}`;
                  return { audioDataUri };
                }
              }
            } catch (retryError) {
              console.error('[generateNarrationAudioFlow] Retry with sanitized content also failed:', retryError);
            }
          }
          
          return { error: `Google TTS generation failed with finish reason: ${finishReason}. This may be due to content restrictions or API limitations.` };
        }
        
        if (audioData) {
          // The Gemini API returns the audio as base64-encoded WAV data at 24kHz
          const audioDataUri = `data:audio/wav;base64,${audioData}`;
          console.log(`[generateNarrationAudioFlow] Google TTS successful, returning audioDataUri.`);
          return { audioDataUri };
        } else {
          console.error('[generateNarrationAudioFlow] No audio content in Google TTS response:', result);
          return { error: 'No audio content in Google TTS response' };
        }

      } catch (err) {
        console.error('[generateNarrationAudioFlow] Error calling Google TTS API:', err);
        return { error: 'Failed to generate audio with Google TTS. ' + (err instanceof Error ? err.message : String(err)) };
      }

    } else if (modelToUse === 'elevenlabs') {
      const elevenLabsApiKey = process.env.ELEVEN_API_KEY;
      if (!elevenLabsApiKey) {
        console.error('ElevenLabs API key (ELEVEN_API_KEY) is not configured in environment variables.');
        return { error: 'ElevenLabs API key is not configured. Please ensure ELEVEN_API_KEY is set in your environment.' };
      }

      if (input.voiceId && input.script) { // voiceId and script are needed for generation
        console.log(`[generateNarrationAudioFlow] Calling ElevenLabs TTS for script: "${input.script.substring(0,30)}..." with voice: ${input.voiceId}`);
        try {
          const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${input.voiceId}`, {
            method: 'POST',
            headers: {
              'Accept': 'audio/mpeg',
              'Content-Type': 'application/json',
              'xi-api-key': elevenLabsApiKey,
            },
            body: JSON.stringify({
              text: input.script,
              model_id: 'eleven_multilingual_v2',
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
          console.log(`[generateNarrationAudioFlow] ElevenLabs TTS successful, returning audioDataUri.`);
          return { audioDataUri };

        } catch (err) {
          console.error('[generateNarrationAudioFlow] Error calling ElevenLabs TTS API:', err);
          return { error: 'Failed to generate audio with ElevenLabs. ' + (err instanceof Error ? err.message : String(err)) };
        }
      } else if (!input.voiceId) { // If no voiceId, list ElevenLabs voices
        console.log(`[generateNarrationAudioFlow] Listing ElevenLabs voices.`);
        try {
          const response = await fetch('https://api.elevenlabs.io/v1/voices', {
            headers: {
              'Accept': 'application/json',
              'xi-api-key': elevenLabsApiKey,
            },
          });

          if (!response.ok) {
            const errorBody = await response.text();
            console.error(`ElevenLabs Voices API error: ${response.status} ${response.statusText}`, errorBody);
            return { error: `ElevenLabs Voices API error: ${response.status} - ${errorBody || response.statusText}` };
          }

          const data = await response.json();
          const availableVoices = (data.voices as ElevenLabsVoice[]).filter(
            voice => voice.category === 'premade' ||
                     voice.category === 'professional' ||
                     !voice.category
          );
          console.log(`[generateNarrationAudioFlow] ElevenLabs voice listing successful, found ${availableVoices.length} voices.`);
          return { voices: availableVoices };

        } catch (err) {
          console.error('[generateNarrationAudioFlow] Error calling ElevenLabs Voices API:', err);
          return { error: 'Failed to list ElevenLabs voices. ' + (err instanceof Error ? err.message : String(err)) };
        }
      } else {
        // This case (model is elevenlabs, voiceId is present, but no script) should ideally not be hit if UI enforces script for generation.
        // Or if script is missing when trying to generate.
        console.warn('[generateNarrationAudioFlow] ElevenLabs selected, voiceId provided, but script is missing for generation.');
        return { error: 'Script is required for ElevenLabs audio generation when a voiceId is provided.' };
      }
    } else {
      return { error: `Unsupported TTS model: ${modelToUse}` };
    }
  }
);

