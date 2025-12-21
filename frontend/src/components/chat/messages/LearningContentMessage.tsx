/**
 * LearningContentMessage - Displays learning content cards in chat
 *
 * Features:
 * - Beautiful teaser cards with featured images
 * - Author avatar overlay with glow effect
 * - Supports projects, videos, quizzes, and lessons
 * - Horizontal scrolling carousel for multiple items
 * - Neon glass styling to match chat aesthetic
 */

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDragon } from '@fortawesome/free-solid-svg-icons';
import type { LearningContentItem } from '@/hooks/useIntelligentChat';
import { LearningTeaserCard } from '../cards';

interface LearningContentMessageProps {
  topicDisplay: string;
  contentType: string;
  items: LearningContentItem[];
  hasContent: boolean;
  message?: string;
  onNavigate?: (path: string) => void;
  /** Source type determines layout - 'trending' uses compact grid */
  sourceType?: string;
}

export function LearningContentMessage({
  topicDisplay,
  contentType,
  items,
  hasContent,
  message,
  onNavigate,
  sourceType,
}: LearningContentMessageProps) {
  // Always use compact grid for learning content (projects, videos, quizzes)
  const useCompactGrid = true;

  if (!hasContent && message) {
    // AI fallback message - just show the message
    return (
      <div className="flex justify-start">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500/20 to-amber-600/20 flex items-center justify-center flex-shrink-0 mr-4">
          <FontAwesomeIcon icon={faDragon} className="w-6 h-6 text-orange-400" />
        </div>
        <div className="flex-1 glass-subtle px-5 py-4 rounded-2xl rounded-bl-sm">
          <p className="text-slate-200">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start w-full">
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500/20 to-amber-600/20 flex items-center justify-center flex-shrink-0 mr-4">
        <FontAwesomeIcon icon={faDragon} className="w-6 h-6 text-orange-400" />
      </div>
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="glass-subtle px-5 py-3 rounded-2xl rounded-bl-sm mb-3">
          <p className="text-slate-200">
            {sourceType === 'trending' ? (
              <>Here's what's <span className="text-cyan-400 font-medium">trending</span> in the community:</>
            ) : sourceType === 'personalized' ? (
              <>Based on your preferences, here are some <span className="text-cyan-400 font-medium">projects you might like</span>:</>
            ) : (
              <>Here are some <span className="text-cyan-400 font-medium">{topicDisplay}</span> resources for you:</>
            )}
          </p>
        </div>

        {/* Compact grid for trending, horizontal scroll for others */}
        {useCompactGrid ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {items.map((item) => (
              <LearningTeaserCard
                key={item.id}
                item={item}
                contentType={contentType}
                onNavigate={onNavigate}
                compact
              />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto pb-2 -mx-2 px-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            <div className="flex gap-3">
              {items.map((item) => (
                <LearningTeaserCard
                  key={item.id}
                  item={item}
                  contentType={contentType}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
