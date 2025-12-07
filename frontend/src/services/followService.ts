import { api } from './api';

export interface FollowUser {
  id: number;
  username: string;
  avatarUrl: string | null;
}

export interface FollowListItem {
  id: number;
  user: FollowUser;
  isFollowing?: boolean; // For followers list - whether current user follows them back
  createdAt: string;
}

export interface FollowResponse {
  message: string;
  isFollowing: boolean;
  followersCount: number;
}

export interface PaginatedFollowList {
  count: number;
  next: string | null;
  previous: string | null;
  results: FollowListItem[];
}

export const followService = {
  /**
   * Follow a user
   */
  followUser: async (username: string): Promise<FollowResponse> => {
    const response = await api.post<FollowResponse>(`/users/${username}/follow/`);
    return response.data;
  },

  /**
   * Unfollow a user
   */
  unfollowUser: async (username: string): Promise<FollowResponse> => {
    const response = await api.delete<FollowResponse>(`/users/${username}/follow/`);
    return response.data;
  },

  /**
   * Get list of followers for a user
   */
  getFollowers: async (
    username: string,
    page = 1,
    pageSize = 20
  ): Promise<PaginatedFollowList> => {
    const response = await api.get<PaginatedFollowList>(
      `/users/${username}/followers/`,
      { params: { page, page_size: pageSize } }
    );
    return response.data;
  },

  /**
   * Get list of users that a user is following
   */
  getFollowing: async (
    username: string,
    page = 1,
    pageSize = 20
  ): Promise<PaginatedFollowList> => {
    const response = await api.get<PaginatedFollowList>(
      `/users/${username}/following/`,
      { params: { page, page_size: pageSize } }
    );
    return response.data;
  },
};
