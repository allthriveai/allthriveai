import { useState, useEffect, useCallback, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowUp,
  faArrowDown,
  faArrowLeft,
  faArrowRight,
} from '@fortawesome/free-solid-svg-icons';

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

  return (
    <div className="flex flex-col items-center gap-3">
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

        {/* Ready overlay */}
        {gameState === 'ready' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-sm">
            <p className="text-slate-400 text-sm mb-4">
              Tap to start or press Space
            </p>
            <button
              onClick={startGame}
              className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 rounded-lg text-white font-semibold text-sm hover:from-cyan-400 hover:to-teal-400 transition-all"
            >
              Play
            </button>
          </div>
        )}

        {/* Game over overlay */}
        {gameState === 'ended' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-sm">
            <p className="text-slate-400 text-sm mb-1">Context full!</p>
            <div className="text-center mb-3">
              <span className="text-cyan-400 font-mono text-2xl font-bold">{tokenCount}</span>
              <span className="text-slate-500 text-sm ml-1">tokens</span>
            </div>
          </div>
        )}
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
