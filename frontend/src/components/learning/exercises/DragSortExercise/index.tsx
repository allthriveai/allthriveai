/**
 * DragSortExercise - Drag and drop / sorting exercise component
 * Supports three variants: sequence, match, and categorize
 */

import { useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGripVertical,
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

interface DragSortExerciseProps extends BaseExerciseProps {
  exercise: BaseExerciseProps['exercise'] & {
    dragSortData: DragSortExerciseData;
  };
}

export function DragSortExercise({
  exercise,
  skillLevel,
  onComplete,
  onAskForHelp,
}: DragSortExerciseProps) {
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

  // Items state - for sequence variant
  const [items, setItems] = useState<DragSortItem[]>(() => [...initialItems]);

  // For match variant - track which items are matched
  const [matches, setMatches] = useState<Record<string, string>>({});

  // For categorize variant - track item placements
  const [placements, setPlacements] = useState<Record<string, string>>({});

  // Active dragging item
  const [activeId, setActiveId] = useState<string | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Get the active item for drag overlay
  const activeItem = useMemo(() => {
    return items.find(item => item.id === activeId);
  }, [activeId, items]);

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

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  // Handle drag end for sequence variant
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;

    if (!over) return;

    if (variant === 'sequence') {
      if (active.id !== over.id) {
        setItems((items) => {
          const oldIndex = items.findIndex(item => item.id === active.id);
          const newIndex = items.findIndex(item => item.id === over.id);
          return arrayMove(items, oldIndex, newIndex);
        });
      }
    }
    // Match and categorize variants would handle their own drag logic in dropzones
  };

  // Handle reset
  const handleReset = () => {
    reset();
    setItems([...initialItems]);
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
          <FontAwesomeIcon icon={faGripVertical} className="text-cyan-600 dark:text-cyan-400 mt-1" />
          <div>
            <h4 className="font-medium text-gray-800 dark:text-slate-200 mb-1">Instructions</h4>
            <p className="text-sm text-gray-600 dark:text-slate-300 whitespace-pre-wrap">{content.instructions}</p>
          </div>
        </div>
      </AnimatedContainer>

      {/* Exercise content based on variant */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {variant === 'sequence' && (
          <SequenceExercise
            items={items}
            correctOrder={correctOrder || []}
            isCompleted={isCompleted}
            showCorrectOnError={config.showCorrectOnError && !!feedback && !feedback.isCorrect}
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

        {/* Drag overlay */}
        <DragOverlay>
          {activeItem && (
            <div className="p-3 rounded-lg bg-cyan-100 dark:bg-cyan-500/20 border border-cyan-400 dark:border-cyan-400/50 shadow-[0_0_20px_rgba(34,211,238,0.3)]">
              <span className="text-gray-800 dark:text-slate-200">{activeItem.content}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

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
                    <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{feedback.explanation}</p>
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
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
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
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
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

// ============================================================================
// SEQUENCE VARIANT
// ============================================================================

interface SequenceExerciseProps {
  items: DragSortItem[];
  correctOrder: string[];
  isCompleted: boolean;
  showCorrectOnError: boolean;
}

function SequenceExercise({ items, correctOrder, isCompleted, showCorrectOnError }: SequenceExerciseProps) {
  return (
    <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
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
            />
          );
        })}
      </div>
    </SortableContext>
  );
}

// ============================================================================
// MATCH VARIANT
// ============================================================================

interface MatchExerciseProps {
  items: DragSortItem[];
  matches: Record<string, string>;
  onMatch: (sourceId: string, targetId: string) => void;
  isCompleted: boolean;
}

function MatchExercise({ items, matches, isCompleted }: MatchExerciseProps) {
  // Split items into left (sources) and right (targets)
  const leftItems = items.filter(item => !item.category || item.category === 'left');
  const rightItems = items.filter(item => item.category === 'right');

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Left column - draggable items */}
      <div className="space-y-2">
        {leftItems.map(item => (
          <div
            key={item.id}
            className={cn(
              'p-3 rounded-lg border transition-all',
              matches[item.id]
                ? 'bg-cyan-50 dark:bg-cyan-500/10 border-cyan-300 dark:border-cyan-500/30'
                : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
            )}
          >
            <span className="text-gray-800 dark:text-slate-200">{item.content}</span>
            {item.code && (
              <pre className="mt-2 text-xs bg-gray-100 dark:bg-black/30 p-2 rounded overflow-x-auto">
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

// ============================================================================
// CATEGORIZE VARIANT
// ============================================================================

interface CategorizeExerciseProps {
  items: DragSortItem[];
  categories: { id: string; label: string; description?: string }[];
  placements: Record<string, string>;
  onPlace: (itemId: string, categoryId: string) => void;
  isCompleted: boolean;
}

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
        <div className="p-4 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">Drag items to the correct category:</p>
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
                  className="px-3 py-1.5 rounded bg-cyan-100 dark:bg-cyan-500/20 border border-cyan-300 dark:border-cyan-500/30 text-sm text-gray-800 dark:text-slate-200"
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

export default DragSortExercise;
