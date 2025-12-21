/**
 * Learning Path Detail Page
 *
 * Displays a generated learning path by its slug.
 * Accessed via /learn/:slug
 */
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
} from '@fortawesome/free-solid-svg-icons';
import type { CurriculumItem } from '@/services/learningPaths';

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
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
}

/**
 * Curriculum item card component
 */
function CurriculumItemCard({ item, index }: { item: CurriculumItem; index: number }) {
  const icon = getTypeIcon(item.type);
  const label = getTypeLabel(item.type);
  const colorClasses = getTypeColor(item.type);

  // Determine the link URL
  let linkUrl = item.url;
  if (!linkUrl) {
    if (item.tool_slug) {
      linkUrl = `/tools/${item.tool_slug}`;
    } else if (item.quiz_id) {
      linkUrl = `/quizzes/${item.quiz_id}`;
    } else if (item.game_slug) {
      linkUrl = `/play/${item.game_slug}`;
    }
  }

  const content = (
    <div className="glass-strong p-4 rounded-xl hover:bg-white/10 transition-colors group">
      <div className="flex items-start gap-4">
        {/* Order number */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold text-white/70">
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
          <h3 className="text-white font-medium group-hover:text-cyan-400 transition-colors line-clamp-2">
            {item.title}
          </h3>
        </div>

        {/* External link indicator */}
        {linkUrl && (
          <FontAwesomeIcon
            icon={faExternalLinkAlt}
            className="text-white/30 group-hover:text-cyan-400 transition-colors flex-shrink-0"
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
        <h2 className="text-xl font-bold text-white mb-3">Learning Path Not Found</h2>
        <p className="text-gray-400 mb-6">
          This learning path doesn't exist or you don't have access to it.
        </p>
        <Link
          to="/learn"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
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
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500" />
    </div>
  );
}

/**
 * Main learning path detail page
 */
export default function LearningPathDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: path, isLoading, error } = useLearningPathBySlug(slug || '');

  return (
    <DashboardLayout>
      {() => (
        <div className="h-full overflow-y-auto">
          {isLoading ? (
            <LoadingState />
          ) : error || !path ? (
            <NotFoundState />
          ) : (
            <>
              {/* Header */}
              <header className="relative bg-gradient-to-br from-slate-900 to-slate-800 border-b border-white/10">
                <div className="absolute top-1/2 left-1/4 -translate-x-1/4 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />
                <div className="absolute top-1/4 right-1/4 w-[400px] h-[300px] rounded-full bg-purple-500/5 blur-[100px] pointer-events-none" />

                <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                  {/* Back link */}
                  <Link
                    to="/learn"
                    className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
                  >
                    <FontAwesomeIcon icon={faArrowLeft} />
                    Back to Learn
                  </Link>

                  {/* Title */}
                  <h1 className="text-3xl font-bold text-white mb-4">{path.title}</h1>

                  {/* Meta info */}
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-400">
                      <FontAwesomeIcon icon={faClock} />
                      <span>{path.estimated_hours} hours</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <FontAwesomeIcon icon={faSignal} />
                      <span className="capitalize">{path.difficulty}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <FontAwesomeIcon icon={faGraduationCap} />
                      <span>{path.curriculum.length} items</span>
                    </div>
                  </div>

                  {/* Topics covered */}
                  {path.topics_covered.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {path.topics_covered.map((topic) => (
                        <span
                          key={topic}
                          className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-sm border border-cyan-500/30"
                        >
                          {topic.replace(/-/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </header>

              {/* Curriculum */}
              <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <h2 className="text-xl font-bold text-white mb-6">Curriculum</h2>
                <div className="space-y-3">
                  {path.curriculum.map((item, index) => (
                    <CurriculumItemCard key={`${item.type}-${item.order}`} item={item} index={index} />
                  ))}
                </div>

                {path.curriculum.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    <p>No curriculum items found in this learning path.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
