/**
 * GamePreviewTray - Right-side tray for playing games inline
 *
 * Opens from the explore feed when a game card is clicked.
 * Embeds the actual mini game so users can play directly.
 */

import { useState, useEffect, Suspense, type ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faTimes, faTrophy, faGamepad, faRedo, faExpand } from '@fortawesome/free-solid-svg-icons';
import type { GameConfig, MiniGameProps } from '@/components/chat/games/gameRegistry';

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
  quiz: '/games#side-quests',
};

// Game-specific colors
const GAME_COLORS: Record<string, { gradient: string; accent: string; border: string; bg: string }> = {
  snake: {
    gradient: 'from-cyan-500 to-cyan-600',
    accent: 'text-cyan-400',
    border: 'border-cyan-500/30',
    bg: 'from-cyan-500/20 to-cyan-600/10',
  },
  ethics: {
    gradient: 'from-violet-500 to-violet-600',
    accent: 'text-violet-400',
    border: 'border-violet-500/30',
    bg: 'from-violet-500/20 to-violet-600/10',
  },
  prompt_battle: {
    gradient: 'from-pink-500 to-pink-600',
    accent: 'text-pink-400',
    border: 'border-pink-500/30',
    bg: 'from-pink-500/20 to-pink-600/10',
  },
  quiz: {
    gradient: 'from-amber-500 to-amber-600',
    accent: 'text-amber-400',
    border: 'border-amber-500/30',
    bg: 'from-amber-500/20 to-amber-600/10',
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
  const [gameEnded, setGameEnded] = useState(false);
  const [gameKey, setGameKey] = useState(0);
  const [GameComponent, setGameComponent] = useState<ComponentType<MiniGameProps> | null>(null);
  const [isLoadingGame, setIsLoadingGame] = useState(false);

  // Load the game component when the tray opens
  useEffect(() => {
    if (isOpen && game && !GameComponent) {
      setIsLoadingGame(true);
      game.component()
        .then((module) => {
          setGameComponent(() => module.default);
          setIsLoadingGame(false);
        })
        .catch((err) => {
          console.error('Failed to load game:', err);
          setIsLoadingGame(false);
        });
    }
  }, [isOpen, game, GameComponent]);

  // Reset state when game changes
  useEffect(() => {
    if (game) {
      setGameEnded(false);
      setGameKey(0);
      setGameComponent(null);
    }
  }, [game?.id]);

  if (!game) return null;

  const colors = GAME_COLORS[game.id] || GAME_COLORS.quiz;
  const gameUrl = GAME_URLS[game.id] || '/games';
  const points = GAME_POINTS[game.id] || 50;

  const handleGameEnd = () => {
    setGameEnded(true);
  };

  const handlePlayAgain = () => {
    setGameEnded(false);
    setGameKey((prev) => prev + 1);
  };

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
        className={`fixed top-0 right-0 h-full w-full sm:w-[420px] md:w-[480px] bg-slate-900 z-50 transform transition-transform duration-300 ease-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-slate-700/50 bg-slate-900/95 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br ${colors.bg}`}
              >
                <FontAwesomeIcon icon={game.icon} className={colors.accent} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded ${colors.accent} ${colors.border} border bg-slate-800/50`}
                  >
                    Game
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white truncate">{game.name}</h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <FontAwesomeIcon icon={faTimes} className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Game Area */}
        <div className="flex-1 overflow-y-auto">
          {/* Mini Game Container */}
          <div className="p-4">
            <div className={`relative rounded-xl overflow-hidden bg-slate-800 ${colors.border} border`}>
              {isLoadingGame ? (
                <div className={`flex items-center justify-center h-[350px] bg-gradient-to-br ${colors.bg}`}>
                  <div className="flex flex-col items-center gap-3">
                    <div className={`w-8 h-8 border-3 ${colors.border} border-t-transparent rounded-full animate-spin`} />
                    <span className="text-sm text-slate-400">Loading game...</span>
                  </div>
                </div>
              ) : GameComponent ? (
                <div className="relative">
                  <Suspense
                    fallback={
                      <div className={`flex items-center justify-center h-[350px] bg-gradient-to-br ${colors.bg}`}>
                        <div className="w-8 h-8 border-3 border-slate-600 border-t-transparent rounded-full animate-spin" />
                      </div>
                    }
                  >
                    <GameComponent key={gameKey} onGameEnd={handleGameEnd} />
                  </Suspense>

                  {/* Game Ended Overlay */}
                  {gameEnded && (
                    <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center gap-4 p-6">
                      <div className="flex items-center gap-2">
                        <FontAwesomeIcon icon={faTrophy} className="text-amber-400 text-2xl" />
                        <span className="text-xl font-bold text-white">Game Over!</span>
                      </div>
                      <p className="text-slate-400 text-sm text-center">
                        Great job! You earned points for playing.
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={handlePlayAgain}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white bg-gradient-to-r ${colors.gradient} hover:opacity-90 transition-opacity`}
                        >
                          <FontAwesomeIcon icon={faRedo} />
                          Play Again
                        </button>
                        <Link
                          to={gameUrl}
                          onClick={onClose}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white bg-slate-700 hover:bg-slate-600 transition-colors"
                        >
                          <FontAwesomeIcon icon={faExpand} />
                          Full Game
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Fallback - show promo image with play button
                <div className={`relative h-[350px] bg-gradient-to-br ${colors.bg}`}>
                  {game.promoImage && (
                    <img
                      src={game.promoImage}
                      alt={game.name}
                      className="w-full h-full object-cover opacity-50"
                    />
                  )}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                    <FontAwesomeIcon icon={game.icon} className={`text-6xl ${colors.accent} opacity-50`} />
                    <Link
                      to={gameUrl}
                      onClick={onClose}
                      className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r ${colors.gradient} hover:opacity-90 transition-opacity`}
                    >
                      <FontAwesomeIcon icon={faPlay} />
                      Play Full Game
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Game Info */}
          <div className="px-4 pb-6 space-y-4">
            {/* Tagline */}
            <p className={`text-sm ${colors.accent} font-medium`}>{game.tagline}</p>

            {/* Stats */}
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 ${colors.border} border`}>
                <FontAwesomeIcon icon={faGamepad} className={colors.accent} />
                <span className="text-sm text-slate-300 capitalize">{game.category}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-amber-500/30">
                <FontAwesomeIcon icon={faTrophy} className="text-amber-400" />
                <span className="text-sm text-amber-400 font-medium">Up to +{points} pts</span>
              </div>
            </div>

            {/* Description */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                About
              </h3>
              <p className="text-slate-300 text-sm leading-relaxed">{game.description}</p>
            </div>
          </div>
        </div>

        {/* Footer - Full Game Link */}
        <div className="flex-shrink-0 p-4 border-t border-slate-700/50 bg-slate-900/95 backdrop-blur">
          <Link
            to={gameUrl}
            onClick={onClose}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white transition-all hover:scale-[1.02] bg-gradient-to-r ${colors.gradient}`}
          >
            <FontAwesomeIcon icon={faExpand} />
            Open Full Game
          </Link>
        </div>
      </div>
    </>
  );
}
