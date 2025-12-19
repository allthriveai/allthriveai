import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFigma, faGithub, faGitlab, faYoutube } from '@fortawesome/free-brands-svg-icons';
import { faStar, faCodeBranch, faSpinner, faFolderPlus, faLightbulb, faMagnifyingGlass, faCheck, faPlug, faPencil } from '@fortawesome/free-solid-svg-icons';
import ReactMarkdown from 'react-markdown';
import { ChatInterface } from './ChatInterface';
import { ChatPlusMenu, type IntegrationType } from './ChatPlusMenu';
import { GeneratedImageMessage } from './GeneratedImageMessage';
import {
  OnboardingIntroMessage,
  AvatarTemplateSelector,
  AvatarPreviewMessage,
  PathSelectionMessage,
} from './onboarding';
import { useIntelligentChat, type ChatMessage, type QuotaExceededInfo, type OrchestrationAction } from '@/hooks/useIntelligentChat';
import { useOnboardingChat } from '@/hooks/useOnboardingChat';
import { useOrchestrationActions } from '@/hooks/useOrchestrationActions';
import { useAuth } from '@/hooks/useAuth';
import { setProjectFeaturedImage, createProjectFromImageSession } from '@/services/projects';
import {
  fetchGitHubRepos,
  checkGitHubConnection,
  GitHubInstallationNeededError,
  type GitHubRepository,
} from '@/services/github';
import {
  fetchGitLabProjects,
  checkGitLabConnection,
  type GitLabProject,
} from '@/services/gitlab';
import {
  checkFigmaConnection,
  isFigmaUrl,
  parseFigmaUrl,
  getFigmaFilePreview,
} from '@/services/figma';
import { uploadFile, uploadImage } from '@/services/upload';

interface ArchitectureRegenerateContext {
  projectId: number;
  projectTitle: string;
}

