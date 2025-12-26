/**
 * useOnboardingChat Hook
 *
 * Orchestrates the simplified onboarding flow:
 * 1. Shows intro message with typewriter effect
 * 2. Avatar creation with templates and prompt input
 * 3. Avatar preview with accept/refine/skip options
 * 4. Completes onboarding → user lands on feelings-first home chat
 *
 * Integrates with:
 * - useAvaOnboarding for persistence
 * - useAvatarGeneration for avatar WebSocket streaming
 * - useAuth for user info
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAvaOnboarding } from '@/hooks/useAvaOnboarding';
import { useAvatarGeneration } from '@/hooks/useAvatarGeneration';
import type { ChatMessage, AvatarTemplate, IntelligentChatMetadata } from '@/hooks/useIntelligentChat';
import { defaultAvatarTemplates } from '@/components/chat/onboarding/AvatarTemplateSelector';

export type OnboardingStep =
  | 'intro'
  | 'avatar-create'
  | 'avatar-preview'
  | 'complete';

export interface UseOnboardingChatOptions {
  onComplete?: () => void;
  onAvatarSaved?: () => void;
}

export interface OnboardingChatState {
  step: OnboardingStep;
  selectedTemplate: string | null;
  avatarPrompt: string;
  generatedAvatarUrl: string | null;
  referenceImageUrl: string | null;
}

export function useOnboardingChat({
  onComplete,
  onAvatarSaved,
}: UseOnboardingChatOptions = {}) {
  const { user, refreshUser } = useAuth();
  const {
    shouldShowModal: shouldShowOnboarding,
    markModalSeen,
    completeAdventure,
    dismissOnboarding,
    isLoaded: onboardingLoaded,
  } = useAvaOnboarding();

  // Onboarding state
  const [state, setState] = useState<OnboardingChatState>({
    step: 'intro',
    selectedTemplate: null,
    avatarPrompt: '',
    generatedAvatarUrl: null,
    referenceImageUrl: null,
  });

  // Use ref to always have latest referenceImageUrl (avoids stale closure issues)
  const referenceImageUrlRef = useRef<string | null>(null);
  useEffect(() => {
    referenceImageUrlRef.current = state.referenceImageUrl;
  }, [state.referenceImageUrl]);

  // Avatar generation
  const {
    isConnecting: avatarConnecting,
    isGenerating: avatarGenerating,
    isSaving: avatarSaving,
    error: avatarError,
    currentIteration,
    startSession,
    generateAvatar,
    acceptIteration,
    abandonSession,
    disconnect: disconnectAvatar,
  } = useAvatarGeneration({
    onAvatarGenerated: (iteration) => {
      // Move to preview step when avatar is generated
      setState((prev) => ({
        ...prev,
        generatedAvatarUrl: iteration.imageUrl,
        step: 'avatar-preview',
      }));
    },
    onAvatarSaved: async () => {
      // Refresh user to get updated avatar URL
      await refreshUser();
      onAvatarSaved?.();
    },
    onError: (error) => {
      console.error('[OnboardingChat] Avatar error:', error);
    },
  });

  // Generate onboarding messages based on current step
  const onboardingMessages = useMemo((): ChatMessage[] => {
    const messages: ChatMessage[] = [];

    // Always show intro message first
    messages.push({
      id: 'onboarding-intro',
      content: '',
      sender: 'assistant',
      timestamp: new Date(),
      metadata: {
        type: 'onboarding_intro',
        onboardingStep: 'intro',
      } as IntelligentChatMetadata,
    });

    // Show avatar creation after intro is advanced
    if (state.step === 'avatar-create' || state.step === 'avatar-preview') {
      messages.push({
        id: 'onboarding-avatar-prompt',
        content: '',
        sender: 'assistant',
        timestamp: new Date(),
        metadata: {
          type: 'onboarding_avatar_prompt',
          onboardingStep: 'avatar-create',
          avatarTemplates: defaultAvatarTemplates,
        } as IntelligentChatMetadata,
      });
    }

    // Show avatar preview when generated
    if (state.step === 'avatar-preview' && state.generatedAvatarUrl) {
      messages.push({
        id: 'onboarding-avatar-preview',
        content: '',
        sender: 'assistant',
        timestamp: new Date(),
        metadata: {
          type: 'onboarding_avatar_preview',
          onboardingStep: 'avatar-preview',
          avatarImageUrl: state.generatedAvatarUrl || undefined,
        } as IntelligentChatMetadata,
      });
    }

    return messages;
  }, [state.step, state.generatedAvatarUrl]);

  // Handlers for intro step
  const handleIntroComplete = useCallback(() => {
    markModalSeen();
    setState((prev) => ({ ...prev, step: 'avatar-create' }));
  }, [markModalSeen]);

  const handleIntroSkip = useCallback(() => {
    markModalSeen();
    setState((prev) => ({ ...prev, step: 'complete' }));
    onComplete?.();
  }, [markModalSeen, onComplete]);

  // Handlers for avatar creation
  const handleSelectTemplate = useCallback((templateId: string) => {
    setState((prev) => ({ ...prev, selectedTemplate: templateId }));
  }, []);

  const handlePromptChange = useCallback((prompt: string) => {
    setState((prev) => ({ ...prev, avatarPrompt: prompt }));
  }, []);

  const handleReferenceImageChange = useCallback((url: string | null) => {
    // Update ref immediately (synchronous) to avoid stale closure issues
    referenceImageUrlRef.current = url;
    setState((prev) => ({ ...prev, referenceImageUrl: url }));
  }, []);

  const handleGenerateAvatar = useCallback(async () => {
    // Use ref to get latest referenceImageUrl (avoids stale closure)
    const currentReferenceImageUrl = referenceImageUrlRef.current;

    if (!state.avatarPrompt.trim()) return;

    // Start avatar session if not already started
    // Use 'make_me' mode if a reference image is provided, 'template' if template selected, otherwise 'scratch'
    let creationMode: 'scratch' | 'template' | 'make_me' = 'scratch';
    if (currentReferenceImageUrl) {
      creationMode = 'make_me';
    } else if (state.selectedTemplate && state.selectedTemplate !== 'make_me') {
      creationMode = 'template';
    }

    const session = await startSession(
      creationMode,
      state.selectedTemplate || undefined,
      currentReferenceImageUrl || undefined
    );
    if (session) {
      generateAvatar(state.avatarPrompt, currentReferenceImageUrl || undefined);
    }
  }, [state.avatarPrompt, state.selectedTemplate, state.referenceImageUrl, startSession, generateAvatar]);

  const handleSkipAvatar = useCallback(() => {
    abandonSession();
    setState((prev) => ({ ...prev, step: 'complete' }));
    onComplete?.();
  }, [abandonSession, onComplete]);

  // Handlers for avatar preview
  const handleAcceptAvatar = useCallback(async () => {
    if (currentIteration) {
      await acceptIteration(currentIteration.id);
      completeAdventure('personalize');
      setState((prev) => ({ ...prev, step: 'complete' }));
      onComplete?.();
    }
  }, [currentIteration, acceptIteration, completeAdventure, onComplete]);

  const handleRefineAvatar = useCallback(() => {
    setState((prev) => ({
      ...prev,
      step: 'avatar-create',
      generatedAvatarUrl: null,
    }));
  }, []);

  const handleSkipPreview = useCallback(() => {
    abandonSession();
    setState((prev) => ({ ...prev, step: 'complete' }));
    onComplete?.();
  }, [abandonSession, onComplete]);

  // Skip entire onboarding
  const handleDismissOnboarding = useCallback(() => {
    dismissOnboarding();
    disconnectAvatar();
    setState((prev) => ({ ...prev, step: 'complete' }));
    onComplete?.();
  }, [dismissOnboarding, disconnectAvatar, onComplete]);

  // Check if we should show onboarding
  // Once onboarding starts (shouldShowModal was true initially), keep it active
  // until the step is 'complete', even after markModalSeen is called.
  // The hasSeenModal flag only prevents onboarding from showing on *future* visits.
  const isOnboardingActive = (shouldShowOnboarding || state.step !== 'intro') && state.step !== 'complete';

  // Username for greeting
  const username = user?.firstName || user?.username || '';

  return {
    // State
    isOnboardingActive,
    onboardingLoaded,
    currentStep: state.step,
    onboardingMessages,
    selectedTemplate: state.selectedTemplate,
    avatarPrompt: state.avatarPrompt,
    generatedAvatarUrl: state.generatedAvatarUrl,
    referenceImageUrl: state.referenceImageUrl,
    username,

    // Avatar generation state
    isAvatarConnecting: avatarConnecting,
    isAvatarGenerating: avatarGenerating,
    isAvatarSaving: avatarSaving,
    avatarError,

    // Intro handlers
    handleIntroComplete,
    handleIntroSkip,

    // Avatar creation handlers
    handleSelectTemplate,
    handlePromptChange,
    handleReferenceImageChange,
    handleGenerateAvatar,
    handleSkipAvatar,

    // Avatar preview handlers
    handleAcceptAvatar,
    handleRefineAvatar,
    handleSkipPreview,

    // General handlers
    handleDismissOnboarding,
  };
}

export type { AvatarTemplate };
