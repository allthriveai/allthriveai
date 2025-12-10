import { useEffect } from 'react';
import { animated } from '@react-spring/web';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/solid';
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

        {/* Feedback */}
        {showFeedback && (
          <div
            className={`mt-4 sm:mt-6 p-4 sm:p-6 rounded-lg border-2 backdrop-blur-sm ${
              isCorrect
                ? 'bg-green-50/90 dark:bg-green-900/30 border-green-500'
                : 'bg-red-50/90 dark:bg-red-900/30 border-red-500'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {isCorrect ? (
                <>
                  <CheckIcon className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 dark:text-green-400" />
                  <span className="font-bold text-green-700 dark:text-green-300 text-base sm:text-lg">
                    Correct!
                  </span>
                </>
              ) : (
                <>
                  <XMarkIcon className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 dark:text-red-400" />
                  <span className="font-bold text-red-700 dark:text-red-300 text-base sm:text-lg">
                    Incorrect
                  </span>
                </>
              )}
            </div>
            <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 max-h-[20vh] overflow-y-auto">
              {question.explanation}
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
