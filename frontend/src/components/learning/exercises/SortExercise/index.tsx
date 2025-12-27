/**
 * SortExercise - Interactive sorting exercise with click-based reordering
 *
 * Users reorder items using up/down arrow buttons to put them in the correct order.
 *
 * Variants:
 * - sequence: Put steps in the correct order (e.g., git workflow)
 * - match: Match items to their pairs (e.g., terms to definitions)
 * - categorize: Sort items into categories (e.g., classify by type)
 *
 * Note: The data type is still called "dragSortData" for API compatibility,
 * but the UI uses click-based sorting, not drag-and-drop.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowsUpDown,
  faCheck,
  faRotateRight,
  faLightbulb,
} from '@fortawesome/free-solid-svg-icons';

import { SortableItem } from './SortableItem';
import { DropZone } from './DropZone';
import { AnimatedContainer } from '../primitives/AnimatedContainer';
import { CheckmarkAnimation } from '../primitives/SuccessParticles';
import { useExerciseState } from '../primitives/useExerciseState';
import type { BaseExerciseProps, DragSortExerciseData, DragSortItem } from '../types';
import { cn } from '@/lib/utils';

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/** Fisher-Yates shuffle - randomizes array order with O(n) complexity */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/** Shuffle items, retrying if they end up in the correct order */
function shuffleUntilDifferent<T extends { id: string }>(
  items: T[],
  correctOrder?: string[]
): T[] {
  if (!correctOrder || items.length <= 1) return [...items];

  let shuffled = shuffleArray(items);
  let attempts = 0;
  const maxAttempts = 10;

  // Keep shuffling until order differs from correct answer
  while (
    attempts < maxAttempts &&
    shuffled.every((item, index) => item.id === correctOrder[index])
  ) {
    shuffled = shuffleArray(items);
    attempts++;
  }

  return shuffled;
}

