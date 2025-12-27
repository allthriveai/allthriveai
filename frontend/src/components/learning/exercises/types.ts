/**
 * Interactive Exercise Type Definitions
 * Extends the base exercise system with new interactive exercise types
 */

import type { SkillLevel } from '@/services/personalization';

// =============================================================================
// EXERCISE TYPES
// =============================================================================

/** All available exercise types - extends existing types with new interactive ones */
export type ExerciseType =
  // Existing exercise types
  | 'terminal'
  | 'git'
  | 'ai_prompt'
  | 'code_review'
  | 'code'
  // New interactive exercise types
  | 'drag_sort'
  | 'connect_nodes'
  | 'code_walkthrough'
  | 'timed_challenge';

/** Exercise content adapted to different skill levels */
export interface ExerciseContentByLevel {
  instructions: string;
  commandHint?: string;
  hints: string[];
  /** Optional starter code for code exercises */
  starterCode?: string;
}

// =============================================================================
// DRAG & SORT EXERCISE
// =============================================================================

/** Variant types for drag and sort exercises */
export type DragSortVariant = 'sequence' | 'match' | 'categorize';

/** Single item in a drag-sort exercise */
export interface DragSortItem {
  id: string;
  content: string;
  /** Optional code snippet to display with syntax highlighting */
  code?: string;
  /** Language for code highlighting */
  codeLanguage?: 'python' | 'javascript' | 'typescript' | 'html' | 'css';
  /** For categorize variant - initial category (if pre-placed) */
  category?: string;
}

/** Category for categorize variant */
export interface DragSortCategory {
  id: string;
  label: string;
  /** Optional description shown on hover */
  description?: string;
}

/** Data for drag and sort exercises */
export interface DragSortExerciseData {
  variant: DragSortVariant;
  items: DragSortItem[];
  /** For 'sequence' variant - the correct order of item IDs */
  correctOrder?: string[];
  /** For 'match' variant - mapping of item IDs to their matches */
  correctMatches?: Record<string, string>;
  /** For 'categorize' variant - the categories */
  categories?: DragSortCategory[];
  /** For 'categorize' variant - mapping of item IDs to category IDs */
  correctCategories?: Record<string, string>;
  /** Whether to show immediate feedback on each drop (beginner-friendly) */
  showImmediateFeedback?: boolean;
}

// =============================================================================
// CONNECT NODES EXERCISE
// =============================================================================

/** Position in percentage (0-100) for responsive layout */
export interface NodePosition {
  x: number;
  y: number;
}

/** Node type affects styling and glow color */
export type NodeType = 'concept' | 'action' | 'data' | 'decision' | 'start' | 'end';

/** Single node in a connect-nodes exercise */
export interface PuzzleNode {
  id: string;
  label: string;
  position: NodePosition;
  nodeType: NodeType;
  /** Whether this node is fixed and cannot be moved */
  isFixed?: boolean;
  /** Side constraint for two-column matching layouts */
  side?: 'left' | 'right' | 'any';
}

/** Connection between two nodes */
export interface NodeConnection {
  /** Source node ID (maps to from_id in backend) */
  fromId: string;
  /** Target node ID (maps to to_id in backend) */
  toId: string;
  /** Optional label shown on the connection line */
  label?: string;
}

/** Data for connect nodes exercises */
export interface ConnectNodesExerciseData {
  nodes: PuzzleNode[];
  /** Expected connections the user needs to create */
  expectedConnections: NodeConnection[];
  /** Pre-existing connections shown to the user (cannot be modified) */
  presetConnections?: NodeConnection[];
  /** Whether to show hints when hovering near valid connections */
  showConnectionHints?: boolean;
  /** Whether connections can only be made one-to-one */
  oneToOne?: boolean;
}

// =============================================================================
// CODE WALKTHROUGH EXERCISE
// =============================================================================

/** Annotation to show on a specific line */
export interface CodeAnnotation {
  line: number;
  text: string;
  type: 'info' | 'important' | 'warning';
}

