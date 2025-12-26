/**
 * ChatCore - The unified chat component using render props pattern
 *
 * This is the single source of truth for chat logic. It composes:
 * - useIntelligentChat for WebSocket connection and messages
 * - useOnboardingChat for onboarding flow
 * - useOrchestrationActions for Ember's navigation/highlight actions
 * - useIntegrationFlow for GitHub/GitLab/Figma integrations
 *
 * Features:
 * - Render props pattern for maximum flexibility
 * - Exposes all state and actions to children
 * - Handles quota exceeded notifications
 * - Manages pending orchestration actions
 * - File upload with drag-and-drop support
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { useIntelligentChat, type OrchestrationAction, type QuotaExceededInfo } from '@/hooks/useIntelligentChat';
import { useOnboardingChat } from '@/hooks/useOnboardingChat';
import { useOrchestrationActions } from '@/hooks/useOrchestrationActions';
import { useStandaloneAvatarCreation } from '@/hooks/useStandaloneAvatarCreation';
import { useIntegrationFlow } from '../integrations';
import { uploadImage, uploadFile } from '@/services/upload';
import { logError } from '@/utils/errorHandler';
import type { ChatCoreProps, ChatCoreState, OnboardingState } from './types';

export function ChatCore({
  conversationId,
  context = 'default',
  enableOnboarding = false,
  onProjectCreated,
  onClose: _onClose,
  children,
}: ChatCoreProps) {
  // Quota exceeded state
  const [quotaExceeded, setQuotaExceeded] = useState<QuotaExceededInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track if user has interacted (for UI purposes)
  const [hasInteracted, setHasInteracted] = useState(false);

  // File upload state
  const [isUploading, setIsUploading] = useState(false);
  const uploadAbortControllerRef = useRef<AbortController | null>(null);

  // Orchestration actions hook
  const {
    executeAction: executeOrchestrationAction,
    pendingAction: rawPendingAction,
    confirmPendingAction: confirmOrchestration,
    cancelPendingAction: cancelOrchestration,
  } = useOrchestrationActions();

  // Handle orchestration action from AI
  const handleOrchestrationAction = useCallback((action: OrchestrationAction) => {
    executeOrchestrationAction(action);
  }, [executeOrchestrationAction]);

  // Handle quota exceeded
  const handleQuotaExceeded = useCallback((info: QuotaExceededInfo) => {
    setQuotaExceeded(info);
  }, []);

  // Handle error
  const handleError = useCallback((errorMsg: string) => {
    setError(errorMsg);
    // Auto-clear error after 10 seconds
    setTimeout(() => setError(null), 10000);
  }, []);

  // Intelligent chat hook
  const {
    messages,
    isConnected,
    isConnecting,
    isLoading,
    currentTool,
    sendMessage: rawSendMessage,
    sendMessageWithImage: rawSendMessageWithImage,
    clearMessages,
    cancelProcessing,
    addLocalMessage,
  } = useIntelligentChat({
    conversationId,
    onOrchestrationAction: handleOrchestrationAction,
    onProjectCreated: (url, title) => {
      onProjectCreated?.(url, title);
    },
    onQuotaExceeded: handleQuotaExceeded,
    onError: handleError,
  });

  // Cancel upload handler
  const cancelUpload = useCallback(() => {
    if (uploadAbortControllerRef.current) {
      uploadAbortControllerRef.current.abort();
      uploadAbortControllerRef.current = null;
    }
    setIsUploading(false);
  }, []);

  // Wrap sendMessage to handle file uploads
  const sendMessage = useCallback(async (content: string, attachments?: File[]) => {
    if (!content.trim() && (!attachments || attachments.length === 0)) return;
    if (isLoading || isUploading) return;

    setHasInteracted(true);

    // Handle file attachments if present
    if (attachments && attachments.length > 0) {
      const abortController = new AbortController();
      uploadAbortControllerRef.current = abortController;
      setIsUploading(true);

      try {
        const uploadedImages: { name: string; url: string }[] = [];
        const uploadedFiles: { name: string; url: string; type: string; extractedText?: string }[] = [];

        for (const file of attachments) {
          // Check if upload was cancelled
          if (abortController.signal.aborted) {
            throw new Error('Upload cancelled');
          }

          const isImage = file.type.startsWith('image/');

          if (isImage) {
            const result = await uploadImage(file, 'chat-attachments', true, abortController.signal);
            uploadedImages.push({
              name: file.name,
              url: result.url,
            });
          } else {
            const result = await uploadFile(file, 'chat-attachments', true, abortController.signal);
            uploadedFiles.push({
              name: file.name,
              url: result.url,
              type: result.fileType,
              extractedText: result.extractedText, // PDF text content for AI processing
            });
          }
        }

        // If there's exactly one image and no other files, use multimodal message
        // so Ember can see the image for the upload → ownership → tool flow
        if (uploadedImages.length === 1 && uploadedFiles.length === 0) {
          const imageUrl = uploadedImages[0].url;
          // Use markdown format that UserMessage can render as an inline image
          // Don't ask to "analyze" - Ember should ask about ownership and tool used
          const imageMarkdown = `[Image: ${uploadedImages[0].name}](${imageUrl})`;
          const messageText = content.trim() ? `${content.trim()}\n\n${imageMarkdown}` : imageMarkdown;
          rawSendMessageWithImage(messageText, imageUrl);
        } else {
          // Multiple files or mixed files - build message with file info
          const fileDescriptions: string[] = [];
          const pdfContents: string[] = [];

          // Add image descriptions
          uploadedImages.forEach(f => {
            fileDescriptions.push(`[Image: ${f.name}](${f.url})`);
          });

          // Add file descriptions, with PDF text content if available
          uploadedFiles.forEach(f => {
            if (f.extractedText && f.type === 'application/pdf') {
              // For PDFs with extracted text, include the actual content for AI to process
              pdfContents.push(`[Resume/Document content from ${f.name}]:\n\n${f.extractedText}`);
            } else {
              fileDescriptions.push(`[File: ${f.name}](${f.url})`);
            }
          });

          // Build the full message
          let messageWithAttachments = content.trim();

          // Add file descriptions (links for images and non-PDF files)
          if (fileDescriptions.length > 0) {
            const descriptions = fileDescriptions.join('\n');
            messageWithAttachments = messageWithAttachments
              ? `${messageWithAttachments}\n\n${descriptions}`
              : descriptions;
          }

          // Add PDF content (extracted text for AI to analyze)
          if (pdfContents.length > 0) {
            const pdfText = pdfContents.join('\n\n---\n\n');
            messageWithAttachments = messageWithAttachments
              ? `${messageWithAttachments}\n\n${pdfText}`
              : pdfText;
          }

          rawSendMessage(messageWithAttachments);
        }
      } catch (uploadError: unknown) {
        // Handle cancellation gracefully
        const err = uploadError as Error & { name?: string; message?: string; statusCode?: number; error?: string };
        if (err?.name === 'AbortError' || err?.name === 'CanceledError' || err?.message === 'Upload cancelled') {
          return;
        }

        logError('ChatCore.sendMessage', err, { attachmentCount: attachments.length });

        // Show error to user
        const errorMessage = err?.error || err?.message || 'Unknown error';
        const statusCode = err?.statusCode;
        if (statusCode === 401) {
          setError('Authentication required. Please refresh the page and try again.');
        } else if (statusCode === 400) {
          setError(`Upload failed: ${errorMessage}`);
        } else {
          setError(`Failed to upload files: ${errorMessage}`);
        }
      } finally {
        setIsUploading(false);
        uploadAbortControllerRef.current = null;
      }
    } else {
      // No attachments, send message directly
      rawSendMessage(content);
    }
  }, [rawSendMessage, rawSendMessageWithImage, isLoading, isUploading]);

  // Integration flow hook
  const integrationFlow = useIntegrationFlow({
    onSendMessage: sendMessage,
    onHasInteracted: () => setHasInteracted(true),
    onAddLocalMessage: addLocalMessage,
  });

  // Onboarding hook (only if enabled)
  const onboarding = useOnboardingChat({
    onComplete: () => {
      // Onboarding complete - no specific action needed
    },
  });

  // Standalone avatar creation hook (listens for 'open-avatar-creation' event)
  const avatarCreation = useStandaloneAvatarCreation();

  // Build onboarding state for children
  const onboardingState = useMemo((): OnboardingState | null => {
    if (!enableOnboarding) return null;

    return {
      isActive: onboarding.isOnboardingActive,
      currentStep: onboarding.currentStep,
      username: onboarding.username,
      selectedTemplate: onboarding.selectedTemplate,
      avatarPrompt: onboarding.avatarPrompt,
      referenceImageUrl: onboarding.referenceImageUrl,
      generatedAvatarUrl: onboarding.generatedAvatarUrl,
      isAvatarConnecting: onboarding.isAvatarConnecting,
      isAvatarGenerating: onboarding.isAvatarGenerating,
      isAvatarSaving: onboarding.isAvatarSaving,
      avatarError: onboarding.avatarError,
      handleIntroComplete: onboarding.handleIntroComplete,
      handleIntroSkip: onboarding.handleIntroSkip,
      handleSelectTemplate: onboarding.handleSelectTemplate,
      handlePromptChange: onboarding.handlePromptChange,
      handleReferenceImageChange: onboarding.handleReferenceImageChange,
      handleGenerateAvatar: onboarding.handleGenerateAvatar,
      handleSkipAvatar: onboarding.handleSkipAvatar,
      handleAcceptAvatar: onboarding.handleAcceptAvatar,
      handleRefineAvatar: onboarding.handleRefineAvatar,
      handleSkipPreview: onboarding.handleSkipPreview,
    };
  }, [enableOnboarding, onboarding]);

  // Use pending action directly from the hook (it already has description)
  const pendingAction = rawPendingAction;

  // Build state object for children
  const state: ChatCoreState = {
    // Connection
    isConnected,
    isConnecting,
    isLoading,
    currentTool,

    // File upload
    isUploading,
    cancelUpload,

    // Messages
    messages,
    sendMessage,
    clearMessages,
    cancelProcessing,

    // Integrations
    integrationState: integrationFlow.state,
    integrationActions: integrationFlow.actions,

    // Onboarding
    onboarding: onboardingState,

    // Standalone avatar creation
    avatarCreation,

    // Orchestration
    pendingAction,
    confirmPendingAction: confirmOrchestration,
    cancelPendingAction: cancelOrchestration,

    // UI State
    quotaExceeded,
    dismissQuotaExceeded: () => setQuotaExceeded(null),
    error,
    clearError: () => setError(null),
  };

  // Expose integration flow details for components that need them
  // This is passed via context or directly
  const extendedState = {
    ...state,
    // For components that need direct access to integration flow
    integrationFlow,
    hasInteracted,
    context,
  };

  return <>{children(extendedState as ChatCoreState)}</>;
}
