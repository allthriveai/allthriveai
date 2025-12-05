/**
 * BattleResultSection - Display a prompt battle result in a project portfolio
 *
 * Shows both submissions side by side with scores, criteria breakdown, and feedback.
 */

import { TrophyIcon, SparklesIcon, StarIcon } from '@heroicons/react/24/solid';

interface BattleSubmission {
  prompt: string;
  imageUrl?: string;
  score?: number | null;
  criteriaScores?: Record<string, number>;
  feedback?: string;
}

interface BattleResultContent {
  battleId: number;
  challengeText: string;
  challengeType?: {
    key: string;
    name: string;
  };
  won: boolean;
  isTie: boolean;
  mySubmission: BattleSubmission;
  opponent: {
    username: string;
    isAi: boolean;
  };
  opponentSubmission?: BattleSubmission;
}

interface BattleResultSectionProps {
  content: BattleResultContent;
}

function ScoreBreakdown({ scores }: { scores?: Record<string, number> }) {
  if (!scores) return null;

  return (
    <div className="grid grid-cols-2 gap-2 mt-3">
      {Object.entries(scores).map(([criterion, score]) => (
        <div
          key={criterion}
          className="flex justify-between items-center px-3 py-1.5 rounded-lg bg-slate-800/50"
        >
          <span className="text-xs text-slate-400">{criterion}</span>
          <span className="text-sm font-semibold text-cyan-300">{score}</span>
        </div>
      ))}
    </div>
  );
}

function SubmissionCard({
  submission,
  username,
  isWinner,
  isCurrentUser,
  isAi,
}: {
  submission: BattleSubmission;
  username: string;
  isWinner: boolean;
  isCurrentUser?: boolean;
  isAi?: boolean;
}) {
  // Guard against undefined submission
  if (!submission) {
    return (
      <div className="flex-1 rounded-2xl bg-slate-900/50 border border-slate-700/50 flex items-center justify-center min-h-[400px]">
        <p className="text-slate-500">Submission data unavailable</p>
      </div>
    );
  }

  return (
    <div
      className={`
        relative flex-1 rounded-2xl overflow-hidden bg-slate-900/50 border
        ${isWinner ? 'border-amber-500/50 ring-2 ring-amber-400/30' : 'border-slate-700/50'}
      `}
    >
      {/* Winner badge */}
      {isWinner && (
        <div className="absolute top-3 right-3 z-10">
          <div className="p-2 rounded-full bg-amber-500 shadow-lg">
            <TrophyIcon className="w-5 h-5 text-white" />
          </div>
        </div>
      )}

      {/* Image */}
      <div className="aspect-square bg-slate-800/50 relative overflow-hidden">
        {submission.imageUrl ? (
          <img
            src={submission.imageUrl}
            alt={`${username}'s creation`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-600">
            No image
          </div>
        )}
      </div>

      {/* Info section */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">{username}</span>
            {isCurrentUser && (
              <span className="px-2 py-0.5 rounded text-xs bg-cyan-500/20 text-cyan-400">
                YOU
              </span>
            )}
            {isAi && (
              <span className="px-2 py-0.5 rounded text-xs bg-violet-500/20 text-violet-400">
                AI
              </span>
            )}
          </div>
          {submission.score != null && (
            <div className="flex items-center gap-1">
              <SparklesIcon className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-white">{submission.score.toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Prompt */}
        {submission.prompt && (
          <div className="mb-3 p-3 rounded-lg bg-slate-800/50 border-l-2 border-cyan-500/50">
            <p className="text-sm text-slate-300 italic">"{submission.prompt}"</p>
          </div>
        )}

        {/* Score breakdown */}
        <ScoreBreakdown scores={submission.criteriaScores} />

        {/* Feedback */}
        {submission.feedback && (
          <p className="mt-3 text-xs text-slate-500 italic line-clamp-3">
            {submission.feedback}
          </p>
        )}
      </div>
    </div>
  );
}

export function BattleResultSection({ content }: BattleResultSectionProps) {
  // Defensive null check for content
  if (!content) {
    return (
      <section className="project-section" data-section-type="battle-result">
        <p className="text-slate-400">Battle data not available</p>
      </section>
    );
  }

  const {
    challengeText,
    challengeType,
    won,
    isTie,
    mySubmission,
    opponent,
    opponentSubmission,
  } = content;

  // Provide default opponent if missing
  const safeOpponent = opponent || { username: 'Opponent', isAi: false };

  return (
    <section className="project-section" data-section-type="battle-result">
      {/* Challenge Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-2xl font-bold text-white">Prompt Battle</h2>
          {challengeType && (
            <span className="px-3 py-1 rounded-full text-sm bg-violet-500/20 text-violet-300 border border-violet-500/30">
              {challengeType.name}
            </span>
          )}
        </div>
        <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-violet-500/10 border border-cyan-500/20">
          <p className="text-lg text-slate-200">{challengeText || 'Challenge not available'}</p>
        </div>
      </div>

      {/* Result Banner */}
      <div className="mb-8 text-center">
        {isTie ? (
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-slate-800/50 border border-slate-600">
            <StarIcon className="w-6 h-6 text-slate-400" />
            <span className="text-xl font-bold text-slate-300">It's a Tie!</span>
            <StarIcon className="w-6 h-6 text-slate-400" />
          </div>
        ) : won ? (
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/50">
            <TrophyIcon className="w-6 h-6 text-amber-400" />
            <span className="text-xl font-bold text-amber-300">Victory!</span>
            <TrophyIcon className="w-6 h-6 text-amber-400" />
          </div>
        ) : (
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-slate-800/50 border border-slate-600">
            <span className="text-xl font-bold text-slate-300">
              {safeOpponent.username} Won
            </span>
          </div>
        )}
      </div>

      {/* Submissions Side by Side */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* My Submission */}
        {mySubmission ? (
          <SubmissionCard
            submission={mySubmission}
            username="You"
            isWinner={won}
            isCurrentUser={true}
          />
        ) : (
          <div className="flex-1 rounded-2xl bg-slate-900/50 border border-slate-700/50 flex items-center justify-center min-h-[400px]">
            <p className="text-slate-500">Your submission not available</p>
          </div>
        )}

        {/* VS Divider */}
        <div className="flex md:flex-col items-center justify-center px-4 py-2 md:py-0">
          <div className="flex-1 md:w-px md:h-full bg-gradient-to-b from-transparent via-cyan-500/50 to-transparent hidden md:block" />
          <span className="px-3 py-1 rounded-full bg-slate-800 border border-cyan-500/30 text-cyan-400 font-bold text-sm">
            VS
          </span>
          <div className="flex-1 md:w-px md:h-full bg-gradient-to-b from-transparent via-cyan-500/50 to-transparent hidden md:block" />
        </div>

        {/* Opponent Submission */}
        {opponentSubmission ? (
          <SubmissionCard
            submission={opponentSubmission}
            username={safeOpponent.username}
            isWinner={!won && !isTie}
            isAi={safeOpponent.isAi}
          />
        ) : (
          <div className="flex-1 rounded-2xl bg-slate-900/50 border border-slate-700/50 flex items-center justify-center min-h-[400px]">
            <p className="text-slate-500">No opponent submission</p>
          </div>
        )}
      </div>
    </section>
  );
}
