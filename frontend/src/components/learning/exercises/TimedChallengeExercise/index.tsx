/**
 * TimedChallengeExercise - Game-like timed challenge with scoring
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBolt,
  faTrophy,
  faHeart,
  faFire,
  faRotateRight,
  faPlay,
} from '@fortawesome/free-solid-svg-icons';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

import { AnimatedContainer } from '../primitives/AnimatedContainer';
import { useExerciseState, useExerciseTimer, useStreakCounter } from '../primitives/useExerciseState';
import type { BaseExerciseProps, TimedChallengeExerciseData, ChallengeQuestion } from '../types';
import { cn } from '@/lib/utils';

interface TimedChallengeExerciseProps extends BaseExerciseProps {
  exercise: BaseExerciseProps['exercise'] & {
    timedChallengeData: TimedChallengeExerciseData;
  };
}

type GameState = 'ready' | 'playing' | 'finished';

export function TimedChallengeExercise({
  exercise,
  skillLevel,
  onComplete,
}: TimedChallengeExerciseProps) {
  const { timedChallengeData } = exercise;
  const {
    questions,
    totalTimeSeconds,
    defaultTimePerQuestion = 30,
    passingScore,
    maxScore,
    lives: initialLives = 3,
    showCorrectOnWrong = true,
    enableStreakMultiplier = true,
  } = timedChallengeData;

  // Get content for current skill level
  const content = exercise.contentByLevel[skillLevel] ||
    exercise.contentByLevel.beginner ||
    { instructions: exercise.scenario, hints: [] };

  // Exercise state
  const {
    showConfetti,
    markCompleted,
    reset: resetExerciseState,
  } = useExerciseState({
    skillLevel,
    hints: content.hints,
    onComplete,
  });

  // Game state
  const [gameState, setGameState] = useState<GameState>('ready');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(initialLives);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set());

  // Timer
  const timerDuration = totalTimeSeconds || questions.length * defaultTimePerQuestion;
  const {
    formattedTime,
    urgencyLevel,
    start: startTimer,
    stop: stopTimer,
    reset: resetTimer,
  } = useExerciseTimer({
    totalSeconds: timerDuration,
    onTimeUp: () => endGame(),
  });

  // Streak counter
  const {
    currentStreak,
    maxStreak,
    multiplier,
    incrementStreak,
    resetStreak,
    reset: resetStreakCounter,
  } = useStreakCounter();

  const currentQuestion = questions[currentQuestionIndex];
  const isPassed = score >= passingScore;

  // Start the game
  const startGame = useCallback(() => {
    setGameState('playing');
    startTimer();
  }, [startTimer]);

  // End the game
  const endGame = useCallback(() => {
    stopTimer();
    setGameState('finished');

    if (score >= passingScore) {
      markCompleted({
        score,
        maxScore,
        streakMax: maxStreak,
        questionsAnswered: answeredQuestions.size,
        questionsCorrect: answeredQuestions.size, // Simplified - could track actual correct count
      });
    }
  }, [stopTimer, score, passingScore, markCompleted, maxScore, maxStreak, answeredQuestions]);

  // Handle answer selection
  const handleAnswer = useCallback((answer: string) => {
    if (showFeedback || selectedAnswer) return;

    setSelectedAnswer(answer);
    setShowFeedback(true);
    setAnsweredQuestions(prev => new Set(prev).add(currentQuestionIndex));

    const isCorrect = answer === currentQuestion.correctAnswer;

    if (isCorrect) {
      const basePoints = currentQuestion.points;
      const pointsWithMultiplier = enableStreakMultiplier
        ? Math.round(basePoints * multiplier)
        : basePoints;

      setScore(prev => prev + pointsWithMultiplier);
      incrementStreak();
    } else {
      resetStreak();
      if (initialLives > 0) {
        setLives(prev => {
          const newLives = prev - 1;
          if (newLives <= 0) {
            setTimeout(() => endGame(), 1500);
          }
          return newLives;
        });
      }
    }

    // Move to next question after delay
    setTimeout(() => {
      if (currentQuestionIndex < questions.length - 1 && lives > 0) {
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedAnswer(null);
        setShowFeedback(false);
      } else if (currentQuestionIndex === questions.length - 1) {
        endGame();
      }
    }, showCorrectOnWrong ? 1500 : 800);
  }, [
    showFeedback, selectedAnswer, currentQuestion, currentQuestionIndex, questions.length,
    enableStreakMultiplier, multiplier, incrementStreak, resetStreak, initialLives, lives,
    endGame, showCorrectOnWrong
  ]);

  // Reset game
  const resetGame = useCallback(() => {
    resetExerciseState();
    resetTimer();
    resetStreakCounter();
    setGameState('ready');
    setCurrentQuestionIndex(0);
    setScore(0);
    setLives(initialLives);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setAnsweredQuestions(new Set());
  }, [resetExerciseState, resetTimer, resetStreakCounter, initialLives]);

  return (
    <div className="space-y-4">
      {/* Confetti */}
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

      {/* Ready state */}
      {gameState === 'ready' && (
        <AnimatedContainer variant="interactive" className="p-6 text-center">
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
              <FontAwesomeIcon icon={faBolt} className="text-3xl text-amber-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-200">Timed Challenge</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">{content.instructions}</p>

            <div className="flex justify-center gap-6 text-sm">
              <div className="text-center">
                <p className="text-slate-500">Questions</p>
                <p className="text-lg font-bold text-slate-200">{questions.length}</p>
              </div>
              <div className="text-center">
                <p className="text-slate-500">Time</p>
                <p className="text-lg font-bold text-slate-200">{Math.floor(timerDuration / 60)}:{(timerDuration % 60).toString().padStart(2, '0')}</p>
              </div>
              <div className="text-center">
                <p className="text-slate-500">To Pass</p>
                <p className="text-lg font-bold text-emerald-400">{passingScore} pts</p>
              </div>
            </div>

            <button
              onClick={startGame}
              className="px-6 py-3 rounded-xl font-bold text-slate-900 bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 transition-all transform hover:scale-105"
            >
              <FontAwesomeIcon icon={faPlay} className="mr-2" />
              Start Challenge
            </button>
          </div>
        </AnimatedContainer>
      )}

      {/* Playing state */}
      {gameState === 'playing' && (
        <>
          {/* Stats bar */}
          <div className="flex items-center justify-between gap-4">
            {/* Timer */}
            <div className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg font-mono',
              urgencyLevel === 'critical' && 'bg-red-500/20 text-red-400 animate-pulse',
              urgencyLevel === 'high' && 'bg-amber-500/20 text-amber-400',
              urgencyLevel === 'medium' && 'bg-cyan-500/10 text-cyan-400',
              urgencyLevel === 'low' && 'bg-white/5 text-slate-300',
            )}>
              <span className="text-lg font-bold">{formattedTime}</span>
            </div>

            {/* Score */}
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faTrophy} className="text-amber-400" />
              <motion.span
                key={score}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                className="text-lg font-bold text-slate-200"
              >
                {score}
              </motion.span>
              <span className="text-slate-500">/ {maxScore}</span>
            </div>

            {/* Streak */}
            {enableStreakMultiplier && currentStreak > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20"
              >
                <FontAwesomeIcon icon={faFire} className="text-orange-400" />
                <span className="font-bold text-orange-300">{currentStreak}x</span>
              </motion.div>
            )}

            {/* Lives */}
            {initialLives > 0 && (
              <div className="flex items-center gap-1">
                {[...Array(initialLives)].map((_, i) => (
                  <FontAwesomeIcon
                    key={i}
                    icon={faHeart}
                    className={cn(
                      'text-lg transition-all',
                      i < lives ? 'text-red-400' : 'text-slate-700'
                    )}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Progress */}
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500"
              initial={{ width: 0 }}
              animate={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Question card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestionIndex}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
            >
              <QuestionCard
                question={currentQuestion}
                questionNumber={currentQuestionIndex + 1}
                totalQuestions={questions.length}
                selectedAnswer={selectedAnswer}
                showFeedback={showFeedback}
                showCorrectOnWrong={showCorrectOnWrong}
                onAnswer={handleAnswer}
              />
            </motion.div>
          </AnimatePresence>
        </>
      )}

      {/* Finished state */}
      {gameState === 'finished' && (
        <AnimatedContainer
          variant={isPassed ? 'success' : 'error'}
          className="p-6 text-center"
        >
          <div className="space-y-4">
            <div className={cn(
              'w-20 h-20 mx-auto rounded-2xl flex items-center justify-center',
              isPassed
                ? 'bg-gradient-to-br from-emerald-500/20 to-cyan-500/20'
                : 'bg-gradient-to-br from-red-500/20 to-orange-500/20'
            )}>
              <FontAwesomeIcon
                icon={isPassed ? faTrophy : faBolt}
                className={cn(
                  'text-4xl',
                  isPassed ? 'text-emerald-400' : 'text-red-400'
                )}
              />
            </div>

            <h3 className={cn(
              'text-2xl font-bold',
              isPassed ? 'text-emerald-300' : 'text-red-300'
            )}>
              {isPassed ? 'Challenge Complete!' : 'Challenge Failed'}
            </h3>

            <div className="flex justify-center gap-8 text-sm">
              <div className="text-center">
                <p className="text-slate-500">Score</p>
                <p className="text-2xl font-bold text-slate-200">{score}</p>
              </div>
              <div className="text-center">
                <p className="text-slate-500">Best Streak</p>
                <p className="text-2xl font-bold text-orange-400">{maxStreak}x</p>
              </div>
              <div className="text-center">
                <p className="text-slate-500">Accuracy</p>
                <p className="text-2xl font-bold text-cyan-400">
                  {answeredQuestions.size > 0
                    ? Math.round((score / maxScore) * 100)
                    : 0}%
                </p>
              </div>
            </div>

            {isPassed && (
              <p className="text-emerald-200/70">
                {exercise.successMessage || 'Great job completing the challenge!'}
              </p>
            )}

            <button
              onClick={resetGame}
              className={cn(
                'px-6 py-3 rounded-xl font-bold transition-all transform hover:scale-105',
                isPassed
                  ? 'text-slate-900 bg-gradient-to-r from-emerald-400 to-cyan-400'
                  : 'text-slate-200 bg-white/10 hover:bg-white/20'
              )}
            >
              <FontAwesomeIcon icon={faRotateRight} className="mr-2" />
              {isPassed ? 'Play Again' : 'Try Again'}
            </button>
          </div>
        </AnimatedContainer>
      )}
    </div>
  );
}

