/**
 * useOnboardingChat Hook
 *
 * Orchestrates the onboarding flow within the intelligent chat:
 * 1. Shows intro message with typewriter effect
 * 2. Avatar creation with templates and prompt input
 * 3. Avatar preview with accept/refine/skip options
 * 4. Path selection (Play/Learn/Personalize)
 * 5. Completes onboarding and transitions to normal chat
 *
 * Integrates with:
 * - useEmberOnboarding for persistence
 * - useAvatarGeneration for avatar WebSocket streaming
 * - useAuth for user info
 */

import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEmberOnboarding, type AdventureId } from '@/hooks/useEmberOnboarding';
import { useAvatarGeneration } from '@/hooks/useAvatarGeneration';
import type { ChatMessage, AvatarTemplate, PathOption, IntelligentChatMetadata } from '@/hooks/useIntelligentChat';
import { defaultAvatarTemplates } from '@/components/chat/onboarding/AvatarTemplateSelector';
import { defaultPathOptions } from '@/components/chat/onboarding/PathSelectionMessage';

export type OnboardingStep =
  | 'intro'
  | 'avatar-create'
  | 'avatar-preview'
  | 'choose-path'
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
  selectedPath: string | null;
}

export function useOnboardingChat({
  onComplete,
  onAvatarSaved,
}: UseOnboardingChatOptions = {}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    shouldShowModal: shouldShowOnboarding,
    markModalSeen,
    completeAdventure,
    dismissOnboarding,
    isLoaded: onboardingLoaded,
  } = useEmberOnboarding();

  // Onboarding state
  const [state, setState] = useState<OnboardingChatState>({
    step: 'intro',
    selectedTemplate: null,
    avatarPrompt: '',
    generatedAvatarUrl: null,
    selectedPath: null,
  });

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
    onAvatarSaved: () => {
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
    if (state.step === 'avatar-create' || state.step === 'avatar-preview' || state.step === 'choose-path') {
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
    if (state.step === 'avatar-preview' || (state.step === 'choose-path' && state.generatedAvatarUrl)) {
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

    // Show path selection after avatar is done
    if (state.step === 'choose-path') {
      messages.push({
        id: 'onboarding-path-selection',
        content: '',
        sender: 'assistant',
        timestamp: new Date(),
        metadata: {
          type: 'onboarding_path_selection',
          onboardingStep: 'choose-path',
          pathOptions: defaultPathOptions,
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
    setState((prev) => ({ ...prev, step: 'choose-path' }));
  }, [markModalSeen]);

  // Handlers for avatar creation
  const handleSelectTemplate = useCallback((templateId: string) => {
    setState((prev) => ({ ...prev, selectedTemplate: templateId }));
  }, []);

  const handlePromptChange = useCallback((prompt: string) => {
    setState((prev) => ({ ...prev, avatarPrompt: prompt }));
  }, []);

  const handleGenerateAvatar = useCallback(async () => {
    if (!state.avatarPrompt.trim()) return;

    // Start avatar session if not already started
    // Use 'template' mode if a template was selected, otherwise 'scratch'
    const creationMode = state.selectedTemplate ? 'template' : 'scratch';
    const session = await startSession(creationMode, state.selectedTemplate || undefined);
    if (session) {
      generateAvatar(state.avatarPrompt);
    }
  }, [state.avatarPrompt, state.selectedTemplate, startSession, generateAvatar]);

  const handleSkipAvatar = useCallback(() => {
    abandonSession();
    setState((prev) => ({ ...prev, step: 'choose-path' }));
  }, [abandonSession]);

  // Handlers for avatar preview
  const handleAcceptAvatar = useCallback(async () => {
    if (currentIteration) {
      await acceptIteration(currentIteration.id);
      completeAdventure('personalize');
      setState((prev) => ({ ...prev, step: 'choose-path' }));
    }
  }, [currentIteration, acceptIteration, completeAdventure]);

  const handleRefineAvatar = useCallback(() => {
    setState((prev) => ({
      ...prev,
      step: 'avatar-create',
      generatedAvatarUrl: null,
    }));
  }, []);

  const handleSkipPreview = useCallback(() => {
    abandonSession();
    setState((prev) => ({ ...prev, step: 'choose-path' }));
  }, [abandonSession]);

  // Handlers for path selection
  const handleSelectPath = useCallback((path: PathOption) => {
    setState((prev) => ({ ...prev, selectedPath: path.id }));

    // Complete the relevant adventure based on path
    const adventureMap: Record<string, AdventureId> = {
      play: 'play',
      learn: 'learn',
      personalize: 'personalize',
    };
    if (adventureMap[path.id]) {
      completeAdventure(adventureMap[path.id]);
    }

    // Mark onboarding as complete
    setState((prev) => ({ ...prev, step: 'complete' }));

    // Notify completion
    onComplete?.();

    // Navigate to the selected path
    navigate(path.path);
  }, [completeAdventure, navigate, onComplete]);

  // Skip entire onboarding
  const handleDismissOnboarding = useCallback(() => {
    dismissOnboarding();
    disconnectAvatar();
    setState((prev) => ({ ...prev, step: 'complete' }));
    onComplete?.();
  }, [dismissOnboarding, disconnectAvatar, onComplete]);

  // Check if we should show onboarding
  const isOnboardingActive = shouldShowOnboarding && state.step !== 'complete';

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
    selectedPath: state.selectedPath,
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
    handleGenerateAvatar,
    handleSkipAvatar,

    // Avatar preview handlers
    handleAcceptAvatar,
    handleRefineAvatar,
    handleSkipPreview,

    // Path selection handlers
    handleSelectPath,

    // General handlers
    handleDismissOnboarding,
  };
}

export type { AvatarTemplate, PathOption };
