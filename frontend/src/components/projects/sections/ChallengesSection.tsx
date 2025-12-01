/**
 * ChallengesSection - Problem/solution cards showcasing problem-solving
 *
 * Supports inline editing when isEditing=true for owners.
 */

import { useCallback } from 'react';
import { LightBulbIcon, CheckCircleIcon, ArrowRightIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { InlineEditableTitle, InlineEditableText } from '../shared/InlineEditable';
import type { ChallengesSectionContent, Challenge } from '@/types/sections';

interface ChallengesSectionProps {
  content: ChallengesSectionContent;
  isEditing?: boolean;
  onUpdate?: (content: ChallengesSectionContent) => void;
}

interface ChallengeCardProps {
  challenge: Challenge;
  index: number;
  isEditing?: boolean;
  onUpdate?: (index: number, challenge: Challenge) => void;
  onDelete?: (index: number) => void;
}

function ChallengeCard({ challenge, index, isEditing, onUpdate, onDelete }: ChallengeCardProps) {
  const { challenge: problem, solution, outcome } = challenge;

  const handleProblemChange = useCallback(
    async (newProblem: string) => {
      if (onUpdate) {
        onUpdate(index, { ...challenge, challenge: newProblem });
      }
    },
    [index, challenge, onUpdate]
  );

  const handleSolutionChange = useCallback(
    async (newSolution: string) => {
      if (onUpdate) {
        onUpdate(index, { ...challenge, solution: newSolution });
      }
    },
    [index, challenge, onUpdate]
  );

  const handleOutcomeChange = useCallback(
    async (newOutcome: string) => {
      if (onUpdate) {
        onUpdate(index, { ...challenge, outcome: newOutcome });
      }
    },
    [index, challenge, onUpdate]
  );

  return (
    <div className="relative bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700/50 overflow-hidden hover:shadow-lg transition-all duration-300 group">
      {/* Delete button */}
      {isEditing && onDelete && (
        <button
          onClick={() => onDelete(index)}
          className="absolute top-4 left-4 z-10 p-1.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Delete challenge"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      )}

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
          {isEditing ? (
            <InlineEditableText
              value={problem}
              isEditable={true}
              onChange={handleProblemChange}
              placeholder="Describe the challenge..."
              className="text-gray-900 dark:text-white font-medium leading-relaxed"
              multiline
              rows={2}
            />
          ) : (
            <p className="text-gray-900 dark:text-white font-medium leading-relaxed">
              {problem}
            </p>
          )}
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
          {isEditing ? (
            <InlineEditableText
              value={solution}
              isEditable={true}
              onChange={handleSolutionChange}
              placeholder="Describe the solution..."
              className="text-gray-600 dark:text-gray-300 leading-relaxed"
              multiline
              rows={2}
            />
          ) : (
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              {solution}
            </p>
          )}
        </div>

        {/* Outcome */}
        {(outcome || isEditing) && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700/50">
            <div className="flex items-start gap-2">
              <CheckCircleIcon className="w-5 h-5 text-primary-500 mt-0.5 flex-shrink-0" />
              {isEditing ? (
                <InlineEditableText
                  value={outcome || ''}
                  isEditable={true}
                  onChange={handleOutcomeChange}
                  placeholder="What was the outcome? (optional)"
                  className="text-sm text-primary-600 dark:text-primary-400 font-medium"
                />
              ) : (
                <p className="text-sm text-primary-600 dark:text-primary-400 font-medium">
                  {outcome}
                </p>
              )}
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

  const handleTitleChange = useCallback(
    async (newTitle: string) => {
      if (onUpdate) {
        onUpdate({ ...content, title: newTitle });
      }
    },
    [content, onUpdate]
  );

  const handleChallengeUpdate = useCallback(
    (index: number, updatedChallenge: Challenge) => {
      if (onUpdate) {
        const newItems = [...items];
        newItems[index] = updatedChallenge;
        onUpdate({ ...content, items: newItems });
      }
    },
    [content, items, onUpdate]
  );

  const handleChallengeDelete = useCallback(
    (index: number) => {
      if (onUpdate) {
        const newItems = items.filter((_, i) => i !== index);
        onUpdate({ ...content, items: newItems });
      }
    },
    [content, items, onUpdate]
  );

  const handleAddChallenge = useCallback(() => {
    if (onUpdate) {
      const newChallenge: Challenge = {
        challenge: 'New challenge...',
        solution: 'How you solved it...',
        outcome: '',
      };
      onUpdate({ ...content, items: [...(items || []), newChallenge] });
    }
  }, [content, items, onUpdate]);

  // Allow empty items in edit mode
  if ((!items || items.length === 0) && !isEditing) {
    return null;
  }

  return (
    <section className="project-section" data-section-type="challenges">
      {/* Section Header */}
      <div className="flex items-center gap-4 mb-8">
        {isEditing ? (
          <InlineEditableTitle
            value={title || 'Challenges & Solutions'}
            isEditable={true}
            onChange={handleTitleChange}
            placeholder="Section title..."
            className="text-2xl font-bold text-gray-900 dark:text-white"
            as="h2"
          />
        ) : (
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {title || 'Challenges & Solutions'}
          </h2>
        )}
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
      </div>

      {/* Challenge Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {items?.map((challenge, index) => (
          <ChallengeCard
            key={index}
            challenge={challenge}
            index={index}
            isEditing={isEditing}
            onUpdate={handleChallengeUpdate}
            onDelete={handleChallengeDelete}
          />
        ))}

        {/* Add Challenge button */}
        {isEditing && (
          <button
            onClick={handleAddChallenge}
            className="flex flex-col items-center justify-center min-h-[200px] rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-primary-500 dark:hover:border-primary-500 text-gray-400 hover:text-primary-500 transition-colors"
          >
            <PlusIcon className="w-8 h-8 mb-2" />
            <span className="text-sm font-medium">Add Challenge</span>
          </button>
        )}
      </div>
    </section>
  );
}
