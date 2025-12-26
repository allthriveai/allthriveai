/**
 * CodeWalkthroughExercise - Step-through code visualization with animated highlights
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCode,
  faChevronLeft,
  faChevronRight,
  faRotateRight,
  faCheck,
} from '@fortawesome/free-solid-svg-icons';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

import { AnimatedContainer } from '../primitives/AnimatedContainer';
import { CheckmarkAnimation } from '../primitives/SuccessParticles';
import { useExerciseState } from '../primitives/useExerciseState';
import type { BaseExerciseProps, CodeWalkthroughExerciseData, StepQuestion } from '../types';
import { cn } from '@/lib/utils';

interface CodeWalkthroughExerciseProps extends BaseExerciseProps {
  exercise: BaseExerciseProps['exercise'] & {
    codeWalkthroughData: CodeWalkthroughExerciseData;
  };
}

export function CodeWalkthroughExercise({
  exercise,
  skillLevel,
  onComplete,
}: CodeWalkthroughExerciseProps) {
  const { codeWalkthroughData } = exercise;
  const { code, language, steps } = codeWalkthroughData;

  // Get content for current skill level
  const content = exercise.contentByLevel[skillLevel] ||
    exercise.contentByLevel.beginner ||
    { instructions: exercise.scenario, hints: [] };

  // Exercise state
  const {
    isCompleted,
    showConfetti,
    incrementAttempts,
    markCompleted,
    reset,
    showWrongFeedback,
    showPartialSuccess,
  } = useExerciseState({
    skillLevel,
    hints: content.hints,
    onComplete,
  });

  // Current step
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [questionAnswers, setQuestionAnswers] = useState<Record<number, number>>({});
  const [showQuestionFeedback, setShowQuestionFeedback] = useState<number | null>(null);

  const currentStep = steps[currentStepIndex];
  const totalSteps = steps.length;
  const progress = ((completedSteps.size / totalSteps) * 100).toFixed(0);

  // Navigate to next step
  const goToNextStep = useCallback(() => {
    if (currentStepIndex < totalSteps - 1) {
      setCompletedSteps(prev => new Set(prev).add(currentStepIndex));
      setCurrentStepIndex(prev => prev + 1);
      setShowQuestionFeedback(null);
    } else {
      // Completed all steps
      setCompletedSteps(prev => new Set(prev).add(currentStepIndex));
      markCompleted({
        stepsCompleted: totalSteps,
        questionsAnswered: Object.keys(questionAnswers).length,
        questionsCorrect: Object.entries(questionAnswers).filter(
          ([stepIdx, answer]) => steps[parseInt(stepIdx)].question?.correctIndex === answer
        ).length,
      });
    }
  }, [currentStepIndex, totalSteps, markCompleted, questionAnswers, steps]);

  // Navigate to previous step
  const goToPrevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
      setShowQuestionFeedback(null);
    }
  }, [currentStepIndex]);

  // Handle question answer
  const handleQuestionAnswer = useCallback((answerIndex: number) => {
    if (!currentStep.question || questionAnswers[currentStepIndex] !== undefined) return;

    setQuestionAnswers(prev => ({ ...prev, [currentStepIndex]: answerIndex }));
    setShowQuestionFeedback(currentStepIndex);
    incrementAttempts();

    const isCorrect = currentStep.question.correctIndex === answerIndex;
    if (isCorrect) {
      showPartialSuccess('Correct!');
    } else {
      showWrongFeedback('Not quite right.', currentStep.question.explanation);
    }
  }, [currentStep, currentStepIndex, questionAnswers, incrementAttempts, showPartialSuccess, showWrongFeedback]);

  // Reset exercise
  const handleReset = () => {
    reset();
    setCurrentStepIndex(0);
    setCompletedSteps(new Set());
    setQuestionAnswers({});
    setShowQuestionFeedback(null);
  };

  // Custom line renderer for syntax highlighter
  const lineProps = useCallback((lineNumber: number) => {
    const isHighlighted = currentStep.highlightLines.includes(lineNumber);
    return {
      style: {
        display: 'block',
        backgroundColor: isHighlighted ? 'rgba(34, 211, 238, 0.15)' : 'transparent',
        borderLeft: isHighlighted ? '3px solid #22d3ee' : '3px solid transparent',
        paddingLeft: '0.5rem',
        transition: 'all 0.3s ease',
      },
    };
  }, [currentStep.highlightLines]);

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

      {/* Instructions */}
      <AnimatedContainer variant="default" className="p-4">
        <div className="flex items-start gap-3">
          <FontAwesomeIcon icon={faCode} className="text-cyan-400 mt-1" />
          <div>
            <h4 className="font-medium text-slate-200 mb-1">Code Walkthrough</h4>
            <p className="text-sm text-slate-300 whitespace-pre-wrap">{content.instructions}</p>
          </div>
        </div>
      </AnimatedContainer>

      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <span className="text-sm text-slate-400">
          Step {currentStepIndex + 1} of {totalSteps}
        </span>
      </div>

      {/* Code viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Code panel */}
        <div className="rounded-lg overflow-hidden border border-white/10">
          <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border-b border-white/10">
            <FontAwesomeIcon icon={faCode} className="text-slate-400 text-sm" />
            <span className="text-sm text-slate-400">{language}</span>
          </div>
          <div className="max-h-[400px] overflow-auto">
            <SyntaxHighlighter
              language={language}
              style={oneDark}
              showLineNumbers
              wrapLines
              lineProps={lineProps}
              customStyle={{
                margin: 0,
                background: 'transparent',
                fontSize: '0.875rem',
              }}
            >
              {code}
            </SyntaxHighlighter>
          </div>
        </div>

        {/* Explanation panel */}
        <div className="space-y-4">
          <AnimatedContainer variant="interactive" className="p-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStepIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h4 className="font-medium text-slate-200 mb-2">
                  Step {currentStep.stepNumber}: What's happening?
                </h4>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {currentStep.explanation}
                </p>

                {/* Line reference */}
                <div className="mt-3 text-xs text-slate-500">
                  Lines: {currentStep.highlightLines.join(', ')}
                </div>

                {/* Annotation */}
                {currentStep.annotation && (
                  <div className={cn(
                    'mt-3 p-3 rounded-lg text-sm',
                    currentStep.annotation.type === 'important'
                      ? 'bg-amber-500/10 border border-amber-500/30 text-amber-200'
                      : currentStep.annotation.type === 'warning'
                        ? 'bg-red-500/10 border border-red-500/30 text-red-200'
                        : 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-200'
                  )}>
                    {currentStep.annotation.text}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </AnimatedContainer>

          {/* Question (if present) */}
          {currentStep.question && (
            <QuestionPanel
              question={currentStep.question}
              selectedAnswer={questionAnswers[currentStepIndex]}
              showFeedback={showQuestionFeedback === currentStepIndex}
              onAnswer={handleQuestionAnswer}
              disabled={isCompleted}
            />
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={goToPrevStep}
          disabled={currentStepIndex === 0}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
            currentStepIndex === 0
              ? 'text-slate-600 cursor-not-allowed'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
          )}
        >
          <FontAwesomeIcon icon={faChevronLeft} />
          Previous
        </button>

        <div className="flex gap-2">
          {steps.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentStepIndex(index)}
              className={cn(
                'w-2.5 h-2.5 rounded-full transition-all',
                index === currentStepIndex
                  ? 'bg-cyan-400 scale-125'
                  : completedSteps.has(index)
                    ? 'bg-emerald-400'
                    : 'bg-slate-600 hover:bg-slate-500'
              )}
            />
          ))}
        </div>

        {!isCompleted ? (
          <button
            onClick={goToNextStep}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-cyan-500 hover:bg-cyan-400 text-white transition-colors"
          >
            {currentStepIndex === totalSteps - 1 ? (
              <>
                <FontAwesomeIcon icon={faCheck} />
                Complete
              </>
            ) : (
              <>
                Next
                <FontAwesomeIcon icon={faChevronRight} />
              </>
            )}
          </button>
        ) : (
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <FontAwesomeIcon icon={faRotateRight} />
            Try Again
          </button>
        )}
      </div>

      {/* Completion stats */}
      {isCompleted && (
        <AnimatedContainer variant="success" className="p-4">
          <div className="flex items-center gap-3">
            <CheckmarkAnimation isVisible size="md" />
            <div>
              <p className="font-medium text-emerald-300">{exercise.successMessage || 'Walkthrough Complete!'}</p>
              <p className="text-sm text-emerald-200/70">
                You completed all {totalSteps} steps
                {Object.keys(questionAnswers).length > 0 && (
                  <> and answered {Object.keys(questionAnswers).length} questions</>
                )}.
              </p>
            </div>
          </div>
        </AnimatedContainer>
      )}
    </div>
  );
}

