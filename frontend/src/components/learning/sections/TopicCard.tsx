/**
 * TopicCard - Displays a topic within a learning section
 *
 * Simple topic card showing topic name, progress, and concept count.
 */

import { BookOpenIcon } from '@heroicons/react/24/outline';
import type { TopicSectionData } from '@/types/learningSections';

interface TopicCardProps {
  topic: TopicSectionData;
  progress?: { completed: number; total: number };
}

export function TopicCard({ topic, progress }: TopicCardProps) {
  const percentage = progress && progress.total > 0
    ? Math.round((progress.completed / progress.total) * 100)
    : 0;

  return (
    <div className="flex items-center gap-4 p-3 rounded-lg bg-gray-800/50 border border-gray-700/50 hover:border-cyan-500/30 transition-colors">
      {/* Icon */}
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
        <BookOpenIcon className="w-5 h-5 text-cyan-400" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className="text-white font-medium truncate">{topic.name}</h4>
        {topic.description && (
          <p className="text-sm text-gray-400 truncate">{topic.description}</p>
        )}
        <div className="text-xs text-gray-500 mt-1">
          {topic.concepts.length} concept{topic.concepts.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Progress */}
      {progress && progress.total > 0 && (
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 w-8 text-right">
            {percentage}%
          </span>
        </div>
      )}
    </div>
  );
}
