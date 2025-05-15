import type { Timestamp } from 'firebase/firestore';

export interface StoryCharacterLocationItemPrompts {
  characterPrompts?: string;
  itemPrompts?: string;
  locationPrompts?: string;
}

export interface GeneratedImage {
  requestPrompt: string; // The full prompt sent to the API, including styles
  originalPrompt: string; // The character/item/location description
  imageUrl: string;
  isChapterGenerated?: boolean; // Flag to identify images generated through chapter generation
  chapterNumber?: number; // The chapter number this image belongs to
  expandedPrompt?: string; // The full prompt with all @Entity references expanded
}

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category?: string;
  // Add other fields from ElevenLabs API if needed, e.g., preview_url
}

export interface Story {
  id?: string; // Firestore document ID
  userId: string;
  title: string;
  userPrompt: string;
  generatedScript?: string;
  detailsPrompts?: StoryCharacterLocationItemPrompts;
  narrationAudioUrl?: string; // Data URI or URL
  narrationAudioDurationSeconds?: number;
  elevenLabsVoiceId?: string; // To store the selected ElevenLabs voice ID
  narrationVoice?: string; // Voice name (e.g., "Laura")
  narrationVoiceId?: string; // Voice ID from ElevenLabs (alias for elevenLabsVoiceId)
  imagePrompts?: string[];
  generatedImages?: GeneratedImage[];
  // videoUrl?: string; // For future video assembly
  createdAt?: Timestamp | Date; // Stored as Firestore Timestamp, hydrated as Date
  updatedAt?: Timestamp | Date; // Stored as Firestore Timestamp, hydrated as Date
}
