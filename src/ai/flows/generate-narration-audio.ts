
'use server';

/**
 * @fileOverview Generates narration audio from a script using the ElevenLabs API or Google TTS.
 * Can also list available voices from ElevenLabs.
 *
 * - generateNarrationAudio - A function that handles narration audio generation or voice listing.
 * - GenerateNarrationAudioInput - The input type for the function.
 * - GenerateNarrationAudioOutput - The output type for the function.
 * - ElevenLabsVoiceSchema - Zod schema for an ElevenLabs voice.
 */

import {
  type GenerateNarrationAudioInput,
  type GenerateNarrationAudioOutput,
} from './generate-narration-audio-types';
import { generateNarrationAudioFlow } from './narration-audio-flow-definition';

export async function generateNarrationAudio(input: GenerateNarrationAudioInput): Promise<GenerateNarrationAudioOutput> {
  return generateNarrationAudioFlow(input);
}
    