/** Move an item from one position to another in an array */
function arrayMove<T>(array: T[], fromIndex: number, toIndex: number): T[] {
  const newArray = [...array];
  const [removed] = newArray.splice(fromIndex, 1);
  newArray.splice(toIndex, 0, removed);
  return newArray;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface SortExerciseProps extends BaseExerciseProps {
  exercise: BaseExerciseProps['exercise'] & {
    dragSortData: DragSortExerciseData;
  };
}

export function SortExercise({
  exercise,
  skillLevel,
  onComplete,
  onAskForHelp,
}: SortExerciseProps) {
  const { dragSortData } = exercise;
  const { variant, items: initialItems, correctOrder, correctMatches, categories, correctCategories } = dragSortData;

  // Get content for current skill level
  const content = exercise.contentByLevel[skillLevel] ||
    exercise.contentByLevel.beginner ||
    { instructions: exercise.scenario, hints: [] };

  // Exercise state
  const {
    attempts,
    isCompleted,
    showConfetti,
    feedback,
    revealedHints,
    hasMoreHints,
    config,
    incrementAttempts,
    revealNextHint,
    setFeedback,
    markCompleted,
    reset,
    showWrongFeedback,
  } = useExerciseState({
    skillLevel,
    hints: content.hints,
    onComplete,
  });

  // Items state - shuffled to ensure not in correct order
  const [items, setItems] = useState<DragSortItem[]>(() =>
    variant === 'sequence'
      ? shuffleUntilDifferent(initialItems, correctOrder)
      : [...initialItems]
  );

  // For match variant - track which items are matched
  const [matches, setMatches] = useState<Record<string, string>>({});

  // For categorize variant - track item placements
  const [placements, setPlacements] = useState<Record<string, string>>({});

  // Move item up
  const moveUp = useCallback((index: number) => {
    if (index <= 0) return;
    setItems(current => arrayMove(current, index, index - 1));
  }, []);

  // Move item down
  const moveDown = useCallback((index: number) => {
    if (index >= items.length - 1) return;
    setItems(current => arrayMove(current, index, index + 1));
  }, [items.length]);

  // Validate current state based on variant
  const validateAnswer = useCallback(() => {
    incrementAttempts();

    if (variant === 'sequence' && correctOrder) {
      const currentOrder = items.map(item => item.id);
      const isCorrect = currentOrder.every((id, index) => id === correctOrder[index]);

      if (isCorrect) {
        markCompleted({
          correctPlacements: items.length,
          totalPlacements: items.length,
        });
      } else {
        const correctCount = currentOrder.filter((id, index) => id === correctOrder[index]).length;
        showWrongFeedback(
          `${correctCount} of ${items.length} items are in the correct position.`,
          config.showCorrectOnError ? 'Try moving the highlighted items.' : undefined
        );
      }
    } else if (variant === 'match' && correctMatches) {
      const isCorrect = Object.entries(correctMatches).every(
        ([key, value]) => matches[key] === value
      );

      if (isCorrect) {
        markCompleted({
          correctPlacements: Object.keys(matches).length,
          totalPlacements: Object.keys(correctMatches).length,
        });
      } else {
        const correctCount = Object.entries(correctMatches).filter(
          ([key, value]) => matches[key] === value
        ).length;
        showWrongFeedback(
          `${correctCount} of ${Object.keys(correctMatches).length} matches are correct.`
        );
      }
    } else if (variant === 'categorize' && correctCategories) {
      const isCorrect = Object.entries(correctCategories).every(
        ([itemId, categoryId]) => placements[itemId] === categoryId
      );

      if (isCorrect) {
        markCompleted({
          correctPlacements: Object.keys(placements).length,
          totalPlacements: Object.keys(correctCategories).length,
        });
      } else {
        const correctCount = Object.entries(correctCategories).filter(
          ([itemId, categoryId]) => placements[itemId] === categoryId
        ).length;
        showWrongFeedback(
          `${correctCount} of ${Object.keys(correctCategories).length} items are in the correct category.`
        );
      }
    }
  }, [
    variant, items, matches, placements, correctOrder, correctMatches, correctCategories,
    incrementAttempts, markCompleted, showWrongFeedback, config.showCorrectOnError
  ]);

  // Handle reset
  const handleReset = () => {
    reset();
    setItems(
      variant === 'sequence'
        ? shuffleUntilDifferent(initialItems, correctOrder)
        : [...initialItems]
    );
    setMatches({});
    setPlacements({});
    setFeedback(null);
  };

  return (
    <div className="space-y-4">
      {/* Confetti celebration */}
      {showConfetti && (
        <Confetti
          recycle={false}
          numberOfPieces={200}
          gravity={0.3}
          colors={['#4ade80', '#22d3ee', '#f59e0b', '#ec4899', '#8b5cf6']}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 50,
          }}
        />
      )}

      {/* Instructions */}
      <AnimatedContainer variant="default" className="p-4">
        <div className="flex items-start gap-3">
          <FontAwesomeIcon icon={faArrowsUpDown} className="text-cyan-600 dark:text-cyan-400 mt-1" />
          <div>
            <h4 className="font-medium text-slate-800 dark:text-slate-200 mb-1">Instructions</h4>
            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{content.instructions}</p>
          </div>
        </div>
      </AnimatedContainer>

      {/* Exercise content based on variant */}
      {variant === 'sequence' && (
        <SequenceExercise
          items={items}
          correctOrder={correctOrder || []}
          isCompleted={isCompleted}
          showCorrectOnError={config.showCorrectOnError && !!feedback && !feedback.isCorrect}
          onMoveUp={moveUp}
          onMoveDown={moveDown}
        />
      )}

      {variant === 'match' && (
        <MatchExercise
          items={initialItems}
          matches={matches}
          onMatch={(sourceId, targetId) => setMatches(prev => ({ ...prev, [sourceId]: targetId }))}
          isCompleted={isCompleted}
        />
      )}

      {variant === 'categorize' && categories && (
        <CategorizeExercise
          items={initialItems}
          categories={categories}
          placements={placements}
          onPlace={(itemId, categoryId) => setPlacements(prev => ({ ...prev, [itemId]: categoryId }))}
          isCompleted={isCompleted}
        />
      )}

      {/* Hints */}
      {revealedHints.length > 0 && (
        <AnimatedContainer variant="default" className="p-4">
          <div className="flex items-start gap-3">
            <FontAwesomeIcon icon={faLightbulb} className="text-amber-500 dark:text-amber-400 mt-1" />
            <div className="space-y-2">
              {revealedHints.map((hint, index) => (
                <p key={index} className="text-sm text-amber-700 dark:text-amber-200/80">{hint}</p>
              ))}
            </div>
          </div>
        </AnimatedContainer>
      )}

      {/* Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <AnimatedContainer
              variant={feedback.isCorrect ? 'success' : 'error'}
              className="p-4"
            >
              <div className="flex items-center gap-3">
                {feedback.isCorrect ? (
                  <CheckmarkAnimation isVisible size="md" />
                ) : (
                  <motion.div
                    animate={{ x: [-4, 4, -4, 4, 0] }}
                    transition={{ duration: 0.4 }}
                  >
                    <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
                      <span className="text-red-500 dark:text-red-400 text-sm">!</span>
                    </div>
                  </motion.div>
                )}
                <div>
                  <p className={cn(
                    'font-medium',
                    feedback.isCorrect ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'
                  )}>
                    {feedback.isCorrect ? exercise.successMessage || 'Great job!' : feedback.message}
                  </p>
                  {feedback.explanation && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{feedback.explanation}</p>
                  )}
                </div>
              </div>
            </AnimatedContainer>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        {!isCompleted ? (
          <>
            <button
              onClick={validateAnswer}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-emerald-500 hover:bg-emerald-400 text-white transition-colors"
            >
              <FontAwesomeIcon icon={faCheck} />
              Check Answer
            </button>

            {hasMoreHints && (
              <button
                onClick={revealNextHint}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/10 transition-colors"
              >
                <FontAwesomeIcon icon={faLightbulb} />
                Hint ({revealedHints.length}/{config.maxHints})
              </button>
            )}

            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <FontAwesomeIcon icon={faRotateRight} />
              Reset
            </button>

            {onAskForHelp && (
              <button
                onClick={onAskForHelp}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/10 transition-colors"
              >
                <img src="/sage-avatar.png" alt="Sage" className="w-5 h-5 rounded-full" />
                Ask Sage
              </button>
            )}
          </>
        ) : (
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <FontAwesomeIcon icon={faRotateRight} />
            Try Again
          </button>
        )}
      </div>

      {/* Completion stats */}
      {isCompleted && (
        <AnimatedContainer variant="success" className="p-4">
          <p className="text-sm text-emerald-700 dark:text-emerald-200/70">
            Completed in {attempts} {attempts === 1 ? 'attempt' : 'attempts'}
            {revealedHints.length > 0 && ` using ${revealedHints.length} ${revealedHints.length === 1 ? 'hint' : 'hints'}`}.
          </p>
        </AnimatedContainer>
      )}
    </div>
  );
}

