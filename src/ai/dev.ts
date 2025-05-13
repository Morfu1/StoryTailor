
import { config } from 'dotenv';
config();

import '@/ai/flows/generate-narration-audio.ts';
import '@/ai/flows/generate-image-prompts.ts';
import '@/ai/flows/generate-character-prompts.ts';
import '@/ai/flows/generate-script.ts';
import '@/ai/flows/generate-title.ts'; // Added import for generate-title
