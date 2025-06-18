
import { useState, useCallback, useEffect } from 'react';
import type { Story, ElevenLabsVoice } from '@/types/story';
import { initialStoryState } from '@/constants/storyDefaults';
import { googleTtsVoices } from '@/constants/voices';
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
  setSelectedVoiceIdWithPersist: (id: string | undefined) => Promise<void>;
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
  setSelectedGoogleVoiceIdWithPersist: (voiceId: string) => Promise<void>;
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
  const [selectedGoogleVoiceId, setSelectedGoogleVoiceId] = useState<string>(initialStoryState.selectedGoogleVoiceId || 'Zephyr');
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
  const setSelectedTtsModelWithPersist = useCallback(async (model: 'elevenlabs' | 'google') => {
    setSelectedTtsModel(model);
    const updatedStoryData = { ...storyData, selectedTtsModel: model };
    updateStoryData({ selectedTtsModel: model });
    
    // Auto-save to Baserow if story has ID and user ID
    if (storyData.id && storyData.userId) {
      try {
        const { saveStory } = await import('@/actions/baserowStoryActions');
        await saveStory(updatedStoryData, storyData.userId);
        console.log('[setSelectedTtsModelWithPersist] Auto-saved TTS model to Baserow');
      } catch (error) {
        console.error('[setSelectedTtsModelWithPersist] Failed to auto-save:', error);
      }
    }
  }, [updateStoryData, storyData]);

  const setSelectedGoogleApiModelWithPersist = useCallback(async (model: string) => {
    setSelectedGoogleApiModel(model);
    const updatedStoryData = { ...storyData, selectedGoogleTtsModel: model };
    updateStoryData({ selectedGoogleTtsModel: model });
    
    // Auto-save to Baserow if story has ID and user ID
    if (storyData.id && storyData.userId) {
      try {
        const { saveStory } = await import('@/actions/baserowStoryActions');
        await saveStory(updatedStoryData, storyData.userId);
        console.log('[setSelectedGoogleApiModelWithPersist] Auto-saved Google API model to Baserow');
      } catch (error) {
        console.error('[setSelectedGoogleApiModelWithPersist] Failed to auto-save:', error);
      }
    }
  }, [updateStoryData, storyData]);

  const setSelectedVoiceIdWithPersist = useCallback(async (id: string | undefined) => {
    console.log('[setSelectedVoiceIdWithPersist] Setting ElevenLabs voice:', id);
    setSelectedVoiceId(id);
    const updatedStoryData = { 
      ...storyData, 
      elevenLabsVoiceId: id,
      narrationVoice: id // Also save to narrationVoice for compatibility
    };
    updateStoryData({ 
      elevenLabsVoiceId: id,
      narrationVoice: id 
    });
    
    // Auto-save to Baserow if story has ID and user ID
    if (storyData.id && storyData.userId) {
      try {
        const { saveStory } = await import('@/actions/baserowStoryActions');
        await saveStory(updatedStoryData, storyData.userId);
        console.log('[setSelectedVoiceIdWithPersist] Auto-saved ElevenLabs voice to Baserow');
      } catch (error) {
        console.error('[setSelectedVoiceIdWithPersist] Failed to auto-save:', error);
      }
    }
  }, [updateStoryData, storyData]);

  const setSelectedGoogleVoiceIdWithPersist = useCallback(async (voiceId: string) => {
    console.log('[setSelectedGoogleVoiceIdWithPersist] Setting Google voice:', voiceId);
    setSelectedGoogleVoiceId(voiceId);
    const updatedStoryData = { 
      ...storyData, 
      selectedGoogleVoiceId: voiceId,
      narrationVoice: voiceId // Save Google voice to narrationVoice too
    };
    updateStoryData({ 
      selectedGoogleVoiceId: voiceId,
      narrationVoice: voiceId 
    });
    
    // Auto-save to Baserow if story has ID and user ID
    if (storyData.id && storyData.userId) {
      try {
        const { saveStory } = await import('@/actions/baserowStoryActions');
        await saveStory(updatedStoryData, storyData.userId);
        console.log('[setSelectedGoogleVoiceIdWithPersist] Auto-saved Google voice to Baserow');
      } catch (error) {
        console.error('[setSelectedGoogleVoiceIdWithPersist] Failed to auto-save:', error);
      }
    }
  }, [updateStoryData, storyData]);

  // Enhanced image provider setter that also updates story data
  const setImageProviderWithPersist = useCallback((provider: 'picsart' | 'gemini' | 'imagen3') => {
    setImageProvider(provider);
    updateStoryData({ imageProvider: provider });
  }, [updateStoryData]);

  // Function to restore UI state from loaded story data
  const restoreStateFromStoryData = useCallback((loadedStory: Story) => {
    console.log('[restoreStateFromStoryData] Restoring state from loaded story:', {
      selectedTtsModel: loadedStory.selectedTtsModel,
      elevenLabsVoiceId: loadedStory.elevenLabsVoiceId,
      selectedGoogleVoiceId: loadedStory.selectedGoogleVoiceId,
      narrationVoice: loadedStory.narrationVoice
    });
    
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
      console.log('[restoreStateFromStoryData] Restoring TTS model:', loadedStory.selectedTtsModel);
      setSelectedTtsModel(loadedStory.selectedTtsModel);
    }
    if (loadedStory.selectedGoogleTtsModel) {
      console.log('[restoreStateFromStoryData] Restoring Google TTS model:', loadedStory.selectedGoogleTtsModel);
      setSelectedGoogleApiModel(loadedStory.selectedGoogleTtsModel);
    }
    
    // Restore voice selections based on TTS model
    if (loadedStory.elevenLabsVoiceId) {
      console.log('[restoreStateFromStoryData] Restoring ElevenLabs voice:', loadedStory.elevenLabsVoiceId);
      setSelectedVoiceId(loadedStory.elevenLabsVoiceId);
    }
    if (loadedStory.selectedGoogleVoiceId) {
      console.log('[restoreStateFromStoryData] Restoring Google voice:', loadedStory.selectedGoogleVoiceId);
      setSelectedGoogleVoiceId(loadedStory.selectedGoogleVoiceId);
    }
    
    // Fallback: if narrationVoice is set but specific voice IDs aren't, try to restore from narrationVoice
    if (loadedStory.narrationVoice && !loadedStory.elevenLabsVoiceId && !loadedStory.selectedGoogleVoiceId) {
      console.log('[restoreStateFromStoryData] Using fallback narrationVoice:', loadedStory.narrationVoice, 'for TTS model:', loadedStory.selectedTtsModel);
      
      // Smart fallback: check if the voice name matches known Google voices
      const googleVoiceIds = googleTtsVoices.map(voice => voice.id);
      const isGoogleVoice = googleVoiceIds.includes(loadedStory.narrationVoice);
      
      if (loadedStory.selectedTtsModel === 'google' || isGoogleVoice) {
        console.log('[restoreStateFromStoryData] Setting as Google voice:', loadedStory.narrationVoice);
        setSelectedGoogleVoiceId(loadedStory.narrationVoice);
        // Also ensure TTS model is set to google if it wasn't already
        if (!loadedStory.selectedTtsModel) {
          setSelectedTtsModel('google');
        }
      } else {
        console.log('[restoreStateFromStoryData] Setting as ElevenLabs voice:', loadedStory.narrationVoice);
        setSelectedVoiceId(loadedStory.narrationVoice);
      }
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
    setSelectedVoiceIdWithPersist,
    setSelectedGoogleVoiceIdWithPersist,
    setImageProviderWithPersist,
    
    // State restoration function
    restoreStateFromStoryData,
  };
};

