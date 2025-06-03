import { ai } from '@/ai/genkit';
import type { ElevenLabsVoice } from '@/types/story';
import {
  GenerateNarrationAudioInputSchema,
  type GenerateNarrationAudioInput,
  GenerateNarrationAudioOutputSchema,
  type GenerateNarrationAudioOutput,
} from './generate-narration-audio-types';

export const generateNarrationAudioFlow = ai.defineFlow(
  {
    name: 'generateNarrationAudioFlow',
    inputSchema: GenerateNarrationAudioInputSchema,
    outputSchema: GenerateNarrationAudioOutputSchema,
  },
  async (input: GenerateNarrationAudioInput): Promise<GenerateNarrationAudioOutput> => {
    const modelToUse = input.ttsModel || 'elevenlabs';

    if (modelToUse === 'google') {
      const googleUserApiKey = input.apiKey; // User-provided key
      if (!googleUserApiKey) {
        console.error('User-provided Google API key is missing for TTS.');
        return { error: 'Google API key not configured by user for TTS. Please set it in Account Settings.' };
      }
      if (!input.script) {
        return { error: 'Script is required for Google TTS.' };
      }

      try {
        const googleApiModelToUse = input.googleApiModel || 'gemini-2.5-flash-preview-tts';
        console.log(`[generateNarrationAudioFlow] Calling Google TTS (${googleApiModelToUse}) using user's API key.`);
        
        if (!input.script || input.script.trim().length === 0) {
          return { error: 'Script is empty or contains only whitespace' };
        }
        if (input.script.length < 5) { console.warn('[generateNarrationAudioFlow] Script is very short'); }
        // Removed automatic period appending logic
        
        const voiceConfig: { name: string; languageCode?: string } = {
          name: input.voiceId || "Zephyr", 
        };
        if (input.languageCode) { voiceConfig.languageCode = input.languageCode; }

        // Escape inner quotes and wrap the whole script in quotes
        const escapedScript = input.script.replace(/"/g, '\\"');
        const textToSend = `"${escapedScript}"`;
        console.log(`[TTS DEBUG] Sending to Google TTS API (wrapped & escaped): ${textToSend}`); // DEBUG LOG

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${googleApiModelToUse}:generateContent?key=${googleUserApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [ { parts: [{ text: textToSend }] } ], // Use wrapped and escaped text
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceConfig.name } } }
            }
          }),
        });

        if (!response.ok) {
          const errorBodyText = await response.text();
          let errorDetail = errorBodyText;
          try { const errorJson = JSON.parse(errorBodyText); errorDetail = errorJson.error?.message || errorBodyText; } catch { /* ignore */ }
          return { error: `Google TTS API error: ${response.status} - ${errorDetail}` };
        }

        const result = await response.json();
        const candidate = result.candidates?.[0];
        const finishReason = candidate?.finishReason;
        const audioData = candidate?.content?.parts?.[0]?.inlineData?.data;
        
        if (finishReason && finishReason !== 'STOP') {
          return { error: `Google TTS generation failed: ${finishReason}.` };
        }
        
        if (audioData) {
          const audioDataUri = `data:audio/wav;base64,${audioData}`;
          return { audioDataUri };
        } else {
          return { error: 'No audio content in Google TTS response' };
        }

      } catch (err) {
        return { error: 'Failed to generate audio with Google TTS. ' + (err instanceof Error ? err.message : String(err)) };
      }

    } else if (modelToUse === 'elevenlabs') {
      const elevenLabsUserApiKey = input.apiKey; // User-provided key
      
      if (!input.voiceId && !elevenLabsUserApiKey) {
         // If listing voices and no key is provided by user, this could be an app-level function.
         // For now, we assume user key is required if the input.apiKey field exists.
         // If the intention is that listing voices should use a global key if user doesn't provide one,
         // then the calling action (storyActions.ts) should decide which key to pass to the flow.
         // For strict user-key-only for ElevenLabs:
         // return { error: 'ElevenLabs API key not configured by user for voice listing. Please set it in Account Settings.' };
         // Let's allow voice listing with app's key as fallback for now (read from process.env if input.apiKey is not provided)
         const appElevenLabsKey = process.env.ELEVEN_API_KEY;
         if(!appElevenLabsKey && !input.voiceId) {
            return { error: 'ElevenLabs API key not available for voice listing.' };
         }
      }


      if (input.voiceId && input.script) { // Generate audio
        if (!elevenLabsUserApiKey) {
          console.error('User-provided ElevenLabs API key is missing for generation.');
          return { error: 'ElevenLabs API key not configured by user for generation. Please set it in Account Settings.' };
        }
        console.log(`[generateNarrationAudioFlow] Calling ElevenLabs TTS using user's API key.`);
        try {
          const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${input.voiceId}`, {
            method: 'POST',
            headers: { 'Accept': 'audio/mpeg', 'Content-Type': 'application/json', 'xi-api-key': elevenLabsUserApiKey },
            body: JSON.stringify({ text: input.script, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
          });
          if (!response.ok) {
            const errorBody = await response.text();
            return { error: `ElevenLabs TTS API error: ${response.status} - ${errorBody || response.statusText}` };
          }
          const audioBuffer = await response.arrayBuffer();
          const base64Audio = Buffer.from(audioBuffer).toString('base64');
          const audioDataUri = `data:audio/mpeg;base64,${base64Audio}`;
          return { audioDataUri };
        } catch (err) {
          return { error: 'Failed to generate audio with ElevenLabs. ' + (err instanceof Error ? err.message : String(err)) };
        }
      } else if (!input.voiceId) { // List ElevenLabs voices
        // Use user's key if provided, otherwise fallback to app's key for listing
        const keyToUseForListing = elevenLabsUserApiKey || process.env.ELEVEN_API_KEY;
        if (!keyToUseForListing) {
            return { error: 'ElevenLabs API key not available for voice listing (neither user nor app level).' };
        }
        console.log(`[generateNarrationAudioFlow] Listing ElevenLabs voices using ${elevenLabsUserApiKey ? "user's" : "app's"} API key.`);
        try {
          const response = await fetch('https://api.elevenlabs.io/v1/voices', {
            headers: { 'Accept': 'application/json', 'xi-api-key': keyToUseForListing },
          });
          if (!response.ok) {
            const errorBody = await response.text();
            return { error: `ElevenLabs Voices API error: ${response.status} - ${errorBody || response.statusText}` };
          }
          const data = await response.json();
          const availableVoices = (data.voices as ElevenLabsVoice[]).filter(voice => voice.category === 'premade' || voice.category === 'professional' || !voice.category);
          return { voices: availableVoices };
        } catch (err) {
          return { error: 'Failed to list ElevenLabs voices. ' + (err instanceof Error ? err.message : String(err)) };
        }
      } else {
        return { error: 'Script is required for ElevenLabs audio generation when a voiceId is provided.' };
      }
    } else {
      return { error: `Unsupported TTS model: ${modelToUse}` };
    }
  }
);