// Question card component
interface QuestionCardProps {
  question: ChallengeQuestion;
  questionNumber: number;
  totalQuestions: number;
  selectedAnswer: string | null;
  showFeedback: boolean;
  showCorrectOnWrong: boolean;
  onAnswer: (answer: string) => void;
}

function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  selectedAnswer,
  showFeedback,
  showCorrectOnWrong,
  onAnswer,
}: QuestionCardProps) {
  const isCorrect = selectedAnswer === question.correctAnswer;

  return (
    <AnimatedContainer variant="interactive" className="p-6">
      <div className="space-y-4">
        {/* Question header */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">
            Question {questionNumber} of {totalQuestions}
          </span>
          <span className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-medium">
            +{question.points} pts
          </span>
        </div>

        {/* Question text */}
        <h4 className="text-lg font-medium text-slate-200">{question.question}</h4>

        {/* Code snippet if present */}
        {question.code && (
          <div className="rounded-lg overflow-hidden border border-white/10">
            <SyntaxHighlighter
              language={question.codeLanguage || 'javascript'}
              style={oneDark}
              customStyle={{
                margin: 0,
                background: 'transparent',
                fontSize: '0.875rem',
                padding: '1rem',
              }}
            >
              {question.code}
            </SyntaxHighlighter>
          </div>
        )}

        {/* Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {question.options.map((option, index) => {
            const isSelected = selectedAnswer === option;
            const isCorrectOption = option === question.correctAnswer;

            return (
              <motion.button
                key={index}
                onClick={() => onAnswer(option)}
                disabled={selectedAnswer !== null}
                className={cn(
                  'p-4 rounded-lg text-left text-sm font-medium transition-all',
                  selectedAnswer === null
                    ? 'bg-white/5 border border-white/10 hover:border-cyan-500/30 hover:bg-cyan-500/5'
                    : isSelected
                      ? isCorrect
                        ? 'bg-emerald-500/20 border-2 border-emerald-500/50'
                        : 'bg-red-500/20 border-2 border-red-500/50'
                      : showFeedback && showCorrectOnWrong && isCorrectOption
                        ? 'bg-emerald-500/10 border border-emerald-500/30'
                        : 'bg-white/5 border border-white/10 opacity-50'
                )}
                whileHover={selectedAnswer === null ? { scale: 1.02 } : undefined}
                whileTap={selectedAnswer === null ? { scale: 0.98 } : undefined}
              >
                <span className={cn(
                  isSelected && (isCorrect ? 'text-emerald-300' : 'text-red-300'),
                  showFeedback && showCorrectOnWrong && isCorrectOption && !isSelected && 'text-emerald-300'
                )}>
                  {option}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* Explanation (if wrong and showCorrectOnWrong is true) */}
        {showFeedback && !isCorrect && showCorrectOnWrong && question.explanation && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-lg bg-slate-800/50 text-sm text-slate-300"
          >
            {question.explanation}
          </motion.div>
        )}
      </div>
    </AnimatedContainer>
  );
}

export default TimedChallengeExercise;
