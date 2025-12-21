/**
 * Hook for fetching DM suggestions
 *
 * Returns suggested users for starting a conversation,
 * prioritized by: circle members, following, recommendations.
 */

import { useQuery } from '@tanstack/react-query';
import { getDMSuggestions } from '@/services/community';
import type { DMSuggestion } from '@/types/community';

export function useDMSuggestions(limit: number = 10) {
  return useQuery<DMSuggestion[], Error>({
    queryKey: ['dm-suggestions', limit],
    queryFn: () => getDMSuggestions(limit),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });
}

export default useDMSuggestions;
