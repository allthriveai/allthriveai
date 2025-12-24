/**
 * Lesson Card for Explore Feed
 *
 * Displays an individual AI-generated lesson in the explore masonry grid.
 * Opens a preview tray when clicked instead of navigating directly.
 */
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock, faSignal, faLightbulb, faUser, faGraduationCap } from '@fortawesome/free-solid-svg-icons';
import { useLessonPreviewTraySafe } from '@/context/LessonPreviewTrayContext';
import type { PublicLesson } from '@/services/learningPaths';

interface LessonCardProps {
  lesson: PublicLesson;
}

export function LessonCard({ lesson }: LessonCardProps) {
  const previewContext = useLessonPreviewTraySafe();
  const openPreview = previewContext?.openLessonPreview;

  const {
    title,
    summary,
    imageUrl,
    difficulty,
    estimatedMinutes,
    lessonType,
    pathTitle,
    userFullName,
    userAvatarUrl,
  } = lesson;

  const handleClick = (e: React.MouseEvent) => {
    if (openPreview) {
      e.preventDefault();
      openPreview(lesson);
    }
  };

  // Format lesson type for display
  const formatLessonType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <button
      onClick={handleClick}
      className="group block w-full text-left bg-white dark:bg-gray-800 rounded overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100 dark:border-gray-700"
    >
      {/* Cover image */}
      {imageUrl ? (
        <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-amber-500/20 to-orange-500/20">
          <img
            src={imageUrl}
            alt={title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {/* Type badge overlay */}
          <div className="absolute top-2 left-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-black/50 backdrop-blur-sm text-white text-xs font-medium">
              <FontAwesomeIcon icon={faLightbulb} className="text-amber-400" />
              {formatLessonType(lessonType)}
            </span>
          </div>
        </div>
      ) : (
        <div className="aspect-video bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center relative">
          <FontAwesomeIcon icon={faLightbulb} className="text-4xl text-amber-500/50" />
          {/* Type badge overlay */}
          <div className="absolute top-2 left-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-black/50 backdrop-blur-sm text-white text-xs font-medium">
              <FontAwesomeIcon icon={faLightbulb} className="text-amber-400" />
              {formatLessonType(lessonType)}
            </span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {/* Title */}
        <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2 mb-2 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
          {title}
        </h3>

        {/* Summary */}
        {summary && (
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
            {summary}
          </p>
        )}

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-3">
          <div className="flex items-center gap-1">
            <FontAwesomeIcon icon={faClock} className="text-[10px]" />
            <span>{estimatedMinutes} min</span>
          </div>
          <div className="flex items-center gap-1">
            <FontAwesomeIcon icon={faSignal} className="text-[10px]" />
            <span className="capitalize">{difficulty}</span>
          </div>
        </div>

        {/* Parent learning path */}
        <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 mb-3">
          <FontAwesomeIcon icon={faGraduationCap} className="text-[10px]" />
          <span className="truncate">from {pathTitle}</span>
        </div>

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
