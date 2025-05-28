import { useState, useCallback } from 'react';
import type { Story, ElevenLabsVoice } from '@/types/story';
import { initialStoryState } from '@/constants/storyDefaults';

export interface UseStoryStateReturn {
  storyData: Story;
  updateStoryData: (updates: Partial<Story>) => void;
  setStoryData: (data: Story) => void;
  
  // Loading states
  isLoading: Record<string, boolean>;
  handleSetLoading: (key: string, value: boolean) => void;
  
  // Step management
  currentStep: number;
  setCurrentStep: (step: number) => void;
  activeAccordionItem: string | undefined;
  setActiveAccordionItem: (item: string | undefined) => void;
  
  // General UI states
  pageLoading: boolean;
  setPageLoading: (loading: boolean) => void;
  isSaveConfirmOpen: boolean;
  setIsSaveConfirmOpen: (open: boolean) => void;
  firebaseError: string | null;
  setFirebaseError: (error: string | null) => void;
  
  // Voice and TTS states
  elevenLabsVoices: ElevenLabsVoice[];
  setElevenLabsVoices: (voices: ElevenLabsVoice[]) => void;
  selectedVoiceId: string | undefined;
  setSelectedVoiceId: (id: string | undefined) => void;
  narrationSource: 'generate' | 'upload';
  setNarrationSource: (source: 'generate' | 'upload') => void;
  selectedTtsModel: 'elevenlabs' | 'google';
  setSelectedTtsModel: (model: 'elevenlabs' | 'google') => void;
  selectedGoogleApiModel: string;
  setSelectedGoogleApiModel: (model: string) => void;
  selectedGoogleLanguage: string;
  setSelectedGoogleLanguage: (language: string) => void;
  selectedGoogleVoiceId: string;
  setSelectedGoogleVoiceId: (voiceId: string) => void;
  uploadedAudioFileName: string | null;
  setUploadedAudioFileName: (fileName: string | null) => void;
  
  // Editing states
  isScriptManuallyEditing: boolean;
  setIsScriptManuallyEditing: (editing: boolean) => void;
  isCharacterPromptsEditing: boolean;
  setIsCharacterPromptsEditing: (editing: boolean) => void;
  isItemPromptsEditing: boolean;
  setIsItemPromptsEditing: (editing: boolean) => void;
  isLocationPromptsEditing: boolean;
  setIsLocationPromptsEditing: (editing: boolean) => void;
  isImagePromptEditing: boolean[];
  setIsImagePromptEditing: (editing: boolean[]) => void;
  