// Question panel component
interface QuestionPanelProps {
  question: StepQuestion;
  selectedAnswer?: number;
  showFeedback: boolean;
  onAnswer: (index: number) => void;
  disabled: boolean;
}

function QuestionPanel({
  question,
  selectedAnswer,
  showFeedback,
  onAnswer,
  disabled,
}: QuestionPanelProps) {
  const isCorrect = selectedAnswer === question.correctIndex;

  return (
    <AnimatedContainer variant="default" className="p-4">
      <h5 className="font-medium text-slate-200 mb-3">{question.prompt}</h5>
      <div className="space-y-2">
        {question.options.map((option, index) => {
          const isSelected = selectedAnswer === index;
          const isCorrectOption = index === question.correctIndex;

          return (
            <button
              key={index}
              onClick={() => onAnswer(index)}
              disabled={disabled || selectedAnswer !== undefined}
              className={cn(
                'w-full p-3 rounded-lg text-left text-sm transition-all',
                selectedAnswer === undefined
                  ? 'bg-white/5 border border-white/10 hover:border-cyan-500/30 hover:bg-cyan-500/5'
                  : isSelected
                    ? isCorrect
                      ? 'bg-emerald-500/10 border border-emerald-500/30'
                      : 'bg-red-500/10 border border-red-500/30'
                    : showFeedback && isCorrectOption
                      ? 'bg-emerald-500/10 border border-emerald-500/30'
                      : 'bg-white/5 border border-white/10 opacity-60',
                (disabled || selectedAnswer !== undefined) && 'cursor-default'
              )}
            >
              <span className={cn(
                'text-slate-300',
                isSelected && (isCorrect ? 'text-emerald-300' : 'text-red-300'),
                showFeedback && isCorrectOption && !isSelected && 'text-emerald-300'
              )}>
                {option}
              </span>
            </button>
          );
        })}
      </div>

      {/* Explanation after answering */}
      {showFeedback && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 p-3 rounded-lg bg-slate-800/50 text-sm text-slate-300"
        >
          {question.explanation}
        </motion.div>
      )}
    </AnimatedContainer>
  );
}

export default CodeWalkthroughExercise;
