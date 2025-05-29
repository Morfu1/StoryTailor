import type { Timestamp } from 'firebase/firestore';
import type { ImageStyleId } from './imageStyles';

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
  history?: {
    imageUrl: string;
    originalPrompt: string;
    timestamp: Date;
  }[]; // To store previous versions of this image
}

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category?: string;
  // Add other fields from ElevenLabs API if needed, e.g., preview_url
}

// Moved from page.tsx to be globally available
export interface PageTimelineMediaItem {
  id: string; // Unique ID for this item on the timeline
  type: 'image' | 'audio' | 'text';
  originalIndex?: number; // For images/texts from storyData.generatedImages
  sourceId?: string; // ID of the source media item from AllMediaContent (e.g., `media-image-${originalIndex}`)
  imageUrl?: string;
  audioUrl?: string; // For audio items
  scriptSegment?: string;
  title?: string; // e.g., from image prompt or audio file name
  // Timeline specific properties
  startTime?: number; // In seconds from the beginning of the track/timeline
  duration?: number;  // In seconds
  ui?: {
    width?: string | number; // Visual width on the timeline
    // Potentially other UI related states like color, etc.
  };
}

export interface PageTimelineTrack {
  id: string; // e.g., "video-track-1", "narration-track-1"
  type: 'video' | 'narration' | 'audio' | 'text'; // 'narration' is a specific type of audio track
  name: string;
  iconName?: string; // Name of the Lucide icon (e.g., "Video", "Music2", "MessageSquareText")
  items: PageTimelineMediaItem[];
  height: string;
  accepts: Array<'image' | 'audio' | 'text'>; // Types of media this track can accept
  emptyStateMessage: string;
  showGenerateButton?: boolean; // For the initial video track that can generate images
}


export interface ActionPrompt {
  sceneIndex: number;
  originalPrompt: string;
  actionDescription: string; // Simple action description for animation
  chunkText: string; // Original narration chunk text that generated this scene
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
  actionPrompts?: ActionPrompt[]; // Action prompts for future use
  imageStyleId?: ImageStyleId; // Selected image generation style
  timelineTracks?: PageTimelineTrack[]; // To store the state of the timeline
  // videoUrl?: string; // For future video assembly
  createdAt?: Timestamp | Date; // Stored as Firestore Timestamp, hydrated as Date
  updatedAt?: Timestamp | Date; // Stored as Firestore Timestamp, hydrated as Date
  
  // New fields for chunked narration
  scriptChunks?: string[]; // The script split into chunks for narration
  narrationChunks?: {
    id: string;
    text: string;
    audioUrl?: string;
    duration?: number;
    index: number;
  }[]; // Audio narration for each script chunk
}
