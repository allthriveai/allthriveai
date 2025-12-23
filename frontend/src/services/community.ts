/**
 * Community Messaging API Service
 *
 * Provides API calls for rooms, messages, DMs, and moderation.
 * Uses the existing api.ts axios instance which handles:
 * - Automatic snake_case → camelCase conversion
 * - JWT authentication via HTTP-only cookies
 * - CSRF token handling
 */

import { api } from './api';
import { handleError } from '@/utils/errorHandler';
import type {
  Room,
  RoomListItem,
  Message,
  Thread,
  RoomMembership,
  DirectMessageThread,
  DMSuggestion,
  CreateRoomRequest,
  SendMessageRequest,
  CreateDMRequest,
  MessageReactionRequest,
  ReportMessageRequest,
} from '@/types/community';

const BASE_URL = '/community';

// ============================================================================
// Rooms
// ============================================================================

/**
 * Get list of accessible rooms
 */
export async function getRooms(type?: string): Promise<RoomListItem[]> {
  try {
    const params = type ? { type } : {};
    const response = await api.get(`${BASE_URL}/rooms/`, { params });
    return response.data;
  } catch (error) {
    handleError('CommunityService.getRooms', error, { showAlert: false });
    throw error;
  }
}

/**
 * Get room details by ID
 */
export async function getRoom(roomId: string): Promise<Room> {
  try {
    const response = await api.get(`${BASE_URL}/rooms/${roomId}/`);
    return response.data;
  } catch (error) {
    handleError('CommunityService.getRoom', error, { metadata: { roomId }, showAlert: false });
    throw error;
  }
}

/**
 * Create a new room (trust-gated)
 */
export async function createRoom(data: CreateRoomRequest): Promise<Room> {
  try {
    const response = await api.post(`${BASE_URL}/rooms/`, data);
    return response.data;
  } catch (error) {
    handleError('CommunityService.createRoom', error, { metadata: { name: data.name } });
    throw error;
  }
}

/**
 * Join a room
 */
export async function joinRoom(roomId: string): Promise<RoomMembership> {
  try {
    const response = await api.post(`${BASE_URL}/rooms/${roomId}/join/`);
    return response.data;
  } catch (error) {
    handleError('CommunityService.joinRoom', error, { metadata: { roomId } });
    throw error;
  }
}

/**
 * Leave a room
 */
export async function leaveRoom(roomId: string): Promise<void> {
  try {
    await api.post(`${BASE_URL}/rooms/${roomId}/leave/`);
  } catch (error) {
    handleError('CommunityService.leaveRoom', error, { metadata: { roomId } });
    throw error;
  }
}

/**
 * Get room members
 */
export async function getRoomMembers(roomId: string): Promise<RoomMembership[]> {
  try {
    const response = await api.get(`${BASE_URL}/rooms/${roomId}/members/`);
    return response.data;
  } catch (error) {
    handleError('CommunityService.getRoomMembers', error, { metadata: { roomId }, showAlert: false });
    throw error;
  }
}

// ============================================================================
// Messages
// ============================================================================

/**
 * Get messages for a room with cursor-based pagination
 */
export async function getRoomMessages(
  roomId: string,
  cursor?: string,
  limit: number = 50
): Promise<{ messages: Message[]; hasMore: boolean; cursor: string | null }> {
  try {
    const params: Record<string, string | number> = { limit };
    if (cursor) params.cursor = cursor;

    const response = await api.get(`${BASE_URL}/rooms/${roomId}/messages/`, { params });
    return response.data;
  } catch (error) {
    handleError('CommunityService.getRoomMessages', error, { metadata: { roomId }, showAlert: false });
    throw error;
  }
}

/**
 * Send a message to a room
 */
export async function sendMessage(roomId: string, data: SendMessageRequest): Promise<Message> {
  try {
    const response = await api.post(`${BASE_URL}/rooms/${roomId}/messages/`, data);
    return response.data;
  } catch (error) {
    handleError('CommunityService.sendMessage', error, { metadata: { roomId } });
    throw error;
  }
}

/**
 * Edit a message
 */
export async function editMessage(roomId: string, messageId: string, content: string): Promise<Message> {
  try {
    const response = await api.patch(`${BASE_URL}/rooms/${roomId}/messages/${messageId}/`, { content });
    return response.data;
  } catch (error) {
    handleError('CommunityService.editMessage', error, { metadata: { roomId, messageId } });
    throw error;
  }
}

/**
 * Delete a message
 */
export async function deleteMessage(roomId: string, messageId: string): Promise<void> {
  try {
    await api.delete(`${BASE_URL}/rooms/${roomId}/messages/${messageId}/`);
  } catch (error) {
    handleError('CommunityService.deleteMessage', error, { metadata: { roomId, messageId } });
    throw error;
  }
}

/**
 * Add a reaction to a message
 */
