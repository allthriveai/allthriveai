/**
 * Learning Path Detail Page
 *
 * Displays a generated learning path by its slug with split-pane layout.
 * Curriculum on left, Ember chat panel on right when active.
 * Accessed via /:username/learn/:slug
 */
import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { useLearningPathBySlug } from '@/hooks/useLearningPaths';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGraduationCap,
  faArrowLeft,
  faPlay,
  faBook,
  faCode,
  faGamepad,
  faQuestion,
  faClock,
  faSignal,
  faWrench,
  faExternalLinkAlt,
  faLightbulb,
  faChevronDown,
  faChevronRight,
  faRobot,
  faComments,
  faUsers,
  faThumbsUp,
  faThumbsDown,
  faTimes,
  faSearchPlus,
} from '@fortawesome/free-solid-svg-icons';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { MermaidDiagram } from '@/components/projects/shared/MermaidDiagram';
import { ChatGameCard } from '@/components/chat/games/ChatGameCard';
import { GAME_REGISTRY, type PlayableGameType } from '@/components/chat/games/gameRegistry';
import { LearningChatPanel, type LessonContext } from '@/components/learning/LearningChatPanel';
import { MobileSageBottomSheet } from '@/components/learning';
import { useAuth } from '@/hooks/useAuth';
import { getLessonImage, rateLesson, type CurriculumItem, type RelatedProject } from '@/services/learningPaths';
import { getToolBySlug } from '@/services/tools';
import type { Tool } from '@/types/models';

/**
 * Image Lightbox component for viewing lesson images full-screen
 */
interface ImageLightboxProps {
  imageUrl: string;
  alt: string;
  onClose: () => void;
}

function ImageLightbox({ imageUrl, alt, onClose }: ImageLightboxProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
        aria-label="Close image"
      >
        <FontAwesomeIcon icon={faTimes} className="w-6 h-6" />
      </button>

      {/* Image container */}
      <div
        className="relative max-w-[95vw] max-h-[95vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl}
          alt={alt}
          className="max-w-full max-h-[95vh] object-contain rounded-lg shadow-2xl"
        />
      </div>
    </div>,
    document.body
  );
}

/**
 * Detect programming language from code content
 */
function detectLanguage(code: string): string {
  const trimmed = code.trim();

  // Python indicators
  if (trimmed.includes('def ') || trimmed.includes('import ') ||
      trimmed.includes('print(') || trimmed.includes('class ') && trimmed.includes(':')) {
    return 'python';
  }

  // JavaScript/TypeScript indicators
  if (trimmed.includes('const ') || trimmed.includes('let ') ||
      trimmed.includes('function ') || trimmed.includes('=>') ||
      trimmed.includes('console.log')) {
    if (trimmed.includes(': string') || trimmed.includes(': number') ||
        trimmed.includes('interface ') || trimmed.includes('<T>')) {
      return 'typescript';
    }
    return 'javascript';
  }

  // JSON indicators
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // Not valid JSON, continue checking
    }
  }

  // Bash/shell indicators
  if (trimmed.startsWith('$') || trimmed.startsWith('#!') ||
      trimmed.includes('echo ') || trimmed.includes('curl ') ||
      trimmed.includes('pip install') || trimmed.includes('npm ')) {
    return 'bash';
  }

  // SQL indicators
  if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\b/i.test(trimmed)) {
    return 'sql';
  }

  // HTML indicators
  if (trimmed.includes('</') || trimmed.startsWith('<')) {
    return 'html';
  }

  // CSS indicators
  if (trimmed.includes('{') && (trimmed.includes(':') && trimmed.includes(';'))) {
    return 'css';
  }

  // Default to javascript for code-like content
  return 'javascript';
}

/**
 * Get icon for curriculum item type
 */
function getTypeIcon(type: CurriculumItem['type']) {
  switch (type) {
    case 'video':
      return faPlay;
    case 'article':
      return faBook;
    case 'code-repo':
      return faCode;
    case 'game':
      return faGamepad;
    case 'quiz':
      return faQuestion;
    case 'tool':
      return faWrench;
    case 'ai_lesson':
      return faLightbulb;
    case 'related_projects':
      return faUsers;
    default:
      return faBook;
  }
}

