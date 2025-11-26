import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { ImportPreview } from './ImportPreview';
import {
  checkGitHubConnection,
  fetchGitHubRepos,
  getImportPreview,
  confirmImport,
  getGitHubConnectUrl,
  type GitHubRepository,
  type GitHubImportPreview,
} from '@/services/github';
import { FaGithub, FaStar, FaCodeBranch, FaSearch } from 'react-icons/fa';

interface ImportGitHubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ViewMode = 'checking' | 'not_connected' | 'loading_repos' | 'repo_list' | 'preview' | 'importing' | 'success';

export function ImportGitHubModal({ isOpen, onClose }: ImportGitHubModalProps) {
  const navigate = useNavigate();

  // State management
  const [viewMode, setViewMode] = useState<ViewMode>('checking');
  const [repos, setRepos] = useState<GitHubRepository[]>( []);
  const [filteredRepos, setFilteredRepos] = useState<GitHubRepository[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepository | null>(null);
  const [previewData, setPreviewData] = useState<GitHubImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check GitHub connection on modal open
  useEffect(() => {
    if (isOpen) {
      checkConnection();
    }
  }, [isOpen]);

  // Filter repos based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredRepos(repos);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredRepos(
        repos.filter(
          (repo) =>
            repo.name.toLowerCase().includes(query) ||
            repo.description?.toLowerCase().includes(query) ||
            repo.topics?.some((t) => t.toLowerCase().includes(query))
        )
      );
    }
  }, [searchQuery, repos]);

  const checkConnection = async () => {
    setViewMode('checking');
    setError(null);

    try {
      const isConnected = await checkGitHubConnection();

      if (!isConnected) {
        setViewMode('not_connected');
      } else {
        await loadRepos();
      }
    } catch (err) {
      console.error('Failed to check GitHub connection:', err);
      setError('Failed to check GitHub connection');
      setViewMode('not_connected');
    }
  };

  const loadRepos = async () => {
    setViewMode('loading_repos');
    setError(null);

    try {
      const fetchedRepos = await fetchGitHubRepos();
      setRepos(fetchedRepos);
      setFilteredRepos(fetchedRepos);
      setViewMode('repo_list');
    } catch (err) {
      console.error('Failed to fetch GitHub repos:', err);
      setError('Failed to load repositories');
      setViewMode('not_connected');
    }
  };

  const handleConnectGitHub = async () => {
    try {
      // Redirect to django-allauth GitHub login with return URL
      // After authentication, user will be redirected back to the frontend
      const frontendUrl = window.location.origin;
      const returnPath = window.location.pathname + window.location.search;
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

      // Redirect to backend allauth URL, which will redirect back to frontend after auth
      window.location.href = `${backendUrl}/accounts/github/login/?next=${encodeURIComponent(frontendUrl + returnPath)}`;
    } catch (err: any) {
      console.error('Failed to initiate GitHub connection:', err);
      setError('Failed to initiate GitHub connection');
    }
  };

  const handleSelectRepo = async (repo: GitHubRepository) => {
    setSelectedRepo(repo);
    setViewMode('preview');
    setError(null);

    try {
      const preview = await getImportPreview(repo.fullName);
      setPreviewData(preview);
    } catch (err) {
      console.error('Failed to get import preview:', err);
      setError(`Failed to load preview for ${repo.name}`);
      setViewMode('repo_list');
      setSelectedRepo(null);
    }
  };

  const handleConfirmImport = async (title?: string, tldr?: string) => {
    if (!selectedRepo || !previewData) return;

    setViewMode('importing');
    setError(null);

    try {
      const result = await confirmImport({
        repoFullName: selectedRepo.fullName,
        previewData,
        title,
        tldr,
        autoPublish: false,
        addToShowcase: false,
      });

      setViewMode('success');

      // Close modal and navigate to project after brief delay
      setTimeout(() => {
        onClose();
        navigate(result.redirectUrl);
      }, 1500);
    } catch (err: any) {
      console.error('Failed to import repository:', err);
      setError(err.message || 'Failed to import repository');
      setViewMode('preview');
    }
  };

  const handleBackToList = () => {
    setSelectedRepo(null);
    setPreviewData(null);
    setViewMode('repo_list');
  };

  const handleClose = () => {
    setSearchQuery('');
    setSelectedRepo(null);
    setPreviewData(null);
    setError(null);
    onClose();
  };

  // Render different views based on state
  const renderContent = () => {
    switch (viewMode) {
      case 'checking':
        return (
          <div className="text-center py-8">
            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Checking GitHub connection...</p>
          </div>
        );

      case 'not_connected':
        return (
          <div className="text-center py-8">
            <FaGithub className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Connect GitHub</h3>
            <p className="text-gray-400 mb-6">
              Connect your GitHub account to import repositories as projects
            </p>
            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
            <button
              onClick={handleConnectGitHub}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
            >
              <FaGithub className="w-5 h-5" />
              Connect GitHub
            </button>
          </div>
        );

      case 'loading_repos':
        return (
          <div className="text-center py-8">
            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Loading your repositories...</p>
          </div>
        );

      case 'repo_list':
        return (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search repositories..."
                className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Repo Count */}
            <p className="text-sm text-gray-400">
              {filteredRepos.length} {filteredRepos.length === 1 ? 'repository' : 'repositories'}
            </p>

            {/* Repo List */}
            <div className="max-h-96 overflow-y-auto space-y-2">
              {filteredRepos.length === 0 ? (
                <p className="text-center text-gray-400 py-8">
                  {searchQuery ? 'No repositories match your search' : 'No repositories found'}
                </p>
              ) : (
                filteredRepos.map((repo) => (
                  <button
                    key={repo.fullName}
                    onClick={() => handleSelectRepo(repo)}
                    className="w-full text-left p-4 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-primary-500 rounded-lg transition-all group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-white group-hover:text-primary-400 transition-colors truncate">
                          {repo.name}
                        </h4>
                        {repo.description && (
                          <p className="text-sm text-gray-400 mt-1 line-clamp-2">{repo.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          {repo.language && (
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-primary-500" />
                              {repo.language}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <FaStar className="w-3 h-3" />
                            {repo.stars}
                          </span>
                          <span className="flex items-center gap-1">
                            <FaCodeBranch className="w-3 h-3" />
                            {repo.forks}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          </div>
        );

      case 'preview':
        return previewData ? (
          <ImportPreview
            previewData={previewData}
            onConfirm={handleConfirmImport}
            onBack={handleBackToList}
            isImporting={false}
            error={error}
          />
        ) : (
          <div className="text-center py-8">
            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Loading preview...</p>
          </div>
        );

      case 'importing':
        return (
          <div className="text-center py-8">
            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Importing repository...</p>
            <p className="text-sm text-gray-500 mt-2">Generating tl;dr and setting up project...</p>
          </div>
        );

      case 'success':
        return (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Import Successful!</h3>
            <p className="text-gray-400">Redirecting to your project...</p>
          </div>
        );

      default:
        return null;
    }
  };

  const getModalTitle = () => {
    switch (viewMode) {
      case 'not_connected':
        return 'Connect GitHub';
      case 'repo_list':
      case 'loading_repos':
        return 'Import from GitHub';
      case 'preview':
        return 'Preview Import';
      case 'importing':
        return 'Importing...';
      case 'success':
        return 'Success';
      default:
        return 'GitHub Import';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={getModalTitle()}
      className="max-w-3xl"
    >
      {renderContent()}
    </Modal>
  );
}
