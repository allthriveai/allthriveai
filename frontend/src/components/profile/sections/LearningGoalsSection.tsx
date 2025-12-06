/**
 * LearningGoalsSection - Display what the user is currently learning
 */

import { useState } from 'react';
import { PlusIcon, XMarkIcon, AcademicCapIcon, BookOpenIcon } from '@heroicons/react/24/outline';
import type { LearningGoalsSectionContent, LearningGoal } from '@/types/profileSections';
import type { ProfileUser } from './ProfileSectionRenderer';

interface LearningGoalsSectionProps {
  content: LearningGoalsSectionContent;
  user: ProfileUser;
  isEditing?: boolean;
  onUpdate?: (content: LearningGoalsSectionContent) => void;
}

export function LearningGoalsSection({ content, user, isEditing, onUpdate }: LearningGoalsSectionProps) {
  const [newTopic, setNewTopic] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const goals = content?.goals || [];
  const showProgress = content?.showProgress !== false;
  const title = content?.title || 'Currently Learning';

  const handleAddGoal = () => {
    if (!newTopic.trim() || !onUpdate) return;

    const goal: LearningGoal = {
      topic: newTopic.trim(),
      description: newDescription.trim() || undefined,
      progress: 0,
    };

    onUpdate({
      ...content,
      goals: [...goals, goal],
    });
    setNewTopic('');
    setNewDescription('');
  };

  const handleRemoveGoal = (index: number) => {
    if (!onUpdate) return;
    const newGoals = goals.filter((_, i) => i !== index);
    onUpdate({ ...content, goals: newGoals });
  };

  const handleUpdateProgress = (index: number, progress: number) => {
    if (!onUpdate) return;
    const newGoals = goals.map((goal, i) =>
      i === index ? { ...goal, progress: Math.max(0, Math.min(100, progress)) } : goal
    );
    onUpdate({ ...content, goals: newGoals });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddGoal();
    }
  };

  // Empty state when not editing and no goals
  if (goals.length === 0 && !isEditing) {
    return null;
  }

  return (
    <div className="py-6">
      <div className="flex items-center gap-2 mb-4">
        <AcademicCapIcon className="w-6 h-6 text-primary-500" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          {title}
        </h2>
      </div>

      {/* Goals list */}
      {goals.length > 0 && (
        <div className="space-y-4">
          {goals.map((goal, index) => (
            <div
              key={`${goal.topic}-${index}`}
              className="group relative p-4 bg-gradient-to-r from-primary-50/50 to-transparent dark:from-primary-900/20 dark:to-transparent rounded-xl border border-primary-100 dark:border-primary-900/30"
            >
              {/* Remove button */}
              {isEditing && (
                <button
                  onClick={() => handleRemoveGoal(index)}
                  className="absolute top-2 right-2 p-1.5 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity rounded-full hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              )}

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 flex-shrink-0">
                  <BookOpenIcon className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {goal.topic}
                  </h3>
                  {goal.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {goal.description}
                    </p>
                  )}

                  {/* Progress bar */}
                  {showProgress && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                        <span>Progress</span>
                        <span>{goal.progress || 0}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all duration-300"
                          style={{ width: `${goal.progress || 0}%` }}
                        />
                      </div>
                      {isEditing && (
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={goal.progress || 0}
                          onChange={(e) => handleUpdateProgress(index, parseInt(e.target.value))}
                          className="w-full mt-2 accent-primary-500"
                        />
                      )}
                    </div>
                  )}

                  {/* Resources */}
                  {goal.resources && goal.resources.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {goal.resources.map((resource, rIndex) => (
                        <a
                          key={rIndex}
                          href={resource}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                        >
                          Resource {rIndex + 1}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Goal Input (editing) */}
      {isEditing && (
        <div className="mt-4 space-y-2">
          <input
            type="text"
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What are you learning? (e.g., Machine Learning, React, etc.)"
            className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Brief description (optional)"
              className="flex-1 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <button
              onClick={handleAddGoal}
              disabled={!newTopic.trim()}
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {goals.length === 0 && isEditing && (
        <p className="text-center text-gray-500 dark:text-gray-400 py-8">
          Share what you're currently learning to connect with others on similar journeys
        </p>
      )}
    </div>
  );
}
