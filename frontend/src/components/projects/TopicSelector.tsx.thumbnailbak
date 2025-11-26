import { TOPICS } from '@/config/topics';
import type { TopicSlug } from '@/config/topics';

interface TopicSelectorProps {
  selectedTopic?: TopicSlug;
  selectedTopics?: TopicSlug[];
  onChange?: (topic: TopicSlug | undefined) => void;
  onMultiChange?: (topics: TopicSlug[]) => void;
  disabled?: boolean;
  multiSelect?: boolean;
}

const COLOR_CLASSES: Record<string, string> = {
  blue: 'bg-blue-500',
  teal: 'bg-teal-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  amber: 'bg-amber-500',
  pink: 'bg-pink-500',
  indigo: 'bg-indigo-500',
  emerald: 'bg-emerald-500',
  cyan: 'bg-cyan-500',
  lime: 'bg-lime-500',
  violet: 'bg-violet-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
  slate: 'bg-slate-500',
  fuchsia: 'bg-fuchsia-500',
};

export function TopicSelector({
  selectedTopic,
  selectedTopics = [],
  onChange,
  onMultiChange,
  disabled,
  multiSelect = false
}: TopicSelectorProps) {
  const handleClick = (topicSlug: TopicSlug) => {
    if (multiSelect && onMultiChange) {
      if (selectedTopics.includes(topicSlug)) {
        onMultiChange(selectedTopics.filter(t => t !== topicSlug));
      } else {
        onMultiChange([...selectedTopics, topicSlug]);
      }
    } else if (onChange) {
      onChange(selectedTopic === topicSlug ? undefined : topicSlug);
    }
  };

  const isSelected = (topicSlug: TopicSlug) => {
    return multiSelect ? selectedTopics.includes(topicSlug) : selectedTopic === topicSlug;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {TOPICS.map(topic => {
        const selected = isSelected(topic.slug);
        const colorClass = COLOR_CLASSES[topic.color] || 'bg-gray-500';

        return (
          <button
            key={topic.slug}
            type="button"
            onClick={() => handleClick(topic.slug)}
            disabled={disabled}
            className={`text-left p-4 rounded-lg border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              selected
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 shadow-sm'
                : 'border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-600 text-gray-800 dark:text-gray-200 hover:shadow-sm'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-4 h-4 rounded-full mt-0.5 flex-shrink-0 ${colorClass} ${!selected ? 'opacity-60' : ''}`}
              />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm mb-1 leading-tight">{topic.label}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
                  {topic.description}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
