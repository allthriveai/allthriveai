/**
 * Learning Path Detail Page
 *
 * Displays a generated learning path by its slug with split-pane layout.
 * Curriculum on left, Ember chat panel on right when active.
 * Accessed via /:username/learn/:slug
 */
import { useState } from 'react';
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
} from '@fortawesome/free-solid-svg-icons';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { MermaidDiagram } from '@/components/projects/shared/MermaidDiagram';
import { ChatGameCard } from '@/components/chat/games/ChatGameCard';
import { GAME_REGISTRY, type PlayableGameType } from '@/components/chat/games/gameRegistry';
import { LearningChatPanel, type LessonContext } from '@/components/learning/LearningChatPanel';
import type { CurriculumItem } from '@/services/learningPaths';

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
        <ChatGameCard gameType={gameType} />
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
  onOpenChat?: (context: LessonContext) => void;
}

function AILessonCard({ item, index, onOpenChat }: AILessonCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const content = item.content;

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

  return (
    <div className="glass-strong rounded overflow-hidden">
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
  onOpenChat?: (context: LessonContext) => void;
}

function CurriculumItemCard({ item, index, onOpenChat }: CurriculumItemCardProps) {
  // Use AILessonCard for AI-generated lessons
  if (item.type === 'ai_lesson') {
    return <AILessonCard item={item} index={index} onOpenChat={onOpenChat} />;
  }

  // Use GameItemCard for inline games
  if (item.type === 'game' && item.gameSlug) {
    return <GameItemCard item={item} index={index} />;
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

  // Chat panel is always visible on the right side
  const [currentLessonContext, setCurrentLessonContext] = useState<LessonContext | null>(null);

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

                {/* RIGHT: Sage Chat Panel (always visible, fixed to viewport height) */}
                <div className="w-[480px] border-l border-slate-200 dark:border-white/10 flex-shrink-0 h-full min-h-0 flex flex-col">
                  <LearningChatPanel
                    context={currentLessonContext}
                    pathTitle={path.title}
                    pathSlug={slug || ''}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
