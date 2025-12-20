/**
 * PeopleToConnectMessage - Displays user suggestions in chat
 *
 * Features:
 * - Horizontal scrolling carousel of user cards
 * - Follow functionality on each card
 * - Match reasons based on shared interests
 * - Neon glass styling to match chat aesthetic
 */

import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDragon, faArrowRight, faUserPlus } from '@fortawesome/free-solid-svg-icons';
import { ChatUserTeaserCard, type UserSuggestion } from '../cards/ChatUserTeaserCard';

interface PeopleToConnectMessageProps {
  hasSuggestions: boolean;
  suggestions: UserSuggestion[];
  reason?: string;
  message?: string;
  cta: {
    url: string;
    label: string;
  };
  onNavigate?: (path: string) => void;
  onFollowChange?: (userId: number, isFollowing: boolean) => void;
}

export function PeopleToConnectMessage({
  hasSuggestions,
  suggestions,
  reason,
  message,
  cta,
  onNavigate,
  onFollowChange,
}: PeopleToConnectMessageProps) {
  const handleNavigate = (e: React.MouseEvent, path: string) => {
    if (onNavigate) {
      e.preventDefault();
      onNavigate(path);
    }
  };

  // No suggestions - show setup profile prompt
  if (!hasSuggestions || suggestions.length === 0) {
    const isNoPreferences = reason === 'no_user_preferences';

    return (
      <div className="flex justify-start">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500/20 to-amber-600/20 flex items-center justify-center flex-shrink-0 mr-4">
          <FontAwesomeIcon icon={faDragon} className="w-6 h-6 text-orange-400" />
        </div>
        <div className="flex-1 glass-subtle px-5 py-4 rounded-2xl rounded-bl-sm">
          {isNoPreferences ? (
            <>
              <p className="text-slate-200 mb-3">
                To find people with similar interests, let's set up your profile first! Tell me about your goals and interests.
              </p>
              <Link
                to={cta.url}
                onClick={(e) => handleNavigate(e, cta.url)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <FontAwesomeIcon icon={faUserPlus} className="w-3.5 h-3.5" />
                {cta.label}
              </Link>
            </>
          ) : (
            <>
              <p className="text-slate-200">
                {message || "I couldn't find any new people to suggest right now. Keep exploring and engaging with the community!"}
              </p>
              <Link
                to={cta.url}
                onClick={(e) => handleNavigate(e, cta.url)}
                className="inline-flex items-center gap-2 mt-3 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                {cta.label}
                <FontAwesomeIcon icon={faArrowRight} className="w-3 h-3" />
              </Link>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start w-full">
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500/20 to-amber-600/20 flex items-center justify-center flex-shrink-0 mr-4">
        <FontAwesomeIcon icon={faDragon} className="w-6 h-6 text-orange-400" />
      </div>
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="glass-subtle px-5 py-3 rounded-2xl rounded-bl-sm mb-3">
          <p className="text-slate-200">
            Here are some <span className="text-violet-400 font-medium">creators</span> you might like to connect with:
          </p>
        </div>

        {/* Horizontal scrolling cards */}
        <div className="overflow-x-auto pb-2 -mx-2 px-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          <div className="flex gap-3">
            {suggestions.map((user) => (
              <ChatUserTeaserCard
                key={user.userId}
                user={user}
                onNavigate={onNavigate}
                onFollowChange={onFollowChange}
              />
            ))}
          </div>
        </div>

        {/* Discover more link */}
        <div className="mt-3">
          <Link
            to={cta.url}
            onClick={(e) => handleNavigate(e, cta.url)}
            className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            {cta.label}
            <FontAwesomeIcon icon={faArrowRight} className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
