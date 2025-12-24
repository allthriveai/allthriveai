/**
 * SimulatedTerminal Component
 *
 * Interactive terminal simulation for "Try It Yourself" exercises.
 * Adapts UI and validation strictness based on user's skill level.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTerminal,
  faLightbulb,
  faCheck,
  faCircleQuestion,
  faRotateRight,
} from '@fortawesome/free-solid-svg-icons';
import { motion, AnimatePresence } from 'framer-motion';
import type { SkillLevel } from '@/services/personalization';
import type { ExerciseContentByLevel, ExerciseStats, TerminalLine, SimulatedTerminalProps } from './types';
import { validateCommand, getPromptSymbol } from './utils/commandValidator';

/**
 * Generate a simulated AI response based on the user's input
 * This creates a realistic-feeling AI interaction for practice exercises
 */
function generateSimulatedAIResponse(userInput: string): string {
  const input = userInput.toLowerCase();

  // Weather-related questions
  if (input.includes('weather') || input.includes('temperature') || input.includes('rain') || input.includes('sunny')) {
    return "Based on current conditions, it looks like it's a pleasant day! The temperature is around 72°F (22°C) with partly cloudy skies. Great question to ask an AI assistant!";
  }

  // Time-related questions
  if (input.includes('time') || input.includes('clock') || input.includes("what's the time")) {
    return "The current time is 2:30 PM. AI assistants can help you with quick information like this!";
  }

  // Restaurant/food questions
  if (input.includes('restaurant') || input.includes('food') || input.includes('pizza') || input.includes('eat') || input.includes('hungry')) {
    return "I found some great options nearby! 'Mario's Pizza' has excellent reviews, and 'The Garden Bistro' is perfect for a casual meal. Would you like more details about either of these?";
  }

  // Help or how-to questions
  if (input.includes('how do') || input.includes('how to') || input.includes('help me') || input.includes('can you')) {
    return "I'd be happy to help! To get the best assistance, try being specific about what you need. For example, instead of 'help me cook', try 'how do I make pasta sauce'. The more details you provide, the better I can assist you!";
  }

  // Greeting
  if (input.includes('hello') || input.includes('hi ') || input.startsWith('hi') || input.includes('hey')) {
    return "Hello! 👋 I'm here to help. Feel free to ask me anything - from quick facts to recommendations to how-to questions. What can I help you with today?";
  }

  // What/who/where questions
  if (input.startsWith('what') || input.startsWith('who') || input.startsWith('where') || input.startsWith('when') || input.startsWith('why')) {
    return "That's a great question! AI assistants are designed to help answer questions like this. In a real app, I would search my knowledge base or the internet to give you an accurate answer. The key is asking clear, specific questions!";
  }

  // Default response for any other input
  return "Thanks for your question! This is how AI assistants work - you type a question or request, and the AI processes it to give you a helpful response. In a real app, this response would be tailored to your specific query. You're doing great!";
}

// Terminal Header with traffic light dots
function TerminalHeader({ exerciseType }: { exerciseType: string }) {
  const titles: Record<string, string> = {
    terminal: 'Terminal',
    git: 'Git Terminal',
    ai_prompt: 'AI Prompt',
    code_review: 'Code Review',
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-slate-200 dark:bg-slate-800 rounded-t-lg border-b border-slate-300 dark:border-slate-700">
      <div className="flex gap-1.5">
        <div className="w-3 h-3 rounded-full bg-red-400" />
        <div className="w-3 h-3 rounded-full bg-yellow-400" />
        <div className="w-3 h-3 rounded-full bg-green-400" />
      </div>
      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
        {titles[exerciseType] || 'Terminal'}
      </span>
    </div>
  );
}

// Terminal Output Display
function TerminalOutput({ lines, promptSymbol }: { lines: TerminalLine[]; promptSymbol: string }) {
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines]);

  if (lines.length === 0) return null;

  return (
    <div
      ref={outputRef}
      className="max-h-48 overflow-y-auto font-mono text-base space-y-1 mb-2"
    >
      {lines.map((line) => (
        <div
          key={line.id}
          className={`
            ${line.type === 'input' ? 'text-slate-300' : ''}
            ${line.type === 'output' ? 'text-slate-400' : ''}
            ${line.type === 'success' ? 'text-emerald-400' : ''}
            ${line.type === 'error' ? 'text-red-400' : ''}
            ${line.type === 'info' ? 'text-blue-400' : ''}
          `}
        >
          {line.type === 'input' && <span className="text-emerald-500">{promptSymbol}</span>}
          {line.content}
        </div>
      ))}
    </div>
  );
}

