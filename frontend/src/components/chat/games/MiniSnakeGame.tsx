import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowUp,
  faArrowDown,
  faArrowLeft,
  faArrowRight,
  faPlay,
  faStar,
} from '@fortawesome/free-solid-svg-icons';
import { useReward } from 'react-rewards';
import { useAuth } from '@/hooks/useAuth';
import { useGameScore } from '@/hooks/useGameScore';
import type { PointsAwarded } from '@/services/games';

interface Position {
  x: number;
  y: number;
}

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type GameState = 'ready' | 'playing' | 'ended';

// Compact grid for chat sidebar
const GRID_SIZE = 12;
const CELL_SIZE = 22; // Fits ~265px width nicely
const INITIAL_SPEED = 160;
const HIGH_SCORE_THRESHOLD = 15; // Score needed for confetti celebration

interface MiniSnakeGameProps {
  onGameEnd?: (score: number) => void;
}

/**
 * MiniSnakeGame - Compact snake game for chat sidebar
 *
 * A simplified version of Context Snake optimized for the chat panel:
 * - Smaller grid (12x12 vs 15x15)
 * - Compact controls for mobile
 * - Quick rounds with immediate restart
 */
export function MiniSnakeGame({ onGameEnd }: MiniSnakeGameProps) {
  const [gameState, setGameState] = useState<GameState>('ready');
  const [snake, setSnake] = useState<Position[]>([{ x: 6, y: 6 }]);
  const [token, setToken] = useState<Position>({ x: 9, y: 6 });
  const [tokenCount, setTokenCount] = useState(0);

  // Points system
  const { isAuthenticated } = useAuth();
  const [showPointsEarned, setShowPointsEarned] = useState(false);
  const [pointsEarnedData, setPointsEarnedData] = useState<PointsAwarded | null>(null);
  const hasSubmittedRef = useRef(false);

  const { submitScore, isSubmitting } = useGameScore({
    game: 'context_snake',
    isAuthenticated,
    onPointsAwarded: (points) => {
      setPointsEarnedData(points);
      setShowPointsEarned(true);
    },
  });

  // Confetti celebration for high scores
  const { reward: confettiReward } = useReward('miniSnakeConfetti', 'confetti', {
    elementCount: 60,
    spread: 70,
    startVelocity: 25,
    colors: ['#22D3EE', '#FB37FF', '#4ADE80', '#FBBF24'],
  });

  const directionRef = useRef<Direction>('RIGHT');
  const gameLoopRef = useRef<number | null>(null);
  const touchStartRef = useRef<Position | null>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);

  const gridPixelSize = GRID_SIZE * CELL_SIZE;

  // Spawn token at random empty position
  const spawnToken = useCallback((currentSnake: Position[]) => {
    const occupied = new Set(currentSnake.map(p => `${p.x},${p.y}`));
    const empty: Position[] = [];

    for (let x = 0; x < GRID_SIZE; x++) {
      for (let y = 0; y < GRID_SIZE; y++) {
        if (!occupied.has(`${x},${y}`)) {
          empty.push({ x, y });
        }
      }
    }

    if (empty.length > 0) {
      const randomIndex = Math.floor(Math.random() * empty.length);
      setToken(empty[randomIndex]);
    }
  }, []);

  // Check collision
  const checkCollision = useCallback((head: Position, body: Position[]): boolean => {
    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
      return true;
    }
    for (let i = 1; i < body.length; i++) {
      if (body[i].x === head.x && body[i].y === head.y) {
        return true;
      }
    }
    return false;
  }, []);

  // Game loop
  const gameLoop = useCallback(() => {
    setSnake(prevSnake => {
      const head = prevSnake[0];
      const currentDirection = directionRef.current;

      let newHead: Position;
      switch (currentDirection) {
        case 'UP':
          newHead = { x: head.x, y: head.y - 1 };
          break;
        case 'DOWN':
          newHead = { x: head.x, y: head.y + 1 };
          break;
        case 'LEFT':
          newHead = { x: head.x - 1, y: head.y };
          break;
        case 'RIGHT':
          newHead = { x: head.x + 1, y: head.y };
          break;
      }

      if (checkCollision(newHead, prevSnake)) {
        setGameState('ended');
        if (gameLoopRef.current) {
          clearInterval(gameLoopRef.current);
          gameLoopRef.current = null;
        }
        return prevSnake;
      }

      const eating = newHead.x === token.x && newHead.y === token.y;
      const newSnake = [newHead, ...prevSnake];

      if (eating) {
        setTokenCount(prev => prev + 1);
        spawnToken(newSnake);
      } else {
        newSnake.pop();
      }

      return newSnake;
    });
  }, [token, checkCollision, spawnToken]);

  // Start game
  const startGame = useCallback(() => {
    setSnake([{ x: 6, y: 6 }]);
    directionRef.current = 'RIGHT';
    setTokenCount(0);
    setGameState('playing');
    setShowPointsEarned(false);
    setPointsEarnedData(null);
    hasSubmittedRef.current = false;
    spawnToken([{ x: 6, y: 6 }]);
  }, [spawnToken]);

  // Handle direction change
  const changeDirection = useCallback((newDirection: Direction) => {
    const current = directionRef.current;

    if (
      (current === 'UP' && newDirection === 'DOWN') ||
      (current === 'DOWN' && newDirection === 'UP') ||
      (current === 'LEFT' && newDirection === 'RIGHT') ||
      (current === 'RIGHT' && newDirection === 'LEFT')
    ) {
      return;
    }

    directionRef.current = newDirection;
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState === 'ready' || gameState === 'ended') {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          startGame();
        }
        return;
      }

      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          e.preventDefault();
          changeDirection('UP');
          break;
        case 'ArrowDown':
        case 'KeyS':
          e.preventDefault();
          changeDirection('DOWN');
          break;
        case 'ArrowLeft':
        case 'KeyA':
          e.preventDefault();
          changeDirection('LEFT');
          break;
        case 'ArrowRight':
        case 'KeyD':
          e.preventDefault();
          changeDirection('RIGHT');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, startGame, changeDirection]);

  // Touch controls on game container
  useEffect(() => {
    const container = gameContainerRef.current;
    if (!container || gameState !== 'playing') return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        touchStartRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current || e.changedTouches.length === 0) return;

      const touchEnd = {
        x: e.changedTouches[0].clientX,
        y: e.changedTouches[0].clientY,
      };

      const dx = touchEnd.x - touchStartRef.current.x;
      const dy = touchEnd.y - touchStartRef.current.y;
      const minSwipe = 20;

      if (Math.abs(dx) > Math.abs(dy)) {
        if (Math.abs(dx) > minSwipe) {
          changeDirection(dx > 0 ? 'RIGHT' : 'LEFT');
        }
      } else {
        if (Math.abs(dy) > minSwipe) {
          changeDirection(dy > 0 ? 'DOWN' : 'UP');
        }
      }

      touchStartRef.current = null;
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [gameState, changeDirection]);

  // Game loop interval
  useEffect(() => {
    if (gameState === 'playing') {
      gameLoopRef.current = window.setInterval(gameLoop, INITIAL_SPEED);
    }

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    };
  }, [gameState, gameLoop]);

  // Notify parent when game ends
  useEffect(() => {
    if (gameState === 'ended') {
      onGameEnd?.(tokenCount);
    }
  }, [gameState, tokenCount, onGameEnd]);

  // Submit score and show celebration when game ends
  useEffect(() => {
    if (gameState === 'ended' && !hasSubmittedRef.current && tokenCount > 0) {
      hasSubmittedRef.current = true;
      submitScore(tokenCount);

      // Confetti for high scores
      if (tokenCount >= HIGH_SCORE_THRESHOLD) {
        confettiReward();
      }
    }
  }, [gameState, tokenCount, submitScore, confettiReward]);

  return (
    <div className="flex flex-col items-center gap-3 relative">
      {/* Confetti anchor */}
      <span id="miniSnakeConfetti" className="absolute top-1/3 left-1/2" />

      {/* Game canvas */}
      <div
        ref={gameContainerRef}
        className="relative border border-slate-700/50 rounded-lg overflow-hidden touch-none"
        style={{
          width: gridPixelSize,
          height: gridPixelSize,
          background: 'rgba(2, 6, 23, 0.9)',
        }}
      >
        {/* Grid lines */}
        <div
          className="absolute inset-0 pointer-events-none opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(148, 163, 184, 0.3) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(148, 163, 184, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`,
          }}
        />

        {/* Snake */}
        {gameState !== 'ready' && snake.map((segment, index) => (
          <div
            key={`${segment.x}-${segment.y}-${index}`}
            className="absolute rounded-sm transition-all duration-75"
            style={{
              width: CELL_SIZE - 2,
              height: CELL_SIZE - 2,
              left: segment.x * CELL_SIZE + 1,
              top: segment.y * CELL_SIZE + 1,
              background: index === 0
                ? 'linear-gradient(135deg, #22D3EE, #4ADEE7)'
                : `linear-gradient(135deg, rgba(34, 211, 238, ${Math.max(0.3, 1 - index * 0.02)}), rgba(74, 222, 231, ${Math.max(0.3, 1 - index * 0.02)}))`,
              boxShadow: index === 0 ? '0 0 10px rgba(34, 211, 238, 0.5)' : 'none',
            }}
          />
        ))}

        {/* Token */}
        {gameState === 'playing' && (
          <div
            className="absolute rounded-full animate-pulse"
            style={{
              width: CELL_SIZE - 4,
              height: CELL_SIZE - 4,
              left: token.x * CELL_SIZE + 2,
              top: token.y * CELL_SIZE + 2,
              background: 'linear-gradient(135deg, #FB37FF, #E879F9)',
              boxShadow: '0 0 12px rgba(251, 55, 255, 0.6)',
            }}
          />
        )}

        {/* Ready overlay - How to Play with animated demo */}
        <AnimatePresence>
          {gameState === 'ready' && (
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-sm p-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="text-center w-full max-w-[240px]">
                <h3 className="text-cyan-400 font-bold text-xs mb-2">How to Play</h3>

                {/* Animated demo showing snake eating token */}
                <div className="relative w-full h-16 mx-auto mb-3 bg-slate-900/80 rounded-lg border border-slate-700/50 overflow-hidden">
                  {/* Mini grid background */}
                  <div
                    className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage: `
                        linear-gradient(to right, rgba(148, 163, 184, 0.3) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(148, 163, 184, 0.3) 1px, transparent 1px)
                      `,
                      backgroundSize: '10px 10px',
                    }}
                  />

                  {/* Animated snake moving right and eating token */}
                  <motion.div
                    className="absolute flex"
                    initial={{ x: 16, y: 26 }}
                    animate={{
                      x: [16, 60, 60, 100],
                      y: [26, 26, 26, 26],
                    }}
                    transition={{
                      duration: 3,
                      times: [0, 0.4, 0.5, 1],
                      repeat: Infinity,
                      repeatDelay: 1,
                    }}
                  >
                    {/* Snake head */}
                    <motion.div
                      className="w-2.5 h-2.5 rounded-sm"
                      style={{
                        background: 'linear-gradient(135deg, #22D3EE, #4ADEE7)',
                        boxShadow: '0 0 6px rgba(34, 211, 238, 0.6)',
                      }}
                    />
                    {/* Snake body segments */}
                    <motion.div
                      className="h-2.5 rounded-sm -ml-0.5"
                      style={{ background: 'rgba(34, 211, 238, 0.7)' }}
                      animate={{
                        width: [10, 10, 10, 20], // Grows after eating
                      }}
                      transition={{
                        duration: 3,
                        times: [0, 0.4, 0.5, 1],
                        repeat: Infinity,
                        repeatDelay: 1,
                      }}
                    />
                  </motion.div>

                  {/* Token that gets eaten */}
                  <motion.div
                    className="absolute w-2.5 h-2.5 rounded-full"
                    style={{
                      left: 60,
                      top: 26,
                      background: 'linear-gradient(135deg, #FB37FF, #E879F9)',
                      boxShadow: '0 0 8px rgba(251, 55, 255, 0.6)',
                    }}
                    animate={{
                      scale: [1, 1.2, 1, 1, 0, 0, 0, 0],
                      opacity: [1, 1, 1, 1, 0, 0, 0, 0],
                    }}
                    transition={{
                      duration: 4,
                      times: [0, 0.15, 0.25, 0.35, 0.4, 0.5, 0.75, 1],
                      repeat: Infinity,
                      repeatDelay: 0.5,
                    }}
                  />

                  {/* Arrow hint */}
                  <motion.div
                    className="absolute top-1 right-2 flex items-center gap-1"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <FontAwesomeIcon icon={faArrowRight} className="text-cyan-400 text-[8px]" />
                  </motion.div>

                  {/* Label */}
                  <div className="absolute bottom-0.5 left-1.5 text-[7px] text-slate-500">
                    eat tokens to grow
                  </div>
                </div>

                {/* Controls section */}
                <div className="mb-3">
                  <p className="text-slate-500 text-[8px] uppercase tracking-wider mb-1.5">Controls</p>
                  <div className="flex justify-center items-center gap-1">
                    {/* Arrow key cluster */}
                    <div className="flex flex-col items-center gap-0.5">
                      <motion.div
                        className="w-5 h-5 rounded bg-slate-700 border border-slate-600 flex items-center justify-center"
                        animate={{ scale: [1, 1.1, 1], borderColor: ['#475569', '#22D3EE', '#475569'] }}
                        transition={{ duration: 2, repeat: Infinity, delay: 0 }}
                      >
                        <FontAwesomeIcon icon={faArrowUp} className="text-slate-300 text-[8px]" />
                      </motion.div>
                      <div className="flex gap-0.5">
                        <motion.div
                          className="w-5 h-5 rounded bg-slate-700 border border-slate-600 flex items-center justify-center"
                          animate={{ scale: [1, 1.1, 1], borderColor: ['#475569', '#22D3EE', '#475569'] }}
                          transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                        >
                          <FontAwesomeIcon icon={faArrowLeft} className="text-slate-300 text-[8px]" />
                        </motion.div>
                        <motion.div
                          className="w-5 h-5 rounded bg-slate-700 border border-slate-600 flex items-center justify-center"
                          animate={{ scale: [1, 1.1, 1], borderColor: ['#475569', '#22D3EE', '#475569'] }}
                          transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                        >
                          <FontAwesomeIcon icon={faArrowDown} className="text-slate-300 text-[8px]" />
                        </motion.div>
                        <motion.div
                          className="w-5 h-5 rounded bg-slate-700 border border-slate-600 flex items-center justify-center"
                          animate={{ scale: [1, 1.1, 1], borderColor: ['#475569', '#22D3EE', '#475569'] }}
                          transition={{ duration: 2, repeat: Infinity, delay: 1.5 }}
                        >
                          <FontAwesomeIcon icon={faArrowRight} className="text-slate-300 text-[8px]" />
                        </motion.div>
                      </div>
                    </div>

                    <span className="text-slate-600 text-[9px] mx-1.5">or</span>

                    {/* Swipe gesture */}
                    <div className="relative w-9 h-9 rounded-lg bg-slate-800/50 border border-slate-700/50 flex items-center justify-center">
                      <motion.div
                        className="absolute w-1.5 h-1.5 rounded-full bg-cyan-400"
                        animate={{
                          x: [0, 6, 0, -6, 0],
                          y: [0, 0, 6, 0, -6],
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                      <span className="text-[7px] text-slate-500 absolute -bottom-2.5">swipe</span>
                    </div>
                  </div>
                </div>

                {/* Warning */}
                <p className="text-slate-500 text-[9px] mb-3">
                  Avoid hitting <span className="text-red-400">walls</span> or your own <span className="text-red-400">tail</span>
                </p>

                <button
                  onClick={startGame}
                  className="w-full px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 rounded-lg font-bold text-sm flex items-center justify-center gap-2 hover:from-cyan-400 hover:to-teal-400 transition-all"
                >
                  <FontAwesomeIcon icon={faPlay} className="text-xs" />
                  Play
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Game over overlay */}
        <AnimatePresence>
          {gameState === 'ended' && (
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="text-slate-400 text-xs mb-1">Context full!</p>
              <div className="text-center mb-2">
                <span className="text-cyan-400 font-mono text-xl font-bold">{tokenCount}</span>
                <span className="text-slate-500 text-xs ml-1">tokens</span>
              </div>

              {/* Points earned display */}
              <AnimatePresence>
                {showPointsEarned && pointsEarnedData && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="mb-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/30"
                  >
                    <div className="flex items-center gap-1.5 text-yellow-400 text-sm">
                      <FontAwesomeIcon icon={faStar} className="text-xs" />
                      <span className="font-bold">+{pointsEarnedData.total} points</span>
                    </div>
                    {pointsEarnedData.bonus > 0 && (
                      <p className="text-yellow-500/70 text-[10px] mt-0.5 text-center">
                        +{pointsEarnedData.base} play + {pointsEarnedData.bonus} bonus
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {isSubmitting && (
                <div className="mb-2 text-slate-500 text-xs">
                  Saving...
                </div>
              )}

              {!isAuthenticated && !isSubmitting && (
                <p className="text-slate-500 text-[10px] mb-2">
                  Sign in to earn points!
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Token count during gameplay */}
      {gameState === 'playing' && (
        <div className="text-center">
          <span className="text-slate-500 text-xs">Tokens:</span>
          <span className="ml-1 text-cyan-400 font-mono text-lg font-bold">{tokenCount}</span>
        </div>
      )}

      {/* Mobile D-pad controls */}
      {gameState === 'playing' && (
        <div className="sm:hidden">
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => changeDirection('UP')}
              className="w-10 h-10 rounded-lg bg-slate-800/80 border border-slate-600/50 flex items-center justify-center active:bg-cyan-500/30 active:border-cyan-500/50 transition-colors"
            >
              <FontAwesomeIcon icon={faArrowUp} className="text-slate-400 w-4 h-4" />
            </button>
            <div className="flex gap-1">
              <button
                onClick={() => changeDirection('LEFT')}
                className="w-10 h-10 rounded-lg bg-slate-800/80 border border-slate-600/50 flex items-center justify-center active:bg-cyan-500/30 active:border-cyan-500/50 transition-colors"
              >
                <FontAwesomeIcon icon={faArrowLeft} className="text-slate-400 w-4 h-4" />
              </button>
              <button
                onClick={() => changeDirection('DOWN')}
                className="w-10 h-10 rounded-lg bg-slate-800/80 border border-slate-600/50 flex items-center justify-center active:bg-cyan-500/30 active:border-cyan-500/50 transition-colors"
              >
                <FontAwesomeIcon icon={faArrowDown} className="text-slate-400 w-4 h-4" />
              </button>
              <button
                onClick={() => changeDirection('RIGHT')}
                className="w-10 h-10 rounded-lg bg-slate-800/80 border border-slate-600/50 flex items-center justify-center active:bg-cyan-500/30 active:border-cyan-500/50 transition-colors"
              >
                <FontAwesomeIcon icon={faArrowRight} className="text-slate-400 w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
