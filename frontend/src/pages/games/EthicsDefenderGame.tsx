import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faRocket,
  faArrowLeft,
  faStar,
  faTrophy,
  faGem,
  faBolt,
  faHeart,
  faCheck,
  faSkull,
  faSpaceShuttle,
  faCrosshairs,
} from '@fortawesome/free-solid-svg-icons';
import { Link } from 'react-router-dom';

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

interface AlienAttack {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
}

type GameState = 'intro' | 'playing' | 'showing-result' | 'game-complete';

// Quiz Questions - each is a round
const QUESTIONS = [
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
    question: 'How can we reduce AI\'s carbon footprint?',
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

export default function EthicsDefenderGame() {
  const [shipPosition, setShipPosition] = useState({ x: 50, y: 85 });
  const [lasers, setLasers] = useState<Laser[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [answerTargets, setAnswerTargets] = useState<AnswerTarget[]>([]);
  const [alienAttacks, setAlienAttacks] = useState<AlienAttack[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [gameState, setGameState] = useState<GameState>('intro');
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [lastAnswer, setLastAnswer] = useState<{ correct: boolean; explanation: string } | null>(null);
  const [showReward, setShowReward] = useState(false);
  const [showAlienAttack, setShowAlienAttack] = useState(false);
  const [targetedAnswer, setTargetedAnswer] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const laserIdRef = useRef(0);
  const particleIdRef = useRef(0);
  const alienIdRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const hasMoved = useRef(false);

  // Setup question targets
  const setupQuestion = useCallback((questionIndex: number) => {
    if (questionIndex >= QUESTIONS.length) {
      setGameState('game-complete');
      return;
    }

    const question = QUESTIONS[questionIndex];
    // Position targets in a 2x2 grid, more centered for mobile
    // Left column: 20-30%, Right column: 70-80%
    const targets: AnswerTarget[] = question.options.map((text, i) => ({
      id: i,
      text,
      x: 25 + (i % 2) * 50, // 25% or 75% - more centered
      y: 22 + Math.floor(i / 2) * 22, // Tighter vertical spacing
      isCorrect: i === question.correctIndex,
      hit: false,
    }));

    setAnswerTargets(targets);
    setCurrentQuestion(questionIndex);
    setGameState('playing');
    setTargetedAnswer(null);
  }, []);

  // Handle mouse/touch movement
  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current || gameState !== 'playing') return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    setShipPosition({ x: Math.max(5, Math.min(95, x)), y: Math.max(60, Math.min(95, y)) });

    // Find which target the ship is pointing at (aim line)
    const activeTargets = answerTargets.filter(t => !t.hit);
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
  }, [gameState, answerTargets]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    handleMove(e.clientX, e.clientY);
  }, [handleMove]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      hasMoved.current = false;
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, [handleMove]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      // Check if moved significantly (more than 10px)
      if (touchStartRef.current) {
        const dx = Math.abs(e.touches[0].clientX - touchStartRef.current.x);
        const dy = Math.abs(e.touches[0].clientY - touchStartRef.current.y);
        if (dx > 10 || dy > 10) {
          hasMoved.current = true;
        }
      }
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, [handleMove]);

  // Spawn particles
  const spawnParticles = useCallback((x: number, y: number, count: number, color: string, icons?: (typeof faStar)[]) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 2 + Math.random() * 4;
      newParticles.push({
        id: particleIdRef.current++,
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: icons ? 20 : 4 + Math.random() * 8,
        color,
        life: 1,
        icon: icons ? icons[Math.floor(Math.random() * icons.length)] : undefined,
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
  }, []);

  // Spawn reward celebration
  const spawnRewardCelebration = useCallback((x: number, y: number) => {
    // Stars, gems, trophies burst out
    spawnParticles(x, y, 12, '#FFD700', [faStar, faGem, faTrophy, faBolt]);
    // Regular sparkles
    spawnParticles(x, y, 20, '#22D3EE');
  }, [spawnParticles]);

  // Spawn alien attack effect
  const spawnAlienAttackEffect = useCallback(() => {
    // Create multiple alien attacks coming toward the ship
    const attacks: AlienAttack[] = [];
    for (let i = 0; i < 5; i++) {
      attacks.push({
        id: alienIdRef.current++,
        x: 10 + Math.random() * 80,
        y: 5 + Math.random() * 15,
        targetX: shipPosition.x,
        targetY: shipPosition.y,
      });
    }
    setAlienAttacks(attacks);

    // Clear after animation
    setTimeout(() => setAlienAttacks([]), 1500);
  }, [shipPosition]);

  // Fire laser at targeted answer
  const fireLaser = useCallback(() => {
    if (gameState !== 'playing' || targetedAnswer === null) return;

    const target = answerTargets.find(t => t.id === targetedAnswer && !t.hit);
    if (!target) return;

    const hitId = laserIdRef.current++;
    const newLaser: Laser = {
      id: hitId,
      x: shipPosition.x,
      y: shipPosition.y - 3,
      targetX: target.x,
      targetY: target.y,
    };
    setLasers(prev => [...prev, newLaser]);

    // Process hit after laser reaches target
    setTimeout(() => {
      setLasers(prev => prev.filter(l => l.id !== hitId));

      // Mark target as hit
      setAnswerTargets(prev => prev.map(t =>
        t.id === target.id ? { ...t, hit: true } : t
      ));

      const question = QUESTIONS[currentQuestion];

      if (target.isCorrect) {
        // CORRECT ANSWER - rewards!
        setShowReward(true);
        spawnRewardCelebration(target.x, target.y);
        setScore(prev => prev + 100 + streak * 25);
        setStreak(prev => prev + 1);
        setLastAnswer({
          correct: true,
          explanation: question.explanation,
        });

        setTimeout(() => {
          setShowReward(false);
          setGameState('showing-result');
        }, 1500);
      } else {
        // WRONG ANSWER - alien attack!
        setShowAlienAttack(true);
        spawnAlienAttackEffect();
        spawnParticles(target.x, target.y, 15, '#EF4444');
        setStreak(0);
        setLives(prev => Math.max(0, prev - 1));
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
  }, [gameState, targetedAnswer, answerTargets, shipPosition, currentQuestion, streak, spawnRewardCelebration, spawnAlienAttackEffect, spawnParticles]);

  // Handle click/tap to fire
  const handleFire = useCallback(() => {
    if (gameState === 'playing') {
      fireLaser();
    }
  }, [gameState, fireLaser]);

  // Handle touch end - only fire if this was a tap (no significant movement)
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
      setParticles(prev =>
        prev
          .map(p => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.15,
            life: p.life - 0.025,
          }))
          .filter(p => p.life > 0)
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
    } else if (currentQuestion + 1 >= QUESTIONS.length) {
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
    setAlienAttacks([]);
    setLastAnswer(null);
    setShowReward(false);
    setShowAlienAttack(false);
    setupQuestion(0);
  }, [setupQuestion]);

  const currentQuestionData = QUESTIONS[currentQuestion];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden font-sans text-white">
      {/* Background Effects */}
      <div className="fixed inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950" />
      <div className="fixed top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none" />
      <div className="fixed bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-pink-accent/5 blur-[120px] pointer-events-none" />

      {/* Stars */}
      <div className="fixed inset-0 pointer-events-none">
        {[...Array(80)].map((_, i) => (
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
        className="relative w-full h-screen overflow-hidden cursor-crosshair"
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleFire}
      >
        {/* HUD - positioned at bottom corners */}
        {gameState !== 'intro' && (
          <div className="absolute bottom-20 left-4 right-4 flex justify-between items-end z-20 pointer-events-none">
            <div className="flex flex-col gap-2">
              <div className="glass-subtle px-4 py-2 rounded-xl border border-cyan-500/30">
                <span className="text-cyan-neon font-bold text-lg">
                  Score: {score}
                </span>
              </div>
              {streak > 0 && (
                <motion.div
                  className="glass-subtle px-3 py-1 rounded-lg border border-yellow-500/30"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                >
                  <span className="text-yellow-400 font-bold">
                    <FontAwesomeIcon icon={faBolt} className="mr-1" />
                    {streak}x Streak!
                  </span>
                </motion.div>
              )}
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="glass-subtle px-4 py-2 rounded-xl border border-slate-500/30">
                <span className="text-slate-300">
                  Q{currentQuestion + 1}/{QUESTIONS.length}
                </span>
              </div>
              <div className="flex gap-1">
                {[...Array(3)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={i < lives ? {} : { scale: [1, 0], opacity: [1, 0] }}
                  >
                    <FontAwesomeIcon
                      icon={faHeart}
                      className={`text-2xl ${i < lives ? 'text-red-500' : 'text-slate-700'}`}
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
            className="absolute top-4 inset-x-0 z-30 flex justify-center px-4"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="glass-subtle p-4 rounded-xl border border-cyan-500/30 text-center max-w-2xl">
              <div className="text-xs text-cyan-400 mb-1 font-semibold uppercase tracking-wider">
                {currentQuestionData.category}
              </div>
              <p className="text-lg sm:text-xl font-bold text-white">
                {currentQuestionData.question}
              </p>
            </div>
          </motion.div>
        )}

        {/* Answer Targets */}
        {gameState === 'playing' && answerTargets.map(target => (
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
              className={`relative px-2 py-2 sm:px-4 sm:py-3 rounded-xl text-center max-w-[140px] sm:max-w-[200px] transition-all ${
                targetedAnswer === target.id
                  ? 'bg-cyan-500/40 border-2 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.5)]'
                  : 'glass-subtle border border-slate-600/50'
              }`}
            >
              {/* Target reticle when aimed */}
              {targetedAnswer === target.id && (
                <motion.div
                  className="absolute -top-2 -right-2 text-cyan-400"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                >
                  <FontAwesomeIcon icon={faCrosshairs} className="text-xl" />
                </motion.div>
              )}
              <span className="text-xs sm:text-sm font-medium leading-tight">{target.text}</span>
            </div>
          </motion.div>
        ))}

        {/* Aim Line */}
        {gameState === 'playing' && targetedAnswer !== null && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-5">
            {answerTargets.filter(t => t.id === targetedAnswer && !t.hit).map(target => (
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
          {lasers.map(laser => (
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

        {/* Alien Attacks */}
        <AnimatePresence>
          {alienAttacks.map(attack => (
            <motion.div
              key={attack.id}
              className="absolute text-4xl z-20"
              style={{ left: `${attack.x}%`, top: `${attack.y}%` }}
              initial={{ scale: 0, rotate: 0 }}
              animate={{
                x: `${(attack.targetX - attack.x) * 3}%`,
                y: `${(attack.targetY - attack.y) * 3}%`,
                scale: [0, 1.5, 1],
                rotate: [0, 180, 360],
              }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ duration: 1.2 }}
            >
              <FontAwesomeIcon icon={faSkull} className="text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Particles */}
        {particles.map(particle => (
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
                className="text-5xl text-cyan-400 -rotate-90 drop-shadow-[0_0_15px_rgba(34,211,238,0.6)]"
              />
              {/* Engine glow */}
              <motion.div
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-6 bg-gradient-to-b from-cyan-400 to-transparent rounded-full blur-sm"
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
                  className="text-5xl sm:text-8xl mb-2 sm:mb-4"
                  animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.5, repeat: 2 }}
                >
                  <FontAwesomeIcon icon={faCheck} className="text-green-400 drop-shadow-[0_0_30px_rgba(74,222,128,0.8)]" />
                </motion.div>
                <motion.p
                  className="text-2xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-400"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.3, repeat: 3 }}
                >
                  CORRECT!
                </motion.p>
                <motion.p
                  className="text-lg sm:text-2xl text-yellow-400 mt-1 sm:mt-2"
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
                    className="text-5xl sm:text-8xl mb-2 sm:mb-4"
                    animate={{ x: [-5, 5, -5, 5, 0] }}
                    transition={{ duration: 0.4, repeat: 2 }}
                  >
                    <FontAwesomeIcon icon={faSkull} className="text-red-500 drop-shadow-[0_0_30px_rgba(239,68,68,0.8)]" />
                  </motion.div>
                  <motion.p
                    className="text-2xl sm:text-4xl font-black text-red-500"
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
              className="absolute inset-0 flex items-center justify-center z-30 bg-background/80 backdrop-blur-sm px-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className={`glass-subtle p-6 sm:p-8 rounded-2xl border max-w-md w-full text-center ${
                  lastAnswer.correct ? 'border-green-500/50' : 'border-red-500/50'
                }`}
                initial={{ scale: 0.8, y: 20 }}
                animate={{ scale: 1, y: 0 }}
              >
                <div className={`text-6xl mb-4 ${lastAnswer.correct ? 'text-green-400' : 'text-red-400'}`}>
                  <FontAwesomeIcon icon={lastAnswer.correct ? faTrophy : faSkull} />
                </div>

                <h2 className={`text-2xl font-bold mb-4 ${lastAnswer.correct ? 'text-green-400' : 'text-red-400'}`}>
                  {lastAnswer.correct ? 'Great Job!' : 'Not Quite!'}
                </h2>

                <p className="text-slate-300 mb-6">
                  {lastAnswer.explanation}
                </p>

                <button
                  onClick={proceedToNext}
                  className={`w-full py-4 text-xl rounded-xl font-bold transition-all flex items-center justify-center gap-3 ${
                    lastAnswer.correct
                      ? 'bg-gradient-to-r from-green-500 to-cyan-500 hover:from-green-400 hover:to-cyan-400'
                      : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400'
                  } text-white`}
                >
                  {lives <= 0 ? 'See Results' : currentQuestion + 1 >= QUESTIONS.length ? 'See Results' : 'Next Question'}
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
              className="absolute inset-0 flex items-center justify-center z-30 bg-background/90 backdrop-blur-md px-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="glass-subtle p-8 rounded-2xl border border-cyan-500/30 max-w-md w-full text-center"
                initial={{ scale: 0.8, y: 20 }}
                animate={{ scale: 1, y: 0 }}
              >
                <motion.div
                  className="text-7xl mb-4"
                  animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  {lives > 0 ? '🎉' : '💫'}
                </motion.div>

                <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-accent mb-2">
                  {lives > 0 ? 'Mission Complete!' : 'Mission Over'}
                </h2>

                <p className="text-slate-400 mb-6">
                  {lives > 0
                    ? "You've defended the future of AI!"
                    : "Keep learning about AI ethics!"}
                </p>

                <div className="glass-subtle p-4 rounded-xl mb-6">
                  <div className="flex justify-center gap-8">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-cyan-neon">{score}</div>
                      <div className="text-sm text-slate-400">Final Score</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-400">
                        {QUESTIONS.filter((_, i) => i <= currentQuestion).length - (3 - lives)}/{QUESTIONS.length}
                      </div>
                      <div className="text-sm text-slate-400">Correct</div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={resetGame}
                    className="w-full py-4 text-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 rounded-xl font-bold transition-all flex items-center justify-center gap-3 text-white"
                  >
                    <FontAwesomeIcon icon={faRocket} />
                    Play Again
                  </button>
                  <Link
                    to="/play/side-quests"
                    className="w-full py-3 glass-subtle border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                  >
                    <FontAwesomeIcon icon={faArrowLeft} />
                    Back to Side Quests
                  </Link>
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
              {/* Animated starfield background */}
              <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950">
                {[...Array(50)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-1 h-1 bg-white rounded-full"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 100}%`,
                    }}
                    animate={{
                      opacity: [0.2, 1, 0.2],
                      scale: [0.5, 1.5, 0.5],
                    }}
                    transition={{
                      duration: 2 + Math.random() * 3,
                      repeat: Infinity,
                      delay: Math.random() * 2,
                    }}
                  />
                ))}
              </div>

              {/* Floating threat icons in background - hidden on small mobile */}
              {['🤖', '⚠️', '🔒', '🌍', '🎯', '💡'].map((emoji, i) => (
                <motion.div
                  key={emoji}
                  className="absolute text-3xl sm:text-4xl opacity-20 hidden sm:block"
                  style={{
                    left: `${15 + i * 15}%`,
                    top: `${20 + (i % 3) * 25}%`,
                  }}
                  animate={{
                    y: [0, -20, 0],
                    rotate: [0, 10, -10, 0],
                  }}
                  transition={{
                    duration: 4 + i * 0.5,
                    repeat: Infinity,
                    delay: i * 0.3,
                  }}
                >
                  {emoji}
                </motion.div>
              ))}

              {/* Main content */}
              <div className="relative z-10 text-center px-4">
                {/* Animated title with letter-by-letter reveal */}
                <motion.div
                  className="mb-4 sm:mb-6"
                  initial={{ y: -50 }}
                  animate={{ y: 0 }}
                  transition={{ type: 'spring', bounce: 0.5 }}
                >
                  <motion.h1
                    className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight"
                    animate={{
                      textShadow: [
                        '0 0 20px rgba(6, 182, 212, 0.5)',
                        '0 0 40px rgba(6, 182, 212, 0.8)',
                        '0 0 20px rgba(6, 182, 212, 0.5)',
                      ],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-pink-500">
                      ETHICS
                    </span>
                    <br />
                    <motion.span
                      className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400"
                      animate={{ opacity: [0.8, 1, 0.8] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      DEFENDER
                    </motion.span>
                  </motion.h1>
                </motion.div>

                {/* Subtitle with typewriter feel */}
                <motion.p
                  className="text-lg sm:text-xl md:text-2xl text-cyan-300 mb-6 sm:mb-8 font-medium"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  Shoot the correct answer!
                </motion.p>

                {/* Animated ship icon */}
                <motion.div
                  className="text-5xl sm:text-6xl mb-6 sm:mb-8"
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

                {/* Controls hint with animated icons */}
                <motion.div
                  className="flex items-center justify-center gap-3 sm:gap-6 mb-8 sm:mb-10 text-slate-400"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                >
                  <motion.span
                    className="flex items-center gap-1 sm:gap-2"
                    animate={{ x: [-2, 2, -2] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <span className="text-xl sm:text-2xl">👆</span>
                    <span className="text-sm sm:text-lg">Aim</span>
                  </motion.span>
                  <motion.span
                    className="flex items-center gap-1 sm:gap-2"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  >
                    <span className="text-xl sm:text-2xl">🖱️</span>
                    <span className="text-sm sm:text-lg">Tap to Fire</span>
                  </motion.span>
                </motion.div>

                {/* Pulsing start button */}
                <motion.button
                  onClick={() => setupQuestion(0)}
                  className="relative px-8 py-4 sm:px-12 sm:py-5 text-xl sm:text-2xl font-bold rounded-2xl overflow-hidden group"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1, type: 'spring' }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {/* Button glow effect */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-500 opacity-80"
                    animate={{
                      backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                    }}
                    transition={{ duration: 3, repeat: Infinity }}
                    style={{ backgroundSize: '200% 200%' }}
                  />
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-500"
                    animate={{ opacity: [0.5, 0.8, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  {/* Button border glow */}
                  <motion.div
                    className="absolute inset-0 rounded-2xl border-2 border-cyan-300"
                    animate={{
                      boxShadow: [
                        '0 0 20px rgba(6, 182, 212, 0.4)',
                        '0 0 40px rgba(6, 182, 212, 0.8)',
                        '0 0 20px rgba(6, 182, 212, 0.4)',
                      ],
                    }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <span className="relative z-10 flex items-center gap-3 text-white">
                    <motion.span
                      animate={{ x: [0, 5, 0] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    >
                      <FontAwesomeIcon icon={faRocket} />
                    </motion.span>
                    START MISSION
                  </span>
                </motion.button>

                {/* Back link */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.2 }}
                >
                  <Link
                    to="/play/side-quests"
                    className="inline-flex items-center gap-2 mt-6 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <FontAwesomeIcon icon={faArrowLeft} />
                    <span>Back to Side Quests</span>
                  </Link>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Instructions */}
        {gameState === 'playing' && (
          <motion.div
            className="absolute bottom-6 left-0 right-0 flex justify-center z-20 px-2 sm:px-4 pointer-events-none"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="glass-subtle px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl border border-cyan-500/20 text-center">
              <p className="text-cyan-neon text-xs sm:text-sm">
                <span className="sm:hidden">Tap to aim & fire!</span>
                <span className="hidden sm:inline">Move to aim at answers • Click or press SPACE to fire!</span>
              </p>
            </div>
          </motion.div>
        )}

      </div>

      {/* Back button - placed outside game container to prevent click interference */}
      <Link
        to="/play/side-quests"
        className="fixed top-4 right-4 z-50 glass-subtle px-3 py-2 rounded-xl border border-slate-700 hover:border-cyan-500/30 transition-all flex items-center gap-2 text-slate-400 hover:text-white text-sm"
      >
        <FontAwesomeIcon icon={faArrowLeft} />
        <span className="hidden sm:inline">Exit</span>
      </Link>
    </div>
  );
}