// Progressive Hint System
function HintSystem({
  hints,
  currentHintIndex,
  maxHints,
  onShowHint,
  onAskForHelp,
}: {
  hints: string[];
  currentHintIndex: number;
  maxHints: number;
  onShowHint: () => void;
  onAskForHelp?: () => void;
}) {
  const availableHints = hints.slice(0, maxHints);
  const hasMoreHints = currentHintIndex < availableHints.length;

  return (
    <div className="mt-3 space-y-2">
      {/* Show current hint if any revealed */}
      {currentHintIndex > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30"
        >
          <FontAwesomeIcon icon={faLightbulb} className="text-amber-400 mt-0.5" />
          <p className="text-base text-amber-200">{hints[currentHintIndex - 1]}</p>
        </motion.div>
      )}

      {/* Hint controls */}
      <div className="flex items-center gap-3">
        {hasMoreHints && (
          <button
            onClick={onShowHint}
            className="text-sm text-slate-400 hover:text-slate-300 flex items-center gap-1.5 transition-colors"
          >
            <FontAwesomeIcon icon={faLightbulb} className="text-amber-400" />
            {currentHintIndex === 0 ? 'Need a hint?' : `More hints (${availableHints.length - currentHintIndex} left)`}
          </button>
        )}
        {onAskForHelp && (
          <button
            onClick={onAskForHelp}
            className="text-sm text-slate-400 hover:text-emerald-400 flex items-center gap-1.5 transition-colors"
          >
            <FontAwesomeIcon icon={faCircleQuestion} />
            Ask Sage
          </button>
        )}
      </div>
    </div>
  );
}