/**
 * Get label for curriculum item type
 */
function getTypeLabel(type: CurriculumItem['type']) {
  switch (type) {
    case 'video':
      return 'Video';
    case 'article':
      return 'Article';
    case 'code-repo':
      return 'Code';
    case 'game':
      return 'Game';
    case 'quiz':
      return 'Quiz';
    case 'tool':
      return 'Tool';
    case 'ai_lesson':
      return 'Lesson';
    case 'related_projects':
      return 'Community';
    default:
      return 'Content';
  }
}

/**
 * Get color classes for curriculum item type
 */
function getTypeColor(type: CurriculumItem['type']) {
  switch (type) {
    case 'video':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'article':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'code-repo':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'game':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'quiz':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'tool':
      return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    case 'ai_lesson':
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'related_projects':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
}

/**
 * Map game slugs from curriculum to game registry types
 */
const GAME_SLUG_TO_TYPE: Record<string, PlayableGameType> = {
  'context-snake': 'snake',
  'snake': 'snake',
  'ethics-defender': 'ethics',
  'ethics': 'ethics',
  'ai-trivia': 'quiz',
  'quiz': 'quiz',
  'prompt-battle': 'prompt_battle',
  'prompt_battle': 'prompt_battle',
};

/**
 * Get the game type for ChatGameCard from a curriculum game slug
 */
function getGameType(gameSlug: string): PlayableGameType | null {
  // Try direct mapping first
  if (GAME_SLUG_TO_TYPE[gameSlug]) {
    return GAME_SLUG_TO_TYPE[gameSlug];
  }
  // Check if it's already a valid game type in the registry
  if (gameSlug in GAME_REGISTRY) {
    return gameSlug as PlayableGameType;
  }
  return null;
}

/**
 * Game Item Card - renders an inline playable game
 */
function GameItemCard({ item, index }: { item: CurriculumItem; index: number }) {
  const gameSlug = item.gameSlug || '';
  const gameType = getGameType(gameSlug);

  // If we can't map to a game type, fall back to a link
  if (!gameType) {
    return (
      <Link to={`/play/${gameSlug}`}>
        <div className="glass-strong p-4 rounded hover:bg-white/5 dark:hover:bg-white/10 transition-colors group">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-white/70">
              {index + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-purple-500/20 text-purple-400 border-purple-500/30">
                  <FontAwesomeIcon icon={faGamepad} className="text-[10px]" />
                  Game
                </span>
              </div>
              <h3 className="text-slate-900 dark:text-white font-medium group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                {item.title}
              </h3>
            </div>
            <FontAwesomeIcon
              icon={faExternalLinkAlt}
              className="text-slate-400 dark:text-white/30 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex-shrink-0"
            />
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div className="glass-strong rounded overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-white/10">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-sm font-bold text-purple-400">
            {index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-purple-500/20 text-purple-400 border-purple-500/30">
                <FontAwesomeIcon icon={faGamepad} className="text-[10px]" />
                Interactive Game
              </span>
            </div>
            <h3 className="text-slate-900 dark:text-white font-medium">{item.title}</h3>
          </div>
        </div>
      </div>

      {/* Game container */}
      <div className="p-4 flex justify-center">
        <ChatGameCard gameType={gameType} hideTryAnother />
      </div>
    </div>
  );
}

/**
 * Project Card for related projects grid
 */
function ProjectCard({ project }: { project: RelatedProject }) {
  return (
    <Link
      to={project.url || `/${project.username}/${project.slug}`}
      className="group block bg-slate-100 dark:bg-white/5 rounded-lg overflow-hidden hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
    >
      {/* Thumbnail */}
      {project.thumbnail && (
        <div className="aspect-video bg-slate-200 dark:bg-white/10 overflow-hidden">
          <img
            src={project.thumbnail}
            alt={project.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}

      {/* Content */}
      <div className="p-3">
        {/* Type badge and difficulty */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs text-slate-500 dark:text-gray-400 capitalize">
            {project.contentType?.replace(/-/g, ' ') || 'Project'}
          </span>
          {project.difficulty && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-gray-300 capitalize">
              {project.difficulty}
            </span>
          )}
        </div>

        {/* Title */}
        <h4 className="text-sm font-medium text-slate-900 dark:text-white line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors mb-1">
          {project.title}
        </h4>

        {/* Author */}
        <p className="text-xs text-slate-500 dark:text-gray-500">
          by {project.username}
        </p>
      </div>
    </Link>
  );
}

/**
 * Tool Item Card - expandable card that shows tool details inline
 */
function ToolItemCard({ item, index }: { item: CurriculumItem; index: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [tool, setTool] = useState<Tool | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  // Fetch tool data when expanded for the first time
  useEffect(() => {
    if (isExpanded && !tool && !isLoading && !error && item.toolSlug) {
      setIsLoading(true);
      getToolBySlug(item.toolSlug)
        .then((data) => setTool(data))
        .catch(() => setError(true))
        .finally(() => setIsLoading(false));
    }
  }, [isExpanded, tool, isLoading, error, item.toolSlug]);

  return (
    <div className="glass-strong rounded overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-start gap-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-left"
      >
        {/* Order number */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-sm font-bold text-cyan-400">
          {index + 1}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
              <FontAwesomeIcon icon={faWrench} className="text-[10px]" />
              Tool
            </span>
          </div>
          <h3 className="text-slate-900 dark:text-white font-medium">{item.title}</h3>
        </div>

        {/* Expand/collapse indicator */}
        <FontAwesomeIcon
          icon={isExpanded ? faChevronDown : faChevronRight}
          className="text-slate-400 dark:text-gray-400 flex-shrink-0 mt-1"
        />
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-slate-200 dark:border-white/10 p-6">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500" />
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-slate-500 dark:text-gray-400 mb-4">Failed to load tool details.</p>
              <Link
                to={`/tools/${item.toolSlug}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                View Tool Page
                <FontAwesomeIcon icon={faExternalLinkAlt} className="text-xs" />
              </Link>
            </div>
          )}

          {tool && (
            <div className="space-y-4">
              {/* Tool header with logo */}
              <div className="flex items-start gap-4">
                {tool.logoUrl && (
                  <img
                    src={tool.logoUrl}
                    alt={tool.name}
                    className="w-16 h-16 rounded-lg object-cover bg-slate-100 dark:bg-white/10"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="text-lg font-semibold text-slate-900 dark:text-white">{tool.name}</h4>
                  <p className="text-slate-600 dark:text-gray-400 text-sm">{tool.tagline}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-gray-300 text-xs">
                      {tool.categoryDisplay}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs capitalize">
                      {tool.pricingModel.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="text-slate-600 dark:text-gray-300 text-sm leading-relaxed">
                {tool.description}
              </p>

              {/* Features */}
              {tool.keyFeatures && tool.keyFeatures.length > 0 && (
                <div>
                  <h5 className="text-slate-900 dark:text-white font-medium text-sm mb-2">Key Features</h5>
                  <ul className="space-y-1">
                    {tool.keyFeatures.slice(0, 4).map((feature: { title: string; description: string }, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-gray-300">
                        <span className="text-cyan-500 mt-1">•</span>
                        <span><strong>{feature.title}:</strong> {feature.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {tool.websiteUrl && (
                  <a
                    href={tool.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Visit Website
                    <FontAwesomeIcon icon={faExternalLinkAlt} className="text-xs" />
                  </a>
                )}
                <Link
                  to={`/tools/${item.toolSlug}`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors"
                >
                  Full Details
                  <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Related Projects Card - shows community projects section
 */
function RelatedProjectsCard({ item, index }: { item: CurriculumItem; index: number }) {
  const projects = item.projects || [];

  return (
    <div className="glass-strong rounded overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-white/10">
        <div className="flex items-start gap-4">
          {/* Order number */}
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-sm font-bold text-amber-400">
            {index + 1}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-amber-500/20 text-amber-400 border-amber-500/30">
                <FontAwesomeIcon icon={faUsers} className="text-[10px]" />
                Community
              </span>
            </div>
            <h3 className="text-slate-900 dark:text-white font-medium">{item.title}</h3>
            <p className="text-slate-600 dark:text-gray-400 text-sm mt-1">
              {projects.length > 0
                ? 'Explore projects from the AllThrive community'
                : 'Be the first to share a project on this topic!'}
            </p>
          </div>
        </div>
      </div>

      {/* Projects grid or empty state */}
      <div className="p-4">
        {projects.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <FontAwesomeIcon icon={faUsers} className="text-2xl text-amber-400" />
            </div>
            <p className="text-slate-600 dark:text-gray-400 text-sm mb-4">
              No community projects yet for this topic.
            </p>
            <Link
              to="/create"
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Share Your Project
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * AI Lesson Card component - renders expandable AI-generated lesson content
 */
interface AILessonCardProps {
  item: CurriculumItem;
  index: number;
  pathSlug?: string;
  onOpenChat?: (context: LessonContext) => void;
}

function AILessonCard({ item, index, pathSlug, onOpenChat }: AILessonCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [userRating, setUserRating] = useState<'helpful' | 'not_helpful' | null>(null);
  const [isRating, setIsRating] = useState(false);
  const [hasStartedLoading, setHasStartedLoading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const content = item.content;

  // Start loading image when card comes into view (preload before user clicks)
  useEffect(() => {
    if (!pathSlug || hasStartedLoading || imageUrl || imageError) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setHasStartedLoading(true);
          setImageLoading(true);
          getLessonImage(pathSlug, item.order)
            .then((url) => {
              if (url) {
                setImageUrl(url);
              } else {
                setImageError(true);
              }
            })
            .catch(() => setImageError(true))
            .finally(() => setImageLoading(false));
        }
      },
      {
        root: null,
        // Start loading when card is 500px away from viewport
        rootMargin: '500px',
        threshold: 0,
      }
    );

    const currentRef = cardRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [pathSlug, item.order, hasStartedLoading, imageUrl, imageError]);

  if (!content) {
    return null;
  }

  const handleOpenChat = () => {
    if (onOpenChat && content) {
      onOpenChat({
        lessonTitle: item.title,
        explanation: content.explanation,
        examples: content.examples,
        practicePrompt: content.practicePrompt,
        keyConcepts: content.keyConcepts,
      });
    }
  };

  const handleRating = async (rating: 'helpful' | 'not_helpful') => {
    // If user clicks the same rating, toggle it off
    if (userRating === rating) {
      setUserRating(null);
      return;
    }

    // Need projectId to rate - for AI lessons this comes after persisting
    if (!item.projectId) {
      // For now, just set the UI state - actual rating will be saved when lesson is persisted
      setUserRating(rating);
      return;
    }

    setIsRating(true);
    try {
      await rateLesson(item.projectId, rating);
      setUserRating(rating);
    } catch (error) {
      console.error('Failed to rate lesson:', error);
    } finally {
      setIsRating(false);
    }
  };

  return (
    <div ref={cardRef} className="glass-strong rounded overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-start gap-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-left"
      >
        {/* Order number */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-sm font-bold text-emerald-400">
          {index + 1}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
              <FontAwesomeIcon icon={faLightbulb} className="text-[10px]" />
              AI Lesson
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-purple-500/20 text-purple-400 border-purple-500/30">
              <FontAwesomeIcon icon={faRobot} className="text-[10px]" />
              Personalized
            </span>
          </div>
          <h3 className="text-slate-900 dark:text-white font-medium mb-2">{item.title}</h3>
          <p className="text-slate-600 dark:text-gray-400 text-sm line-clamp-2">{content.summary}</p>

          {/* Key concepts chips */}
          {content.keyConcepts && content.keyConcepts.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {content.keyConcepts.slice(0, 4).map((concept, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-gray-300 text-xs"
                >
                  {concept}
                </span>
              ))}
              {content.keyConcepts.length > 4 && (
                <span className="px-2 py-0.5 text-slate-500 dark:text-gray-500 text-xs">
                  +{content.keyConcepts.length - 4} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* Expand/collapse indicator */}
        <FontAwesomeIcon
          icon={isExpanded ? faChevronDown : faChevronRight}
          className="text-slate-400 dark:text-gray-400 flex-shrink-0 mt-1"
        />
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-slate-200 dark:border-white/10 p-6 space-y-6">
          {/* AI-generated illustration */}
          {imageLoading && (
            <div className="bg-slate-100 dark:bg-white/5 rounded-lg p-8 flex flex-col items-center justify-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500" />
              <p className="text-slate-500 dark:text-gray-400 text-sm">Generating illustration...</p>
            </div>
          )}
          {imageUrl && (
            <>
              <button
                onClick={() => setShowLightbox(true)}
                className="relative w-full bg-slate-100 dark:bg-white/5 rounded-lg overflow-hidden group cursor-zoom-in"
              >
                <img
                  src={imageUrl}
                  alt={`Illustration for ${item.title}`}
                  className="w-full h-auto transition-transform duration-300 group-hover:scale-[1.02]"
                />
                {/* Hover overlay with zoom icon */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-full p-3">
                    <FontAwesomeIcon icon={faSearchPlus} className="text-white text-lg" />
                  </div>
                </div>
              </button>
              {/* Image lightbox */}
              {showLightbox && (
                <ImageLightbox
                  imageUrl={imageUrl}
                  alt={`Illustration for ${item.title}`}
                  onClose={() => setShowLightbox(false)}
                />
              )}
            </>
          )}

          {/* Main explanation */}
          <div className="learning-prose">
            <ReactMarkdown>{content.explanation}</ReactMarkdown>
          </div>

          {/* Examples */}
          {content.examples && content.examples.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-slate-900 dark:text-white font-medium flex items-center gap-2">
                <FontAwesomeIcon icon={faCode} className="text-green-500 dark:text-green-400" />
                Examples
              </h4>
              {content.examples.map((example, i) => (
                <div key={i} className="bg-slate-100 dark:bg-white/5 rounded-lg p-4">
                  <h5 className="text-slate-900 dark:text-white font-medium mb-2">{example.title}</h5>
                  <p className="text-slate-600 dark:text-gray-400 text-sm mb-3">{example.description}</p>
                  {example.code && (
                    <SyntaxHighlighter
                      language={detectLanguage(example.code)}
                      style={oneDark}
                      customStyle={{
                        margin: 0,
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        padding: '1rem',
                      }}
                      showLineNumbers={example.code.split('\n').length > 3}
                    >
                      {example.code}
                    </SyntaxHighlighter>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Practice prompt - clickable to open Ember chat */}
          {content.practicePrompt && (
            <button
              onClick={handleOpenChat}
              className="w-full text-left bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 hover:bg-emerald-500/20 hover:border-emerald-400/50 transition-all group"
            >
              <h4 className="text-emerald-400 font-medium mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faGamepad} />
                  Try It Yourself
                </span>
                <span className="flex items-center gap-1.5 text-xs text-emerald-500/70 dark:text-emerald-400/70 group-hover:text-emerald-600 dark:group-hover:text-emerald-300">
                  <FontAwesomeIcon icon={faComments} />
                  Ask Sage
                </span>
              </h4>
              <p className="text-slate-600 dark:text-gray-300 text-sm">{content.practicePrompt}</p>
            </button>
          )}

          {/* Mermaid diagram */}
          {content.mermaidDiagram && (
            <div className="bg-slate-100 dark:bg-white/5 rounded-lg p-4">
              <h4 className="text-slate-900 dark:text-white font-medium mb-3 flex items-center gap-2">
                <FontAwesomeIcon icon={faSignal} className="text-purple-500 dark:text-purple-400" />
                Diagram
              </h4>
              <MermaidDiagram
                code={content.mermaidDiagram}
                className="[&_svg]:max-w-full [&_svg]:h-auto"
              />
            </div>
          )}

          {/* Rating section */}
          <div className="border-t border-slate-200 dark:border-white/10 pt-4 mt-4">
            <div className="flex items-center justify-between">
              <p className="text-slate-600 dark:text-gray-400 text-sm">Was this lesson helpful?</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRating('helpful')}
                  disabled={isRating}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    userRating === 'helpful'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-gray-300 hover:bg-emerald-500/20 hover:text-emerald-600 dark:hover:text-emerald-400'
                  } ${isRating ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <FontAwesomeIcon icon={faThumbsUp} />
                  Helpful
                </button>
                <button
                  onClick={() => handleRating('not_helpful')}
                  disabled={isRating}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    userRating === 'not_helpful'
                      ? 'bg-red-500 text-white'
                      : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-gray-300 hover:bg-red-500/20 hover:text-red-600 dark:hover:text-red-400'
                  } ${isRating ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <FontAwesomeIcon icon={faThumbsDown} />
                  Not Helpful
                </button>
              </div>
            </div>
            {userRating && (
              <p className="text-emerald-600 dark:text-emerald-400 text-xs mt-2">
                Thanks for your feedback!
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Curriculum item card component
 */
interface CurriculumItemCardProps {
  item: CurriculumItem;
  index: number;
  pathSlug?: string;
  onOpenChat?: (context: LessonContext) => void;
}

function CurriculumItemCard({ item, index, pathSlug, onOpenChat }: CurriculumItemCardProps) {
  // Use AILessonCard for AI-generated lessons
  if (item.type === 'ai_lesson') {
    return <AILessonCard item={item} index={index} pathSlug={pathSlug} onOpenChat={onOpenChat} />;
  }

  // Use ToolItemCard for expandable tool info
  if (item.type === 'tool' && item.toolSlug) {
    return <ToolItemCard item={item} index={index} />;
  }

  // Use GameItemCard for inline games
  if (item.type === 'game' && item.gameSlug) {
    return <GameItemCard item={item} index={index} />;
  }

  // Use RelatedProjectsCard for community projects section
  if (item.type === 'related_projects') {
    return <RelatedProjectsCard item={item} index={index} />;
  }

  const icon = getTypeIcon(item.type);
  const label = getTypeLabel(item.type);
  const colorClasses = getTypeColor(item.type);

  // Determine the link URL
  let linkUrl = item.url;
  if (!linkUrl) {
    if (item.toolSlug) {
      linkUrl = `/tools/${item.toolSlug}`;
    } else if (item.quizId) {
      linkUrl = `/quizzes/${item.quizId}`;
    } else if (item.gameSlug) {
      linkUrl = `/play/${item.gameSlug}`;
    }
  }

  const content = (
    <div className="glass-strong p-4 rounded hover:bg-slate-50 dark:hover:bg-white/10 transition-colors group">
      <div className="flex items-start gap-4">
        {/* Order number */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-white/70">
          {index + 1}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${colorClasses}`}>
              <FontAwesomeIcon icon={icon} className="text-[10px]" />
              {label}
            </span>
          </div>
          <h3 className="text-slate-900 dark:text-white font-medium group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-2">
            {item.title}
          </h3>
        </div>

        {/* External link indicator */}
        {linkUrl && (
          <FontAwesomeIcon
            icon={faExternalLinkAlt}
            className="text-slate-400 dark:text-white/30 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex-shrink-0"
          />
        )}
      </div>
    </div>
  );

  if (linkUrl) {
    // Check if it's an external URL
    if (linkUrl.startsWith('http')) {
      return (
        <a href={linkUrl} target="_blank" rel="noopener noreferrer">
          {content}
        </a>
      );
    }
    return <Link to={linkUrl}>{content}</Link>;
  }

  return content;
}

/**
 * Not found state
 */
function NotFoundState() {
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
          <FontAwesomeIcon icon={faGraduationCap} className="text-3xl text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Learning Path Not Found</h2>
        <p className="text-slate-600 dark:text-gray-400 mb-6">
          This learning path doesn't exist or you don't have access to it.
        </p>
        <Link
          to="/learn"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
        >
          <FontAwesomeIcon icon={faArrowLeft} />
          Go to Learn
        </Link>
      </div>
    </div>
  );
}

/**
 * Loading state
 */
function LoadingState() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500" />
    </div>
  );
}

/**
 * Main learning path detail page
 */
export default function LearningPathDetailPage() {
  const { username, slug } = useParams<{ username: string; slug: string }>();
  const { data: path, isLoading, error } = useLearningPathBySlug(username || '', slug || '');
  const { user } = useAuth();

  // Chat panel state - visible on right side (desktop), bottom sheet (mobile)
  const [currentLessonContext, setCurrentLessonContext] = useState<LessonContext | null>(null);

  // Generate conversation ID for this learning path
  const conversationId = `learn-${slug}-${user?.id || 'anon'}`;

  // Handle updating lesson context when user clicks "Try It Yourself"
  const handleOpenChat = (context: LessonContext) => {
    setCurrentLessonContext(context);
  };

  return (
    <DashboardLayout hideFooter>
      {() => (
        /* Fixed viewport height container - accounts for top nav (4rem) */
        <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
          {isLoading ? (
            <LoadingState />
          ) : error || !path ? (
            <NotFoundState />
          ) : (
            <>
              {/* Header - compact, with cover image background */}
              <header className="relative border-b border-white/10 flex-shrink-0 overflow-hidden">
                {/* Cover image background */}
                {path.coverImage ? (
                  <>
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${path.coverImage})` }}
                    />
                    {/* Dark gradient overlay for readability */}
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-900/95 via-slate-900/85 to-slate-900/70" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent" />
                  </>
                ) : (
                  <>
                    {/* Fallback gradient background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-800" />
                    <div className="absolute top-1/2 left-1/4 -translate-x-1/4 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
                    <div className="absolute top-1/4 right-1/4 w-[400px] h-[300px] rounded-full bg-purple-500/5 blur-[100px] pointer-events-none" />
                  </>
                )}

                <div className="relative px-4 sm:px-6 lg:px-8 py-4 max-w-4xl">
                    {/* Back link - over cover image */}
                    <Link
                      to="/learn"
                      className="inline-flex items-center gap-2 text-gray-300 hover:text-white transition-colors mb-3 text-sm"
                    >
                      <FontAwesomeIcon icon={faArrowLeft} />
                      Back to Learn
                    </Link>

                    {/* Title - stays white because it's over a cover image */}
                    <h1 className="text-2xl font-bold text-white mb-2">{path.title}</h1>

                    {/* Meta info - over cover image */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-300">
                      <div className="flex items-center gap-1.5">
                        <FontAwesomeIcon icon={faClock} className="text-[10px]" />
                        <span>{path.estimatedHours}h</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <FontAwesomeIcon icon={faSignal} className="text-[10px]" />
                        <span className="capitalize">{path.difficulty}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <FontAwesomeIcon icon={faGraduationCap} className="text-[10px]" />
                        <span>{path.curriculum?.length ?? 0} items</span>
                      </div>
                      {/* Topics covered - inline (over cover image) */}
                      {(path.topicsCovered?.length ?? 0) > 0 && (
                        <>
                          <span className="text-gray-400">•</span>
                          {path.topicsCovered?.slice(0, 3).map((topic: string) => (
                            <span
                              key={topic}
                              className="px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 text-xs"
                            >
                              {topic.replace(/-/g, ' ')}
                            </span>
                          ))}
                          {(path.topicsCovered?.length ?? 0) > 3 && (
                            <span className="text-gray-400">+{(path.topicsCovered?.length ?? 0) - 3} more</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </header>

              {/* Split-pane: Curriculum left, Chat right - fixed height with inner scroll */}
              <div className="flex-1 flex min-h-0 overflow-hidden">
                {/* LEFT: Curriculum (scrollable) */}
                <div className="flex-1 overflow-y-auto min-h-0">
                  <div className="px-4 sm:px-6 py-4">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Curriculum</h2>
                    <div className="space-y-3">
                      {path.curriculum?.map((item, index) => (
                        <CurriculumItemCard
                          key={`${item.type}-${item.order}`}
                          item={item}
                          index={index}
                          pathSlug={slug}
                          onOpenChat={handleOpenChat}
                        />
                      ))}
                    </div>

                    {(path.curriculum?.length ?? 0) === 0 && (
                      <div className="text-center py-12 text-slate-500 dark:text-gray-400">
                        <p>No curriculum items found in this learning path.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT: Sage Chat Panel (desktop only - hidden on mobile) */}
                <div className="hidden lg:flex w-[480px] border-l border-slate-200 dark:border-white/10 flex-shrink-0 h-full min-h-0 flex-col">
                  <LearningChatPanel
                    context={currentLessonContext}
                    pathTitle={path.title}
                    pathSlug={slug || ''}
                  />
                </div>
              </div>

              {/* Mobile: Sage bottom sheet */}
              <MobileSageBottomSheet
                conversationId={conversationId}
                context="lesson"
                lessonContext={currentLessonContext}
                pathTitle={path.title}
                pathSlug={slug || ''}
              />
            </>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
