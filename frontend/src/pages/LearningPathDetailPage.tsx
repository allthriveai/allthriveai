/**
 * Learning Path Detail Page
 *
 * Displays a generated learning path by its slug with split-pane layout.
 * Curriculum on left, Ava chat panel on right when active.
 * Accessed via /:username/learn/:slug
 */
import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { useLearningPathBySlug, useSavedPath, usePublishSavedPath, useUnpublishSavedPath } from '@/hooks/useLearningPaths';
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
  faUsers,
  faThumbsUp,
  faThumbsDown,
  faTimes,
  faSearchPlus,
  faGlobe,
  faLock,
  faSpinner,
  faPlus,
  faCheck,
  faCheckCircle,
  faTrophy,
  faExpand,
  faCompress,
  faSync,
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
import { getLessonImage, rateLesson, getLessonProgress, completeExercise, completeQuiz, regenerateLesson, type CurriculumItem, type RelatedProject, type PathProgress, type AILessonContent } from '@/services/learningPaths';
import { getToolBySlug } from '@/services/tools';
import { getTaxonomyPreferences, type SkillLevel } from '@/services/personalization';
import { InlineAIChat } from '@/components/learning/InlineAIChat';
import { LessonQuiz } from '@/components/learning/LessonQuiz';
import { ExerciseCollection } from '@/components/learning/exercises';
import { getExercises } from '@/services/learningPaths';
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
interface RelatedProjectsCardProps {
  item: CurriculumItem;
  index: number;
  topicsCovered?: string[];
  pathId?: number;
  isAdmin?: boolean;
  onProjectAdded?: () => void;
}

