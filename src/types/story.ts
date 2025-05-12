import type { Timestamp } from 'firebase/firestore';

export interface StoryCharacterLocationItemPrompts {
  characterPrompts?: string;
  itemPrompts?: string;
  locationPrompts?: string;
}

export interface GeneratedImage {
  prompt: string;
  imageUrl: string;
  dataAiHint?: string; // For placeholder image keyword search
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
  imagePrompts?: string[];
  generatedImages?: GeneratedImage[];
  // videoUrl?: string; // For future video assembly
  createdAt?: Timestamp | Date; // Stored as Firestore Timestamp, hydrated as Date
  updatedAt?: Timestamp | Date; // Stored as Firestore Timestamp, hydrated as Date
}
