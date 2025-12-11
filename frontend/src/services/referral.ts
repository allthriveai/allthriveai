/**
 * Referral service for handling referral code capture and application.
 *
 * Flow:
 * 1. User lands on /auth?ref=CODE
 * 2. AuthPage captures the code and stores it in localStorage
 * 3. User completes OAuth signup
 * 4. After successful auth, the code is applied via API
 * 5. Code is cleared from localStorage
 */

import { api } from './api';
import { analytics } from '@/utils/analytics';

const REFERRAL_CODE_KEY = 'pending_referral_code';
const REFERRAL_REFERRER_KEY = 'pending_referral_referrer';
const REFERRAL_TIMESTAMP_KEY = 'pending_referral_timestamp';

// Referral codes expire after 7 days (in milliseconds)
const REFERRAL_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Check if localStorage is available (handles SSR and private browsing)
 */
function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Store a referral code for later application after signup.
 * Codes expire after 7 days.
 */
export function storeReferralCode(code: string, referrerUsername?: string): void {
  if (!isLocalStorageAvailable()) return;

  try {
    localStorage.setItem(REFERRAL_CODE_KEY, code);
    localStorage.setItem(REFERRAL_TIMESTAMP_KEY, Date.now().toString());
    if (referrerUsername) {
      localStorage.setItem(REFERRAL_REFERRER_KEY, referrerUsername);
    }
  } catch (error) {
    console.warn('Failed to store referral code:', error);
  }
}

/**
 * Check if the stored referral code has expired.
 */
function isReferralExpired(): boolean {
  try {
    const timestamp = localStorage.getItem(REFERRAL_TIMESTAMP_KEY);
    if (!timestamp) return true;

    const storedTime = parseInt(timestamp, 10);
    return Date.now() - storedTime > REFERRAL_EXPIRY_MS;
  } catch {
    return true;
  }
}

/**
 * Get the stored referral code, if any (returns null if expired).
 */
export function getStoredReferralCode(): string | null {
  if (!isLocalStorageAvailable()) return null;

  try {
    const code = localStorage.getItem(REFERRAL_CODE_KEY);

    // Check expiration
    if (code && isReferralExpired()) {
      analytics.referralCodeExpired(code);
      clearStoredReferralCode();
      return null;
    }

    return code;
  } catch (error) {
    console.warn('Failed to get referral code:', error);
    return null;
  }
}

/**
 * Get the stored referrer username, if any.
 */
export function getStoredReferrerUsername(): string | null {
  if (!isLocalStorageAvailable()) return null;

  try {
    // Check expiration first
    if (isReferralExpired()) {
      clearStoredReferralCode();
      return null;
    }
    return localStorage.getItem(REFERRAL_REFERRER_KEY);
  } catch {
    return null;
  }
}

/**
 * Clear the stored referral code and all related data.
 */
export function clearStoredReferralCode(): void {
  if (!isLocalStorageAvailable()) return;

  try {
    localStorage.removeItem(REFERRAL_CODE_KEY);
    localStorage.removeItem(REFERRAL_REFERRER_KEY);
    localStorage.removeItem(REFERRAL_TIMESTAMP_KEY);
  } catch (error) {
    console.warn('Failed to clear referral code:', error);
  }
}

/**
 * Validate a referral code with the backend.
 */
export async function validateReferralCode(code: string): Promise<{
  valid: boolean;
  referrerUsername?: string;
  error?: string;
}> {
  try {
    const response = await api.get(`/referrals/validate/${encodeURIComponent(code)}/`);
    const { valid, referrer_username } = response.data;

    // Track validation result
    analytics.referralCodeValidated(code, valid, referrer_username);

    if (valid && referrer_username) {
      analytics.referralLinkVisited(code, referrer_username);
    }

    return {
      valid,
      referrerUsername: referrer_username,
    };
  } catch (error: any) {
    const errorMessage = error.response?.data?.error || 'Invalid referral code';

    // Track failed validation
    analytics.referralCodeValidated(code, false);

    return {
      valid: false,
      error: errorMessage,
    };
  }
}

/**
 * Apply a stored referral code to the current user.
 * Should be called after successful signup/login.
 */
export async function applyStoredReferralCode(): Promise<{
  success: boolean;
  message?: string;
  referrerUsername?: string;
  error?: string;
}> {
  const code = getStoredReferralCode();
  const storedReferrer = getStoredReferrerUsername();

  if (!code) {
    return { success: false, error: 'No referral code stored' };
  }

  try {
    const response = await api.post('/me/referrals/apply/', { code });
    const { referrer_username } = response.data;

    // Track successful referral application
    analytics.referralCodeApplied(code, referrer_username || storedReferrer || 'unknown');

    // Clear the stored code after successful application
    clearStoredReferralCode();

    return {
      success: true,
      message: response.data.message,
      referrerUsername: referrer_username,
    };
  } catch (error: any) {
    const errorMessage = error.response?.data?.error || 'Failed to apply referral code';

    // Track failed referral application
    analytics.referralCodeFailed(code, errorMessage);

    // Clear the code even on error to prevent repeated failures
    // (e.g., if user already has a referral, code is invalid, etc.)
    clearStoredReferralCode();

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Check if there's a pending referral code to apply.
 */
export function hasPendingReferralCode(): boolean {
  return !!getStoredReferralCode();
}
