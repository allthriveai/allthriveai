import { useEffect } from 'react';
import { animated } from '@react-spring/web';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckIcon, XMarkIcon, SparklesIcon } from '@heroicons/react/24/solid';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import type { QuizQuestion } from './types';

interface QuizCardProps {
  question: QuizQuestion;
  onAnswer: (answer: string) => void;
  showFeedback?: boolean;
  isCorrect?: boolean;
  isSubmitting?: boolean;
}

export function QuizCard({
  question,
  onAnswer,
  showFeedback,
  isCorrect,
  isSubmitting = false,
}: QuizCardProps) {
  const isTrueFalse = question.type === 'true_false';
  const canSwipe = isTrueFalse && !showFeedback && !isSubmitting;

  const { bind, styles } = useSwipeGesture({
    onSwipeLeft: () => {
      if (canSwipe) {
        onAnswer('false');
      }
    },
    onSwipeRight: () => {
      if (canSwipe) {
        onAnswer('true');
      }
    },
    enabled: canSwipe,
  });

  // Keyboard support for True/False questions
  useEffect(() => {
    if (!isTrueFalse || showFeedback || isSubmitting) return;

    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onAnswer('false');
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        onAnswer('true');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isTrueFalse, showFeedback, isSubmitting, onAnswer]);

  const handleMultipleChoiceAnswer = (option: string) => {
    onAnswer(option);
  };

  // Only apply swipe gesture and styling to true/false questions
  const swipeProps = canSwipe ? bind() : {};
  const swipeStyle = canSwipe
    ? {
        x: styles.x,
        y: styles.y,
        rotateZ: styles.rotate.to((r: number) => `${r}deg`),
      }
    : undefined;

  return (
    <animated.div
      {...swipeProps}
      style={swipeStyle}
      className={canSwipe ? 'touch-none cursor-grab active:cursor-grabbing' : ''}
    >
      <div className="rounded p-4 sm:p-6 md:p-8 shadow-2xl max-w-2xl mx-auto select-none border border-white/20 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
        {/* Feedback - Now at top for mobile visibility */}
        <AnimatePresence>
          {showFeedback && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className={`mb-4 sm:mb-6 p-4 sm:p-5 rounded-xl border-2 backdrop-blur-sm relative overflow-hidden ${
                isCorrect
                  ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/40 dark:to-emerald-900/40 border-green-500'
                  : 'bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/40 dark:to-rose-900/40 border-red-500'
              }`}
            >
              {/* Celebration particles for correct answers */}
              {isCorrect && (
                <>
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1, rotate: [0, 15, -15, 0] }}
                    transition={{ delay: 0.1, duration: 0.5 }}
                    className="absolute -top-1 -left-1"
                  >
                    <SparklesIcon className="w-6 h-6 text-yellow-400" />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1, rotate: [0, -15, 15, 0] }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                    className="absolute -top-1 -right-1"
                  >
                    <SparklesIcon className="w-6 h-6 text-yellow-400" />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: [0, 1, 1, 0], y: [-10, -30] }}
                    transition={{ delay: 0.3, duration: 1 }}
                    className="absolute top-2 left-1/2 -translate-x-1/2 text-2xl"
                  >
                    🎉
                  </motion.div>
                </>
              )}

              <div className="flex items-center gap-3">
                {isCorrect ? (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-500 flex items-center justify-center"
                  >
                    <CheckIcon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 0.3 }}
                    className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-red-500 flex items-center justify-center"
                  >
                    <XMarkIcon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                  </motion.div>
                )}
                <div className="flex-1 min-w-0">
                  <motion.p
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 }}
                    className={`font-bold text-lg sm:text-xl ${
                      isCorrect ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                    }`}
                  >
                    {isCorrect ? 'Correct! 🎯' : 'Not quite...'}
                  </motion.p>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.25 }}
                    className="text-sm sm:text-base text-gray-700 dark:text-gray-300 line-clamp-2"
                  >
                    {question.explanation}
                  </motion.p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Question Image */}
        {question.imageUrl && (
          <img
            src={question.imageUrl}
            alt=""
            className="w-full h-32 sm:h-40 md:h-48 object-cover rounded mb-4 sm:mb-6"
            draggable={false}
          />
        )}

        {/* Question Text - scrollable if too long */}
        <div className="max-h-[30vh] overflow-y-auto mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 text-center">
            {question.question}
          </h2>
        </div>

        {/* Answer Options */}
        {isTrueFalse && (
          <div className="space-y-3 sm:space-y-4">
            <p className="text-center text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Swipe or tap: ← False | True →
            </p>
            <div className="flex gap-3 sm:gap-4 justify-center">
              <button
                onClick={() => onAnswer('false')}
                disabled={isSubmitting || showFeedback}
                className="flex-1 max-w-[140px] sm:max-w-none sm:flex-initial px-4 sm:px-8 py-3 sm:py-4 bg-red-500 hover:bg-red-600 active:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed text-white rounded-lg text-base sm:text-xl font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <XMarkIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                False
              </button>
              <button
                onClick={() => onAnswer('true')}
                disabled={isSubmitting || showFeedback}
                className="flex-1 max-w-[140px] sm:max-w-none sm:flex-initial px-4 sm:px-8 py-3 sm:py-4 bg-green-500 hover:bg-green-600 active:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed text-white rounded-lg text-base sm:text-xl font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <CheckIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                True
              </button>
            </div>
          </div>
        )}

        {question.type === 'multiple_choice' && question.options && (
          <div className="space-y-2 sm:space-y-3 max-h-[45vh] overflow-y-auto">
            {question.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleMultipleChoiceAnswer(option)}
                disabled={isSubmitting || showFeedback}
                className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-white/80 dark:bg-gray-800/80 hover:bg-primary-50 dark:hover:bg-primary-900/20 active:bg-primary-100 dark:active:bg-primary-900/30 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-gray-200 dark:border-gray-700 hover:border-primary-500 rounded-lg text-left transition-all text-gray-900 dark:text-gray-100 text-sm sm:text-base font-medium backdrop-blur-sm"
              >
                {option}
              </button>
            ))}
          </div>
        )}

        {/* Hint */}
        {question.hint && !showFeedback && (
          <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-blue-50/90 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg backdrop-blur-sm">
            <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300">
              <span className="font-semibold">💡 Hint:</span> {question.hint}
            </p>
          </div>
        )}
      </div>

      {/* Swipe Indicators - only show when swiping is active */}
      {canSwipe && (
        <>
          <animated.div
            style={{
              opacity: styles.x.to((x: number) => (x > 0 ? Math.min(x / 60, 1) : 0)),
            }}
            className="absolute top-1/2 right-2 sm:right-8 transform -translate-y-1/2 pointer-events-none"
          >
            <div className="bg-green-500 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-lg font-bold text-lg sm:text-2xl shadow-lg">
              TRUE
            </div>
          </animated.div>
          <animated.div
            style={{
              opacity: styles.x.to((x: number) => (x < 0 ? Math.min(-x / 60, 1) : 0)),
            }}
            className="absolute top-1/2 left-2 sm:left-8 transform -translate-y-1/2 pointer-events-none"
          >
            <div className="bg-red-500 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-lg font-bold text-lg sm:text-2xl shadow-lg">
              FALSE
            </div>
          </animated.div>
        </>
      )}
    </animated.div>
  );
}
