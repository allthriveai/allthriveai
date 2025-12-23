import { useState, useEffect, type ComponentType } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGamepad, faRotateRight, faDice } from '@fortawesome/free-solid-svg-icons';
import {
  GAME_REGISTRY,
  getRandomGame,
  getEnabledGames,
  type GameType,
  type PlayableGameType,
  type MiniGameProps,
} from './gameRegistry';

interface ChatGameCardProps {
  gameType: GameType;
  config?: {
    difficulty?: 'easy' | 'medium' | 'hard';
  };
  onPlayAgain?: () => void;
  onTryAnother?: () => void;
  /** Hide the "Try Another" button (e.g., when embedded in lesson plans) */
  hideTryAnother?: boolean;
}

// Cache for lazy-loaded components
const componentCache = new Map<PlayableGameType, ComponentType<MiniGameProps>>();

/**
 * ChatGameCard - Wrapper component for inline games in the chat sidebar
 *
 * Renders a glass-styled card containing a mini-game that fits within
 * the chat panel width (~380px). Games are self-contained and playable
 * without leaving the chat context.
 *
 * Uses the game registry for scalability - add new games to gameRegistry.ts
 */
export function ChatGameCard({ gameType: initialGameType, config, onPlayAgain, onTryAnother, hideTryAnother }: ChatGameCardProps) {
  // Resolve 'random' to an actual game
  const [currentGame, setCurrentGame] = useState<PlayableGameType>(() => {
    if (initialGameType === 'random') {
      return getRandomGame();
    }
    return initialGameType as PlayableGameType;
  });
  const [gameKey, setGameKey] = useState(0); // Key to force game reset
  const [showGame, setShowGame] = useState(false);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [GameComponent, setGameComponent] = useState<ComponentType<MiniGameProps> | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const gameConfig = GAME_REGISTRY[currentGame];
  const enabledGames = getEnabledGames();

  // Load game component
  useEffect(() => {
    const loadComponent = async () => {
      // Check cache first
      if (componentCache.has(currentGame)) {
        setGameComponent(() => componentCache.get(currentGame)!);
        return;
      }

      setIsLoading(true);
      try {
        const module = await gameConfig.component();
        const Component = module.default;
        componentCache.set(currentGame, Component);
        setGameComponent(() => Component);
      } catch (error) {
        console.error(`Failed to load game: ${currentGame}`, error);
      } finally {
        setIsLoading(false);
      }
    };

    loadComponent();
  }, [currentGame, gameConfig]);

  const handlePlayAgain = () => {
    setGameKey(prev => prev + 1);
    setShowGame(true);
    setLastScore(null);
    onPlayAgain?.();
  };

  const handleTryAnother = () => {
    // Pick a different game from enabled games
    const otherGames = enabledGames.filter(g => g.id !== currentGame);
    const newGame: PlayableGameType = otherGames[Math.floor(Math.random() * otherGames.length)]?.id ?? 'snake';
    setCurrentGame(newGame);
    setGameKey(prev => prev + 1);
    setShowGame(false);
    setLastScore(null);
    onTryAnother?.();
  };

  const handleGameEnd = (score: number) => {
    setLastScore(score);
  };

  const handleStart = () => {
    setShowGame(true);
  };

  return (
    <div className="w-full max-w-[360px]">
      <div className="rounded-xl overflow-hidden bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 shadow-xl">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-700/50 bg-gradient-to-r from-orange-500/10 to-amber-500/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/30 flex items-center justify-center">
              <FontAwesomeIcon
                icon={gameConfig.icon}
                className="w-4 h-4 text-orange-400"
              />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">{gameConfig.name}</h4>
              <p className="text-xs text-slate-400">{gameConfig.description}</p>
            </div>
          </div>
        </div>

        {/* Game Area */}
        <div className="p-4">
          {!showGame ? (
            // Start screen
            <div className="flex flex-col items-center py-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/30 flex items-center justify-center mb-4">
                <FontAwesomeIcon
                  icon={faGamepad}
                  className="w-8 h-8 text-cyan-400"
                />
              </div>
              <p className="text-slate-300 text-sm mb-4 text-center">
                Ready to play?
              </p>
              <button
                onClick={handleStart}
                disabled={isLoading}
                className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 text-white text-sm font-semibold rounded-lg hover:from-cyan-400 hover:to-teal-400 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50"
              >
                {isLoading ? 'Loading...' : 'Start Game'}
              </button>
            </div>
          ) : (
            // Game content
            <div className="min-h-[280px]">
              {isLoading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : GameComponent ? (
                <GameComponent
                  key={gameKey}
                  onGameEnd={handleGameEnd}
                  difficulty={config?.difficulty}
                />
              ) : (
                <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
                  Failed to load game
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with actions (shown after game ends) */}
        {showGame && lastScore !== null && (
          <div className="px-4 py-3 border-t border-slate-700/50 bg-slate-800/50">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm text-slate-300">
                Score: <span className="font-semibold text-cyan-400">{lastScore}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handlePlayAgain}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <FontAwesomeIcon icon={faRotateRight} className="w-3 h-3" />
                  Play Again
                </button>
                {enabledGames.length > 1 && !hideTryAnother && (
                  <button
                    onClick={handleTryAnother}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 rounded-lg transition-colors"
                  >
                    <FontAwesomeIcon icon={faDice} className="w-3 h-3" />
                    Try Another
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
