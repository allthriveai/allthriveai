import { useState } from 'react';
import { FunnelIcon, XMarkIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import type { Taxonomy } from '@/types/models';

interface FilterPanelProps {
  topics: Taxonomy[];
  tools: Array<{ id: number; name: string; slug: string }>;
  selectedTopics: number[];
  selectedToolSlugs: string[];
  onTopicsChange: (topics: number[]) => void;
  onToolsChange: (toolSlugs: string[]) => void;
  onClear: () => void;
}

export function FilterPanel({
  topics,
  tools,
  selectedTopics,
  selectedToolSlugs,
  onTopicsChange,
  onToolsChange,
  onClear,
}: FilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false); // Start collapsed
  const [showAllTopics, setShowAllTopics] = useState(false);
  const [showAllTools, setShowAllTools] = useState(false);

  const maxInitialItems = 12; // Show more items initially
  const visibleTopics = showAllTopics ? topics : topics.slice(0, maxInitialItems);
  const visibleTools = showAllTools ? tools : tools.slice(0, maxInitialItems);

  const hasFilters = selectedTopics.length > 0 || selectedToolSlugs.length > 0;

  const toggleTopic = (topicId: number) => {
    if (selectedTopics.includes(topicId)) {
      onTopicsChange(selectedTopics.filter(t => t !== topicId));
    } else {
      onTopicsChange([...selectedTopics, topicId]);
    }
  };

  const toggleTool = (toolSlug: string) => {
    if (selectedToolSlugs.includes(toolSlug)) {
      onToolsChange(selectedToolSlugs.filter(t => t !== toolSlug));
    } else {
      onToolsChange([...selectedToolSlugs, toolSlug]);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      {/* Compact Header */}
      <div className="w-full flex items-center justify-between px-4 py-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <FunnelIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Filters
          </span>
          {hasFilters && (
            <span className="px-1.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-xs font-medium">
              {selectedTopics.length + selectedToolSlugs.length}
            </span>
          )}
          {isExpanded ? (
            <ChevronUpIcon className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {hasFilters && (
          <button
            onClick={onClear}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center gap-1"
          >
            <XMarkIcon className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {/* Compact Filter Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 dark:border-gray-800 pt-3">
          {/* Topics */}
          {topics.length > 0 && (
            <div>
              <div className="flex flex-wrap gap-1.5">
                {visibleTopics.map((topic) => (
                  <button
                    key={topic.id}
                    onClick={() => toggleTopic(topic.id)}
                    className={`
                      px-2.5 py-1 rounded-md text-xs font-medium transition-all
                      ${
                        selectedTopics.includes(topic.id)
                          ? 'bg-teal-500 text-white shadow-sm'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }
                    `}
                  >
                    {topic.name}
                  </button>
                ))}
                {topics.length > maxInitialItems && (
                  <button
                    onClick={() => setShowAllTopics(!showAllTopics)}
                    className="px-2.5 py-1 text-xs text-teal-600 dark:text-teal-400 hover:underline font-medium"
                  >
                    {showAllTopics ? '− Less' : `+${topics.length - maxInitialItems}`}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Tools */}
          {tools.length > 0 && (
            <div>
              <div className="flex flex-wrap gap-1.5">
                {visibleTools.map((tool) => (
                  <button
                    key={tool.slug}
                    onClick={() => toggleTool(tool.slug)}
                    className={`
                      px-2.5 py-1 rounded-md text-xs font-medium transition-all
                      ${
                        selectedToolSlugs.includes(tool.slug)
                          ? 'bg-teal-500 text-white shadow-sm'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }
                    `}
                  >
                    {tool.name}
                  </button>
                ))}
                {tools.length > maxInitialItems && (
                  <button
                    onClick={() => setShowAllTools(!showAllTools)}
                    className="px-2.5 py-1 text-xs text-teal-600 dark:text-teal-400 hover:underline font-medium"
                  >
                    {showAllTools ? '− Less' : `+${tools.length - maxInitialItems}`}
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
