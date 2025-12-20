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
import type { IntegrationState, IntegrationActions, IntegrationId, IntegrationFlowStep } from '../core/types';

interface UseIntegrationFlowOptions {
  onSendMessage: (message: string) => void;
  onHasInteracted?: () => void;
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
      } catch (repoError: any) {
        if (repoError instanceof GitHubInstallationNeededError) {
          setGithubInstallUrl(repoError.installUrl);
          setGithubState({
            step: 'install',
            message: 'Select which repositories to share with All Thrive AI.',
            error: null,
          });
          return;
        }
        setGithubState({
          step: 'idle',
          message: '',
          error: repoError.message || 'Failed to load repositories.',
        });
        setActiveFlow(null);
      }
    } catch (error) {
      logError('useIntegrationFlow.startGitHubFlow', error);
      setGithubState({
        step: 'idle',
        message: '',
        error: 'Something went wrong. Please try again.',
      });
      setActiveFlow(null);
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
    onSendMessage(`Import this GitHub repository to my showcase: ${repo.htmlUrl}`);
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
      } catch (projectError: any) {
        setGitlabState({
          step: 'idle',
          message: '',
          error: projectError.message || 'Failed to load projects.',
        });
        setActiveFlow(null);
      }
    } catch (error) {
      logError('useIntegrationFlow.startGitLabFlow', error);
      setGitlabState({
        step: 'idle',
        message: '',
        error: 'Something went wrong. Please try again.',
      });
      setActiveFlow(null);
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
    onSendMessage(`Import this GitLab project to my showcase: ${project.htmlUrl}`);
  }, [onSendMessage]);

  // Figma handlers
  const startFigmaFlow = useCallback(async () => {
    setActiveFlow('figma');
    setFigmaState({ step: 'loading', message: 'Checking your Figma connection...', error: null });
    onHasInteracted?.();

    try {
      const isConnected = await checkFigmaConnection();

      if (!isConnected) {
        setFigmaState({
          step: 'connect',
          message: 'You need to connect your Figma account first.',
          error: null,
        });
        return;
      }

      setFigmaState({
        step: 'select',
        message: 'Paste a Figma file URL below to import your design.',
        error: null,
      });
    } catch (error) {
      logError('useIntegrationFlow.startFigmaFlow', error);
      setFigmaState({
        step: 'idle',
        message: '',
        error: 'Something went wrong. Please try again.',
      });
      setActiveFlow(null);
    }
  }, [onHasInteracted]);

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
        setFigmaState({
          step: 'select',
          message: 'Invalid Figma URL. Please paste a valid file URL.',
          error: null,
        });
        return;
      }

      const preview = await getFigmaFilePreview(parsed.fileKey);

      // Reset and send to chat
      setFigmaState(initialFlowState);
      setActiveFlow(null);
      onSendMessage(`Import this Figma design as a project: ${url}\n\nFile: ${preview.name}\nPages: ${preview.pageCount}`);
    } catch (error: any) {
      setFigmaState({
        step: 'select',
        message: error.message || 'Failed to fetch Figma file. Please check the URL and try again.',
        error: null,
      });
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
