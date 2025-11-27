import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link, Outlet } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { getProjectBySlug, deleteProject, updateProject, toggleProjectLike } from '@/services/projects';
import { getProjectComments, createProjectComment, voteOnComment, type Comment } from '@/services/comments';
import type { Project } from '@/types/models';
import { useAuth } from '@/hooks/useAuth';
import { useReward } from 'react-rewards';
import { FaStar } from 'react-icons/fa';
import { parseApiError } from '@/utils/errorHandler';
import { sanitizeHtml } from '@/utils/sanitize';
import { SlideUpHero } from '@/components/projects/SlideUpHero';
import { ToolTray } from '@/components/tools/ToolTray';
import { ProjectEditTray } from '@/components/projects/ProjectEditTray';
import { GitHubProjectLayout } from '@/components/projects/github/GitHubProjectLayout';
import { GitHubProjectPendingView } from '@/components/projects/github/GitHubProjectPendingView';
import { FigmaProjectLayout } from '@/components/projects/figma/FigmaProjectLayout';
import { FigmaProjectPendingView } from '@/components/projects/figma/FigmaProjectPendingView';
import mermaid from 'mermaid';
import { marked } from 'marked';
import {
  ArrowLeftIcon,
  CodeBracketIcon,
  PhotoIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  HeartIcon,
  LinkIcon,
  XMarkIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';

const typeIcons = {
  github_repo: CodeBracketIcon,
  figma_design: PhotoIcon,
  image_collection: PhotoIcon,
  prompt: ChatBubbleLeftRightIcon,
  other: DocumentTextIcon,
};

const typeLabels = {
  github_repo: 'GitHub Repository',
  figma_design: 'Figma Design',
  image_collection: 'Image Collection',
  prompt: 'Prompt',
  other: 'Project',
};

// Initialize Mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
});

// Configure marked for inline parsing
marked.setOptions({
  breaks: true,
  gfm: true,
});

