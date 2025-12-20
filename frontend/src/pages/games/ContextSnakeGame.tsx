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
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { useGameScore } from '@/hooks/useGameScore';
import type { PointsAwarded } from '@/services/games';

// Score tier thresholds
const SCORE_TIERS = {
  LOW: 10,    // 0-9: crash effect
  MEDIUM: 30, // 10-29: subtle effect
  // 30+: celebration
};

// Types
interface Position {
  x: number;
  y: number;
}

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type GameState = 'intro' | 'ready' | 'playing' | 'context-full';

// Constants
const GRID_SIZE = 15;
const INITIAL_SPEED = 180;

// Fun facts about context windows
const CONTEXT_FACTS = [
  "Claude's context window is 200K tokens — about 150,000 words or 500 pages.",
  "The word 'tokenization' breaks text into chunks. 'Hello' is 1 token, but 'Hello!' is 2.",
  "GPT-2 (2019) had only 1,024 tokens. Today's models have 100x more.",
  "Images use tokens too — a single photo can cost 1,000+ tokens.",
  "Code uses more tokens than plain English because of symbols and formatting.",
  "The average novel is about 100K tokens. Claude can read one in a single prompt.",
  "Tokens aren't words — 'chatting' might be split into 'chat' + 'ting'.",
  "Context windows are like RAM for AI — bigger means more working memory.",
  "Early chatbots had ~50 token windows. They forgot everything immediately.",
  "Longer context doesn't always mean better answers — focus matters more.",
];

