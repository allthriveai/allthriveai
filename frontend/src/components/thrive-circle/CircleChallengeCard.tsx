/**
 * CircleChallengeCard - Shared circle challenge with Neon Glass aesthetic
 */

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBullseye,
  faRocket,
  faComments,
  faFire,
  faTrophy,
  faCheck,
  faStar,
  faBolt,
} from '@fortawesome/free-solid-svg-icons';
import type { CircleChallenge, CircleChallengeType } from '@/types/models';

interface CircleChallengeCardProps {
  challenge: CircleChallenge;
  variant?: 'hero' | 'card';
}

const CHALLENGE_ICONS: Record<CircleChallengeType, typeof faRocket> = {
  // Backend challenge types
  create_projects: faRocket,
  give_feedback: faComments,
  complete_quests: faTrophy,
  earn_points: faStar,
  maintain_streaks: faFire,
  // Legacy challenge types (kept for backwards compatibility)
  projects_created: faRocket,
  comments_given: faComments,
  streak_days: faFire,
  quizzes_completed: faTrophy,
};

const CHALLENGE_COLORS: Record<CircleChallengeType, { gradient: string; glow: string }> = {
  // Backend challenge types
  create_projects: { gradient: 'from-purple-500 to-pink-500', glow: 'shadow-[0_0_30px_rgba(168,85,247,0.3)]' },
  give_feedback: { gradient: 'from-cyan-500 to-blue-500', glow: 'shadow-[0_0_30px_rgba(6,182,212,0.3)]' },
  complete_quests: { gradient: 'from-emerald-500 to-green-500', glow: 'shadow-[0_0_30px_rgba(16,185,129,0.3)]' },
  earn_points: { gradient: 'from-yellow-500 to-amber-500', glow: 'shadow-[0_0_30px_rgba(245,158,11,0.3)]' },
  maintain_streaks: { gradient: 'from-orange-500 to-red-500', glow: 'shadow-[0_0_30px_rgba(249,115,22,0.3)]' },
  // Legacy challenge types (kept for backwards compatibility)
  projects_created: { gradient: 'from-purple-500 to-pink-500', glow: 'shadow-[0_0_30px_rgba(168,85,247,0.3)]' },
  comments_given: { gradient: 'from-cyan-500 to-blue-500', glow: 'shadow-[0_0_30px_rgba(6,182,212,0.3)]' },
  streak_days: { gradient: 'from-orange-500 to-red-500', glow: 'shadow-[0_0_30px_rgba(249,115,22,0.3)]' },
  quizzes_completed: { gradient: 'from-emerald-500 to-green-500', glow: 'shadow-[0_0_30px_rgba(16,185,129,0.3)]' },
};

export function CircleChallengeCard({ challenge, variant = 'card' }: CircleChallengeCardProps) {
  const icon = CHALLENGE_ICONS[challenge.challengeType] || faBullseye;
  const colors = CHALLENGE_COLORS[challenge.challengeType] || { gradient: 'from-cyan-500 to-cyan-bright', glow: 'shadow-neon' };

  if (variant === 'hero') {
    return (
      <div className={`glass-card neon-border relative overflow-hidden ${challenge.isCompleted ? 'border-emerald-500/50' : ''}`}>
        {/* Background glow */}
        <div className={`absolute inset-0 bg-gradient-to-br ${colors.gradient} opacity-5`} />

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${colors.gradient} flex items-center justify-center ${colors.glow}`}>
              {challenge.isCompleted ? (
                <FontAwesomeIcon icon={faCheck} className="text-2xl text-white" />
              ) : (
                <FontAwesomeIcon icon={icon} className="text-2xl text-white" />
              )}
            </div>
            <div>
              <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-xs text-slate-400 mb-1">
                <span className="luminous-dot animate-pulse" />
                This Week's Challenge
              </div>
              <h3 className="text-xl font-bold text-white">{challenge.title}</h3>
            </div>
          </div>

          {challenge.description && (
            <div className="mb-6">
              <p className="text-base text-gray-700 dark:text-slate-300 leading-relaxed">{challenge.description}</p>
            </div>
          )}

          {/* Progress Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <span className="text-4xl font-bold text-white">{challenge.currentProgress}</span>
                <span className="text-slate-500 text-lg">/{challenge.target}</span>
              </div>
              {challenge.isCompleted ? (
                <span className="flex items-center gap-2 text-emerald-400 font-medium">
                  <FontAwesomeIcon icon={faCheck} />
                  Challenge Complete!
                </span>
              ) : (
                <span className="text-slate-500 text-sm">
                  {challenge.target - challenge.currentProgress} to go
                </span>
              )}
            </div>

            {/* Progress Bar */}
            <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/10">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  challenge.isCompleted
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                    : `bg-gradient-to-r ${colors.gradient}`
                }`}
                style={{ width: `${Math.min(100, challenge.progressPercentage)}%` }}
              />
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-slate-500">{challenge.progressPercentage}% complete</span>
              <span className="flex items-center gap-2 text-cyan-bright">
                <FontAwesomeIcon icon={faStar} className="text-yellow-400" />
                +{challenge.bonusPoints} points
              </span>
            </div>
          </div>
        </div>

        {/* Circuit decorations */}
        <div className="circuit-connector absolute bottom-4 opacity-20" />
      </div>
    );
  }

  // Card variant (for sidebar)
  return (
    <div className={`glass-card group hover:border-cyan-500/30 transition-all ${challenge.isCompleted ? 'border-emerald-500/30' : ''}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors.gradient} flex items-center justify-center text-white ${challenge.isCompleted ? '' : colors.glow}`}>
          {challenge.isCompleted ? (
            <FontAwesomeIcon icon={faCheck} />
          ) : (
            <FontAwesomeIcon icon={icon} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white truncate">{challenge.title}</div>
          <div className="text-xs text-slate-500">
            <span className="text-cyan-bright">{challenge.currentProgress}</span>
            /{challenge.target}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
        <div
          className={`h-full transition-all duration-500 rounded-full ${
            challenge.isCompleted
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
              : `bg-gradient-to-r ${colors.gradient}`
          }`}
          style={{ width: `${Math.min(100, challenge.progressPercentage)}%` }}
        />
      </div>

      {challenge.isCompleted ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400">
          <FontAwesomeIcon icon={faCheck} />
          +{challenge.bonusPoints} points earned!
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <FontAwesomeIcon icon={faBolt} className="text-cyan-bright/60" />
          +{challenge.bonusPoints} points on completion
        </div>
      )}
    </div>
  );
}
