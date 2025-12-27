/**
 * LearningSectionCard - Section display with inline editing and collapsible children
 *
 * This component displays a learning section with:
 * - Inline editable title and description
 * - Collapsible children (topics and nested sections)
 * - Progress bar aggregated from child topics
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import type { LearningSection, TopicSectionData } from '@/types/learningSections';
import { isLearningSection, isTopicRef } from '@/types/learningSections';
import type { TopicProgressMap } from '@/utils/learningSectionProgress';
import {
  calculateSectionProgress,
  calculateSectionEstimatedTime,
} from '@/utils/learningSectionProgress';
import { useLearningSectionEditor } from '@/context/LearningSectionEditorContext';
import { TopicCard } from './TopicCard';

interface LearningSectionCardProps {
  section: LearningSection;
  topicMap: Record<string, TopicSectionData>;
  topicProgressMap: TopicProgressMap;
  depth?: number;
}

export function LearningSectionCard({
  section,
  topicMap,
  topicProgressMap,
  depth = 0,
}: LearningSectionCardProps) {
  const { isEditing, updateSection, toggleCollapse } = useLearningSectionEditor();

  // Local state for inline editing (to avoid autosave on each keystroke)
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [localTitle, setLocalTitle] = useState(section.title);
  const [localDescription, setLocalDescription] = useState(section.description);

  // Calculate progress for this section
  const progress = useMemo(
    () => calculateSectionProgress(section, topicProgressMap),
    [section, topicProgressMap]
  );

  // Calculate estimated time
  const estimatedMinutes = useMemo(
    () => calculateSectionEstimatedTime(section, topicMap),
    [section, topicMap]
  );

  // Format estimated time
  const formattedTime = useMemo(() => {
    if (estimatedMinutes < 60) {
      return `${estimatedMinutes} min`;
    }
    const hours = Math.floor(estimatedMinutes / 60);
    const mins = estimatedMinutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }, [estimatedMinutes]);

  // Handle title save on blur
  const handleTitleBlur = () => {
    if (localTitle !== section.title) {
      updateSection(section.id, { title: localTitle });
    }
    setIsEditingTitle(false);
  };

  // Handle description save on blur
  const handleDescriptionBlur = () => {
    if (localDescription !== section.description) {
      updateSection(section.id, { description: localDescription });
    }
    setIsEditingDescription(false);
  };

  // Section color based on depth
  const borderColor = depth === 0 ? 'border-cyan-500/30' : 'border-blue-500/30';
  const bgColor = depth === 0 ? 'bg-gray-900/50' : 'bg-gray-800/30';

  return (
    <div
      className={`rounded-xl overflow-hidden border ${borderColor} ${bgColor} backdrop-blur-sm`}
    >
      {/* Header */}
      <div className="p-4 flex items-center gap-4">
        {/* Collapse Toggle */}
        <button
          onClick={() => toggleCollapse(section.id)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-cyan-400 hover:bg-gray-800/50 transition-colors"
        >
          {section.isCollapsed ? (
            <ChevronRightIcon className="w-5 h-5" />
          ) : (
            <ChevronDownIcon className="w-5 h-5" />
          )}
        </button>

        {/* Title */}
        <div className="flex-1 min-w-0">
          {isEditingTitle && isEditing ? (
            <input
              type="text"
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className="w-full bg-transparent border-b-2 border-cyan-500 text-white font-semibold text-lg focus:outline-none"
              autoFocus
            />
          ) : (
            <h3
              onClick={() => isEditing && setIsEditingTitle(true)}
              className={`text-lg font-semibold text-white truncate ${
                isEditing ? 'cursor-text hover:text-cyan-300' : ''
              }`}
            >
              {section.title || 'Untitled Section'}
            </h3>
          )}

          {/* Description (editable) */}
          {(section.description || isEditing) && (
            <>
              {isEditingDescription && isEditing ? (
                <input
                  type="text"
                  value={localDescription}
                  onChange={(e) => setLocalDescription(e.target.value)}
                  onBlur={handleDescriptionBlur}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  placeholder="Add a description..."
                  className="w-full bg-transparent border-b border-gray-600 text-gray-400 text-sm focus:outline-none focus:border-cyan-500 mt-1"
                  autoFocus
                />
              ) : (
                <p
                  onClick={() => isEditing && setIsEditingDescription(true)}
                  className={`text-sm text-gray-400 truncate mt-1 ${
                    isEditing ? 'cursor-text hover:text-gray-300' : ''
                  }`}
                >
                  {section.description || (isEditing ? 'Add a description...' : '')}
                </p>
              )}
            </>
          )}
        </div>

        {/* Estimated Time */}
        {estimatedMinutes > 0 && (
          <div className="flex items-center gap-1.5 text-gray-400 text-sm">
            <ClockIcon className="w-4 h-4" />
            <span>{formattedTime}</span>
          </div>
        )}

        {/* Progress Bar */}
        {progress.total > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
            <span className="text-sm text-gray-400">
              {progress.percentage}%
            </span>
          </div>
        )}
      </div>

      {/* Collapsible Children */}
      <AnimatePresence initial={false}>
        {!section.isCollapsed && section.children.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {section.children.map((child) => {
                if (isLearningSection(child)) {
                  // Nested section (max depth = 1 more level)
                  return (
                    <LearningSectionCard
                      key={child.id}
                      section={child}
                      topicMap={topicMap}
                      topicProgressMap={topicProgressMap}
                      depth={depth + 1}
                    />
                  );
                }

                if (isTopicRef(child)) {
                  // Topic reference - look up in topicMap
                  const topic = topicMap[child.topicSlug];
                  if (!topic) {
                    // Topic was deleted or doesn't exist, skip rendering
                    return null;
                  }
                  return (
                    <TopicCard
                      key={child.topicSlug}
                      topic={topic}
                      progress={topicProgressMap[child.topicSlug]}
                    />
                  );
                }

                return null;
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {!section.isCollapsed && section.children.length === 0 && (
        <div className="px-4 pb-4">
          <div className="py-8 text-center text-gray-500 border-2 border-dashed border-gray-700 rounded-lg">
            <p className="text-sm">
              {isEditing
                ? 'Drag topics here to add them to this section'
                : 'No topics in this section yet'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
