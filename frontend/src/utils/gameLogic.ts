/**
 * Game Logic Utilities
 *
 * Pure functions for game mechanics that can be unit tested.
 * Used by ContextSnakeCore, EthicsDefenderCore, and other games.
 */

// Types
export interface Position {
  x: number;
  y: number;
}

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

// Score tier thresholds
export const SCORE_TIERS = {
  LOW: 10,
  MEDIUM: 30,
  HIGH: 50,
} as const;

/**
 * Calculate new head position based on direction
 */
export function calculateNewHead(head: Position, direction: Direction): Position {
  switch (direction) {
    case 'UP':
      return { x: head.x, y: head.y - 1 };
    case 'DOWN':
      return { x: head.x, y: head.y + 1 };
    case 'LEFT':
      return { x: head.x - 1, y: head.y };
    case 'RIGHT':
      return { x: head.x + 1, y: head.y };
  }
}

/**
 * Check if position is out of bounds
 */
export function isOutOfBounds(position: Position, gridSize: number): boolean {
  return (
    position.x < 0 ||
    position.x >= gridSize ||
    position.y < 0 ||
    position.y >= gridSize
  );
}

/**
 * Check if head collides with body
 */
export function collidesWithBody(head: Position, body: Position[]): boolean {
  // Skip first position (that's the head itself in a moving snake)
  for (let i = 1; i < body.length; i++) {
    if (body[i].x === head.x && body[i].y === head.y) {
      return true;
    }
  }
  return false;
}

/**
 * Check for any collision (wall or self)
 */
export function checkCollision(
  head: Position,
  body: Position[],
  gridSize: number
): boolean {
  return isOutOfBounds(head, gridSize) || collidesWithBody(head, body);
}

/**
 * Check if snake head is eating the token
 */
export function isEating(head: Position, token: Position): boolean {
  return head.x === token.x && head.y === token.y;
}

/**
 * Get all empty positions on the grid (not occupied by snake)
 */
export function getEmptyPositions(snake: Position[], gridSize: number): Position[] {
  const occupied = new Set(snake.map((p) => `${p.x},${p.y}`));
  const empty: Position[] = [];

  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      if (!occupied.has(`${x},${y}`)) {
        empty.push({ x, y });
      }
    }
  }

  return empty;
}

/**
 * Calculate score tier based on score
 */
export function getScoreTier(score: number): 'low' | 'medium' | 'high' | 'excellent' {
  if (score < SCORE_TIERS.LOW) return 'low';
  if (score < SCORE_TIERS.MEDIUM) return 'medium';
  if (score < SCORE_TIERS.HIGH) return 'high';
  return 'excellent';
}

/**
 * Get opposite direction (to prevent 180-degree turns)
 */
export function getOppositeDirection(direction: Direction): Direction {
  const opposites: Record<Direction, Direction> = {
    UP: 'DOWN',
    DOWN: 'UP',
    LEFT: 'RIGHT',
    RIGHT: 'LEFT',
  };
  return opposites[direction];
}

/**
 * Check if new direction is valid (not opposite of current)
 */
export function isValidDirectionChange(
  current: Direction,
  newDirection: Direction
): boolean {
  return newDirection !== getOppositeDirection(current);
}

/**
 * Calculate game speed based on score (higher score = faster)
 */
export function calculateGameSpeed(
  score: number,
  baseSpeed: number,
  minSpeed: number = 80
): number {
  // Increase speed every 5 points
  const speedBoost = Math.floor(score / 5) * 10;
  return Math.max(minSpeed, baseSpeed - speedBoost);
}

/**
 * Calculate points earned based on score and difficulty
 */
export function calculatePointsEarned(
  score: number,
  basePoints: number = 10,
  multiplier: number = 1
): number {
  const tier = getScoreTier(score);
  const tierMultipliers = {
    low: 1,
    medium: 1.5,
    high: 2,
    excellent: 3,
  };
  return Math.floor(basePoints * score * tierMultipliers[tier] * multiplier);
}

/**
 * Ethics Defender specific: Check if answer is correct
 */
export function checkEthicsAnswer(
  selectedIndex: number,
  correctIndex: number
): boolean {
  return selectedIndex === correctIndex;
}

/**
 * Ethics Defender specific: Calculate score for correct answer
 */
export function calculateEthicsScore(
  currentScore: number,
  isCorrect: boolean,
  timeBonus: number = 0
): number {
  if (!isCorrect) return currentScore;
  return currentScore + 10 + timeBonus;
}

/**
 * Calculate streak bonus
 */
export function calculateStreakBonus(streak: number): number {
  if (streak < 3) return 0;
  if (streak < 5) return 5;
  if (streak < 10) return 10;
  return 20;
}

/**
 * Trivia: Shuffle array (Fisher-Yates)
 */
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
