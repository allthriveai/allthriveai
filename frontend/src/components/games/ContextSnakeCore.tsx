/**
 * ContextSnakeCore - Shared snake game component
 *
 * Used by both the full-page game and the mini chat version.
 * Adapts layout, grid size, and features based on the variant prop.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlay,
  faArrowUp,
  faArrowDown,
  faArrowRight,
  faArrowLeft,
  faRotateRight,
  faWorm,
  faStar,
} from '@fortawesome/free-solid-svg-icons';
import { useReward } from 'react-rewards';
import { useAuth } from '@/hooks/useAuth';
import { useGameScore } from '@/hooks/useGameScore';
import type { PointsAwarded } from '@/services/games';

// Types
interface Position {
  x: number;
  y: number;
}

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type GameState = 'intro' | 'ready' | 'playing' | 'ended';

// Score tier thresholds
const SCORE_TIERS = {
  LOW: 10,
  MEDIUM: 30,
};

// Fun facts about context windows
const CONTEXT_FACTS = [
  "Claude's context window is 200K tokens — about 150,000 words or 500 pages.",
  "The word 'tokenization' breaks text into chunks. 'Hello' is 1 token, but 'Hello!' is 2.",
  'GPT-2 (2019) had only 1,024 tokens. Today\'s models have 100x more.',
  'Images use tokens too — a single photo can cost 1,000+ tokens.',
  'Code uses more tokens than plain English because of symbols and formatting.',
  'The average novel is about 100K tokens. Claude can read one in a single prompt.',
  "Tokens aren't words — 'chatting' might be split into 'chat' + 'ting'.",
  'Context windows are like RAM for AI — bigger means more working memory.',
  'Early chatbots had ~50 token windows. They forgot everything immediately.',
  "Longer context doesn't always mean better answers — focus matters more.",
];

export interface ContextSnakeCoreProps {
  variant: 'full' | 'mini';
  onGameEnd?: (score: number) => void;
}

export function ContextSnakeCore({ variant, onGameEnd }: ContextSnakeCoreProps) {
  const isMini = variant === 'mini';

  // Variant-specific settings
  const GRID_SIZE = isMini ? 12 : 15;
  const INITIAL_SPEED = isMini ? 160 : 180;
  const HIGH_SCORE_THRESHOLD = isMini ? 15 : 30;

  // Auth and points
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

  // End-game animation states
  const [showCrashFlash, setShowCrashFlash] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  // Token eaten particle bursts (full version only)
  const [particleBursts, setParticleBursts] = useState<
    Array<{ id: number; x: number; y: number }>
  >([]);
  const particleIdRef = useRef(0);
  const particleTimeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // Confetti reward hook
  const confettiId = isMini ? 'miniSnakeConfetti' : 'fullSnakeConfetti';
  const { reward: confettiReward } = useReward(confettiId, 'confetti', {
    elementCount: isMini ? 60 : 100,
    spread: isMini ? 70 : 90,
    startVelocity: isMini ? 25 : 35,
    colors: ['#22D3EE', '#FB37FF', '#4ADE80', '#FBBF24'],
  });

  // Emoji reward for lower scores (mini version)
  const { reward: emojiReward } = useReward(confettiId, 'emoji', {
    emoji: ['🐍', '💪', '🎮', '⭐'],
    elementCount: 15,
    spread: 60,
    startVelocity: 20,
  });

  // Calculate cell size based on screen (responsive for full, fixed for mini)
  const [cellSize, setCellSize] = useState(isMini ? 22 : 20);

  // Game state
  const initialPos = Math.floor(GRID_SIZE / 2);
  const [gameState, setGameState] = useState<GameState>(isMini ? 'ready' : 'intro');
  const [snake, setSnake] = useState<Position[]>([{ x: initialPos, y: initialPos }]);
  const [token, setToken] = useState<Position>({ x: initialPos + 3, y: initialPos });
  const [, setDirection] = useState<Direction>('RIGHT');
  const [tokenCount, setTokenCount] = useState(0);

  // Refs for game loop
  const directionRef = useRef<Direction>('RIGHT');
  const gameLoopRef = useRef<number | null>(null);
  const touchStartRef = useRef<Position | null>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);

  // Fun fact rotation (full version only)
  const [factIndex, setFactIndex] = useState(0);
  const shuffledFacts = useMemo(() => {
    return [...CONTEXT_FACTS].sort(() => Math.random() - 0.5);
  }, []);

  // Rotate facts every 5 seconds
  useEffect(() => {
    if (isMini) return;
    const interval = setInterval(() => {
      setFactIndex((prev) => (prev + 1) % shuffledFacts.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [shuffledFacts.length, isMini]);

  // Responsive cell size (full version only)
  useEffect(() => {
    if (isMini) return;

    const updateCellSize = () => {
      const maxWidth = Math.min(window.innerWidth - 48, 360);
      const maxHeight = window.innerHeight - 400;
      const maxSize = Math.min(maxWidth, maxHeight);
      const newCellSize = Math.floor(maxSize / GRID_SIZE);
      setCellSize(Math.max(14, Math.min(22, newCellSize)));
    };

    updateCellSize();
    window.addEventListener('resize', updateCellSize);
    return () => window.removeEventListener('resize', updateCellSize);
  }, [isMini, GRID_SIZE]);

  // Spawn token at random empty position
  const spawnToken = useCallback(
    (currentSnake: Position[]) => {
      const occupied = new Set(currentSnake.map((p) => `${p.x},${p.y}`));
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
    },
    [GRID_SIZE]
  );

  // Check collision with walls or self
  const checkCollision = useCallback(
    (head: Position, body: Position[]): boolean => {
      if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
        return true;
      }
      for (let i = 1; i < body.length; i++) {
        if (body[i].x === head.x && body[i].y === head.y) {
          return true;
        }
      }
      return false;
    },
    [GRID_SIZE]
  );

  // Game loop
  const gameLoop = useCallback(() => {
    setSnake((prevSnake) => {
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
        setTokenCount((prev) => prev + 1);
        // Particle burst (full version only)
        if (!isMini) {
          const burstId = particleIdRef.current++;
          setParticleBursts((prev) => [...prev, { id: burstId, x: token.x, y: token.y }]);
          const timeoutId = setTimeout(() => {
            setParticleBursts((prev) => prev.filter((p) => p.id !== burstId));
            particleTimeoutsRef.current.delete(burstId);
          }, 600);
          particleTimeoutsRef.current.set(burstId, timeoutId);
        }
        spawnToken(newSnake);
      } else {
        newSnake.pop();
      }

      return newSnake;
    });
  }, [token, checkCollision, spawnToken, isMini]);

  // Start game
  const startGame = useCallback(() => {
    const pos = Math.floor(GRID_SIZE / 2);
    setSnake([{ x: pos, y: pos }]);
    setDirection('RIGHT');
    directionRef.current = 'RIGHT';
    setTokenCount(0);
    setGameState('playing');
    setShowPointsEarned(false);
    setPointsEarnedData(null);
    setShowCrashFlash(false);
    setIsShaking(false);
    setParticleBursts([]);
    hasSubmittedRef.current = false;
    spawnToken([{ x: pos, y: pos }]);
  }, [spawnToken, GRID_SIZE]);

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
    setDirection(newDirection);
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState === 'intro') {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          setGameState('ready');
        }
        return;
      }

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

  // Touch controls
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

    const handleTouchMove = (e: TouchEvent) => {
      if (!isMini) e.preventDefault();
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

    // Full version uses document-level touch, mini uses container
    const target = isMini ? container : document;
    target.addEventListener('touchstart', handleTouchStart as EventListener, { passive: true });
    target.addEventListener('touchmove', handleTouchMove as EventListener, { passive: isMini });
    target.addEventListener('touchend', handleTouchEnd as EventListener, { passive: true });

    return () => {
      target.removeEventListener('touchstart', handleTouchStart as EventListener);
      target.removeEventListener('touchmove', handleTouchMove as EventListener);
      target.removeEventListener('touchend', handleTouchEnd as EventListener);
    };
  }, [gameState, changeDirection, isMini]);

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
  }, [gameState, gameLoop, INITIAL_SPEED]);

  // Cleanup particle timeouts on unmount
  useEffect(() => {
    return () => {
      particleTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      particleTimeoutsRef.current.clear();
    };
  }, []);

  // Notify parent and submit score when game ends
  useEffect(() => {
    if (gameState === 'ended') {
      onGameEnd?.(tokenCount);

      if (!hasSubmittedRef.current && tokenCount > 0) {
        hasSubmittedRef.current = true;
        submitScore(tokenCount);
      }
    }
  }, [gameState, tokenCount, onGameEnd, submitScore]);

  // Trigger end-game animations based on score tier
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    if (gameState === 'ended') {
      if (tokenCount >= HIGH_SCORE_THRESHOLD) {
        confettiReward();
      } else if (isMini) {
        emojiReward();
      } else if (tokenCount < SCORE_TIERS.LOW) {
        setIsShaking(true);
        setShowCrashFlash(true);
        timeoutId = setTimeout(() => {
          setIsShaking(false);
          setShowCrashFlash(false);
        }, 400);
      } else {
        setIsShaking(true);
        timeoutId = setTimeout(() => setIsShaking(false), 300);
      }
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [gameState, tokenCount, confettiReward, emojiReward, isMini, HIGH_SCORE_THRESHOLD]);

  const gridPixelSize = GRID_SIZE * cellSize;

  // Variant-specific sizes
  const sizes = {
    title: isMini ? 'text-xs' : 'text-sm',
    button: isMini ? 'px-4 py-2 text-sm' : 'px-6 py-3 text-base',
    score: isMini ? 'text-xl' : 'text-3xl',
    controlButton: isMini ? 'w-10 h-10' : 'w-12 h-12',
  };

  return (
    <div className={`flex flex-col items-center ${isMini ? 'gap-3' : 'gap-4'}`}>
      {/* Confetti anchor */}
      <span
        id={confettiId}
        className="absolute z-50"
        style={{ top: isMini ? '33%' : '40%', left: '50%' }}
      />

      {/* Header (full version only) */}
      {!isMini && (
        <div className="text-center mb-2">
          <h1 className="text-2xl sm:text-3xl font-black flex items-center justify-center gap-3">
            <FontAwesomeIcon icon={faWorm} className="text-cyan-400" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-400">
              Context Snake
            </span>
          </h1>
          <p className="text-slate-500 text-sm mt-1">Context is finite, so play accordingly!</p>
        </div>
      )}

      {/* Game canvas */}
      <motion.div
        ref={gameContainerRef}
        className={`relative border border-slate-700/50 rounded-lg overflow-hidden ${isMini ? 'touch-none' : ''}`}
        style={{
          width: gridPixelSize,
          height: gridPixelSize,
          background: 'rgba(2, 6, 23, 0.9)',
        }}
        animate={isShaking ? { x: [0, -8, 8, -8, 8, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Red flash overlay for crash effect */}
        <AnimatePresence>
          {showCrashFlash && (
            <motion.div
              className="absolute inset-0 bg-red-500/30 pointer-events-none z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            />
          )}
        </AnimatePresence>

        {/* Grid lines */}
        <div
          className="absolute inset-0 pointer-events-none opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(148, 163, 184, 0.3) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(148, 163, 184, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: `${cellSize}px ${cellSize}px`,
          }}
        />

        {/* Snake */}
        {gameState !== 'intro' &&
          gameState !== 'ready' &&
          snake.map((segment, index) => (
            <motion.div
              key={`${segment.x}-${segment.y}-${index}`}
              className="absolute rounded-sm"
              style={{
                width: cellSize - 2,
                height: cellSize - 2,
                left: segment.x * cellSize + 1,
                top: segment.y * cellSize + 1,
                background:
                  index === 0
                    ? 'linear-gradient(135deg, #22D3EE, #4ADEE7)'
                    : `linear-gradient(135deg, rgba(34, 211, 238, ${Math.max(0.3, 1 - index * 0.015)}), rgba(74, 222, 231, ${Math.max(0.3, 1 - index * 0.015)}))`,
                boxShadow: index === 0 ? '0 0 10px rgba(34, 211, 238, 0.5)' : 'none',
              }}
              initial={index === 0 ? { scale: 1.1 } : {}}
              animate={index === 0 ? { scale: 1 } : {}}
              transition={{ duration: 0.1 }}
            />
          ))}

        {/* Token */}
        {gameState === 'playing' && (
          <motion.div
            className="absolute rounded-full"
            style={{
              width: cellSize - 4,
              height: cellSize - 4,
              left: token.x * cellSize + 2,
              top: token.y * cellSize + 2,
              background: 'linear-gradient(135deg, #FB37FF, #E879F9)',
              boxShadow: '0 0 15px rgba(251, 55, 255, 0.6)',
            }}
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.9, 1, 0.9],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}

        {/* Particle bursts (full version only) */}
        {!isMini && (
          <AnimatePresence>
            {particleBursts.map((burst) => (
              <div
                key={burst.id}
                className="absolute pointer-events-none"
                style={{
                  left: burst.x * cellSize + cellSize / 2,
                  top: burst.y * cellSize + cellSize / 2,
                }}
              >
                {[...Array(8)].map((_, i) => {
                  const angle = i * 45 * (Math.PI / 180);
                  const distance = 20;
                  return (
                    <motion.div
                      key={i}
                      className="absolute w-2 h-2 rounded-full"
                      style={{
                        background: i % 2 === 0 ? '#FB37FF' : '#22D3EE',
                        boxShadow:
                          i % 2 === 0
                            ? '0 0 6px rgba(251, 55, 255, 0.8)'
                            : '0 0 6px rgba(34, 211, 238, 0.8)',
                        marginLeft: -4,
                        marginTop: -4,
                      }}
                      initial={{
                        x: 0,
                        y: 0,
                        scale: 1,
                        opacity: 1,
                      }}
                      animate={{
                        x: Math.cos(angle) * distance,
                        y: Math.sin(angle) * distance,
                        scale: 0,
                        opacity: 0,
                      }}
                      transition={{
                        duration: 0.5,
                        ease: 'easeOut',
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </AnimatePresence>
        )}

        {/* Intro overlay (full version only) */}
        <AnimatePresence>
          {gameState === 'intro' && !isMini && (
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-sm p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="text-center max-w-[280px]">
                <p className="text-slate-300 text-sm leading-relaxed mb-3">
                  AI models have a <span className="text-cyan-400 font-medium">context window</span>{' '}
                  — a limit on how much text they can process at once.
                </p>
                <p className="text-slate-400 text-sm leading-relaxed mb-4">
                  Text is split into <span className="text-pink-400 font-medium">tokens</span>, and
                  when the window fills up, things break.
                </p>
                <button
                  onClick={() => setGameState('ready')}
                  className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 rounded-xl font-bold flex items-center justify-center gap-2 hover:from-cyan-400 hover:to-teal-400 transition-all"
                >
                  Next
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Ready overlay */}
        <AnimatePresence>
          {gameState === 'ready' && (
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-sm p-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className={`text-center w-full ${isMini ? 'max-w-[240px]' : 'max-w-[280px]'}`}>
                <h3 className={`text-cyan-400 font-bold ${sizes.title} mb-2`}>How to Play</h3>

                {/* Animated demo */}
                <div
                  className={`relative w-full ${isMini ? 'h-16' : 'h-24'} mx-auto mb-3 bg-slate-900/80 rounded-lg border border-slate-700/50 overflow-hidden`}
                >
                  <div
                    className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage: `
                        linear-gradient(to right, rgba(148, 163, 184, 0.3) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(148, 163, 184, 0.3) 1px, transparent 1px)
                      `,
                      backgroundSize: isMini ? '10px 10px' : '12px 12px',
                    }}
                  />

                  <motion.div
                    className="absolute flex"
                    initial={{ x: isMini ? 16 : 20, y: isMini ? 26 : 42 }}
                    animate={{
                      x: isMini ? [16, 60, 60, 100] : [20, 80, 80, 140],
                      y: isMini ? [26, 26, 26, 26] : [42, 42, 42, 42],
                    }}
                    transition={{
                      duration: 3,
                      times: [0, 0.4, 0.5, 1],
                      repeat: Infinity,
                      repeatDelay: 1,
                    }}
                  >
                    <motion.div
                      className={`${isMini ? 'w-2.5 h-2.5' : 'w-3 h-3'} rounded-sm`}
                      style={{
                        background: 'linear-gradient(135deg, #22D3EE, #4ADEE7)',
                        boxShadow: '0 0 8px rgba(34, 211, 238, 0.6)',
                      }}
                    />
                    <motion.div
                      className={`${isMini ? 'h-2.5' : 'h-3'} rounded-sm -ml-0.5`}
                      style={{ background: 'rgba(34, 211, 238, 0.7)' }}
                      animate={{
                        width: isMini ? [10, 10, 10, 20] : [12, 12, 12, 24],
                      }}
                      transition={{
                        duration: 3,
                        times: [0, 0.4, 0.5, 1],
                        repeat: Infinity,
                        repeatDelay: 1,
                      }}
                    />
                  </motion.div>

                  <motion.div
                    className={`absolute ${isMini ? 'w-2.5 h-2.5' : 'w-3 h-3'} rounded-full`}
                    style={{
                      left: isMini ? 60 : 80,
                      top: isMini ? 26 : 42,
                      background: 'linear-gradient(135deg, #FB37FF, #E879F9)',
                      boxShadow: '0 0 10px rgba(251, 55, 255, 0.6)',
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

                  <motion.div
                    className={`absolute ${isMini ? 'top-1 right-2' : 'top-2 right-3'} flex items-center gap-1`}
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <FontAwesomeIcon
                      icon={faArrowRight}
                      className={`text-cyan-400 ${isMini ? 'text-[8px]' : 'text-xs'}`}
                    />
                  </motion.div>

                  <div
                    className={`absolute ${isMini ? 'bottom-0.5 left-1.5 text-[7px]' : 'bottom-1 left-2 text-[9px]'} text-slate-500`}
                  >
                    eat tokens to grow
                  </div>
                </div>

                {/* Controls */}
                <div className="mb-3">
                  <p
                    className={`text-slate-500 ${isMini ? 'text-[8px]' : 'text-[10px]'} uppercase tracking-wider mb-1.5`}
                  >
                    Controls
                  </p>
                  <div className="flex justify-center items-center gap-1">
                    <div className="flex flex-col items-center gap-0.5">
                      <motion.div
                        className={`${isMini ? 'w-5 h-5' : 'w-6 h-6'} rounded bg-slate-700 border border-slate-600 flex items-center justify-center`}
                        animate={{
                          scale: [1, 1.1, 1],
                          borderColor: ['#475569', '#22D3EE', '#475569'],
                        }}
                        transition={{ duration: 2, repeat: Infinity, delay: 0 }}
                      >
                        <FontAwesomeIcon
                          icon={faArrowUp}
                          className={`text-slate-300 ${isMini ? 'text-[8px]' : 'text-[10px]'}`}
                        />
                      </motion.div>
                      <div className="flex gap-0.5">
                        {[faArrowLeft, faArrowDown, faArrowRight].map((icon, i) => (
                          <motion.div
                            key={i}
                            className={`${isMini ? 'w-5 h-5' : 'w-6 h-6'} rounded bg-slate-700 border border-slate-600 flex items-center justify-center`}
                            animate={{
                              scale: [1, 1.1, 1],
                              borderColor: ['#475569', '#22D3EE', '#475569'],
                            }}
                            transition={{ duration: 2, repeat: Infinity, delay: 0.5 * (i + 1) }}
                          >
                            <FontAwesomeIcon
                              icon={icon}
                              className={`text-slate-300 ${isMini ? 'text-[8px]' : 'text-[10px]'}`}
                            />
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    <span className={`text-slate-600 ${isMini ? 'text-[9px]' : 'text-xs'} mx-1.5`}>
                      or
                    </span>

                    <div
                      className={`relative ${isMini ? 'w-9 h-9' : 'w-12 h-12'} rounded-lg bg-slate-800/50 border border-slate-700/50 flex items-center justify-center`}
                    >
                      <motion.div
                        className={`absolute ${isMini ? 'w-1.5 h-1.5' : 'w-2 h-2'} rounded-full bg-cyan-400`}
                        animate={{
                          x: [0, 6, 0, -6, 0],
                          y: [0, 0, 6, 0, -6],
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                      <span
                        className={`${isMini ? 'text-[7px]' : 'text-[8px]'} text-slate-500 absolute -bottom-2.5`}
                      >
                        swipe
                      </span>
                    </div>
                  </div>
                </div>

                <p className={`text-slate-500 ${isMini ? 'text-[9px]' : 'text-[10px]'} mb-3`}>
                  Avoid hitting <span className="text-red-400">walls</span> or your own{' '}
                  <span className="text-red-400">tail</span>
                </p>

                <button
                  onClick={startGame}
                  className={`w-full ${sizes.button} bg-gradient-to-r from-cyan-500 to-teal-500 rounded-xl font-bold flex items-center justify-center gap-2 hover:from-cyan-400 hover:to-teal-400 transition-all`}
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
              className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <h2 className={`${isMini ? 'text-sm' : 'text-xl'} font-bold text-slate-300 mb-1`}>
                Context full.
              </h2>
              {!isMini && <p className="text-slate-600 text-sm mb-3">Too much context.</p>}

              <div className="text-center mb-2">
                <span className={`text-cyan-400 font-mono ${sizes.score} font-bold`}>
                  {tokenCount}
                </span>
                <span className={`text-slate-500 ${isMini ? 'text-xs' : 'text-sm'} ml-2`}>
                  tokens
                </span>
              </div>

              {/* Points earned display */}
              <AnimatePresence>
                {showPointsEarned && pointsEarnedData && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className={`${isMini ? 'mb-2 px-3 py-1.5' : 'mb-4 px-4 py-2'} rounded-lg bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/30`}
                  >
                    <div
                      className={`flex items-center gap-1.5 text-yellow-400 ${isMini ? 'text-sm' : 'text-base'}`}
                    >
                      <FontAwesomeIcon icon={faStar} className="text-xs" />
                      <span className="font-bold">+{pointsEarnedData.total} points</span>
                    </div>
                    {pointsEarnedData.bonus > 0 && (
                      <p
                        className={`text-yellow-500/70 ${isMini ? 'text-[10px]' : 'text-xs'} mt-0.5 text-center`}
                      >
                        +{pointsEarnedData.base} play + {pointsEarnedData.bonus} bonus
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {isSubmitting && (
                <div className={`mb-2 text-slate-500 ${isMini ? 'text-xs' : 'text-sm'}`}>
                  {isMini ? 'Saving...' : 'Saving score...'}
                </div>
              )}

              {!isAuthenticated && !isSubmitting && (
                <p className={`text-slate-500 ${isMini ? 'text-[10px]' : 'text-xs'} mb-2`}>
                  Sign in to earn points!
                </p>
              )}

              {/* Play again button (full version) */}
              {!isMini && (
                <button
                  onClick={startGame}
                  className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 rounded-xl font-semibold flex items-center gap-2 hover:from-cyan-400 hover:to-teal-400 transition-all text-sm"
                >
                  <FontAwesomeIcon icon={faRotateRight} />
                  Play Again
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Token count during gameplay */}
      {gameState === 'playing' && (
        <div className="text-center">
          <span className={`text-slate-500 ${isMini ? 'text-xs' : 'text-sm'}`}>Tokens:</span>
          <span
            className={`ml-1 text-cyan-400 font-mono ${isMini ? 'text-lg' : 'text-xl'} font-bold`}
          >
            {tokenCount}
          </span>
        </div>
      )}

      {/* Mobile D-pad controls */}
      {gameState === 'playing' && (
        <div className="sm:hidden">
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => changeDirection('UP')}
              className={`${sizes.controlButton} rounded-xl bg-slate-800/80 border border-slate-600/50 flex items-center justify-center active:bg-cyan-500/30 active:border-cyan-500/50 transition-colors`}
            >
              <FontAwesomeIcon icon={faArrowUp} className="text-slate-400" />
            </button>
            <div className="flex gap-1">
              {[
                { dir: 'LEFT' as Direction, icon: faArrowLeft },
                { dir: 'DOWN' as Direction, icon: faArrowDown },
                { dir: 'RIGHT' as Direction, icon: faArrowRight },
              ].map(({ dir, icon }) => (
                <button
                  key={dir}
                  onClick={() => changeDirection(dir)}
                  className={`${sizes.controlButton} rounded-xl bg-slate-800/80 border border-slate-600/50 flex items-center justify-center active:bg-cyan-500/30 active:border-cyan-500/50 transition-colors`}
                >
                  <FontAwesomeIcon icon={icon} className="text-slate-400" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Fun facts (full version only) */}
      {!isMini && (
        <div className="mt-2 w-full max-w-sm">
          <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30 min-h-[80px]">
            <p className="text-cyan-400 font-medium text-xs uppercase tracking-wide mb-2">
              Did you know?
            </p>
            <AnimatePresence mode="wait">
              <motion.p
                key={factIndex}
                className="text-slate-400 text-sm leading-relaxed"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                {shuffledFacts[factIndex]}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}

export default ContextSnakeCore;
