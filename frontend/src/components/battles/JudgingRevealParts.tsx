/**
 * JudgingReveal Sub-Components
 *
 * Extracted components from JudgingReveal to reduce complexity:
 * - AnalyzingPhase: AI analysis animation with rotating messages
 * - ScoringPhase: Brief score reveal transition
 * - ConfettiEffect: Winner celebration particles
 * - SubmissionCard: Revealed submission with scores
 * - WinnerAnnouncement: Final result display
 */

import { motion, AnimatePresence } from 'framer-motion';
import {
  TrophyIcon,
  SparklesIcon,
  StarIcon,
  ScaleIcon,
  EyeIcon,
  LightBulbIcon,
  FireIcon,
  ArrowPathIcon,
  HomeIcon,
  ShareIcon,
} from '@heroicons/react/24/solid';

// =============================================================================
// Types
// =============================================================================

export interface Submission {
  id: number;
  promptText: string;
  imageUrl?: string;
  score?: number;
  criteriaScores?: Record<string, number>;
  feedback?: string;
}

export interface Player {
  id: number;
  username: string;
  avatarUrl?: string;
  isAi?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

export const ANALYSIS_MESSAGES = [
  { icon: EyeIcon, text: 'Examining creative compositions...' },
  { icon: LightBulbIcon, text: 'Analyzing originality and innovation...' },
  { icon: ScaleIcon, text: 'Weighing technical execution...' },
  { icon: SparklesIcon, text: 'Evaluating artistic merit...' },
  { icon: FireIcon, text: 'Measuring visual impact...' },
  { icon: StarIcon, text: 'Calculating final scores...' },
];

// =============================================================================
// AnalyzingPhase - AI deliberation animation
// =============================================================================

interface AnalyzingPhaseProps {
  messageIndex: number;
  mySubmission: Submission | null;
  opponentSubmission: Submission | null;
}

export function AnalyzingPhase({
  messageIndex,
  mySubmission,
  opponentSubmission,
}: AnalyzingPhaseProps) {
  const CurrentIcon = ANALYSIS_MESSAGES[messageIndex].icon;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 30% 40%, rgba(34, 211, 238, 0.15) 0%, transparent 50%),
              radial-gradient(circle at 70% 60%, rgba(251, 55, 255, 0.15) 0%, transparent 50%)
            `,
          }}
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 3, repeat: Infinity }}
        />

        {/* Scanning lines */}
        <motion.div
          className="absolute inset-0"
          style={{
            background: `repeating-linear-gradient(
              0deg,
              transparent,
              transparent 50px,
              rgba(34, 211, 238, 0.03) 50px,
              rgba(34, 211, 238, 0.03) 51px
            )`,
          }}
          animate={{ y: [0, 50, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 text-center max-w-2xl"
      >
        {/* Central orb */}
        <div className="relative w-28 h-28 md:w-40 md:h-40 mx-auto mb-6 md:mb-8">
          {/* Outer rings */}
          {[1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className="absolute inset-0 rounded-full border border-cyan-500/30"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.5, 0, 0.5],
                rotate: [0, 180, 360],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                delay: i * 0.3,
                ease: 'easeInOut',
              }}
            />
          ))}

          {/* Core */}
          <motion.div
            className="absolute inset-3 md:inset-4 rounded-full bg-gradient-to-br from-cyan-500/20 to-pink-500/20
                       border-2 border-cyan-400/50 flex items-center justify-center
                       shadow-[0_0_60px_rgba(34,211,238,0.4)]"
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          >
            <ScaleIcon className="w-8 h-8 md:w-12 md:h-12 text-cyan-400" />
          </motion.div>

          {/* Orbiting elements */}
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className="absolute w-4 h-4 rounded-full bg-gradient-to-r from-cyan-400 to-pink-400"
              style={{
                top: '50%',
                left: '50%',
                marginTop: '-8px',
                marginLeft: '-8px',
              }}
              animate={{
                x: [0, Math.cos((i * Math.PI) / 2) * 80, 0],
                y: [0, Math.sin((i * Math.PI) / 2) * 80, 0],
                opacity: [0.3, 1, 0.3],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.5,
              }}
            />
          ))}
        </div>

        <h1 className="text-2xl md:text-4xl font-bold text-white mb-4">
          AI Judges Deliberating
        </h1>

        {/* Rotating message */}
        <div className="h-16 relative overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={messageIndex}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              className="flex items-center justify-center gap-3"
            >
              <CurrentIcon className="w-6 h-6 text-cyan-400" />
              <p className="text-lg text-slate-300">
                {ANALYSIS_MESSAGES[messageIndex].text}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Progress indicators */}
        <div className="flex justify-center gap-2 mt-8">
          {ANALYSIS_MESSAGES.map((_, i) => (
            <motion.div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                i === messageIndex ? 'bg-cyan-400' : 'bg-slate-600'
              }`}
              animate={i === messageIndex ? { scale: [1, 1.4, 1] } : {}}
              transition={{ duration: 0.5 }}
            />
          ))}
        </div>

        {/* Preview cards (blurred) */}
        <div className="flex gap-3 md:gap-6 mt-8 md:mt-12 justify-center">
          {[mySubmission, opponentSubmission].map((submission, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + idx * 0.2 }}
              className="w-32 md:w-48 aspect-square rounded-xl bg-slate-800/50 border border-slate-700/50
                         overflow-hidden filter blur-sm relative"
            >
              {submission?.imageUrl && (
                <img
                  src={submission.imageUrl}
                  alt="Submission preview"
                  className="w-full h-full object-contain"
                />
              )}
              <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                <span className="text-4xl">🔒</span>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// =============================================================================
// ScoringPhase - Brief transition showing calculated scores
// =============================================================================

interface ScoringPhaseProps {
  mySubmission: Submission | null;
  opponentSubmission: Submission | null;
  opponentUsername: string;
}

export function ScoringPhase({
  mySubmission,
  opponentSubmission,
  opponentUsername,
}: ScoringPhaseProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center"
      >
        <motion.div
          animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          className="inline-block mb-6"
        >
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20
                        border-2 border-amber-500/50 flex items-center justify-center">
            <SparklesIcon className="w-12 h-12 text-amber-400" />
          </div>
        </motion.div>

        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Scores Calculated!</h2>
        <p className="text-slate-400">Preparing to reveal the results...</p>

        {/* Score preview */}
        <div className="flex justify-center gap-8 md:gap-12 mt-6 md:mt-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5, type: 'spring' }}
            className="text-center"
          >
            <div className="text-4xl md:text-5xl font-black text-cyan-400">
              {mySubmission?.score?.toFixed(1) || '?'}
            </div>
            <div className="text-xs md:text-sm text-slate-400 mt-1">Your Score</div>
          </motion.div>

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.7, type: 'spring' }}
            className="text-center"
          >
            <div className="text-4xl md:text-5xl font-black text-pink-400">
              {opponentSubmission?.score?.toFixed(1) || '?'}
            </div>
            <div className="text-xs md:text-sm text-slate-400 mt-1">{opponentUsername}</div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

