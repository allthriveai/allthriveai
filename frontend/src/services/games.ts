/**
 * Games API Service
 *
 * Handles game-related API calls including score submission and leaderboards.
 */

import { api } from './api';

export type GameType = 'context_snake' | 'ethics_defender';

export interface GameScoreMetadata {
  gameVersion?: string;
  [key: string]: unknown;
}

export interface PointsAwarded {
  base: number;
  bonus: number;
  total: number;
}

export interface GameScoreResponse {
  id: number;
  game: GameType;
  score: number;
  metadata: GameScoreMetadata;
  createdAt: string;
  pointsAwarded: PointsAwarded;
}

export interface LeaderboardEntry {
  id: number;
  username: string;
  avatarUrl?: string;
  score: number;
  createdAt: string;
}

export interface SubmitScorePayload {
  game: GameType;
  score: number;
  metadata?: GameScoreMetadata;
}

/**
 * Submit a game score and receive points
 */
export async function submitGameScore(payload: SubmitScorePayload): Promise<GameScoreResponse> {
  const response = await api.post<GameScoreResponse>('/games/scores/', payload);
  return response.data;
}

/**
 * Get the current user's high score for a game
 */
export async function getMyHighScore(game: GameType): Promise<{ score: number | null }> {
  const response = await api.get<{ score: number | null }>(`/games/scores/${game}/me/`);
  return response.data;
}

/**
 * Get the leaderboard for a game
 */
export async function getLeaderboard(game: GameType, limit = 10): Promise<LeaderboardEntry[]> {
  const response = await api.get<LeaderboardEntry[]>(`/games/scores/${game}/leaderboard/`, {
    params: { limit },
  });
  return response.data;
}