// =============================================================================
// SEQUENCE VARIANT - Reorder items into correct sequence
// =============================================================================

interface SequenceExerciseProps {
  items: DragSortItem[];
  correctOrder: string[];
  isCompleted: boolean;
  showCorrectOnError: boolean;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}

/** Renders sortable items with up/down buttons for reordering */
function SequenceExercise({ items, correctOrder, isCompleted, showCorrectOnError, onMoveUp, onMoveDown }: SequenceExerciseProps) {
  return (
    <div className="space-y-2">
      {items.map((item, index) => {
        const isCorrectPosition = correctOrder[index] === item.id;
        return (
          <SortableItem
            key={item.id}
            id={item.id}
            content={item.content}
            code={item.code}
            codeLanguage={item.codeLanguage}
            disabled={isCompleted}
            showCorrectIndicator={showCorrectOnError && !isCorrectPosition}
            isCorrect={isCompleted && isCorrectPosition}
            index={index}
            totalItems={items.length}
            onMoveUp={() => onMoveUp(index)}
            onMoveDown={() => onMoveDown(index)}
          />
        );
      })}
    </div>
  );
}

// =============================================================================
// MATCH VARIANT - Connect items to their pairs
// =============================================================================

interface MatchExerciseProps {
  items: DragSortItem[];
  matches: Record<string, string>;
  onMatch: (sourceId: string, targetId: string) => void;
  isCompleted: boolean;
}

