/**
 * useIntegrationFlow - State machine hook for managing integration flows
 *
 * Manages GitHub, GitLab, Figma, and YouTube integration states.
 * Each integration follows a flow: idle → loading → connect/install → select → importing
 *
 * Features:
 * - State machine for each integration
 * - Connection status checking
 * - OAuth redirect handling
 * - Integration picker state
 */

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { api } from '@/services/api';
import { logError } from '@/utils/errorHandler';
import { getErrorMessage } from '@/utils/errors';
import type { IntegrationState, IntegrationActions, IntegrationId, IntegrationFlowStep } from '../core/types';
import type { IntelligentChatMetadata } from '@/hooks/useIntelligentChat';

interface UseIntegrationFlowOptions {
  onSendMessage: (message: string) => void;
  onHasInteracted?: () => void;
  onAddLocalMessage?: (content: string, metadata?: IntelligentChatMetadata) => void;
}

interface IntegrationFlowReturn {
  // State
  state: IntegrationState;
  // Actions
  actions: IntegrationActions;
  // GitHub-specific
  githubRepos: GitHubRepository[];
  githubSearchQuery: string;
  setGithubSearchQuery: (query: string) => void;
  githubInstallUrl: string;
  handleSelectGitHubRepo: (repo: GitHubRepository) => void;
  handleConnectGitHub: () => void;
  handleInstallGitHubApp: () => void;
  // GitLab-specific
  gitlabProjects: GitLabProject[];
  gitlabSearchQuery: string;
  setGitlabSearchQuery: (query: string) => void;
  handleSelectGitLabProject: (project: GitLabProject) => void;
  handleConnectGitLab: () => void;
  // Figma-specific
  handleConnectFigma: () => void;
  handleFigmaUrlImport: (url: string) => Promise<void>;
  isFigmaUrl: (url: string) => boolean;
}

const initialFlowState = {
  step: 'idle' as IntegrationFlowStep,
  message: '',
  error: null as string | null,
};

