/**
 * useThriveCircle Hook
 * Manages Thrive Circle tier status, point activities, circles, and kudos
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMyThriveCircleStatus,
  awardPoints,
  getMyPointActivities,
  getMyWeeklyGoals,
  getCircleProjects,
  getMyCircle,
  getCircleActivity,
  giveKudos,
  getKudosReceived,
} from '@/services/thriveCircle';
import type { AwardPointsRequest, CreateKudosRequest } from '@/types/models';
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

  // Fetch user's current circle
  const {
    data: myCircle,
    isLoading: isLoadingCircle,
  } = useQuery({
    queryKey: ['my-circle'],
    queryFn: getMyCircle,
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });

  // Fetch circle activity feed
  const {
    data: circleActivity,
    isLoading: isLoadingCircleActivity,
  } = useQuery({
    queryKey: ['circle-activity'],
    queryFn: () => getCircleActivity(20),
    enabled: isAuthenticated && !!myCircle, // Only fetch if user has a circle
    staleTime: 1000 * 60 * 2, // 2 minutes (activity is more dynamic)
    retry: 1,
  });

  // Fetch kudos received
  const {
    data: kudosReceived,
    isLoading: isLoadingKudos,
  } = useQuery({
    queryKey: ['kudos-received'],
    queryFn: () => getKudosReceived(20, true), // Current circle only
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 2,
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

  // Give kudos mutation
  const giveKudosMutation = useMutation({
    mutationFn: (request: CreateKudosRequest) => giveKudos(request),
    onSuccess: () => {
      // Invalidate circle activity and kudos
      queryClient.invalidateQueries({ queryKey: ['circle-activity'] });
      queryClient.invalidateQueries({ queryKey: ['kudos-received'] });
      queryClient.invalidateQueries({ queryKey: ['my-circle'] });
    },
  });

  return {
    // Data
    tierStatus: thriveCircleStatus?.tierStatus,
    recentActivities: thriveCircleStatus?.recentActivities || [],
    allActivities: allActivities || [],
    weeklyGoals: weeklyGoals || [],
    circleProjects: circleProjects || [],

    // Circle data
    myCircle: myCircle || null,
    circleActivity: circleActivity || null,
    kudosReceived: kudosReceived || [],

    // Loading states
    isLoading,
    isLoadingActivities,
    isLoadingWeeklyGoals,
    isLoadingCircleProjects,
    isLoadingCircle,
    isLoadingCircleActivity,
    isLoadingKudos,

    // Error
    error,

    // Actions
    awardPoints: awardPointsMutation.mutate,
    isAwardingPoints: awardPointsMutation.isPending,
    giveKudos: giveKudosMutation.mutate,
    isGivingKudos: giveKudosMutation.isPending,
    refetch,
  };
}
