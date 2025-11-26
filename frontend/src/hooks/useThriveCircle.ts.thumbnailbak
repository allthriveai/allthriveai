/**
 * useThriveCircle Hook
 * Manages Thrive Circle tier status, point activities, and point awards
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMyThriveCircleStatus, awardPoints, getMyPointActivities, getMyWeeklyGoals, getCircleProjects } from '@/services/thriveCircle';
import type { AwardPointsRequest } from '@/types/models';
import { useAuth } from './useAuth';

export function useThriveCircle() {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  // Fetch tier status and recent activities
  const {
    data: thriveCircleStatus,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['thrive-circle', 'my-status'],
    queryFn: getMyThriveCircleStatus,
    enabled: isAuthenticated, // Only fetch when authenticated
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });

  // Fetch all point activities
  const {
    data: allActivities,
    isLoading: isLoadingActivities,
  } = useQuery({
    queryKey: ['point-activities'],
    queryFn: getMyPointActivities,
    enabled: isAuthenticated, // Only fetch when authenticated
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });

  // Fetch weekly goals (Phase 2)
  const {
    data: weeklyGoals,
    isLoading: isLoadingWeeklyGoals,
  } = useQuery({
    queryKey: ['weekly-goals'],
    queryFn: getMyWeeklyGoals,
    enabled: isAuthenticated, // Only fetch when authenticated
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });

  // Fetch circle projects (projects from same tier members)
  const {
    data: circleProjects,
    isLoading: isLoadingCircleProjects,
  } = useQuery({
    queryKey: ['circle-projects'],
    queryFn: () => getCircleProjects(10),
    enabled: isAuthenticated, // Only fetch when authenticated
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });

  // Award points mutation
  const awardPointsMutation = useMutation({
    mutationFn: (request: AwardPointsRequest) => awardPoints(request),
    onSuccess: (data) => {
      // Invalidate and refetch tier status, activities, and weekly goals
      queryClient.invalidateQueries({ queryKey: ['thrive-circle', 'my-status'] });
      queryClient.invalidateQueries({ queryKey: ['point-activities'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-goals'] });

      // Show tier upgrade notification if applicable
      if (data.tierUpgraded && data.newTier) {
        // You can dispatch a custom event here for global toast notifications
        window.dispatchEvent(
          new CustomEvent('tier-upgraded', {
            detail: {
              oldTier: data.oldTier,
              newTier: data.newTier,
              totalPoints: data.tierStatus.totalPoints,
            },
          })
        );
      }
    },
  });

  return {
    // Data
    tierStatus: thriveCircleStatus?.tierStatus,
    recentActivities: thriveCircleStatus?.recentActivities || [],
    allActivities: allActivities || [],
    weeklyGoals: weeklyGoals || [],
    circleProjects: circleProjects || [],

    // Loading states
    isLoading,
    isLoadingActivities,
    isLoadingWeeklyGoals,
    isLoadingCircleProjects,

    // Error
    error,

    // Actions
    awardPoints: awardPointsMutation.mutate,
    isAwardingPoints: awardPointsMutation.isPending,
    refetch,
  };
}