  // Image generation states
  isGeneratingDetailImage: Record<string, boolean>;
  setIsGeneratingDetailImage: (state: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void;
  imageProvider: 'picsart' | 'gemini' | 'imagen3';
  setImageProvider: (provider: 'picsart' | 'gemini' | 'imagen3') => void;
  imageGenerationProgress: {
    total: number;
    completed: number;
    generating: number[];
  };
  setImageGenerationProgress: (progress: {
    total: number;
    completed: number;
    generating: number[];
  }) => void;
  
  // Narration states
  currentNarrationChunkIndex: number;
  setCurrentNarrationChunkIndex: (index: number) => void;
  processingAllMode: boolean;
  setProcessingAllMode: (mode: boolean) => void;
}

export const useStoryState = (userId?: string): UseStoryStateReturn => {
  const [storyData, setStoryDataState] = useState<Story>(initialStoryState);
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const [currentStep, setCurrentStep] = useState(1);
  const [activeAccordionItem, setActiveAccordionItem] = useState<string | undefined>(`step-${currentStep}`);
  const [pageLoading, setPageLoading] = useState(true);
  const [isSaveConfirmOpen, setIsSaveConfirmOpen] = useState(false);
  const [elevenLabsVoices, setElevenLabsVoices] = useState<ElevenLabsVoice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | undefined>(undefined);
  const [narrationSource, setNarrationSource] = useState<'generate' | 'upload'>('generate');
  const [selectedTtsModel, setSelectedTtsModel] = useState<'elevenlabs' | 'google'>('elevenlabs');
  const [selectedGoogleApiModel, setSelectedGoogleApiModel] = useState<string>('gemini-2.5-flash-preview-tts');
  const [selectedGoogleLanguage, setSelectedGoogleLanguage] = useState<string>('en-US');
  const [selectedGoogleVoiceId, setSelectedGoogleVoiceId] = useState<string>('Zephyr');
  const [uploadedAudioFileName, setUploadedAudioFileName] = useState<string | null>(null);
  const [isScriptManuallyEditing, setIsScriptManuallyEditing] = useState(false);
  const [isCharacterPromptsEditing, setIsCharacterPromptsEditing] = useState(false);
  const [isItemPromptsEditing, setIsItemPromptsEditing] = useState(false);
  const [isLocationPromptsEditing, setIsLocationPromptsEditing] = useState(false);
  const [isImagePromptEditing, setIsImagePromptEditing] = useState<boolean[]>([]);
  const [isGeneratingDetailImage, setIsGeneratingDetailImage] = useState<Record<string, boolean>>({});
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const [currentNarrationChunkIndex, setCurrentNarrationChunkIndex] = useState<number>(-1);
  const [processingAllMode, setProcessingAllMode] = useState<boolean>(false);
  const [imageProvider, setImageProvider] = useState<'picsart' | 'gemini' | 'imagen3'>('picsart');
  const [imageGenerationProgress, setImageGenerationProgress] = useState<{
    total: number;
    completed: number;
    generating: number[];
  }>({ total: 0, completed: 0, generating: [] });

  const updateStoryData = useCallback((updates: Partial<Story>) => {
    setStoryDataState(prev => ({ ...prev, ...updates }));
  }, []);

  const setStoryData = useCallback((data: Story) => {
    setStoryDataState(data);
  }, []);

  const handleSetLoading = useCallback((key: string, value: boolean) => {
    setIsLoading(prev => ({ ...prev, [key]: value }));
  }, []);

  // Initialize userId if provided
  if (userId && !storyData.userId) {
    updateStoryData({ userId });
  }

  return {
    storyData,
    updateStoryData,
    setStoryData,
    
    isLoading,
    handleSetLoading,
    
    currentStep,
    setCurrentStep,
    activeAccordionItem,
    setActiveAccordionItem,
    
    pageLoading,
    setPageLoading,
    isSaveConfirmOpen,
    setIsSaveConfirmOpen,
    firebaseError,
    setFirebaseError,
    
    elevenLabsVoices,
    setElevenLabsVoices,
    selectedVoiceId,
    setSelectedVoiceId,
    narrationSource,
    setNarrationSource,
    selectedTtsModel,
    setSelectedTtsModel,
    selectedGoogleApiModel,
    setSelectedGoogleApiModel,
    selectedGoogleLanguage,
    setSelectedGoogleLanguage,
    selectedGoogleVoiceId,
    setSelectedGoogleVoiceId,
    uploadedAudioFileName,
    setUploadedAudioFileName,
    
    isScriptManuallyEditing,
    setIsScriptManuallyEditing,
    isCharacterPromptsEditing,
    setIsCharacterPromptsEditing,
    isItemPromptsEditing,
    setIsItemPromptsEditing,
    isLocationPromptsEditing,
    setIsLocationPromptsEditing,
    isImagePromptEditing,
    setIsImagePromptEditing,
    
    isGeneratingDetailImage,
    setIsGeneratingDetailImage,
    imageProvider,
    setImageProvider,
    imageGenerationProgress,
    setImageGenerationProgress,
    
    currentNarrationChunkIndex,
    setCurrentNarrationChunkIndex,
    processingAllMode,
    setProcessingAllMode,
  };
};
