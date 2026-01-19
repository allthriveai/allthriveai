/**
 * Content Engine Brand Voice Hook
 * US-009: Brand Voice Tab
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import {
  getBrandVoices,
  updateBrandVoice,
  setDefaultBrandVoice,
} from '@/services/brandVoice';
import type { BrandVoice, BrandVoiceFormData } from '@/types/models';

interface UseBrandVoiceReturn {
  voices: BrandVoice[];
  defaultVoice: BrandVoice | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and manage brand voices
 */
export function useBrandVoices(): UseBrandVoiceReturn {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [voices, setVoices] = useState<BrandVoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVoices = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      setVoices([]);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await getBrandVoices();
      setVoices(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load brand voices';
      setError(errorMessage);
      console.error('Failed to load brand voices:', err);
      setVoices([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthLoading) {
      fetchVoices();
    }
  }, [isAuthLoading, fetchVoices]);

  const defaultVoice = voices.find((v) => v.isDefault) || null;

  return {
    voices,
    defaultVoice,
    isLoading: isAuthLoading || isLoading,
    error,
    refetch: fetchVoices,
  };
}

interface UseUpdateBrandVoiceReturn {
  updateVoice: (id: number, data: BrandVoiceFormData) => Promise<BrandVoice>;
  isUpdating: boolean;
  error: string | null;
}

/**
 * Hook for updating a brand voice
 */
export function useUpdateBrandVoice(): UseUpdateBrandVoiceReturn {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(async (id: number, data: BrandVoiceFormData): Promise<BrandVoice> => {
    setIsUpdating(true);
    setError(null);
    try {
      const result = await updateBrandVoice(id, data);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update brand voice';
      setError(errorMessage);
      throw err;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  return {
    updateVoice: update,
    isUpdating,
    error,
  };
}

interface UseSetDefaultVoiceReturn {
  setDefault: (id: number) => Promise<void>;
  isSettingDefault: boolean;
  error: string | null;
}

/**
 * Hook for setting a brand voice as default
 */
export function useSetDefaultVoice(): UseSetDefaultVoiceReturn {
  const [isSettingDefault, setIsSettingDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setDefault = useCallback(async (id: number): Promise<void> => {
    setIsSettingDefault(true);
    setError(null);
    try {
      await setDefaultBrandVoice(id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set default voice';
      setError(errorMessage);
      throw err;
    } finally {
      setIsSettingDefault(false);
    }
  }, []);

  return {
    setDefault,
    isSettingDefault,
    error,
  };
}
