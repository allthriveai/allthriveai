import { useState } from 'react';
import { FunnelIcon, ChevronDownIcon, ChevronUpIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { WrenchScrewdriverIcon } from '@heroicons/react/24/solid';
import type { Taxonomy } from '@/types/models';
import { getCategoryColorClasses } from '@/utils/categoryColors';

// Constants
const SHOW_MORE_BUTTON_STYLE = 'px-2.5 py-1 text-xs text-teal-600 dark:text-teal-400 hover:underline font-medium';

interface FilterPanelProps {
  topics: Taxonomy[];
  tools: Array<{ id: number; name: string; slug: string; logoUrl?: string }>;
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
                {visibleTopics.map((topic) => {
                  const isSelected = selectedTopics.includes(topic.id);
                  const colorClasses = getCategoryColorClasses(topic.color, isSelected);
                  return (
                    <button
                      key={topic.id}
                      onClick={() => toggleTopic(topic.id)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${colorClasses.background} ${colorClasses.hover}`}
                    >
                      {topic.name}
                    </button>
                  );
                })}
                {topics.length > maxInitialItems && (
                  <button
                    onClick={() => setShowAllTopics(!showAllTopics)}
                    className={SHOW_MORE_BUTTON_STYLE}
                  >
                    {showAllTopics ? '− Less' : `+${topics.length - maxInitialItems}`}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Tools - Circular logos with subtle styling */}
          {tools.length > 0 && (
            <div>
              <div className="flex flex-wrap gap-2">
                {visibleTools.map((tool) => {
                  const isSelected = selectedToolSlugs.includes(tool.slug);
                  return (
                    <button
                      key={tool.slug}
                      onClick={() => toggleTool(tool.slug)}
                      className={`
                        group flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all duration-200 ease-out hover:scale-125 hover:z-10
                        ${
                          isSelected
                            ? 'bg-cyan-100 dark:bg-cyan-900/50 border-cyan-400 dark:border-cyan-600'
                            : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }
                      `}
                      title={tool.name}
                    >
                      {/* Circular logo */}
                      <div className={`
                        w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden bg-white border
                        ${isSelected ? 'border-cyan-400 dark:border-cyan-600' : 'border-gray-200 dark:border-gray-600'}
                      `}>
                        {tool.logoUrl ? (
                          <img
                            src={tool.logoUrl}
                            alt=""
                            className="w-3.5 h-3.5 object-contain"
                          />
                        ) : (
                          <WrenchScrewdriverIcon className="w-2.5 h-2.5 text-gray-400" />
                        )}
                      </div>
                      {/* Tool name */}
                      <span className={`
                        text-xs font-medium truncate max-w-[80px]
                        ${isSelected ? 'text-cyan-700 dark:text-cyan-300' : 'text-gray-600 dark:text-gray-300'}
                      `}>
                        {tool.name}
                      </span>
                    </button>
                  );
                })}
                {tools.length > maxInitialItems && (
                  <button
                    onClick={() => setShowAllTools(!showAllTools)}
                    className={SHOW_MORE_BUTTON_STYLE}
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
