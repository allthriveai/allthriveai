import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { faStar, faCodeBranch, faSpinner } from '@fortawesome/free-solid-svg-icons';
import ReactMarkdown from 'react-markdown';
import { ChatInterface } from './ChatInterface';
import { ChatPlusMenu, type IntegrationType } from './ChatPlusMenu';
import { GeneratedImageMessage } from './GeneratedImageMessage';
import { HelpQuestionsPanel } from './HelpQuestionsPanel';
import type { HelpQuestion } from '@/data/helpQuestions';
import { useIntelligentChat, type ChatMessage, type QuotaExceededInfo } from '@/hooks/useIntelligentChat';
import { useAuth } from '@/hooks/useAuth';
import { setProjectFeaturedImage, createProjectFromImageSession } from '@/services/projects';
import {
  fetchGitHubRepos,
  checkGitHubConnection,
  type GitHubRepository,
} from '@/services/github';
import { uploadFile, uploadImage } from '@/services/upload';
// Constants
const ONBOARDING_BUTTON_BASE = 'w-full text-left px-4 py-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group shadow-sm disabled:opacity-50';
const BUTTON_FLEX_CONTAINER = 'flex items-center gap-3';
const BUTTON_TITLE_STYLE = 'font-medium text-slate-900 dark:text-slate-100 text-sm';
const BUTTON_SUBTITLE_STYLE = 'text-xs text-slate-600 dark:text-slate-400';

// Nano Banana welcome message for image generation
const NANO_BANANA_WELCOME = `Hey there! I'm **Nano Banana**, your creative image assistant.

I can help you create:
- Infographics explaining your project
- Technical diagrams and flowcharts
- Beautiful banners and headers
- Any visual you can imagine!

**Tips for great results:**
1. **Be specific** - "A flowchart showing OAuth login flow" beats "auth diagram"
2. **Describe style** - Tell me if you want minimalist, colorful, corporate, etc.
3. **Add text** - I'm great at rendering text in images
4. **Upload references** - Click the photo icon to show me examples

What would you like me to create?`;

interface IntelligentChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId?: string;
  welcomeMode?: boolean; // Show onboarding welcome message for new users
  supportMode?: boolean; // Start with help questions panel visible
}

/**
 * IntelligentChatPanel - Unified AI assistant for project creation and support
 *
 * Features:
 * - Real-time streaming with WebSocket
 * - Automatic mode switching between project creation and support
 * - ChatGPT-style + menu with integrations (GitHub, YouTube, Upload, URL)
 * - Automatic reconnection on disconnect
 * - LangGraph agent integration with conversation state
 */