export function useIntegrationFlow({
  onSendMessage,
  onHasInteracted,
  onAddLocalMessage,
}: UseIntegrationFlowOptions): IntegrationFlowReturn {
  const [searchParams, setSearchParams] = useSearchParams();

  // Integration flow states
  const [activeFlow, setActiveFlow] = useState<IntegrationId | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  // GitHub state
  const [githubState, setGithubState] = useState(initialFlowState);
  const [githubRepos, setGithubRepos] = useState<GitHubRepository[]>([]);
  const [githubSearchQuery, setGithubSearchQuery] = useState('');
  const [githubInstallUrl, setGithubInstallUrl] = useState('');

  // GitLab state
  const [gitlabState, setGitlabState] = useState(initialFlowState);
  const [gitlabProjects, setGitlabProjects] = useState<GitLabProject[]>([]);
  const [gitlabSearchQuery, setGitlabSearchQuery] = useState('');

  // Figma state
  const [figmaState, setFigmaState] = useState(initialFlowState);

  // YouTube state (simple - just connection status)
  const [youtubeState, setYoutubeState] = useState(initialFlowState);

  // Connection status
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
      const [githubConnected, gitlabConnected, figmaConnected] = await Promise.all([
        checkGitHubConnection(),
        checkGitLabConnection(),
        checkFigmaConnection(),
      ]);

      // Check YouTube via Google OAuth
      let youtubeConnected = false;
      try {
        const response = await api.get('/social/status/google/');
        youtubeConnected = response.data?.data?.connected || response.data?.connected || false;
      } catch (error) {
        logError('useIntegrationFlow.checkYouTubeConnection', error);
        youtubeConnected = false;
      }

      setConnectionStatus({
        github: githubConnected,
        gitlab: gitlabConnected,
        figma: figmaConnected,
        youtube: youtubeConnected,
        loading: false,
      });
    } catch (error) {
      logError('useIntegrationFlow.fetchConnectionStatuses', error);
      setConnectionStatus((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  // GitHub handlers
  const startGitHubFlow = useCallback(async () => {
    setActiveFlow('github');
    setGithubState({ step: 'loading', message: 'Checking your GitHub connection...', error: null });
    onHasInteracted?.();

    try {
      const isConnected = await checkGitHubConnection();

      if (!isConnected) {
        setGithubState({
          step: 'connect',
          message: 'You need to connect your GitHub account first.',
          error: null,
        });
        return;
      }

      setGithubState({ step: 'loading', message: 'Loading your GitHub repositories...', error: null });

      try {
        const repos = await fetchGitHubRepos();
        setGithubRepos(repos);
        setGithubState({
          step: 'select',
          message: `Found ${repos.length} repositories!`,
          error: null,
        });
      } catch (repoError) {
        if (repoError instanceof GitHubInstallationNeededError) {
          setGithubInstallUrl(repoError.installUrl);
          setGithubState({
            step: 'install',
            message: 'Select which repositories to share with All Thrive AI.',
            error: null,
          });
          return;
        }
        // Check if this is a token expiration/auth error - show connect UI instead of error
        const errorMessage = getErrorMessage(repoError) || '';
        if (errorMessage.toLowerCase().includes('connect') ||
            errorMessage.toLowerCase().includes('expired') ||
            errorMessage.toLowerCase().includes('token')) {
          setGithubState({
            step: 'connect',
            message: 'Your GitHub connection has expired. Please reconnect.',
            error: null,
          });
          return;
        }
        // Keep activeFlow as 'github' so the error UI is displayed
        setGithubState({
          step: 'idle',
          message: '',
          error: errorMessage || 'Failed to load repositories.',
        });
      }
    } catch (error) {
      logError('useIntegrationFlow.startGitHubFlow', error);
      // Keep activeFlow as 'github' so the error UI is displayed
      setGithubState({
        step: 'idle',
        message: '',
        error: 'Something went wrong. Please try again.',
      });
    }
  }, [onHasInteracted]);

  const handleConnectGitHub = useCallback(() => {
    const backendUrl = import.meta.env.VITE_API_URL;
    if (!backendUrl) return;
    const frontendUrl = window.location.origin;
    // Add ?connected=github so we can detect the return from OAuth
    const returnUrl = new URL(window.location.pathname, frontendUrl);
    returnUrl.searchParams.set('connected', 'github');
    window.location.href = `${backendUrl}/accounts/github/login/?process=connect&next=${encodeURIComponent(returnUrl.toString())}`;
  }, []);

  const handleInstallGitHubApp = useCallback(() => {
    if (githubInstallUrl) {
      window.location.href = githubInstallUrl;
    } else {
      window.location.href = 'https://github.com/apps/all-thrive-ai/installations/new';
    }
  }, [githubInstallUrl]);

  const handleSelectGitHubRepo = useCallback((repo: GitHubRepository) => {
    // Reset state and send message to chat
    setGithubState(initialFlowState);
    setGithubRepos([]);
    setGithubSearchQuery('');
    setActiveFlow(null);
    onSendMessage(`Import this GitHub repository to my playground: ${repo.htmlUrl}`);
  }, [onSendMessage]);

  // GitLab handlers
  const startGitLabFlow = useCallback(async () => {
    setActiveFlow('gitlab');
    setGitlabState({ step: 'loading', message: 'Checking your GitLab connection...', error: null });
    onHasInteracted?.();

    try {
      const isConnected = await checkGitLabConnection();

      if (!isConnected) {
        setGitlabState({
          step: 'connect',
          message: 'You need to connect your GitLab account first.',
          error: null,
        });
        return;
      }

      setGitlabState({ step: 'loading', message: 'Loading your GitLab projects...', error: null });

      try {
        const projects = await fetchGitLabProjects();
        setGitlabProjects(projects);
        setGitlabState({
          step: 'select',
          message: `Found ${projects.length} projects!`,
          error: null,
        });
      } catch (projectError) {
        // Keep activeFlow as 'gitlab' so the error UI is displayed
        setGitlabState({
          step: 'idle',
          message: '',
          error: getErrorMessage(projectError) || 'Failed to load projects.',
        });
      }
    } catch (error) {
      logError('useIntegrationFlow.startGitLabFlow', error);
      // Keep activeFlow as 'gitlab' so the error UI is displayed
      setGitlabState({
        step: 'idle',
        message: '',
        error: 'Something went wrong. Please try again.',
      });
    }
  }, [onHasInteracted]);

  const handleConnectGitLab = useCallback(() => {
    const backendUrl = import.meta.env.VITE_API_URL;
    if (!backendUrl) return;
    const frontendUrl = window.location.origin;
    // Add ?connected=gitlab so we can detect the return from OAuth
    const returnUrl = new URL(window.location.pathname, frontendUrl);
    returnUrl.searchParams.set('connected', 'gitlab');
    window.location.href = `${backendUrl}/api/v1/social/connect/gitlab/?next=${encodeURIComponent(returnUrl.toString())}`;
  }, []);

  const handleSelectGitLabProject = useCallback((project: GitLabProject) => {
    setGitlabState(initialFlowState);
    setGitlabProjects([]);
    setGitlabSearchQuery('');
    setActiveFlow(null);
    onSendMessage(`Import this GitLab project to my playground: ${project.htmlUrl}`);
  }, [onSendMessage]);

  // Figma handlers
  const startFigmaFlow = useCallback(async () => {
    onHasInteracted?.();

    try {
      const isConnected = await checkFigmaConnection();

      if (!isConnected) {
        // Add message to chat with connect button instead of showing panel
        if (onAddLocalMessage) {
          onAddLocalMessage(
            "I'd love to help you import a design from Figma! First, you'll need to connect your Figma account so I can access your files.",
            { type: 'figma_connect' }
          );
        }
        return;
      }

      // User is connected - add message to chat with URL input
      if (onAddLocalMessage) {
        onAddLocalMessage(
          "Great, your Figma account is connected! Paste a Figma file URL below to import your design.",
          { type: 'figma_url_input' }
        );
      }
    } catch (error) {
      logError('useIntegrationFlow.startFigmaFlow', error);
      // Add error message to chat
      if (onAddLocalMessage) {
        onAddLocalMessage(
          "I had trouble checking your Figma connection. Please try again in a moment.",
          { type: 'text' }
        );
      }
    }
  }, [onHasInteracted, onAddLocalMessage]);

  const handleConnectFigma = useCallback(() => {
    const backendUrl = import.meta.env.VITE_API_URL;
    if (!backendUrl) return;
    const frontendUrl = window.location.origin;
    // Add ?connected=figma so we can detect the return from OAuth
    const returnUrl = new URL(window.location.pathname, frontendUrl);
    returnUrl.searchParams.set('connected', 'figma');
    window.location.href = `${backendUrl}/api/v1/social/connect/figma/?next=${encodeURIComponent(returnUrl.toString())}`;
  }, []);

  const handleFigmaUrlImport = useCallback(async (url: string) => {
    setFigmaState({ step: 'loading', message: 'Fetching Figma file info...', error: null });

    try {
      const parsed = parseFigmaUrl(url);
      if (!parsed) {
        const errorMsg = 'Invalid Figma URL. Please paste a valid file URL.';
        setFigmaState({
          step: 'select',
          message: errorMsg,
          error: null,
        });
        throw new Error(errorMsg);
      }

      // For Figma Slides (/make/ URLs) or .figma.site URLs, skip the API preview
      // and let the agent use web scraping to get the info
      if (parsed.fileType === 'slides' || parsed.fileType === 'site') {
        // Reset and send directly to chat - agent will scrape the page
        setFigmaState(initialFlowState);
        setActiveFlow(null);
        const fileType = parsed.fileType === 'slides' ? 'Figma Slides' : 'Figma';
        // Send user's import request - keep it simple, agent will handle the rest
        onSendMessage(`Import this ${fileType} design as a project: ${url}${parsed.name ? `\n\nFile: ${parsed.name}` : ''}`);
        return;
      }

      // For regular design files, use the API to get preview info
      const preview = await getFigmaFilePreview(parsed.fileKey, parsed.fileType);

      // Reset and send to chat
      setFigmaState(initialFlowState);
      setActiveFlow(null);
      onSendMessage(`Import this Figma design as a project: ${url}\n\nFile: ${preview.name}\nPages: ${preview.pageCount}`);
    } catch (error) {
      const errorMsg = getErrorMessage(error) || 'Failed to fetch Figma file. Please check the URL and try again.';
      setFigmaState({
        step: 'select',
        message: errorMsg,
        error: null,
      });
      // Re-throw so the caller (AssistantMessage) can display the error to the user
      throw error;
    }
  }, [onSendMessage]);

  // Cancel flow
  const cancelFlow = useCallback(() => {
    setActiveFlow(null);
    setGithubState(initialFlowState);
    setGithubRepos([]);
    setGithubSearchQuery('');
    setGithubInstallUrl('');
    setGitlabState(initialFlowState);
    setGitlabProjects([]);
    setGitlabSearchQuery('');
    setFigmaState(initialFlowState);
    setYoutubeState(initialFlowState);
    setShowPicker(false);
  }, []);

  // Start flow by integration ID
  const startFlow = useCallback((integration: IntegrationId) => {
    setShowPicker(false);
    switch (integration) {
      case 'github':
        startGitHubFlow();
        break;
      case 'gitlab':
        startGitLabFlow();
        break;
      case 'figma':
        startFigmaFlow();
        break;
      case 'youtube':
        onSendMessage('I want to import a YouTube video as a project');
        onHasInteracted?.();
        break;
    }
  }, [startGitHubFlow, startGitLabFlow, startFigmaFlow, onSendMessage, onHasInteracted]);

  // Open picker and fetch statuses
  const openPicker = useCallback(() => {
    setShowPicker(true);
    onHasInteracted?.();
    fetchConnectionStatuses();
  }, [fetchConnectionStatuses, onHasInteracted]);

  const closePicker = useCallback(() => {
    setShowPicker(false);
  }, []);

  // Handle OAuth callback - detect ?connected=github or ?connected=gitlab
  useEffect(() => {
    const connected = searchParams.get('connected');
    if (connected === 'github') {
      // Clear the query param and start GitHub flow
      searchParams.delete('connected');
      setSearchParams(searchParams, { replace: true });
      startGitHubFlow();
      return;
    }
    if (connected === 'gitlab') {
      // Clear the query param and start GitLab flow
      searchParams.delete('connected');
      setSearchParams(searchParams, { replace: true });
      startGitLabFlow();
      return;
    }
    if (connected === 'figma') {
      // Clear the query param and start Figma flow
      searchParams.delete('connected');
      setSearchParams(searchParams, { replace: true });
      startFigmaFlow();
    }
  }, [searchParams, setSearchParams, startGitHubFlow, startGitLabFlow, startFigmaFlow]);

  return {
    state: {
      activeFlow,
      github: githubState,
      gitlab: gitlabState,
      figma: figmaState,
      youtube: youtubeState,
      showPicker,
      connectionStatus,
    },
    actions: {
      startFlow,
      cancelFlow,
      openPicker,
      closePicker,
    },
    // GitHub
    githubRepos,
    githubSearchQuery,
    setGithubSearchQuery,
    githubInstallUrl,
    handleSelectGitHubRepo,
    handleConnectGitHub,
    handleInstallGitHubApp,
    // GitLab
    gitlabProjects,
    gitlabSearchQuery,
    setGitlabSearchQuery,
    handleSelectGitLabProject,
    handleConnectGitLab,
    // Figma
    handleConnectFigma,
    handleFigmaUrlImport,
    isFigmaUrl,
  };
}
