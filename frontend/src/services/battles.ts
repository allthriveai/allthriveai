/**
 * Battle service for fetching user battle history
 */
import { api } from './api';

export interface BattleUser {
  id: number;
  username: string;
  avatarUrl: string | null;
}

export interface BattleSubmission {
  id: number;
  user: BattleUser;
  promptText: string;
  generatedOutputUrl: string | null;
  generatedOutputText: string;
  score: number | null;
  criteriaScores: Record<string, number>;
  evaluationFeedback: string;
  submittedAt: string | null;
}

export interface ChallengeType {
  key: string;
  name: string;
}

export interface Battle {
  id: number;
  challenger: BattleUser;
  opponent: BattleUser | null;
  challengeText: string;
  challengeType: ChallengeType | null;
  status: string;
  battleType: string;
  matchSource: string;
  durationMinutes: number;
  createdAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  winner: BattleUser | null;
  isUserWinner: boolean;
  submissions: BattleSubmission[];
}

export interface BattleStats {
  totalBattles: number;
  wins: number;
  losses: number;
  ties: number;
  draws?: number;
  winRate: number;
  currentStreak?: number;
  bestStreak?: number;
}

export interface UserBattlesResponse {
  battles: Battle[];
  stats: BattleStats;
}

/**
 * Fetch battles for a specific user by username (public endpoint)
 */
export async function getUserBattles(username: string): Promise<UserBattlesResponse> {
  const response = await api.get(`/users/${username}/battles/`);
  return response.data;
}
