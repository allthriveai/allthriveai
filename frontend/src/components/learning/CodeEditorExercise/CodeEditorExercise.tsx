/**
 * Code Editor Exercise Component
 * Main component for code writing exercises with Monaco Editor
 */

import { useState, useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlay,
  faRotateRight,
  faRobot,
  faCode,
  faCheckCircle,
} from '@fortawesome/free-solid-svg-icons';
import Confetti from 'react-confetti';
import { MonacoWrapper } from './MonacoWrapper';
import { FeedbackPanel } from './FeedbackPanel';
import { HintSystem } from './HintSystem';
import { validateClientSide } from './utils/clientValidator';
import { getDefaultStarterCode } from './utils/languageConfig';
import { validateCode } from '@/services/learningPaths';
import type { CodeEditorExerciseProps, CodeFeedback } from './types';

export function CodeEditorExercise({
  exercise,
  skillLevel,
  lessonId,
  pathSlug: _pathSlug,
  onComplete,
  onAskForHelp,
}: CodeEditorExerciseProps) {
  // Determine initial code
  const getInitialCode = () => {
    const levelContent = exercise.contentByLevel[skillLevel];
    return levelContent?.starterCode || exercise.starterCode || getDefaultStarterCode(exercise.language);
  };

  const [code, setCode] = useState(getInitialCode);
  const [feedback, setFeedback] = useState<CodeFeedback | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [currentHintIndex, setCurrentHintIndex] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const startTime = useRef(Date.now());

  // Get content for current skill level with fallbacks
  const content = exercise.contentByLevel[skillLevel] ||
    exercise.contentByLevel.beginner ||
    { instructions: exercise.scenario, hints: [] };

  // Max hints based on skill level
  const maxHints = skillLevel === 'beginner' ? 3 : skillLevel === 'intermediate' ? 2 : 1;

  const handleCodeChange = useCallback((newValue: string | undefined) => {
    setCode(newValue || '');
    // Clear feedback when user starts typing again
    if (feedback && !feedback.isCorrect) {
      setFeedback(null);
    }
  }, [feedback]);

  const handleValidate = async () => {
    setIsValidating(true);
    setAttempts(prev => prev + 1);

    try {
      // Tier 1: Client-side validation
      const clientResult = validateClientSide(code, exercise.language);

      if (clientResult.hasErrors && clientResult.feedback) {
        setFeedback(clientResult.feedback);
        setIsValidating(false);
        return;
      }

      // Tier 2 + 3: Server-side validation
      const serverResult = await validateCode({
        code,
        language: exercise.language,
        expectedPatterns: exercise.expectedPatterns,
        skillLevel,
        exerciseId: lessonId,
      });

      // Merge client warnings with server result if any
      const mergedFeedback: CodeFeedback = {
        ...serverResult,
        issues: [
          ...(clientResult.feedback?.issues.filter(i => i.type !== 'error') || []),
          ...serverResult.issues,
        ],
      };

      setFeedback(mergedFeedback);

      // Handle success
      if (serverResult.isCorrect) {
        setIsCompleted(true);

        // Show confetti for beginners
        if (skillLevel === 'beginner') {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 5000);
        }

        // Report completion
        onComplete?.({
          hintsUsed: currentHintIndex,
          attempts,
          timeSpentMs: Date.now() - startTime.current,
          linesOfCode: code.split('\n').filter(line => line.trim()).length,
        });
      }
    } catch (error) {
      console.error('Validation error:', error);

      // Fallback to client-only validation on server error
      setFeedback({
        isCorrect: false,
        status: 'needs_work',
        issues: [{
          type: 'warning',
          message: 'Could not reach server for full validation',
          explanation: 'Your code passed basic checks. Try again to get full feedback.',
        }],
        aiUsed: false,
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleReset = () => {
    setCode(getInitialCode());
    setFeedback(null);
    setCurrentHintIndex(0);
    setIsCompleted(false);
  };

  const handleRevealHint = () => {
    setCurrentHintIndex(prev => Math.min(prev + 1, maxHints));
  };

  return (
    <div className="space-y-4">
      {/* Confetti celebration */}
      {showConfetti && (
        <Confetti
          recycle={false}
          numberOfPieces={200}
          gravity={0.3}
          style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 50 }}
        />
      )}

      {/* Instructions */}
      <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
        <div className="flex items-start gap-3">
          <FontAwesomeIcon icon={faCode} className="text-emerald-400 mt-1" />
          <div>
            <h4 className="font-medium text-slate-200 mb-1">Instructions</h4>
            <p className="text-sm text-slate-300 whitespace-pre-wrap">{content.instructions}</p>
          </div>
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="rounded-lg overflow-hidden border border-slate-700">
        <MonacoWrapper
          language={exercise.language}
          value={code}
          onChange={handleCodeChange}
          feedback={feedback}
          readOnly={isCompleted}
          height="300px"
        />
      </div>

      {/* Hint System */}
      <HintSystem
        hints={content.hints || []}
        currentIndex={currentHintIndex}
        maxHints={maxHints}
        onRevealHint={handleRevealHint}
      />

      {/* Feedback Panel */}
      {feedback && (
        <FeedbackPanel
          feedback={feedback}
          skillLevel={skillLevel}
          onAskForHelp={onAskForHelp}
        />
      )}

      {/* Success message */}
      {isCompleted && (
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
          <div className="flex items-center gap-3">
            <FontAwesomeIcon icon={faCheckCircle} className="text-emerald-400 text-xl" />
            <div>
              <h4 className="font-medium text-emerald-300">{exercise.successMessage || 'Great job!'}</h4>
              <p className="text-sm text-emerald-200/70 mt-1">
                You completed this exercise in {attempts} {attempts === 1 ? 'attempt' : 'attempts'}
                {currentHintIndex > 0 && ` using ${currentHintIndex} ${currentHintIndex === 1 ? 'hint' : 'hints'}`}.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        {!isCompleted ? (
          <>
            <button
              onClick={handleValidate}
              disabled={isValidating || !code.trim()}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
                ${isValidating || !code.trim()
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-white'
                }`}
            >
              <FontAwesomeIcon icon={faPlay} className={isValidating ? 'animate-pulse' : ''} />
              {isValidating ? 'Checking...' : 'Check Code'}
            </button>

            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <FontAwesomeIcon icon={faRotateRight} />
              Reset
            </button>

            {onAskForHelp && (
              <button
                onClick={onAskForHelp}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
              >
                <FontAwesomeIcon icon={faRobot} />
                Ask Sage
              </button>
            )}
          </>
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
    </div>
  );
}

export default CodeEditorExercise;
