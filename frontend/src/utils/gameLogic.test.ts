/**
 * Game Logic Unit Tests
 *
 * Tests for pure game logic functions used across games.
 * Ensures scoring, collision detection, and game mechanics work correctly.
 *
 * RUN: npm test -- gameLogic.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  calculateNewHead,
  isOutOfBounds,
  collidesWithBody,
  checkCollision,
  isEating,
  getEmptyPositions,
  getScoreTier,
  getOppositeDirection,
  isValidDirectionChange,
  calculateGameSpeed,
  calculatePointsEarned,
  checkEthicsAnswer,
  calculateEthicsScore,
  calculateStreakBonus,
  shuffleArray,
  SCORE_TIERS,
  type Position,
} from './gameLogic';

describe('Game Logic - Snake Movement', () => {
  describe('calculateNewHead', () => {
    const startHead: Position = { x: 5, y: 5 };

    it('moves up correctly', () => {
      const result = calculateNewHead(startHead, 'UP');
      expect(result).toEqual({ x: 5, y: 4 });
    });

    it('moves down correctly', () => {
      const result = calculateNewHead(startHead, 'DOWN');
      expect(result).toEqual({ x: 5, y: 6 });
    });

    it('moves left correctly', () => {
      const result = calculateNewHead(startHead, 'LEFT');
      expect(result).toEqual({ x: 4, y: 5 });
    });

    it('moves right correctly', () => {
      const result = calculateNewHead(startHead, 'RIGHT');
      expect(result).toEqual({ x: 6, y: 5 });
    });

    it('handles edge positions', () => {
      const edgeHead: Position = { x: 0, y: 0 };
      expect(calculateNewHead(edgeHead, 'UP')).toEqual({ x: 0, y: -1 });
      expect(calculateNewHead(edgeHead, 'LEFT')).toEqual({ x: -1, y: 0 });
    });
  });

  describe('getOppositeDirection', () => {
    it('returns opposite directions correctly', () => {
      expect(getOppositeDirection('UP')).toBe('DOWN');
      expect(getOppositeDirection('DOWN')).toBe('UP');
      expect(getOppositeDirection('LEFT')).toBe('RIGHT');
      expect(getOppositeDirection('RIGHT')).toBe('LEFT');
    });
  });

  describe('isValidDirectionChange', () => {
    it('allows perpendicular direction changes', () => {
      expect(isValidDirectionChange('UP', 'LEFT')).toBe(true);
      expect(isValidDirectionChange('UP', 'RIGHT')).toBe(true);
      expect(isValidDirectionChange('LEFT', 'UP')).toBe(true);
      expect(isValidDirectionChange('LEFT', 'DOWN')).toBe(true);
    });

    it('prevents 180-degree turns', () => {
      expect(isValidDirectionChange('UP', 'DOWN')).toBe(false);
      expect(isValidDirectionChange('DOWN', 'UP')).toBe(false);
      expect(isValidDirectionChange('LEFT', 'RIGHT')).toBe(false);
      expect(isValidDirectionChange('RIGHT', 'LEFT')).toBe(false);
    });

    it('allows same direction', () => {
      expect(isValidDirectionChange('UP', 'UP')).toBe(true);
      expect(isValidDirectionChange('DOWN', 'DOWN')).toBe(true);
    });
  });
});

describe('Game Logic - Collision Detection', () => {
  const GRID_SIZE = 15;

  describe('isOutOfBounds', () => {
    it('returns false for valid positions', () => {
      expect(isOutOfBounds({ x: 0, y: 0 }, GRID_SIZE)).toBe(false);
      expect(isOutOfBounds({ x: 7, y: 7 }, GRID_SIZE)).toBe(false);
      expect(isOutOfBounds({ x: 14, y: 14 }, GRID_SIZE)).toBe(false);
    });

    it('returns true for negative coordinates', () => {
      expect(isOutOfBounds({ x: -1, y: 5 }, GRID_SIZE)).toBe(true);
      expect(isOutOfBounds({ x: 5, y: -1 }, GRID_SIZE)).toBe(true);
      expect(isOutOfBounds({ x: -1, y: -1 }, GRID_SIZE)).toBe(true);
    });

    it('returns true for coordinates beyond grid', () => {
      expect(isOutOfBounds({ x: 15, y: 5 }, GRID_SIZE)).toBe(true);
      expect(isOutOfBounds({ x: 5, y: 15 }, GRID_SIZE)).toBe(true);
      expect(isOutOfBounds({ x: 100, y: 100 }, GRID_SIZE)).toBe(true);
    });
  });

  describe('collidesWithBody', () => {
    it('returns false when head does not collide', () => {
      const head: Position = { x: 5, y: 5 };
      const body: Position[] = [
        { x: 5, y: 5 }, // head position
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ];
      expect(collidesWithBody(head, body)).toBe(false);
    });

    it('returns true when head collides with body', () => {
      const head: Position = { x: 3, y: 5 };
      const body: Position[] = [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 }, // collision!
      ];
      expect(collidesWithBody(head, body)).toBe(true);
    });

    it('handles single-segment snake', () => {
      const head: Position = { x: 5, y: 5 };
      const body: Position[] = [{ x: 5, y: 5 }];
      expect(collidesWithBody(head, body)).toBe(false);
    });
  });

  describe('checkCollision', () => {
    it('returns true for wall collision', () => {
      const head: Position = { x: -1, y: 5 };
      const body: Position[] = [{ x: 0, y: 5 }];
      expect(checkCollision(head, body, GRID_SIZE)).toBe(true);
    });

    it('returns true for self collision', () => {
      const head: Position = { x: 3, y: 5 };
      const body: Position[] = [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ];
      expect(checkCollision(head, body, GRID_SIZE)).toBe(true);
    });

    it('returns false for valid move', () => {
      const head: Position = { x: 6, y: 5 };
      const body: Position[] = [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
      ];
      expect(checkCollision(head, body, GRID_SIZE)).toBe(false);
    });
  });
});

describe('Game Logic - Token/Food', () => {
  describe('isEating', () => {
    it('returns true when head is on token', () => {
      const head: Position = { x: 5, y: 5 };
      const token: Position = { x: 5, y: 5 };
      expect(isEating(head, token)).toBe(true);
    });

    it('returns false when head is not on token', () => {
      const head: Position = { x: 5, y: 5 };
      const token: Position = { x: 6, y: 5 };
      expect(isEating(head, token)).toBe(false);
    });
  });

  describe('getEmptyPositions', () => {
    it('returns all positions for empty grid', () => {
      const snake: Position[] = [];
      const empty = getEmptyPositions(snake, 3);
      expect(empty).toHaveLength(9); // 3x3 grid
    });

    it('excludes snake positions', () => {
      const snake: Position[] = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ];
      const empty = getEmptyPositions(snake, 3);
      expect(empty).toHaveLength(7); // 9 - 2 = 7
      expect(empty.find((p) => p.x === 0 && p.y === 0)).toBeUndefined();
      expect(empty.find((p) => p.x === 1 && p.y === 0)).toBeUndefined();
    });

    it('handles full grid', () => {
      // A 2x2 grid completely filled
      const snake: Position[] = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ];
      const empty = getEmptyPositions(snake, 2);
      expect(empty).toHaveLength(0);
    });
  });
});

describe('Game Logic - Scoring', () => {
  describe('SCORE_TIERS', () => {
    it('has correct thresholds', () => {
      expect(SCORE_TIERS.LOW).toBe(10);
      expect(SCORE_TIERS.MEDIUM).toBe(30);
      expect(SCORE_TIERS.HIGH).toBe(50);
    });
  });

  describe('getScoreTier', () => {
    it('returns low tier for scores below 10', () => {
      expect(getScoreTier(0)).toBe('low');
      expect(getScoreTier(5)).toBe('low');
      expect(getScoreTier(9)).toBe('low');
    });

    it('returns medium tier for scores 10-29', () => {
      expect(getScoreTier(10)).toBe('medium');
      expect(getScoreTier(20)).toBe('medium');
      expect(getScoreTier(29)).toBe('medium');
    });

    it('returns high tier for scores 30-49', () => {
      expect(getScoreTier(30)).toBe('high');
      expect(getScoreTier(40)).toBe('high');
      expect(getScoreTier(49)).toBe('high');
    });

    it('returns excellent tier for scores 50+', () => {
      expect(getScoreTier(50)).toBe('excellent');
      expect(getScoreTier(100)).toBe('excellent');
    });
  });

  describe('calculateGameSpeed', () => {
    const BASE_SPEED = 180;
    const MIN_SPEED = 80;

    it('returns base speed at score 0', () => {
      expect(calculateGameSpeed(0, BASE_SPEED, MIN_SPEED)).toBe(180);
    });

    it('increases speed as score increases', () => {
      const speed5 = calculateGameSpeed(5, BASE_SPEED, MIN_SPEED);
      const speed10 = calculateGameSpeed(10, BASE_SPEED, MIN_SPEED);
      expect(speed5).toBeLessThan(BASE_SPEED);
      expect(speed10).toBeLessThan(speed5);
    });

    it('does not go below minimum speed', () => {
      const speed = calculateGameSpeed(1000, BASE_SPEED, MIN_SPEED);
      expect(speed).toBe(MIN_SPEED);
    });
  });

  describe('calculatePointsEarned', () => {
    it('calculates points based on score', () => {
      const points = calculatePointsEarned(5, 10, 1);
      expect(points).toBeGreaterThan(0);
    });

    it('higher scores earn more points per token', () => {
      const lowPoints = calculatePointsEarned(5, 10, 1);
      const highPoints = calculatePointsEarned(35, 10, 1);
      // High tier has 2x multiplier vs low tier 1x
      expect(highPoints).toBeGreaterThan(lowPoints);
    });

    it('applies multiplier correctly', () => {
      const basePoints = calculatePointsEarned(10, 10, 1);
      const doubledPoints = calculatePointsEarned(10, 10, 2);
      expect(doubledPoints).toBe(basePoints * 2);
    });
  });

  describe('calculateStreakBonus', () => {
    it('returns 0 for streaks below 3', () => {
      expect(calculateStreakBonus(0)).toBe(0);
      expect(calculateStreakBonus(1)).toBe(0);
      expect(calculateStreakBonus(2)).toBe(0);
    });

    it('returns 5 for streaks 3-4', () => {
      expect(calculateStreakBonus(3)).toBe(5);
      expect(calculateStreakBonus(4)).toBe(5);
    });

    it('returns 10 for streaks 5-9', () => {
      expect(calculateStreakBonus(5)).toBe(10);
      expect(calculateStreakBonus(9)).toBe(10);
    });

    it('returns 20 for streaks 10+', () => {
      expect(calculateStreakBonus(10)).toBe(20);
      expect(calculateStreakBonus(50)).toBe(20);
    });
  });
});

describe('Game Logic - Ethics Defender', () => {
  describe('checkEthicsAnswer', () => {
    it('returns true for correct answer', () => {
      expect(checkEthicsAnswer(0, 0)).toBe(true);
      expect(checkEthicsAnswer(2, 2)).toBe(true);
    });

    it('returns false for incorrect answer', () => {
      expect(checkEthicsAnswer(0, 1)).toBe(false);
      expect(checkEthicsAnswer(2, 0)).toBe(false);
    });
  });

  describe('calculateEthicsScore', () => {
    it('does not add points for wrong answer', () => {
      expect(calculateEthicsScore(50, false, 5)).toBe(50);
    });

    it('adds 10 points for correct answer', () => {
      expect(calculateEthicsScore(50, true, 0)).toBe(60);
    });

    it('adds time bonus for correct answer', () => {
      expect(calculateEthicsScore(50, true, 5)).toBe(65);
    });
  });
});

describe('Game Logic - Utilities', () => {
  describe('shuffleArray', () => {
    it('returns array of same length', () => {
      const original = [1, 2, 3, 4, 5];
      const shuffled = shuffleArray(original);
      expect(shuffled).toHaveLength(original.length);
    });

    it('contains all original elements', () => {
      const original = [1, 2, 3, 4, 5];
      const shuffled = shuffleArray(original);
      expect(shuffled.sort()).toEqual(original.sort());
    });

    it('does not mutate original array', () => {
      const original = [1, 2, 3, 4, 5];
      const originalCopy = [...original];
      shuffleArray(original);
      expect(original).toEqual(originalCopy);
    });

    it('handles empty array', () => {
      expect(shuffleArray([])).toEqual([]);
    });

    it('handles single element', () => {
      expect(shuffleArray([1])).toEqual([1]);
    });
  });
});
