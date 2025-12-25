/**
 * Avatar API service for managing user avatars.
 */

import { api } from './api';
import type {
  UserAvatar,
  AvatarGenerationSession,
  CreateSessionRequest,
  AcceptIterationRequest,
} from '@/types/avatar';

// Avatar CRUD operations
export const avatarService = {
  /**
   * Get all avatars for the current user (max 10).
   */
  async listAvatars(): Promise<UserAvatar[]> {
    const response = await api.get<UserAvatar[]>('/me/avatars/');
    return response.data;
  },

  /**
   * Get a specific avatar by ID.
   */
  async getAvatar(id: number): Promise<UserAvatar> {
    const response = await api.get<UserAvatar>(`/me/avatars/${id}/`);
    return response.data;
  },

  /**
   * Get the user's current active avatar.
   */
  async getCurrentAvatar(): Promise<UserAvatar> {
    const response = await api.get<UserAvatar>('/me/avatars/current/');
    return response.data;
  },

  /**
   * Set an avatar as the current avatar.
   */
  async setCurrentAvatar(avatarId: number): Promise<UserAvatar> {
    const response = await api.post<UserAvatar>('/me/avatars/set-current/', {
      avatarId,
    });
    return response.data;
  },

  /**
   * Delete (soft delete) an avatar.
   */
  async deleteAvatar(id: number): Promise<void> {
    await api.delete(`/me/avatars/${id}/`);
  },
};

// Avatar generation session operations
export const sessionService = {
  /**
   * List all generation sessions for the current user.
   */
  async listSessions(): Promise<AvatarGenerationSession[]> {
    const response = await api.get<AvatarGenerationSession[]>('/me/avatar-sessions/');
    return response.data;
  },

  /**
   * Get a specific session by ID.
   */
  async getSession(id: number): Promise<AvatarGenerationSession> {
    const response = await api.get<AvatarGenerationSession>(`/me/avatar-sessions/${id}/`);
    return response.data;
  },

  /**
   * Get the user's active generation session (if any).
   */
  async getActiveSession(): Promise<AvatarGenerationSession | null> {
    try {
      const response = await api.get<AvatarGenerationSession>('/me/avatar-sessions/active/');
      return response.data;
    } catch (error: unknown) {
      // 404 means no active session
      // Note: API interceptor transforms errors to ApiError with statusCode property
      if (error && typeof error === 'object') {
        const apiError = error as { statusCode?: number; response?: { status?: number } };
        if (apiError.statusCode === 404 || apiError.response?.status === 404) {
          return null;
        }
      }
      throw error;
    }
  },

  /**
   * Start a new avatar generation session.
   */
  async startSession(request: CreateSessionRequest): Promise<AvatarGenerationSession> {
    const response = await api.post<AvatarGenerationSession>(
      '/me/avatar-sessions/start/',
      request
    );
    return response.data;
  },

  /**
   * Accept an iteration and save it as the user's avatar.
   */
  async acceptIteration(
    sessionId: number,
    iterationId: number
  ): Promise<AvatarGenerationSession> {
    const response = await api.post<AvatarGenerationSession>(
      `/me/avatar-sessions/${sessionId}/accept/`,
      { iterationId } as AcceptIterationRequest
    );
    return response.data;
  },

  /**
   * Abandon an active generation session.
   */
  async abandonSession(sessionId: number): Promise<AvatarGenerationSession> {
    const response = await api.post<AvatarGenerationSession>(
      `/me/avatar-sessions/${sessionId}/abandon/`
    );
    return response.data;
  },
};

export default {
  ...avatarService,
  sessions: sessionService,
};
