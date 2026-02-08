/**
 * useEchoProfile Hook
 *
 * Fetches and caches the user's Echo profile from /api/v1/echo/profile/.
 * Creates a profile if one doesn't exist (handled by the API).
 *
 * US-006: useEchoProfile hook fetches and caches profile
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';

// Echo profile types matching the backend EchoProfileSerializer
export type OnboardingPhase = 'intro' | 'goals' | 'platforms' | 'topics' | 'complete';

export interface EchoProfile {
  id: number;
  onboardingPhase: OnboardingPhase;
  goals: string[];
  targetPlatforms: string[];
  contentPillars: string[];
  audienceDescription: string;
  preferredPostingTimes: Record<string, string[]>;
  isOnboarded: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateEchoProfilePayload {
  onboardingPhase?: OnboardingPhase;
  goals?: string[];
  targetPlatforms?: string[];
  contentPillars?: string[];
  audienceDescription?: string;
  preferredPostingTimes?: Record<string, string[]>;
}

const ECHO_PROFILE_KEY = ['echo', 'profile'];

/**
 * Fetch the user's Echo profile.
 */
async function fetchEchoProfile(): Promise<EchoProfile> {
  const response = await api.get('/echo/profile/');
  return response.data;
}

/**
 * Update the user's Echo profile.
 */
async function updateEchoProfile(payload: UpdateEchoProfilePayload): Promise<EchoProfile> {
  const response = await api.patch('/echo/profile/', payload);
  return response.data;
}

/**
 * Hook to fetch and cache the user's Echo profile.
 *
 * @returns {object} { profile, isLoading, error, refetch }
 */
export function useEchoProfile() {
  const query = useQuery({
    queryKey: ECHO_PROFILE_KEY,
    queryFn: fetchEchoProfile,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  return {
    profile: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook to update the user's Echo profile.
 *
 * @returns {object} { updateProfile, isUpdating }
 */
export function useUpdateEchoProfile() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: updateEchoProfile,
    onSuccess: (data) => {
      // Update the cache with the new profile data
      queryClient.setQueryData(ECHO_PROFILE_KEY, data);
    },
  });

  return {
    updateProfile: mutation.mutate,
    updateProfileAsync: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  };
}
