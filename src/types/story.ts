
import type { Timestamp, FieldValue } from 'firebase/firestore';
import type { ImageStyleId } from './imageStyles';

export interface StoryCharacterLocationItemPrompts {
  characterPrompts?: string;
  itemPrompts?: string;
  locationPrompts?: string;
}

export interface GeneratedImage {
  sceneIndex: number; // Index corresponding to storyData.imagePrompts THIS IS THE PRIMARY KEY FOR A SCENE IMAGE
  originalPrompt: string; // The text of the prompt used to generate THIS image (snapshot)
  requestPrompt: string;  // The prompt after system expansions, sent to AI (useful for debugging/seeing what AI got)
  imageUrl: string;
  width?: number; // Image width in pixels
  height?: number; // Image height in pixels
  isChapterGenerated?: boolean; // Flag to identify images generated through chapter generation (less relevant now with sceneIndex)
  chapterNumber?: number; // The chapter number this image belongs to (less relevant now with sceneIndex)
  chunkId?: string; // The narration chunk ID this image belongs to
  chunkIndex?: number; // The narration chunk index this image belongs to
  history?: {
    sceneIndex: number;
    originalPrompt: string; // Snapshot of the prompt for this historical version
    requestPrompt: string;
    imageUrl: string;
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
  sceneIndex: number; // Crucially links this action to an imagePrompt by its index
  originalPrompt: string; // The canonical prompt text from storyData.imagePrompts[sceneIndex]
  actionDescription: string; // Simple action description for animation
  chunkText: string; // Original narration chunk text that generated this scene
  chunkId?: string; // The narration chunk ID this prompt belongs to
  chunkIndex?: number; // The narration chunk index this prompt belongs to
}

export interface Story {
  id?: string; // Firestore document ID
  userId: string;
  title: string;
  userPrompt: string;
  status?: string; // Story status: draft, generating, completed, error
  generatedScript?: string;
  detailsPrompts?: StoryCharacterLocationItemPrompts;
  narrationAudioUrl?: string; // Data URI or URL
  narrationAudioDurationSeconds?: number;
  elevenLabsVoiceId?: string; // To store the selected ElevenLabs voice ID
  narrationVoice?: string; // Voice name (e.g., "Laura")
  narrationVoiceId?: string; // Voice ID from ElevenLabs (alias for elevenLabsVoiceId)
  imagePrompts?: string[]; // Array of scene prompts. The index is the sceneIndex.
  
  // Enhanced prompt tracking for export
  imagePromptsData?: {
    originalPrompt: string;     // Initial prompt from AI generation
    picsartPrompt?: string;     // Expanded prompt sent to Picsart
    imagenPrompt?: string;      // Expanded prompt sent to Imagen 3
  }[]; // Enhanced prompt data matching imagePrompts indices
  generatedImages?: GeneratedImage[]; // Stores the *latest* image for each sceneIndex.
  actionPrompts?: ActionPrompt[]; // Action prompts for future use, linked by sceneIndex
  imageStyleId?: ImageStyleId; // Selected image generation style
  timelineTracks?: PageTimelineTrack[]; // To store the state of the timeline
  // videoUrl?: string; // For future video assembly
  createdAt?: Timestamp | Date | FieldValue; // Stored as Firestore Timestamp or FieldValue, hydrated as Date
  updatedAt?: Timestamp | Date | FieldValue; // Stored as Firestore Timestamp or FieldValue, hydrated as Date
  
  // New fields for chunked narration
  scriptChunks?: string[]; // The script split into chunks for narration
  narrationChunks?: {
    id: string;
    text: string;
    audioUrl?: string;
    duration?: number;
    index: number;
  }[]; // Audio narration for each script chunk

  // Spanish translation chunks
  spanishNarrationChunks?: {
    id: string;
    text: string;
    audioUrl?: string;
    duration?: number;
    index: number;
  }[]; // Spanish translated audio narration for each script chunk

  // Romanian translation chunks
  romanianNarrationChunks?: {
    id: string;
    text: string;
    audioUrl?: string;
    duration?: number;
    index: number;
  }[]; // Romanian translated audio narration for each script chunk

  // AI Provider and Model Selection (Step 1)
  aiProvider?: 'google' | 'perplexity';
  perplexityModel?: string;
  googleScriptModel?: string; // Model for Google script generation
  
  // TTS Model Selection (Step 3)
  selectedTtsModel?: 'elevenlabs' | 'google'; // User's TTS provider choice
  selectedGoogleTtsModel?: string; // Specific Google TTS model (e.g., "gemini-2.5-flash-preview-tts")
  
  // Image Generation Model Selection (Step 4)  
  imageProvider?: string; // e.g., "picsart", "gemini", "imagen3"
  
  // AI Model Tracking for each generation step (for analytics/debugging)
  audioGenerationService?: 'elevenlabs' | 'google'; // Which TTS service was actually used
  audioModel?: string; // Specific model used (e.g., "Eleven Turbo v2.5", "WaveNet")
  detailImageProvider?: string; // Provider used for character/location/item images
  detailImageModel?: string; // Model used for detail images
  sceneImageProvider?: string; // Provider used for scene images  
  sceneImageModel?: string; // Model used for scene images
}