export async function addReaction(roomId: string, messageId: string, data: MessageReactionRequest): Promise<void> {
  try {
    await api.post(`${BASE_URL}/rooms/${roomId}/messages/${messageId}/react/`, data);
  } catch (error) {
    handleError('CommunityService.addReaction', error, { metadata: { roomId, messageId }, showAlert: false });
    throw error;
  }
}

/**
 * Remove a reaction from a message
 */
export async function removeReaction(roomId: string, messageId: string, emoji: string): Promise<void> {
  try {
    await api.delete(`${BASE_URL}/rooms/${roomId}/messages/${messageId}/react/`, { data: { emoji } });
  } catch (error) {
    handleError('CommunityService.removeReaction', error, { metadata: { roomId, messageId }, showAlert: false });
    throw error;
  }
}

/**
 * Report a message
 */
export async function reportMessage(roomId: string, messageId: string, data: ReportMessageRequest): Promise<void> {
  try {
    await api.post(`${BASE_URL}/rooms/${roomId}/messages/${messageId}/report/`, data);
  } catch (error) {
    handleError('CommunityService.reportMessage', error, { metadata: { roomId, messageId } });
    throw error;
  }
}

// ============================================================================
// Threads
// ============================================================================

/**
 * Get threads for a room
 */
export async function getRoomThreads(roomId: string): Promise<Thread[]> {
  try {
    const response = await api.get(`${BASE_URL}/rooms/${roomId}/threads/`);
    return response.data;
  } catch (error) {
    handleError('CommunityService.getRoomThreads', error, { metadata: { roomId }, showAlert: false });
    throw error;
  }
}

// ============================================================================
// Direct Messages
// ============================================================================

/**
 * Get DM threads for current user
 */
export async function getDMThreads(): Promise<DirectMessageThread[]> {
  try {
    const response = await api.get(`${BASE_URL}/dm/`);
    // Handle both paginated response and direct array
    if (Array.isArray(response.data)) {
      return response.data;
    }
    // DRF pagination returns { results: [...], count, next, previous }
    return response.data.results || [];
  } catch (error) {
    handleError('CommunityService.getDMThreads', error, { showAlert: false });
    throw error;
  }
}

/**
 * Get a specific DM thread
 */
export async function getDMThread(threadId: string): Promise<DirectMessageThread> {
  try {
    const response = await api.get(`${BASE_URL}/dm/${threadId}/`);
    return response.data;
  } catch (error) {
    handleError('CommunityService.getDMThread', error, { metadata: { threadId }, showAlert: false });
    throw error;
  }
}

/**
 * Create a new DM thread
 */
export async function createDMThread(data: CreateDMRequest): Promise<DirectMessageThread> {
  try {
    const response = await api.post(`${BASE_URL}/dm/`, data);
    return response.data;
  } catch (error) {
    handleError('CommunityService.createDMThread', error);
    throw error;
  }
}

/**
 * Get suggested users to message
 * Returns users prioritized by: circle members, following, recommendations
 */
export async function getDMSuggestions(limit: number = 10): Promise<DMSuggestion[]> {
  try {
    const response = await api.get(`${BASE_URL}/dm/suggestions/`, { params: { limit } });
    return response.data.suggestions;
  } catch (error) {
    handleError('CommunityService.getDMSuggestions', error, { showAlert: false });
    throw error;
  }
}

// ============================================================================
// Blocking
// ============================================================================

/**
 * Get blocked users
 */
export async function getBlockedUsers(): Promise<{ id: string; username: string }[]> {
  try {
    const response = await api.get(`${BASE_URL}/block/`);
    return response.data;
  } catch (error) {
    handleError('CommunityService.getBlockedUsers', error, { showAlert: false });
    throw error;
  }
}

/**
 * Block a user
 */
export async function blockUser(userId: string): Promise<void> {
  try {
    await api.post(`${BASE_URL}/block/`, { userId });
  } catch (error) {
    handleError('CommunityService.blockUser', error, { metadata: { userId } });
    throw error;
  }
}

/**
 * Unblock a user
 */
export async function unblockUser(userId: string): Promise<void> {
  try {
    await api.delete(`${BASE_URL}/block/`, { data: { userId } });
  } catch (error) {
    handleError('CommunityService.unblockUser', error, { metadata: { userId } });
    throw error;
  }
}

// ============================================================================
// WebSocket Connection Token
// ============================================================================

/**
 * Get a WebSocket connection token for community chat
 * Uses the existing auth endpoint
 */
export async function getConnectionToken(): Promise<string> {
  try {
    const response = await api.post('/auth/ws-connection-token/');
    // Backend returns connection_token, axios interceptor converts to camelCase
    return response.data.connectionToken;
  } catch (error) {
    handleError('CommunityService.getConnectionToken', error, { showAlert: false });
    throw error;
  }
}
