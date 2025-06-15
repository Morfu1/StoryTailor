
import { useState, useCallback, useEffect } from 'react';
import type { Story, ElevenLabsVoice } from '@/types/story';
import { initialStoryState } from '@/constants/storyDefaults';
import type { UserApiKeys } from '@/types/apiKeys';

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

  // API Key states
  userApiKeys: UserApiKeys | null;
  setUserApiKeys: (keys: UserApiKeys | null) => void;
  apiKeysLoading: boolean;
  setApiKeysLoading: (loading: boolean) => void;

  // AI Provider and Model Selection
  aiProvider: 'google' | 'perplexity';
  setAiProvider: (provider: 'google' | 'perplexity') => void;
  perplexityModel: string | undefined;
  setPerplexityModel: (model: string | undefined) => void;
  googleScriptModel: string | undefined;
  setGoogleScriptModel: (model: string | undefined) => void;
  availableGoogleScriptModels: Array<{ id: string; name: string }> | null;
  setAvailableGoogleScriptModels: (models: Array<{ id: string; name: string }> | null) => void;
  isLoadingGoogleScriptModels: boolean;
  setIsLoadingGoogleScriptModels: (loading: boolean) => void;
  
  // Enhanced model setters that persist to story data
  setSelectedTtsModelWithPersist: (model: 'elevenlabs' | 'google') => void;
  setSelectedGoogleApiModelWithPersist: (model: string) => void;
  setImageProviderWithPersist: (provider: 'picsart' | 'gemini' | 'imagen3') => void;
  
  // State restoration function
  restoreStateFromStoryData: (loadedStory: Story) => void;
}

