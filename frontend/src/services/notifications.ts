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
  // SMS preferences (master switch on User model)
  phoneNumber: string;
  phoneVerified: boolean;
  allowSmsInvitations: boolean;
  // SMS category preferences
  smsBattleInvitations: boolean;
  smsBattleResults: boolean;
  smsBattleReminders: boolean;
  smsStreakAlerts: boolean;
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
  // SMS category preferences
  smsBattleInvitations?: boolean;
  smsBattleResults?: boolean;
  smsBattleReminders?: boolean;
  smsStreakAlerts?: boolean;
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

// SMS Opt-in types
export interface SmsOptInStatus {
  showPrompt: boolean;
  alreadyOptedIn: boolean;
  phoneNumber: string;
  phoneVerified: boolean;
}

export interface SmsOptInResponse {
  success: boolean;
  allowSmsInvitations: boolean;
}

// SMS Preferences types
export interface SmsPreferences {
  allowSmsInvitations: boolean;
  phoneNumber: string;
  phoneVerified: boolean;
  smsBattleInvitations: boolean;
  smsBattleResults: boolean;
  smsBattleReminders: boolean;
  smsStreakAlerts: boolean;
  hasConsent: boolean;
  consentGivenAt: string | null;
}

export interface UpdateSmsPreferencesRequest {
  allowSmsInvitations?: boolean;
  smsBattleInvitations?: boolean;
  smsBattleResults?: boolean;
  smsBattleReminders?: boolean;
  smsStreakAlerts?: boolean;
}

export interface SmsPreferencesResponse extends SmsPreferences {
  success?: boolean;
  updated?: string[];
}

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

/**
 * Check if user should see SMS opt-in prompt
 */
export async function getSmsOptInStatus(): Promise<SmsOptInStatus> {
  const response = await api.get<SmsOptInStatus>('/notifications/sms-opt-in/');
  return response.data;
}

/**
 * Handle SMS opt-in action
 */
export async function submitSmsOptIn(
  action: 'opt_in' | 'dismiss' | 'remind_later'
): Promise<SmsOptInResponse> {
  const response = await api.post<SmsOptInResponse>('/notifications/sms-opt-in/', { action });
  return response.data;
}

/**
 * Get current user's SMS preferences
 */
export async function getMySmsPreferences(): Promise<SmsPreferences> {
  const response = await api.get<SmsPreferences>('/notifications/me/sms-preferences/');
  return response.data;
}

/**
 * Update current user's SMS preferences
 */
export async function updateMySmsPreferences(
  preferences: UpdateSmsPreferencesRequest
): Promise<SmsPreferencesResponse> {
  const response = await api.patch<SmsPreferencesResponse>(
    '/notifications/me/sms-preferences/',
    preferences
  );
  return response.data;
}
