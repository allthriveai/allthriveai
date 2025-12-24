/**
 * LessonQuiz Component
 *
 * Inline quiz for checking understanding at the end of a lesson.
 * Displays questions one at a time with immediate feedback.
 */
import { useState, useCallback, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCircleQuestion,
  faCheck,
  faTimes,
  faLightbulb,
  faRotateRight,
  faTrophy,
} from '@fortawesome/free-solid-svg-icons';
import { motion, AnimatePresence } from 'framer-motion';
import type { LessonQuiz as LessonQuizType } from '@/services/learningPaths';

interface LessonQuizProps {
  quiz: LessonQuizType;
  onComplete?: (score: number, total: number) => void;
}

interface QuestionState {
  selectedAnswer: string | null;
  isAnswered: boolean;
  isCorrect: boolean;
  showHint: boolean;
}

export function LessonQuiz({ quiz, onComplete }: LessonQuizProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questionStates, setQuestionStates] = useState<Record<string, QuestionState>>({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [score, setScore] = useState(0);

  // Derive current question safely (may be undefined if quiz is empty)
  const currentQuestion = quiz.questions?.[currentQuestionIndex];

  // Derive current state for the question
  const currentState = useMemo(() => {
    if (!currentQuestion) {
      return { selectedAnswer: null, isAnswered: false, isCorrect: false, showHint: false };
    }
    return questionStates[currentQuestion.id] || {
      selectedAnswer: null,
      isAnswered: false,
      isCorrect: false,
      showHint: false,
    };
  }, [currentQuestion, questionStates]);

  // All hooks must be called before any early returns
  const handleSelectAnswer = useCallback((answer: string) => {
    if (!currentQuestion || currentState.isAnswered) return;

    const isCorrect = Array.isArray(currentQuestion.correctAnswer)
      ? currentQuestion.correctAnswer.includes(answer)
      : currentQuestion.correctAnswer === answer;

    setQuestionStates((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        selectedAnswer: answer,
        isAnswered: true,
        isCorrect,
        showHint: false,
      },
    }));

    if (isCorrect) {
      setScore((prev) => prev + 1);
    }
  }, [currentQuestion, currentState.isAnswered]);

  const handleShowHint = useCallback(() => {
    if (!currentQuestion) return;
    setQuestionStates((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...currentState,
        showHint: true,
      },
    }));
  }, [currentQuestion, currentState]);

  const handleNextQuestion = useCallback(() => {
    if (!quiz.questions) return;
    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      // Quiz completed
      setIsCompleted(true);
      if (onComplete) {
        onComplete(score + (currentState.isCorrect ? 1 : 0), quiz.questions.length);
      }
    }
  }, [currentQuestionIndex, quiz.questions, score, currentState.isCorrect, onComplete]);

  const handleRetry = useCallback(() => {
    setCurrentQuestionIndex(0);
    setQuestionStates({});
    setIsCompleted(false);
    setScore(0);
  }, []);

  const passed = score >= quiz.passingScore;

  // Early returns AFTER all hooks
  if (!quiz.questions || quiz.questions.length === 0) {
    return null;
  }

  if (!currentQuestion) {
    return null;
  }

  if (isCompleted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-100 dark:bg-slate-800/50 rounded-lg p-6 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.1 }}
          className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
            passed ? 'bg-emerald-500/20' : 'bg-amber-500/20'
          }`}
        >
          <FontAwesomeIcon
            icon={passed ? faTrophy : faRotateRight}
            className={`text-2xl ${passed ? 'text-emerald-400' : 'text-amber-400'}`}
          />
        </motion.div>

        <h4 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
          {passed ? 'Quiz Complete!' : 'Keep Learning!'}
        </h4>

        <p className="text-slate-600 dark:text-gray-300 mb-2">
          You got <span className="font-bold">{score}</span> out of{' '}
          <span className="font-bold">{quiz.questions.length}</span> correct
        </p>

        <p className="text-sm text-slate-500 dark:text-gray-400 mb-4">
          {passed ? quiz.encouragementMessage : quiz.retryMessage}
        </p>

        {!passed && (
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors"
          >
            <FontAwesomeIcon icon={faRotateRight} className="mr-2" />
            Try Again
          </button>
        )}
      </motion.div>
    );
  }

  return (
    <div className="bg-slate-100 dark:bg-slate-800/50 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FontAwesomeIcon icon={faCircleQuestion} className="text-emerald-500" />
          <h4 className="font-medium text-slate-900 dark:text-white">Quick Check</h4>
        </div>
        <span className="text-sm text-slate-500 dark:text-gray-400">
          {currentQuestionIndex + 1} / {quiz.questions.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-slate-200 dark:bg-slate-700 rounded-full mb-4 overflow-hidden">
        <motion.div
          className="h-full bg-emerald-500"
          initial={{ width: 0 }}
          animate={{ width: `${((currentQuestionIndex + 1) / quiz.questions.length) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <p className="text-slate-800 dark:text-white text-lg mb-4">{currentQuestion.question}</p>

          {/* Options */}
          <div className="space-y-2 mb-4">
            {currentQuestion.options.map((option, index) => {
              const isSelected = currentState.selectedAnswer === option;
              const isCorrectAnswer = Array.isArray(currentQuestion.correctAnswer)
                ? currentQuestion.correctAnswer.includes(option)
                : currentQuestion.correctAnswer === option;
              const showAsCorrect = currentState.isAnswered && isCorrectAnswer;
              const showAsWrong = currentState.isAnswered && isSelected && !isCorrectAnswer;

              return (
                <button
                  key={index}
                  onClick={() => handleSelectAnswer(option)}
                  disabled={currentState.isAnswered}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    showAsCorrect
                      ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
                      : showAsWrong
                        ? 'bg-red-500/10 border-red-500/50 text-red-700 dark:text-red-300'
                        : isSelected
                          ? 'bg-emerald-500/10 border-emerald-500/50'
                          : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 hover:border-emerald-400 dark:hover:border-emerald-400'
                  } ${currentState.isAnswered ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base">{option}</span>
                    {showAsCorrect && <FontAwesomeIcon icon={faCheck} className="text-emerald-500" />}
                    {showAsWrong && <FontAwesomeIcon icon={faTimes} className="text-red-500" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Hint */}
          {!currentState.isAnswered && currentQuestion.hint && !currentState.showHint && (
            <button
              onClick={handleShowHint}
              className="text-sm text-slate-400 hover:text-amber-400 flex items-center gap-1.5 transition-colors mb-4"
            >
              <FontAwesomeIcon icon={faLightbulb} className="text-amber-400" />
              Need a hint?
            </button>
          )}

          {currentState.showHint && currentQuestion.hint && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 mb-4"
            >
              <FontAwesomeIcon icon={faLightbulb} className="text-amber-400 mt-0.5" />
              <p className="text-base text-amber-200">{currentQuestion.hint}</p>
            </motion.div>
          )}

          {/* Explanation (shown after answering) */}
          {currentState.isAnswered && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-3 rounded-lg mb-4 ${
                currentState.isCorrect
                  ? 'bg-emerald-500/10 border border-emerald-500/30'
                  : 'bg-slate-200 dark:bg-slate-700'
              }`}
            >
              <p className="text-base text-slate-700 dark:text-slate-300">
                {currentQuestion.explanation}
              </p>
            </motion.div>
          )}

          {/* Next button */}
          {currentState.isAnswered && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={handleNextQuestion}
              className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors"
            >
              {currentQuestionIndex < quiz.questions.length - 1 ? 'Next Question' : 'See Results'}
            </motion.button>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
