/**
 * SidebarChatLayout - Sliding panel chat layout for sidebar tray
 *
 * Features:
 * - Sliding panel from right side
 * - Ember header with avatar and connection status
 * - Context-aware quick actions
 * - Integration picker and flows
 * - Architecture regeneration support
 * - Learning setup context support
 * - Neon Glass aesthetic
 * - Integrates with ChatCore via render props
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExpand, faCompress } from '@fortawesome/free-solid-svg-icons';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { createProjectFromImageSession } from '@/services/projects';
import {
  ChatCore,
  ChatMessageList,
  ChatInputArea,
  type ChatContext,
  type ArchitectureRegenerateContext,
  type ProfileGenerateContext,
  type LearningSetupContext,
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

// Context-aware quick actions
const QUICK_ACTIONS: Record<ChatContext, Array<{ label: string; message: string }>> = {
  learn: [
    { label: 'Learn AI Basics', message: 'Teach me the basics of AI' },
    { label: 'Quiz Me', message: 'Give me a quick quiz on what I\'ve learned' },
    { label: 'My Progress', message: 'Show me my learning progress' },
    { label: 'What Next?', message: 'What should I learn next?' },
  ],
  explore: [
    { label: 'Trending Projects', message: 'Show me trending projects' },
    { label: 'Find Projects', message: 'Help me find interesting projects' },
    { label: 'Recommend For Me', message: 'Recommend projects based on my interests' },
    { label: 'Similar Projects', message: 'Find projects similar to what I\'ve liked' },
  ],
  project: [
    { label: 'Paste a URL', message: 'I want to import a project from a URL' },
    { label: 'Make Infographic', message: 'Help me create an image or infographic' },
    { label: 'From GitHub', message: 'I want to import a project from GitHub' },
    { label: 'Upload Media', message: 'I want to upload media to create a project' },
  ],
  default: [
    { label: 'I need help', message: 'I need help with something' },
    { label: 'I don\'t know what to do next', message: 'What can I do on AllThrive?' },
    { label: 'I want to do something fun', message: 'Suggest something fun for me to do' },
  ],
};

interface SidebarChatLayoutProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  context?: ChatContext;
  // Special contexts for DashboardLayout compatibility
  architectureRegenerateContext?: ArchitectureRegenerateContext | null;
  profileGenerateContext?: ProfileGenerateContext | null;
  learningSetupContext?: LearningSetupContext | null;
  // Expand mode for learning sessions
  defaultExpanded?: boolean;
}

// Helper component to handle effects that need to run inside ChatCore
function ArchitectureMessageSender({
  architectureRegenerateContext,
  isConnected,
  isLoading,
  messagesLength,
  sendMessage,
}: {
  architectureRegenerateContext: ArchitectureRegenerateContext | null;
  isConnected: boolean;
  isLoading: boolean;
  messagesLength: number;
  sendMessage: (message: string) => void;
}) {
  const sentRef = useRef(false);

  useEffect(() => {
    if (
      architectureRegenerateContext &&
      isConnected &&
      !sentRef.current &&
      !isLoading &&
      messagesLength === 0
    ) {
      const initialMessage = `The architecture diagram on my project "${architectureRegenerateContext.projectTitle}" (ID: ${architectureRegenerateContext.projectId}) is wrong, can you help me fix it?`;
      sendMessage(initialMessage);
      sentRef.current = true;
    }
  }, [architectureRegenerateContext, isConnected, isLoading, messagesLength, sendMessage]);

  // Reset when context changes
  useEffect(() => {
    if (!architectureRegenerateContext) {
      sentRef.current = false;
    }
  }, [architectureRegenerateContext]);

  return null;
}

// Helper component to handle profile generation initial message
function ProfileMessageSender({
  profileGenerateContext,
  isConnected,
  isLoading,
  messagesLength,
  sendMessage,
}: {
  profileGenerateContext: ProfileGenerateContext | null;
  isConnected: boolean;
  isLoading: boolean;
  messagesLength: number;
  sendMessage: (message: string) => void;
}) {
  const sentRef = useRef(false);

  useEffect(() => {
    if (
      profileGenerateContext &&
      isConnected &&
      !sentRef.current &&
      !isLoading &&
      messagesLength === 0
    ) {
      const initialMessage = `I'd like help generating my profile. Can you help me create compelling profile sections based on my projects and interests?`;
      sendMessage(initialMessage);
      sentRef.current = true;
    }
  }, [profileGenerateContext, isConnected, isLoading, messagesLength, sendMessage]);

  // Reset when context changes
  useEffect(() => {
    if (!profileGenerateContext) {
      sentRef.current = false;
    }
  }, [profileGenerateContext]);

  return null;
}

export function SidebarChatLayout({
  isOpen,
  onClose,
  conversationId,
  context = 'default',
  architectureRegenerateContext = null,
  profileGenerateContext = null,
  learningSetupContext = null,
  defaultExpanded = false,
}: SidebarChatLayoutProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const triggerFileSelectRef = useRef<(() => void) | null>(null);
  const dropFilesRef = useRef<((files: File[]) => void) | null>(null);

  // Panel-level drag-and-drop state
  const [isPanelDragging, setIsPanelDragging] = useState(false);
  const panelDragCounterRef = useRef(0);

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

  // Quick actions for current context
  const quickActions = useMemo(() => QUICK_ACTIONS[context], [context]);

  // Handle navigation - close sidebar and navigate
  const handleNavigate = useCallback((path: string) => {
    onClose();
    navigate(path);
  }, [navigate, onClose]);

  if (!isOpen) return null;

  return (
    <ChatCore
      conversationId={conversationId}
      context={context}
      enableOnboarding={true}
      onProjectCreated={(url) => handleNavigate(url)}
      onClose={onClose}
    >
      {(state) => {
        // Access extended state for integration flow
        const extendedState = state as typeof state & {
          integrationFlow: ReturnType<typeof import('../integrations').useIntegrationFlow>;
        };
        const integrationFlow = extendedState.integrationFlow;

        // Determine what to show
        const showLearningSetup = learningSetupContext?.needsSetup && state.messages.length === 0;
        const shouldShowQuickActions = showQuickActions &&
          state.messages.length === 0 &&
          !state.onboarding?.isActive &&
          !showLearningSetup &&
          !architectureRegenerateContext &&
          !profileGenerateContext;

        // Handle quick action click
        const handleQuickAction = (message: string) => {
          setShowQuickActions(false);
          state.sendMessage(message);
        };

        // Handle creating a project from a generated image
        const handleCreateProjectFromImage = async (sessionId: number) => {
          const result = await createProjectFromImageSession(sessionId);
          return {
            projectUrl: result.url,
            projectTitle: result.title,
          };
        };

        // Wrap sendMessage to intercept slash commands
        const handleSendMessage = (message: string, attachments?: File[]) => {
          // Handle /clear command
          if (message.trim().toLowerCase() === '/clear') {
            state.clearMessages();
            setShowQuickActions(true);
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
          <>
            {/* Architecture message sender - handles useEffect properly as a component */}
            <ArchitectureMessageSender
              architectureRegenerateContext={architectureRegenerateContext}
              isConnected={state.isConnected}
              isLoading={state.isLoading}
              messagesLength={state.messages.length}
              sendMessage={state.sendMessage}
            />

            {/* Profile generation message sender - auto-sends initial profile generation message */}
            <ProfileMessageSender
              profileGenerateContext={profileGenerateContext}
              isConnected={state.isConnected}
              isLoading={state.isLoading}
              messagesLength={state.messages.length}
              sendMessage={state.sendMessage}
            />

            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
              onClick={onClose}
            />

            {/* Sidebar Panel */}
            <div
              className={`
                fixed right-0 top-0 h-full bg-white/95 dark:bg-background/95 backdrop-blur-xl
                border-l border-slate-200 dark:border-white/10 z-50 flex flex-col shadow-2xl
                animate-slide-in-right transition-all duration-300 ease-in-out
                ${isExpanded ? 'w-full max-w-4xl' : 'w-full max-w-md'}
              `}
              onDragEnter={handlePanelDragEnter}
              onDragLeave={handlePanelDragLeave}
              onDragOver={handlePanelDragOver}
              onDrop={handlePanelDrop}
            >
              {/* Panel-level drag overlay */}
              {isPanelDragging && (
                <div
                  className="absolute inset-0 z-[100] bg-cyan-500/10 border-4 border-dashed border-cyan-400 rounded-lg flex items-center justify-center pointer-events-none"
                  style={{
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                  }}
                >
                  <div className="text-center p-6 rounded-xl bg-white/80 dark:bg-background/80 border border-cyan-500/30">
                    <div className="text-cyan-600 dark:text-cyan-300 text-xl font-semibold mb-2">Drop files here</div>
                    <div className="text-cyan-500/70 dark:text-cyan-400/70 text-sm">
                      Images, videos, and documents supported
                    </div>
                  </div>
                </div>
              )}

              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <img
                    src="/ember-avatar.png"
                    alt="Ember"
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <h2 className="font-semibold text-slate-900 dark:text-white">Ember</h2>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className={`w-2 h-2 rounded-full ${state.isConnected ? 'bg-green-500 dark:bg-green-400' : 'bg-amber-500 dark:bg-amber-400 animate-pulse'}`} />
                      <span className="text-slate-500 dark:text-slate-400">
                        {state.isConnected ? 'Online' : 'Connecting...'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {/* Expand/Collapse button */}
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                    title={isExpanded ? 'Collapse panel' : 'Expand panel'}
                  >
                    <FontAwesomeIcon
                      icon={isExpanded ? faCompress : faExpand}
                      className="w-4 h-4 text-slate-500 dark:text-slate-400"
                    />
                  </button>
                  {/* Close button */}
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <XMarkIcon className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                  </button>
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
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-4">
                      {/* Learning goal selection (when needed) */}
                      {showLearningSetup && learningSetupContext && (
                        <LearningGoalSelectionMessage
                          onSelectGoal={learningSetupContext.onSelectGoal}
                          onSkip={learningSetupContext.onSkip}
                          isPending={learningSetupContext.isPending}
                        />
                      )}

                      {/* Quick actions (when no messages and no special context) */}
                      {shouldShowQuickActions && (
                        <div className="py-6">
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">What would you like to do?</p>
                          <div className="flex flex-wrap gap-2">
                            {quickActions.map((action) => (
                              <button
                                key={action.label}
                                onClick={() => handleQuickAction(action.message)}
                                className="px-3 py-1.5 rounded-full text-sm font-medium transition-all
                                  bg-gradient-to-r from-cyan-500/10 to-cyan-600/10
                                  border border-cyan-500/30
                                  text-cyan-600 dark:text-cyan-300 hover:text-cyan-500 dark:hover:text-cyan-200
                                  hover:border-cyan-400/50 hover:from-cyan-500/20 hover:to-cyan-600/20
                                  hover:shadow-[0_0_15px_rgba(34,211,238,0.2)]"
                              >
                                {action.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Chat messages */}
                      <ChatMessageList
                        messages={state.messages}
                        isLoading={state.isLoading}
                        currentTool={state.currentTool}
                        onCancelProcessing={state.cancelProcessing}
                        userAvatarUrl={user?.avatarUrl}
                        onboarding={state.onboarding}
                        onNavigate={handleNavigate}
                        onCreateProjectFromImage={handleCreateProjectFromImage}
                        onConnectFigma={integrationFlow?.handleConnectFigma}
                        onFigmaUrlSubmit={integrationFlow?.handleFigmaUrlImport}
                      />
                    </div>

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
              </div>

              {/* Input Area - hide when learning setup is shown */}
              {!hasActiveIntegration && !showLearningSetup && (
                <ChatInputArea
                  onSendMessage={handleSendMessage}
                  isLoading={state.isLoading}
                  isUploading={state.isUploading}
                  onCancelUpload={state.cancelUpload}
                  placeholder="Message Ember..."
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
          </>
        );
      }}
    </ChatCore>
  );
}
