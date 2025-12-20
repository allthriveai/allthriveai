/**
 * GamePicker - Beautiful game selection for chat
 *
 * Shows available games as visually rich cards with promo images.
 * Styled to match ProjectCard masonry cards from the explore feed.
 * Used when user clicks "Play a game" in the chat.
 */

import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { getEnabledGames, type PlayableGameType } from './gameRegistry';

interface GamePickerProps {
  onSelectGame: (gameType: PlayableGameType) => void;
  onClose?: () => void;
}

export function GamePicker({ onSelectGame, onClose }: GamePickerProps) {
  const games = getEnabledGames();

  return (
    <motion.div
      className="w-full"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <span className="text-base font-medium text-slate-300">Pick a game:</span>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-all"
            style={{ borderRadius: 'var(--radius)' }}
          >
            <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Game cards - horizontal scroll on mobile, grid on larger screens */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory md:grid md:grid-cols-4 md:overflow-visible">
        {games.map((game, index) => (
          <motion.button
            key={game.id}
            onClick={() => onSelectGame(game.id)}
            className="flex-shrink-0 w-40 md:w-full group snap-start text-left"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.08, type: 'spring', stiffness: 300, damping: 25 }}
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
          >
            <div
              className="relative h-full overflow-hidden shadow-lg hover:shadow-neon cursor-pointer"
              style={{ borderRadius: 'var(--radius)' }}
            >
              {/* Full-bleed image or gradient fallback */}
              <div className="relative aspect-[3/4]">
                {game.promoImage ? (
                  <img
                    src={game.promoImage}
                    alt={game.name}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  // Gradient fallback with icon for games without promo image
                  <div className="w-full h-full bg-gradient-to-br from-purple-600/40 via-blue-600/40 to-cyan-500/40 flex items-center justify-center">
                    <div
                      className="w-16 h-16 bg-gradient-to-br from-orange-500/30 to-amber-500/30 border border-orange-500/40 flex items-center justify-center group-hover:scale-110 transition-transform duration-300"
                      style={{ borderRadius: 'var(--radius)' }}
                    >
                      <FontAwesomeIcon
                        icon={game.icon}
                        className="w-8 h-8 text-orange-400 group-hover:text-orange-300"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Glassmorphism footer overlay - matches ProjectCard style */}
              <div className="absolute bottom-0 left-0 right-0 z-20">
                <div className="relative p-4">
                  {/* Glassmorphism backdrop - forest, navy, black blend */}
                  <div
                    className="absolute inset-0 overflow-hidden"
                    style={{ borderRadius: '0 0 var(--radius) var(--radius)' }}
                  >
                    {/* Gradient background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/50 via-black to-blue-950/40" />
                    {/* Frosted glass layer */}
                    <div className="absolute inset-0 backdrop-blur-xl bg-black/30" />
                    {/* Subtle inner highlight */}
                    <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/[0.05]" />
                  </div>

                  {/* Content */}
                  <h4 className="relative z-10 text-base font-bold text-white drop-shadow-md line-clamp-1">
                    {game.name}
                  </h4>
                  <p className="relative z-10 text-xs text-white/80 line-clamp-2 mt-1 leading-relaxed">
                    {game.tagline}
                  </p>
                </div>
              </div>

              {/* Play indicator on hover */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div
                  className="px-2.5 py-1 bg-orange-500/90 text-white text-xs font-medium shadow-lg"
                  style={{ borderRadius: 'var(--radius)' }}
                >
                  Play
                </div>
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
