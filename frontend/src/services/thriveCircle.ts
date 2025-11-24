/**
 * Thrive Circle API Service
 * Handles XP, tier progression, and activity tracking
 */

import { api } from './api';
import type {
  ThriveCircleStatus,
  AwardXPRequest,
  AwardXPResponse,
  XPActivity,
} from '@/types/models';

/**
 * Get current user's tier status and recent XP activities
 */
export async function getMyThriveCircleStatus(): Promise<ThriveCircleStatus> {
  const response = await api.get('/me/thrive-circle/my_status/');

  // Convert snake_case to camelCase
  return {
    tierStatus: {
      ...response.data.tier_status,
      tierDisplay: response.data.tier_status.tier_display,
      totalXp: response.data.tier_status.total_xp,
      createdAt: response.data.tier_status.created_at,
      updatedAt: response.data.tier_status.updated_at,
    },
    recentActivities: response.data.recent_activities.map((activity: any) => ({
      ...activity,
      activityType: activity.activity_type,
      activityTypeDisplay: activity.activity_type_display,
      tierAtTime: activity.tier_at_time,
      createdAt: activity.created_at,
    })),
  };
}

/**
 * Award XP to the current user
 */
export async function awardXP(request: AwardXPRequest): Promise<AwardXPResponse> {
  const response = await api.post('/me/thrive-circle/award_xp/', {
    amount: request.amount,
    activity_type: request.activityType,
    description: request.description || '',
  });

  // Convert snake_case to camelCase
  return {
    tierStatus: {
      ...response.data.tier_status,
      tierDisplay: response.data.tier_status.tier_display,
      totalXp: response.data.tier_status.total_xp,
      createdAt: response.data.tier_status.created_at,
      updatedAt: response.data.tier_status.updated_at,
    },
    xpActivity: {
      ...response.data.xp_activity,
      activityType: response.data.xp_activity.activity_type,
      activityTypeDisplay: response.data.xp_activity.activity_type_display,
      tierAtTime: response.data.xp_activity.tier_at_time,
      createdAt: response.data.xp_activity.created_at,
    },
    tierUpgraded: response.data.tier_upgraded,
    oldTier: response.data.old_tier,
    newTier: response.data.new_tier,
  };
}

/**
 * Get all XP activities for the current user
 */
export async function getMyXPActivities(): Promise<XPActivity[]> {
  const response = await api.get('/me/xp-activities/');

  // Handle paginated response
  const activities = response.data.results || response.data;

  // Convert snake_case to camelCase
  return activities.map((activity: any) => ({
    ...activity,
    activityType: activity.activity_type,
    activityTypeDisplay: activity.activity_type_display,
    tierAtTime: activity.tier_at_time,
    createdAt: activity.created_at,
  }));
}
