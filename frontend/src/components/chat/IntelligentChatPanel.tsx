import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { faStar, faCodeBranch, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { ChatInterface } from './ChatInterface';
import { ChatPlusMenu, type IntegrationType } from './ChatPlusMenu';
import { useIntelligentChat } from '@/hooks/useIntelligentChat';
import { useAuth } from '@/hooks/useAuth';
import {
  fetchGitHubRepos,
  checkGitHubConnection,
  type GitHubRepository,
} from '@/services/github';
// Constants
const ONBOARDING_BUTTON_BASE = 'w-full text-left px-4 py-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group shadow-sm disabled:opacity-50';
const BUTTON_FLEX_CONTAINER = 'flex items-center gap-3';
const BUTTON_TITLE_STYLE = 'font-medium text-slate-900 dark:text-slate-100 text-sm';
const BUTTON_SUBTITLE_STYLE = 'text-xs text-slate-600 dark:text-slate-400';

interface IntelligentChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId?: string;
  welcomeMode?: boolean; // Show onboarding welcome message for new users
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
}: IntelligentChatPanelProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [error, setError] = useState<string | undefined>();
  const [hasInteracted, setHasInteracted] = useState(false);

  // GitHub integration state
  const [githubStep, setGithubStep] = useState<'idle' | 'loading' | 'connect' | 'repos' | 'importing'>('idle');
  const [githubRepos, setGithubRepos] = useState<GitHubRepository[]>([]);
  const [githubSearchQuery, setGithubSearchQuery] = useState('');
  const [githubMessage, setGithubMessage] = useState<string>('');

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

  const { messages, isConnected, isLoading, sendMessage, connect, reconnectAttempts } = useIntelligentChat({
    conversationId,
    onError: (err) => setError(err),
    onProjectCreated: handleProjectCreated,
  });

  const handleSendMessage = (content: string) => {
    if (!content.trim() || isLoading) return;
    setError(undefined);
    setHasInteracted(true);
    sendMessage(content);
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

  const handleIntegrationSelect = useCallback(async (type: IntegrationType) => {
    switch (type) {
      case 'github':
        // Use direct GitHub integration flow instead of AI
        handleGitHubImport();
        break;
      case 'youtube':
        sendMessage('I want to add a YouTube video to my project');
        break;
      case 'upload':
        sendMessage('I want to upload files to my project');
        break;
      case 'url':
        sendMessage('I want to add content from a URL to my project');
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

  // State for the ChatPlusMenu dropdown - lifted to parent to prevent state loss
  // when component re-renders due to WebSocket connection changes
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  console.log('[IntelligentChatPanel] plusMenuOpen:', plusMenuOpen);

  return (
    <ChatInterface
      isOpen={isOpen}
      onClose={onClose}
      onSendMessage={handleSendMessage}
      messages={messages}
      isLoading={isLoading}
      error={error}
      customInputPrefix={
        <ChatPlusMenu
          onIntegrationSelect={handleIntegrationSelect}
          disabled={isLoading}
          isOpen={plusMenuOpen}
          onOpenChange={setPlusMenuOpen}
        />
      }
      header={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              AllThrive AI Chat
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
      customContent={githubStep !== 'idle' ? renderGitHubUI() : undefined}
    />
  );
}
