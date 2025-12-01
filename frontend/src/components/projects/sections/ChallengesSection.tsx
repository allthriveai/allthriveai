/**
 * ChallengesSection - Problem/solution cards showcasing problem-solving
 */

import { LightBulbIcon, CheckCircleIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import type { ChallengesSectionContent, Challenge } from '@/types/sections';

interface ChallengesSectionProps {
  content: ChallengesSectionContent;
  isEditing?: boolean;
  onUpdate?: (content: ChallengesSectionContent) => void;
}

function ChallengeCard({ challenge, index }: { challenge: Challenge; index: number }) {
  const { challenge: problem, solution, outcome } = challenge;

  return (
    <div className="relative bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700/50 overflow-hidden hover:shadow-lg transition-all duration-300 group">
      {/* Card Header - Challenge Number */}
      <div className="absolute top-4 right-4">
        <span className="px-3 py-1 text-xs font-bold text-primary-600 dark:text-primary-400 bg-primary-100 dark:bg-primary-900/30 rounded-full">
          #{index + 1}
        </span>
      </div>

      <div className="p-6 md:p-8">
        {/* Challenge */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <span className="text-lg">🔴</span>
            </div>
            <h4 className="text-sm font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
              Challenge
            </h4>
          </div>
          <p className="text-gray-900 dark:text-white font-medium leading-relaxed">
            {problem}
          </p>
        </div>

        {/* Arrow */}
        <div className="flex justify-center my-4">
          <ArrowRightIcon className="w-5 h-5 text-gray-400 rotate-90" />
        </div>

        {/* Solution */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <LightBulbIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <h4 className="text-sm font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider">
              Solution
            </h4>
          </div>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
            {solution}
          </p>
        </div>

        {/* Outcome */}
        {outcome && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700/50">
            <div className="flex items-start gap-2">
              <CheckCircleIcon className="w-5 h-5 text-primary-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-primary-600 dark:text-primary-400 font-medium">
                {outcome}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Hover accent */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

export function ChallengesSection({ content, isEditing, onUpdate }: ChallengesSectionProps) {
  const { title, items } = content;

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <section className="project-section" data-section-type="challenges">
      {/* Section Header */}
      <div className="flex items-center gap-4 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {title || 'Challenges & Solutions'}
        </h2>
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
      </div>

      {/* Challenge Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {items.map((challenge, index) => (
          <ChallengeCard key={index} challenge={challenge} index={index} />
        ))}
      </div>
    </section>
  );
}