// =============================================================================
// ConfettiEffect - Winner celebration particles
// =============================================================================

export function ConfettiEffect() {
  return (
    <div className="fixed inset-0 pointer-events-none z-50" aria-hidden="true">
      {Array.from({ length: 50 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-3 h-3 rounded-full"
          style={{
            background: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'][i % 6],
            left: `${Math.random() * 100}%`,
            top: '-10px',
          }}
          animate={{
            y: ['0vh', '100vh'],
            x: [0, (Math.random() - 0.5) * 200],
            rotate: [0, 720],
            opacity: [1, 0],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            delay: Math.random() * 0.5,
            ease: 'easeIn',
          }}
        />
      ))}
    </div>
  );
}

// =============================================================================
// SubmissionCard - Revealed submission with scores and feedback
// =============================================================================

interface SubmissionCardProps {
  submission: Submission | null;
  player: Player;
  isRevealed: boolean;
  isWinner: boolean;
  showWinner: boolean;
  isCurrentUser?: boolean;
  accentColor: 'cyan' | 'pink';
}

export function SubmissionCard({
  submission,
  player,
  isRevealed,
  isWinner,
  showWinner,
  isCurrentUser = false,
  accentColor,
}: SubmissionCardProps) {
  const borderColor = accentColor === 'cyan' ? 'border-cyan-500/50' : 'border-pink-500/50';
  const scoreColor = accentColor === 'cyan' ? 'text-cyan-300' : 'text-pink-300';

  return (
    <motion.div
      initial={{ opacity: 0, x: accentColor === 'cyan' ? -50 : 50 }}
      animate={{
        opacity: isRevealed ? 1 : 0.3,
        x: 0,
        filter: isRevealed ? 'blur(0px)' : 'blur(8px)',
      }}
      transition={{ duration: 0.6 }}
      className={`flex-1 rounded-2xl overflow-hidden bg-slate-900/50 border-2 transition-all relative ${
        showWinner && isWinner
          ? 'border-amber-400 shadow-[0_0_40px_rgba(251,191,36,0.4)]'
          : 'border-slate-700/50'
      }`}
    >
      {/* Winner badge */}
      {showWinner && isWinner && (
        <motion.div
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.3 }}
          className="absolute top-4 right-4 z-10"
        >
          <div className="p-3 rounded-full bg-amber-500 shadow-lg">
            <TrophyIcon className="w-8 h-8 text-white" />
          </div>
        </motion.div>
      )}

      {/* Image */}
      <div className="aspect-video relative overflow-hidden bg-slate-800">
        {submission?.imageUrl ? (
          <motion.img
            src={submission.imageUrl}
            alt={isCurrentUser ? 'Your creation' : `${player.username}'s creation`}
            className="w-full h-full object-contain"
            initial={{ scale: 1.1 }}
            animate={{ scale: isRevealed ? 1 : 1.1 }}
            transition={{ duration: 0.5 }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-600">
            No image
          </div>
        )}

        {/* Locked overlay when not revealed */}
        {!isRevealed && (
          <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center">
            <span className="text-6xl">🔒</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white text-lg">{player.username}</span>
            {isCurrentUser && (
              <span className="px-2 py-0.5 rounded text-xs bg-cyan-500/20 text-cyan-400">YOU</span>
            )}
            {player.isAi && (
              <span className="px-2 py-0.5 rounded text-xs bg-violet-500/20 text-violet-400">AI</span>
            )}
          </div>
          {isRevealed && submission?.score != null && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-2"
            >
              <SparklesIcon className="w-5 h-5 text-amber-400" />
              <span className="text-2xl font-bold text-white">
                {submission.score.toFixed(1)}
              </span>
            </motion.div>
          )}
        </div>

        {/* Prompt */}
        {isRevealed && submission?.promptText && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className={`mb-4 p-3 rounded-lg bg-slate-800/50 border-l-2 ${borderColor}`}
          >
            <p className="text-sm text-slate-300 italic">"{submission.promptText}"</p>
          </motion.div>
        )}

        {/* Criteria scores */}
        {isRevealed && submission?.criteriaScores && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-2 gap-2"
          >
            {Object.entries(submission.criteriaScores).map(([criterion, score]) => (
              <div
                key={criterion}
                className="flex justify-between items-center px-3 py-1.5 rounded-lg bg-white/5"
              >
                <span className="text-xs text-slate-400">{criterion}</span>
                <span className={`text-sm font-semibold ${scoreColor}`}>{score}</span>
              </div>
            ))}
          </motion.div>
        )}

        {/* Feedback */}
        {isRevealed && submission?.feedback && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-3 text-xs text-slate-500 italic"
          >
            {submission.feedback}
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}

