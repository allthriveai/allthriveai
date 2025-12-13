/**
 * JudgingReveal Component
 *
 * Dramatic animated sequence for battle judging and winner reveal.
 * Shows AI analysis animation, then reveals both prompts with scores,
 * and finally announces the winner with celebration effects.
 *
 * Sub-components are extracted to JudgingRevealParts.tsx for maintainability.
 */

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { BattleShareModal } from './BattleShareModal';
import {
  ANALYSIS_MESSAGES,
  AnalyzingPhase,
  ScoringPhase,
  ConfettiEffect,
  SubmissionCard,
  WinnerAnnouncement,
  ActionButtons,
  type Submission,
  type Player,
} from './JudgingRevealParts';

// =============================================================================
// Types
// =============================================================================

type RevealPhase =
  | 'analyzing'      // Initial AI analysis animation
  | 'scoring'        // Showing scores being calculated
  | 'reveal-left'    // Revealing left player's submission
  | 'reveal-right'   // Revealing right player's submission
  | 'winner'         // Final winner announcement
  | 'complete';      // All animations done

interface JudgingRevealProps {
  mySubmission: Submission | null;
  opponentSubmission: Submission | null;
  myPlayer: Player;
  opponent: Player;
  winnerId: number | null;
  onComplete?: () => void;
  onPlayAgain?: () => void;
  onGoHome?: () => void;
  isJudging?: boolean;
  challengeText?: string;
  battleId?: number;
}

// =============================================================================
// Feedback Generation
// =============================================================================

const FEEDBACK_TEMPLATES: Record<string, { reason: string; tip: string }> = {
  creativity: {
    reason: 'Your opponent scored higher on creativity.',
    tip: 'Try combining unexpected elements or adding unique twists to stand out!',
  },
  visual_impact: {
    reason: "Your opponent's image had stronger visual impact.",
    tip: 'Use bold colors, dramatic lighting, or striking composition to make your image pop!',
  },
  relevance: {
    reason: 'Your opponent matched the challenge theme more closely.',
    tip: 'Make sure to explicitly include all key elements from the challenge in your prompt.',
  },
  cohesion: {
    reason: "Your opponent's image had better cohesion.",
    tip: 'Focus on making all elements work together harmoniously - consistent style, mood, and color palette.',
  },
  adherence: {
    reason: 'Your opponent matched the challenge theme more closely.',
    tip: 'Make sure to explicitly include all key elements from the challenge in your prompt.',
  },
  theme_adherence: {
    reason: 'Your opponent matched the challenge theme more closely.',
    tip: 'Make sure to explicitly include all key elements from the challenge in your prompt.',
  },
  quality: {
    reason: 'Your opponent achieved higher visual quality.',
    tip: 'Add details about lighting, style, resolution, and composition to boost quality.',
  },
  visual_quality: {
    reason: 'Your opponent achieved higher visual quality.',
    tip: 'Add details about lighting, style, resolution, and composition to boost quality.',
  },
  composition: {
    reason: 'Your opponent had stronger composition.',
    tip: 'Try specifying layout, perspective, focal points, or rule of thirds in your prompt.',
  },
  originality: {
    reason: "Your opponent's concept was more original.",
    tip: 'Push for unique angles or unexpected interpretations of the theme!',
  },
  technical: {
    reason: 'Your opponent had better technical execution.',
    tip: 'Be more specific about artistic techniques, styles, and technical details.',
  },
};

function getLossFeedback(
  mySubmission: Submission | null,
  opponentSubmission: Submission | null,
): { mainReason: string; tip: string } {
  if (!mySubmission?.criteriaScores || !opponentSubmission?.criteriaScores) {
    return {
      mainReason: "Your opponent's execution edged you out this time.",
      tip: 'Try adding more descriptive details to your prompts next time!',
    };
  }

  // Find the criteria where user lost the most points
  const gaps = Object.entries(mySubmission.criteriaScores)
    .map(([criterion, myScore]) => ({
      criterion,
      diff: (opponentSubmission.criteriaScores?.[criterion] ?? 0) - myScore,
    }))
    .filter((c) => c.diff > 0)
    .sort((a, b) => b.diff - a.diff);

  const biggestGap = gaps[0];

  if (!biggestGap || biggestGap.diff < 0.5) {
    return {
      mainReason: 'It was incredibly close! The scores were nearly identical.',
      tip: "Keep experimenting - you're doing great!",
    };
  }

  const normalizedKey = biggestGap.criterion.toLowerCase().replace(/[_\s]+/g, '_');
  const template = FEEDBACK_TEMPLATES[normalizedKey];

  if (template) {
    return {
      mainReason: `${template.reason} (+${biggestGap.diff.toFixed(1)} pts)`,
      tip: template.tip,
    };
  }

  return {
    mainReason: `Your opponent scored higher on ${biggestGap.criterion.toLowerCase()} (+${biggestGap.diff.toFixed(1)} pts).`,
    tip: `Focus on improving ${biggestGap.criterion.toLowerCase()} in your next prompt!`,
  };
}

// =============================================================================
// Main Component
// =============================================================================