// Success Celebration Overlay
function SuccessOverlay({ message, showConfetti }: { message: string; showConfetti: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm rounded-lg z-10"
    >
      <div className="text-center p-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.1 }}
          className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center"
        >
          <FontAwesomeIcon icon={faCheck} className="text-3xl text-emerald-400" />
        </motion.div>
        <p className="text-lg font-medium text-white mb-2">Great job!</p>
        <p className="text-sm text-slate-300">{message}</p>
        {showConfetti && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                initial={{
                  x: '50%',
                  y: '50%',
                  scale: 0,
                }}
                animate={{
                  x: `${Math.random() * 100}%`,
                  y: `${Math.random() * 100}%`,
                  scale: [0, 1, 0],
                  rotate: Math.random() * 360,
                }}
                transition={{
                  duration: 1.5,
                  delay: Math.random() * 0.3,
                }}
                className="absolute w-2 h-2 rounded-full"
                style={{
                  backgroundColor: ['#34d399', '#22d3ee', '#4ade80', '#a3e635'][i % 4],
                }}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Main SimulatedTerminal Component
export function SimulatedTerminal({
  exercise,
  skillLevel,
  onComplete,
  onAskForHelp,
}: SimulatedTerminalProps) {
  const [input, setInput] = useState('');
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [currentHintIndex, setCurrentHintIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [startTime] = useState(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  // Get content for current skill level with fallback to any available level
  const getContentForLevel = (): ExerciseContentByLevel => {
    // Try exact skill level first
    if (exercise.contentByLevel[skillLevel]) {
      return exercise.contentByLevel[skillLevel];
    }
    // Fallback order: beginner > intermediate > advanced
    const fallbackOrder: SkillLevel[] = ['beginner', 'intermediate', 'advanced'];
    for (const level of fallbackOrder) {
      if (exercise.contentByLevel[level]) {
        return exercise.contentByLevel[level];
      }
    }
    // Last resort: return first available or empty defaults
    const availableLevels = Object.keys(exercise.contentByLevel) as SkillLevel[];
    if (availableLevels.length > 0 && exercise.contentByLevel[availableLevels[0]]) {
      return exercise.contentByLevel[availableLevels[0]]!;
    }
    // Return safe defaults if nothing available (shouldn't happen but prevents crash)
    return { instructions: 'Complete the exercise below.', hints: [] };
  };

  const content = getContentForLevel();
  const promptSymbol = getPromptSymbol(exercise.exerciseType);

  // Determine max hints based on skill level
  const maxHints = skillLevel === 'beginner' ? 3 : skillLevel === 'intermediate' ? 2 : 1;

  // Get styles based on skill level
  const terminalBg = skillLevel === 'beginner'
    ? 'bg-slate-100 dark:bg-slate-800/50'
    : skillLevel === 'intermediate'
      ? 'bg-slate-800'
      : 'bg-slate-900';

  const terminalText = skillLevel === 'beginner'
    ? 'text-slate-800 dark:text-slate-200'
    : 'text-slate-200';

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || isCompleted) return;

    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    // Add input to output
    const inputLine: TerminalLine = {
      id: `input-${Date.now()}`,
      type: 'input',
      content: input,
      timestamp: new Date(),
    };
    setLines((prev) => [...prev, inputLine]);

    // Validate - pass exerciseType so ai_prompt exercises are validated more leniently
    const result = validateCommand(input, exercise.expectedInputs, skillLevel, exercise.exerciseType);

    if (result.isValid) {
      // For ai_prompt exercises, generate a simulated AI response
      if (exercise.exerciseType === 'ai_prompt') {
        // Show a "thinking" indicator first
        const thinkingLine: TerminalLine = {
          id: `thinking-${Date.now()}`,
          type: 'info',
          content: '🤔 Thinking...',
          timestamp: new Date(),
        };
        setLines((prev) => [...prev, thinkingLine]);

        // Simulate AI response delay, then show response
        setTimeout(() => {
          // Generate a contextual AI response
          const aiResponse = generateSimulatedAIResponse(input);

          // Remove thinking indicator and add AI response
          setLines((prev) => {
            const withoutThinking = prev.filter(l => !l.id.startsWith('thinking-'));
            return [...withoutThinking, {
              id: `ai-response-${Date.now()}`,
              type: 'output' as const,
              content: `🤖 AI: ${aiResponse}`,
              timestamp: new Date(),
            }];
          });

          // Show success message after the AI response
          setTimeout(() => {
            setLines((prev) => [...prev, {
              id: `success-${Date.now()}`,
              type: 'success' as const,
              content: exercise.successMessage || 'Great job! You successfully interacted with an AI assistant.',
              timestamp: new Date(),
            }]);
            setIsCompleted(true);

            // Report completion for ai_prompt (after animation completes)
            if (onComplete) {
              const stats: ExerciseStats = {
                hintsUsed: currentHintIndex,
                attempts: newAttempts,
                timeSpentMs: Date.now() - startTime,
              };
              onComplete(stats);
            }
          }, 500);
        }, 800);
      } else {
        // Standard success for other exercise types
        const outputLine: TerminalLine = {
          id: `output-${Date.now()}`,
          type: 'success',
          content: exercise.expectedOutput,
          timestamp: new Date(),
        };
        setLines((prev) => [...prev, outputLine]);
        setIsCompleted(true);

        // Report completion for standard exercises
        if (onComplete) {
          const stats: ExerciseStats = {
            hintsUsed: currentHintIndex,
            attempts: newAttempts,
            timeSpentMs: Date.now() - startTime,
          };
          onComplete(stats);
        }
      }
    } else {
      // Failure
      const errorLine: TerminalLine = {
        id: `error-${Date.now()}`,
        type: 'error',
        content: result.feedback || "That's not quite right. Try again!",
        timestamp: new Date(),
      };
      setLines((prev) => [...prev, errorLine]);
    }

    setInput('');
  }, [input, isCompleted, attempts, exercise, skillLevel, currentHintIndex, startTime, onComplete]);

  const handleShowHint = useCallback(() => {
    if (currentHintIndex < content.hints.length && currentHintIndex < maxHints) {
      setCurrentHintIndex((prev) => prev + 1);
    }
  }, [currentHintIndex, content.hints.length, maxHints]);

  const handleReset = useCallback(() => {
    setLines([]);
    setInput('');
    setCurrentHintIndex(0);
    setIsCompleted(false);
    setAttempts(0);
    inputRef.current?.focus();
  }, []);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="relative">
      {/* Exercise Context */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <FontAwesomeIcon icon={faTerminal} className="text-emerald-500" />
          <h4 className="font-medium text-lg text-slate-800 dark:text-white">Try It Yourself</h4>
        </div>
        <p className="text-base text-slate-600 dark:text-slate-300 mb-2">{exercise.scenario}</p>
        <p className="text-base font-medium text-slate-800 dark:text-white">{content.instructions}</p>
      </div>

      {/* Terminal Window */}
      <div className={`relative rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden ${terminalBg}`}>
        <TerminalHeader exerciseType={exercise.exerciseType} />

        <div className={`p-4 ${terminalText}`}>
          {/* Output History */}
          <TerminalOutput lines={lines} promptSymbol={promptSymbol} />

          {/* Input Area */}
          {!isCompleted && (
            <form onSubmit={handleSubmit} className="flex items-center gap-2 font-mono">
              <span className="text-emerald-500">{promptSymbol}</span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={content.commandHint || ''}
                className={`
                  flex-1 bg-transparent outline-none text-base
                  placeholder:text-slate-500 dark:placeholder:text-slate-500
                  ${terminalText}
                `}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
              />
            </form>
          )}

          {/* Beginner: Show explanation after command */}
          {skillLevel === 'beginner' && lines.some((l) => l.type === 'success') && !isCompleted && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-2 text-xs text-slate-400 italic"
            >
              What happened: Your command was executed successfully!
            </motion.p>
          )}
        </div>

        {/* Success Overlay - only show for non-ai_prompt exercises so users can see AI response */}
        <AnimatePresence>
          {isCompleted && exercise.exerciseType !== 'ai_prompt' && (
            <SuccessOverlay
              message={exercise.successMessage}
              showConfetti={skillLevel === 'beginner'}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Hint System */}
      {!isCompleted && (
        <HintSystem
          hints={content.hints}
          currentHintIndex={currentHintIndex}
          maxHints={maxHints}
          onShowHint={handleShowHint}
          onAskForHelp={onAskForHelp}
        />
      )}

      {/* Reset Button (after completion) */}
      {isCompleted && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={handleReset}
          className="mt-3 text-xs text-slate-400 hover:text-slate-300 flex items-center gap-1.5 transition-colors"
        >
          <FontAwesomeIcon icon={faRotateRight} />
          Try again
        </motion.button>
      )}
    </div>
  );
}
