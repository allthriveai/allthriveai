import { api } from './api';

export interface NotificationPreferences {
  // Email preferences
  emailBilling: boolean;
  emailWelcome: boolean;
  emailBattles: boolean;
  emailAchievements: boolean;
  emailSocial: boolean;
  emailQuests: boolean;
  emailMarketing: boolean;
  // SMS preferences
  phoneNumber: string;
  phoneVerified: boolean;
  allowSmsInvitations: boolean;
  // Battle availability
  isAvailableForBattles: boolean;
}

// Backwards compatibility alias
export type EmailPreferences = NotificationPreferences;

export interface UpdateNotificationPreferencesRequest {
  // Email preferences
  emailBattles?: boolean;
  emailAchievements?: boolean;
  emailSocial?: boolean;
  emailQuests?: boolean;
  emailMarketing?: boolean;
  // SMS preferences
  phoneNumber?: string;
  allowSmsInvitations?: boolean;
  // Battle availability
  isAvailableForBattles?: boolean;
}

// Backwards compatibility alias
export type UpdateEmailPreferencesRequest = UpdateNotificationPreferencesRequest;

export interface NotificationPreferencesResponse extends NotificationPreferences {
  success?: boolean;
  updated?: string[];
  error?: string;
}

// Backwards compatibility alias
export type EmailPreferencesResponse = NotificationPreferencesResponse;

/**
 * Get current user's notification preferences (email and SMS)
 */
export async function getMyNotificationPreferences(): Promise<NotificationPreferences> {
  const response = await api.get<NotificationPreferencesResponse>('/notifications/me/preferences/');
  return response.data;
}

// Backwards compatibility alias
export const getMyEmailPreferences = getMyNotificationPreferences;

/**
 * Update current user's notification preferences (email and SMS)
 */
export async function updateMyNotificationPreferences(
  preferences: UpdateNotificationPreferencesRequest
): Promise<NotificationPreferencesResponse> {
  const response = await api.patch<NotificationPreferencesResponse>(
    '/notifications/me/preferences/',
    preferences
  );
  return response.data;
}

// Backwards compatibility alias
export const updateMyEmailPreferences = updateMyNotificationPreferences;
