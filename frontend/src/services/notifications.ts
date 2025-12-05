import { api } from './api';

export interface EmailPreferences {
  emailBilling: boolean;
  emailWelcome: boolean;
  emailBattles: boolean;
  emailAchievements: boolean;
  emailSocial: boolean;
  emailQuests: boolean;
  emailMarketing: boolean;
}

export interface UpdateEmailPreferencesRequest {
  emailBattles?: boolean;
  emailAchievements?: boolean;
  emailSocial?: boolean;
  emailQuests?: boolean;
  emailMarketing?: boolean;
}

export interface EmailPreferencesResponse extends EmailPreferences {
  success?: boolean;
  updated?: string[];
}

/**
 * Get current user's email notification preferences
 */
export async function getMyEmailPreferences(): Promise<EmailPreferences> {
  const response = await api.get<EmailPreferencesResponse>('/notifications/me/preferences/');
  return response.data;
}

/**
 * Update current user's email notification preferences
 */
export async function updateMyEmailPreferences(
  preferences: UpdateEmailPreferencesRequest
): Promise<EmailPreferencesResponse> {
  const response = await api.patch<EmailPreferencesResponse>(
    '/notifications/me/preferences/',
    preferences
  );
  return response.data;
}