// =============================================================================
// WinnerAnnouncement - Final result display
// =============================================================================

interface WinnerAnnouncementProps {
  isWinner: boolean;
  isTie: boolean;
  opponentUsername: string;
  lossFeedback: { mainReason: string; tip: string };
  prefersReducedMotion: boolean;
}

export function WinnerAnnouncement({
  isWinner,
  isTie,
  opponentUsername,
  lossFeedback,
  prefersReducedMotion,
}: WinnerAnnouncementProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 50 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'spring', stiffness: 200 }}
      className="text-center mt-10"
      role="alert"
      aria-live="assertive"
    >
      {isTie ? (
        <div className="inline-flex items-center gap-2 md:gap-3 px-6 py-3 md:px-8 md:py-4 rounded-2xl bg-slate-800/50 border border-slate-600">
          <StarIcon className="w-6 h-6 md:w-8 md:h-8 text-slate-400" aria-hidden="true" />
          <span className="text-xl md:text-2xl font-bold text-slate-300">It's a Tie!</span>
          <StarIcon className="w-6 h-6 md:w-8 md:h-8 text-slate-400" aria-hidden="true" />
        </div>
      ) : isWinner ? (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
          className="inline-flex flex-col items-center gap-3 md:gap-4 px-8 py-6 md:px-12 md:py-8 rounded-3xl
                   bg-gradient-to-br from-amber-500/20 to-orange-500/20
                   border border-amber-500/50
                   shadow-[0_0_60px_rgba(251,191,36,0.3)]"
        >
          <motion.div
            animate={prefersReducedMotion ? {} : {
              rotate: [0, -10, 10, -10, 10, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <TrophyIcon className="w-14 h-14 md:w-20 md:h-20 text-amber-400" aria-hidden="true" />
          </motion.div>
          <span className="text-3xl md:text-4xl font-bold text-amber-300">Victory!</span>
          <span className="text-sm md:text-base text-slate-400">+50 XP earned</span>
        </motion.div>
      ) : (
        <div className="inline-flex flex-col items-center gap-3 md:gap-4 px-6 py-5 md:px-10 md:py-8 rounded-2xl bg-slate-800/50 border border-slate-600 max-w-md">
          <span className="text-xl md:text-2xl font-bold text-slate-300">
            {opponentUsername} Wins!
          </span>

          {/* Why you lost */}
          <div className="text-center space-y-2">
            <p className="text-sm md:text-base text-slate-400">
              {lossFeedback.mainReason}
            </p>
            <div className="px-4 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <p className="text-xs md:text-sm text-cyan-300">
                💡 <span className="font-medium">Tip:</span> {lossFeedback.tip}
              </p>
            </div>
          </div>

          <span className="text-sm text-slate-500">+10 XP for participating</span>
        </div>
      )}
    </motion.div>
  );
}

// =============================================================================
// ActionButtons - Post-reveal action buttons
// =============================================================================

interface ActionButtonsProps {
  battleId?: number;
  onShareClick?: () => void;
  onPlayAgain?: () => void;
  onGoHome?: () => void;
}

export function ActionButtons({
  battleId,
  onShareClick,
  onPlayAgain,
  onGoHome,
}: ActionButtonsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="flex justify-center gap-4 flex-wrap mt-8"
    >
      {battleId && onShareClick && (
        <button
          onClick={onShareClick}
          className="btn-primary flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-400 hover:to-pink-400"
        >
          <ShareIcon className="w-5 h-5" />
          Share Result
        </button>
      )}
      {onPlayAgain && (
        <button
          onClick={onPlayAgain}
          className="btn-primary flex items-center gap-2 px-6 py-3"
        >
          <ArrowPathIcon className="w-5 h-5" />
          Play Again
        </button>
      )}
      {onGoHome && (
        <button
          onClick={onGoHome}
          className="btn-secondary flex items-center gap-2 px-6 py-3"
        >
          <HomeIcon className="w-5 h-5" />
          Back to Home
        </button>
      )}
    </motion.div>
  );
}
