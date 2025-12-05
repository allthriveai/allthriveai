/**
 * Challenges API Service
 * Handles all weekly challenges-related API calls
 */

import { api } from './api';

// Types
export interface ChallengeSponsor {
  id: string;
  name: string;
  slug: string;
  logoUrl: string;
  websiteUrl: string;
  description: string;
  isVerified: boolean;
}

export interface PrizeConfig {
  type: 'cash' | 'tokens';
  amount: number;
  currency?: string;
}

export interface SuggestedTool {
  name: string;
  url?: string;
  icon?: string;
  description?: string;
}

export interface WeeklyChallenge {
  id: string;
  title: string;
  slug: string;
  description: string;
  prompt?: string;
  status: 'draft' | 'upcoming' | 'active' | 'voting' | 'completed' | 'cancelled';
  statusDisplay: string;
  weekNumber: number;
  year: number;
  startsAt: string;
  submissionDeadline: string;
  votingDeadline?: string;
  endsAt: string;
  isFeatured: boolean;
  maxSubmissionsPerUser?: number;
  allowVoting?: boolean;
  requireProjectLink?: boolean;
  allowExternalSubmissions?: boolean;
  heroImageUrl: string;
  themeColor: string;
  sponsor?: ChallengeSponsor;
  prizes?: Record<string, PrizeConfig>;
  pointsConfig?: Record<string, number>;
  suggestedTools?: SuggestedTool[];
  submissionCount: number;
  participantCount: number;
  totalVotes?: number;
  canSubmit?: boolean;
  canVote?: boolean;
  timeRemainingDisplay?: string;
  userStatus?: {
    hasSubmitted: boolean;
    submissionCount: number;
    canSubmitMore: boolean;
    votesCast: number;
    canVoteToday: boolean;
    votesRemainingToday: number;
    rank?: number;
    totalVotes: number;
  };
  topSubmissions?: ChallengeSubmission[];
}

export interface ChallengeSubmission {
  id: string;
  user: {
    id: number;
    username: string;
    avatarUrl?: string;
  };
  title: string;
  description: string;
  imageUrl: string;
  externalUrl?: string;
  aiToolUsed?: string;
  voteCount: number;
  isFeatured: boolean;
  isEarlyBird: boolean;
  finalRank?: number;
  submittedAt: string;
  hasVoted: boolean;
  challenge?: WeeklyChallenge;
  projectId?: string;
  projectTitle?: string;
  participationPoints?: number;
  bonusPoints?: number;
  prizePoints?: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: number;
  username: string;
  avatarUrl?: string;
  voteCount: number;
  isCurrentUser: boolean;
  submissionCount?: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  totalParticipants: number;
  userEntry?: LeaderboardEntry;
}

export interface SubmissionsResponse {
  results: ChallengeSubmission[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateSubmissionData {
  title: string;
  description?: string;
  imageUrl?: string;
  externalUrl?: string;
  aiToolUsed?: string;
  projectId?: string;
}

// API Methods

/**
 * Get list of challenges
 */
export async function getChallenges(params?: {
  status?: string;
  featured?: boolean;
}): Promise<WeeklyChallenge[]> {
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.set('status', params.status);
  if (params?.featured) queryParams.set('featured', 'true');

  const response = await api.get(`/challenges/?${queryParams.toString()}`);
  return response.data;
}

/**
 * Get current active challenge
 */
export async function getCurrentChallenge(): Promise<WeeklyChallenge> {
  const response = await api.get('/challenges/current/');
  return response.data;
}

/**
 * Get challenge by slug
 */
export async function getChallengeBySlug(slug: string): Promise<WeeklyChallenge> {
  const response = await api.get(`/challenges/${slug}/`);
  return response.data;
}

/**
 * Get submissions for a challenge
 */
export async function getChallengeSubmissions(
  slug: string,
  params?: {
    sort?: 'votes' | 'recent' | 'featured';
    page?: number;
    pageSize?: number;
  }
): Promise<SubmissionsResponse> {
  const queryParams = new URLSearchParams();
  if (params?.sort) queryParams.set('sort', params.sort);
  if (params?.page) queryParams.set('page', params.page.toString());
  if (params?.pageSize) queryParams.set('page_size', params.pageSize.toString());

  const response = await api.get(`/challenges/${slug}/submissions/?${queryParams.toString()}`);
  return response.data;
}

/**
 * Get leaderboard for a challenge
 */
export async function getChallengeLeaderboard(
  slug: string,
  limit?: number
): Promise<LeaderboardResponse> {
  const queryParams = limit ? `?limit=${limit}` : '';
  const response = await api.get(`/challenges/${slug}/leaderboard/${queryParams}`);
  return response.data;
}

/**
 * Submit entry to a challenge
 */
export async function submitToChallenge(
  slug: string,
  data: CreateSubmissionData
): Promise<ChallengeSubmission> {
  const response = await api.post(`/challenges/${slug}/submit/`, data);
  return response.data;
}

/**
 * Vote for a submission
 */
export async function voteForSubmission(
  slug: string,
  submissionId: string
): Promise<{ success: boolean; newVoteCount: number }> {
  const response = await api.post(`/challenges/${slug}/vote/${submissionId}/`);
  return response.data;
}

/**
 * Remove vote from a submission
 */
export async function unvoteSubmission(
  slug: string,
  submissionId: string
): Promise<{ success: boolean; newVoteCount: number }> {
  const response = await api.delete(`/challenges/${slug}/unvote/${submissionId}/`);
  return response.data;
}

/**
 * Get current user's submissions to a challenge
 */
export async function getMySubmissions(slug: string): Promise<ChallengeSubmission[]> {
  const response = await api.get(`/challenges/${slug}/my-submissions/`);
  return response.data;
}

/**
 * Get a single submission by ID
 */
export async function getSubmission(submissionId: string): Promise<ChallengeSubmission> {
  const response = await api.get(`/submissions/${submissionId}/`);
  return response.data;
}
