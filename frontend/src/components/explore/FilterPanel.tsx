import { useState } from 'react';
import { FunnelIcon, XMarkIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import type { Topic, TopicSlug } from '@/config/topics';

interface FilterPanelProps {
  topics: Topic[];
  tools: Array<{ id: number; name: string }>;
  selectedTopics: TopicSlug[];
  selectedTools: number[];
  onTopicsChange: (topics: TopicSlug[]) => void;
  onToolsChange: (tools: number[]) => void;
  onClear: () => void;
}

export function FilterPanel({
  topics,
  tools,
  selectedTopics,
  selectedTools,
  onTopicsChange,
  onToolsChange,
  onClear,
}: FilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAllTopics, setShowAllTopics] = useState(false);
  const [showAllTools, setShowAllTools] = useState(false);

  const maxInitialItems = 6;
  const visibleTopics = showAllTopics ? topics : topics.slice(0, maxInitialItems);
  const visibleTools = showAllTools ? tools : tools.slice(0, maxInitialItems);

  const hasFilters = selectedTopics.length > 0 || selectedTools.length > 0;

  const toggleTopic = (topicSlug: TopicSlug) => {
    if (selectedTopics.includes(topicSlug)) {
      onTopicsChange(selectedTopics.filter(t => t !== topicSlug));
    } else {
      onTopicsChange([...selectedTopics, topicSlug]);
    }
  };

  const toggleTool = (toolId: number) => {
    if (selectedTools.includes(toolId)) {
      onToolsChange(selectedTools.filter(t => t !== toolId));
    } else {
      onToolsChange([...selectedTools, toolId]);
    }
  };

  return (
    <div className="glass-subtle rounded-xl border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors rounded-t-xl"
      >
        <div className="flex items-center gap-2">
          <FunnelIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Filters
          </h3>
          {hasFilters && (
            <span className="px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-medium">
              {selectedTopics.length + selectedTools.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasFilters && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Clear all
            </button>
          )}
          {isExpanded ? (
            <ChevronUpIcon className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDownIcon className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Filter Content */}
      {isExpanded && (
        <div className="p-4 pt-0 space-y-6">
          {/* Topics */}
          {topics.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Topics
              </h4>
              <div className="flex flex-wrap gap-2">
                {visibleTopics.map((topic) => (
                  <button
                    key={topic.slug}
                    onClick={() => toggleTopic(topic.slug)}
                    className={`
                      px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                      ${
                        selectedTopics.includes(topic.slug)
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }
                    `}
                  >
                    {topic.label}
                  </button>
                ))}
                {topics.length > maxInitialItems && (
                  <button
                    onClick={() => setShowAllTopics(!showAllTopics)}
                    className="px-3 py-1.5 text-sm text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    {showAllTopics ? 'Show less' : `+${topics.length - maxInitialItems} more`}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Tools */}
          {tools.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Tools
              </h4>
              <div className="flex flex-wrap gap-2">
                {visibleTools.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => toggleTool(tool.id)}
                    className={`
                      px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                      ${
                        selectedTools.includes(tool.id)
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }
                    `}
                  >
                    {tool.name}
                  </button>
                ))}
                {tools.length > maxInitialItems && (
                  <button
                    onClick={() => setShowAllTools(!showAllTools)}
                    className="px-3 py-1.5 text-sm text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    {showAllTools ? 'Show less' : `+${tools.length - maxInitialItems} more`}
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