/** Optional quiz question at a walkthrough step */
export interface StepQuestion {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

/** Single step in a code walkthrough */
export interface CodeWalkthroughStep {
  /** Step number for display (1-indexed) */
  stepNumber: number;
  /** Lines to highlight (1-indexed) */
  highlightLines: number[];
  /** Explanation shown alongside highlighted code */
  explanation: string;
  /** Optional annotation to show on a specific line */
  annotation?: CodeAnnotation;
  /** Optional quiz question at this step */
  question?: StepQuestion;
}

/** Data for code walkthrough exercises */
export interface CodeWalkthroughExerciseData {
  code: string;
  language: 'python' | 'javascript' | 'typescript' | 'html' | 'css';
  steps: CodeWalkthroughStep[];
  /** Auto-advance interval in ms (0 for manual navigation) */
  autoAdvanceMs?: number;
  /** Whether to show a variable state panel */
  showVariablePanel?: boolean;
  /** Initial variable states (for languages like Python) */
  variableStates?: Record<number, Record<string, string>>; // step -> variable -> value
}

// =============================================================================
// TIMED CHALLENGE EXERCISE
// =============================================================================

/** Single question in a timed challenge */
export interface ChallengeQuestion {
  id: string;
  question: string;
  /** Optional code snippet for the question */
  code?: string;
  codeLanguage?: 'python' | 'javascript' | 'typescript';
  options: string[];
  correctAnswer: string;
  /** Points awarded for correct answer */
  points: number;
  /** Time limit for this specific question (overrides default) */
  timeLimitSeconds?: number;
  /** Explanation shown after answering */
  explanation?: string;
}

/** Data for timed challenge exercises */
export interface TimedChallengeExerciseData {
  questions: ChallengeQuestion[];
  /** Total time limit in seconds (for all questions combined) */
  totalTimeSeconds?: number;
  /** Default time per question if totalTimeSeconds not set */
  defaultTimePerQuestion?: number;
  /** Minimum score to pass */
  passingScore: number;
  /** Maximum possible score */
  maxScore: number;
  /** Number of lives (0 = unlimited) */
  lives?: number;
  /** Whether to show correct answer after wrong response */
  showCorrectOnWrong?: boolean;
  /** Whether to enable streak multiplier */
  enableStreakMultiplier?: boolean;
}

// =============================================================================
// UNIFIED EXERCISE INTERFACE
// =============================================================================

/** Extended LessonExercise that includes all exercise types */
export interface InteractiveExercise {
  exerciseType: ExerciseType;
  scenario: string;
  successMessage: string;
  contentByLevel: Partial<Record<SkillLevel, ExerciseContentByLevel>>;

  // Existing exercise fields
  expectedInputs?: string[];
  expectedPatterns?: string[];
  expectedOutput?: string;
  language?: 'python' | 'javascript' | 'typescript' | 'html' | 'css';
  starterCode?: string;

