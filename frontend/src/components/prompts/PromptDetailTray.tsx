/**
 * Prompt Detail Tray Component
 *
 * A right sidebar tray that displays the full details of an AI prompt.
 * Shows the prompt text with copy functionality, metadata (tools, topics),
 * and includes like/comment actions with an integrated comments section.
 */
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  XMarkIcon,
  HeartIcon,
  ChatBubbleLeftIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGripLinesVertical, faExpand, faCompress, faLightbulb } from '@fortawesome/free-solid-svg-icons';
import { ToolTray } from '@/components/tools/ToolTray';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useResizableTray } from '@/hooks/useResizableTray';
import { toggleProjectLike } from '@/services/projects';
import { getProjectComments, createProjectComment, type Comment } from '@/services/comments';
import { parseApiError } from '@/utils/errorHandler';
import type { Project } from '@/types/models';

interface PromptDetailTrayProps {
  isOpen: boolean;
  onClose: () => void;
  prompt: Project | null;
  onEdit?: (prompt: Project) => void;
  onDelete?: (prompt: Project) => void;
  isOwner?: boolean;
}

export function PromptDetailTray({
  isOpen,
  onClose,
  prompt,
  onEdit,
  onDelete,
  isOwner = false,
}: PromptDetailTrayProps) {
  const { theme } = useTheme();
  const { isAuthenticated } = useAuth();

  // Like state
  const [isLiked, setIsLiked] = useState(prompt?.isLikedByUser ?? false);
  const [heartCount, setHeartCount] = useState(prompt?.heartCount ?? 0);
  const [isLiking, setIsLiking] = useState(false);

  // Copy state
  const [copied, setCopied] = useState(false);

  // Tool tray state
  const [showToolTray, setShowToolTray] = useState(false);
  const [selectedToolSlug, setSelectedToolSlug] = useState<string>('');

  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [showComments, setShowComments] = useState(false);

  // Track if tray should be rendered (for slide-out animation)
  const [shouldRender, setShouldRender] = useState(false);
  const [visuallyOpen, setVisuallyOpen] = useState(false);

  // Resizable tray - only on desktop
  const {
    width: trayWidth,
    isDragging: isResizing,
    isExpanded,
    toggleExpand,
    handleProps: resizeHandleProps,
  } = useResizableTray({
    minWidth: 380,
    maxWidth: 700,
    defaultWidth: 420,
    storageKey: 'promptDetailTrayWidth',
    isOpen,
  });

  // Refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLElement>(null);

  // Handle transition end to unmount after closing
  const handleTransitionEnd = () => {
    if (!isOpen) {
      setShouldRender(false);
    }
  };

  // Handle open/close with proper animation timing
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      const timer = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setVisuallyOpen(true);
        });
      });
      return () => cancelAnimationFrame(timer);
    } else {
      setVisuallyOpen(false);
    }
  }, [isOpen]);

  // Reset state when prompt changes
  useEffect(() => {
    if (prompt) {
      setIsLiked(prompt.isLikedByUser ?? false);
      setHeartCount(prompt.heartCount ?? 0);
      setCopied(false);
      setShowComments(false);
      setComments([]);
    }
    setShowToolTray(false);
    setSelectedToolSlug('');
  }, [prompt?.id]);

  // Load comments when comments section is opened
  useEffect(() => {
    async function loadComments() {
      if (!prompt || !showComments || comments.length > 0) return;

      setIsLoadingComments(true);
      try {
        const data = await getProjectComments(prompt.id);
        setComments(data);
      } catch (error) {
        const errorInfo = parseApiError(error);
        console.error('Failed to load comments:', errorInfo.message);
      } finally {
        setIsLoadingComments(false);
      }
    }

    loadComments();
  }, [prompt?.id, showComments, comments.length]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Get the prompt text from the content
  const getPromptText = (): string => {
    if (!prompt?.content) return '';
    const promptContent = prompt.content as { prompt?: { text?: string } };
    return promptContent.prompt?.text || prompt.description || '';
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLiking || !prompt) return;

    setIsLiking(true);
    try {
      const result = await toggleProjectLike(prompt.id);
      setIsLiked(result.liked);
      setHeartCount(result.heartCount);
    } catch (error) {
      console.error('Failed to toggle like:', error);
    } finally {
      setIsLiking(false);
    }
  };

  const handleCopy = async () => {
    const text = getPromptText();
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !isAuthenticated || !prompt) return;

    setIsSubmittingComment(true);
    try {
      const response = await createProjectComment(prompt.id, {
        content: commentText,
      });
      setComments([response, ...comments]);
      setCommentText('');
    } catch (error) {
      const errorInfo = parseApiError(error);
      console.error('Failed to submit comment:', errorInfo.message);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  if (!shouldRender || !prompt) return null;

  const promptText = getPromptText();

  return createPortal(
    <>
      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 z-40 md:pointer-events-none transition-opacity duration-300 ease-in-out ${
          visuallyOpen ? 'opacity-100 bg-black/30 md:bg-transparent' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Right Sidebar Drawer */}
      <aside
        ref={trayRef}
        className={`fixed top-0 right-0 h-full w-full border-l border-gray-200 dark:border-white/10 shadow-2xl z-40 overflow-hidden flex flex-col ${
          isResizing ? '' : 'transition-all duration-300 ease-in-out'
        } ${visuallyOpen ? 'translate-x-0' : 'translate-x-full'} ${
          showToolTray ? 'md:right-[28rem]' : ''
        }`}
        style={{
          backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          width: typeof window !== 'undefined' && window.innerWidth >= 768 ? `${trayWidth}px` : undefined,
          maxWidth: typeof window !== 'undefined' && window.innerWidth >= 768 ? '90vw' : undefined,
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        {/* Resize handle - desktop only */}
        <div
          {...resizeHandleProps}
          className="hidden md:flex absolute left-0 top-0 bottom-0 w-3 hover:w-4 bg-transparent hover:bg-primary-500/20 transition-all z-50 cursor-ew-resize items-center justify-center group"
        >
          <div className="flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <FontAwesomeIcon
              icon={faGripLinesVertical}
              className="text-gray-400 dark:text-gray-500 text-xs"
            />
          </div>
        </div>

        {/* Mobile drag handle indicator */}
        <div className="md:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>

        {/* Header */}
        <div className="flex-shrink-0 px-6 md:px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-gradient-to-r from-cyan-500 to-cyan-600 text-white flex items-center gap-1 shadow-[0_0_10px_rgba(14,165,233,0.3)]">
                  <FontAwesomeIcon icon={faLightbulb} className="w-2.5 h-2.5" />
                  Prompt
                </span>
              </div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                {prompt.title}
              </h1>
              <Link
                to={`/${prompt.username}`}
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
              >
                by @{prompt.username}
              </Link>
            </div>
            <div className="flex items-center gap-1">
              {/* Owner actions */}
              {isOwner && onEdit && (
                <button
                  onClick={() => onEdit(prompt)}
                  className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  aria-label="Edit prompt"
                  title="Edit"
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
              )}
              {isOwner && onDelete && (
                <button
                  onClick={() => onDelete(prompt)}
                  className="p-1.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                  aria-label="Delete prompt"
                  title="Delete"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              )}
              {/* Expand button - desktop only */}
              <button
                onClick={toggleExpand}
                className="hidden md:flex p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                aria-label={isExpanded ? 'Collapse tray' : 'Expand tray'}
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                <FontAwesomeIcon icon={isExpanded ? faCompress : faExpand} className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                aria-label="Close"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overscroll-y-contain pb-10">
          {/* Prompt Text */}
          <div className="p-6 md:p-4">
            <div className="relative">
              <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-900/20 dark:to-sky-900/20 border border-cyan-200 dark:border-cyan-800/50">
                <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-mono leading-relaxed">
                  {promptText || 'No prompt text available.'}
                </pre>
              </div>
              {/* Copy button */}
              {promptText && (
                <button
                  onClick={handleCopy}
                  className={`absolute top-2 right-2 p-2 rounded-lg transition-all ${
                    copied
                      ? 'bg-green-500 text-white'
                      : 'bg-white/80 dark:bg-slate-800/80 text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-slate-800'
                  }`}
                  title={copied ? 'Copied!' : 'Copy prompt'}
                >
                  {copied ? (
                    <CheckIcon className="w-4 h-4" />
                  ) : (
                    <ClipboardDocumentIcon className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Description (if different from prompt text) */}
          {prompt.description && prompt.description !== promptText && (
            <div className="px-6 md:px-4 pb-4">
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                {prompt.description}
              </p>
            </div>
          )}

          {/* Tool badges */}
          {prompt.toolsDetails && prompt.toolsDetails.length > 0 && (
            <div className="px-6 md:px-4 pb-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Works with:</p>
              <div className="flex flex-wrap gap-2">
                {prompt.toolsDetails.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => {
                      setSelectedToolSlug(tool.slug);
                      setShowToolTray(true);
                    }}
                    className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center gap-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                  >
                    {tool.logoUrl && (
                      <img src={tool.logoUrl} alt={tool.name} className="w-3.5 h-3.5 rounded" />
                    )}
                    {tool.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category badges */}
          {prompt.categoriesDetails && prompt.categoriesDetails.length > 0 && (
            <div className="px-6 md:px-4 pb-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Categories:</p>
              <div className="flex flex-wrap gap-2">
                {prompt.categoriesDetails.map((category) => (
                  <span
                    key={category.id}
                    className="px-2.5 py-1 text-xs font-medium rounded-full"
                    style={{
                      backgroundColor: category.color ? `${category.color}20` : 'rgba(245, 158, 11, 0.2)',
                      color: category.color || '#f59e0b',
                    }}
                  >
                    {category.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Topic tags */}
          {prompt.topicsDetails && prompt.topicsDetails.length > 0 && (
            <div className="px-6 md:px-4 pb-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Topics:</p>
              <div className="flex flex-wrap gap-1.5">
                {prompt.topicsDetails.map((topic) => (
                  <span
                    key={topic.id}
                    className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                  >
                    #{topic.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Comments Section */}
          {showComments && (
            <div className="px-6 md:px-4 pb-4 border-t border-gray-200 dark:border-gray-700 mt-4 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Comments ({comments.length})
              </h3>

              {/* Comment form */}
              {isAuthenticated ? (
                <form onSubmit={handleSubmitComment} className="mb-4">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-lg resize-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-400"
                    rows={2}
                  />
                  <button
                    type="submit"
                    disabled={!commentText.trim() || isSubmittingComment}
                    className="mt-2 px-4 py-1.5 text-sm font-medium bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 disabled:from-gray-300 disabled:to-gray-400 dark:disabled:from-gray-700 dark:disabled:to-gray-600 text-white rounded-lg transition-all shadow-[0_0_10px_rgba(14,165,233,0.2)] disabled:shadow-none disabled:cursor-not-allowed"
                  >
                    {isSubmittingComment ? 'Posting...' : 'Post'}
                  </button>
                </form>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Sign in to leave a comment
                </p>
              )}

              {/* Comments list */}
              {isLoadingComments ? (
                <div className="flex items-center justify-center py-4">
                  <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : comments.length > 0 ? (
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <div key={comment.id} className="p-3 rounded-lg bg-gray-50 dark:bg-slate-800/50">
                      <div className="flex items-center gap-2 mb-1">
                        <Link
                          to={`/${comment.username}`}
                          className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
                          onClick={onClose}
                        >
                          @{comment.username}
                        </Link>
                        <span className="text-xs text-gray-400">
                          {new Date(comment.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{comment.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  No comments yet. Be the first to comment!
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer - Fixed */}
        <div className="flex-shrink-0 px-6 md:px-4 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900">
          {/* Action buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Like button */}
              <button
                onClick={handleLike}
                disabled={isLiking || !isAuthenticated}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all hover:scale-105 disabled:opacity-50 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                {isLiked ? (
                  <HeartIconSolid className="w-4 h-4 text-red-500" />
                ) : (
                  <HeartIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                )}
                {heartCount > 0 && (
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {heartCount}
                  </span>
                )}
              </button>

              {/* Comment button */}
              <button
                onClick={() => setShowComments(!showComments)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all hover:scale-105 ${
                  showComments
                    ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400'
                    : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <ChatBubbleLeftIcon className="w-4 h-4" />
                <span className="text-xs font-medium">
                  {showComments ? 'Hide' : 'Comments'}
                </span>
              </button>
            </div>

            {/* Copy button - prominent */}
            <button
              onClick={handleCopy}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                copied
                  ? 'bg-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.3)]'
                  : 'bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white shadow-[0_0_15px_rgba(14,165,233,0.3)] hover:shadow-[0_0_20px_rgba(14,165,233,0.4)]'
              }`}
            >
              {copied ? (
                <>
                  <CheckIcon className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <ClipboardDocumentIcon className="w-4 h-4" />
                  Copy Prompt
                </>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Tool Tray - Opens when clicking a tool badge */}
      {showToolTray && selectedToolSlug && (
        <ToolTray
          isOpen={showToolTray}
          onClose={() => setShowToolTray(false)}
          toolSlug={selectedToolSlug}
        />
      )}
    </>,
    document.body
  );
}