export function IntelligentChatPanel({
  isOpen,
  onClose,
  conversationId = 'default-conversation',
  welcomeMode = false,
  supportMode = false,
}: IntelligentChatPanelProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [error, setError] = useState<string | undefined>();
  const [hasInteracted, setHasInteracted] = useState(supportMode); // If support mode, mark as interacted
  const [quotaExceeded, setQuotaExceeded] = useState<QuotaExceededInfo | null>(null);

  // GitHub integration state
  const [githubStep, setGithubStep] = useState<'idle' | 'loading' | 'connect' | 'repos' | 'importing'>('idle');
  const [githubRepos, setGithubRepos] = useState<GitHubRepository[]>([]);
  const [githubSearchQuery, setGithubSearchQuery] = useState('');
  const [githubMessage, setGithubMessage] = useState<string>('');

  // Help mode state - start in help mode if supportMode prop is true
  const [helpMode, setHelpMode] = useState(supportMode);

  // Handle project creation - redirect to the new project page
  const handleProjectCreated = useCallback((projectUrl: string, projectTitle: string) => {
    console.log(`[Chat] Project created: ${projectTitle} at ${projectUrl}`);
    // Close the chat panel and navigate to the project
    onClose();
    // Small delay to allow the chat to close smoothly
    setTimeout(() => {
      navigate(projectUrl);
    }, 300);
  }, [navigate, onClose]);

  // Handle quota exceeded - show upgrade prompt
  const handleQuotaExceeded = useCallback((info: QuotaExceededInfo) => {
    console.log('[Chat] Quota exceeded:', info);
    setQuotaExceeded(info);
  }, []);

  const { messages, isConnected, isLoading, sendMessage, connect, reconnectAttempts } = useIntelligentChat({
    conversationId,
    onError: (err) => setError(err),
    onProjectCreated: handleProjectCreated,
    onQuotaExceeded: handleQuotaExceeded,
  });

  // State for file upload progress
  const [isUploading, setIsUploading] = useState(false);

  const handleSendMessage = async (content: string, attachments?: File[]) => {
    if (!content.trim() && (!attachments || attachments.length === 0)) return;
    if (isLoading || isUploading) return;

    setError(undefined);
    setHasInteracted(true);
    setHelpMode(false); // Close help panel when user sends a message

    // Upload attachments if present
    if (attachments && attachments.length > 0) {
      setIsUploading(true);
      try {
        const uploadedFiles: { name: string; url: string; type: string }[] = [];

        for (const file of attachments) {
          const isImage = file.type.startsWith('image/');

          if (isImage) {
            const result = await uploadImage(file, 'chat-attachments', true);
            uploadedFiles.push({
              name: file.name,
              url: result.url,
              type: 'image',
            });
          } else {
            const result = await uploadFile(file, 'chat-attachments', true);
            uploadedFiles.push({
              name: file.name,
              url: result.url,
              type: result.file_type,
            });
          }
        }

        // Build message with uploaded file URLs
        const fileDescriptions = uploadedFiles.map(f =>
          f.type === 'image'
            ? `[Image: ${f.name}](${f.url})`
            : `[File: ${f.name}](${f.url})`
        ).join('\n');

        const messageWithAttachments = content
          ? `${content}\n\n${fileDescriptions}`
          : fileDescriptions;

        sendMessage(messageWithAttachments);
      } catch (uploadError: any) {
        console.error('[IntelligentChatPanel] File upload failed:', uploadError);
        // Show more detailed error message to help debug
        const errorMessage = uploadError?.error || uploadError?.message || 'Unknown error';
        const statusCode = uploadError?.statusCode;
        if (statusCode === 401) {
          setError('Authentication required. Please refresh the page and try again.');
        } else if (statusCode === 400) {
          setError(`Upload failed: ${errorMessage}`);
        } else {
          setError(`Failed to upload files: ${errorMessage}`);
        }
      } finally {
        setIsUploading(false);
      }
    } else {
      sendMessage(content);
    }
  };

  // Onboarding button handlers - send messages to the AI agent
  const handlePlayGame = () => {
    setHasInteracted(true);
    sendMessage('Play a game to help personalize my experience');
  };

  const handleAddFirstProject = () => {
    setHasInteracted(true);
    sendMessage('I want to add my first project to my portfolio');
  };

  const handleMakeSomethingNew = () => {
    setHasInteracted(true);
    sendMessage("I don't know where to start - let's make something new together");
  };

  const handleRetry = () => {
    setError(undefined);
    connect();
  };

  // GitHub integration handlers
  const handleGitHubImport = useCallback(async () => {
    setGithubStep('loading');
    setGithubMessage('Checking your GitHub connection...');
    setHasInteracted(true);

    try {
      const isConnected = await checkGitHubConnection();

      if (!isConnected) {
        setGithubStep('connect');
        setGithubMessage('You need to connect your GitHub account first.');
        return;
      }

      // Fetch repos
      setGithubMessage('Loading your GitHub repositories...');

      try {
        const fetchedRepos = await fetchGitHubRepos();
        setGithubRepos(fetchedRepos);
        setGithubStep('repos');
        setGithubMessage(`Found ${fetchedRepos.length} repositories!`);
      } catch (repoError: any) {
        console.error('Failed to fetch GitHub repos:', repoError);
        setGithubMessage(repoError.message || 'Failed to load repositories. Please try again.');
        setGithubStep('idle');
      }
    } catch (error) {
      console.error('GitHub import error:', error);
      setGithubMessage('Something went wrong. Please try again.');
      setGithubStep('idle');
    }
  }, []);

  const handleConnectGitHub = () => {
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const frontendUrl = window.location.origin;
    const returnPath = window.location.pathname + window.location.search;

    // Redirect to django-allauth GitHub OAuth
    const redirectUrl = `${backendUrl}/accounts/github/login/?process=connect&next=${encodeURIComponent(frontendUrl + returnPath)}`;
    window.location.href = redirectUrl;
  };

  const handleSelectRepo = async (repo: GitHubRepository) => {
    // Close the repo picker UI
    handleCancelGitHub();

    // Use the AI agent to import the repository with template-based analysis
    // The agent will use import_github_project tool which generates beautiful
    // structured sections (overview, features, tech_stack, architecture, etc.)
    const importMessage = `Import this GitHub repository to my showcase: ${repo.htmlUrl}`;

    // Send message to the chat agent
    setHasInteracted(true);
    sendMessage(importMessage);
  };

  const handleCancelGitHub = () => {
    setGithubStep('idle');
    setGithubMessage('');
    setGithubRepos([]);
    setGithubSearchQuery('');
  };

  // Help mode handlers
  const handleHelpQuestionSelect = useCallback((question: HelpQuestion) => {
    // Close help mode and send the question's message to the AI
    setHelpMode(false);
    sendMessage(question.chatMessage);
  }, [sendMessage]);

  const handleCloseHelp = useCallback(() => {
    setHelpMode(false);
  }, []);

  const handleIntegrationSelect = useCallback(async (type: IntegrationType) => {
    switch (type) {
      case 'github':
        // Use direct GitHub integration flow instead of AI
        handleGitHubImport();
        break;
      case 'youtube':
        sendMessage('I want to add a YouTube video to my project');
        break;
      case 'create-visual':
        // Set image generation mode and show Nano Banana welcome
        setHasInteracted(true);
        // The welcome message will trigger intent detection to route to image-generation
        sendMessage('Create an image or infographic for me');
        break;
      case 'ask-help':
        // Show help questions panel
        setHelpMode(true);
        setHasInteracted(true);
        break;
      case 'describe':
        sendMessage("I'd like to describe something to you");
        break;
    }
  }, [handleGitHubImport, sendMessage]);

  // Render GitHub integration UI
  const renderGitHubUI = () => {
    if (githubStep === 'idle') return null;

    return (
      <div className="flex flex-col items-start justify-start px-4 pt-4">
        <div className="w-full max-w-md">
          {/* Status message */}
          {githubMessage && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
              <p className="text-sm">{githubMessage}</p>
            </div>
          )}

          {/* Loading state */}
          {(githubStep === 'loading' || githubStep === 'importing') && (
            <div className="flex justify-center py-8">
              <FontAwesomeIcon icon={faSpinner} className="w-8 h-8 text-primary-500 animate-spin" />
            </div>
          )}

          {/* Connect GitHub button */}
          {githubStep === 'connect' && (
            <div className="space-y-3">
              <button
                onClick={handleConnectGitHub}
                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faGithub} />
                Connect GitHub
              </button>
              <button
                onClick={handleCancelGitHub}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Repository list */}
          {githubStep === 'repos' && githubRepos.length > 0 && (
            <div className="space-y-3">
              {/* Search */}
              <input
                type="text"
                placeholder="Search repositories..."
                value={githubSearchQuery}
                onChange={(e) => setGithubSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white"
              />

              {/* Repo list */}
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {githubRepos
                  .filter((repo) =>
                    githubSearchQuery.trim() === ''
                      ? true
                      : repo.name.toLowerCase().includes(githubSearchQuery.toLowerCase()) ||
                        repo.description?.toLowerCase().includes(githubSearchQuery.toLowerCase())
                  )
                  .slice(0, 20)
                  .map((repo) => (
                    <button
                      key={repo.fullName}
                      onClick={() => handleSelectRepo(repo)}
                      className="w-full text-left px-3 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary-500 transition-all text-sm"
                    >
                      <div className="font-medium text-gray-900 dark:text-white">{repo.name}</div>
                      {repo.description && (
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                          {repo.description}
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-500">
                        {repo.language && <span>{repo.language}</span>}
                        {repo.stars > 0 && (
                          <span className="flex items-center gap-1">
                            <FontAwesomeIcon icon={faStar} className="w-3 h-3" />
                            {repo.stars}
                          </span>
                        )}
                        {repo.forks > 0 && (
                          <span className="flex items-center gap-1">
                            <FontAwesomeIcon icon={faCodeBranch} className="w-3 h-3" />
                            {repo.forks}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
              </div>

              {/* Cancel button */}
              <button
                onClick={handleCancelGitHub}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Empty state when no messages
  const renderEmptyState = () => {
    if (messages.length > 0 || hasInteracted) return null;

    // Welcome mode for new users after onboarding
    // Temporarily disabled - re-enable once onboarding flow is revised
    // if (welcomeMode) {
    //   return (
    //     <div className="flex flex-col items-start justify-start h-full px-4 pt-4">
    //       <div className="max-w-md">
    //         <div className="mb-4 px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
    //           <p className="text-sm mb-1 flex items-center gap-2">
    //             🎉 Glad you're here{user?.first_name ? `, ${user.first_name}` : ''}!
    //           </p>
    //           <p className="text-sm">Let's get you started. What would you like to do?</p>
    //         </div>
    //
    //         {/* 3 Onboarding Options */}
    //         <div className="space-y-2">
    //           <button
    //             onClick={handlePlayGame}
    //             disabled={isLoading}
    //             className={ONBOARDING_BUTTON_BASE}
    //           >
    //             <div className={BUTTON_FLEX_CONTAINER}>
    //               <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 flex items-center justify-center flex-shrink-0">
    //                 <span className="text-lg">🎮</span>
    //               </div>
    //               <div className="flex-1">
    //                 <div className={BUTTON_TITLE_STYLE}>
    //                   Play a game
    //                 </div>
    //                 <div className={BUTTON_SUBTITLE_STYLE}>
    //                   Help us personalize your experience
    //                 </div>
    //               </div>
    //             </div>
    //           </button>
    //
    //           <button
    //             onClick={handleAddFirstProject}
    //             disabled={isLoading}
    //             className={ONBOARDING_BUTTON_BASE}
    //           >
    //             <div className={BUTTON_FLEX_CONTAINER}>
    //               <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 flex items-center justify-center flex-shrink-0">
    //                 <span className="text-lg">➕</span>
    //               </div>
    //               <div className="flex-1">
    //                 <div className={BUTTON_TITLE_STYLE}>
    //                   Add your first project
    //                 </div>
    //                 <div className={BUTTON_SUBTITLE_STYLE}>
    //                   Paste a link, connect an integration, or describe it
    //                 </div>
    //               </div>
    //             </div>
    //           </button>
    //
    //           <button
    //             onClick={handleMakeSomethingNew}
    //             disabled={isLoading}
    //             className={ONBOARDING_BUTTON_BASE}
    //           >
    //             <div className={BUTTON_FLEX_CONTAINER}>
    //               <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center flex-shrink-0">
    //                 <span className="text-lg">✨</span>
    //               </div>
    //               <div className="flex-1">
    //                 <div className={BUTTON_TITLE_STYLE}>
    //                   Don't know where to start?
    //                 </div>
    //                 <div className={BUTTON_SUBTITLE_STYLE}>
    //                   Let's make something new together
    //                 </div>
    //               </div>
    //             </div>
    //           </button>
    //         </div>
    //       </div>
    //     </div>
    //   );
    // }

    // Default empty state
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <div className="mb-4">
          <svg
            className="w-16 h-16 text-slate-400 dark:text-slate-600 mx-auto"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
          Start a Conversation
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-sm">
          Ask me anything about your projects, get help with tasks, or brainstorm ideas.
          I'm powered by LangGraph AI agents to assist you.
        </p>
      </div>
    );
  };

  // Enhanced error display with retry button
  const renderError = () => {
    if (!error) return null;

    return (
      <div className="mx-4 mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800 dark:text-red-400 mb-1">
              Connection Error
            </p>
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            {reconnectAttempts > 0 && (
              <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                Reconnect attempts: {reconnectAttempts}/5
              </p>
            )}
          </div>
          <button
            onClick={handleRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 rounded-md transition-colors"
          >
            <ArrowPathIcon className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      </div>
    );
  };

  // Quota exceeded banner with upgrade options
  const renderQuotaExceeded = () => {
    if (!quotaExceeded) return null;

    return (
      <div className="mx-4 mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-400 mb-1">
                AI Usage Limit Reached
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400">
                You've used all your AI requests for this period.
              </p>
              <div className="mt-2 text-xs text-amber-600 dark:text-amber-500 space-y-1">
                <p>Plan: <span className="font-medium">{quotaExceeded.tier}</span></p>
                {quotaExceeded.aiRequestsLimit > 0 && (
                  <p>Requests: {quotaExceeded.aiRequestsUsed} / {quotaExceeded.aiRequestsLimit} used</p>
                )}
                <p>Token Balance: <span className="font-medium">{quotaExceeded.tokenBalance.toLocaleString()}</span></p>
              </div>
            </div>
            <button
              onClick={() => setQuotaExceeded(null)}
              className="p-1 hover:bg-amber-200 dark:hover:bg-amber-800 rounded transition-colors"
              aria-label="Dismiss"
            >
              <XMarkIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </button>
          </div>

          <div className="flex gap-2">
            {quotaExceeded.canPurchaseTokens && (
              <button
                onClick={() => navigate('/settings/billing?tab=tokens')}
                className="flex-1 px-3 py-2 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-md transition-colors"
              >
                Buy Tokens
              </button>
            )}
            <button
              onClick={() => navigate(quotaExceeded.upgradeUrl)}
              className="flex-1 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 rounded-md transition-colors"
            >
              Upgrade Plan
            </button>
          </div>
        </div>
      </div>
    );
  };

  // State for the ChatPlusMenu dropdown - lifted to parent to prevent state loss
  // when component re-renders due to WebSocket connection changes
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  console.log('[IntelligentChatPanel] plusMenuOpen:', plusMenuOpen);

  // Track current project ID for "Use as Featured Image" functionality
  // Extract from conversationId if it follows "project-{id}" pattern
  const currentProjectId = conversationId.startsWith('project-')
    ? parseInt(conversationId.replace('project-', ''), 10)
    : null;

  // Handle setting an image as project's featured image
  const handleUseAsFeaturedImage = useCallback(async (imageUrl: string) => {
    if (!currentProjectId) {
      console.warn('[IntelligentChatPanel] No project ID available for setting featured image');
      return;
    }

    try {
      await setProjectFeaturedImage(currentProjectId, imageUrl);
      console.log(`[IntelligentChatPanel] Set featured image for project ${currentProjectId}`);
    } catch (error) {
      console.error('[IntelligentChatPanel] Failed to set featured image:', error);
      throw error; // Re-throw so GeneratedImageMessage can show error state
    }
  }, [currentProjectId]);

  // Handle creating a project from a Nano Banana image session
  const handleCreateProjectFromImage = useCallback(async (sessionId: number) => {
    try {
      const result = await createProjectFromImageSession(sessionId);
      console.log(`[IntelligentChatPanel] Created project from image session: ${result.project.title}`);

      return {
        projectUrl: result.project.url,
        projectTitle: result.project.title,
      };
    } catch (error) {
      console.error('[IntelligentChatPanel] Failed to create project from image:', error);
      throw error; // Re-throw so GeneratedImageMessage can show error state
    }
  }, []);

  // Custom message renderer for different message types
  const renderMessage = useCallback((message: ChatMessage) => {
    const isUser = message.sender === 'user';
    const messageType = message.metadata?.type;

    // Handle generating state (loading indicator)
    if (messageType === 'generating') {
      return (
        <div className="flex justify-start">
          <div className="max-w-md px-4 py-3 rounded-lg bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center gap-3">
              <div className="animate-bounce text-2xl">🍌</div>
              <div>
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Nano Banana is creating...
                </p>
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                  {message.content || 'Generating your image...'}
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Handle generated image
    if (messageType === 'generated_image' && message.metadata?.imageUrl) {
      return (
        <div className="flex justify-start">
          <GeneratedImageMessage
            imageUrl={message.metadata.imageUrl}
            filename={message.metadata.filename || 'nano-banana-image.png'}
            sessionId={message.metadata.sessionId}
            iterationNumber={message.metadata.iterationNumber}
            onUseAsFeaturedImage={currentProjectId ? handleUseAsFeaturedImage : undefined}
            onCreateProject={message.metadata.sessionId ? handleCreateProjectFromImage : undefined}
          />
        </div>
      );
    }

    // Standard text message
    return (
      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`max-w-md px-4 py-2 rounded-lg ${
            isUser
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
          }`}
        >
          {isUser ? (
            <span className="whitespace-pre-wrap">{message.content}</span>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  // Override default paragraph to not have bottom margin on last element
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  // Make links open in new tab
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline">
                      {children}
                    </a>
                  ),
                  // Style code blocks
                  code: ({ children, node }) => {
                    // Check if this is a code block (has parent pre) or inline code
                    const isInline = node?.position?.start.line === node?.position?.end.line;
                    return isInline ? (
                      <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-sm">{children}</code>
                    ) : (
                      <code>{children}</code>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    );
  }, [currentProjectId, handleUseAsFeaturedImage, handleCreateProjectFromImage]);

  return (
    <ChatInterface
      isOpen={isOpen}
      onClose={onClose}
      onSendMessage={handleSendMessage}
      messages={messages}
      isLoading={isLoading || isUploading}
      error={error}
      customMessageRenderer={renderMessage}
      customInputPrefix={
        <ChatPlusMenu
          onIntegrationSelect={handleIntegrationSelect}
          disabled={isLoading || isUploading}
          isOpen={plusMenuOpen}
          onOpenChange={setPlusMenuOpen}
        />
      }
      header={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              All Thrive AI Chat
            </h2>

            {/* Connection status indicator */}
            <div
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                isConnected
                  ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                  : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
              }`}
              title={isConnected ? 'Connected' : 'Disconnected'}
            >
              <span className="mr-1.5">{isConnected ? '●' : '○'}</span>
              {isConnected ? 'Live' : 'Offline'}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* User info */}
            {user && (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {user.username || user.email}
              </div>
            )}

            {/* Close button */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Close button clicked');
                onClose();
              }}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Close chat"
            >
              <XMarkIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>
      }
      inputPlaceholder="Ask me anything..."
      customEmptyState={renderEmptyState()}
      customContent={
        // Only pass customContent when there's actually custom UI to show
        // Otherwise let ChatInterface render the messages normally
        helpMode ? (
          <>
            {renderQuotaExceeded()}
            <HelpQuestionsPanel
              onQuestionSelect={handleHelpQuestionSelect}
              onClose={handleCloseHelp}
            />
          </>
        ) : githubStep !== 'idle' ? (
          <>
            {renderQuotaExceeded()}
            {renderGitHubUI()}
          </>
        ) : undefined
      }
      enableAttachments={true}
    />
  );
}
