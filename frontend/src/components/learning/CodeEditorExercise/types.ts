/**
 * Types for the Code Editor Exercise component
 */

export type CodeLanguage = 'python' | 'javascript' | 'typescript' | 'html' | 'css';

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

export interface CodeExerciseContentByLevel {
  instructions: string;
  hints: string[];
  starterCode?: string;
  solutionHint?: string;
}

export interface CodeExercise {
  exerciseType: 'code';
  language: CodeLanguage;
  scenario: string;
  starterCode?: string;
  expectedPatterns: string[];
  successMessage: string;
  expectedOutput?: string;
  contentByLevel: Partial<Record<SkillLevel, CodeExerciseContentByLevel>>;
}

export interface CodeFeedbackIssue {
  type: 'error' | 'warning' | 'suggestion';
  line?: number;
  message: string;
  explanation?: string;
  hint?: string;
}

export interface CodeFeedback {
  isCorrect: boolean;
  status: 'correct' | 'almost_there' | 'needs_work' | 'major_issues';
  issues: CodeFeedbackIssue[];
  positives?: string[];
  nextStep?: string;
  aiUsed: boolean;
}

export interface CodeExerciseStats {
  hintsUsed: number;
  attempts: number;
  timeSpentMs: number;
  linesOfCode: number;
}

export interface CodeEditorExerciseProps {
  exercise: CodeExercise;
  skillLevel: SkillLevel;
  lessonId?: string;
  pathSlug?: string;
  onComplete?: (stats: CodeExerciseStats) => void;
  onAskForHelp?: () => void;
}

export interface MonacoWrapperProps {
  language: CodeLanguage;
  value: string;
  onChange: (value: string | undefined) => void;
  feedback: CodeFeedback | null;
  readOnly?: boolean;
  height?: string;
}

export interface FeedbackPanelProps {
  feedback: CodeFeedback;
  skillLevel: SkillLevel;
  onAskForHelp?: () => void;
}

export interface HintSystemProps {
  hints: string[];
  currentIndex: number;
  maxHints: number;
  onRevealHint: () => void;
}

// API Request/Response types
export interface ValidateCodeRequest {
  code: string;
  language: CodeLanguage;
  expectedPatterns: string[];
  skillLevel: SkillLevel;
  exerciseId?: string;
}

export interface ValidateCodeResponse {
  isCorrect: boolean;
  status: 'correct' | 'almost_there' | 'needs_work' | 'major_issues';
  issues: CodeFeedbackIssue[];
  positives?: string[];
  nextStep?: string;
  aiUsed: boolean;
  patternResults?: Array<{
    pattern: string;
    found: boolean;
    line?: number;
  }>;
}
