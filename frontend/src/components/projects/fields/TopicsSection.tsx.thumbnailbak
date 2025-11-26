/**
 * TopicsSection - Reusable topics dropdown selector
 * Part of the scalable ProjectFieldsEditor system
 */

import { TopicDropdown } from '../TopicDropdown';
import type { Taxonomy } from '@/types/models';

interface TopicsSectionProps {
  projectTopics: number[];
  availableTopics: Taxonomy[];
  setProjectTopics: (topics: number[]) => void;
  isSaving?: boolean;
}

export function TopicsSection({
  projectTopics,
  availableTopics,
  setProjectTopics,
  isSaving = false,
}: TopicsSectionProps) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
        Topics
      </label>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        Select one or more topics. The first topic selected will be your primary topic in Explore.
      </p>
      <TopicDropdown
        selectedTopics={projectTopics}
        onChange={setProjectTopics}
        disabled={isSaving}
        availableTopics={availableTopics}
      />
    </div>
  );
}
