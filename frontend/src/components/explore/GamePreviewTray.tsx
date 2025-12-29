/**
 * GamePreviewTray - Right-side tray for game details
 *
 * Opens from the explore feed when a game card is clicked.
 * Shows game details and a "Play Now" button that navigates to the game.
 */

import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faTimes, faTrophy, faGamepad, faStar } from '@fortawesome/free-solid-svg-icons';
import type { GameConfig } from '@/components/chat/games/gameRegistry';

interface GamePreviewTrayProps {
  game: GameConfig | null;
  isOpen: boolean;
  onClose: () => void;
}

// Game URLs mapping
const GAME_URLS: Record<string, string> = {
  snake: '/play/context-snake',
  ethics: '/play/ethics-defender',
  prompt_battle: '/play/prompt-battles',
  quiz: '/games#side-quests', // Quiz doesn't have a dedicated page
};

// Game-specific colors
const GAME_COLORS: Record<string, { gradient: string; accent: string; border: string }> = {
  snake: {
    gradient: 'from-cyan-500/20 to-cyan-600/10',
    accent: 'text-cyan-400',
    border: 'border-cyan-500/30',
  },
  ethics: {
    gradient: 'from-violet-500/20 to-violet-600/10',
    accent: 'text-violet-400',
    border: 'border-violet-500/30',
  },
  prompt_battle: {
    gradient: 'from-pink-500/20 to-pink-600/10',
    accent: 'text-pink-400',
    border: 'border-pink-500/30',
  },
  quiz: {
    gradient: 'from-amber-500/20 to-amber-600/10',
    accent: 'text-amber-400',
    border: 'border-amber-500/30',
  },
};

// Points per game (approximate)
const GAME_POINTS: Record<string, number> = {
  snake: 60,
  ethics: 50,
  prompt_battle: 200,
  quiz: 25,
};

export function GamePreviewTray({ game, isOpen, onClose }: GamePreviewTrayProps) {
  if (!game) return null;

  const colors = GAME_COLORS[game.id] || GAME_COLORS.quiz;
  const gameUrl = GAME_URLS[game.id] || '/games';
  const points = GAME_POINTS[game.id] || 50;

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Tray */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[400px] md:w-[450px] bg-slate-900 z-50 transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center transition-colors"
        >
          <FontAwesomeIcon icon={faTimes} className="text-slate-400" />
        </button>

        {/* Content */}
        <div className="h-full overflow-y-auto">
          {/* Hero Image */}
          <div className={`relative h-64 bg-gradient-to-br ${colors.gradient}`}>
            {game.promoImage ? (
              <img
                src={game.promoImage}
                alt={game.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <FontAwesomeIcon
                  icon={game.icon}
                  className={`text-8xl ${colors.accent} opacity-30`}
                />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent" />

            {/* Game badge */}
            <div className="absolute top-4 left-4">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${colors.accent} ${colors.border} border backdrop-blur-sm flex items-center gap-1.5`}
              >
                <FontAwesomeIcon icon={faGamepad} />
                GAME
              </span>
            </div>
          </div>

          {/* Details */}
          <div className="p-6 space-y-6">
            {/* Title and tagline */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">{game.name}</h2>
              <p className={`text-sm ${colors.accent} font-medium`}>{game.tagline}</p>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 ${colors.border} border`}>
                <FontAwesomeIcon icon={game.icon} className={colors.accent} />
                <span className="text-sm text-slate-300 capitalize">{game.category}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-amber-500/30">
                <FontAwesomeIcon icon={faTrophy} className="text-amber-400" />
                <span className="text-sm text-amber-400 font-medium">Up to +{points} pts</span>
              </div>
            </div>

            {/* Description */}
            <div>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">
                About This Game
              </h3>
              <p className="text-slate-300 leading-relaxed">{game.description}</p>
            </div>

            {/* Why Play */}
            <div>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Why Play?
              </h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <FontAwesomeIcon icon={faStar} className="text-amber-400 mt-1 flex-shrink-0" />
                  <span className="text-slate-300 text-sm">Earn points while learning AI concepts</span>
                </li>
                <li className="flex items-start gap-2">
                  <FontAwesomeIcon icon={faStar} className="text-amber-400 mt-1 flex-shrink-0" />
                  <span className="text-slate-300 text-sm">Compete on the leaderboard</span>
                </li>
                <li className="flex items-start gap-2">
                  <FontAwesomeIcon icon={faStar} className="text-amber-400 mt-1 flex-shrink-0" />
                  <span className="text-slate-300 text-sm">Fun, quick gameplay sessions</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Fixed Play Button */}
          <div className="sticky bottom-0 p-6 bg-gradient-to-t from-slate-900 via-slate-900 to-transparent">
            <Link
              to={gameUrl}
              onClick={onClose}
              className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-white transition-all hover:scale-[1.02] hover:shadow-lg ${
                game.id === 'snake'
                  ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500'
                  : game.id === 'ethics'
                  ? 'bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-400 hover:to-violet-500'
                  : game.id === 'prompt_battle'
                  ? 'bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500'
              }`}
            >
              <FontAwesomeIcon icon={faPlay} />
              Play Now
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
