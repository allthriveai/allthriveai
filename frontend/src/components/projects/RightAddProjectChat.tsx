import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub, faGitlab, faFigma } from '@fortawesome/free-brands-svg-icons';
import { faRocket, faCommentDots, faBolt, faTable, faStar, faCodeBranch, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { createProject } from '@/services/projects';
import {
  checkGitHubConnection,
  fetchGitHubRepos,
  getImportPreview,
  confirmImport,
  getGitHubConnectUrl,
  type GitHubRepository,
  type GitHubImportPreview,
} from '@/services/github';

interface RightAddProjectChatProps {
  isOpen: boolean;
  onClose: () => void;
}

type ChatStep = 'welcome' | 'github_checking' | 'github_connect' | 'github_repos' | 'github_preview' | 'github_importing';

interface ChatMessage {
  id: string;
  type: 'agent' | 'user';
  content: React.ReactNode;
  timestamp: Date;
}

export function RightAddProjectChat({ isOpen, onClose }: RightAddProjectChatProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState<ChatStep>('welcome');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [repos, setRepos] = useState<GitHubRepository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepository | null>(null);
  const [previewData, setPreviewData] = useState<GitHubImportPreview | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Check for OAuth return and resume GitHub import flow
  useEffect(() => {
    // Only check when the panel is actually open
    if (!isOpen) return;

    const oauthReturn = localStorage.getItem('github_oauth_return');
    const oauthStep = localStorage.getItem('github_oauth_step');

    console.log('🔍 Checking OAuth return state:', {
      isOpen,
      oauthReturn,
      oauthStep,
    });

    if (oauthReturn === 'add_project_chat' && oauthStep === 'importing') {
      console.log('✅ OAuth return detected! Resuming GitHub import flow...');

      // Clear the flags
      localStorage.removeItem('github_oauth_return');
      localStorage.removeItem('github_oauth_step');

      // Auto-start the import flow
      setTimeout(() => {
        handleImport();
      }, 500);
    }
  }, [isOpen]); // React when isOpen changes

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep('welcome');
      setMessages([]);
      setRepos([]);
      setSelectedRepo(null);
      setPreviewData(null);
      setSearchQuery('');
    }
  }, [isOpen]);

  const addMessage = (type: 'agent' | 'user', content: React.ReactNode) => {
    setMessages((prev) => {
      // Generate unique ID using timestamp + random suffix to prevent duplicates
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      return [
        ...prev,
        { id, type, content, timestamp: new Date() },
      ];
    });
  };

  const handleImport = async () => {
    setStep('github_checking');
    addMessage('user', 'Import from GitHub');
    addMessage('agent', 'Checking your GitHub connection...');

    try {
      const isConnected = await checkGitHubConnection();

      if (!isConnected) {
        setStep('github_connect');
        addMessage(
          'agent',
          <>
            <p className="mb-2">You need to connect your GitHub account first.</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This allows us to access your repositories and import them to AllThrive.
            </p>
          </>
        );
      } else {
        // Load repos
        setStep('github_repos');
        addMessage('agent', 'Loading your GitHub repositories...');

        try {
          const fetchedRepos = await fetchGitHubRepos();
          setRepos(fetchedRepos);

          addMessage(
            'agent',
            <>
              <p className="mb-2">Found {fetchedRepos.length} repositories!</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Select a repository to import:
              </p>
            </>
          );
        } catch (repoError: any) {
          console.error('Failed to fetch GitHub repos:', repoError);

          // Handle rate limit errors with specific message
          if (repoError?.message?.includes('rate limit') || repoError?.message?.includes('Rate limit')) {
            addMessage(
              'agent',
              <>
                <p className="mb-2">⏱️ You've reached the rate limit for repository fetches.</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {repoError.message}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Please wait a few minutes and try again.
                </p>
              </>
            );
          } else {
            addMessage(
              'agent',
              <>
                <p className="mb-2">Failed to load your repositories.</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Please try reconnecting your GitHub account.
                </p>
              </>
            );
          }
          setStep('welcome');
          throw repoError; // Re-throw to outer catch
        }
      }
    } catch (error) {
      console.error('GitHub import error:', error);
      // Don't show generic error if we already showed a specific one
      if (step !== 'github_connect') {
        addMessage('agent', 'Something went wrong. Please try again.');
        setStep('welcome');
      }
    }
  };

  const handleConnectGitHub = () => {
    const frontendUrl = window.location.origin;
    const returnPath = window.location.pathname + window.location.search;
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

    console.log('🔗 Connecting to GitHub via django-allauth...');

    // Store state to reopen chat after OAuth redirect
    localStorage.setItem('github_oauth_return', 'add_project_chat');
    localStorage.setItem('github_oauth_step', 'importing');

    // Use django-allauth's GitHub login endpoint
    // The signal handler will automatically create a SocialConnection record
    // This uses /accounts/github/login/callback/ (already registered in GitHub OAuth App)
    const redirectUrl = `${backendUrl}/accounts/github/login/?process=connect&next=${encodeURIComponent(frontendUrl + returnPath)}`;
    console.log('🔗 Redirecting to:', redirectUrl);

    // Redirect to django-allauth GitHub OAuth
    window.location.href = redirectUrl;
  };

  const handleSelectRepo = async (repo: GitHubRepository) => {
    setSelectedRepo(repo);
    setStep('github_preview');

    addMessage('user', `Import "${repo.name}"`);
    addMessage('agent', `Analyzing ${repo.name}... This may take a moment.`);

    try {
      const preview = await getImportPreview(repo.fullName);
      setPreviewData(preview);

      addMessage(
        'agent',
        <>
          <p className="mb-2">Here's what I found:</p>
          <div className="space-y-2 text-sm">
            <p><strong>Title:</strong> {preview.title}</p>
            {preview.language && <p><strong>Language:</strong> {preview.language}</p>}
            {preview.stars > 0 && (
              <p><strong>Stars:</strong> {preview.stars}</p>
            )}
            {preview.tldr && (
              <div>
                <strong>Summary:</strong>
                <p className="text-gray-600 dark:text-gray-400 mt-1">{preview.tldr}</p>
              </div>
            )}
          </div>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            Ready to import this project?
          </p>
        </>
      );
    } catch (error) {
      console.error('Failed to get preview:', error);
      addMessage('agent', 'Failed to analyze repository. Please try again.');
      setStep('github_repos');
    }
  };

  const handleConfirmImport = async () => {
    if (!selectedRepo || !previewData) return;

    setStep('github_importing');
    addMessage('user', 'Yes, import it!');
    addMessage('agent', 'Importing your project...');

    try {
      const result = await confirmImport({
        repoFullName: selectedRepo.fullName,
        previewData,
        autoPublish: false,
        addToShowcase: false,
      });

      addMessage(
        'agent',
        `✅ Successfully imported "${result.projectSlug}"! Redirecting you now...`
      );

      // Close panel and navigate
      setTimeout(() => {
        onClose();
        navigate(result.redirectUrl);
      }, 1500);
    } catch (error) {
      console.error('Failed to import project:', error);
      addMessage('agent', 'Failed to import project. Please try again.');
      setStep('github_preview');
    }
  };

  const handleDescribe = () => {
    addMessage('user', 'Describe my project with AI');
    addMessage('agent', 'AI project description feature coming soon! 🚀');
  };

  const handleBuild = () => {
    addMessage('user', 'Build something new with AI');
    addMessage('agent', 'AI-assisted project builder coming soon! ⚡');
  };

  const handleManual = async () => {
    addMessage('user', 'Create project page manually');
    addMessage('agent', 'Creating your project...');

    try {
      const newProject = await createProject({
        title: 'Untitled Project',
        description: '',
        type: 'other',
        isShowcase: true,
        content: { blocks: [] },
      });
      onClose();
      navigate(`/${user?.username}/${newProject.slug}/edit`);
    } catch (error) {
      console.error('Failed to create project:', error);
      addMessage('agent', 'Failed to create project. Please try again.');
    }
  };

  const filteredRepos = repos.filter((repo) =>
    searchQuery.trim() === ''
      ? true
      : repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        repo.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* Sliding Panel */}
      <div
        className={`fixed right-0 top-16 w-full md:w-[480px] h-[calc(100vh-4rem)] bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col shadow-lg transition-transform duration-300 z-40 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Project</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Chat Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Welcome Message */}
          {step === 'welcome' && (
            <div className="flex justify-start">
              <div className="max-w-md">
                <div className="mb-3 px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                  <p className="text-sm mb-1 flex items-center gap-2">
                    <FontAwesomeIcon icon={faRocket} className="text-primary-500" />
                    Hi! Let's add a project to your portfolio.
                  </p>
                  <p className="text-sm">How would you like to get started?</p>
                </div>

                {/* 4 Button Options */}
                <div className="space-y-2">
                  <button
                    onClick={handleImport}
                    className="w-full text-left px-4 py-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <FontAwesomeIcon icon={faGithub} className="text-slate-700 dark:text-slate-300" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                          Import Existing Project
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                          From GitHub, GitLab, etc.
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={handleDescribe}
                    className="w-full text-left px-4 py-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <FontAwesomeIcon icon={faCommentDots} className="text-slate-700 dark:text-slate-300" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                          Describe Your Project
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                          All Thrive will create your project portfolio page from your description
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={handleBuild}
                    className="w-full text-left px-4 py-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <FontAwesomeIcon icon={faBolt} className="text-slate-700 dark:text-slate-300" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                          Build Something New
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                          Create with AI assistance
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={handleManual}
                    className="w-full text-left px-4 py-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <FontAwesomeIcon icon={faTable} className="text-slate-700 dark:text-slate-300" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                          Create Project Page
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                          Manually design your page
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Display all messages */}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-md px-4 py-3 rounded-lg ${
                  msg.type === 'user'
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                }`}
              >
                <div className="text-sm">{msg.content}</div>
              </div>
            </div>
          ))}

          {/* GitHub Connect Step */}
          {step === 'github_connect' && (
            <div className="flex justify-start">
              <div className="max-w-md">
                <button
                  onClick={handleConnectGitHub}
                  className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <FontAwesomeIcon icon={faGithub} />
                  Connect GitHub
                </button>
              </div>
            </div>
          )}

          {/* GitHub Repos Step */}
          {step === 'github_repos' && repos.length > 0 && (
            <div className="flex justify-start">
              <div className="w-full max-w-md space-y-3">
                {/* Search */}
                <input
                  type="text"
                  placeholder="Search repositories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white"
                />

                {/* Repo List */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredRepos.slice(0, 20).map((repo) => (
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
              </div>
            </div>
          )}

          {/* GitHub Preview Step */}
          {step === 'github_preview' && previewData && (
            <div className="flex justify-start">
              <div className="max-w-md space-y-2">
                <button
                  onClick={handleConfirmImport}
                  className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Import Project
                </button>
                <button
                  onClick={() => {
                    setStep('github_repos');
                    addMessage('user', 'Go back to repository list');
                  }}
                  className="ml-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Choose Different Repo
                </button>
              </div>
            </div>
          )}

          {/* Importing State */}
          {step === 'github_importing' && (
            <div className="flex justify-center py-8">
              <FontAwesomeIcon icon={faSpinner} className="w-8 h-8 text-primary-500 animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Mobile Overlay */}
      {isOpen && <div className="fixed inset-0 bg-black/20 z-30 md:hidden" onClick={onClose} />}
    </>
  );
}
