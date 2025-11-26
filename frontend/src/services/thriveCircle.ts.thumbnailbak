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
} from '@/types/models';

/**
 * Get current user's tier status and recent point activities
 */
export async function getMyThriveCircleStatus(): Promise<ThriveCircleStatus> {
  const response = await api.get('/me/thrive-circle/my_status/');

  // Convert snake_case to camelCase
  return {
    tierStatus: {
      ...response.data.tier_status,
      tierDisplay: response.data.tier_status.tier_display,
      totalPoints: response.data.tier_status.total_points,
      level: response.data.tier_status.level,
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

  const url = `/me/side-quests/${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await api.get(url);

  // Handle paginated response
  const quests = response.data.results || response.data;

  // Convert snake_case to camelCase
  return quests.map((quest: any) => ({
    ...quest,
    questType: quest.quest_type,
    questTypeDisplay: quest.quest_type_display,
    difficultyDisplay: quest.difficulty_display,
    topicDisplay: quest.topic_display,
    skillLevel: quest.skill_level,
    skillLevelDisplay: quest.skill_level_display,
    pointsReward: quest.points_reward,
    isActive: quest.is_active,
    isAvailable: quest.is_available,
    startsAt: quest.starts_at,
    expiresAt: quest.expires_at,
    createdAt: quest.created_at,
    updatedAt: quest.updated_at,
  }));
}

/**
 * Get a specific side quest by ID
 */
export async function getSideQuest(questId: string): Promise<SideQuest> {
  const response = await api.get(`/me/side-quests/${questId}/`);

  // Convert snake_case to camelCase
  return {
    ...response.data,
    questType: response.data.quest_type,
    questTypeDisplay: response.data.quest_type_display,
    difficultyDisplay: response.data.difficulty_display,
    topicDisplay: response.data.topic_display,
    skillLevel: response.data.skill_level,
    skillLevelDisplay: response.data.skill_level_display,
    xpReward: response.data.xp_reward,
    isActive: response.data.is_active,
    isAvailable: response.data.is_available,
    startsAt: response.data.starts_at,
    expiresAt: response.data.expires_at,
    createdAt: response.data.created_at,
    updatedAt: response.data.updated_at,
  };
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

  // Convert snake_case to camelCase
  return response.data.map((userQuest: any) => ({
    ...userQuest,
    sideQuest: {
      ...userQuest.side_quest,
      questType: userQuest.side_quest.quest_type,
      questTypeDisplay: userQuest.side_quest.quest_type_display,
      difficultyDisplay: userQuest.side_quest.difficulty_display,
      topicDisplay: userQuest.side_quest.topic_display,
      skillLevel: userQuest.side_quest.skill_level,
      skillLevelDisplay: userQuest.side_quest.skill_level_display,
      pointsReward: userQuest.side_quest.points_reward,
      isActive: userQuest.side_quest.is_active,
      isAvailable: userQuest.side_quest.is_available,
      startsAt: userQuest.side_quest.starts_at,
      expiresAt: userQuest.side_quest.expires_at,
      createdAt: userQuest.side_quest.created_at,
      updatedAt: userQuest.side_quest.updated_at,
    },
    sideQuestId: userQuest.side_quest_id,
    statusDisplay: userQuest.status_display,
    currentProgress: userQuest.current_progress,
    targetProgress: userQuest.target_progress,
    progressPercentage: userQuest.progress_percentage,
    progressData: userQuest.progress_data,
    isCompleted: userQuest.is_completed,
    completedAt: userQuest.completed_at,
    pointsAwarded: userQuest.points_awarded,
    startedAt: userQuest.started_at,
    updatedAt: userQuest.updated_at,
  }));
}

/**
 * Start (accept) a side quest
 */
export async function startSideQuest(questId: string): Promise<UserSideQuest> {
  const response = await api.post(`/me/side-quests/${questId}/start/`);

  // Convert snake_case to camelCase
  return {
    ...response.data,
    sideQuest: {
      ...response.data.side_quest,
      questType: response.data.side_quest.quest_type,
      questTypeDisplay: response.data.side_quest.quest_type_display,
      difficultyDisplay: response.data.side_quest.difficulty_display,
      topicDisplay: response.data.side_quest.topic_display,
      skillLevel: response.data.side_quest.skill_level,
      skillLevelDisplay: response.data.side_quest.skill_level_display,
      pointsReward: response.data.side_quest.points_reward,
      isActive: response.data.side_quest.is_active,
      isAvailable: response.data.side_quest.is_available,
      startsAt: response.data.side_quest.starts_at,
      expiresAt: response.data.side_quest.expires_at,
      createdAt: response.data.side_quest.created_at,
      updatedAt: response.data.side_quest.updated_at,
    },
    statusDisplay: response.data.status_display,
    currentProgress: response.data.current_progress,
    targetProgress: response.data.target_progress,
    progressPercentage: response.data.progress_percentage,
    progressData: response.data.progress_data,
    isCompleted: response.data.is_completed,
    completedAt: response.data.completed_at,
    pointsAwarded: response.data.points_awarded,
    startedAt: response.data.started_at,
    updatedAt: response.data.updated_at,
  };
}

/**
 * Update progress on a side quest
 */
export async function updateSideQuestProgress(questId: string, increment: number = 1): Promise<UserSideQuest> {
  const response = await api.post(`/me/side-quests/${questId}/update-progress/`, {
    increment,
  });

  // Convert snake_case to camelCase
  return {
    ...response.data,
    sideQuest: {
      ...response.data.side_quest,
      questType: response.data.side_quest.quest_type,
      questTypeDisplay: response.data.side_quest.quest_type_display,
      difficultyDisplay: response.data.side_quest.difficulty_display,
      topicDisplay: response.data.side_quest.topic_display,
      skillLevel: response.data.side_quest.skill_level,
      skillLevelDisplay: response.data.side_quest.skill_level_display,
      pointsReward: response.data.side_quest.points_reward,
      isActive: response.data.side_quest.is_active,
      isAvailable: response.data.side_quest.is_available,
      startsAt: response.data.side_quest.starts_at,
      expiresAt: response.data.side_quest.expires_at,
      createdAt: response.data.side_quest.created_at,
      updatedAt: response.data.side_quest.updated_at,
    },
    statusDisplay: response.data.status_display,
    currentProgress: response.data.current_progress,
    targetProgress: response.data.target_progress,
    progressPercentage: response.data.progress_percentage,
    progressData: response.data.progress_data,
    isCompleted: response.data.is_completed,
    completedAt: response.data.completed_at,
    pointsAwarded: response.data.points_awarded,
    startedAt: response.data.started_at,
    updatedAt: response.data.updated_at,
  };
}

/**
 * Manually complete a side quest
 */
export async function completeSideQuest(questId: string): Promise<UserSideQuest> {
  const response = await api.post(`/me/side-quests/${questId}/complete/`);

  // Convert snake_case to camelCase
  return {
    ...response.data,
    sideQuest: {
      ...response.data.side_quest,
      questType: response.data.side_quest.quest_type,
      questTypeDisplay: response.data.side_quest.quest_type_display,
      difficultyDisplay: response.data.side_quest.difficulty_display,
      topicDisplay: response.data.side_quest.topic_display,
      skillLevel: response.data.side_quest.skill_level,
      skillLevelDisplay: response.data.side_quest.skill_level_display,
      pointsReward: response.data.side_quest.points_reward,
      isActive: response.data.side_quest.is_active,
      isAvailable: response.data.side_quest.is_available,
      startsAt: response.data.side_quest.starts_at,
      expiresAt: response.data.side_quest.expires_at,
      createdAt: response.data.side_quest.created_at,
      updatedAt: response.data.side_quest.updated_at,
    },
    statusDisplay: response.data.status_display,
    currentProgress: response.data.current_progress,
    targetProgress: response.data.target_progress,
    progressPercentage: response.data.progress_percentage,
    progressData: response.data.progress_data,
    isCompleted: response.data.is_completed,
    completedAt: response.data.completed_at,
    pointsAwarded: response.data.points_awarded,
    startedAt: response.data.started_at,
    createdAt: response.data.created_at,
    updatedAt: response.data.updated_at,
  };
}
