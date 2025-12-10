import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRocket, faHome, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { Link } from 'react-router-dom';

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
}

interface Laser {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
}

interface DigitPiece {
  id: number;
  char: string;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  destroyed: boolean;
}

const COLORS = ['#0EA5E9', '#22D3EE', '#4ADEE7', '#FB37FF', '#A855F7'];
const GAME_TIME_LIMIT = 600; // 60 seconds in deciseconds

export default function NotFoundPage() {
  const [shipPosition, setShipPosition] = useState({ x: 50, y: 80 });
  const [lasers, setLasers] = useState<Laser[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [digits, setDigits] = useState<DigitPiece[]>([]);
  const [gameWon, setGameWon] = useState(false);
  const [score, setScore] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [finalTime, setFinalTime] = useState(0);
  const [timeBonus, setTimeBonus] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const laserIdRef = useRef(0);
  const particleIdRef = useRef(0);
  const scoreRef = useRef(0); // Use ref for accurate score tracking
  const processedHitsRef = useRef<Set<number>>(new Set()); // Track which hits have been processed
  const startTimeRef = useRef<number>(Date.now());

  // Initialize the 404 digits
  useEffect(() => {
    const initialDigits: DigitPiece[] = [
      { id: 1, char: '4', x: 25, y: 30, health: 100, maxHealth: 100, destroyed: false },
      { id: 2, char: '0', x: 50, y: 30, health: 100, maxHealth: 100, destroyed: false },
      { id: 3, char: '4', x: 75, y: 30, health: 100, maxHealth: 100, destroyed: false },
    ];
    setDigits(initialDigits);
  }, []);

  // Timer effect - count elapsed time
  useEffect(() => {
    if (gameWon) return;
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 100)); // Deciseconds
    }, 100);
    return () => clearInterval(interval);
  }, [gameWon]);

  // Check if all digits are destroyed
  useEffect(() => {
    if (digits.length > 0 && digits.every(d => d.destroyed)) {
      const endTime = Math.floor((Date.now() - startTimeRef.current) / 100);
      const remainingTime = Math.max(0, GAME_TIME_LIMIT - endTime);
      setFinalTime(remainingTime);
      // Calculate time bonus: more time remaining = higher bonus (up to 500 points)
      const bonus = Math.floor(remainingTime * 500 / GAME_TIME_LIMIT);
      setTimeBonus(bonus);
      setGameWon(true);
    }
  }, [digits]);

  // Handle mouse/touch movement for ship
  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    setShipPosition({ x: Math.max(5, Math.min(95, x)), y: Math.max(50, Math.min(95, y)) });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    handleMove(e.clientX, e.clientY);
  }, [handleMove]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault(); // Prevent page scrolling while playing
    if (e.touches.length > 0) {
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, [handleMove]);

  // Spawn explosion particles
  const spawnExplosion = useCallback((x: number, y: number, count: number = 15) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 2 + Math.random() * 4;
      newParticles.push({
        id: particleIdRef.current++,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        life: 1,
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
  }, []);

  // Fire laser
  const fireLaser = useCallback(() => {
    if (gameWon) return;

    // Find nearest non-destroyed digit
    const activeDigits = digits.filter(d => !d.destroyed);
    if (activeDigits.length === 0) return;

    const nearest = activeDigits.reduce((closest, digit) => {
      const distCurrent = Math.hypot(digit.x - shipPosition.x, digit.y - shipPosition.y);
      const distClosest = Math.hypot(closest.x - shipPosition.x, closest.y - shipPosition.y);
      return distCurrent < distClosest ? digit : closest;
    });

    // Generate unique hit ID
    const hitId = laserIdRef.current++;

    const newLaser: Laser = {
      id: hitId,
      x: shipPosition.x,
      y: shipPosition.y - 3,
      targetX: nearest.x,
      targetY: nearest.y,
    };
    setLasers(prev => [...prev, newLaser]);

    // Hit detection after animation
    setTimeout(() => {
      // Check if this hit was already processed (prevents double-scoring from StrictMode)
      if (processedHitsRef.current.has(hitId)) {
        setLasers(prev => prev.filter(l => l.id !== hitId));
        return;
      }
      processedHitsRef.current.add(hitId);

      setDigits(prev => prev.map(d => {
        if (d.id === nearest.id && !d.destroyed) {
          const newHealth = d.health - 25;
          if (newHealth <= 0) {
            spawnExplosion(d.x, d.y, 30);
            scoreRef.current += 100;
            setScore(scoreRef.current);
            return { ...d, health: 0, destroyed: true };
          }
          spawnExplosion(d.x, d.y, 8);
          scoreRef.current += 10;
          setScore(scoreRef.current);
          return { ...d, health: newHealth };
        }
        return d;
      }));
      setLasers(prev => prev.filter(l => l.id !== hitId));
    }, 200);
  }, [shipPosition, digits, gameWon, spawnExplosion]);

  // Handle click/tap to fire
  const handleFire = useCallback(() => {
    fireLaser();
  }, [fireLaser]);

  // Handle touch start - move ship and fire, prevent scrolling
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault(); // Prevent page scrolling
    if (e.touches.length > 0) {
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }
    fireLaser();
  }, [handleMove, fireLaser]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        fireLaser();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fireLaser]);

  // Auto-fire interval
  useEffect(() => {
    if (gameWon) return;
    const interval = setInterval(fireLaser, 400);
    return () => clearInterval(interval);
  }, [fireLaser, gameWon]);

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
            vy: p.vy + 0.1, // gravity
            life: p.life - 0.02,
          }))
          .filter(p => p.life > 0)
      );
    }, 16);
    return () => clearInterval(interval);
  }, [particles.length]);

  // Reset game
  const resetGame = useCallback(() => {
    setDigits([
      { id: 1, char: '4', x: 25, y: 30, health: 100, maxHealth: 100, destroyed: false },
      { id: 2, char: '0', x: 50, y: 30, health: 100, maxHealth: 100, destroyed: false },
      { id: 3, char: '4', x: 75, y: 30, health: 100, maxHealth: 100, destroyed: false },
    ]);
    setGameWon(false);
    scoreRef.current = 0;
    setScore(0);
    setElapsedTime(0);
    setFinalTime(0);
    setTimeBonus(0);
    startTimeRef.current = Date.now();
    setParticles([]);
    setLasers([]);
    processedHitsRef.current.clear();
    laserIdRef.current = 0;
  }, []);

  // Prevent body scroll on mobile when this page is mounted
  useEffect(() => {
    // Save original styles
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalHeight = document.body.style.height;
    const originalWidth = document.body.style.width;
    const htmlOverflow = document.documentElement.style.overflow;

    // Lock body scroll
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.height = '100%';
    document.body.style.width = '100%';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      // Restore original styles
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.height = originalHeight;
      document.body.style.width = originalWidth;
      document.documentElement.style.overflow = htmlOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-background overflow-hidden font-sans text-white">
      {/* Ambient Background Effects */}
      <div className="fixed inset-0 bg-grid-pattern opacity-20 pointer-events-none" />
      <div className="fixed top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none" />
      <div className="fixed bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-pink-accent/5 blur-[120px] pointer-events-none" />

      {/* Stars background - static, no animation */}
      <div className="fixed inset-0 pointer-events-none">
        {[...Array(60)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: `${(i * 17) % 100}%`,
              top: `${(i * 23) % 100}%`,
              width: i % 3 === 0 ? 2 : 1,
              height: i % 3 === 0 ? 2 : 1,
              opacity: 0.3 + (i % 5) * 0.1,
            }}
          />
        ))}
      </div>

      {/* Game Container */}
      <div
        ref={containerRef}
        className="absolute inset-0 cursor-crosshair select-none touch-none"
        onMouseMove={handleMouseMove}
        onTouchMove={handleTouchMove}
        onClick={handleFire}
        onTouchStart={handleTouchStart}
      >
        {/* Logo, Score & Timer Display */}
        <div className="absolute top-4 left-4 md:top-6 md:left-6 z-20 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
          {/* AllThrive Logo - Hidden on mobile, shown in top pill instead */}
          <Link to="/" className="hidden sm:flex items-center gap-2 mr-2">
            <img
              src="/all-thrvie-logo.png"
              alt="AllThrive"
              className="h-8 w-auto"
            />
          </Link>
          <div className="glass-subtle px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl border border-cyan-500/20">
            <span className="text-cyan-neon font-mono text-sm sm:text-lg">SCORE: {score}</span>
          </div>
          <div className="glass-subtle px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl border border-pink-accent/20">
            <span className="text-pink-accent font-mono text-sm sm:text-lg">
              TIME: {(Math.max(0, GAME_TIME_LIMIT - elapsedTime) / 10).toFixed(1)}s
            </span>
          </div>
        </div>

        {/* Instructions - hidden on mobile to avoid overlap */}
        <motion.div
          className="absolute top-4 right-4 md:top-6 md:right-6 z-20 text-right hidden sm:block"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="glass-subtle px-3 py-2 md:px-4 rounded-xl border border-cyan-500/20">
            <p className="text-slate-400 text-xs md:text-sm">Move mouse to aim</p>
            <p className="text-cyan-neon text-xs md:text-sm">Click/Tap to fire faster!</p>
          </div>
        </motion.div>

        {/* 404 Digits */}
        <div className="absolute inset-0 flex items-start justify-center pt-[20%] sm:pt-[15%]">
          <AnimatePresence>
            {digits.map((digit) => (
              <motion.div
                key={digit.id}
                className="relative mx-1 sm:mx-4"
                style={{
                  left: `${digit.x - 50}%`,
                }}
                initial={{ scale: 1, opacity: 1 }}
                animate={digit.destroyed ? {
                  scale: [1, 1.5, 0],
                  opacity: [1, 0.5, 0],
                  rotate: [0, Math.random() * 360 - 180],
                  y: [0, -50, 100],
                } : {
                  scale: 1,
                  opacity: 1,
                }}
                exit={{ scale: 0, opacity: 0 }}
                transition={digit.destroyed ? { duration: 0.5 } : {}}
              >
                {/* Health bar */}
                {!digit.destroyed && (
                  <div className="absolute -top-6 sm:-top-8 left-1/2 -translate-x-1/2 w-16 sm:w-24 h-1.5 sm:h-2 bg-slate-800/50 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-cyan-500 to-pink-accent"
                      initial={{ width: '100%' }}
                      animate={{ width: `${digit.health}%` }}
                      transition={{ duration: 0.2 }}
                    />
                  </div>
                )}

                {/* Digit character */}
                <motion.span
                  className={`text-[80px] sm:text-[120px] md:text-[180px] font-black select-none ${
                    digit.destroyed
                      ? 'text-transparent'
                      : 'text-transparent bg-clip-text bg-gradient-to-b from-cyan-400 via-cyan-500 to-pink-accent'
                  }`}
                  style={{
                    textShadow: digit.destroyed
                      ? 'none'
                      : '0 0 40px rgba(14, 165, 233, 0.5), 0 0 80px rgba(14, 165, 233, 0.3)',
                    filter: digit.destroyed ? 'none' : `brightness(${0.5 + digit.health / 200})`,
                  }}
                  animate={!digit.destroyed ? {
                    scale: [1, 1.02, 1],
                  } : {}}
                  transition={{
                    duration: 0.1,
                    repeat: digit.health < 50 ? Infinity : 0,
                  }}
                >
                  {digit.char}
                </motion.span>

                {/* Damage cracks effect */}
                {!digit.destroyed && digit.health < 75 && (
                  <div className="absolute inset-0 pointer-events-none">
                    {[...Array(Math.floor((100 - digit.health) / 20))].map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute bg-pink-accent/30"
                        style={{
                          width: 2,
                          height: 20 + Math.random() * 30,
                          left: `${20 + Math.random() * 60}%`,
                          top: `${20 + Math.random() * 60}%`,
                          transform: `rotate(${Math.random() * 180}deg)`,
                        }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.8 }}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Lasers */}
        <AnimatePresence>
          {lasers.map((laser) => (
            <motion.div
              key={laser.id}
              className="absolute w-1 bg-gradient-to-t from-cyan-400 to-pink-accent rounded-full pointer-events-none"
              style={{
                left: `${laser.x}%`,
                top: `${laser.y}%`,
                height: 40,
                boxShadow: '0 0 10px #0EA5E9, 0 0 20px #0EA5E9, 0 0 30px #FB37FF',
              }}
              initial={{
                y: 0,
                opacity: 1,
                scaleY: 0.5,
              }}
              animate={{
                y: `${(laser.targetY - laser.y) * 3}vh`,
                opacity: [1, 1, 0],
                scaleY: [0.5, 1.5, 0.5],
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'linear' }}
            />
          ))}
        </AnimatePresence>

        {/* Particles */}
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: particle.size,
              height: particle.size,
              backgroundColor: particle.color,
              boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`,
              opacity: particle.life,
            }}
          />
        ))}

        {/* Spaceship */}
        <motion.div
          className="absolute pointer-events-none z-10"
          style={{
            left: `${shipPosition.x}%`,
            top: `${shipPosition.y}%`,
            transform: 'translate(-50%, -50%)',
          }}
          animate={{
            y: [0, -3, 0],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          {/* Ship glow */}
          <div
            className="absolute inset-0 blur-xl opacity-50"
            style={{
              background: 'radial-gradient(circle, #0EA5E9 0%, transparent 70%)',
              width: 80,
              height: 80,
              transform: 'translate(-50%, -50%)',
            }}
          />

          {/* Ship icon */}
          <motion.div
            animate={{ rotate: 0 }}
            className="relative"
          >
            <FontAwesomeIcon
              icon={faRocket}
              className="text-3xl sm:text-4xl md:text-5xl text-cyan-400 drop-shadow-[0_0_15px_rgba(14,165,233,0.8)]"
              style={{ transform: 'rotate(-45deg)' }}
            />

            {/* Engine flame */}
            <motion.div
              className="absolute w-3 h-6 rounded-full"
              style={{
                background: 'linear-gradient(to bottom, #FB37FF, #0EA5E9, transparent)',
                transform: 'rotate(-45deg)',
                bottom: '-8px',
                left: 'calc(50% - 6px)',
              }}
              animate={{
                scaleY: [0.8, 1.2, 0.8],
                opacity: [0.6, 1, 0.6],
              }}
              transition={{
                duration: 0.15,
                repeat: Infinity,
              }}
            />
          </motion.div>
        </motion.div>

        {/* Victory Screen */}
        <AnimatePresence>
          {gameWon && (
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-background/80 backdrop-blur-sm px-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="text-center w-full max-w-md"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
              >
                {/* AllThrive Logo on Victory */}
                <motion.div
                  className="flex justify-center mb-4 sm:mb-6"
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <Link to="/" className="flex items-center gap-2">
                    <img
                      src="/all-thrvie-logo.png"
                      alt="AllThrive"
                      className="h-10 sm:h-12 w-auto"
                    />
                  </Link>
                </motion.div>

                <motion.h2
                  className="text-3xl sm:text-5xl md:text-7xl font-black mb-3 sm:mb-4 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-accent"
                  animate={{
                    textShadow: [
                      '0 0 20px rgba(14, 165, 233, 0.5)',
                      '0 0 40px rgba(251, 55, 255, 0.5)',
                      '0 0 20px rgba(14, 165, 233, 0.5)',
                    ],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  404 DESTROYED!
                </motion.h2>

                <div className="mb-4 sm:mb-6 space-y-0.5 sm:space-y-1">
                  <p className="text-slate-400 text-sm sm:text-base">Time Remaining: {(finalTime / 10).toFixed(1)}s</p>
                  <p className="text-slate-400 text-sm sm:text-base">Hit Score: {score}</p>
                  <p className="text-slate-400 text-sm sm:text-base">Time Bonus: +{timeBonus}</p>
                  <p className="text-2xl sm:text-3xl text-cyan-neon font-bold mt-2">
                    Final Score: {score + timeBonus}
                  </p>
                </div>
                <p className="text-slate-400 text-sm sm:text-base mb-6 sm:mb-8">The error has been vaporized!</p>

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                  <Link
                    to="/"
                    className="inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white font-semibold rounded-xl transition-all shadow-neon hover:shadow-neon-lg text-sm sm:text-base"
                  >
                    <FontAwesomeIcon icon={faHome} />
                    Go Home
                  </Link>

                  <button
                    onClick={resetGame}
                    className="inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 glass-subtle border border-cyan-500/30 hover:border-cyan-500/50 text-cyan-neon font-semibold rounded-xl transition-all text-sm sm:text-base"
                  >
                    <FontAwesomeIcon icon={faRocket} />
                    Play Again
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Page Not Found Pill - centered at top, mobile-friendly */}
        {!gameWon && (
          <motion.div
            className="absolute top-20 sm:top-6 left-0 right-0 flex justify-center z-20 px-4"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="glass-subtle px-3 py-2 sm:px-5 sm:py-2.5 rounded-xl border border-pink-accent/30 flex flex-col sm:flex-row items-center gap-2 sm:gap-3 max-w-full">
              {/* Mobile: Show logo inline */}
              <Link to="/" className="flex sm:hidden items-center gap-2">
                <img
                  src="/all-thrvie-logo.png"
                  alt="AllThrive"
                  className="h-6 w-auto"
                />
              </Link>
              <span className="text-white font-semibold text-sm sm:text-base text-center">Lost in the cosmos</span>
              <span className="text-slate-400 text-xs sm:text-sm hidden sm:inline">Fight your way back &amp; destroy the 404!</span>
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-neon text-xs sm:text-sm font-medium rounded-lg transition-all"
              >
                <FontAwesomeIcon icon={faArrowLeft} className="text-xs" />
                Home
              </Link>
            </div>
          </motion.div>
        )}

        {/* Mobile touch hint - only visible on small screens */}
        {!gameWon && (
          <motion.div
            className="absolute bottom-6 left-0 right-0 flex justify-center z-20 px-4 sm:hidden"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <div className="glass-subtle px-3 py-2 rounded-xl border border-cyan-500/20 text-center">
              <p className="text-cyan-neon text-xs">Drag to move &bull; Tap to fire faster!</p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