/** Renders two columns - left items match to right targets */
function MatchExercise({ items, matches, isCompleted }: MatchExerciseProps) {
  // Split items into left (sources) and right (targets)
  const leftItems = items.filter(item => !item.category || item.category === 'left');
  const rightItems = items.filter(item => item.category === 'right');

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Left column */}
      <div className="space-y-2">
        {leftItems.map(item => (
          <div
            key={item.id}
            className={cn(
              'p-3 rounded-lg border transition-all',
              matches[item.id]
                ? 'bg-cyan-50 dark:bg-cyan-500/10 border-cyan-300 dark:border-cyan-500/30'
                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50'
            )}
          >
            <span className="text-slate-800 dark:text-slate-200">{item.content}</span>
            {item.code && (
              <pre className="mt-2 text-xs bg-slate-100 dark:bg-slate-900/50 p-2 rounded overflow-x-auto">
                <code className="text-cyan-600 dark:text-cyan-300">{item.code}</code>
              </pre>
            )}
          </div>
        ))}
      </div>

      {/* Right column - drop zones */}
      <div className="space-y-2">
        {rightItems.map(item => (
          <DropZone
            key={item.id}
            id={item.id}
            label={item.content}
            isOccupied={Object.values(matches).includes(item.id)}
            disabled={isCompleted}
          />
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// CATEGORIZE VARIANT - Sort items into categories
// =============================================================================

interface CategorizeExerciseProps {
  items: DragSortItem[];
  categories: { id: string; label: string; description?: string }[];
  placements: Record<string, string>;
  onPlace: (itemId: string, categoryId: string) => void;
  isCompleted: boolean;
}

/** Renders items to place and category drop zones */
function CategorizeExercise({
  items,
  categories,
  placements,
  isCompleted,
}: CategorizeExerciseProps) {
  // Items not yet placed
  const unplacedItems = items.filter(item => !placements[item.id]);

  // Get items placed in each category
  const getItemsInCategory = (categoryId: string) => {
    return items.filter(item => placements[item.id] === categoryId);
  };

  return (
    <div className="space-y-4">
      {/* Unplaced items */}
      {unplacedItems.length > 0 && (
        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">Items to categorize:</p>
          <div className="flex flex-wrap gap-2">
            {unplacedItems.map(item => (
              <SortableItem
                key={item.id}
                id={item.id}
                content={item.content}
                code={item.code}
                codeLanguage={item.codeLanguage}
                disabled={isCompleted}
                compact
                index={0}
                totalItems={1}
              />
            ))}
          </div>
        </div>
      )}

      {/* Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.map(category => (
          <DropZone
            key={category.id}
            id={category.id}
            label={category.label}
            description={category.description}
            disabled={isCompleted}
          >
            <div className="flex flex-wrap gap-2 mt-2">
              {getItemsInCategory(category.id).map(item => (
                <div
                  key={item.id}
                  className="px-3 py-1.5 rounded bg-cyan-100 dark:bg-cyan-500/20 border border-cyan-300 dark:border-cyan-500/30 text-sm text-slate-800 dark:text-slate-200"
                >
                  {item.content}
                </div>
              ))}
            </div>
          </DropZone>
        ))}
      </div>
    </div>
  );
}

export default SortExercise;