export const useStoryState = (passedUserId?: string): UseStoryStateReturn => {
  const [storyData, setStoryDataState] = useState<Story>(() => ({
    ...initialStoryState, // This will now bring in the updated 'sonar' default
    userId: passedUserId || '',
    // aiProvider and googleScriptModel are already correctly initialized from initialStoryState
  }));
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const [currentStep, setCurrentStep] = useState(1);
  const [activeAccordionItem, setActiveAccordionItem] = useState<string | undefined>(`step-${currentStep}`);
  const [pageLoading, setPageLoading] = useState(true);
  const [isSaveConfirmOpen, setIsSaveConfirmOpen] = useState(false);
  const [elevenLabsVoices, setElevenLabsVoices] = useState<ElevenLabsVoice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | undefined>(undefined);
  const [narrationSource, setNarrationSource] = useState<'generate' | 'upload'>('generate');
  const [selectedTtsModel, setSelectedTtsModel] = useState<'elevenlabs' | 'google'>(initialStoryState.selectedTtsModel || 'google');
  const [selectedGoogleApiModel, setSelectedGoogleApiModel] = useState<string>(initialStoryState.selectedGoogleTtsModel || 'gemini-2.5-flash-preview-tts');
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
  const [imageProvider, setImageProvider] = useState<'picsart' | 'gemini' | 'imagen3'>(initialStoryState.imageProvider as 'picsart' | 'gemini' | 'imagen3' || 'picsart');
  const [imageGenerationProgress, setImageGenerationProgress] = useState<{
    total: number;
    completed: number;
    generating: number[];
  }>({ total: 0, completed: 0, generating: [] });

  const [userApiKeys, setUserApiKeysState] = useState<UserApiKeys | null>(null);
  const [apiKeysLoading, setApiKeysLoadingState] = useState<boolean>(false);

  // AI Provider and Model Selection states
  const [aiProvider, setAiProviderState] = useState<'google' | 'perplexity'>(initialStoryState.aiProvider || 'google');
  // Ensure perplexityModel also uses the updated initialStoryState default
  const [perplexityModel, setPerplexityModelState] = useState<string | undefined>(initialStoryState.perplexityModel || 'sonar');
  const [googleScriptModel, setGoogleScriptModelState] = useState<string | undefined>(initialStoryState.googleScriptModel);
  const [availableGoogleScriptModels, setAvailableGoogleScriptModelsState] = useState<Array<{ id: string; name: string }> | null>(null);
  const [isLoadingGoogleScriptModels, setIsLoadingGoogleScriptModelsState] = useState<boolean>(false);
  // Removed Perplexity dynamic model state variables


  useEffect(() => {
    if (passedUserId && storyData.userId !== passedUserId) {
      setStoryDataState(prev => ({ ...prev, userId: passedUserId }));
      console.log('[useStoryState] Updated storyData.userId to:', passedUserId);
    } else if (!passedUserId && storyData.userId) {
      // User logged out or became undefined
      setStoryDataState(prev => ({ ...prev, userId: '' }));
      console.log('[useStoryState] Cleared storyData.userId as passedUserId is now undefined.');
    }
  }, [passedUserId, storyData.userId]);


  const updateStoryData = useCallback((updates: Partial<Story>) => {
    setStoryDataState(prev => ({ ...prev, ...updates }));
  }, []);

  const setStoryData = useCallback((data: Story) => {
    setStoryDataState(data);
  }, []);

  const handleSetLoading = useCallback((key: string, value: boolean) => {
    setIsLoading(prev => ({ ...prev, [key]: value }));
  }, []);

  const setUserApiKeys = useCallback((keys: UserApiKeys | null) => {
    setUserApiKeysState(keys);
  }, []);

  const setApiKeysLoading = useCallback((loading: boolean) => {
    setApiKeysLoadingState(loading);
  }, []);

  const setAiProvider = useCallback((provider: 'google' | 'perplexity') => {
    setAiProviderState(provider);
    updateStoryData({ aiProvider: provider });
  }, [updateStoryData]);

  const setPerplexityModel = useCallback((model: string | undefined) => {
    setPerplexityModelState(model);
    updateStoryData({ perplexityModel: model });
  }, [updateStoryData]);

  const setGoogleScriptModel = useCallback((model: string | undefined) => {
    setGoogleScriptModelState(model);
    updateStoryData({ googleScriptModel: model });
  }, [updateStoryData]);

  const setAvailableGoogleScriptModels = useCallback((models: Array<{ id: string; name: string }> | null) => {
    setAvailableGoogleScriptModelsState(models);
  }, []);

  const setIsLoadingGoogleScriptModels = useCallback((loading: boolean) => {
    setIsLoadingGoogleScriptModelsState(loading);
  }, []);

  // Enhanced TTS model setters that also update story data
  const setSelectedTtsModelWithPersist = useCallback((model: 'elevenlabs' | 'google') => {
    setSelectedTtsModel(model);
    updateStoryData({ selectedTtsModel: model });
  }, [updateStoryData]);

  const setSelectedGoogleApiModelWithPersist = useCallback((model: string) => {
    setSelectedGoogleApiModel(model);
    updateStoryData({ selectedGoogleTtsModel: model });
  }, [updateStoryData]);

  // Enhanced image provider setter that also updates story data
  const setImageProviderWithPersist = useCallback((provider: 'picsart' | 'gemini' | 'imagen3') => {
    setImageProvider(provider);
    updateStoryData({ imageProvider: provider });
  }, [updateStoryData]);

  // Function to restore UI state from loaded story data
  const restoreStateFromStoryData = useCallback((loadedStory: Story) => {
    // Restore Step 1 model selections
    if (loadedStory.aiProvider) {
      setAiProviderState(loadedStory.aiProvider);
    }
    if (loadedStory.perplexityModel) {
      setPerplexityModelState(loadedStory.perplexityModel);
    }
    if (loadedStory.googleScriptModel) {
      setGoogleScriptModelState(loadedStory.googleScriptModel);
    }
    
    // Restore Step 3 TTS model selections
    if (loadedStory.selectedTtsModel) {
      setSelectedTtsModel(loadedStory.selectedTtsModel);
    }
    if (loadedStory.selectedGoogleTtsModel) {
      setSelectedGoogleApiModel(loadedStory.selectedGoogleTtsModel);
    }
    if (loadedStory.elevenLabsVoiceId) {
      setSelectedVoiceId(loadedStory.elevenLabsVoiceId);
    }
    
    // Restore Step 4 image model selections
    if (loadedStory.imageProvider) {
      setImageProvider(loadedStory.imageProvider as 'picsart' | 'gemini' | 'imagen3');
    }
  }, []);

  // Removed Perplexity dynamic model setters

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

    userApiKeys,
    setUserApiKeys,
    apiKeysLoading,
    setApiKeysLoading,

    aiProvider,
    setAiProvider,
    perplexityModel,
    setPerplexityModel,
    googleScriptModel,
    setGoogleScriptModel,
    availableGoogleScriptModels,
    setAvailableGoogleScriptModels,
    isLoadingGoogleScriptModels,
    setIsLoadingGoogleScriptModels,
    
    // Enhanced model setters that persist to story data
    setSelectedTtsModelWithPersist,
    setSelectedGoogleApiModelWithPersist,
    setImageProviderWithPersist,
    
    // State restoration function
    restoreStateFromStoryData,
  };
};

