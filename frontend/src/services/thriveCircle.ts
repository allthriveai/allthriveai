/**
 * Thrive Circle API Service
 * Handles points, tier progression, and activity tracking
 */

import { api } from './api';
import type {
  ThriveCircleStatus,
  AwardPointsRequest,
  AwardPointsResponse,
  PointActivity,
  WeeklyGoal,
  SideQuest,
  UserSideQuest,
  QuestCategory,
  QuestCategoryProgress,
  Circle,
  Kudos,
  CreateKudosRequest,
  CircleActivityFeed,
} from '@/types/models';

/**
 * Get current user's tier status and recent point activities
 */
export async function getMyThriveCircleStatus(): Promise<ThriveCircleStatus> {
  const response = await api.get('/me/thrive-circle/my_status/');

  // Convert snake_case to camelCase
  return {
    tierStatus: {
      ...response.data,
      tierDisplay: response.data.tier_display,
      totalPoints: response.data.total_points,
      level: response.data.level,
      tier: response.data.tier,
      // Progress fields
      pointsToNextLevel: response.data.points_to_next_level,
      pointsToNextTier: response.data.points_to_next_tier,
      // Phase 2: Streak fields
      currentStreakDays: response.data.current_streak_days,
      longestStreakDays: response.data.longest_streak_days,
      lastActivityDate: response.data.last_activity_date,
      // Phase 2: Lifetime stats
      lifetimeQuizzesCompleted: response.data.lifetime_quizzes_completed,
      lifetimeProjectsCreated: response.data.lifetime_projects_created,
      lifetimeSideQuestsCompleted: response.data.lifetime_side_quests_completed,
      lifetimeCommentsPosted: response.data.lifetime_comments_posted,
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
 * Award points to the current user
 */
export async function awardPoints(request: AwardPointsRequest): Promise<AwardPointsResponse> {
  const response = await api.post('/me/thrive-circle/award_points/', {
    amount: request.amount,
    activity_type: request.activityType,
    description: request.description || '',
  });

  // Convert snake_case to camelCase
  return {
    tierStatus: {
      ...response.data.tier_status,
      tierDisplay: response.data.tier_status.tier_display,
      totalPoints: response.data.tier_status.total_points,
      level: response.data.tier_status.level,
      createdAt: response.data.tier_status.created_at,
      updatedAt: response.data.tier_status.updated_at,
    },
    pointActivity: {
      ...response.data.point_activity,
      activityType: response.data.point_activity.activity_type,
      activityTypeDisplay: response.data.point_activity.activity_type_display,
      tierAtTime: response.data.point_activity.tier_at_time,
      createdAt: response.data.point_activity.created_at,
    },
    tierUpgraded: response.data.tier_upgraded,
    oldTier: response.data.old_tier,
    newTier: response.data.new_tier,
  };
}

/**
 * Get all point activities for the current user
 */
export async function getMyPointActivities(): Promise<PointActivity[]> {
  const response = await api.get('/me/point-activities/');

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
    pointsReward: goal.points_reward,
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

/**
 * Get all available side quests
 *
 * @param filters Optional filters for topic, skill_level, and quest_type
 */
export async function getAvailableSideQuests(filters?: {
  topic?: string;
  skillLevel?: string;
  questType?: string;
}): Promise<SideQuest[]> {
  const params = new URLSearchParams();
  if (filters?.topic) params.append('topic', filters.topic);
  if (filters?.skillLevel) params.append('skill_level', filters.skillLevel);
  if (filters?.questType) params.append('quest_type', filters.questType);

  // Request all quests (default page_size is 10, we want all)
  params.append('page_size', '100');
  const url = `/me/side-quests/?${params.toString()}`;
  const response = await api.get(url);

  // Handle paginated response
  // Note: API interceptor already converts snake_case to camelCase
  const quests = response.data.results || response.data;

  return quests as SideQuest[];
}

/**
 * Get a specific side quest by ID
 */
export async function getSideQuest(questId: string): Promise<SideQuest> {
  const response = await api.get(`/me/side-quests/${questId}/`);
  // Note: API interceptor already converts snake_case to camelCase
  return response.data as SideQuest;
}

/**
 * Get current user's side quests (active and completed)
 */
export async function getMySideQuests(status?: string, limit: number = 50): Promise<UserSideQuest[]> {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  params.append('limit', limit.toString());

  const url = `/me/side-quests/my-quests/?${params.toString()}`;
  const response = await api.get(url);

  // Note: API interceptor already converts snake_case to camelCase
  return response.data as UserSideQuest[];
}

/**
 * Start (accept) a side quest
 */
export async function startSideQuest(questId: string): Promise<UserSideQuest> {
  const response = await api.post(`/me/side-quests/${questId}/start/`);
  // Note: API interceptor already converts snake_case to camelCase
  return response.data as UserSideQuest;
}

/**
 * Update progress on a side quest
 */
export async function updateSideQuestProgress(questId: string, increment: number = 1): Promise<UserSideQuest> {
  const response = await api.post(`/me/side-quests/${questId}/update-progress/`, {
    increment,
  });
  // Note: API interceptor already converts snake_case to camelCase
  return response.data as UserSideQuest;
}

/**
 * Manually complete a side quest
 */
export async function completeSideQuest(questId: string): Promise<UserSideQuest> {
  const response = await api.post(`/me/side-quests/${questId}/complete/`);
  // Note: API interceptor already converts snake_case to camelCase
  return response.data as UserSideQuest;
}

/**
 * Abandon (deactivate) an in-progress side quest
 */
export async function abandonSideQuest(questId: string): Promise<void> {
  await api.post(`/me/side-quests/${questId}/abandon/`);
}

/**
 * Get all quest categories
 */
export async function getQuestCategories(): Promise<QuestCategory[]> {
  const response = await api.get('/me/quest-categories/');
  // Handle paginated response
  // Note: API interceptor already converts snake_case to camelCase
  const categories = response.data.results || response.data;
  return categories as QuestCategory[];
}

/**
 * Get a specific quest category with its quests
 */
export async function getQuestCategory(slug: string): Promise<QuestCategory> {
  const response = await api.get(`/me/quest-categories/${slug}/`);
  // Note: API interceptor already converts snake_case to camelCase
  return response.data as QuestCategory;
}

/**
 * Get user's progress in a specific category
 */
export async function getQuestCategoryProgress(slug: string): Promise<QuestCategoryProgress> {
  const response = await api.get(`/me/quest-categories/${slug}/progress/`);
  // Note: API interceptor already converts snake_case to camelCase
  return response.data as QuestCategoryProgress;
}

/**
 * Get user's progress across all categories
 */
export async function getAllCategoryProgress(): Promise<Record<string, QuestCategoryProgress>> {
  const response = await api.get('/me/quest-categories/all_progress/');
  // Note: API interceptor already converts snake_case to camelCase
  return response.data as Record<string, QuestCategoryProgress>;
}

/**
 * Get daily quests for the current user
 * API returns {quest: SideQuest, progress: UserSideQuest}[] format
 */
export async function getDailyQuests(): Promise<SideQuest[]> {
  const response = await api.get('/me/side-quests/daily/');
  // Note: API interceptor already converts snake_case to camelCase
  // The daily endpoint returns [{quest: {...}, progress: {...}}, ...] format
  // Extract just the quest objects for the component
  return response.data.map((item: { quest: SideQuest }) => item.quest);
}

// =============================================================================
// Circle API - Community Micro-Groups
// =============================================================================

/**
 * Get current user's circle for this week
 * Returns circle details with members, challenge, and user's membership
 */
export async function getMyCircle(): Promise<Circle | null> {
  try {
    const response = await api.get('/me/circles/my-circle/');
    // API interceptor converts snake_case to camelCase
    return response.data as Circle;
  } catch (error: any) {
    // 404 means user is not in a circle this week
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Get activity feed for user's current circle
 */
export async function getCircleActivity(limit: number = 20): Promise<CircleActivityFeed | null> {
  try {
    const response = await api.get(`/me/circles/activity/?limit=${limit}`);
    return response.data as CircleActivityFeed;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Give kudos to a circle member
 */
export async function giveKudos(request: CreateKudosRequest): Promise<Kudos> {
  const response = await api.post('/me/circles/kudos/', {
    to_user_id: request.toUserId,
    kudos_type: request.kudosType,
    message: request.message || '',
    project_id: request.projectId || null,
  });
  return response.data as Kudos;
}

/**
 * Get kudos received by the current user
 */
export async function getKudosReceived(limit: number = 20, circleOnly: boolean = false): Promise<Kudos[]> {
  const params = new URLSearchParams();
  params.append('limit', limit.toString());
  if (circleOnly) params.append('circle_only', 'true');

  const response = await api.get(`/me/circles/kudos/received/?${params.toString()}`);
  return response.data as Kudos[];
}

/**
 * Get kudos given by the current user
 */
export async function getKudosGiven(limit: number = 20): Promise<Kudos[]> {
  const response = await api.get(`/me/circles/kudos/given/?limit=${limit}`);
  return response.data as Kudos[];
}

// =============================================================================
// Quest Tracking API
// =============================================================================

export interface TrackPageVisitResponse {
  tracked: boolean;
  completedQuests: Array<{
    id: string;
    title: string;
    pointsAwarded: number;
    categoryName: string | null;
  }>;
}

/**
 * Track a page visit for quest progress (guided quests)
 */
export async function trackPageVisit(pagePath: string, pageName?: string): Promise<TrackPageVisitResponse> {
  const response = await api.post('/me/side-quests/track-page-visit/', {
    page_path: pagePath,
    page_name: pageName || '',
  });
  return response.data as TrackPageVisitResponse;
}
