/**
 * ChallengeTeaserMessage - Displays current challenge teaser in chat
 *
 * Features:
 * - Hero image with gradient overlay
 * - Challenge title and description
 * - Time remaining indicator
 * - Participant count
 * - Suggested tools
 * - Join/Vote CTA button
 * - Neon glass styling to match chat aesthetic
 */

import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faDragon,
  faTrophy,
  faClock,
  faUsers,
  faArrowRight,
  faStar,
  faCheck,
} from '@fortawesome/free-solid-svg-icons';

interface ChallengeToolSuggestion {
  name: string;
  slug: string;
}

interface ChallengeUserStatus {
  hasSubmitted: boolean;
  submissionCount: number;
  canSubmitMore: boolean;
}

interface ChallengeData {
  id: string;
  title: string;
  slug: string;
  description: string;
  prompt: string;
  status: 'active' | 'voting' | 'upcoming' | 'completed';
  heroImageUrl: string | null;
  themeColor: string;
  submissionDeadline: string | null;
  timeRemaining: string;
  participantCount: number;
  submissionCount: number;
  pointsConfig: {
    submit: number;
    earlyBird: number;
    voteCast: number;
  };
  suggestedTools: ChallengeToolSuggestion[];
}

interface ChallengeTeaserMessageProps {
  hasChallenge: boolean;
  challenge?: ChallengeData;
  userStatus?: ChallengeUserStatus | null;
  cta: {
    url: string;
    label: string;
  };
  message?: string;
  onNavigate?: (path: string) => void;
}

export function ChallengeTeaserMessage({
  hasChallenge,
  challenge,
  userStatus,
  cta,
  message,
  onNavigate,
}: ChallengeTeaserMessageProps) {
  const handleNavigate = (e: React.MouseEvent, path: string) => {
    if (onNavigate) {
      e.preventDefault();
      onNavigate(path);
    }
  };

  // No challenge available
  if (!hasChallenge || !challenge) {
    return (
      <div className="flex justify-start">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500/20 to-amber-600/20 flex items-center justify-center flex-shrink-0 mr-4">
          <FontAwesomeIcon icon={faDragon} className="w-6 h-6 text-orange-400" />
        </div>
        <div className="flex-1 glass-subtle px-5 py-4 rounded-2xl rounded-bl-sm">
          <p className="text-slate-200">{message || 'No active challenges right now. Check back soon!'}</p>
          <Link
            to={cta.url}
            onClick={(e) => handleNavigate(e, cta.url)}
            className="inline-flex items-center gap-2 mt-3 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            {cta.label}
            <FontAwesomeIcon icon={faArrowRight} className="w-3 h-3" />
          </Link>
        </div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    active: 'bg-emerald-500',
    voting: 'bg-amber-500',
    upcoming: 'bg-blue-500',
    completed: 'bg-slate-500',
  };

  const statusLabels: Record<string, string> = {
    active: 'Active',
    voting: 'Voting Open',
    upcoming: 'Coming Soon',
    completed: 'Completed',
  };

  return (
    <div className="flex justify-start w-full">
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500/20 to-amber-600/20 flex items-center justify-center flex-shrink-0 mr-4">
        <FontAwesomeIcon icon={faDragon} className="w-6 h-6 text-orange-400" />
      </div>
      <div className="flex-1 min-w-0 max-w-lg">
        {/* Header */}
        <div className="glass-subtle px-5 py-3 rounded-2xl rounded-bl-sm mb-3">
          <p className="text-slate-200">
            Here's the current <span className="text-amber-400 font-medium">weekly challenge</span>:
          </p>
        </div>

        {/* Challenge Card */}
        <div className="rounded-xl overflow-hidden bg-slate-800/50 border border-white/10 hover:border-amber-500/50 transition-all duration-300 group">
          {/* Hero Image */}
          {challenge.heroImageUrl && (
            <div className="relative h-32 overflow-hidden">
              <img
                src={challenge.heroImageUrl}
                alt={challenge.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent" />

              {/* Status badge */}
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${statusColors[challenge.status]}`}>
                  {statusLabels[challenge.status]}
                </span>
              </div>

              {/* User submitted badge */}
              {userStatus?.hasSubmitted && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/80 rounded text-xs font-medium text-white">
                  <FontAwesomeIcon icon={faCheck} className="w-3 h-3" />
                  Submitted
                </div>
              )}
            </div>
          )}

          {/* Content */}
          <div className="p-4">
            {/* Title */}
            <div className="flex items-start gap-2 mb-2">
              <FontAwesomeIcon icon={faTrophy} className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <h4 className="text-base font-semibold text-white group-hover:text-amber-300 transition-colors">
                {challenge.title}
              </h4>
            </div>

            {/* Description */}
            <p className="text-sm text-slate-400 line-clamp-2 mb-3">{challenge.description}</p>

            {/* Stats row */}
            <div className="flex items-center gap-4 text-xs text-slate-400 mb-3">
              {challenge.timeRemaining && (
                <div className="flex items-center gap-1.5">
                  <FontAwesomeIcon icon={faClock} className="w-3 h-3 text-cyan-400" />
                  <span>{challenge.timeRemaining}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <FontAwesomeIcon icon={faUsers} className="w-3 h-3 text-violet-400" />
                <span>{challenge.participantCount} participants</span>
              </div>
            </div>

            {/* Points info */}
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
              <FontAwesomeIcon icon={faStar} className="w-3 h-3 text-amber-400/60" />
              <span>Earn up to {challenge.pointsConfig.submit + challenge.pointsConfig.earlyBird} points</span>
            </div>

            {/* Suggested tools */}
            {challenge.suggestedTools.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {challenge.suggestedTools.map((tool) => (
                  <span
                    key={tool.slug}
                    className="px-2 py-0.5 text-[10px] bg-slate-700/50 text-slate-300 rounded"
                  >
                    {tool.name}
                  </span>
                ))}
              </div>
            )}

            {/* CTA Button */}
            <Link
              to={cta.url}
              onClick={(e) => handleNavigate(e, cta.url)}
              className="block w-full py-2.5 px-4 rounded-lg text-sm font-medium text-center bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-500 hover:to-orange-500 transition-all"
            >
              {cta.label}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