export default function ContextSnakeGame() {
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

  // Token eaten particle bursts
  const [particleBursts, setParticleBursts] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const particleIdRef = useRef(0);
  const particleTimeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // Confetti reward hook
  const { reward: confettiReward } = useReward('confettiAnchor', 'confetti', {
    elementCount: 100,
    spread: 90,
    startVelocity: 35,
    colors: ['#22D3EE', '#FB37FF', '#4ADE80', '#FBBF24'],
  });

  // Calculate cell size based on screen
  const [cellSize, setCellSize] = useState(20);

  // Game state
  const [gameState, setGameState] = useState<GameState>('intro');
  const [snake, setSnake] = useState<Position[]>([{ x: 7, y: 7 }]);
  const [token, setToken] = useState<Position>({ x: 11, y: 7 });
  const [, setDirection] = useState<Direction>('RIGHT');
  const [tokenCount, setTokenCount] = useState(0);

  // Refs for game loop
  const directionRef = useRef<Direction>('RIGHT');
  const gameLoopRef = useRef<number | null>(null);
  const touchStartRef = useRef<Position | null>(null);

  // Fun fact rotation
  const [factIndex, setFactIndex] = useState(0);
  const shuffledFacts = useMemo(() => {
    return [...CONTEXT_FACTS].sort(() => Math.random() - 0.5);
  }, []);

  // Rotate facts every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setFactIndex(prev => (prev + 1) % shuffledFacts.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [shuffledFacts.length]);

  // Responsive cell size
  useEffect(() => {
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
  }, []);

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

  // Check collision with walls or self
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
        setGameState('context-full');
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
        // Trigger particle burst at token position
        const burstId = particleIdRef.current++;
        setParticleBursts(prev => [...prev, { id: burstId, x: token.x, y: token.y }]);
        // Clean up particle after animation (with tracked timeout)
        const timeoutId = setTimeout(() => {
          setParticleBursts(prev => prev.filter(p => p.id !== burstId));
          particleTimeoutsRef.current.delete(burstId);
        }, 600);
        particleTimeoutsRef.current.set(burstId, timeoutId);
        spawnToken(newSnake);
      } else {
        newSnake.pop();
      }

      return newSnake;
    });
  }, [token, checkCollision, spawnToken]);

  // Start game
  const startGame = useCallback(() => {
    setSnake([{ x: 7, y: 7 }]);
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
    spawnToken([{ x: 7, y: 7 }]);
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

      if (gameState === 'ready' || gameState === 'context-full') {
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

  // Touch controls - swipe anywhere on screen
  useEffect(() => {
    if (gameState !== 'playing') return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        touchStartRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
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

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
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

  // Cleanup particle timeouts on unmount
  useEffect(() => {
    return () => {
      particleTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      particleTimeoutsRef.current.clear();
    };
  }, []);

  // Submit score when game ends
  useEffect(() => {
    if (gameState === 'context-full' && !hasSubmittedRef.current && tokenCount > 0) {
      hasSubmittedRef.current = true;
      submitScore(tokenCount);
    }
  }, [gameState, tokenCount, submitScore]);

  // Trigger end-game animations based on score tier
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    if (gameState === 'context-full') {
      if (tokenCount >= SCORE_TIERS.MEDIUM) {
        // High score: celebration with confetti
        confettiReward();
      } else if (tokenCount < SCORE_TIERS.LOW) {
        // Low score: crash effect with shake and flash
        setIsShaking(true);
        setShowCrashFlash(true);
        timeoutId = setTimeout(() => {
          setIsShaking(false);
          setShowCrashFlash(false);
        }, 400);
      } else {
        // Medium score: subtle shake only
        setIsShaking(true);
        timeoutId = setTimeout(() => setIsShaking(false), 300);
      }
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [gameState, tokenCount, confettiReward]);

  const gridPixelSize = GRID_SIZE * cellSize;

  return (
    <DashboardLayout>
      <div className="h-full overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-12 flex flex-col items-center">
          {/* Header - always visible */}
          <div className="text-center mb-4">
            <h1 className="text-2xl sm:text-3xl font-black flex items-center justify-center gap-3">
              <FontAwesomeIcon icon={faWorm} className="text-cyan-400" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-400">
                Context Snake
              </span>
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Collect tokens and grow your snake as long as you can!
            </p>
          </div>

          {/* Game Area */}
          <div className="flex flex-col items-center">
            {/* Confetti anchor point */}
            <span id="confettiAnchor" className="absolute" style={{ top: '40%', left: '50%' }} />

            {/* Game canvas with shake animation */}
            <motion.div
              className="relative border border-slate-700/50 rounded-lg overflow-hidden"
              style={{
                width: gridPixelSize,
                height: gridPixelSize,
                background: 'rgba(2, 6, 23, 0.8)',
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
              {gameState !== 'intro' && gameState !== 'ready' && snake.map((segment, index) => (
                <motion.div
                  key={`${segment.x}-${segment.y}-${index}`}
                  className="absolute rounded-sm"
                  style={{
                    width: cellSize - 2,
                    height: cellSize - 2,
                    left: segment.x * cellSize + 1,
                    top: segment.y * cellSize + 1,
                    background: index === 0
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

              {/* Particle bursts when eating tokens */}
              <AnimatePresence>
                {particleBursts.map(burst => (
                  <div
                    key={burst.id}
                    className="absolute pointer-events-none"
                    style={{
                      left: burst.x * cellSize + cellSize / 2,
                      top: burst.y * cellSize + cellSize / 2,
                    }}
                  >
                    {/* 8 particles radiating outward */}
                    {[...Array(8)].map((_, i) => {
                      const angle = (i * 45) * (Math.PI / 180);
                      const distance = 20;
                      return (
                        <motion.div
                          key={i}
                          className="absolute w-2 h-2 rounded-full"
                          style={{
                            background: i % 2 === 0 ? '#FB37FF' : '#22D3EE',
                            boxShadow: i % 2 === 0
                              ? '0 0 6px rgba(251, 55, 255, 0.8)'
                              : '0 0 6px rgba(34, 211, 238, 0.8)',
                            marginLeft: -4,
                            marginTop: -4,
                          }}
                          initial={{
                            x: 0,
                            y: 0,
                            scale: 1,
                            opacity: 1
                          }}
                          animate={{
                            x: Math.cos(angle) * distance,
                            y: Math.sin(angle) * distance,
                            scale: 0,
                            opacity: 0,
                          }}
                          transition={{
                            duration: 0.5,
                            ease: 'easeOut'
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </AnimatePresence>

              {/* Intro overlay - explains context window */}
              <AnimatePresence>
                {gameState === 'intro' && (
                  <motion.div
                    className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-sm p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="text-center max-w-[280px]">
                      <p className="text-slate-300 text-sm leading-relaxed mb-3">
                        AI models have a <span className="text-cyan-400 font-medium">context window</span> — a limit on how much text they can process at once.
                      </p>
                      <p className="text-slate-400 text-sm leading-relaxed mb-4">
                        Text is split into <span className="text-pink-400 font-medium">tokens</span>, and when the window fills up, things break.
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

              {/* Ready overlay - how to play with animated demo */}
              <AnimatePresence>
                {gameState === 'ready' && (
                  <motion.div
                    className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-sm p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="text-center max-w-[280px]">
                      <h3 className="text-cyan-400 font-bold text-sm mb-3">How to Play</h3>

                      {/* Animated demo showing snake eating token */}
                      <div className="relative w-48 h-24 mx-auto mb-4 bg-slate-900/80 rounded-lg border border-slate-700/50 overflow-hidden">
                        {/* Mini grid background */}
                        <div
                          className="absolute inset-0 opacity-20"
                          style={{
                            backgroundImage: `
                              linear-gradient(to right, rgba(148, 163, 184, 0.3) 1px, transparent 1px),
                              linear-gradient(to bottom, rgba(148, 163, 184, 0.3) 1px, transparent 1px)
                            `,
                            backgroundSize: '12px 12px',
                          }}
                        />

                        {/* Animated snake moving right and eating token */}
                        <motion.div
                          className="absolute flex"
                          initial={{ x: 20, y: 42 }}
                          animate={{
                            x: [20, 80, 80, 140],
                            y: [42, 42, 42, 42],
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
                            className="w-3 h-3 rounded-sm"
                            style={{
                              background: 'linear-gradient(135deg, #22D3EE, #4ADEE7)',
                              boxShadow: '0 0 8px rgba(34, 211, 238, 0.6)',
                            }}
                          />
                          {/* Snake body segments */}
                          <motion.div
                            className="w-3 h-3 rounded-sm -ml-0.5"
                            style={{ background: 'rgba(34, 211, 238, 0.7)' }}
                            animate={{
                              width: [12, 12, 12, 24], // Grows after eating
                            }}
                            transition={{
                              duration: 3,
                              times: [0, 0.4, 0.5, 1],
                              repeat: Infinity,
                              repeatDelay: 1,
                            }}
                          />
                        </motion.div>

                        {/* First token that gets eaten */}
                        <motion.div
                          className="absolute w-3 h-3 rounded-full"
                          style={{
                            left: 80,
                            top: 42,
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

                        {/* Second token that appears after first is eaten */}
                        <motion.div
                          className="absolute w-3 h-3 rounded-full"
                          style={{
                            left: 140,
                            top: 42,
                            background: 'linear-gradient(135deg, #FB37FF, #E879F9)',
                            boxShadow: '0 0 10px rgba(251, 55, 255, 0.6)',
                          }}
                          animate={{
                            scale: [0, 0, 0, 0, 0, 1, 1.2, 1],
                            opacity: [0, 0, 0, 0, 0, 1, 1, 1],
                          }}
                          transition={{
                            duration: 4,
                            times: [0, 0.15, 0.25, 0.35, 0.4, 0.45, 0.55, 1],
                            repeat: Infinity,
                            repeatDelay: 0.5,
                          }}
                        />

                        {/* Arrow key hint floating above */}
                        <motion.div
                          className="absolute top-2 right-3 flex items-center gap-1"
                          animate={{ opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          <FontAwesomeIcon icon={faArrowRight} className="text-cyan-400 text-xs" />
                        </motion.div>

                        {/* "Eat tokens" label */}
                        <div className="absolute bottom-1 left-2 text-[9px] text-slate-500">
                          eat tokens to grow
                        </div>
                      </div>

                      {/* Controls section */}
                      <div className="mb-4">
                        <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-2">Controls</p>
                        <div className="flex justify-center items-center gap-1 mb-2">
                          {/* Arrow key cluster */}
                          <div className="flex flex-col items-center gap-0.5">
                            <motion.div
                              className="w-6 h-6 rounded bg-slate-700 border border-slate-600 flex items-center justify-center"
                              animate={{ scale: [1, 1.1, 1], borderColor: ['#475569', '#22D3EE', '#475569'] }}
                              transition={{ duration: 2, repeat: Infinity, delay: 0 }}
                            >
                              <FontAwesomeIcon icon={faArrowUp} className="text-slate-300 text-[10px]" />
                            </motion.div>
                            <div className="flex gap-0.5">
                              <motion.div
                                className="w-6 h-6 rounded bg-slate-700 border border-slate-600 flex items-center justify-center"
                                animate={{ scale: [1, 1.1, 1], borderColor: ['#475569', '#22D3EE', '#475569'] }}
                                transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                              >
                                <FontAwesomeIcon icon={faArrowLeft} className="text-slate-300 text-[10px]" />
                              </motion.div>
                              <motion.div
                                className="w-6 h-6 rounded bg-slate-700 border border-slate-600 flex items-center justify-center"
                                animate={{ scale: [1, 1.1, 1], borderColor: ['#475569', '#22D3EE', '#475569'] }}
                                transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                              >
                                <FontAwesomeIcon icon={faArrowDown} className="text-slate-300 text-[10px]" />
                              </motion.div>
                              <motion.div
                                className="w-6 h-6 rounded bg-slate-700 border border-slate-600 flex items-center justify-center"
                                animate={{ scale: [1, 1.1, 1], borderColor: ['#475569', '#22D3EE', '#475569'] }}
                                transition={{ duration: 2, repeat: Infinity, delay: 1.5 }}
                              >
                                <FontAwesomeIcon icon={faArrowRight} className="text-slate-300 text-[10px]" />
                              </motion.div>
                            </div>
                          </div>

                          <span className="text-slate-600 text-xs mx-2">or</span>

                          {/* Swipe gesture */}
                          <div className="relative w-12 h-12 rounded-lg bg-slate-800/50 border border-slate-700/50 flex items-center justify-center">
                            <motion.div
                              className="absolute w-2 h-2 rounded-full bg-cyan-400"
                              animate={{
                                x: [0, 8, 0, -8, 0],
                                y: [0, 0, 8, 0, -8],
                              }}
                              transition={{ duration: 2, repeat: Infinity }}
                            />
                            <span className="text-[8px] text-slate-500 absolute -bottom-3">swipe</span>
                          </div>
                        </div>
                      </div>

                      {/* Warning */}
                      <p className="text-slate-500 text-[10px] mb-4">
                        Avoid hitting <span className="text-red-400">walls</span> or your own <span className="text-red-400">tail</span>
                      </p>

                      <button
                        onClick={startGame}
                        className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 rounded-xl font-bold flex items-center justify-center gap-2 hover:from-cyan-400 hover:to-teal-400 transition-all"
                      >
                        <FontAwesomeIcon icon={faPlay} />
                        Play
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Game over overlay */}
              <AnimatePresence>
                {gameState === 'context-full' && (
                  <motion.div
                    className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <h2 className="text-xl font-bold text-slate-300 mb-1">Context full.</h2>
                    <p className="text-slate-600 text-sm mb-3">Too much context.</p>

                    <div className="text-center mb-2">
                      <span className="text-cyan-400 font-mono text-3xl font-bold">{tokenCount}</span>
                      <span className="text-slate-500 text-sm ml-2">tokens</span>
                    </div>

                    {/* Points earned display */}
                    <AnimatePresence>
                      {showPointsEarned && pointsEarnedData && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.9 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0 }}
                          className="mb-4 px-4 py-2 rounded-lg bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/30"
                        >
                          <div className="flex items-center gap-2 text-yellow-400">
                            <FontAwesomeIcon icon={faStar} className="text-sm" />
                            <span className="font-bold">+{pointsEarnedData.total} points</span>
                          </div>
                          {pointsEarnedData.bonus > 0 && (
                            <p className="text-yellow-500/70 text-xs mt-1">
                              +{pointsEarnedData.base} play + {pointsEarnedData.bonus} bonus
                            </p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {isSubmitting && (
                      <div className="mb-4 text-slate-500 text-sm">
                        Saving score...
                      </div>
                    )}

                    {!isAuthenticated && (
                      <p className="text-slate-500 text-xs mb-4">
                        Sign in to earn points!
                      </p>
                    )}

                    <button
                      onClick={startGame}
                      className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 rounded-xl font-semibold flex items-center gap-2 hover:from-cyan-400 hover:to-teal-400 transition-all text-sm"
                    >
                      <FontAwesomeIcon icon={faRotateRight} />
                      Play Again
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Token count - during gameplay */}
            {gameState === 'playing' && (
              <div className="mt-3 text-center">
                <span className="text-slate-500 text-sm">Tokens:</span>
                <span className="ml-2 text-cyan-400 font-mono text-xl font-bold">{tokenCount}</span>
              </div>
            )}

            {/* Mobile D-pad controls */}
            {gameState === 'playing' && (
              <div className="mt-4 sm:hidden">
                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={() => changeDirection('UP')}
                    className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-600/50 flex items-center justify-center active:bg-cyan-500/30 active:border-cyan-500/50 transition-colors"
                  >
                    <FontAwesomeIcon icon={faArrowUp} className="text-slate-400" />
                  </button>
                  <div className="flex gap-1">
                    <button
                      onClick={() => changeDirection('LEFT')}
                      className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-600/50 flex items-center justify-center active:bg-cyan-500/30 active:border-cyan-500/50 transition-colors"
                    >
                      <FontAwesomeIcon icon={faArrowLeft} className="text-slate-400" />
                    </button>
                    <button
                      onClick={() => changeDirection('DOWN')}
                      className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-600/50 flex items-center justify-center active:bg-cyan-500/30 active:border-cyan-500/50 transition-colors"
                    >
                      <FontAwesomeIcon icon={faArrowDown} className="text-slate-400" />
                    </button>
                    <button
                      onClick={() => changeDirection('RIGHT')}
                      className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-600/50 flex items-center justify-center active:bg-cyan-500/30 active:border-cyan-500/50 transition-colors"
                    >
                      <FontAwesomeIcon icon={faArrowRight} className="text-slate-400" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Fun facts - below game */}
          <div className="mt-6 w-full max-w-sm">
            <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30 min-h-[80px]">
              <p className="text-cyan-400 font-medium text-xs uppercase tracking-wide mb-2">Did you know?</p>
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
        </div>
      </div>
    </DashboardLayout>
  );
}
