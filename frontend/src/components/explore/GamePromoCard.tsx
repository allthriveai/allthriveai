/**
 * GamePromoCard - Explore feed card for games
 *
 * Displays game promo cards in the explore feed.
 * Clicking opens a preview tray with game details and play button.
 */

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faTrophy, faGamepad } from '@fortawesome/free-solid-svg-icons';
import type { GameConfig } from '@/components/chat/games/gameRegistry';

interface GamePromoCardProps {
  game: GameConfig;
  onClick: () => void;
}

// Game-specific colors for visual distinction
const GAME_COLORS: Record<string, { border: string; accent: string; glow: string }> = {
  snake: {
    border: 'rgba(34, 211, 238, 0.3)',
    accent: 'text-cyan-400',
    glow: 'rgba(34, 211, 238, 0.2)',
  },
  ethics: {
    border: 'rgba(139, 92, 246, 0.3)',
    accent: 'text-violet-400',
    glow: 'rgba(139, 92, 246, 0.2)',
  },
  prompt_battle: {
    border: 'rgba(236, 72, 153, 0.3)',
    accent: 'text-pink-400',
    glow: 'rgba(236, 72, 153, 0.2)',
  },
  quiz: {
    border: 'rgba(251, 191, 36, 0.3)',
    accent: 'text-amber-400',
    glow: 'rgba(251, 191, 36, 0.2)',
  },
};

export function GamePromoCard({ game, onClick }: GamePromoCardProps) {
  const colors = GAME_COLORS[game.id] || GAME_COLORS.quiz;

  return (
    <button
      onClick={onClick}
      className="group relative w-full overflow-hidden rounded-2xl transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl text-left"
      style={{ border: `1px solid ${colors.border}` }}
    >
      {/* Promo Image or Fallback */}
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-800">
        {game.promoImage ? (
          <img
            src={game.promoImage}
            alt={game.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
            <FontAwesomeIcon
              icon={game.icon}
              className={`text-6xl ${colors.accent} opacity-50`}
            />
          </div>
        )}

        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Game badge */}
        <div className="absolute top-3 left-3">
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-sm border flex items-center gap-1"
            style={{
              backgroundColor: colors.glow,
              borderColor: colors.border,
            }}
          >
            <FontAwesomeIcon icon={faGamepad} className={colors.accent} />
            <span className={colors.accent}>GAME</span>
          </span>
        </div>

        {/* Play Button Overlay */}
        <div
          className="absolute top-3 right-3 w-10 h-10 rounded-full backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:scale-110"
          style={{
            backgroundColor: colors.glow,
            border: `1px solid ${colors.border}`,
          }}
        >
          <FontAwesomeIcon icon={faPlay} className="text-white text-sm ml-0.5" />
        </div>

        {/* Content overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className={`font-bold text-lg text-white group-hover:${colors.accent} transition-colors`}>
            {game.name}
          </h3>
          <p className="text-sm text-gray-300 mb-2 line-clamp-2">
            {game.description}
          </p>

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <FontAwesomeIcon icon={game.icon} className={colors.accent} />
              <span className="text-gray-300 capitalize">{game.category}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FontAwesomeIcon icon={faTrophy} className="text-amber-400" />
              <span className="text-amber-400 font-medium">+Points</span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