export function JudgingReveal({
  mySubmission,
  opponentSubmission,
  myPlayer,
  opponent,
  winnerId,
  onComplete,
  onPlayAgain,
  onGoHome,
  isJudging = false,
  challengeText,
  battleId,
}: JudgingRevealProps) {
  const [phase, setPhase] = useState<RevealPhase>('analyzing');
  const [messageIndex, setMessageIndex] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const isWinner = winnerId === myPlayer.id;
  const isTie = winnerId === null && mySubmission?.score === opponentSubmission?.score;
  const hasScores = mySubmission?.score != null && opponentSubmission?.score != null;

  // Scroll to top when entering reveal phase
  useEffect(() => {
    if (phase === 'reveal-left' || phase === 'scoring') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [phase]);

  // Rotate analysis messages
  useEffect(() => {
    if (phase !== 'analyzing') return;

    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % ANALYSIS_MESSAGES.length);
    }, 2500);

    return () => clearInterval(interval);
  }, [phase]);

  // Progress through phases when scores arrive
  useEffect(() => {
    if (!hasScores) return;

    const delays: Record<string, { next: RevealPhase; delay: number }> = {
      analyzing: { next: 'scoring', delay: 1500 },
      scoring: { next: 'reveal-left', delay: 2000 },
      'reveal-left': { next: 'reveal-right', delay: 2500 },
      'reveal-right': { next: 'winner', delay: 2500 },
    };

    const transition = delays[phase];
    if (!transition) {
      if (phase === 'winner') {
        const timer = setTimeout(() => {
          setPhase('complete');
          onComplete?.();
        }, 4000);
        return () => clearTimeout(timer);
      }
      return;
    }

    const timer = setTimeout(() => {
      setPhase(transition.next);
      if (transition.next === 'winner' && isWinner) {
        setShowConfetti(true);
      }
    }, transition.delay);

    return () => clearTimeout(timer);
  }, [phase, hasScores, isWinner, onComplete]);

  // Analyzing phase
  if (isJudging || phase === 'analyzing') {
    return (
      <AnalyzingPhase
        messageIndex={messageIndex}
        mySubmission={mySubmission}
        opponentSubmission={opponentSubmission}
      />
    );
  }

  // Scoring phase
  if (phase === 'scoring') {
    return (
      <ScoringPhase
        mySubmission={mySubmission}
        opponentSubmission={opponentSubmission}
        opponentUsername={opponent.username}
      />
    );
  }

  // Reveal phases - at this point phase is 'reveal-left', 'reveal-right', 'winner', or 'complete'
  const leftRevealed = true; // Always revealed in reveal phases
  const rightRevealed = phase === 'reveal-right' || phase === 'winner' || phase === 'complete';
  const showWinner = phase === 'winner' || phase === 'complete';

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      {/* Confetti */}
      {showConfetti && !prefersReducedMotion && <ConfettiEffect />}

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            {showWinner ? 'Battle Complete!' : 'Revealing Results...'}
          </h1>

          {challengeText && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-4 max-w-2xl mx-auto"
            >
              <div className="px-6 py-4 rounded-xl bg-slate-800/50 border border-cyan-500/30">
                <p className="text-xs text-cyan-400 uppercase tracking-wider mb-1">Challenge</p>
                <p className="text-lg text-slate-200 font-medium">"{challengeText}"</p>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Submissions grid */}
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-stretch">
          <SubmissionCard
            submission={mySubmission}
            player={myPlayer}
            isRevealed={leftRevealed}
            isWinner={winnerId === myPlayer.id}
            showWinner={showWinner}
            isCurrentUser
            accentColor="cyan"
          />

          {/* VS divider */}
          <div className="hidden lg:flex flex-col items-center justify-center px-4">
            <div className="w-px h-full bg-gradient-to-b from-transparent via-cyan-500/50 to-transparent" />
            <motion.span
              animate={showWinner ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 0.5 }}
              className="my-4 px-4 py-2 rounded-full bg-slate-800 border border-cyan-500/30
                       text-cyan-400 font-bold text-lg"
            >
              VS
            </motion.span>
            <div className="w-px h-full bg-gradient-to-b from-transparent via-cyan-500/50 to-transparent" />
          </div>

          <SubmissionCard
            submission={opponentSubmission}
            player={opponent}
            isRevealed={rightRevealed}
            isWinner={winnerId === opponent.id}
            showWinner={showWinner}
            accentColor="pink"
          />
        </div>

        {/* Winner announcement */}
        <AnimatePresence>
          {showWinner && (
            <WinnerAnnouncement
              isWinner={isWinner}
              isTie={isTie}
              opponentUsername={opponent.username}
              lossFeedback={getLossFeedback(mySubmission, opponentSubmission)}
              prefersReducedMotion={prefersReducedMotion}
            />
          )}
        </AnimatePresence>

        {/* Action buttons */}
        {phase === 'complete' && (
          <ActionButtons
            battleId={battleId}
            onShareClick={() => setShowShareModal(true)}
            onPlayAgain={onPlayAgain}
            onGoHome={onGoHome}
          />
        )}
      </div>

      {/* Share modal */}
      {battleId && (
        <BattleShareModal
          battleId={battleId}
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}

export default JudgingReveal;

// Re-export types for consumers
export type { Submission, Player } from './JudgingRevealParts';
