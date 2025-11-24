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
  WeeklyGoal,
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
      // Phase 2: Streak fields
      currentStreakDays: response.data.tier_status.current_streak_days,
      longestStreakDays: response.data.tier_status.longest_streak_days,
      lastActivityDate: response.data.tier_status.last_activity_date,
      // Phase 2: Lifetime stats
      lifetimeQuizzesCompleted: response.data.tier_status.lifetime_quizzes_completed,
      lifetimeProjectsCreated: response.data.tier_status.lifetime_projects_created,
      lifetimeSideQuestsCompleted: response.data.tier_status.lifetime_side_quests_completed,
      lifetimeCommentsPosted: response.data.tier_status.lifetime_comments_posted,
      // Metadata
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

/**
 * Get weekly goals for the current user (Phase 2)
 */
export async function getMyWeeklyGoals(): Promise<WeeklyGoal[]> {
  const response = await api.get('/me/thrive-circle/weekly_goals/');

  // Convert snake_case to camelCase
  return response.data.map((goal: any) => ({
    ...goal,
    goalType: goal.goal_type,
    goalTypeDisplay: goal.goal_type_display,
    weekStart: goal.week_start,
    weekEnd: goal.week_end,
    currentProgress: goal.current_progress,
    targetProgress: goal.target_progress,
    progressPercentage: goal.progress_percentage,
    isCompleted: goal.is_completed,
    completedAt: goal.completed_at,
    xpReward: goal.xp_reward,
    createdAt: goal.created_at,
    updatedAt: goal.updated_at,
  }));
}

/**
 * Get recent projects from members in the same tier circle
 */
export async function getCircleProjects(limit: number = 10): Promise<any[]> {
  const response = await api.get(`/me/thrive-circle/circle-projects/?limit=${limit}`);
  return response.data;
}
