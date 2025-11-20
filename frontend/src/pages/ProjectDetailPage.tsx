import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, Outlet } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { getProjectBySlug, updateProject, deleteProject, toggleProjectLike } from '@/services/projects';
import { getProjectComments, createProjectComment, voteOnComment, type Comment } from '@/services/comments';
import { useAuth } from '@/hooks/useAuth';
import type { Project } from '@/types/models';
import { FaStar } from 'react-icons/fa';
import { useReward } from 'react-rewards';
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
  image_collection: PhotoIcon,
  prompt: ChatBubbleLeftRightIcon,
  other: DocumentTextIcon,
};

const typeLabels = {
  github_repo: 'GitHub Repository',
  image_collection: 'Image Collection',
  prompt: 'Prompt',
  other: 'Project',
};

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
  }, [username, projectSlug]);

  // Load comments when project is loaded
  useEffect(() => {
    async function loadComments() {
      if (!project) return;

      setIsLoadingComments(true);
      try {
        const data = await getProjectComments(project.id);
        // Ensure data is an array
        if (Array.isArray(data)) {
          setComments(data);
        } else {
          console.error('Comments data is not an array:', data);
          setComments([]);
        }
      } catch (err) {
        console.error('Failed to load comments:', err);
        setComments([]);
      } finally {
        setIsLoadingComments(false);
      }
    }

    loadComments();
  }, [project]);

  const isOwner = isAuthenticated && user && project && user.username.toLowerCase() === project.username.toLowerCase();

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

      // Clear form
      setFeedbackText('');

      // Show success toast and trigger celebration
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 5000);

      // Trigger star emoji celebration
      rewardComment();
    } catch (error: any) {
      console.error('Failed to submit feedback:', error);
      const errorMessage = error.response?.data?.content?.[0] || 'Failed to submit feedback. Please try again.';
      alert(errorMessage);
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
      console.error('Failed to vote on comment:', error);
      alert('Failed to vote. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
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
      <DashboardLayout>
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

  return (
    <DashboardLayout>
      <div className="flex-1 bg-white dark:bg-gray-900 overflow-y-auto">
        {/* Full Height Hero Section */}
        <div className="relative min-h-[95vh] w-full flex items-center overflow-hidden bg-gray-900">
          {/* Background Layer */}
          <div className="absolute inset-0 z-0">
            {project.thumbnailUrl ? (
              <>
                <img
                  src={project.thumbnailUrl}
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
          <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-8 py-12 md:py-16">

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
                          navigate(`/${project.username}/${project.slug}/edit`);
                        }}
                        className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 flex items-center gap-3 transition-colors"
                      >
                        <PencilIcon className="w-4 h-4" />
                        Edit
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

            <div className="grid lg:grid-cols-2 gap-12 items-center pt-12">
              {/* Left Column: Text Content */}
              <div className="space-y-10">
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
                          onClick={() => navigate(`tools/${tool.slug}`)}
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

              {/* Right Column: Featured Image */}
              <div className="hidden lg:flex items-center justify-center perspective-1000">
                {project.featuredImageUrl ? (
                  <>
                    <div
                      className="relative group transform hover:scale-[1.02] transition-all duration-500 ease-out hover:rotate-1 cursor-zoom-in"
                      onClick={() => setIsImageModalOpen(true)}
                    >
                      {/* Glassy Card Container for Image */}
                      <div className="absolute -inset-4 bg-white/5 rounded-3xl blur-xl opacity-50 transition duration-1000 group-hover:opacity-70 group-hover:blur-2xl" />
                      <div className="relative p-2 bg-white/10 backdrop-blur-sm rounded-3xl border border-white/20 shadow-2xl">
                          <img
                          src={project.featuredImageUrl}
                          alt={`${project.title} featured`}
                          className="relative w-full max-h-[600px] object-cover rounded-2xl shadow-inner"
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
                ) : (
                  // Fallback visual
                  <div className="w-full aspect-video rounded-3xl bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center p-12 text-center shadow-2xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative z-10">
                      <Icon className="w-24 h-24 text-white/20 mx-auto mb-6" />
                      <p className="text-white/40 text-lg font-light">No featured image provided</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Project Details Section (Below the fold) */}
        <div className="max-w-5xl mx-auto px-6 sm:px-8 py-16 md:py-24">
          <div className="flex items-center gap-4 mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Project Details</h2>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
          </div>

          {/* Content Blocks */}
          {project.content?.blocks && project.content.blocks.length > 0 ? (
            <div className="space-y-8">
              {project.content.blocks.map((block, index) => {
                // Skip the first block if it's a heading that matches the project title
                const isFirstHeadingMatchingTitle = index === 0 &&
                  block.type === 'text' &&
                  block.style === 'heading' &&
                  block.content?.replace(/<[^>]*>/g, '').trim() === project.title;

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
                      dangerouslySetInnerHTML={{ __html: block.content }}
                    />
                  )}

                  {block.type === 'image' && (
                    <figure>
                      <img
                        src={block.url}
                        alt={block.caption || ''}
                        className="w-full rounded-xl"
                      />
                      {block.caption && (
                        <figcaption className="mt-2 text-sm text-center text-gray-600 dark:text-gray-400">
                          {block.caption}
                        </figcaption>
                      )}
                    </figure>
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
                                    dangerouslySetInnerHTML={{ __html: nestedBlock.content }}
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
          ) : (
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-12 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                No additional content for this project yet.
              </p>
            </div>
          )}
        </div>

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
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-[fade-in_0.2s_ease-out]"
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

                    {/* Points Incentive Banner */}
                    {isAuthenticated && (
                      <div className="mb-4 p-4 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full flex items-center justify-center shadow-lg">
                            <FaStar className="text-white text-lg" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                              +10 Points • Share Your Perspective
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              Help others, get rewarded
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

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
                      placeholder="What did you think about this project? Any suggestions or praise?"
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

                    {!Array.isArray(comments) || comments.length === 0 ? (
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

      {/* Nested route outlet for tool detail overlay */}
      <Outlet />
    </DashboardLayout>
  );
}
