/**
 * useStandaloneAvatarCreation Hook
 *
 * Manages avatar creation flow outside of onboarding.
 * Triggered via the 'open-avatar-creation' custom event from AI agents.
 *
 * Steps:
 * 1. avatar-create: Template selection and prompt input
 * 2. avatar-preview: Show generated avatar with accept/refine options
 * 3. complete: Avatar saved, flow closed
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAvatarGeneration } from '@/hooks/useAvatarGeneration';

export type AvatarCreationStep = 'avatar-create' | 'avatar-preview' | 'complete';

export interface StandaloneAvatarCreationState {
  isActive: boolean;
  currentStep: AvatarCreationStep;
  selectedTemplate: string | null;
  avatarPrompt: string;
  referenceImageUrl: string | null;
  generatedAvatarUrl: string | null;
  isConnecting: boolean;
  isGenerating: boolean;
  isSaving: boolean;
  error: string | null;
}

export interface UseStandaloneAvatarCreationReturn extends StandaloneAvatarCreationState {
  // Actions
  activate: () => void;
  close: () => void;
  handleSelectTemplate: (templateId: string) => void;
  handlePromptChange: (prompt: string) => void;
  handleReferenceImageChange: (url: string | null) => void;
  handleGenerate: () => Promise<void>;
  handleAccept: () => Promise<void>;
  handleRefine: () => void;
  handleSkip: () => void;
}

export function useStandaloneAvatarCreation(): UseStandaloneAvatarCreationReturn {
  const { isAuthenticated, refreshUser } = useAuth();

  // State
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState<AvatarCreationStep>('avatar-create');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [avatarPrompt, setAvatarPrompt] = useState('');
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null);
  const [generatedAvatarUrl, setGeneratedAvatarUrl] = useState<string | null>(null);

  // Use ref to always have latest referenceImageUrl (avoids stale closure issues)
  const referenceImageUrlRef = useRef<string | null>(null);
  useEffect(() => {
    referenceImageUrlRef.current = referenceImageUrl;
  }, [referenceImageUrl]);

  // Avatar generation hook
  const {
    isConnecting,
    isGenerating,
    isSaving,
    error,
    currentIteration,
    startSession,
    generateAvatar,
    acceptIteration,
    abandonSession,
    reset: resetAvatar,
  } = useAvatarGeneration({
    onAvatarGenerated: (iteration) => {
      setGeneratedAvatarUrl(iteration.imageUrl);
      setCurrentStep('avatar-preview');
    },
    onAvatarSaved: async () => {
      await refreshUser();
      handleClose();
    },
    onError: () => {
      // Error handling is done via state - backend logs details
    },
  });

  // Close/reset the flow
  const handleClose = useCallback(() => {
    setIsActive(false);
    setCurrentStep('avatar-create');
    setSelectedTemplate(null);
    setAvatarPrompt('');
    setReferenceImageUrl(null);
    setGeneratedAvatarUrl(null);
    resetAvatar();
  }, [resetAvatar]);

  // Activate the flow
  const activate = useCallback(() => {
    if (isAuthenticated) {
      setIsActive(true);
      setCurrentStep('avatar-create');
    }
  }, [isAuthenticated]);

  // Listen for the custom event
  useEffect(() => {
    const handleOpenAvatarCreation = () => {
      activate();
    };

    window.addEventListener('open-avatar-creation', handleOpenAvatarCreation);
    return () => {
      window.removeEventListener('open-avatar-creation', handleOpenAvatarCreation);
    };
  }, [activate]);

  // Handlers
  const handleSelectTemplate = useCallback((templateId: string) => {
    setSelectedTemplate(templateId);
  }, []);

  const handlePromptChange = useCallback((prompt: string) => {
    setAvatarPrompt(prompt);
  }, []);

  const handleReferenceImageChange = useCallback((url: string | null) => {
    referenceImageUrlRef.current = url;
    setReferenceImageUrl(url);
  }, []);

  const handleGenerate = useCallback(async () => {
    const currentReferenceImageUrl = referenceImageUrlRef.current;

    if (!avatarPrompt.trim()) return;

    // Determine creation mode
    let creationMode: 'scratch' | 'template' | 'make_me' = 'scratch';
    if (currentReferenceImageUrl) {
      creationMode = 'make_me';
    } else if (selectedTemplate && selectedTemplate !== 'make_me') {
      creationMode = 'template';
    }

    const session = await startSession(
      creationMode,
      selectedTemplate || undefined,
      currentReferenceImageUrl || undefined
    );

    if (session) {
      generateAvatar(avatarPrompt, currentReferenceImageUrl || undefined);
    }
  }, [avatarPrompt, selectedTemplate, startSession, generateAvatar]);

  const handleAccept = useCallback(async () => {
    if (currentIteration) {
      await acceptIteration(currentIteration.id);
    }
  }, [currentIteration, acceptIteration]);

  const handleRefine = useCallback(() => {
    setCurrentStep('avatar-create');
    setGeneratedAvatarUrl(null);
  }, []);

  const handleSkip = useCallback(() => {
    abandonSession();
    handleClose();
  }, [abandonSession, handleClose]);

  return {
    // State
    isActive,
    currentStep,
    selectedTemplate,
    avatarPrompt,
    referenceImageUrl,
    generatedAvatarUrl,
    isConnecting,
    isGenerating,
    isSaving,
    error,

    // Actions
    activate,
    close: handleClose,
    handleSelectTemplate,
    handlePromptChange,
    handleReferenceImageChange,
    handleGenerate,
    handleAccept,
    handleRefine,
    handleSkip,
  };
}