  // New interactive exercise data (only one will be populated based on exerciseType)
  dragSortData?: DragSortExerciseData;
  connectNodesData?: ConnectNodesExerciseData;
  codeWalkthroughData?: CodeWalkthroughExerciseData;
  timedChallengeData?: TimedChallengeExerciseData;
}

// =============================================================================
// EXERCISE STATS & COMPLETION
// =============================================================================

/** Statistics collected during exercise completion */
export interface ExerciseStats {
  attempts: number;
  hintsUsed: number;
  timeSpentMs: number;
  /** For code exercises - lines of code written */
  linesOfCode?: number;
  /** For drag-sort - correct placements */
  correctPlacements?: number;
  totalPlacements?: number;
  /** For connect-nodes - correct connections */
  correctConnections?: number;
  totalConnections?: number;
  /** For code-walkthrough - steps completed */
  stepsCompleted?: number;
  questionsAnswered?: number;
  questionsCorrect?: number;
  /** For timed-challenge - game stats */
  score?: number;
  maxScore?: number;
  streakMax?: number;
  livesRemaining?: number;
  /** Whether completed on first try with no hints */
  perfectCompletion?: boolean;
}

/** Feedback data for exercise UI */
export interface ExerciseFeedback {
  isCorrect: boolean;
  message: string;
  explanation?: string;
  showCelebration: boolean;
  celebrationType: 'confetti' | 'emoji' | 'glow' | 'none';
}

// =============================================================================
// COMPONENT PROPS
// =============================================================================

/** Base props shared by all exercise components */
export interface BaseExerciseProps {
  exercise: InteractiveExercise;
  skillLevel: SkillLevel;
  lessonId?: string;
  pathSlug?: string;
  onComplete?: (stats: ExerciseStats) => void;
  onAskForHelp?: () => void;
}

/** Props for DragSortExercise */
export interface DragSortExerciseProps extends BaseExerciseProps {
  exercise: InteractiveExercise & { exerciseType: 'drag_sort'; dragSortData: DragSortExerciseData };
}

/** Props for ConnectNodesExercise */
export interface ConnectNodesExerciseProps extends BaseExerciseProps {
  exercise: InteractiveExercise & { exerciseType: 'connect_nodes'; connectNodesData: ConnectNodesExerciseData };
}

/** Props for CodeWalkthroughExercise */
export interface CodeWalkthroughExerciseProps extends BaseExerciseProps {
  exercise: InteractiveExercise & { exerciseType: 'code_walkthrough'; codeWalkthroughData: CodeWalkthroughExerciseData };
}

/** Props for TimedChallengeExercise */
export interface TimedChallengeExerciseProps extends BaseExerciseProps {
  exercise: InteractiveExercise & { exerciseType: 'timed_challenge'; timedChallengeData: TimedChallengeExerciseData };
}

// =============================================================================
// ANIMATION CONFIG
// =============================================================================

/** Animation presets for Framer Motion */
export const exerciseAnimations = {
  /** Drag item lift effect */
  itemLift: {
    scale: 1.05,
    y: -4,
    boxShadow: '0 0 20px rgba(34, 211, 238, 0.3)',
    transition: { type: 'spring' as const, stiffness: 400, damping: 25 },
  },
  /** Drop bounce effect */
  dropBounce: {
    scale: [1, 0.95, 1],
    transition: { duration: 0.2 },
  },
  /** Wrong answer shake */
  shake: {
    x: [-4, 4, -4, 4, 0],
    transition: { duration: 0.4 },
  },
  /** Success glow pulse */
  successGlow: {
    boxShadow: [
      '0 0 0 rgba(52, 211, 153, 0)',
      '0 0 30px rgba(52, 211, 153, 0.6)',
      '0 0 0 rgba(52, 211, 153, 0)',
    ],
    transition: { duration: 0.6 },
  },
  /** Node connection drawing */
  connectionDraw: {
    pathLength: [0, 1],
    transition: { duration: 0.4, ease: 'easeOut' as const },
  },
  /** Fade and slide in */
  fadeSlideIn: {
    opacity: [0, 1],
    y: [10, 0],
    transition: { duration: 0.3 },
  },
  /** Scale in */
  scaleIn: {
    scale: [0.9, 1],
    opacity: [0, 1],
    transition: { duration: 0.2 },
  },
};

// =============================================================================
// STYLE UTILITIES
// =============================================================================

/** Neon glow variants for different exercise states */
export const exerciseGlows = {
  idle: '',
  hover: 'shadow-[0_0_15px_rgba(34,211,238,0.2)]',
  active: 'shadow-[0_0_20px_rgba(34,211,238,0.3)]',
  success: 'shadow-[0_0_25px_rgba(74,222,128,0.4)]',
  error: 'shadow-[0_0_20px_rgba(251,55,255,0.3)]',
  warning: 'shadow-[0_0_15px_rgba(251,191,36,0.3)]',
};

/** Glass panel variants for exercise containers */
export const exercisePanels = {
  default: 'bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg',
  interactive: 'bg-white/8 backdrop-blur-md border border-cyan-500/20 rounded-lg',
  dropzone: 'bg-white/3 border-2 border-dashed border-white/20 rounded-lg',
  dropzoneActive: 'bg-cyan-500/10 border-2 border-dashed border-cyan-400/50 rounded-lg',
  success: 'bg-emerald-500/10 border border-emerald-500/30 rounded-lg',
  error: 'bg-red-500/10 border border-red-500/30 rounded-lg',
};

/** Color scheme for node types in visual puzzles */
export const nodeColors: Record<NodeType, { bg: string; border: string; text: string; glow: string }> = {
  concept: { bg: 'bg-cyan-500/20', border: 'border-cyan-400/50', text: 'text-cyan-300', glow: 'shadow-[0_0_15px_rgba(34,211,238,0.3)]' },
  action: { bg: 'bg-green-500/20', border: 'border-green-400/50', text: 'text-green-300', glow: 'shadow-[0_0_15px_rgba(74,222,128,0.3)]' },
  data: { bg: 'bg-amber-500/20', border: 'border-amber-400/50', text: 'text-amber-300', glow: 'shadow-[0_0_15px_rgba(251,191,36,0.3)]' },
  decision: { bg: 'bg-purple-500/20', border: 'border-purple-400/50', text: 'text-purple-300', glow: 'shadow-[0_0_15px_rgba(168,85,247,0.3)]' },
  start: { bg: 'bg-emerald-500/20', border: 'border-emerald-400/50', text: 'text-emerald-300', glow: 'shadow-[0_0_15px_rgba(52,211,153,0.3)]' },
  end: { bg: 'bg-pink-500/20', border: 'border-pink-400/50', text: 'text-pink-300', glow: 'shadow-[0_0_15px_rgba(251,55,255,0.3)]' },
};

// =============================================================================
// SKILL LEVEL CONFIG
// =============================================================================

/** Configuration per skill level for exercise behavior */
export interface SkillLevelConfig {
  maxHints: number;
  showCorrectOnError: boolean;
  showExplanations: boolean;
  autoAdvanceDelay: number;
  validationStrictness: 'lenient' | 'moderate' | 'strict';
  showConfetti: boolean;
  timerMultiplier: number;
}

export const skillLevelConfigs: Record<SkillLevel, SkillLevelConfig> = {
  beginner: {
    maxHints: 3,
    showCorrectOnError: true,
    showExplanations: true,
    autoAdvanceDelay: 0,
    validationStrictness: 'lenient',
    showConfetti: true,
    timerMultiplier: 1.5,
  },
  intermediate: {
    maxHints: 2,
    showCorrectOnError: false,
    showExplanations: true,
    autoAdvanceDelay: 0,
    validationStrictness: 'moderate',
    showConfetti: true,
    timerMultiplier: 1.0,
  },
  advanced: {
    maxHints: 1,
    showCorrectOnError: false,
    showExplanations: false,
    autoAdvanceDelay: 0,
    validationStrictness: 'strict',
    showConfetti: false,
    timerMultiplier: 0.8,
  },
};

/** Get skill level config with type safety */
export function getSkillConfig(skillLevel: SkillLevel): SkillLevelConfig {
  return skillLevelConfigs[skillLevel];
}
