/**
 * Types for the SimulatedTerminal component
 *
 * Interactive exercise component for learning paths that adapts to user skill level.
 */
import type { SkillLevel } from '@/services/personalization';

export type ExerciseType = 'terminal' | 'git' | 'ai_prompt' | 'code_review' | 'code';

export interface ExerciseContentByLevel {
  instructions: string;
  commandHint?: string;
  hints: string[];
}

export interface Exercise {
  exerciseType: ExerciseType;
  scenario: string;
  expectedInputs: string[]; // Regex patterns for validation
  successMessage: string;
  expectedOutput: string;
  // Partial because AI may not generate content for all skill levels
  contentByLevel: Partial<Record<SkillLevel, ExerciseContentByLevel>>;
}

export interface ExerciseStats {
  hintsUsed: number;
  attempts: number;
  timeSpentMs: number;
}

export interface SimulatedTerminalProps {
  exercise: Exercise;
  skillLevel: SkillLevel;
  onComplete?: (stats: ExerciseStats) => void;
  onAskForHelp?: () => void;
}

export interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'success' | 'info';
  content: string;
  timestamp: Date;
}

export interface ValidationResult {
  isValid: boolean;
  feedback?: string;
}
