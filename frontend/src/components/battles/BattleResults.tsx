/**
 * BattleResults Component
 *
 * Epic reveal sequence showing both generated images,
 * scores, and winner announcement.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrophyIcon,
  SparklesIcon,
  StarIcon,
  ArrowPathIcon,
  HomeIcon,
  BookmarkIcon,
  CheckIcon,
} from '@heroicons/react/24/solid';

interface Submission {
  id: number;
  promptText: string;
  imageUrl?: string;
  score?: number;
  criteriaScores?: Record<string, number>;
  feedback?: string;
}

interface Player {
  id: number;
  username: string;
  avatarUrl?: string;
  isAi?: boolean;
}

interface BattleResultsProps {
  mySubmission: Submission | null;
  opponentSubmission?: Submission | null;
  myPlayer: Player;
  opponent: Player;
  winnerId: number | null;
  onPlayAgain?: () => void;
  onGoHome?: () => void;
  onSaveToProfile?: () => Promise<void>;
  isSaved?: boolean;
  skipRevealAnimation?: boolean;
}

export function BattleResults({
  mySubmission,
  opponentSubmission,
  myPlayer,
  opponent,
  winnerId,
  onPlayAgain,
  onGoHome,
  onSaveToProfile,
  isSaved = false,
  skipRevealAnimation = false,
}: BattleResultsProps) {
  const [revealPhase, setRevealPhase] = useState<'yours' | 'theirs' | 'winner'>(
    skipRevealAnimation ? 'winner' : 'yours'
  );
  const [isSaving, setIsSaving] = useState(false);

  const isWinner = winnerId === myPlayer.id;
  const isTie = winnerId === null && mySubmission?.score === opponentSubmission?.score;

  // Generate friendly feedback for the loser based on criteria comparison
  const getLossFeedback = (): string => {
    if (!mySubmission?.criteriaScores || !opponentSubmission?.criteriaScores) {
      return "Your prompt was creative, but your opponent's execution edged you out this time.";
    }

    // Find the criteria where user lost the most points
    const criteriaComparison = Object.entries(mySubmission.criteriaScores).map(([criterion, myScore]) => {
      const theirScore = opponentSubmission.criteriaScores?.[criterion] ?? 0;
      return { criterion, myScore, theirScore, diff: theirScore - myScore };
    });

    // Sort by biggest difference (where opponent did better)
    const biggestGap = criteriaComparison
      .filter(c => c.diff > 0)
      .sort((a, b) => b.diff - a.diff)[0];

    if (!biggestGap) {
      return "It was incredibly close! Keep experimenting with your prompts.";
    }

    // Generate friendly, encouraging feedback based on the criteria they struggled with
    const feedbackMap: Record<string, string> = {
      'creativity': "Try thinking outside the box with more unexpected elements or unique combinations in your prompts.",
      'Creativity': "Try thinking outside the box with more unexpected elements or unique combinations in your prompts.",
      'adherence': "Focus on including all the key elements from the challenge theme more explicitly in your prompt.",
      'Adherence': "Focus on including all the key elements from the challenge theme more explicitly in your prompt.",
      'theme_adherence': "Focus on including all the key elements from the challenge theme more explicitly in your prompt.",
      'Theme Adherence': "Focus on including all the key elements from the challenge theme more explicitly in your prompt.",
      'quality': "Adding more descriptive details about lighting, style, and composition can help improve visual quality.",
      'Quality': "Adding more descriptive details about lighting, style, and composition can help improve visual quality.",
      'visual_quality': "Adding more descriptive details about lighting, style, and composition can help improve visual quality.",
      'Visual Quality': "Adding more descriptive details about lighting, style, and composition can help improve visual quality.",
      'composition': "Consider the arrangement and balance of elements - try specifying layout, perspective, or focal points.",
      'Composition': "Consider the arrangement and balance of elements - try specifying layout, perspective, or focal points.",
      'originality': "Push for more unique angles or unexpected interpretations of the theme next time.",
      'Originality': "Push for more unique angles or unexpected interpretations of the theme next time.",
      'technical': "Be more specific about technical aspects like resolution, style, and artistic techniques.",
      'Technical': "Be more specific about technical aspects like resolution, style, and artistic techniques.",
    };

    return feedbackMap[biggestGap.criterion] ||
      `Your opponent scored higher on ${biggestGap.criterion.toLowerCase()}. Try focusing on that aspect next time!`;
  };

  const handleSaveToProfile = async () => {
    if (!onSaveToProfile || isSaving || isSaved) return;
    setIsSaving(true);
    try {
      await onSaveToProfile();
    } finally {
      setIsSaving(false);
    }
  };

  // Staged reveal animation (skip if already complete)
  useEffect(() => {
    if (skipRevealAnimation) return;

    const timer1 = setTimeout(() => setRevealPhase('theirs'), 2000);
    const timer2 = setTimeout(() => setRevealPhase('winner'), 4000);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [skipRevealAnimation]);

  const renderScoreBreakdown = (scores?: Record<string, number>) => {
    if (!scores) return null;

    return (
      <div className="grid grid-cols-2 gap-2 mt-4">
        {Object.entries(scores).map(([criterion, score]) => (
          <div
            key={criterion}
            className="flex justify-between items-center px-3 py-1.5 rounded-lg bg-white/5"
          >
            <span className="text-xs text-slate-400">{criterion}</span>
            <span className="text-sm font-semibold text-cyan-300">{score}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderSubmissionCard = (
    submission: Submission | null,
    player: Player,
    isCurrentUser: boolean,
    revealed: boolean
  ) => {
    const playerIsWinner = winnerId === player.id;

    return (
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: revealed ? 1 : 0.3, y: 0 }}
        transition={{ duration: 0.5 }}
        className={`
          relative flex-1 rounded-2xl overflow-hidden
          ${playerIsWinner && revealPhase === 'winner' ? 'ring-4 ring-amber-400 shadow-[0_0_60px_rgba(251,191,36,0.4)]' : ''}
          ${!revealed ? 'filter blur-sm' : ''}
        `}
      >
        {/* Image */}
        <div className="aspect-square bg-slate-800/50 relative overflow-hidden">
          {submission?.imageUrl ? (
            <motion.img
              src={submission.imageUrl}
              alt={`${player.username}'s creation`}
              className="w-full h-full object-cover"
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5 }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ArrowPathIcon className="w-12 h-12 text-slate-600 animate-spin" />
            </div>
          )}

          {/* Winner overlay */}
          {playerIsWinner && revealPhase === 'winner' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-gradient-to-t from-amber-500/30 to-transparent"
            >
              <motion.div
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
                className="absolute top-4 right-4"
              >
                <div className="p-3 rounded-full bg-amber-500 shadow-lg">
                  <TrophyIcon className="w-8 h-8 text-white" />
                </div>
              </motion.div>
            </motion.div>
          )}
        </div>

        {/* Info section */}
        <div className="p-4 bg-slate-900/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">{player.username}</span>
              {isCurrentUser && (
                <span className="px-2 py-0.5 rounded text-xs bg-cyan-500/20 text-cyan-400">
                  YOU
                </span>
              )}
              {player.isAi && (
                <span className="px-2 py-0.5 rounded text-xs bg-violet-500/20 text-violet-400">
                  AI
                </span>
              )}
            </div>
            {submission?.score != null && revealed && (
              <div className="flex items-center gap-1">
                <SparklesIcon className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-white">{submission.score.toFixed(1)}</span>
              </div>
            )}
          </div>

          {/* Full prompt display */}
          {revealed && submission?.promptText && (
            <div className="mb-3 p-3 rounded-lg bg-slate-800/50 border-l-2 border-cyan-500/50">
              <p className="text-sm text-slate-300 italic">
                "{submission.promptText}"
              </p>
            </div>
          )}

          {/* Score breakdown */}
          {revealed && renderScoreBreakdown(submission?.criteriaScores)}

          {/* Feedback */}
          {revealed && submission?.feedback && (
            <p className="mt-3 text-xs text-slate-500 italic">
              {submission.feedback}
            </p>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h2 className="text-3xl font-bold text-white mb-2">Battle Results</h2>
        <p className="text-slate-400">Let's see how you both did!</p>
      </motion.div>

      {/* Submissions grid */}
      <div className="flex gap-6 mb-8">
        {renderSubmissionCard(
          mySubmission,
          myPlayer,
          true,
          revealPhase !== 'yours' || true
        )}

        {/* VS divider */}
        <div className="flex flex-col items-center justify-center px-4">
          <div className="w-px h-full bg-gradient-to-b from-transparent via-cyan-500/50 to-transparent" />
          <span className="my-4 px-3 py-1 rounded-full bg-slate-800 border border-cyan-500/30 text-cyan-400 font-bold text-sm">
            VS
          </span>
          <div className="w-px h-full bg-gradient-to-b from-transparent via-cyan-500/50 to-transparent" />
        </div>

        {renderSubmissionCard(
          opponentSubmission ?? null,
          opponent,
          false,
          revealPhase === 'theirs' || revealPhase === 'winner'
        )}
      </div>

      {/* Winner announcement */}
      <AnimatePresence>
        {revealPhase === 'winner' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="text-center mb-8"
          >
            {isTie ? (
              <div className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-slate-800/50 border border-slate-600">
                <StarIcon className="w-8 h-8 text-slate-400" />
                <span className="text-2xl font-bold text-slate-300">It's a Tie!</span>
                <StarIcon className="w-8 h-8 text-slate-400" />
              </div>
            ) : isWinner ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                className="inline-flex flex-col items-center gap-4 px-12 py-8 rounded-3xl
                           bg-gradient-to-br from-amber-500/20 to-orange-500/20
                           border border-amber-500/50
                           shadow-[0_0_60px_rgba(251,191,36,0.3)]"
              >
                <motion.div
                  animate={{
                    rotate: [0, -10, 10, -10, 10, 0],
                    scale: [1, 1.1, 1],
                  }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                >
                  <TrophyIcon className="w-16 h-16 text-amber-400" />
                </motion.div>
                <span className="text-3xl font-bold text-amber-300">You Won!</span>
                <span className="text-slate-400">
                  +50 points earned
                </span>
              </motion.div>
            ) : (
              <div className="inline-flex flex-col items-center gap-4 px-8 py-6 rounded-2xl bg-slate-800/50 border border-slate-600 max-w-lg">
                <span className="text-2xl font-bold text-slate-300">
                  {opponent.username} Wins!
                </span>
                <p className="text-slate-400 text-center leading-relaxed">
                  {getLossFeedback()}
                </p>
                <span className="text-sm text-cyan-400">+10 points for participating</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      {revealPhase === 'winner' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex justify-center gap-4 flex-wrap"
        >
          {onSaveToProfile && (
            <button
              onClick={handleSaveToProfile}
              disabled={isSaving || isSaved}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                isSaved
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30 cursor-default'
                  : 'bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 hover:border-violet-500/50'
              } ${isSaving ? 'opacity-50 cursor-wait' : ''}`}
            >
              {isSaved ? (
                <>
                  <CheckIcon className="w-5 h-5" />
                  Saved to Profile
                </>
              ) : isSaving ? (
                <>
                  <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <BookmarkIcon className="w-5 h-5" />
                  Save to Profile
                </>
              )}
            </button>
          )}
          <button
            onClick={onPlayAgain}
            className="btn-primary flex items-center gap-2 px-6 py-3"
          >
            <ArrowPathIcon className="w-5 h-5" />
            Play Again
          </button>
          <button
            onClick={onGoHome}
            className="btn-secondary flex items-center gap-2 px-6 py-3"
          >
            <HomeIcon className="w-5 h-5" />
            Back to Home
          </button>
        </motion.div>
      )}
    </div>
  );
}

export default BattleResults;