interface IntelligentChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId?: string;
  welcomeMode?: boolean; // Show onboarding welcome message for new users
  supportMode?: boolean; // Start with help questions panel visible
  productCreationMode?: boolean; // Start in product creation context
  architectureRegenerateContext?: ArchitectureRegenerateContext | null; // Context for architecture diagram regeneration
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
  supportMode = false,
  productCreationMode = false,
  architectureRegenerateContext = null,
}: IntelligentChatPanelProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [error, setError] = useState<string | undefined>();
  const [hasInteracted, setHasInteracted] = useState(supportMode || !!architectureRegenerateContext); // If support mode or architecture mode, mark as interacted
  const [quotaExceeded, setQuotaExceeded] = useState<QuotaExceededInfo | null>(null);
  const [architectureInitialMessageSent, setArchitectureInitialMessageSent] = useState(false);

  // GitHub integration state
  const [githubStep, setGithubStep] = useState<'idle' | 'loading' | 'connect' | 'install' | 'repos' | 'importing'>('idle');
  const [githubRepos, setGithubRepos] = useState<GitHubRepository[]>([]);
  const [githubSearchQuery, setGithubSearchQuery] = useState('');
  const [githubMessage, setGithubMessage] = useState<string>('');

  // GitLab integration state
  const [gitlabStep, setGitlabStep] = useState<'idle' | 'loading' | 'connect' | 'projects' | 'importing'>('idle');
  const [gitlabProjects, setGitlabProjects] = useState<GitLabProject[]>([]);
  const [gitlabSearchQuery, setGitlabSearchQuery] = useState('');
  const [gitlabMessage, setGitlabMessage] = useState<string>('');

  // Figma integration state
  const [figmaStep, setFigmaStep] = useState<'idle' | 'loading' | 'connect' | 'ready'>('idle');
  const [figmaMessage, setFigmaMessage] = useState<string>('');

  // Integration picker state
  const [showIntegrationPicker, setShowIntegrationPicker] = useState(false);

  // File select trigger function from ChatInterface
  const triggerFileSelectRef = useRef<(() => void) | null>(null);
  const [integrationStatus, setIntegrationStatus] = useState<{
    github: boolean;
    gitlab: boolean;
    figma: boolean;
    youtube: boolean;
  }>({ github: false, gitlab: false, figma: false, youtube: false });
  const [loadingIntegrationStatus, setLoadingIntegrationStatus] = useState(false);

  // URL search params for OAuth callbacks
  const [searchParams, setSearchParams] = useSearchParams();

  // Detect OAuth callback and trigger Figma ready state
  useEffect(() => {
    const connected = searchParams.get('connected');
    if (connected === 'figma') {
      // Clear the URL param
      searchParams.delete('connected');
      setSearchParams(searchParams, { replace: true });

      // Set Figma to ready state
      setFigmaStep('ready');
      setFigmaMessage('Paste a Figma file URL below to import your design.');
      setHasInteracted(true);
    }
  }, [searchParams, setSearchParams]);

  // Support mode state - no longer shows FAQ panel, just direct chat
  const isSupportMode = supportMode;

  // Handle project creation - redirect to the new project page
  const handleProjectCreated = useCallback((projectUrl: string) => {
    // Close the chat panel and navigate to the project
    onClose();
    // Small delay to allow the chat to close smoothly
    setTimeout(() => {
      navigate(projectUrl);
    }, 300);
  }, [navigate, onClose]);

  // Handle quota exceeded - show upgrade prompt
  const handleQuotaExceeded = useCallback((info: QuotaExceededInfo) => {
    setQuotaExceeded(info);
  }, []);

  // Orchestration actions hook (Ember - site guide)
  // This enables the AI to navigate users, highlight UI elements, open trays, etc.
  const {
    executeAction: executeOrchestrationAction,
    pendingAction,
    confirmPendingAction,
    cancelPendingAction,
  } = useOrchestrationActions({
    onTrayOpen: (tray) => {
      // Handle tray opening - quest tray is handled via custom event
      console.log('[IntelligentChatPanel] Opening tray:', tray);
    },
  });

  // Handle orchestration action from AI - execute if auto_execute, otherwise queue for confirmation
  const handleOrchestrationAction = useCallback((action: OrchestrationAction) => {
    console.log('[IntelligentChatPanel] Received orchestration action:', action);

    // Execute the action (will return false if it needs confirmation)
    const wasExecuted = executeOrchestrationAction(action);

    if (wasExecuted && action.action === 'navigate') {
      // Close chat panel after navigation
      setTimeout(() => {
        onClose();
      }, 300);
    }
  }, [executeOrchestrationAction, onClose]);

  const { messages, isConnected, isConnecting, isLoading, currentTool, sendMessage, clearMessages, cancelProcessing } = useIntelligentChat({
    conversationId,
    onError: (err) => setError(err),
    onProjectCreated: handleProjectCreated,
    onQuotaExceeded: handleQuotaExceeded,
    onOrchestrationAction: handleOrchestrationAction,
  });

  // Onboarding chat integration
  const onboarding = useOnboardingChat({
    onComplete: () => {
      // After onboarding completes, the chat is ready for normal use
      setHasInteracted(true);
    },
  });

  // Merge onboarding messages with regular messages
  const allMessages = useMemo(() => {
    if (onboarding.isOnboardingActive) {
      return [...onboarding.onboardingMessages, ...messages];
    }
    return messages;
  }, [onboarding.isOnboardingActive, onboarding.onboardingMessages, messages]);

  // Send initial message for architecture regeneration mode
  useEffect(() => {
    if (
      architectureRegenerateContext &&
      isConnected &&
      !architectureInitialMessageSent &&
      !isLoading &&
      messages.length === 0
    ) {
      // Send an initial message to trigger the AI to ask for architecture description
      // Include project ID so the AI can use it when calling regenerate_architecture_diagram
      const initialMessage = `The architecture diagram on my project "${architectureRegenerateContext.projectTitle}" (ID: ${architectureRegenerateContext.projectId}) is wrong, can you help me fix it?`;
      sendMessage(initialMessage);
      setArchitectureInitialMessageSent(true);
    }
  }, [architectureRegenerateContext, isConnected, architectureInitialMessageSent, isLoading, messages.length, sendMessage]);

  // State for file upload progress
  const [isUploading, setIsUploading] = useState(false);
  const uploadAbortControllerRef = useRef<AbortController | null>(null);

  // Handle cancelling an in-progress upload
  const handleCancelUpload = useCallback(() => {
    if (uploadAbortControllerRef.current) {
      uploadAbortControllerRef.current.abort();
      uploadAbortControllerRef.current = null;
    }
    setIsUploading(false);
  }, []);

  const handleSendMessage = async (content: string, attachments?: File[]) => {
    if (!content.trim() && (!attachments || attachments.length === 0)) return;
    if (isLoading || isUploading) return;

    // Handle /clear command - reset conversation
    if (content.trim().toLowerCase() === '/clear') {
      clearMessages();
      setHasInteracted(false);
      setError(undefined);
      setQuotaExceeded(null);
      // Reset any integration states
      setGithubStep('idle');
      setGitlabStep('idle');
      setFigmaStep('idle');
      setShowIntegrationPicker(false);
      return;
    }

    setError(undefined);
    setHasInteracted(true);

    // Handle Figma URL when in ready state
    if (figmaStep === 'ready' && content.trim()) {
      const trimmedContent = content.trim();
      if (isFigmaUrl(trimmedContent)) {
        // Process the Figma URL
        await handleFigmaUrlImport(trimmedContent);
        return;
      } else {
        // User typed something that's not a Figma URL
        setFigmaMessage('Please paste a valid Figma URL (e.g., https://www.figma.com/file/...)');
        return;
      }
    }

    // Upload attachments if present
    if (attachments && attachments.length > 0) {
      // Create a new AbortController for this upload session
      const abortController = new AbortController();
      uploadAbortControllerRef.current = abortController;

      setIsUploading(true);
      try {
        const uploadedFiles: { name: string; url: string; type: string }[] = [];

        for (const file of attachments) {
          // Check if upload was cancelled
          if (abortController.signal.aborted) {
            throw new Error('Upload cancelled');
          }

          const isImage = file.type.startsWith('image/');

          if (isImage) {
            const result = await uploadImage(file, 'chat-attachments', true, abortController.signal);
            uploadedFiles.push({
              name: file.name,
              url: result.url,
              type: 'image',
            });
          } else {
            const result = await uploadFile(file, 'chat-attachments', true, abortController.signal);
            uploadedFiles.push({
              name: file.name,
              url: result.url,
              type: result.fileType,
            });
          }
        }

        // Build message with uploaded file URLs
        const fileDescriptions = uploadedFiles.map(f =>
          f.type === 'image'
            ? `[Image: ${f.name}](${f.url})`
            : `[File: ${f.name}](${f.url})`
        ).join('\n');

        // Send user's message with file descriptions appended
        const messageWithAttachments = content
          ? `${content}\n\n${fileDescriptions}`
          : fileDescriptions;

        sendMessage(messageWithAttachments);
      } catch (uploadError: any) {
        // Handle cancellation gracefully
        if (uploadError?.name === 'AbortError' || uploadError?.name === 'CanceledError' || uploadError?.message === 'Upload cancelled') {
          console.log('[IntelligentChatPanel] Upload cancelled by user');
          // Don't show error for user-initiated cancellation
          return;
        }

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
        uploadAbortControllerRef.current = null;
      }
    } else {
      sendMessage(content);
    }
  };

  // GitHub App installation URL state
  const [githubInstallUrl, setGithubInstallUrl] = useState<string>('');

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

        // Check if user needs to install the GitHub App
        if (repoError instanceof GitHubInstallationNeededError) {
          setGithubInstallUrl(repoError.installUrl);
          setGithubStep('install');
          setGithubMessage('Select which repositories to share with All Thrive AI.');
          return;
        }

        setGithubMessage(repoError.message || 'Failed to load repositories. Please try again.');
        setGithubStep('idle');
      }
    } catch (error) {
      console.error('GitHub import error:', error);
      setGithubMessage('Something went wrong. Please try again.');
      setGithubStep('idle');
    }
  }, []);

  const handleInstallGitHubApp = () => {
    if (githubInstallUrl) {
      window.location.href = githubInstallUrl;
    } else {
      window.location.href = 'https://github.com/apps/all-thrive-ai/installations/new';
    }
  };

  const handleConnectGitHub = () => {
    const backendUrl = import.meta.env.VITE_API_URL;
    if (!backendUrl) {
      console.error('[IntelligentChatPanel] VITE_API_URL is not configured');
      return;
    }
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

  // GitLab integration handlers
  const handleGitLabImport = useCallback(async () => {
    setGitlabStep('loading');
    setGitlabMessage('Checking your GitLab connection...');
    setHasInteracted(true);

    try {
      const isConnected = await checkGitLabConnection();

      if (!isConnected) {
        setGitlabStep('connect');
        setGitlabMessage('You need to connect your GitLab account first.');
        return;
      }

      // Fetch projects
      setGitlabMessage('Loading your GitLab projects...');

      try {
        const fetchedProjects = await fetchGitLabProjects();
        setGitlabProjects(fetchedProjects);
        setGitlabStep('projects');
        setGitlabMessage(`Found ${fetchedProjects.length} projects!`);
      } catch (projectError: any) {
        console.error('Failed to fetch GitLab projects:', projectError);
        setGitlabMessage(projectError.message || 'Failed to load projects. Please try again.');
        setGitlabStep('idle');
      }
    } catch (error) {
      console.error('GitLab import error:', error);
      setGitlabMessage('Something went wrong. Please try again.');
      setGitlabStep('idle');
    }
  }, []);

  const handleConnectGitLab = () => {
    const backendUrl = import.meta.env.VITE_API_URL;
    if (!backendUrl) {
      console.error('[IntelligentChatPanel] VITE_API_URL is not configured');
      return;
    }
    const frontendUrl = window.location.origin;
    const returnPath = window.location.pathname + window.location.search;

    // Redirect to GitLab OAuth via social connect endpoint
    const redirectUrl = `${backendUrl}/api/v1/social/connect/gitlab/?next=${encodeURIComponent(frontendUrl + returnPath)}`;
    window.location.href = redirectUrl;
  };

  const handleSelectGitLabProject = async (project: GitLabProject) => {
    // Close the project picker UI
    handleCancelGitLab();

    // Use the AI agent to import the project with template-based analysis
    const importMessage = `Import this GitLab project to my showcase: ${project.htmlUrl}`;

    // Send message to the chat agent
    setHasInteracted(true);
    sendMessage(importMessage);
  };

  const handleCancelGitLab = () => {
    setGitlabStep('idle');
    setGitlabMessage('');
    setGitlabProjects([]);
    setGitlabSearchQuery('');
  };

  // Figma integration handlers
  const handleFigmaImport = useCallback(async () => {
    setFigmaStep('loading');
    setFigmaMessage('Checking your Figma connection...');
    setHasInteracted(true);

    try {
      const isConnected = await checkFigmaConnection();

      if (!isConnected) {
        setFigmaStep('connect');
        setFigmaMessage('You need to connect your Figma account first.');
        return;
      }

      // Figma is connected - prompt user to paste a Figma URL
      setFigmaStep('ready');
      setFigmaMessage('Paste a Figma file URL below to import your design.');
    } catch (error) {
      console.error('Figma import error:', error);
      setFigmaMessage('Something went wrong. Please try again.');
      setFigmaStep('idle');
    }
  }, []);

  const handleConnectFigma = () => {
    const backendUrl = import.meta.env.VITE_API_URL;
    if (!backendUrl) {
      console.error('[IntelligentChatPanel] VITE_API_URL is not configured');
      return;
    }
    const frontendUrl = window.location.origin;
    const returnPath = window.location.pathname + window.location.search;

    // Redirect to Figma OAuth via social connect endpoint
    const redirectUrl = `${backendUrl}/api/v1/social/connect/figma/?next=${encodeURIComponent(frontendUrl + returnPath)}`;
    window.location.href = redirectUrl;
  };

  const handleCancelFigma = () => {
    setFigmaStep('idle');
    setFigmaMessage('');
  };

  // Handle Figma URL import
  const handleFigmaUrlImport = useCallback(async (url: string) => {
    setFigmaStep('loading');
    setFigmaMessage('Fetching Figma file info...');

    try {
      // Parse the URL to get the file key
      const parsed = parseFigmaUrl(url);
      if (!parsed) {
        setFigmaMessage('Invalid Figma URL. Please paste a valid file URL.');
        setFigmaStep('ready');
        return;
      }

      // Get file preview to validate and show info
      const preview = await getFigmaFilePreview(parsed.fileKey);

      // Reset Figma state
      setFigmaStep('idle');
      setFigmaMessage('');

      // Send message to AI agent to import the file
      sendMessage(`Import this Figma design as a project: ${url}\n\nFile: ${preview.name}\nPages: ${preview.pageCount}`);
    } catch (error: any) {
      console.error('Figma URL import error:', error);
      setFigmaMessage(error.message || 'Failed to fetch Figma file. Please check the URL and try again.');
      setFigmaStep('ready');
    }
  }, [sendMessage]);

  // Fetch all integration connection statuses
  const fetchIntegrationStatuses = useCallback(async () => {
    setLoadingIntegrationStatus(true);
    try {
      const [githubConnected, gitlabConnected, figmaConnected] = await Promise.all([
        checkGitHubConnection(),
        checkGitLabConnection(),
        checkFigmaConnection(),
      ]);

      // For YouTube, check Google OAuth status
      let youtubeConnected = false;
      try {
        const { api } = await import('@/services/api');
        const response = await api.get('/social/status/google/');
        youtubeConnected = response.data?.data?.connected || response.data?.connected || false;
      } catch {
        youtubeConnected = false;
      }

      setIntegrationStatus({
        github: githubConnected,
        gitlab: gitlabConnected,
        figma: figmaConnected,
        youtube: youtubeConnected,
      });
    } catch (error) {
      console.error('Failed to fetch integration statuses:', error);
    } finally {
      setLoadingIntegrationStatus(false);
    }
  }, []);

  // Open integration picker and fetch statuses
  const handleOpenIntegrationPicker = useCallback(() => {
    setShowIntegrationPicker(true);
    setHasInteracted(true);
    fetchIntegrationStatuses();
  }, [fetchIntegrationStatuses]);

  // Handle integration selection from picker
  const handlePickerIntegrationSelect = useCallback((integration: 'github' | 'gitlab' | 'figma' | 'youtube') => {
    setShowIntegrationPicker(false);
    switch (integration) {
      case 'github':
        handleGitHubImport();
        break;
      case 'gitlab':
        handleGitLabImport();
        break;
      case 'figma':
        handleFigmaImport();
        break;
      case 'youtube':
        sendMessage('I want to import a YouTube video as a project');
        break;
    }
  }, [handleGitHubImport, handleGitLabImport, handleFigmaImport, sendMessage]);

  const handleIntegrationSelect = useCallback(async (type: IntegrationType) => {
    switch (type) {
      case 'import-url':
        // Send a message to trigger URL import flow in chat
        setHasInteracted(true);
        sendMessage('I want to import a project from a URL');
        break;
      case 'github':
        // Use direct GitHub integration flow instead of AI
        handleGitHubImport();
        break;
      case 'gitlab':
        // Use direct GitLab integration flow
        handleGitLabImport();
        break;
      case 'figma':
        // Use direct Figma integration flow
        handleFigmaImport();
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
        // Directly start support conversation
        setHasInteracted(true);
        sendMessage('I need help with something');
        break;
      case 'clear-conversation':
        // Clear the conversation - same as /clear command
        clearMessages();
        setHasInteracted(false);
        setError(undefined);
        setQuotaExceeded(null);
        // Reset any integration states
        setGithubStep('idle');
        setGitlabStep('idle');
        setFigmaStep('idle');
        setShowIntegrationPicker(false);
        break;
      case 'describe':
        sendMessage("I'd like to describe something to you");
        break;
      case 'create-product':
        // Set product creation context and show welcome
        setHasInteracted(true);
        sendMessage('I want to create a digital product to sell on the marketplace');
        break;
      case 'upload-media':
        // Trigger file selection dialog
        if (triggerFileSelectRef.current) {
          triggerFileSelectRef.current();
        }
        break;
    }
  }, [handleGitHubImport, handleGitLabImport, handleFigmaImport, sendMessage]);

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

          {/* Install GitHub App to select repos */}
          {githubStep === 'install' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Choose which repositories you want to share with All Thrive AI. You control exactly what we can access.
              </p>
              <button
                onClick={handleInstallGitHubApp}
                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faGithub} />
                Select Repositories
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

              {/* Action buttons */}
              <div className="flex items-center gap-4">
                <button
                  onClick={handleCancelGitHub}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
                <a
                  href="https://github.com/apps/all-thrive-ai/installations/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300"
                >
                  + Add more repos
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render GitLab integration UI
  const renderGitLabUI = () => {
    if (gitlabStep === 'idle') return null;

    return (
      <div className="flex flex-col items-start justify-start px-4 pt-4">
        <div className="w-full max-w-md">
          {/* Status message */}
          {gitlabMessage && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
              <p className="text-sm">{gitlabMessage}</p>
            </div>
          )}

          {/* Loading state */}
          {(gitlabStep === 'loading' || gitlabStep === 'importing') && (
            <div className="flex justify-center py-8">
              <FontAwesomeIcon icon={faSpinner} className="w-8 h-8 text-primary-500 animate-spin" />
            </div>
          )}

          {/* Connect GitLab button */}
          {gitlabStep === 'connect' && (
            <div className="space-y-3">
              <button
                onClick={handleConnectGitLab}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faGitlab} />
                Connect GitLab
              </button>
              <button
                onClick={handleCancelGitLab}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Project list */}
          {gitlabStep === 'projects' && gitlabProjects.length > 0 && (
            <div className="space-y-3">
              {/* Search */}
              <input
                type="text"
                placeholder="Search projects..."
                value={gitlabSearchQuery}
                onChange={(e) => setGitlabSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white"
              />

              {/* Project list */}
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {gitlabProjects
                  .filter((project) =>
                    gitlabSearchQuery.trim() === ''
                      ? true
                      : project.name.toLowerCase().includes(gitlabSearchQuery.toLowerCase()) ||
                        project.description?.toLowerCase().includes(gitlabSearchQuery.toLowerCase())
                  )
                  .slice(0, 20)
                  .map((project) => (
                    <button
                      key={project.fullName}
                      onClick={() => handleSelectGitLabProject(project)}
                      className="w-full text-left px-3 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary-500 transition-all text-sm"
                    >
                      <div className="font-medium text-gray-900 dark:text-white">{project.name}</div>
                      {project.description && (
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                          {project.description}
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-500">
                        {project.language && <span>{project.language}</span>}
                        {project.stars > 0 && (
                          <span className="flex items-center gap-1">
                            <FontAwesomeIcon icon={faStar} className="w-3 h-3" />
                            {project.stars}
                          </span>
                        )}
                        {project.forks > 0 && (
                          <span className="flex items-center gap-1">
                            <FontAwesomeIcon icon={faCodeBranch} className="w-3 h-3" />
                            {project.forks}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
              </div>

              {/* Cancel button */}
              <button
                onClick={handleCancelGitLab}
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

  // Render Figma integration UI
  const renderFigmaUI = () => {
    if (figmaStep === 'idle') return null;

    return (
      <div className="flex flex-col items-start justify-start px-4 pt-4">
        <div className="w-full max-w-md">
          {/* Status message */}
          {figmaMessage && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
              <p className="text-sm">{figmaMessage}</p>
            </div>
          )}

          {/* Loading state */}
          {figmaStep === 'loading' && (
            <div className="flex justify-center py-8">
              <FontAwesomeIcon icon={faSpinner} className="w-8 h-8 text-primary-500 animate-spin" />
            </div>
          )}

          {/* Connect Figma button */}
          {figmaStep === 'connect' && (
            <div className="space-y-3">
              <button
                onClick={handleConnectFigma}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faFigma} />
                Connect Figma
              </button>
              <button
                onClick={handleCancelFigma}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Ready state - prompt to paste URL */}
          {figmaStep === 'ready' && (
            <div className="space-y-3">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <p className="mb-2">Figma connected! To import a design:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Open your Figma file</li>
                  <li>Copy the URL from your browser</li>
                  <li>Paste it in the chat below</li>
                </ol>
              </div>
              <button
                onClick={handleCancelFigma}
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

  // Render integration picker overlay
  const renderIntegrationPicker = () => {
    if (!showIntegrationPicker) return null;

    const integrations = [
      {
        id: 'github' as const,
        name: 'GitHub',
        description: 'Import repositories as projects',
        icon: faGithub,
        color: 'text-gray-900 dark:text-white',
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        type: 'integration' as const,
      },
      {
        id: 'gitlab' as const,
        name: 'GitLab',
        description: 'Import GitLab projects',
        icon: faGitlab,
        color: 'text-orange-600',
        bgColor: 'bg-orange-100 dark:bg-orange-900/30',
        type: 'integration' as const,
      },
      {
        id: 'figma' as const,
        name: 'Figma',
        description: 'Import design files',
        icon: faFigma,
        color: 'text-purple-600',
        bgColor: 'bg-purple-100 dark:bg-purple-900/30',
        type: 'integration' as const,
      },
      {
        id: 'youtube' as const,
        name: 'YouTube',
        description: 'Import videos as projects',
        icon: faYoutube,
        color: 'text-red-600',
        bgColor: 'bg-red-100 dark:bg-red-900/30',
        type: 'integration' as const,
      },
    ];

    return (
      <div className="flex flex-col items-center justify-center h-full px-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-3">
              <FontAwesomeIcon icon={faPlug} className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
              Connect an Integration
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Import your projects from these platforms
            </p>
          </div>

          <div className="space-y-2">
            {integrations.map((integration) => {
              const isConnected = integrationStatus[integration.id];
              return (
                <button
                  key={integration.id}
                  onClick={() => handlePickerIntegrationSelect(integration.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-slate-200 dark:border-slate-700 group"
                >
                  <div className={`w-10 h-10 rounded-lg ${integration.bgColor} flex items-center justify-center flex-shrink-0`}>
                    <FontAwesomeIcon icon={integration.icon} className={`w-5 h-5 ${integration.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {integration.name}
                      </span>
                      {loadingIntegrationStatus ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                          <FontAwesomeIcon icon={faSpinner} className="w-2.5 h-2.5 animate-spin" />
                        </span>
                      ) : isConnected ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                          <FontAwesomeIcon icon={faCheck} className="w-2.5 h-2.5" />
                          Connected
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                      {integration.description}
                    </p>
                  </div>
                  <div className="text-slate-400 group-hover:text-primary-500 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setShowIntegrationPicker(false)}
            className="mt-4 w-full text-center text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 py-2"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  };

  // Empty state when no messages
  const renderEmptyState = () => {
    if (messages.length > 0 || hasInteracted) return null;

    // Support mode - simple chat-first experience
    if (isSupportMode) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center px-6">
          <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-4">
            <span className="text-3xl">💬</span>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
            How can we help?
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-sm">
            Ask me anything about All Thrive. I'm here to help with your questions, troubleshooting, or feedback.
          </p>
        </div>
      );
    }

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

    // Product creation mode empty state
    if (productCreationMode) {
      return (
        <div className="flex flex-col items-start justify-start h-full px-4 pt-4">
          <div className="max-w-md">
            <div className="mb-4 px-4 py-3 rounded-lg bg-gradient-to-br from-primary-50 to-cyan-50 dark:from-primary-900/20 dark:to-cyan-900/20 border border-primary-200 dark:border-primary-800">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🛍️</span>
                <p className="text-sm font-medium text-primary-800 dark:text-primary-200">
                  Let's create your product!
                </p>
              </div>
              <p className="text-sm text-primary-700 dark:text-primary-300 mb-3">
                I can help you build courses, templates, prompt packs, and digital downloads.
              </p>
              <div className="space-y-1.5 text-xs text-primary-600 dark:text-primary-400">
                <p>• <strong>Import from YouTube</strong> - Transform a video into a course</p>
                <p>• <strong>Describe your idea</strong> - Tell me what you want to create</p>
                <p>• <strong>Upload content</strong> - Share existing materials to structure</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 px-1">
              Type a message below or click the + button for more options.
            </p>
          </div>
        </div>
      );
    }

    // Default empty state - conversational greeting with quick actions
    const quickActions: Array<{ label: string; icon: string | import('@fortawesome/fontawesome-svg-core').IconDefinition; prompt: string }> = [
      { label: 'Paste in a URL', icon: faFolderPlus, prompt: 'I want to add a new project to my profile' },
      { label: 'Make an infographic', icon: 'banana', prompt: 'I want to create an infographic' },
      { label: 'Brainstorm ideas', icon: faLightbulb, prompt: 'Help me brainstorm some ideas' },
      { label: 'Find something', icon: faMagnifyingGlass, prompt: 'Help me find something on All Thrive' },
    ];

    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <div className="mb-4">
          <img
            src="/all-thrvie-logo.png"
            alt="All Thrive"
            className="w-12 h-12 rounded-full object-cover"
          />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
          Hey! How can I help you today?
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-sm">
          I'm here to assist with your projects and ideas.
        </p>

        {/* All action buttons in a 3x2 grid */}
        <div className="grid grid-cols-3 gap-2 w-full max-w-md">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => handleSendMessage(action.prompt)}
              className="flex flex-col items-center justify-center gap-1.5 px-3 py-3 text-center text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors border border-slate-200 dark:border-slate-700 min-h-[72px]"
            >
              {action.icon === 'banana' ? (
                <span className="text-lg">🍌</span>
              ) : (
                <FontAwesomeIcon icon={action.icon as any} className="w-5 h-5 text-primary-500" />
              )}
              <span className="text-slate-700 dark:text-slate-300 text-xs leading-tight">{action.label}</span>
            </button>
          ))}
          <button
            onClick={handleOpenIntegrationPicker}
            className="flex flex-col items-center justify-center gap-1.5 px-3 py-3 text-center text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors border border-slate-200 dark:border-slate-700 min-h-[72px]"
          >
            <FontAwesomeIcon icon={faPlug} className="w-5 h-5 text-primary-500" />
            <span className="text-slate-700 dark:text-slate-300 text-xs leading-tight">Connect an Integration</span>
          </button>
          <button
            onClick={() => {
              setHasInteracted(true);
              sendMessage("I want to create a new project manually. Help me get started.");
            }}
            className="flex flex-col items-center justify-center gap-1.5 px-3 py-3 text-center text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors border border-slate-200 dark:border-slate-700 min-h-[72px]"
          >
            <FontAwesomeIcon icon={faPencil} className="w-5 h-5 text-primary-500" />
            <span className="text-slate-700 dark:text-slate-300 text-xs leading-tight">Create Manually</span>
          </button>
          <button
            onClick={() => {
              setHasInteracted(true);
              sendMessage("I want to upload files by dragging and dropping them");
            }}
            className="col-span-3 flex flex-col items-center justify-center gap-1.5 px-3 py-3 text-center text-sm bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors border-2 border-dashed border-slate-300 dark:border-slate-600 min-h-[72px]"
          >
            <span className="text-slate-400 dark:text-slate-500 text-xs leading-tight">Drag and drop any image or video to make a project</span>
          </button>
        </div>
      </div>
    );
  };

  // Pending orchestration action confirmation dialog
  const renderPendingActionConfirmation = () => {
    if (!pendingAction) return null;

    return (
      <div className="mx-4 mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔥</span>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Ember wants to perform an action
            </p>
          </div>
          <p className="text-sm text-amber-700 dark:text-amber-400">
            {pendingAction.description}
          </p>
          <div className="flex gap-2">
            <button
              onClick={confirmPendingAction}
              className="flex-1 px-3 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-md transition-colors"
            >
              Yes, do it
            </button>
            <button
              onClick={cancelPendingAction}
              className="flex-1 px-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
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
    } catch (error) {
      console.error('[IntelligentChatPanel] Failed to set featured image:', error);
      throw error; // Re-throw so GeneratedImageMessage can show error state
    }
  }, [currentProjectId]);

  // Handle creating a project from a Nano Banana image session
  const handleCreateProjectFromImage = useCallback(async (sessionId: number) => {
    try {
      const result = await createProjectFromImageSession(sessionId);

      return {
        projectUrl: result.project.url,
        projectTitle: result.project.title,
      };
    } catch (error) {
      console.error('[IntelligentChatPanel] Failed to create project from image:', error);
      throw error; // Re-throw so GeneratedImageMessage can show error state
    }
  }, []);

  // Check if message is asking user to connect GitHub
  const shouldShowGitHubConnectButton = useCallback((content: string) => {
    const lowerContent = content.toLowerCase();
    return (
      (lowerContent.includes('connect github') || lowerContent.includes('connect your github')) &&
      (lowerContent.includes('settings') || lowerContent.includes('integrations'))
    );
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
            onCreateProject={message.metadata.sessionId ? handleCreateProjectFromImage : undefined}
          />
        </div>
      );
    }

    // Handle onboarding intro message
    if (messageType === 'onboarding_intro') {
      return (
        <OnboardingIntroMessage
          username={onboarding.username}
          onContinue={onboarding.handleIntroComplete}
          onSkip={onboarding.handleIntroSkip}
        />
      );
    }

    // Handle onboarding avatar prompt
    if (messageType === 'onboarding_avatar_prompt') {
      return (
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
        />
      );
    }

    // Handle onboarding avatar preview
    if (messageType === 'onboarding_avatar_preview' && message.metadata?.avatarImageUrl) {
      return (
        <AvatarPreviewMessage
          imageUrl={message.metadata.avatarImageUrl}
          onAccept={onboarding.handleAcceptAvatar}
          onRefine={onboarding.handleRefineAvatar}
          onSkip={onboarding.handleSkipPreview}
          isAccepting={onboarding.isAvatarSaving}
        />
      );
    }

    // Handle onboarding path selection
    if (messageType === 'onboarding_path_selection') {
      return (
        <PathSelectionMessage
          selectedPath={onboarding.selectedPath}
          onSelectPath={onboarding.handleSelectPath}
        />
      );
    }

    // Standard text message
    const showGitHubButton = !isUser && shouldShowGitHubConnectButton(message.content);

    return (
      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`max-w-[85%] px-4 py-2 rounded-lg ${
            isUser
              ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700'
          }`}
        >
          {isUser ? (
            <span className="whitespace-pre-wrap break-words">{message.content}</span>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  // Override default paragraph to not have bottom margin on last element
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  // Handle links - internal links navigate, external open in new tab
                  a: ({ href, children }) => {
                    const isInternal = href?.startsWith('/');
                    if (isInternal) {
                      return (
                        <a
                          href={href}
                          onClick={(e) => {
                            e.preventDefault();
                            onClose(); // Close the chat panel
                            navigate(href || '/');
                          }}
                          className="text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer"
                        >
                          {children}
                        </a>
                      );
                    }
                    return (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 hover:underline">
                        {children}
                      </a>
                    );
                  },
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
              {/* Show Connect GitHub button when AI asks user to connect */}
              {showGitHubButton && (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <button
                    onClick={handleConnectGitHub}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <FontAwesomeIcon icon={faGithub} />
                    Connect GitHub
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }, [currentProjectId, handleUseAsFeaturedImage, handleCreateProjectFromImage, shouldShowGitHubConnectButton, handleConnectGitHub, navigate, onClose, onboarding]);

  return (
    <ChatInterface
      isOpen={isOpen}
      onClose={onClose}
      onSendMessage={handleSendMessage}
      messages={allMessages as any}
      isLoading={isLoading || isUploading}
      currentTool={currentTool}
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
            <img
              src="/all-thrvie-logo.png"
              alt="All Thrive"
              className="h-6 w-auto"
            />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              All Thrive AI Chat
            </h2>

            {/* Connection status indicator */}
            <div
              data-testid="connection-status"
              data-status={isConnected ? 'connected' : isConnecting ? 'connecting' : 'disconnected'}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                isConnected
                  ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                  : isConnecting
                  ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                  : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
              }`}
              title={isConnected ? 'Connected' : isConnecting ? 'Reconnecting' : 'Disconnected'}
            >
              <span className="mr-1.5">{isConnected ? '●' : isConnecting ? '◐' : '○'}</span>
              {isConnected ? 'Live' : isConnecting ? 'Reconnecting...' : 'Offline'}
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
        showIntegrationPicker ? (
          <>
            {renderQuotaExceeded()}
            {renderPendingActionConfirmation()}
            {renderIntegrationPicker()}
          </>
        ) : githubStep !== 'idle' ? (
          <>
            {renderQuotaExceeded()}
            {renderPendingActionConfirmation()}
            {renderGitHubUI()}
          </>
        ) : gitlabStep !== 'idle' ? (
          <>
            {renderQuotaExceeded()}
            {renderPendingActionConfirmation()}
            {renderGitLabUI()}
          </>
        ) : figmaStep !== 'idle' ? (
          <>
            {renderQuotaExceeded()}
            {renderPendingActionConfirmation()}
            {renderFigmaUI()}
          </>
        ) : pendingAction ? (
          // Show pending action confirmation when there's a pending orchestration action
          <>
            {renderQuotaExceeded()}
            {renderPendingActionConfirmation()}
          </>
        ) : undefined
      }
      enableAttachments={true}
      isUploading={isUploading}
      onCancelUpload={handleCancelUpload}
      onCancelProcessing={cancelProcessing}
      onFileSelectRef={(triggerFn) => {
        triggerFileSelectRef.current = triggerFn;
      }}
    />
  );
}