function RelatedProjectsCard({ item, index, topicsCovered = [], pathId, isAdmin, onProjectAdded }: RelatedProjectsCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const projects = item.projects || [];

  // Open Ava with project creation context
  const handleShareProject = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent toggle when clicking button
    // Dispatch custom event to open Ava chat in project mode
    window.dispatchEvent(new CustomEvent('openAddProject'));
  };

  // Admin: Add project by ID
  const handleAdminAddProject = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!pathId) return;

    const projectIdStr = window.prompt('Enter project ID to add:');
    if (!projectIdStr) return;

    const projectId = parseInt(projectIdStr, 10);
    if (isNaN(projectId)) {
      alert('Invalid project ID');
      return;
    }

    setIsAddingProject(true);
    try {
      const { adminAddProjectToPath } = await import('@/services/learningPaths');
      await adminAddProjectToPath(pathId, projectId);
      alert('Project added successfully!');
      onProjectAdded?.();
    } catch (err) {
      alert('Failed to add project: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsAddingProject(false);
    }
  };

  return (
    <div className="glass-strong rounded overflow-hidden">
      {/* Header - clickable to expand/collapse */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-start gap-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-left"
      >
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
            {projects.length > 0 && (
              <span className="text-xs text-slate-500 dark:text-gray-500">
                {projects.length} project{projects.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <h3 className="text-slate-900 dark:text-white font-medium">{item.title}</h3>
          <p className="text-slate-600 dark:text-gray-400 text-sm mt-1">
            {projects.length > 0
              ? `Explore projects from the AllThrive community${topicsCovered.length > 0 ? ` related to ${topicsCovered.slice(0, 2).join(' and ')}` : ''}`
              : 'Be the first to share a project on this topic!'}
          </p>
        </div>

        {/* Expand/collapse indicator */}
        <FontAwesomeIcon
          icon={isExpanded ? faChevronDown : faChevronRight}
          className="text-slate-400 dark:text-gray-400 flex-shrink-0 mt-1"
        />
      </button>

      {/* Expanded content - Projects grid or empty state */}
      {isExpanded && (
        <div className="border-t border-slate-200 dark:border-white/10 p-4">
          {projects.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
              {/* Add Yours button at bottom */}
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  onClick={handleShareProject}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-sm font-medium rounded-lg transition-colors border border-amber-500/30"
                >
                  <FontAwesomeIcon icon={faPlus} className="text-xs" />
                  Add Yours
                </button>
                {isAdmin && pathId && (
                  <button
                    onClick={handleAdminAddProject}
                    disabled={isAddingProject}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 text-sm font-medium rounded-lg transition-colors border border-purple-500/30 disabled:opacity-50"
                  >
                    <FontAwesomeIcon icon={faPlus} className="text-xs" />
                    {isAddingProject ? 'Adding...' : 'Admin: Add by ID'}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <FontAwesomeIcon icon={faUsers} className="text-2xl text-amber-400" />
              </div>
              <p className="text-slate-600 dark:text-gray-400 text-sm mb-4">
                No community projects yet{topicsCovered.length > 0 ? ` for ${topicsCovered.slice(0, 2).join(' or ')}` : ''}.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={handleShareProject}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <FontAwesomeIcon icon={faPlus} className="text-xs" />
                  Share Your Project
                </button>
                {isAdmin && pathId && (
                  <button
                    onClick={handleAdminAddProject}
                    disabled={isAddingProject}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 text-sm font-medium rounded-lg transition-colors border border-purple-500/30 disabled:opacity-50"
                  >
                    <FontAwesomeIcon icon={faPlus} className="text-xs" />
                    {isAddingProject ? 'Adding...' : 'Admin: Add by ID'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Expandable accordion section for lesson content (Exercise, Quiz, Diagram)
 */
interface LessonSectionAccordionProps {
  title: string;
  icon: typeof faCode;
  iconColor: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: string;
}

function LessonSectionAccordion({ title, icon, iconColor, defaultOpen = false, children, badge }: LessonSectionAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-slate-200 dark:border-white/10 rounded overflow-hidden">
      {/* Accordion Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-100 dark:bg-white/5 px-4 py-3 flex items-center justify-between hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FontAwesomeIcon
            icon={isOpen ? faChevronDown : faChevronRight}
            className="text-slate-400 dark:text-gray-500 text-xs w-3"
          />
          <FontAwesomeIcon icon={icon} className={iconColor} />
          <h4 className="text-slate-900 dark:text-white font-semibold">{title}</h4>
          {badge && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-gray-400">
              {badge}
            </span>
          )}
        </div>
        <span className="text-xs text-slate-500 dark:text-gray-500">
          {isOpen ? 'Click to collapse' : 'Click to expand'}
        </span>
      </button>

      {/* Accordion Content */}
      {isOpen && (
        <div className="p-4 border-t border-slate-200 dark:border-white/10">
          {children}
        </div>
      )}
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
  skillLevel: SkillLevel;
  onOpenChat?: (context: LessonContext) => void;
  onExerciseComplete?: (lessonOrder: number, stats: { hintsUsed: number; attempts: number; timeSpentMs: number }) => void;
  onQuizComplete?: (lessonOrder: number, score: number, total: number) => void;
  autoExpand?: boolean;
  cardRef?: (el: HTMLDivElement | null) => void;
  isCompleted?: boolean;
  showCelebration?: boolean;
  onLessonUpdated?: (lessonOrder: number, newContent: AILessonContent, newTitle?: string) => void;
}

function AILessonCard({ item, index, pathSlug, skillLevel, onOpenChat, onExerciseComplete, onQuizComplete, autoExpand, cardRef: externalCardRef, isCompleted, showCelebration, onLessonUpdated }: AILessonCardProps) {
  const [isExpanded, setIsExpanded] = useState(autoExpand ?? false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [userRating, setUserRating] = useState<'helpful' | 'not_helpful' | null>(null);
  const [isRating, setIsRating] = useState(false);
  const [hasStartedLoading, setHasStartedLoading] = useState(false);
  const internalCardRef = useRef<HTMLDivElement>(null);

  // Regeneration state
  const [showRegenerateForm, setShowRegenerateForm] = useState(false);
  const [regenerateFocus, setRegenerateFocus] = useState('');
  const [regenerateReason, setRegenerateReason] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerationError, setRegenerationError] = useState<string | null>(null);

  // Use local state for content and title to allow real-time updates after regeneration
  const [localContent, setLocalContent] = useState(item.content);
  const [localTitle, setLocalTitle] = useState(item.title);
  const content = localContent;
  const title = localTitle;

  // Auto-expand when autoExpand prop changes to true
  useEffect(() => {
    if (autoExpand) {
      setIsExpanded(true);
    }
  }, [autoExpand]);

  // Combined ref callback for both internal and external refs
  const setCardRef = (el: HTMLDivElement | null) => {
    (internalCardRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    if (externalCardRef) {
      externalCardRef(el);
    }
  };

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

    const currentRef = internalCardRef.current;
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
        lessonTitle: title,
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

  // Handle regenerating the entire lesson
  const handleRegenerateLesson = async () => {
    if (!pathSlug) return;

    setIsRegenerating(true);
    setRegenerationError(null);

    try {
      const result = await regenerateLesson(pathSlug, item.order, {
        focus: regenerateFocus || undefined,
        reason: regenerateReason || undefined,
      });

      if (result.success && result.lesson?.content) {
        setLocalContent(result.lesson.content);
        // Update title if a new one was generated
        if (result.lesson.title) {
          setLocalTitle(result.lesson.title);
        }
        // Reset image so it regenerates based on new content
        setImageUrl(null);
        setImageError(false);
        setHasStartedLoading(false);
        onLessonUpdated?.(item.order, result.lesson.content, result.lesson.title);
        setShowRegenerateForm(false);
        setRegenerateFocus('');
        setRegenerateReason('');
      }
    } catch (error) {
      console.error('Failed to regenerate lesson:', error);
      setRegenerationError('Failed to regenerate lesson. Please try again.');
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div ref={setCardRef} className={`glass-strong rounded overflow-hidden ${isCompleted ? 'ring-2 ring-emerald-500/30' : ''}`}>
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-start gap-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-left"
      >
        {/* Order number - show checkmark if completed */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
          isCompleted
            ? 'bg-emerald-500 text-white'
            : 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
        }`}>
          {isCompleted ? <FontAwesomeIcon icon={faCheck} /> : index + 1}
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
            {/* Completed badge */}
            {isCompleted && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                <FontAwesomeIcon icon={faCheckCircle} className="text-[10px]" />
                Completed
              </span>
            )}
          </div>
          <h3 className="text-slate-900 dark:text-white font-medium text-lg mb-2">{title}</h3>
          <p className="text-slate-600 dark:text-gray-400 text-base line-clamp-2">{content.summary}</p>

          {/* Key concepts chips */}
          {content.keyConcepts && content.keyConcepts.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {content.keyConcepts.slice(0, 4).map((concept, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-gray-300 text-sm"
                >
                  {concept}
                </span>
              ))}
              {content.keyConcepts.length > 4 && (
                <span className="px-2.5 py-1 text-slate-500 dark:text-gray-500 text-sm">
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
                  alt={`Illustration for ${title}`}
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
                  alt={`Illustration for ${title}`}
                  onClose={() => setShowLightbox(false)}
                />
              )}
            </>
          )}

          {/* Main explanation */}
          <div className="learning-prose">
            <ReactMarkdown
              components={{
                code({ node: _node, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const codeString = String(children).replace(/\n$/, '');
                  // If it's a fenced code block with language OR looks like code, use SyntaxHighlighter
                  const isCodeBlock = match || (codeString.includes('\n') && !className?.includes('inline'));
                  if (isCodeBlock) {
                    const language = match ? match[1] : detectLanguage(codeString);
                    return (
                      <SyntaxHighlighter
                        language={language}
                        style={oneDark}
                        customStyle={{
                          margin: 0,
                          borderRadius: '0.5rem',
                          fontSize: '0.875rem',
                          padding: '1rem',
                        }}
                        showLineNumbers={codeString.split('\n').length > 3}
                      >
                        {codeString}
                      </SyntaxHighlighter>
                    );
                  }
                  // Inline code
                  return <code className={className} {...props}>{children}</code>;
                },
              }}
            >
              {content.explanation}
            </ReactMarkdown>
          </div>

          {/* Examples - expandable accordion */}
          {content.examples && content.examples.length > 0 && (
            <LessonSectionAccordion
              title="Examples"
              icon={faCode}
              iconColor="text-green-500 dark:text-green-400"
              badge={`${content.examples.length}`}
            >
              <div className="space-y-4">
                {content.examples.map((example, i) => (
                  <div key={i} className="bg-slate-50 dark:bg-white/5 rounded-lg p-4">
                    <h5 className="text-slate-900 dark:text-white font-medium text-lg mb-2">{example.title}</h5>
                    <div className="learning-prose text-slate-600 dark:text-gray-400 text-base mb-3">
                      <ReactMarkdown
                        components={{
                          code({ className, children, ...props }) {
                            const match = /language-(\w+)/.exec(className || '');
                            const codeString = String(children).replace(/\n$/, '');
                            const isCodeBlock = match || (codeString.includes('\n') && !className?.includes('inline'));
                            if (isCodeBlock) {
                              const language = match ? match[1] : detectLanguage(codeString);
                              return (
                                <SyntaxHighlighter
                                  language={language}
                                  style={oneDark}
                                  customStyle={{
                                    margin: 0,
                                    borderRadius: '0.5rem',
                                    fontSize: '0.875rem',
                                    padding: '1rem',
                                  }}
                                  showLineNumbers={codeString.split('\n').length > 3}
                                >
                                  {codeString}
                                </SyntaxHighlighter>
                              );
                            }
                            return <code className={className} {...props}>{children}</code>;
                          },
                        }}
                      >
                        {example.description}
                      </ReactMarkdown>
                    </div>
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
            </LessonSectionAccordion>
          )}

          {/* Exercise Section - expandable accordion with multiple exercises support */}
          {(getExercises(content).length > 0 || content.practicePrompt) && (
            <LessonSectionAccordion
              title="Exercises"
              icon={faCode}
              iconColor="text-emerald-500"
              badge={getExercises(content).length > 0 ? `${getExercises(content).length} exercise${getExercises(content).length > 1 ? 's' : ''}` : 'Practice'}
            >
              {getExercises(content).length > 0 && pathSlug ? (
                /* Multiple exercises with collection UI */
                <ExerciseCollection
                  pathSlug={pathSlug}
                  lessonOrder={item.order}
                  content={content}
                  skillLevel={skillLevel}
                  onExerciseComplete={() => {
                    // Call the lesson completion handler with placeholder stats
                    onExerciseComplete?.(item.order, { hintsUsed: 0, attempts: 1, timeSpentMs: 0 });
                  }}
                  onContentUpdate={(exercises) => {
                    // Update local content with new exercises array
                    setLocalContent(prev => prev ? { ...prev, exercises } : prev);
                  }}
                />
              ) : content.practicePrompt && (
                /* Fallback: convert practicePrompt to inline chat when no exercises */
                <InlineAIChat
                  exercise={{
                    exerciseType: 'ai_prompt',
                    scenario: content.practicePrompt,
                    expectedInputs: ['.*'],
                    successMessage: 'Great work!',
                    expectedOutput: '',
                    contentByLevel: {
                      beginner: { instructions: content.practicePrompt, hints: [] },
                      intermediate: { instructions: content.practicePrompt, hints: [] },
                      advanced: { instructions: content.practicePrompt, hints: [] },
                    },
                  }}
                  skillLevel={skillLevel}
                  lessonId={`lesson-${item.order}`}
                  pathSlug={pathSlug}
                  onAskForHelp={handleOpenChat}
                  onComplete={onExerciseComplete ? (stats) => onExerciseComplete(item.order, stats) : undefined}
                />
              )}
            </LessonSectionAccordion>
          )}

          {/* Inline Quiz - expandable accordion */}
          {content.quiz && (
            <LessonSectionAccordion
              title="Quiz"
              icon={faQuestion}
              iconColor="text-amber-500"
              badge={`${content.quiz.questions?.length || 0} questions`}
            >
              <LessonQuiz
                quiz={content.quiz}
                onComplete={onQuizComplete ? (score, total) => onQuizComplete(item.order, score, total) : undefined}
              />
            </LessonSectionAccordion>
          )}

          {/* Mermaid diagram - expandable accordion */}
          {content.mermaidDiagram && (
            <LessonSectionAccordion
              title="Diagram"
              icon={faSignal}
              iconColor="text-purple-500 dark:text-purple-400"
              badge="Visual"
            >
              <MermaidDiagram
                code={content.mermaidDiagram}
                className="[&_svg]:max-w-full [&_svg]:h-auto"
              />
            </LessonSectionAccordion>
          )}

          {/* Completion celebration - shows when lesson is just completed */}
          {showCelebration && (
            <div className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 rounded-xl p-6 text-center animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                <FontAwesomeIcon icon={faTrophy} className="text-3xl text-emerald-400" />
              </div>
              <h4 className="text-xl font-bold text-emerald-400 mb-2">Lesson Complete!</h4>
              <p className="text-slate-600 dark:text-gray-300">
                Great work! You've completed this lesson. Keep up the momentum!
              </p>
            </div>
          )}

          {/* Static completed banner - shows for already completed lessons */}
          {isCompleted && !showCelebration && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <FontAwesomeIcon icon={faCheckCircle} className="text-lg text-emerald-400" />
              </div>
              <div>
                <p className="text-emerald-400 font-medium">Lesson Completed</p>
                <p className="text-slate-500 dark:text-gray-400 text-sm">You've already completed this lesson.</p>
              </div>
            </div>
          )}

          {/* Rating and regenerate section */}
          <div className="border-t border-slate-200 dark:border-white/10 pt-4 mt-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-slate-600 dark:text-gray-400 text-base">Was this lesson helpful?</p>
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
                {/* Separator */}
                {pathSlug && (
                  <>
                    <div className="w-px h-6 bg-slate-200 dark:bg-white/20 mx-1" />
                    <button
                      onClick={() => setShowRegenerateForm(!showRegenerateForm)}
                      disabled={isRegenerating}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        showRegenerateForm
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-gray-300 hover:bg-blue-500/20 hover:text-blue-600 dark:hover:text-blue-400'
                      } ${isRegenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <FontAwesomeIcon icon={isRegenerating ? faSpinner : faSync} className={isRegenerating ? 'animate-spin' : ''} />
                      {isRegenerating ? 'Regenerating...' : 'Regenerate'}
                    </button>
                  </>
                )}
              </div>
            </div>
            {userRating && (
              <p className="text-emerald-600 dark:text-emerald-400 text-xs mt-2">
                Thanks for your feedback!
              </p>
            )}
            {/* Regenerate form - expands when button is clicked */}
            {showRegenerateForm && pathSlug && (
              <div className="mt-4 p-4 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10">
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                      What would you like to focus on? (optional)
                    </label>
                    <input
                      type="text"
                      value={regenerateFocus}
                      onChange={(e) => setRegenerateFocus(e.target.value)}
                      placeholder="e.g., More hands-on examples, simpler explanations..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/20 bg-white dark:bg-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
                      disabled={isRegenerating}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                      Why are you regenerating? (optional)
                    </label>
                    <input
                      type="text"
                      value={regenerateReason}
                      onChange={(e) => setRegenerateReason(e.target.value)}
                      placeholder="e.g., Too abstract, missing context..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/20 bg-white dark:bg-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
                      disabled={isRegenerating}
                    />
                  </div>
                  {regenerationError && (
                    <p className="text-sm text-red-500 dark:text-red-400">{regenerationError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleRegenerateLesson}
                      disabled={isRegenerating}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isRegenerating ? (
                        <>
                          <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon icon={faSync} />
                          Generate New Lesson
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setShowRegenerateForm(false);
                        setRegenerationError(null);
                      }}
                      disabled={isRegenerating}
                      className="px-4 py-2 text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
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
  pathId?: number;
  isAdmin?: boolean;
  skillLevel: SkillLevel;
  onOpenChat?: (context: LessonContext) => void;
  onProjectAdded?: () => void;
  topicsCovered?: string[];
  onExerciseComplete?: (lessonOrder: number, stats: { hintsUsed: number; attempts: number; timeSpentMs: number }) => void;
  onQuizComplete?: (lessonOrder: number, score: number, total: number) => void;
  isCompleted?: boolean;
  showCelebration?: boolean;
  autoExpand?: boolean;
  cardRef?: (el: HTMLDivElement | null) => void;
}

function CurriculumItemCard({ item, index, pathSlug, pathId, isAdmin, skillLevel, onOpenChat, onProjectAdded, topicsCovered, onExerciseComplete, onQuizComplete, autoExpand, cardRef, isCompleted, showCelebration }: CurriculumItemCardProps) {
  // Use AILessonCard for AI-generated lessons
  if (item.type === 'ai_lesson') {
    return <AILessonCard item={item} index={index} pathSlug={pathSlug} skillLevel={skillLevel} onOpenChat={onOpenChat} onExerciseComplete={onExerciseComplete} onQuizComplete={onQuizComplete} autoExpand={autoExpand} cardRef={cardRef} isCompleted={isCompleted} showCelebration={showCelebration} />;
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
    return <RelatedProjectsCard item={item} index={index} topicsCovered={topicsCovered} pathId={pathId} isAdmin={isAdmin} onProjectAdded={onProjectAdded} />;
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
 * Generate a slug from lesson title (must match backend logic)
 */
function generateLessonSlug(title: string, lessonOrder: number): string {
  const baseSlug = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim()
    .substring(0, 50);

  if (!baseSlug || baseSlug === 'lesson') {
    return `lesson-${lessonOrder}`;
  }
  return baseSlug;
}

/**
 * Main learning path detail page
 */
export default function LearningPathDetailPage() {
  const { username, slug, lessonSlug } = useParams<{ username: string; slug: string; lessonSlug?: string }>();
  const { data: path, isLoading, error, refetch } = useLearningPathBySlug(username || '', slug || '');
  const { user } = useAuth();

  // Track which lesson to auto-expand (from URL param)
  const [targetLessonIndex, setTargetLessonIndex] = useState<number | null>(null);
  const lessonRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Check if current user is the owner of this path
  const isOwner = !!(user && username && user.username === username);

  // Check if current user is admin
  const isAdmin = user?.role === 'admin';

  // Fetch saved path data (has isPublished field) for owner OR admin
  const { data: savedPath } = useSavedPath(slug || '', isOwner || isAdmin);

  // Publish/unpublish mutations
  const publishMutation = usePublishSavedPath();
  const unpublishMutation = useUnpublishSavedPath();

  // Chat panel state - visible on right side (desktop), bottom sheet (mobile)
  const [currentLessonContext, setCurrentLessonContext] = useState<LessonContext | null>(null);

  // User's skill level for adaptive exercises (default to beginner if not set)
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('beginner');

  // Progress tracking state
  const [progressData, setProgressData] = useState<PathProgress | null>(null);
  const [justCompletedLesson, setJustCompletedLesson] = useState<number | null>(null);

  // Fullscreen mode for curriculum
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSagePanelOpen, setIsSagePanelOpen] = useState(false);

  // Auto-dismiss celebration after 5 seconds (with proper cleanup to prevent memory leaks)
  useEffect(() => {
    if (justCompletedLesson !== null) {
      const timer = setTimeout(() => setJustCompletedLesson(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [justCompletedLesson]);

  // Fetch user's skill level from personalization preferences
  useEffect(() => {
    if (user) {
      getTaxonomyPreferences()
        .then((prefs) => {
          if (prefs.skillLevel) {
            setSkillLevel(prefs.skillLevel);
          }
        })
        .catch(() => {
          // Use default skill level on error
        });
    }
  }, [user]);

  // Fetch lesson progress when path loads
  useEffect(() => {
    if (savedPath?.id && user) {
      getLessonProgress(savedPath.id)
        .then(setProgressData)
        .catch(() => {
          // Progress not available - may be viewing someone else's path
        });
    }
  }, [savedPath?.id, user]);

  // Generate conversation ID for this learning path
  const conversationId = `learn-${slug}-${user?.id || 'anon'}`;

  // Find target lesson from URL slug and scroll to it
  useEffect(() => {
    if (!lessonSlug || !path?.curriculum) return;

    // Find the lesson index that matches the slug
    const lessonIndex = path.curriculum.findIndex((item, idx) => {
      if (item.type !== 'ai_lesson') return false;
      const order = item.order ?? idx + 1;
      const itemSlug = generateLessonSlug(item.title || '', order);
      return itemSlug === lessonSlug;
    });

    if (lessonIndex !== -1) {
      setTargetLessonIndex(lessonIndex);

      // Scroll to the lesson after a short delay to allow rendering
      setTimeout(() => {
        const lessonEl = lessonRefs.current.get(lessonIndex);
        if (lessonEl) {
          lessonEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
    }
  }, [lessonSlug, path?.curriculum]);

  // Handle updating lesson context when user clicks "Try It Yourself"
  const handleOpenChat = (context: LessonContext) => {
    setCurrentLessonContext(context);
  };

  // Handle exercise completion - persist to backend and update progress
  const handleExerciseComplete = async (lessonOrder: number, stats: { hintsUsed: number; attempts: number; timeSpentMs: number }) => {
    if (!savedPath?.id) {
      console.log('Exercise completed (not persisted - no saved path):', { lessonOrder, stats });
      return;
    }

    try {
      const result = await completeExercise(savedPath.id, lessonOrder);
      console.log('Exercise completed:', { lessonOrder, stats, result });

      // If this just completed the lesson, trigger celebration (auto-dismissed by useEffect)
      if (result.justCompleted) {
        setJustCompletedLesson(lessonOrder);
      }

      // Update progress data
      setProgressData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          completedLessons: result.overallProgress.completedCount,
          percentage: result.overallProgress.percentage,
          lessons: prev.lessons.map(lesson =>
            lesson.lessonOrder === lessonOrder
              ? { ...lesson, isCompleted: result.isCompleted, exerciseCompleted: result.exerciseCompleted }
              : lesson
          ),
        };
      });
    } catch (error) {
      console.error('Failed to persist exercise completion:', error);
    }
  };

  // Handle quiz completion - persist to backend and update progress
  const handleQuizComplete = async (lessonOrder: number, score: number, total: number) => {
    if (!savedPath?.id) {
      console.log('Quiz completed (not persisted - no saved path):', { lessonOrder, score, total });
      return;
    }

    try {
      const scorePercentage = total > 0 ? score / total : 0;
      const result = await completeQuiz(savedPath.id, lessonOrder, scorePercentage);
      console.log('Quiz completed:', { lessonOrder, score, total, result });

      // If this just completed the lesson, trigger celebration (auto-dismissed by useEffect)
      if (result.justCompleted) {
        setJustCompletedLesson(lessonOrder);
      }

      // Update progress data
      setProgressData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          completedLessons: result.overallProgress.completedCount,
          percentage: result.overallProgress.percentage,
          lessons: prev.lessons.map(lesson =>
            lesson.lessonOrder === lessonOrder
              ? { ...lesson, isCompleted: result.isCompleted, quizCompleted: result.quizCompleted }
              : lesson
          ),
        };
      });
    } catch (error) {
      console.error('Failed to persist quiz completion:', error);
    }
  };

  // Handle publish/unpublish toggle
  const handleTogglePublish = () => {
    if (!slug) return;
    if (savedPath?.isPublished) {
      unpublishMutation.mutate(slug);
    } else {
      publishMutation.mutate(slug);
    }
  };

  const isPublishing = publishMutation.isPending || unpublishMutation.isPending;

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
              {/* Focus Mode Header - minimal bar with title and exit button */}
              {isFullscreen && (
                <div className="flex-shrink-0 bg-slate-900 border-b border-white/10 px-4 sm:px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsFullscreen(false)}
                      className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                      title="Exit Focus Mode"
                    >
                      <FontAwesomeIcon icon={faCompress} />
                    </button>
                    <h1 className="text-lg font-semibold text-white truncate">{path.title}</h1>
                  </div>
                  <div className="flex items-center gap-3">
                    {progressData && progressData.percentage > 0 && (
                      <div className="hidden sm:flex items-center gap-2">
                        <div className="w-32 h-1.5 bg-white/20 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full"
                            style={{ width: `${progressData.percentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-emerald-300">{progressData.percentage}%</span>
                      </div>
                    )}
                    {/* Sage toggle button */}
                    <button
                      onClick={() => setIsSagePanelOpen(!isSagePanelOpen)}
                      className={`hidden lg:flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        isSagePanelOpen
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'text-gray-400 hover:text-white hover:bg-white/10'
                      }`}
                      title={isSagePanelOpen ? 'Close Sage' : 'Ask Sage for help'}
                    >
                      <img src="/sage-avatar.png" alt="Sage" className="w-5 h-5 rounded-full" />
                      <span>Sage</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Header - compact, with cover image background - hidden in focus mode */}
              {!isFullscreen && (
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

                <div className="relative px-4 sm:px-6 lg:px-8 py-4">
                    <div className="max-w-4xl">
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

                      {/* Progress bar - shows when user has made progress */}
                      {progressData && progressData.percentage > 0 && (
                        <div className="flex items-center gap-3 mb-3">
                          <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full transition-all duration-500"
                              style={{ width: `${progressData.percentage}%` }}
                            />
                          </div>
                          <span className="text-xs text-emerald-300 font-medium whitespace-nowrap">
                            {progressData.completedLessons}/{progressData.totalLessons} lessons ({progressData.percentage}%)
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Meta info row with Share button on right - over cover image */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
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
                        {/* Published indicator - for non-owners viewing */}
                        {savedPath?.isPublished && !isOwner && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span className="inline-flex items-center gap-1 text-emerald-400">
                              <FontAwesomeIcon icon={faGlobe} className="text-[10px]" />
                              Shared on Explore
                            </span>
                          </>
                        )}
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

                      {/* Share button - only show for path owner, positioned bottom-right */}
                      {isOwner && savedPath && (
                        <button
                          onClick={handleTogglePublish}
                          disabled={isPublishing}
                          className={`flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            savedPath.isPublished
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                              : 'bg-white/10 text-gray-300 border border-white/20 hover:bg-white/20 hover:text-white'
                          } ${isPublishing ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title={savedPath.isPublished ? 'Remove from Explore' : 'Share with others through Explore'}
                        >
                          {isPublishing ? (
                            <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                          ) : savedPath.isPublished ? (
                            <FontAwesomeIcon icon={faGlobe} />
                          ) : (
                            <FontAwesomeIcon icon={faLock} />
                          )}
                          <span className="hidden sm:inline">
                            {savedPath.isPublished ? 'Shared on Explore' : 'Share on Explore'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </header>
              )}

              {/* Split-pane: Curriculum left, Chat right - fixed height with inner scroll */}
              <div className="flex-1 flex min-h-0 overflow-hidden">
                {/* LEFT: Curriculum (scrollable) - full width in focus mode */}
                <div className="flex-1 overflow-y-auto min-h-0">
                  <div className="px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        {isFullscreen ? 'Lessons' : 'Curriculum'}
                      </h2>
                      {/* Focus Mode button - only show when NOT in focus mode */}
                      {!isFullscreen && (
                        <button
                          onClick={() => setIsFullscreen(true)}
                          className="hidden lg:flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                          title="Enter Focus Mode"
                        >
                          <FontAwesomeIcon icon={faExpand} className="text-xs" />
                          <span>Focus Mode</span>
                        </button>
                      )}
                    </div>
                    <div className="space-y-3">
                      {path.curriculum?.map((item, index) => {
                        // Get progress for this lesson
                        const lessonProgress = progressData?.lessons.find(
                          l => l.lessonOrder === (item.order ?? index + 1)
                        );
                        const showCelebration = justCompletedLesson === (item.order ?? index + 1);

                        return (
                          <CurriculumItemCard
                            key={`${item.type}-${item.order}`}
                            item={item}
                            index={index}
                            pathSlug={slug}
                            pathId={savedPath?.id}
                            isAdmin={isAdmin}
                            skillLevel={skillLevel}
                            onOpenChat={handleOpenChat}
                            onProjectAdded={refetch}
                            topicsCovered={path.topicsCovered}
                            onExerciseComplete={handleExerciseComplete}
                            onQuizComplete={handleQuizComplete}
                            autoExpand={targetLessonIndex === index || showCelebration}
                            cardRef={(el) => {
                              if (el) {
                                lessonRefs.current.set(index, el);
                              } else {
                                lessonRefs.current.delete(index);
                              }
                            }}
                            isCompleted={lessonProgress?.isCompleted || showCelebration}
                            showCelebration={showCelebration}
                          />
                        );
                      })}
                    </div>

                    {(path.curriculum?.length ?? 0) === 0 && (
                      <div className="text-center py-12 text-slate-500 dark:text-gray-400">
                        <p>No curriculum items found in this learning path.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT: Sage Chat Panel - normal mode (always visible on desktop) */}
                {!isFullscreen && (
                  <div className="hidden lg:flex w-[480px] border-l border-slate-200 dark:border-white/10 flex-shrink-0 h-full min-h-0 flex-col">
                    <LearningChatPanel
                      context={currentLessonContext}
                      pathTitle={path.title}
                      pathSlug={slug || ''}
                    />
                  </div>
                )}

                {/* RIGHT: Sage Chat Panel - focus mode (pushes content) */}
                {isFullscreen && (
                  <div
                    className={`hidden lg:flex flex-col border-l border-slate-200 dark:border-white/10 flex-shrink-0 h-full min-h-0 transition-all duration-300 ease-in-out overflow-hidden ${
                      isSagePanelOpen ? 'w-[480px]' : 'w-0 border-l-0'
                    }`}
                  >
                    <div className="w-[480px] h-full flex flex-col">
                      {/* Panel header with close button */}
                      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10 flex-shrink-0">
                        <div className="flex items-center gap-2">
                          <img src="/sage-avatar.png" alt="Sage" className="w-6 h-6 rounded-full" />
                          <span className="font-medium text-slate-900 dark:text-white">Sage</span>
                        </div>
                        <button
                          onClick={() => setIsSagePanelOpen(false)}
                          className="p-2 text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                          title="Close"
                        >
                          <FontAwesomeIcon icon={faTimes} />
                        </button>
                      </div>
                      <div className="flex-1 min-h-0">
                        <LearningChatPanel
                          context={currentLessonContext}
                          pathTitle={path.title}
                          pathSlug={slug || ''}
                        />
                      </div>
                    </div>
                  </div>
                )}
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
