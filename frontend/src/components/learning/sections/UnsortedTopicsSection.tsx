/**
 * UnsortedTopicsSection - Shows topics not yet organized into any section
 *
 * Displayed in edit mode to help users see which topics still need organizing.
 */

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import type { TopicSectionData } from '@/types/learningSections';
import { TopicCard } from './TopicCard';

interface UnsortedTopicsSectionProps {
  topics: TopicSectionData[];
}

export function UnsortedTopicsSection({ topics }: UnsortedTopicsSectionProps) {
  if (topics.length === 0) return null;

  return (
    <div className="mt-8 p-4 rounded-xl border-2 border-dashed border-yellow-500/30 bg-yellow-500/5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />
        <h3 className="text-lg font-medium text-yellow-500">
          Unsorted Topics
        </h3>
        <span className="text-sm text-gray-400">
          ({topics.length} topic{topics.length !== 1 ? 's' : ''})
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-400 mb-4">
        These topics are not in any section. Drag them into a section above to organize your learning path.
      </p>

      {/* Topics List */}
      <div className="space-y-2">
        {topics.map((topic) => (
          <TopicCard key={topic.slug} topic={topic} />
        ))}
      </div>
    </div>
  );
}
