/**
 * EthicsDefenderCore - Shared space shooter game component
 *
 * Used by both the full-page game and the mini chat version.
 * Adapts layout and effects based on the variant prop.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faRocket,
  faStar,
  faTrophy,
  faGem,
  faBolt,
  faHeart,
  faCheck,
  faSkull,
  faSpaceShuttle,
  faCrosshairs,
  faPlay,
  faShieldHalved,
} from '@fortawesome/free-solid-svg-icons';

// Game Types
interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  icon?: typeof faStar;
}

interface Laser {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
}

interface AnswerTarget {
  id: number;
  text: string;
  x: number;
  y: number;
  isCorrect: boolean;
  hit: boolean;
}

interface Question {
  category: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

type GameState = 'intro' | 'playing' | 'showing-result' | 'game-complete';

export interface EthicsDefenderCoreProps {
  variant: 'full' | 'mini';
  onGameEnd?: (score: number) => void;
  onBack?: () => void;
  questions?: Question[];
}

// Default questions
const DEFAULT_QUESTIONS: Question[] = [
  {
    category: 'Bias & Fairness',
    question: 'What is a common source of AI bias?',
    options: [
      'Using diverse training data',
      'Historical data reflecting past discrimination',
      'Regular model updates',
      'User feedback loops',
    ],
    correctIndex: 1,
    explanation: 'AI models trained on historical data can perpetuate past biases.',
  },
  {
    category: 'Privacy',
    question: 'What should AI systems do before collecting personal data?',
    options: [
      'Collect as much as possible',
      'Share with third parties',
      'Obtain informed consent',
      'Store indefinitely',
    ],
    correctIndex: 2,
    explanation: 'Ethical AI requires informed consent before data collection.',
  },
  {
    category: 'Hallucinations',
    question: 'What is an AI "hallucination"?',
    options: [
      'A visual glitch in the UI',
      'When AI confidently generates false information',
      'A type of encryption',
      'A hardware malfunction',
    ],
    correctIndex: 1,
    explanation: 'AI hallucinations are confident but incorrect outputs.',
  },
  {
    category: 'Sustainability',
    question: "How can we reduce AI's carbon footprint?",
    options: [
      'Use larger models always',
      'Run more training cycles',
      'Use efficient prompts and smaller models when possible',
      'Keep servers running idle',
    ],
    correctIndex: 2,
    explanation: 'Efficient prompting and right-sized models reduce environmental impact.',
  },
  {
    category: 'Manipulation',
    question: 'What is a "deepfake"?',
    options: [
      'A secure encryption method',
      'AI-generated synthetic media that looks real',
      'A type of database',
      'A privacy setting',
    ],
    correctIndex: 1,
    explanation: 'Deepfakes are AI-generated media that can spread misinformation.',
  },
  {
    category: 'Accountability',
    question: 'Why is AI explainability important?',
    options: [
      'It makes AI faster',
      'It reduces storage costs',
      'It enables oversight and builds trust',
      'It improves graphics',
    ],
    correctIndex: 2,
    explanation: 'Explainable AI allows humans to understand and verify decisions.',
  },
];

export function EthicsDefenderCore({
  variant,
  onGameEnd,
  onBack,
  questions = DEFAULT_QUESTIONS,
}: EthicsDefenderCoreProps) {
  const isMini = variant === 'mini';

  // Game state
  const [shipPosition, setShipPosition] = useState({ x: 50, y: 85 });
  const [lasers, setLasers] = useState<Laser[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [answerTargets, setAnswerTargets] = useState<AnswerTarget[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [gameState, setGameState] = useState<GameState>('intro');
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [lastAnswer, setLastAnswer] = useState<{ correct: boolean; explanation: string } | null>(
    null
  );
  const [showReward, setShowReward] = useState(false);
  const [showAlienAttack, setShowAlienAttack] = useState(false);
  const [targetedAnswer, setTargetedAnswer] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const laserIdRef = useRef(0);
  const particleIdRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const hasMoved = useRef(false);

  // Variant-specific settings
  const settings = {
    particleCount: isMini ? 8 : 12,
    sparkleCount: isMini ? 12 : 20,
    starCount: isMini ? 30 : 80,
    fontSize: {
      title: isMini ? 'text-2xl' : 'text-4xl sm:text-5xl md:text-7xl',
      subtitle: isMini ? 'text-sm' : 'text-lg sm:text-xl md:text-2xl',
      question: isMini ? 'text-sm' : 'text-lg sm:text-xl',
      answer: isMini ? 'text-xs' : 'text-xs sm:text-sm',
      score: isMini ? 'text-base' : 'text-lg',
      result: isMini ? 'text-xl' : 'text-2xl sm:text-4xl',
    },
    iconSize: {
      ship: isMini ? 'text-4xl' : 'text-5xl',
      result: isMini ? 'text-4xl' : 'text-5xl sm:text-8xl',
      reticle: isMini ? 'text-base' : 'text-xl',
    },
    targetWidth: isMini ? 'max-w-[120px]' : 'max-w-[140px] sm:max-w-[200px]',
    targetPadding: isMini ? 'px-2 py-2' : 'px-2 py-2 sm:px-4 sm:py-3',
  };

  // Setup question targets
  const setupQuestion = useCallback(
    (questionIndex: number) => {
      if (questionIndex >= questions.length) {
        setGameState('game-complete');
        return;
      }

      const question = questions[questionIndex];
      // Adjust spacing for mini variant - more vertical separation
      const xOffset = isMini ? 28 : 25;
      const xSpacing = isMini ? 44 : 50;
      const yOffset = isMini ? 16 : 22;
      const ySpacing = isMini ? 28 : 22;

      const targets: AnswerTarget[] = question.options.map((text, i) => ({
        id: i,
        text,
        x: xOffset + (i % 2) * xSpacing,
        y: yOffset + Math.floor(i / 2) * ySpacing,
        isCorrect: i === question.correctIndex,
        hit: false,
      }));

      setAnswerTargets(targets);
      setCurrentQuestion(questionIndex);
      setGameState('playing');
      setTargetedAnswer(null);
    },
    [questions, isMini]
  );

  // Handle mouse/touch movement
  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current || gameState !== 'playing') return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;
      setShipPosition({ x: Math.max(5, Math.min(95, x)), y: Math.max(60, Math.min(95, y)) });

      // Find which target the ship is pointing at
      const activeTargets = answerTargets.filter((t) => !t.hit);
      if (activeTargets.length > 0) {
        let closest = activeTargets[0];
        let closestDist = Infinity;
        for (const target of activeTargets) {
          const dist = Math.hypot(target.x - x, target.y - y);
          if (dist < closestDist) {
            closestDist = dist;
            closest = target;
          }
        }
        setTargetedAnswer(closest.id);
      }
    },
    [gameState, answerTargets]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    },
    [handleMove]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length > 0) {
        touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        hasMoved.current = false;
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    [handleMove]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length > 0) {
        if (touchStartRef.current) {
          const dx = Math.abs(e.touches[0].clientX - touchStartRef.current.x);
          const dy = Math.abs(e.touches[0].clientY - touchStartRef.current.y);
          if (dx > 10 || dy > 10) {
            hasMoved.current = true;
          }
        }
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    [handleMove]
  );

  // Spawn particles
  const spawnParticles = useCallback(
    (x: number, y: number, count: number, color: string, icons?: (typeof faStar)[]) => {
      const newParticles: Particle[] = [];
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const speed = 2 + Math.random() * 4;
        newParticles.push({
          id: particleIdRef.current++,
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          size: icons ? (isMini ? 16 : 20) : 4 + Math.random() * 8,
          color,
          life: 1,
          icon: icons ? icons[Math.floor(Math.random() * icons.length)] : undefined,
        });
      }
      setParticles((prev) => [...prev, ...newParticles]);
    },
    [isMini]
  );

  // Spawn reward celebration
  const spawnRewardCelebration = useCallback(
    (x: number, y: number) => {
      spawnParticles(x, y, settings.particleCount, '#FFD700', [faStar, faGem, faTrophy, faBolt]);
      spawnParticles(x, y, settings.sparkleCount, '#22D3EE');
    },
    [spawnParticles, settings.particleCount, settings.sparkleCount]
  );

  // Fire laser at targeted answer
  const fireLaser = useCallback(() => {
    if (gameState !== 'playing' || targetedAnswer === null) return;

    const target = answerTargets.find((t) => t.id === targetedAnswer && !t.hit);
    if (!target) return;

    const hitId = laserIdRef.current++;
    const newLaser: Laser = {
      id: hitId,
      x: shipPosition.x,
      y: shipPosition.y - 3,
      targetX: target.x,
      targetY: target.y,
    };
    setLasers((prev) => [...prev, newLaser]);

    // Process hit after laser reaches target
    setTimeout(() => {
      setLasers((prev) => prev.filter((l) => l.id !== hitId));

      setAnswerTargets((prev) => prev.map((t) => (t.id === target.id ? { ...t, hit: true } : t)));

      const question = questions[currentQuestion];

      if (target.isCorrect) {
        setShowReward(true);
        spawnRewardCelebration(target.x, target.y);
        setScore((prev) => prev + 100 + streak * 25);
        setStreak((prev) => prev + 1);
        setLastAnswer({
          correct: true,
          explanation: question.explanation,
        });

        setTimeout(() => {
          setShowReward(false);
          setGameState('showing-result');
        }, 1500);
      } else {
        setShowAlienAttack(true);
        spawnParticles(target.x, target.y, settings.sparkleCount, '#EF4444');
        setStreak(0);
        setLives((prev) => Math.max(0, prev - 1));
        setLastAnswer({
          correct: false,
          explanation: question.explanation,
        });

        setTimeout(() => {
          setShowAlienAttack(false);
          setGameState('showing-result');
        }, 1500);
      }
    }, 300);
  }, [
    gameState,
    targetedAnswer,
    answerTargets,
    shipPosition,
    currentQuestion,
    streak,
    spawnRewardCelebration,
    spawnParticles,
    questions,
    settings.sparkleCount,
  ]);

  // Handle click/tap to fire
  const handleFire = useCallback(() => {
    if (gameState === 'playing') {
      fireLaser();
    }
  }, [gameState, fireLaser]);

  const handleTouchEnd = useCallback(() => {
    if (!hasMoved.current && gameState === 'playing') {
      fireLaser();
    }
    touchStartRef.current = null;
    hasMoved.current = false;
  }, [gameState, fireLaser]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (gameState === 'playing') {
          fireLaser();
        } else if (gameState === 'showing-result') {
          proceedToNext();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fireLaser, gameState]);

  // Update particles
  useEffect(() => {
    if (particles.length === 0) return;
    const interval = setInterval(() => {
      setParticles((prev) =>
        prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.15,
            life: p.life - 0.025,
          }))
          .filter((p) => p.life > 0)
      );
    }, 16);
    return () => clearInterval(interval);
  }, [particles.length]);

  // Check for game over
  useEffect(() => {
    if (lives <= 0 && gameState === 'showing-result') {
      setTimeout(() => setGameState('game-complete'), 500);
    }
  }, [lives, gameState]);

  // Proceed to next question
  const proceedToNext = () => {
    if (lives <= 0) {
      setGameState('game-complete');
    } else if (currentQuestion + 1 >= questions.length) {
      setGameState('game-complete');
    } else {
      setupQuestion(currentQuestion + 1);
    }
    setLastAnswer(null);
  };

  // Reset game
  const resetGame = useCallback(() => {
    setScore(0);
    setStreak(0);
    setLives(3);
    setParticles([]);
    setLasers([]);
    setLastAnswer(null);
    setShowReward(false);
    setShowAlienAttack(false);
    setupQuestion(0);
  }, [setupQuestion]);

  // Handle game complete
  useEffect(() => {
    if (gameState === 'game-complete' && onGameEnd) {
      onGameEnd(score);
    }
  }, [gameState, score, onGameEnd]);

  const currentQuestionData = questions[currentQuestion];

  return (
    <div
      className={`relative overflow-hidden font-sans text-white ${
        isMini ? 'h-[500px] rounded-xl' : 'min-h-screen'
      }`}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950" />
      {!isMini && (
        <>
          <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none" />
          <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-pink-500/5 blur-[120px] pointer-events-none" />
        </>
      )}

      {/* Stars */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(settings.starCount)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              opacity: [0.2, 0.8, 0.2],
              scale: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 2 + Math.random() * 3,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      {/* Game Area */}
      <div
        ref={containerRef}
        className={`relative w-full overflow-hidden cursor-crosshair ${
          isMini ? 'h-full' : 'h-screen'
        }`}
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleFire}
      >
        {/* HUD */}
        {gameState !== 'intro' && (
          <div
            className={`absolute ${isMini ? 'bottom-4' : 'bottom-20'} left-3 right-3 flex justify-between items-end z-20 pointer-events-none`}
          >
            <div className="flex flex-col gap-1">
              <div
                className={`bg-slate-900/80 backdrop-blur-sm ${isMini ? 'px-2 py-1' : 'px-4 py-2'} rounded-lg border border-cyan-500/30`}
              >
                <span className={`text-cyan-400 font-bold ${settings.fontSize.score}`}>
                  Score: {score}
                </span>
              </div>
              {streak > 0 && (
                <motion.div
                  className={`bg-slate-900/80 backdrop-blur-sm ${isMini ? 'px-2 py-0.5' : 'px-3 py-1'} rounded-lg border border-yellow-500/30`}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                >
                  <span className={`text-yellow-400 font-bold ${isMini ? 'text-xs' : 'text-sm'}`}>
                    <FontAwesomeIcon icon={faBolt} className="mr-1" />
                    {streak}x Streak!
                  </span>
                </motion.div>
              )}
            </div>

            <div className="flex flex-col items-end gap-1">
              <div
                className={`bg-slate-900/80 backdrop-blur-sm ${isMini ? 'px-2 py-1' : 'px-4 py-2'} rounded-lg border border-slate-500/30`}
              >
                <span className={`text-slate-300 ${isMini ? 'text-xs' : 'text-sm'}`}>
                  Q{currentQuestion + 1}/{questions.length}
                </span>
              </div>
              <div className="flex gap-0.5">
                {[...Array(3)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={i < lives ? {} : { scale: [1, 0], opacity: [1, 0] }}
                  >
                    <FontAwesomeIcon
                      icon={faHeart}
                      className={`${isMini ? 'text-lg' : 'text-2xl'} ${i < lives ? 'text-red-500' : 'text-slate-700'}`}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Question Display */}
        {gameState === 'playing' && currentQuestionData && (
          <motion.div
            className="absolute top-3 inset-x-0 z-30 flex justify-center px-3"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div
              className={`bg-slate-900/80 backdrop-blur-sm ${isMini ? 'p-2' : 'p-4'} rounded-xl border border-cyan-500/30 text-center max-w-2xl`}
            >
              <div
                className={`${isMini ? 'text-[10px]' : 'text-xs'} text-cyan-400 mb-1 font-semibold uppercase tracking-wider`}
              >
                {currentQuestionData.category}
              </div>
              <p className={`${settings.fontSize.question} font-bold text-white`}>
                {currentQuestionData.question}
              </p>
            </div>
          </motion.div>
        )}

        {/* Answer Targets */}
        {gameState === 'playing' &&
          answerTargets.map((target) => (
            <motion.div
              key={target.id}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-crosshair ${target.hit ? 'pointer-events-none' : ''}`}
              style={{ left: `${target.x}%`, top: `${target.y}%` }}
              initial={{ scale: 0, rotate: -10 }}
              animate={{
                scale: target.hit ? 0 : 1,
                rotate: 0,
                opacity: target.hit ? 0 : 1,
              }}
              transition={{ type: 'spring', bounce: 0.5 }}
            >
              <div
                className={`relative ${settings.targetPadding} rounded-xl text-center ${settings.targetWidth} transition-all ${
                  targetedAnswer === target.id
                    ? 'bg-cyan-500/40 border-2 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.5)]'
                    : 'bg-slate-900/60 backdrop-blur-sm border border-slate-600/50'
                }`}
              >
                {targetedAnswer === target.id && (
                  <motion.div
                    className="absolute -top-2 -right-2 text-cyan-400"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  >
                    <FontAwesomeIcon icon={faCrosshairs} className={settings.iconSize.reticle} />
                  </motion.div>
                )}
                <span className={`${settings.fontSize.answer} font-medium leading-tight`}>
                  {target.text}
                </span>
              </div>
            </motion.div>
          ))}

        {/* Aim Line */}
        {gameState === 'playing' && targetedAnswer !== null && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-5">
            {answerTargets
              .filter((t) => t.id === targetedAnswer && !t.hit)
              .map((target) => (
                <motion.line
                  key={`aim-${target.id}`}
                  x1={`${shipPosition.x}%`}
                  y1={`${shipPosition.y - 5}%`}
                  x2={`${target.x}%`}
                  y2={`${target.y}%`}
                  stroke="rgba(6, 182, 212, 0.3)"
                  strokeWidth="2"
                  strokeDasharray="8,8"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                />
              ))}
          </svg>
        )}

        {/* Lasers */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          {lasers.map((laser) => (
            <motion.line
              key={laser.id}
              x1={`${laser.x}%`}
              y1={`${laser.y}%`}
              x2={`${laser.x}%`}
              y2={`${laser.y}%`}
              stroke="#22D3EE"
              strokeWidth="4"
              strokeLinecap="round"
              filter="url(#glow)"
              initial={{ x2: `${laser.x}%`, y2: `${laser.y}%` }}
              animate={{
                x2: `${laser.targetX}%`,
                y2: `${laser.targetY}%`,
              }}
              transition={{ duration: 0.25, ease: 'linear' }}
            />
          ))}
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        </svg>

        {/* Particles */}
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute pointer-events-none"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              opacity: particle.life,
            }}
          >
            {particle.icon ? (
              <FontAwesomeIcon
                icon={particle.icon}
                style={{
                  color: particle.color,
                  fontSize: `${particle.size}px`,
                  filter: `drop-shadow(0 0 ${particle.size / 2}px ${particle.color})`,
                }}
              />
            ) : (
              <div
                className="rounded-full"
                style={{
                  width: particle.size,
                  height: particle.size,
                  backgroundColor: particle.color,
                  boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`,
                }}
              />
            )}
          </motion.div>
        ))}

        {/* Ship */}
        {gameState === 'playing' && (
          <motion.div
            className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20"
            style={{ left: `${shipPosition.x}%`, top: `${shipPosition.y}%` }}
            animate={{
              y: [0, -3, 0],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="relative">
              <FontAwesomeIcon
                icon={faSpaceShuttle}
                className={`${settings.iconSize.ship} text-cyan-400 -rotate-90 drop-shadow-[0_0_15px_rgba(34,211,238,0.6)]`}
              />
              {/* Engine glow */}
              <motion.div
                className={`absolute -bottom-2 left-1/2 -translate-x-1/2 ${isMini ? 'w-3 h-4' : 'w-4 h-6'} bg-gradient-to-b from-cyan-400 to-transparent rounded-full blur-sm`}
                animate={{ opacity: [0.5, 1, 0.5], scaleY: [0.8, 1.2, 0.8] }}
                transition={{ duration: 0.3, repeat: Infinity }}
              />
            </div>
          </motion.div>
        )}

        {/* Reward Animation Overlay */}
        <AnimatePresence>
          {showReward && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="text-center"
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.3, 1] }}
                transition={{ duration: 0.5 }}
              >
                <motion.div
                  className={`${settings.iconSize.result} mb-2`}
                  animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.5, repeat: 2 }}
                >
                  <FontAwesomeIcon
                    icon={faCheck}
                    className="text-green-400 drop-shadow-[0_0_30px_rgba(74,222,128,0.8)]"
                  />
                </motion.div>
                <motion.p
                  className={`${settings.fontSize.result} font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-400`}
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.3, repeat: 3 }}
                >
                  CORRECT!
                </motion.p>
                <motion.p
                  className={`${isMini ? 'text-base' : 'text-lg sm:text-2xl'} text-yellow-400 mt-1`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  +{100 + streak * 25} points!
                </motion.p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Alien Attack Animation Overlay */}
        <AnimatePresence>
          {showAlienAttack && (
            <motion.div
              className="absolute inset-0 z-30 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Red flash */}
              <motion.div
                className="absolute inset-0 bg-red-500/30"
                animate={{ opacity: [0, 0.5, 0, 0.3, 0] }}
                transition={{ duration: 1 }}
              />
              {/* Warning text */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  className="text-center"
                  initial={{ scale: 0, rotate: -10 }}
                  animate={{ scale: [0, 1.3, 1], rotate: [10, -5, 0] }}
                  transition={{ duration: 0.4 }}
                >
                  <motion.div
                    className={`${settings.iconSize.result} mb-2`}
                    animate={{ x: [-5, 5, -5, 5, 0] }}
                    transition={{ duration: 0.4, repeat: 2 }}
                  >
                    <FontAwesomeIcon
                      icon={faSkull}
                      className="text-red-500 drop-shadow-[0_0_30px_rgba(239,68,68,0.8)]"
                    />
                  </motion.div>
                  <motion.p
                    className={`${settings.fontSize.result} font-black text-red-500`}
                    animate={{ x: [-3, 3, -3, 3, 0] }}
                    transition={{ duration: 0.3, repeat: 2 }}
                  >
                    WRONG!
                  </motion.p>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Result Screen */}
        <AnimatePresence>
          {gameState === 'showing-result' && lastAnswer && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center z-30 bg-slate-950/80 backdrop-blur-sm px-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className={`bg-slate-900/90 backdrop-blur-sm ${isMini ? 'p-4' : 'p-6 sm:p-8'} rounded-2xl border max-w-md w-full text-center ${
                  lastAnswer.correct ? 'border-green-500/50' : 'border-red-500/50'
                }`}
                initial={{ scale: 0.8, y: 20 }}
                animate={{ scale: 1, y: 0 }}
              >
                <div
                  className={`${isMini ? 'text-4xl' : 'text-6xl'} mb-3 ${lastAnswer.correct ? 'text-green-400' : 'text-red-400'}`}
                >
                  <FontAwesomeIcon icon={lastAnswer.correct ? faTrophy : faSkull} />
                </div>

                <h2
                  className={`${isMini ? 'text-xl' : 'text-2xl'} font-bold mb-3 ${lastAnswer.correct ? 'text-green-400' : 'text-red-400'}`}
                >
                  {lastAnswer.correct ? 'Great Job!' : 'Not Quite!'}
                </h2>

                <p className={`text-slate-300 ${isMini ? 'text-xs mb-4' : 'text-sm mb-6'}`}>
                  {lastAnswer.explanation}
                </p>

                <button
                  onClick={proceedToNext}
                  className={`w-full ${isMini ? 'py-3 text-base' : 'py-4 text-xl'} rounded-xl font-bold transition-all flex items-center justify-center gap-3 ${
                    lastAnswer.correct
                      ? 'bg-gradient-to-r from-green-500 to-cyan-500 hover:from-green-400 hover:to-cyan-400'
                      : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400'
                  } text-white`}
                >
                  {lives <= 0
                    ? 'See Results'
                    : currentQuestion + 1 >= questions.length
                      ? 'See Results'
                      : 'Next Question'}
                  <FontAwesomeIcon icon={faRocket} />
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Game Complete Screen */}
        <AnimatePresence>
          {gameState === 'game-complete' && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center z-30 bg-slate-950/90 backdrop-blur-md px-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className={`bg-slate-900/90 backdrop-blur-sm ${isMini ? 'p-4' : 'p-8'} rounded-2xl border border-cyan-500/30 max-w-md w-full text-center`}
                initial={{ scale: 0.8, y: 20 }}
                animate={{ scale: 1, y: 0 }}
              >
                <motion.div
                  className={`${isMini ? 'text-5xl' : 'text-7xl'} mb-3`}
                  animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  {lives > 0 ? '🎉' : '💫'}
                </motion.div>

                <h2
                  className={`${isMini ? 'text-xl' : 'text-3xl'} font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-500 mb-2`}
                >
                  {lives > 0 ? 'Mission Complete!' : 'Mission Over'}
                </h2>

                <p className={`text-slate-400 ${isMini ? 'text-xs mb-3' : 'text-sm mb-6'}`}>
                  {lives > 0
                    ? "You've defended the future of AI!"
                    : 'Keep learning about AI ethics!'}
                </p>

                <div
                  className={`bg-slate-800/50 ${isMini ? 'p-3 mb-3' : 'p-4 mb-6'} rounded-xl`}
                >
                  <div className="flex justify-center gap-8">
                    <div className="text-center">
                      <div
                        className={`${isMini ? 'text-xl' : 'text-3xl'} font-bold text-cyan-400`}
                      >
                        {score}
                      </div>
                      <div className={`${isMini ? 'text-[10px]' : 'text-sm'} text-slate-400`}>
                        Final Score
                      </div>
                    </div>
                    <div className="text-center">
                      <div
                        className={`${isMini ? 'text-xl' : 'text-3xl'} font-bold text-green-400`}
                      >
                        {questions.filter((_, i) => i <= currentQuestion).length - (3 - lives)}/
                        {questions.length}
                      </div>
                      <div className={`${isMini ? 'text-[10px]' : 'text-sm'} text-slate-400`}>
                        Correct
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={resetGame}
                    className={`w-full ${isMini ? 'py-3 text-base' : 'py-4 text-xl'} bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 rounded-xl font-bold transition-all flex items-center justify-center gap-3 text-white`}
                  >
                    <FontAwesomeIcon icon={faRocket} />
                    Play Again
                  </button>
                  {onBack && (
                    <button
                      onClick={onBack}
                      className={`w-full ${isMini ? 'py-2 text-sm' : 'py-3 text-base'} bg-slate-800/50 border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white rounded-xl font-semibold transition-all`}
                    >
                      Back
                    </button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Intro Screen */}
        <AnimatePresence>
          {gameState === 'intro' && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center z-30 overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="relative z-10 text-center px-4">
                {/* Icon */}
                <motion.div
                  className={`${isMini ? 'w-16 h-16' : 'w-20 h-20'} mx-auto mb-4 rounded-full bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/30 flex items-center justify-center`}
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <FontAwesomeIcon
                    icon={faShieldHalved}
                    className={`${isMini ? 'w-8 h-8' : 'w-10 h-10'} text-cyan-400`}
                  />
                </motion.div>

                {/* Title */}
                <motion.h1
                  className={`${settings.fontSize.title} font-black mb-2`}
                  initial={{ y: -20 }}
                  animate={{ y: 0 }}
                >
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-pink-500">
                    Ethics Defender
                  </span>
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                  className={`${settings.fontSize.subtitle} text-cyan-300 mb-4`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  Blast the correct answer to defend AI ethics!
                </motion.p>

                {/* Ship icon */}
                <motion.div
                  className={`${isMini ? 'text-4xl' : 'text-5xl sm:text-6xl'} mb-4`}
                  animate={{
                    y: [0, -10, 0],
                    rotate: [0, 5, -5, 0],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  <FontAwesomeIcon icon={faSpaceShuttle} className="text-cyan-400 -rotate-45" />
                </motion.div>

                {/* Controls hint */}
                <motion.div
                  className={`flex items-center justify-center gap-4 mb-6 text-slate-400 ${isMini ? 'text-xs' : 'text-sm'}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <span className="flex items-center gap-1">
                    <span>👆</span>
                    <span>Aim</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span>🖱️</span>
                    <span>Tap to Fire</span>
                  </span>
                </motion.div>

                {/* Start button */}
                <motion.button
                  onClick={() => setupQuestion(0)}
                  className={`${isMini ? 'px-6 py-3 text-base' : 'px-8 py-4 text-xl'} bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 rounded-xl font-bold transition-all flex items-center justify-center gap-3 text-white mx-auto`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FontAwesomeIcon icon={faPlay} />
                  Start Mission
                </motion.button>

                {/* Back button for full version */}
                {onBack && !isMini && (
                  <motion.button
                    onClick={onBack}
                    className="mt-4 text-slate-500 hover:text-slate-300 transition-colors text-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                  >
                    ← Back to Side Quests
                  </motion.button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Instructions (playing state) */}
        {gameState === 'playing' && (
          <motion.div
            className={`absolute ${isMini ? 'bottom-16' : 'bottom-6'} left-0 right-0 flex justify-center z-20 px-2 pointer-events-none`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div
              className={`bg-slate-900/80 backdrop-blur-sm ${isMini ? 'px-2 py-1' : 'px-4 py-2'} rounded-xl border border-cyan-500/20 text-center`}
            >
              <p className={`text-cyan-400 ${isMini ? 'text-[10px]' : 'text-xs sm:text-sm'}`}>
                {isMini ? 'Tap to aim & fire!' : 'Move to aim • Tap or SPACE to fire!'}
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default EthicsDefenderCore;