// Mermaid Diagram Component
function MermaidDiagram({ code }: { code: string }) {
  const diagramRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [diagramId] = useState(`mermaid-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    if (!diagramRef.current || !code) return;

    async function renderDiagram() {
      try {
        setError(null);
        if (diagramRef.current) {
          diagramRef.current.innerHTML = '';
          const { svg } = await mermaid.render(diagramId, code);
          if (diagramRef.current) {
            diagramRef.current.innerHTML = svg;
          }
        }
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        setError('Failed to render diagram');
      }
    }

    renderDiagram();
  }, [code, diagramId]);

  if (error) {
    return (
      <div className="text-red-600 dark:text-red-400 text-sm p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
        {error}
      </div>
    );
  }

  return <div ref={diagramRef} className="flex justify-center" />;
}

export default function ProjectDetailPage() {
  const { username, projectSlug } = useParams<{ username: string; projectSlug: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [isLikingProject, setIsLikingProject] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isFeedbackSidebarOpen, setIsFeedbackSidebarOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [loadKey, setLoadKey] = useState(0); // Used to force reload
  const [showToolTray, setShowToolTray] = useState(false);
  const [selectedToolSlug, setSelectedToolSlug] = useState<string | null>(null);
  const [showEditTray, setShowEditTray] = useState(false);

  // React Rewards for comment submission celebration
  const { reward: rewardComment } = useReward('commentReward', 'confetti', {
    angle: 90,
    decay: 0.91,
    spread: 100,
    startVelocity: 25,
    elementCount: 50,
    lifetime: 200,
    colors: ['#FFD700', '#FFA500', '#FFFF00'],
  });

  // React Rewards for project likes
  const { reward: rewardLike } = useReward('likeReward', 'emoji', {
    emoji: ['💗'],
    angle: 90,
    decay: 0.91,
    spread: 100,
    startVelocity: 25,
    elementCount: 50,
    lifetime: 200,
  });

  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);

  // GitHub analysis state
  const [analysisStatus, setAnalysisStatus] = useState<'pending' | 'complete' | 'failed' | null>(null);

  useEffect(() => {
    async function loadProject() {
      if (!username || !projectSlug) {
        setError('Invalid project URL');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Add timestamp to prevent caching
        const data = await getProjectBySlug(username, projectSlug);
        setProject(data);
      } catch (err) {
        console.error('Failed to load project:', err);
        setError('Project not found');
      } finally {
        setIsLoading(false);
      }
    }

    loadProject();

    // Reload when window regains focus or becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isLoading) {
        loadProject();
      }
    };

    const handleFocus = () => {
      if (!isLoading) {
        loadProject();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [username, projectSlug, loadKey]);

  // Lazy load comments when feedback sidebar is opened
  useEffect(() => {
    async function loadComments() {
      if (!project || !isFeedbackSidebarOpen || commentsLoaded) return;

      setIsLoadingComments(true);
      try {
        const data = await getProjectComments(project.id);
        setComments(data);
        setCommentsLoaded(true);
      } catch (error) {
        // Error already logged in service, just show user-friendly message
        const errorInfo = parseApiError(error);
        console.error('Failed to load comments:', errorInfo.message);
        setComments([]);
        // Optionally show a toast notification instead of alert
      } finally {
        setIsLoadingComments(false);
      }
    }

    loadComments();
  }, [project, isFeedbackSidebarOpen, commentsLoaded]);

  // Analysis polling (GitHub and Figma)
  useEffect(() => {
    if (!project) return;

    // Determine which content key to check based on project type
    const contentKey = project.type === 'github_repo' ? 'github' : project.type === 'figma_design' ? 'figma' : null;
    if (!contentKey) return;

    const status = project.content?.[contentKey]?.analysis_status;
    setAnalysisStatus(status || null);

    // Poll if pending
    if (status === 'pending') {
      const pollInterval = setInterval(async () => {
        if (!username || !projectSlug) return;

        try {
          const updated = await getProjectBySlug(username, projectSlug);
          const newStatus = updated.content?.[contentKey]?.analysis_status;

          if (newStatus !== 'pending') {
            setProject(updated);
            setAnalysisStatus(newStatus);
            clearInterval(pollInterval);
          }
        } catch (error) {
          console.error('Failed to poll for analysis status:', error);
          clearInterval(pollInterval);
        }
      }, 3000); // Poll every 3 seconds

      return () => clearInterval(pollInterval);
    }
  }, [project, username, projectSlug]);

  const isOwner = isAuthenticated && user && project && user.username.toLowerCase() === project.username.toLowerCase();

  // Keyboard shortcut: Press 'E' to open edit tray (owner only)
  useEffect(() => {
    if (!isOwner) return;

    const handleKeyPress = (event: KeyboardEvent) => {
      // Only trigger if not typing in an input/textarea
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Press 'E' key to toggle edit tray
      if (event.key === 'e' || event.key === 'E') {
        event.preventDefault();
        setShowEditTray(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isOwner]);

  const handleDeleteProject = async () => {
    if (!project) return;

    if (!window.confirm('Are you sure you want to delete this project?')) {
      return;
    }

    try {
      await deleteProject(project.id);
      navigate(`/${username}`);
    } catch (error) {
      console.error('Failed to delete project:', error);
      alert('Failed to delete project');
    }
  };

  const handleToggleShowcase = async () => {
    if (!project) return;

    try {
      const updatedProject = await updateProject(project.id, {
        isShowcase: !project.isShowcase,
      });
      setProject(updatedProject);
      setShowMenu(false);
    } catch (error) {
      console.error('Failed to update showcase setting:', error);
      alert('Failed to update showcase setting');
    }
  };

  const handleToggleLike = async () => {
    if (!project || !isAuthenticated) return;

    setIsLikingProject(true);
    try {
      const result = await toggleProjectLike(project.id);
      setProject({
        ...project,
        isLikedByUser: result.liked,
        heartCount: result.heartCount,
      });

      // Trigger pink heart celebration when liked
      if (result.liked) {
        rewardLike();
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
    } finally {
      setIsLikingProject(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim() || !isAuthenticated || !user || !project) return;

    setIsSubmittingFeedback(true);
    try {
      // Submit comment with AI moderation
      const newComment = await createProjectComment(project.id, {
        content: feedbackText,
      });

      // Add new comment to list
      setComments([newComment, ...comments]);
      setCommentsLoaded(true);

      // Clear form
      setFeedbackText('');

      // Show success toast and trigger celebration
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 5000);

      // Trigger star emoji celebration
      rewardComment();
    } catch (error) {
      // Error already logged in service, extract user-friendly message
      const errorInfo = parseApiError(error);
      alert(errorInfo.message);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleVote = async (commentId: number, voteType: 'up' | 'down') => {
    if (!isAuthenticated || !project) {
      alert('Please sign in to vote on comments');
      return;
    }

    try {
      const result = await voteOnComment(project.id, commentId, voteType);

      // Update comment in list with new data from API
      setComments(comments.map(comment =>
        comment.id === commentId ? result.comment : comment
      ));
    } catch (error) {
      // Error already logged in service
      const errorInfo = parseApiError(error);
      alert(errorInfo.message);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout autoCollapseSidebar>
        <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading project...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !project) {
    return (
      <DashboardLayout autoCollapseSidebar>
        <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900 p-8">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              {error || 'Project Not Found'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              The project you're looking for doesn't exist or you don't have permission to view it.
            </p>
            <button
              onClick={() => navigate(`/${username}`)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              Back to Profile
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const Icon = typeIcons[project.type];

  // Render GitHub project layouts
  if (project.type === 'github_repo') {
    if (analysisStatus === 'pending') {
      return (
        <DashboardLayout autoCollapseSidebar>
          <div className="flex-1 bg-white dark:bg-gray-900 overflow-y-auto">
            <GitHubProjectPendingView project={project} />
          </div>
        </DashboardLayout>
      );
    }
    if (analysisStatus === 'complete' && project.content?.github?.analysis) {
      return (
        <DashboardLayout autoCollapseSidebar>
          <div className="flex-1 bg-white dark:bg-gray-900 overflow-y-auto">
            <GitHubProjectLayout project={project} />
          </div>
        </DashboardLayout>
      );
    }
  }

  // Render Figma project layouts
  if (project.type === 'figma_design') {
    if (analysisStatus === 'pending') {
      return (
        <DashboardLayout autoCollapseSidebar>
          <div className="flex-1 bg-white dark:bg-gray-900 overflow-y-auto">
            <FigmaProjectPendingView project={project} />
          </div>
        </DashboardLayout>
      );
    }
    if (analysisStatus === 'complete' && project.content?.figma?.analysis) {
      return (
        <DashboardLayout autoCollapseSidebar>
          <div className="flex-1 bg-white dark:bg-gray-900 overflow-y-auto">
            <FigmaProjectLayout project={project} />
          </div>
        </DashboardLayout>
      );
    }
  }

  // Default layout for all projects (GitHub repos, prompts, etc.)
  return (
    <DashboardLayout autoCollapseSidebar>
      <div className="flex-1 bg-white dark:bg-gray-900 overflow-y-auto">
        {/* Full Height Hero Section */}
        <div className="relative min-h-screen w-full flex items-center overflow-hidden bg-gray-900">
          {/* Background Layer */}
          <div className="absolute inset-0 z-0">
            {project.bannerUrl ? (
              <>
                <img
                  src={project.bannerUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-gray-900 via-gray-900/80 to-gray-900/40 backdrop-blur-[1px]" />
              </>
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary-900 to-gray-900" />
            )}
          </div>

          {/* Content Container */}
          <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-8 py-6 md:py-8">

            {/* Options Menu (Owner Only) - Absolute positioned to top-right of content container */}
            {isOwner && (
              <div className="absolute top-0 right-8 z-30">
                <div className="relative">
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors backdrop-blur-md"
                  >
                    <EllipsisVerticalIcon className="w-8 h-8" />
                  </button>
                  {showMenu && (
                    <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden z-50">
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          setShowEditTray(true);
                        }}
                        className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 flex items-center justify-between gap-3 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <PencilIcon className="w-4 h-4" />
                          Quick Edit
                        </div>
                        <kbd className="px-2 py-0.5 text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">E</kbd>
                      </button>
                      <button
                        onClick={handleToggleShowcase}
                        className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 flex items-center gap-3 transition-colors"
                      >
                        {project.isShowcase ? (
                          <>
                            <EyeSlashIcon className="w-4 h-4" />
                            Remove from Showcase
                          </>
                        ) : (
                          <>
                            <EyeIcon className="w-4 h-4" />
                            Add to Showcase
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleDeleteProject}
                        className="w-full px-4 py-3 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-900/20 flex items-center gap-3 border-t border-gray-200/50 dark:border-gray-700/50 transition-colors"
                      >
                        <TrashIcon className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center pt-6">
              {/* Left Column: Text Content */}
              <div className="space-y-6 lg:space-y-10">
                <div className="space-y-6 relative">
                  {/* Author Badge */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-white/10 backdrop-blur-xl px-4 py-2 rounded-full border border-white/20 text-white/90 text-sm shadow-lg">
                      <span className="font-light opacity-70">by</span>
                      <Link to={`/${project.username}`} className="font-semibold hover:text-primary-300 transition-colors">
                        @{project.username}
                      </Link>
                    </div>
                    <span className="text-white/60 text-sm bg-black/20 px-3 py-1 rounded-full backdrop-blur-md border border-white/5">
                      {new Date(project.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>

                  {/* Title */}
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/70 tracking-tight leading-tight drop-shadow-2xl">
                    {project.title}
                  </h1>
                </div>

                {/* "Why it's cool" / Description */}
                {project.description && (
                  <div className="relative p-6 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-primary-400 to-secondary-400 opacity-80" />
                    <p className="text-lg md:text-xl text-white/90 leading-relaxed font-light pl-2">
                      {project.description}
                    </p>
                  </div>
                )}

                {/* Tools Used */}
                {project.toolsDetails && project.toolsDetails.length > 0 && (
                  <div className="space-y-4">
                    <p className="text-xs font-bold text-white/50 uppercase tracking-[0.2em] pl-1">Built With</p>
                    <div className="flex flex-wrap gap-3">
                      {project.toolsDetails.map((tool) => (
                        <button
                          key={tool.id}
                          onClick={() => {
                            setSelectedToolSlug(tool.slug);
                            setShowToolTray(true);
                          }}
                          className="group flex items-center gap-2.5 px-4 py-2 bg-white/5 hover:bg-white/15 backdrop-blur-xl rounded-xl border border-white/10 hover:border-white/30 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                        >
                          {tool.logoUrl ? (
                            <img src={tool.logoUrl} alt={tool.name} className="w-5 h-5 rounded-md object-cover shadow-sm" />
                          ) : (
                            <CodeBracketIcon className="w-5 h-5 text-white/70" />
                          )}
                          <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">{tool.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-4 pt-6">
                  <button
                    id="likeReward"
                    onClick={handleToggleLike}
                    disabled={!isAuthenticated || isLikingProject}
                    className={`group flex items-center gap-2.5 px-6 py-3 rounded-xl font-bold text-base transition-all transform active:scale-95 border border-white/10 ${
                      project.isLikedByUser
                        ? 'bg-gradient-to-r from-pink-500/90 to-rose-500/90 backdrop-blur-xl text-white shadow-[0_0_20px_rgba(236,72,153,0.3)] hover:shadow-[0_0_30px_rgba(236,72,153,0.5)]'
                        : 'bg-white/10 hover:bg-white/20 backdrop-blur-xl text-white shadow-lg hover:shadow-xl'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {project.isLikedByUser ? (
                      <HeartIconSolid className="w-5 h-5 animate-[bounce_0.5s_ease-in-out] drop-shadow-md" />
                    ) : (
                      <HeartIcon className="w-5 h-5 group-hover:scale-110 transition-transform drop-shadow-md" />
                    )}
                    <span className="drop-shadow-md">{project.heartCount}</span>
                  </button>

                  {project.externalUrl && (
                    <a
                      href={project.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="View Live Project"
                      className="flex items-center justify-center w-12 h-12 rounded-xl font-bold text-base bg-white/90 hover:bg-white text-gray-900 backdrop-blur-xl shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-all transform hover:-translate-y-0.5 active:scale-95 border border-white/50"
                    >
                      <LinkIcon className="w-5 h-5" />
                    </a>
                  )}

                  <button
                    onClick={() => setIsFeedbackSidebarOpen(true)}
                    title="Share Your Thoughts"
                    className="flex items-center justify-center w-12 h-12 rounded-xl font-bold text-base bg-white/10 hover:bg-white/20 text-white backdrop-blur-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 active:scale-95 border border-white/20"
                  >
                    <ChatBubbleLeftRightIcon className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Right Column: Hero Display */}
              <div className="flex items-center justify-center perspective-1000">
                {(() => {
                  const heroMode = project.content?.heroDisplayMode || 'image';
                  const heroQuote = project.content?.heroQuote;
                  const heroVideoUrl = project.content?.heroVideoUrl;
                  const heroSlideshowImages = project.content?.heroSlideshowImages || [];

                  // Helper function to extract video ID and platform
                  const parseVideoUrl = (url: string) => {
                    if (!url) return null;

                    // YouTube patterns
                    const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
                    if (youtubeMatch) {
                      return { platform: 'youtube', id: youtubeMatch[1] };
                    }

                    // Vimeo patterns
                    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
                    if (vimeoMatch) {
                      return { platform: 'vimeo', id: vimeoMatch[1] };
                    }

                    // Loom patterns
                    const loomMatch = url.match(/loom\.com\/(?:share|embed)\/(\w+)/);
                    if (loomMatch) {
                      return { platform: 'loom', id: loomMatch[1] };
                    }

                    return null;
                  };

                  // QUOTE MODE
                  if (heroMode === 'quote' && heroQuote) {
                    // Calculate font size based on text length for better fit
                    const textLength = heroQuote.trim().length;
                    let fontSize;
                    if (textLength < 100) {
                      fontSize = 'clamp(1.5rem, 3vw, 3rem)'; // Short text - large
                    } else if (textLength < 200) {
                      fontSize = 'clamp(1.25rem, 2.5vw, 2.25rem)'; // Medium-short text
                    } else if (textLength < 400) {
                      fontSize = 'clamp(1rem, 2vw, 1.75rem)'; // Medium text
                    } else if (textLength < 700) {
                      fontSize = 'clamp(0.875rem, 1.5vw, 1.25rem)'; // Long text
                    } else {
                      fontSize = 'clamp(0.75rem, 1.25vw, 1rem)'; // Very long text
                    }

                    return (
                      <div className="w-full max-w-4xl">
                        <div className="relative group">
                          {/* Glowing backdrop */}
                          <div className="absolute -inset-2 md:-inset-4 bg-gradient-to-r from-primary-500/20 to-secondary-500/20 rounded-2xl md:rounded-3xl blur-xl md:blur-2xl opacity-50 group-hover:opacity-70 transition duration-500" />

                          {/* Quote container */}
                          <div className="relative p-6 md:p-8 lg:p-10 bg-white/5 backdrop-blur-md rounded-2xl md:rounded-3xl border border-white/20 shadow-2xl max-h-[80vh] overflow-y-auto">
                            <p className="font-light text-white leading-relaxed text-center relative z-10" style={{ fontSize, lineHeight: '1.45' }}>
                              “{heroQuote.trim()}”
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // VIDEO MODE
                  if (heroMode === 'video' && heroVideoUrl) {
                    const videoInfo = parseVideoUrl(heroVideoUrl);

                    // Check if it's a direct video file (MP4, WebM, OGG) or uploaded video
                    const isDirectVideo = heroVideoUrl.endsWith('.mp4') ||
                                         heroVideoUrl.endsWith('.webm') ||
                                         heroVideoUrl.endsWith('.ogg') ||
                                         heroVideoUrl.includes('/projects/videos/');

                    if (isDirectVideo) {
                      // Render direct video file
                      return (
                        <div className="w-full flex justify-center">
                          <div className="relative group inline-block">
                            {/* Glowing backdrop */}
                            <div className="absolute -inset-2 md:-inset-4 bg-white/5 rounded-2xl md:rounded-3xl blur-lg md:blur-xl opacity-50 transition duration-1000 group-hover:opacity-70 group-hover:blur-2xl" />

                            {/* Video container */}
                            <div className="relative p-1 md:p-2 bg-white/10 backdrop-blur-sm rounded-2xl md:rounded-3xl border border-white/20 shadow-2xl">
                              <video
                                src={heroVideoUrl}
                                controls
                                className="rounded-xl md:rounded-2xl max-h-[80vh] max-w-full"
                                onError={(e) => {
                                  console.error('Video load error');
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    } else if (videoInfo) {
                      // Render embedded video (YouTube, Vimeo, Loom)
                      let embedUrl = '';

                      if (videoInfo.platform === 'youtube') {
                        embedUrl = `https://www.youtube.com/embed/${videoInfo.id}?rel=0`;
                      } else if (videoInfo.platform === 'vimeo') {
                        embedUrl = `https://player.vimeo.com/video/${videoInfo.id}`;
                      } else if (videoInfo.platform === 'loom') {
                        embedUrl = `https://www.loom.com/embed/${videoInfo.id}`;
                      }

                      return (
                        <div className="w-full">
                          <div className="relative group">
                            {/* Glowing backdrop */}
                            <div className="absolute -inset-2 md:-inset-4 bg-white/5 rounded-2xl md:rounded-3xl blur-lg md:blur-xl opacity-50 transition duration-1000 group-hover:opacity-70 group-hover:blur-2xl" />

                            {/* Video container */}
                            <div className="relative p-1 md:p-2 bg-white/10 backdrop-blur-sm rounded-2xl md:rounded-3xl border border-white/20 shadow-2xl overflow-hidden">
                              <div className="relative aspect-video rounded-xl md:rounded-2xl overflow-hidden bg-black">
                                <iframe
                                  src={embedUrl}
                                  title="Project video"
                                  className="absolute inset-0 w-full h-full"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  }

                  // SLIDESHOW MODE - Full Carousel
                  if (heroMode === 'slideshow' && heroSlideshowImages.length > 0) {
                    return (
                      <SlideshowCarousel
                        images={heroSlideshowImages}
                        currentIndex={currentSlideIndex}
                        onIndexChange={setCurrentSlideIndex}
                      />
                    );
                  }

                  // SLIDE-UP MODE
                  if (heroMode === 'slideup') {
                    return (
                      <SlideUpHero
                        element1={project.content?.heroSlideUpElement1}
                        element2={project.content?.heroSlideUpElement2}
                        tools={project.toolsDetails}
                        onToolClick={(slug) => {
                          setSelectedToolSlug(slug);
                          setShowToolTray(true);
                        }}
                        isLiked={project.isLikedByUser}
                        heartCount={project.heartCount || 0}
                        onLikeToggle={handleToggleLike}
                        onCommentClick={() => setIsFeedbackSidebarOpen(true)}
                        isAuthenticated={isAuthenticated}
                      />
                    );
                  }

                  // IMAGE MODE (default) - Show featured image
                  if (project.featuredImageUrl) {
                    return (
                      <>
                        <div
                          className="relative group transform hover:scale-[1.02] transition-all duration-500 ease-out hover:rotate-1 cursor-zoom-in"
                          onClick={() => setIsImageModalOpen(true)}
                        >
                          {/* Glassy Card Container for Image */}
                          <div className="absolute -inset-2 md:-inset-4 bg-white/5 rounded-2xl md:rounded-3xl blur-lg md:blur-xl opacity-50 transition duration-1000 group-hover:opacity-70 group-hover:blur-2xl" />
                          <div className="relative p-1 md:p-2 bg-white/10 backdrop-blur-sm rounded-2xl md:rounded-3xl border border-white/20 shadow-2xl">
                            <img
                              src={project.featuredImageUrl}
                              alt={`${project.title} featured`}
                              className="w-full h-auto rounded-xl md:rounded-2xl shadow-inner"
                            />
                          </div>
                        </div>

                        {/* Full Screen Image Modal */}
                        {isImageModalOpen && (
                          <div
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 md:p-8"
                            onClick={() => setIsImageModalOpen(false)}
                          >
                            <button
                              className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
                              onClick={() => setIsImageModalOpen(false)}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                            <img
                              src={project.featuredImageUrl}
                              alt={`${project.title} full view`}
                              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-[scale-in_0.2s_ease-out]"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        )}
                      </>
                    );
                  }

                  // Fallback visual when no hero content
                  return (
                    <div className="w-full aspect-video rounded-2xl md:rounded-3xl bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center p-6 md:p-12 text-center shadow-2xl relative overflow-hidden group">
                      <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      <div className="relative z-10">
                        <Icon className="w-16 h-16 md:w-24 md:h-24 text-white/20 mx-auto mb-4 md:mb-6" />
                        <p className="text-white/40 text-base md:text-lg font-light">No featured image provided</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

        </div>

        {/* Project Details Section (Below the fold) - Only show if there are real details */}
        {(() => {
          // Helper to strip HTML and normalize text
          const normalizeText = (text: string | undefined | null) =>
            (text || '').replace(/<[^>]*>/g, '').trim().toLowerCase();

          // Filter out placeholder/empty blocks that shouldn't be shown
          const visibleBlocks = project.content?.blocks?.filter((block, index) => {
            const isHeading = block.type === 'text' && block.style === 'heading';
            const normalizedContent = normalizeText(block.content);

            const isPlaceholderHeading =
              isHeading &&
              (normalizedContent === normalizeText(project.title) ||
                normalizedContent === 'untitled project');

            const isFirstHeadingMatchingTitle = index === 0 && isPlaceholderHeading;

            // Hide placeholder heading-only content
            return !isFirstHeadingMatchingTitle;
          }) || [];

          // Only show section if there are visible blocks
          if (visibleBlocks.length === 0) return null;

          return (
            <div className="max-w-5xl mx-auto px-6 sm:px-8 py-16 md:py-24">
              <div className="flex items-center gap-4 mb-12">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Project Details</h2>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
              </div>

              {/* Content Blocks */}
              <div className="space-y-8">
                {project.content.blocks.map((block, index) => {
                  // Skip the first block if it's a placeholder heading matching the title or default text
                  const isHeading = block.type === 'text' && block.style === 'heading';
                  const normalizedContent = normalizeText(block.content);

                  const isPlaceholderHeading =
                    isHeading &&
                    (normalizedContent === normalizeText(project.title) ||
                      normalizedContent === 'untitled project');

                  const isFirstHeadingMatchingTitle = index === 0 && isPlaceholderHeading;

                  if (isFirstHeadingMatchingTitle) {
                    return null;
                  }

                return (
                <div key={index}>
                  {block.type === 'text' && (
                    <div
                      className={`prose dark:prose-invert max-w-none ${
                        block.style === 'heading' ? 'text-2xl font-bold' :
                        block.style === 'quote' ? 'border-l-4 border-primary-500 pl-6 italic' :
                        ''
                      }`}
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(
                          block.markdown !== false
                            ? marked.parse(block.content) as string
                            : block.content
                        )
                      }}
                    />
                  )}

                  {block.type === 'image' && (
                    <figure>
                      <img
                        src={block.url}
                        alt={block.caption || ''}
                        className="w-full max-w-3xl mx-auto rounded-xl shadow-lg"
                      />
                      {block.caption && (
                        <figcaption className="mt-2 text-sm text-center text-gray-600 dark:text-gray-400">
                          {block.caption}
                        </figcaption>
                      )}
                    </figure>
                  )}

                  {block.type === 'mermaid' && (
                    <div className="my-8">
                      <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-lg overflow-x-auto">
                        <MermaidDiagram code={block.code} />
                      </div>
                      {block.caption && (
                        <p className="mt-2 text-sm text-center text-gray-600 dark:text-gray-400">
                          {block.caption}
                        </p>
                      )}
                    </div>
                  )}

                  {block.type === 'code_snippet' && (
                    <div className="my-6">
                      {block.filename && (
                        <div className="bg-gray-800 text-gray-300 px-4 py-2 rounded-t-lg text-sm font-mono">
                          {block.filename}
                        </div>
                      )}
                      <pre className={`bg-gray-900 text-gray-100 p-4 overflow-x-auto ${
                        block.filename ? 'rounded-b-lg' : 'rounded-lg'
                      }`}>
                        <code className={`language-${block.language} text-sm`}>
                          {block.code}
                        </code>
                      </pre>
                    </div>
                  )}

                  {block.type === 'imageGrid' && (
                    <div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {block.images.map((img, imgIndex) => (
                          <figure key={imgIndex}>
                            <img
                              src={img.url}
                              alt={img.caption || ''}
                              className="w-full h-48 object-cover rounded-lg"
                            />
                            {img.caption && (
                              <figcaption className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                                {img.caption}
                              </figcaption>
                            )}
                          </figure>
                        ))}
                      </div>
                      {block.caption && (
                        <p className="mt-4 text-sm text-center text-gray-600 dark:text-gray-400">
                          {block.caption}
                        </p>
                      )}
                    </div>
                  )}

                  {block.type === 'columns' && (
                    <div className={block.containerWidth === 'boxed' ? 'max-w-4xl mx-auto' : 'w-full'}>
                      <div className={`grid gap-6 ${
                        block.columnCount === 1 ? 'grid-cols-1' :
                        block.columnCount === 2 ? 'grid-cols-1 md:grid-cols-2' :
                        'grid-cols-1 md:grid-cols-3'
                      }`}>
                        {block.columns?.map((column: any, colIndex: number) => (
                          <div key={colIndex} className="space-y-4">
                            {column.blocks?.map((nestedBlock: any, nestedIndex: number) => (
                              <div key={nestedIndex}>
                                {nestedBlock.type === 'text' && (
                                  <div
                                    className={`prose dark:prose-invert max-w-none ${
                                      nestedBlock.style === 'heading' ? 'text-xl font-bold' :
                                      nestedBlock.style === 'quote' ? 'border-l-4 border-primary-500 pl-4 italic' :
                                      ''
                                    }`}
                                    dangerouslySetInnerHTML={{
                                      __html: sanitizeHtml(
                                        nestedBlock.markdown !== false
                                          ? marked.parse(nestedBlock.content) as string
                                          : nestedBlock.content
                                      )
                                    }}
                                  />
                                )}
                                {nestedBlock.type === 'image' && nestedBlock.url && (
                                  <figure>
                                    <img
                                      src={nestedBlock.url}
                                      alt={nestedBlock.caption || ''}
                                      className="w-full rounded-lg"
                                    />
                                    {nestedBlock.caption && (
                                      <figcaption className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                        {nestedBlock.caption}
                                      </figcaption>
                                    )}
                                  </figure>
                                )}
                                {nestedBlock.type === 'video' && nestedBlock.url && (
                                  <figure>
                                    <video
                                      src={nestedBlock.url}
                                      controls
                                      autoPlay
                                      loop
                                      muted
                                      playsInline
                                      className="w-full rounded-lg"
                                    />
                                    {nestedBlock.caption && (
                                      <figcaption className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                        {nestedBlock.caption}
                                      </figcaption>
                                    )}
                                  </figure>
                                )}
                                {nestedBlock.type === 'button' && nestedBlock.url && (
                                  <a
                                    href={nestedBlock.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                                      nestedBlock.style === 'primary' ? 'bg-primary-500 hover:bg-primary-600 text-white' :
                                      nestedBlock.style === 'secondary' ? 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white' :
                                      'border-2 border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                                    }`}
                                  >
                                    {nestedBlock.text}
                                  </a>
                                )}
                                {nestedBlock.type === 'divider' && (
                                  <hr className={`border-gray-300 dark:border-gray-700 ${
                                    nestedBlock.style === 'dotted' ? 'border-dotted' :
                                    nestedBlock.style === 'dashed' ? 'border-dashed' :
                                    nestedBlock.style === 'space' ? 'border-transparent my-8' :
                                    ''
                                  }`} />
                                )}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {block.type === 'video' && block.url && (
                    <figure>
                      <video
                        src={block.url}
                        controls
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full rounded-xl"
                      />
                      {block.caption && (
                        <figcaption className="mt-2 text-sm text-center text-gray-600 dark:text-gray-400">
                          {block.caption}
                        </figcaption>
                      )}
                    </figure>
                  )}

                  {block.type === 'button' && block.url && (
                    <div className="text-center">
                      <a
                        href={block.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-2 rounded-lg font-medium transition-colors ${
                          block.size === 'small' ? 'px-4 py-2 text-sm' :
                          block.size === 'large' ? 'px-8 py-4 text-lg' :
                          'px-6 py-3'
                        } ${
                          block.style === 'primary' ? 'bg-primary-500 hover:bg-primary-600 text-white' :
                          block.style === 'secondary' ? 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white' :
                          'border-2 border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                        }`}
                      >
                        {block.text}
                      </a>
                    </div>
                  )}

                  {block.type === 'divider' && (
                    <hr className={`border-gray-300 dark:border-gray-700 ${
                      block.style === 'dotted' ? 'border-dotted border-t-2' :
                      block.style === 'dashed' ? 'border-dashed border-t-2' :
                      block.style === 'space' ? 'border-transparent my-12' :
                      'border-t'
                    }`} />
                  )}
                </div>
                );
                })}
              </div>
            </div>
          );
        })()}

        {/* Success Toast Notification */}
        {showSuccessToast && (
          <div className="fixed top-4 right-4 z-[60] animate-[slide-in-right_0.3s_ease-out]">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 p-4 min-w-[320px] max-w-md">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full flex items-center justify-center shadow-lg">
                  <FaStar className="text-white text-lg" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                    Your voice matters! +10 points earned
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Your feedback has been added to your activity feed.
                  </p>
                </div>
                <button
                  onClick={() => setShowSuccessToast(false)}
                  className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Feedback Sidebar */}
        {isFeedbackSidebarOpen && (
          <>
            {/* Overlay */}
            <div
              className="fixed inset-0 bg-black/20 z-40 animate-[fade-in_0.2s_ease-out]"
              onClick={() => setIsFeedbackSidebarOpen(false)}
            />

            {/* Sidebar */}
            <div className="fixed top-0 right-0 h-full w-full sm:w-[600px] bg-white dark:bg-gray-900 shadow-2xl z-50 overflow-y-auto animate-[slide-in-right_0.3s_ease-out]">
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-6 flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Share Your Thoughts</h3>
                  <button
                    onClick={() => setIsFeedbackSidebarOpen(false)}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 hover:rotate-90 active:scale-95"
                  >
                    <XMarkIcon className="w-6 h-6 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors" />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 p-6 space-y-6">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Leave feedback, endorsement, or comments about this project. Your input helps the creator improve!
                    </p>

                    {!isAuthenticated && (
                      <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                          Please sign in to leave feedback and earn points.
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">
                      Your Feedback
                    </label>
                    <textarea
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      disabled={!isAuthenticated || isSubmittingFeedback}
                      placeholder="What did you think about this project? Any suggestions or praise? Help others and get rewarded with +10 points!"
                      rows={8}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      ✓ Auto-moderation enabled for community safety
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setIsFeedbackSidebarOpen(false)}
                      disabled={isSubmittingFeedback}
                      className="flex-1 px-6 py-3 rounded-lg font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                    <button
                      id="commentReward"
                      onClick={handleSubmitFeedback}
                      disabled={!isAuthenticated || !feedbackText.trim() || isSubmittingFeedback}
                      className="flex-1 px-6 py-3 rounded-lg font-medium text-white bg-primary-500 hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSubmittingFeedback ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <span>Submit Feedback</span>
                      )}
                    </button>
                  </div>

                  {/* Info Section */}
                  <div className="pt-6 border-t border-gray-200 dark:border-gray-800">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Feedback Guidelines</h4>
                    <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                      <li className="flex items-start gap-2">
                        <span className="text-primary-500 mt-0.5">•</span>
                        <span>Be constructive and respectful</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary-500 mt-0.5">•</span>
                        <span>Provide specific examples when possible</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary-500 mt-0.5">•</span>
                        <span>All comments are auto-moderated</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary-500 mt-0.5">•</span>
                        <span>Help creators grow and improve</span>
                      </li>
                    </ul>
                  </div>

                  {/* Comments Section */}
                  <div className="pt-6 border-t border-gray-200 dark:border-gray-800">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                      Comments ({comments.length})
                    </h4>

                    {isLoadingComments ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : !Array.isArray(comments) || comments.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                        No comments yet. Be the first to share your thoughts!
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {comments.map((comment) => (
                          <div
                            key={comment.id}
                            className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700"
                          >
                            {/* Comment Header */}
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 dark:text-primary-400 font-semibold text-sm">
                                  {comment.username.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                    {comment.username}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {new Date(comment.created_at).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric'
                                    })}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Comment Content */}
                            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                              {comment.content}
                            </p>

                            {/* Vote Buttons */}
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleVote(comment.id, 'up')}
                                disabled={!isAuthenticated}
                                className={`p-1.5 rounded transition-all ${
                                  comment.user_vote === 'up'
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                    : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                                title="Upvote"
                              >
                                <ArrowUpIcon className="w-4 h-4" />
                              </button>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[2rem] text-center">
                                {comment.score}
                              </span>
                              <button
                                onClick={() => handleVote(comment.id, 'down')}
                                disabled={!isAuthenticated}
                                className={`p-1.5 rounded transition-all ${
                                  comment.user_vote === 'down'
                                    ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                    : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                                title="Downvote"
                              >
                                <ArrowDownIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Tool Tray */}
      {selectedToolSlug && (
        <ToolTray
          isOpen={showToolTray}
          onClose={() => {
            setShowToolTray(false);
            setSelectedToolSlug(null);
          }}
          toolSlug={selectedToolSlug}
        />
      )}

      {/* Edit Tray */}
      <ProjectEditTray
        isOpen={showEditTray}
        onClose={() => setShowEditTray(false)}
        project={project}
        onProjectUpdate={(updatedProject) => {
          // Update project state immediately without full reload
          setProject(updatedProject);
        }}
      />

      {/* Nested route outlet for tool detail overlay */}
      <Outlet />
    </DashboardLayout>
  );
}

// Slideshow Carousel Component
function SlideshowCarousel({ images, currentIndex, onIndexChange }: { images: string[]; currentIndex: number; onIndexChange: (index: number) => void }) {
  const [isHovered, setIsHovered] = useState(false);

  // Auto-advance slideshow every 5 seconds (pause on hover)
  useEffect(() => {
    if (isHovered || images.length <= 1) return;

    const interval = setInterval(() => {
      onIndexChange((currentIndex + 1) % images.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [currentIndex, images.length, isHovered, onIndexChange]);

  const goToPrevious = () => {
    onIndexChange(currentIndex === 0 ? images.length - 1 : currentIndex - 1);
  };

  const goToNext = () => {
    onIndexChange((currentIndex + 1) % images.length);
  };

  return (
    <div
      className="w-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={() => setIsHovered(true)}
    >
      <div className="relative group">
        <div className="absolute -inset-2 md:-inset-4 bg-white/5 rounded-2xl md:rounded-3xl blur-lg md:blur-xl opacity-50 transition duration-1000 group-hover:opacity-70 group-hover:blur-2xl" />
        <div className="relative p-1 md:p-2 bg-white/10 backdrop-blur-sm rounded-2xl md:rounded-3xl border border-white/20 shadow-2xl">
          {/* Image */}
          <img
            src={images[currentIndex]}
            alt={`Slide ${currentIndex + 1} of ${images.length}`}
            className="relative w-full max-h-[400px] md:max-h-[600px] object-cover rounded-xl md:rounded-2xl shadow-inner transition-opacity duration-500"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/allthrive-placeholder.svg';
            }}
          />

          {/* Navigation Arrows (show only if more than 1 image) */}
          {images.length > 1 && (
            <>
              <button
                onClick={goToPrevious}
                className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 p-2 md:p-3 bg-black/50 hover:bg-black/70 active:bg-black/80 backdrop-blur-sm text-white rounded-full transition-all md:opacity-0 md:group-hover:opacity-100 touch-manipulation"
                aria-label="Previous slide"
              >
                <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={goToNext}
                className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 p-2 md:p-3 bg-black/50 hover:bg-black/70 active:bg-black/80 backdrop-blur-sm text-white rounded-full transition-all md:opacity-0 md:group-hover:opacity-100 touch-manipulation"
                aria-label="Next slide"
              >
                <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {/* Indicator Dots */}
          <div className="absolute bottom-3 md:bottom-4 left-1/2 transform -translate-x-1/2 flex gap-1.5 md:gap-2">
            {images.map((_, idx) => (
              <button
                key={idx}
                onClick={() => onIndexChange(idx)}
                className={`h-2 md:h-2.5 rounded-full transition-all touch-manipulation ${
                  idx === currentIndex ? 'bg-white w-6 md:w-8' : 'bg-white/30 hover:bg-white/50 active:bg-white/60 w-2 md:w-2.5'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

          {/* Image Counter */}
          <div className="absolute top-3 md:top-4 right-3 md:right-4 px-2.5 md:px-3 py-1 md:py-1.5 bg-black/50 backdrop-blur-sm text-white text-xs md:text-sm font-medium rounded-full">
            {currentIndex + 1} / {images.length}
          </div>
        </div>
      </div>
    </div>
  );
}
