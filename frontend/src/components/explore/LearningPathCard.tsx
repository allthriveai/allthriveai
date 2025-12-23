/**
 * Learning Path Card for Explore Feed
 *
 * Displays a published learning path in the explore masonry grid.
 * Opens a preview tray when clicked instead of navigating directly.
 */
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock, faSignal, faGraduationCap, faUser } from '@fortawesome/free-solid-svg-icons';
import { useLearningPathPreviewTraySafe } from '@/context/LearningPathPreviewTrayContext';
import type { PublicLearningPath } from '@/services/learningPaths';

interface LearningPathCardProps {
  learningPath: PublicLearningPath;
}

export function LearningPathCard({ learningPath }: LearningPathCardProps) {
  const previewContext = useLearningPathPreviewTraySafe();
  const openPreview = previewContext?.openLearningPathPreview;

  const {
    title,
    difficulty,
    estimatedHours,
    coverImage,
    curriculumCount,
    topicsCovered,
    userFullName,
    userAvatarUrl,
  } = learningPath;

  const handleClick = (e: React.MouseEvent) => {
    if (openPreview) {
      e.preventDefault();
      openPreview(learningPath);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="group block w-full text-left bg-white dark:bg-gray-800 rounded overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100 dark:border-gray-700"
    >
      {/* Cover image */}
      {coverImage ? (
        <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
          <img
            src={coverImage}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {/* Type badge overlay */}
          <div className="absolute top-2 left-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-black/50 backdrop-blur-sm text-white text-xs font-medium">
              <FontAwesomeIcon icon={faGraduationCap} className="text-emerald-400" />
              Learning Path
            </span>
          </div>
        </div>
      ) : (
        <div className="aspect-video bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center relative">
          <FontAwesomeIcon icon={faGraduationCap} className="text-4xl text-emerald-500/50" />
          {/* Type badge overlay */}
          <div className="absolute top-2 left-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-black/50 backdrop-blur-sm text-white text-xs font-medium">
              <FontAwesomeIcon icon={faGraduationCap} className="text-emerald-400" />
              Learning Path
            </span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {/* Title */}
        <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2 mb-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
          {title}
        </h3>

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-3">
          <div className="flex items-center gap-1">
            <FontAwesomeIcon icon={faClock} className="text-[10px]" />
            <span>{estimatedHours}h</span>
          </div>
          <div className="flex items-center gap-1">
            <FontAwesomeIcon icon={faSignal} className="text-[10px]" />
            <span className="capitalize">{difficulty}</span>
          </div>
          <div className="flex items-center gap-1">
            <FontAwesomeIcon icon={faGraduationCap} className="text-[10px]" />
            <span>{curriculumCount} items</span>
          </div>
        </div>

        {/* Topics */}
        {topicsCovered && topicsCovered.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {topicsCovered.slice(0, 3).map((topic) => (
              <span
                key={topic}
                className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs"
              >
                {topic.replace(/-/g, ' ')}
              </span>
            ))}
            {topicsCovered.length > 3 && (
              <span className="px-2 py-0.5 text-gray-400 text-xs">
                +{topicsCovered.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Author */}
        <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
          {userAvatarUrl ? (
            <img
              src={userAvatarUrl}
              alt={userFullName}
              className="w-6 h-6 rounded-full object-cover"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
              <FontAwesomeIcon icon={faUser} className="text-xs text-gray-400" />
            </div>
          )}
          <span className="text-sm text-gray-600 dark:text-gray-400 truncate">
            {userFullName}
          </span>
        </div>
      </div>
    </button>
  );
}
