/**
 * Team service for fetching All Thrive team members (AI agents)
 */

import { api } from './api';

export interface TeamMember {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
  avatarUrl?: string;
  bio?: string;
  tagline?: string;
  location?: string;
  pronouns?: string;
  currentStatus?: string;
  websiteUrl?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  youtubeUrl?: string;
  instagramUrl?: string;
  signaturePhrases: string[];
  agentInterests: string[];
  teamType: 'core' | 'contributor';
}

export interface TeamResponse {
  coreTeam: TeamMember[];
  contributors: TeamMember[];
  totalCount: number;
}

/**
 * Get All Thrive team members (AI agents)
 * @param type - Optional filter by team type ('core' or 'contributor')
 */
export async function getTeamMembers(type?: 'core' | 'contributor'): Promise<TeamResponse> {
  const params = type ? { type } : {};
  const response = await api.get<TeamResponse>('/team/', { params });
  return response.data;
}
