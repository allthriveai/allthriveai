/**
 * InlineChatLayout - Inline chat panel that sits alongside content
 *
 * Features:
 * - Non-overlay design - sits inline with page content
 * - No backdrop blur - feels part of the page
 * - Sage header with avatar and connection status
 * - Context-aware quick actions for learning
 * - Learning setup context support
 * - Neon Glass aesthetic
 * - Integrates with ChatCore via render props
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { createProjectFromImageSession } from '@/services/projects';
import { usePointsNotificationOptional } from '@/context/PointsNotificationContext';
import { checkGitHubConnection } from '@/services/github';
import { checkGitLabConnection } from '@/services/gitlab';
import { checkFigmaConnection } from '@/services/figma';
import {
  ChatCore,
  ChatMessageList,
  ChatInputArea,
  type ChatContext,
  type LearningSetupContext,
  type IntegrationId,
} from '../core';
import { ChatPlusMenu, type IntegrationType } from '../ChatPlusMenu';
import {
  OrchestrationPrompt,
  QuotaExceededBanner,
} from '../messages';
import {
  GitHubFlow,
  GitLabFlow,
  FigmaFlow,
  IntegrationPicker,
} from '../integrations';
import { LearningGoalSelectionMessage } from '../onboarding';
import type { ConceptClickContext } from '@/components/learning/StructuredLearningPath';
import type { ProjectImportOption } from '@/hooks/useIntelligentChat';

// Context-aware quick actions for learning
const LEARN_QUICK_ACTIONS = [
  { label: 'Learn AI Basics', message: 'Teach me the basics of AI' },
  { label: 'Quiz Me', message: 'Give me a quick quiz on what I\'ve learned' },
  { label: 'Create a Learning Path', message: 'Help me create a personalized learning path' },
  { label: 'What Next?', message: 'What should I learn next?' },
];

export interface InlineChatLayoutProps {
  conversationId: string;
  context?: ChatContext;
  learningSetupContext?: LearningSetupContext | null;
  conceptContext?: ConceptClickContext | null;
  createPathTrigger?: number;
  className?: string;
}

export function InlineChatLayout({
  conversationId,
  context = 'learn',
  learningSetupContext = null,
  conceptContext = null,
  createPathTrigger = 0,
  className = '',
}: InlineChatLayoutProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const pointsNotification = usePointsNotificationOptional();
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const triggerFileSelectRef = useRef<(() => void) | null>(null);
  const dropFilesRef = useRef<((files: File[]) => void) | null>(null);

  // Panel-level drag-and-drop state
  const [isPanelDragging, setIsPanelDragging] = useState(false);
  const panelDragCounterRef = useRef(0);

  // Connection status for integrations
  const [connectionStatus, setConnectionStatus] = useState({
    github: false,
    gitlab: false,
    figma: false,
    youtube: false,
    loading: false,
  });

  // Fetch connection statuses
  const fetchConnectionStatuses = useCallback(async () => {
    setConnectionStatus((prev) => ({ ...prev, loading: true }));
    try {
      const [github, gitlab, figma] = await Promise.all([
        checkGitHubConnection().catch(() => false),
        checkGitLabConnection().catch(() => false),
        checkFigmaConnection().catch(() => false),
      ]);
      setConnectionStatus({
        github,
        gitlab,
        figma,
        youtube: false,
        loading: false,
      });
    } catch {
      setConnectionStatus((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  // Track if we've sent the concept context message
  const conceptMessageSentRef = useRef<string | null>(null);

  // Track the createPathTrigger to send message when it changes
  const lastCreatePathTriggerRef = useRef(0);

  // Panel-level drag handlers
  const handlePanelDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    panelDragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsPanelDragging(true);
    }
  }, []);

  const handlePanelDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    panelDragCounterRef.current--;
    if (panelDragCounterRef.current === 0) {
      setIsPanelDragging(false);
    }
  }, []);

  const handlePanelDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handlePanelDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsPanelDragging(false);
    panelDragCounterRef.current = 0;

    // Forward files to the input area's drop handler
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && dropFilesRef.current) {
      const files = Array.from(e.dataTransfer.files);
      dropFilesRef.current(files);
    }
  }, []);

  // Quick actions for learning context
  const quickActions = useMemo(() => LEARN_QUICK_ACTIONS, []);

  // Handle navigation
  const handleNavigate = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  return (
    <ChatCore
      conversationId={conversationId}
      context={context}
      enableOnboarding={false}
      onProjectCreated={(url) => handleNavigate(url)}
    >
      {(state) => {
        // Access extended state for integration flow
        const extendedState = state as typeof state & {
          integrationFlow: ReturnType<typeof import('../integrations').useIntegrationFlow>;
        };
        const integrationFlow = extendedState.integrationFlow;

        // Send concept context message if provided and not already sent
        if (conceptContext && conceptMessageSentRef.current !== conceptContext.conceptSlug) {
          conceptMessageSentRef.current = conceptContext.conceptSlug;
          // Build context-aware message
          const conceptMessage = `Tell me more about "${conceptContext.conceptName}" from my ${conceptContext.topicName} learning path.`;
          // Use setTimeout to avoid updating state during render
          setTimeout(() => {
            state.sendMessage(conceptMessage);
          }, 0);
        }

        // Send "create learning path" message when triggered from outside
        if (createPathTrigger > 0 && createPathTrigger !== lastCreatePathTriggerRef.current) {
          lastCreatePathTriggerRef.current = createPathTrigger;
          setTimeout(() => {
            state.sendMessage('Help me create a personalized learning path');
          }, 0);
        }

        // Determine what to show
        const showLearningSetup = learningSetupContext?.needsSetup && state.messages.length === 0;
        const shouldShowQuickActions = showQuickActions &&
          state.messages.length === 0 &&
          !state.onboarding?.isActive &&
          !showLearningSetup &&
          !conceptContext;

        // Handle quick action click
        const handleQuickAction = (message: string) => {
          setShowQuickActions(false);
          state.sendMessage(message);
        };

        // Handle creating a project from a generated image
        const handleCreateProjectFromImage = async (sessionId: number) => {
          const result = await createProjectFromImageSession(sessionId);

          // Show points notification for project creation (25 pts)
          if (pointsNotification && result.pointsEarned && result.pointsEarned >= 10) {
            pointsNotification.showPointsNotification({
              points: result.pointsEarned,
              title: 'Project Created!',
              message: 'Your creation is now live',
              activityType: 'project_create',
            });
          }

          return {
            projectUrl: result.project.url,
            projectTitle: result.project.title,
          };
        };

        // Handle project import option selection
        const handleProjectImportOptionSelect = (option: ProjectImportOption) => {
          switch (option) {
            case 'integration':
              fetchConnectionStatuses();
              integrationFlow?.actions.startFlow('github');
              break;
            case 'describe':
              state.sendMessage('I want to describe a project idea');
              break;
            case 'url':
              state.sendMessage('I want to import a project from a URL');
              break;
            case 'upload':
              if (triggerFileSelectRef.current) {
                triggerFileSelectRef.current();
              }
              break;
          }
        };

        // Handle integration card selection
        const handleIntegrationCardSelect = (integration: IntegrationId) => {
          integrationFlow?.actions.startFlow(integration);
        };

        // Wrap sendMessage to intercept slash commands
        const handleSendMessage = (message: string, attachments?: File[]) => {
          // Handle /clear command
          if (message.trim().toLowerCase() === '/clear') {
            state.clearMessages();
            setShowQuickActions(true);
            conceptMessageSentRef.current = null;
            return;
          }
          // Pass through to normal send
          state.sendMessage(message, attachments);
        };

        // Handle integration selection from plus menu
        const handleIntegrationSelect = (type: IntegrationType) => {
          if (type === 'clear-conversation') {
            state.clearMessages();
            setShowQuickActions(true);
            conceptMessageSentRef.current = null;
            return;
          }

          // Map integration types to flows or messages
          switch (type) {
            case 'github':
              integrationFlow?.actions.startFlow('github');
              break;
            case 'gitlab':
              integrationFlow?.actions.startFlow('gitlab');
              break;
            case 'figma':
              integrationFlow?.actions.startFlow('figma');
              break;
            case 'youtube':
              state.sendMessage('I want to import a YouTube video as a project');
              break;
            case 'upload-media':
              // Trigger file picker
              if (triggerFileSelectRef.current) {
                triggerFileSelectRef.current();
              }
              break;
            default: {
              const messageMap: Partial<Record<IntegrationType, string>> = {
                'import-url': 'I want to import a project from a URL',
                'create-visual': 'Help me create an image or infographic',
                'describe': 'I want to describe a project to create',
                'ask-help': 'I need help with something',
                'create-product': 'I want to create a product',
              };
              const message = messageMap[type];
              if (message) state.sendMessage(message);
            }
          }
        };

        // Render active integration flow
        const renderIntegrationFlow = () => {
          if (!integrationFlow) return null;
          const { state: integrationState } = integrationFlow;

          if (integrationState.showPicker) {
            return (
              <IntegrationPicker
                isOpen={true}
                onClose={integrationFlow.actions.closePicker}
                onSelect={(integration) => integrationFlow.actions.startFlow(integration)}
                connectionStatus={integrationState.connectionStatus}
              />
            );
          }

          if (integrationState.activeFlow === 'github') {
            return (
              <GitHubFlow
                state={integrationState.github}
                repos={integrationFlow.githubRepos}
                searchQuery={integrationFlow.githubSearchQuery}
                onSearchChange={integrationFlow.setGithubSearchQuery}
                onSelectRepo={integrationFlow.handleSelectGitHubRepo}
                onConnect={integrationFlow.handleConnectGitHub}
                onInstallApp={integrationFlow.handleInstallGitHubApp}
                onBack={integrationFlow.actions.cancelFlow}
              />
            );
          }

          if (integrationState.activeFlow === 'gitlab') {
            return (
              <GitLabFlow
                state={integrationState.gitlab}
                projects={integrationFlow.gitlabProjects}
                searchQuery={integrationFlow.gitlabSearchQuery}
                onSearchChange={integrationFlow.setGitlabSearchQuery}
                onSelectProject={integrationFlow.handleSelectGitLabProject}
                onConnect={integrationFlow.handleConnectGitLab}
                onBack={integrationFlow.actions.cancelFlow}
              />
            );
          }

          if (integrationState.activeFlow === 'figma') {
            return (
              <FigmaFlow
                state={integrationState.figma}
                onConnect={integrationFlow.handleConnectFigma}
                onImportUrl={integrationFlow.handleFigmaUrlImport}
                isFigmaUrl={integrationFlow.isFigmaUrl}
                onBack={integrationFlow.actions.cancelFlow}
              />
            );
          }

          return null;
        };

        const hasActiveIntegration = integrationFlow?.state.activeFlow || integrationFlow?.state.showPicker;

        return (
          <div
            className={`
              flex flex-col h-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm
              border-l border-slate-200 dark:border-white/10 ${className}
            `}
            onDragEnter={handlePanelDragEnter}
            onDragLeave={handlePanelDragLeave}
            onDragOver={handlePanelDragOver}
            onDrop={handlePanelDrop}
          >
            {/* Panel-level drag overlay */}
            {isPanelDragging && (
              <div
                className="absolute inset-0 z-[100] bg-emerald-500/10 border-4 border-dashed border-emerald-400 rounded-lg flex items-center justify-center pointer-events-none"
                style={{
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                }}
              >
                <div className="text-center p-6 rounded-xl bg-white/80 dark:bg-background/80 border border-emerald-500/30">
                  <div className="text-emerald-600 dark:text-emerald-300 text-xl font-semibold mb-2">Drop files here</div>
                  <div className="text-emerald-500/70 dark:text-emerald-400/70 text-sm">
                    Images, videos, and documents supported
                  </div>
                </div>
              </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-3">
                <img
                  src="/sage-avatar.png"
                  alt="Sage"
                  className="w-12 h-12 rounded-full"
                />
                <div>
                  <h2 className="font-semibold text-sm text-slate-900 dark:text-white">Sage</h2>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className={`w-2 h-2 rounded-full ${state.isConnected ? 'bg-green-500 dark:bg-green-400' : 'bg-amber-500 dark:bg-amber-400 animate-pulse'}`} />
                    <span className="text-slate-500 dark:text-slate-400">
                      {state.isConnected ? 'Ready to help you learn' : 'Connecting...'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {hasActiveIntegration ? (
                // Integration flow UI
                <div className="flex-1 overflow-y-auto">
                  {renderIntegrationFlow()}
                </div>
              ) : (
                <>
                  {/* Learning goal selection (when needed) - takes full height */}
                  {showLearningSetup && learningSetupContext ? (
                    <div className="flex-1 overflow-y-auto px-4">
                      <LearningGoalSelectionMessage
                        onSelectGoal={learningSetupContext.onSelectGoal}
                        onSkip={learningSetupContext.onSkip}
                        isPending={learningSetupContext.isPending}
                      />
                    </div>
                  ) : (
                    <>
                      {/* Quick actions (when no messages and no special context) */}
                      {shouldShowQuickActions && (
                        <div className="px-4 py-6 flex-shrink-0">
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                            I'm here to help you learn! What would you like to do?
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {quickActions.map((action) => (
                              <button
                                key={action.label}
                                onClick={() => handleQuickAction(action.message)}
                                className="px-3 py-1.5 rounded-full text-sm font-medium transition-all
                                  bg-gradient-to-r from-emerald-500/10 to-teal-500/10
                                  border border-emerald-500/30
                                  text-emerald-600 dark:text-emerald-300 hover:text-emerald-500 dark:hover:text-emerald-200
                                  hover:border-emerald-400/50 hover:from-emerald-500/20 hover:to-teal-500/20
                                  hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                              >
                                {action.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Chat messages - ChatMessageList handles its own scrolling */}
                      <ChatMessageList
                        messages={state.messages}
                        isLoading={state.isLoading}
                        hasTimedOut={state.hasTimedOut}
                        onRetry={state.retryLastMessage}
                        currentTool={state.currentTool}
                        onCancelProcessing={state.cancelProcessing}
                        userAvatarUrl={user?.avatarUrl}
                        onboarding={state.onboarding}
                        avatarCreation={state.avatarCreation}
                        onNavigate={handleNavigate}
                        onCreateProjectFromImage={handleCreateProjectFromImage}
                        onProjectImportOptionSelect={handleProjectImportOptionSelect}
                        onIntegrationSelect={handleIntegrationCardSelect}
                        connectionStatus={connectionStatus}
                        onConnectFigma={integrationFlow?.handleConnectFigma}
                        onFigmaUrlSubmit={integrationFlow?.handleFigmaUrlImport}
                        onInlineActionClick={(message) => state.sendMessage(message)}
                      />

                      {/* Pending action confirmation */}
                      {state.pendingAction && (
                        <OrchestrationPrompt
                          action={state.pendingAction}
                          onConfirm={state.confirmPendingAction}
                          onCancel={state.cancelPendingAction}
                          variant="neon"
                        />
                      )}

                      {/* Quota exceeded banner */}
                      {state.quotaExceeded && (
                        <QuotaExceededBanner
                          info={state.quotaExceeded}
                          onDismiss={state.dismissQuotaExceeded}
                          onNavigate={handleNavigate}
                          variant="neon"
                        />
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            {/* Input Area - hide when learning setup is shown */}
            {!hasActiveIntegration && !showLearningSetup && (
              <ChatInputArea
                onSendMessage={handleSendMessage}
                isLoading={state.isLoading}
                isUploading={state.isUploading}
                onCancelUpload={state.cancelUpload}
                placeholder="Ask me anything about learning..."
                enableAttachments={true}
                onFileSelectRef={(fn) => { triggerFileSelectRef.current = fn; }}
                onDropFilesRef={(fn) => { dropFilesRef.current = fn; }}
                prefix={
                  <ChatPlusMenu
                    onIntegrationSelect={handleIntegrationSelect}
                    disabled={state.isLoading}
                    isOpen={plusMenuOpen}
                    onOpenChange={setPlusMenuOpen}
                  />
                }
              />
            )}
          </div>
        );
      }}
    </ChatCore>
  );
}
