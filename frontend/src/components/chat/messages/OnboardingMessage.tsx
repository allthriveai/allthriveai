/**
 * OnboardingMessage - Renders onboarding flow steps
 *
 * Features:
 * - Intro message with typewriter greeting
 * - Avatar template selector
 * - Avatar preview with accept/refine/skip
 * - Delegates to individual onboarding components
 */

import {
  OnboardingIntroMessage,
  AvatarTemplateSelector,
  AvatarPreviewMessage,
} from '../onboarding';
import { ChatErrorBoundary } from '../ChatErrorBoundary';
import type { OnboardingMessageProps } from '../core/types';

export function OnboardingMessage({ onboarding }: OnboardingMessageProps) {
  if (!onboarding.isActive) return null;

  switch (onboarding.currentStep) {
    case 'intro':
      return (
        <ChatErrorBoundary resetKey="onboarding-intro">
          <OnboardingIntroMessage
            username={onboarding.username}
            onContinue={onboarding.handleIntroComplete}
            onSkip={onboarding.handleIntroSkip}
          />
        </ChatErrorBoundary>
      );

    case 'avatar-create':
      return (
        <ChatErrorBoundary resetKey="onboarding-avatar-create">
          <AvatarTemplateSelector
            selectedTemplate={onboarding.selectedTemplate}
            onSelectTemplate={onboarding.handleSelectTemplate}
            prompt={onboarding.avatarPrompt}
            onPromptChange={onboarding.handlePromptChange}
            onGenerate={onboarding.handleGenerateAvatar}
            onSkip={onboarding.handleSkipAvatar}
            isGenerating={onboarding.isAvatarGenerating}
            isConnecting={onboarding.isAvatarConnecting}
            error={onboarding.avatarError}
            referenceImageUrl={onboarding.referenceImageUrl ?? undefined}
            onReferenceImageChange={onboarding.handleReferenceImageChange}
          />
        </ChatErrorBoundary>
      );

    case 'avatar-preview':
      return onboarding.generatedAvatarUrl ? (
        <ChatErrorBoundary resetKey="onboarding-avatar-preview">
          <AvatarPreviewMessage
            imageUrl={onboarding.generatedAvatarUrl}
            onAccept={onboarding.handleAcceptAvatar}
            onRefine={onboarding.handleRefineAvatar}
            onSkip={onboarding.handleSkipPreview}
            isAccepting={onboarding.isAvatarSaving}
          />
        </ChatErrorBoundary>
      ) : null;

    case 'complete':
    default:
      return null;
  }
}
