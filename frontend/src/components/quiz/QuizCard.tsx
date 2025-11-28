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

export function QuizCard({ question, onAnswer, showFeedback, isCorrect, isSubmitting = false }: QuizCardProps) {
  const { bind, styles } = useSwipeGesture({
    onSwipeLeft: () => {
      if (question.type === 'true_false' && !showFeedback && !isSubmitting) {
        onAnswer('false');
      }
    },
    onSwipeRight: () => {
      if (question.type === 'true_false' && !showFeedback && !isSubmitting) {
        onAnswer('true');
      }
    },
  });

  // Keyboard support for True/False questions
  useEffect(() => {
    if (question.type !== 'true_false' || showFeedback || isSubmitting) return;

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
  }, [question.type, showFeedback, isSubmitting, onAnswer]);

  const handleMultipleChoiceAnswer = (option: string) => {
    onAnswer(option);
  };

  return (
    <animated.div
      {...bind()}
      style={{
        x: styles.x,
        y: styles.y,
        rotateZ: styles.rotate.to((r) => `${r}deg`),
      }}
      className="touch-none cursor-grab active:cursor-grabbing"
    >
      <div className="rounded p-8 shadow-2xl max-w-2xl mx-auto select-none border border-white/20 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
        {/* Question Image */}
        {question.imageUrl && (
          <img
            src={question.imageUrl}
            alt=""
            className="w-full h-48 object-cover rounded mb-6"
            draggable={false}
          />
        )}

        {/* Question Text */}
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 text-center">
          {question.question}
        </h2>

        {/* Answer Options */}
        {question.type === 'true_false' && (
          <div className="space-y-4">
            <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
              Swipe or use arrow keys: ← False | True →
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => onAnswer('false')}
                disabled={isSubmitting || showFeedback}
                className="px-8 py-4 bg-red-500 hover:bg-red-600 disabled:bg-red-300 disabled:cursor-not-allowed text-white rounded text-xl font-semibold transition-colors flex items-center gap-2"
              >
                <XMarkIcon className="w-6 h-6" />
                False
              </button>
              <button
                onClick={() => onAnswer('true')}
                disabled={isSubmitting || showFeedback}
                className="px-8 py-4 bg-green-500 hover:bg-green-600 disabled:bg-green-300 disabled:cursor-not-allowed text-white rounded text-xl font-semibold transition-colors flex items-center gap-2"
              >
                <CheckIcon className="w-6 h-6" />
                True
              </button>
            </div>
          </div>
        )}

        {question.type === 'multiple_choice' && question.options && (
          <div className="space-y-3">
            {question.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleMultipleChoiceAnswer(option)}
                disabled={isSubmitting || showFeedback}
                className="w-full px-6 py-4 bg-white/80 dark:bg-gray-800/80 hover:bg-primary-50 dark:hover:bg-primary-900/20 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-gray-200 dark:border-gray-700 hover:border-primary-500 rounded text-left transition-all text-gray-900 dark:text-gray-100 font-medium backdrop-blur-sm"
              >
                {option}
              </button>
            ))}
          </div>
        )}

        {/* Hint */}
        {question.hint && !showFeedback && (
          <div className="mt-6 p-4 bg-blue-50/90 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded backdrop-blur-sm">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <span className="font-semibold">💡 Hint:</span> {question.hint}
            </p>
          </div>
        )}

        {/* Feedback */}
        {showFeedback && (
          <div
            className={`mt-6 p-6 rounded border-2 backdrop-blur-sm ${
              isCorrect
                ? 'bg-green-50/90 dark:bg-green-900/30 border-green-500'
                : 'bg-red-50/90 dark:bg-red-900/30 border-red-500'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {isCorrect ? (
                <>
                  <CheckIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
                  <span className="font-bold text-green-700 dark:text-green-300 text-lg">
                    Correct!
                  </span>
                </>
              ) : (
                <>
                  <XMarkIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
                  <span className="font-bold text-red-700 dark:text-red-300 text-lg">
                    Incorrect
                  </span>
                </>
              )}
            </div>
            <p className="text-gray-700 dark:text-gray-300">{question.explanation}</p>
          </div>
        )}
      </div>

      {/* Swipe Indicators */}
      {question.type === 'true_false' && (
        <>
          <animated.div
            style={{
              opacity: styles.x.to((x) => (x > 0 ? x / 100 : 0)),
            }}
            className="absolute top-1/2 right-8 transform -translate-y-1/2 pointer-events-none"
          >
            <div className="bg-green-500 text-white px-6 py-3 rounded font-bold text-2xl shadow-lg">
              TRUE
            </div>
          </animated.div>
          <animated.div
            style={{
              opacity: styles.x.to((x) => (x < 0 ? -x / 100 : 0)),
            }}
            className="absolute top-1/2 left-8 transform -translate-y-1/2 pointer-events-none"
          >
            <div className="bg-red-500 text-white px-6 py-3 rounded font-bold text-2xl shadow-lg">
              FALSE
            </div>
          </animated.div>
        </>
      )}
    </animated.div>
  );
}
