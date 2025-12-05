/**
 * Analytics Event Tracking Utilities
 *
 * Centralized event tracking for key user interactions.
 * Makes it easy to understand what users enjoy about the platform.
 */

import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;

/**
 * Helper to safely track events (never throws)
 */
function track(eventName: string, properties?: Record<string, any>) {
  if (!POSTHOG_KEY) return;

  try {
    posthog.capture(eventName, properties);
  } catch (error) {
    console.error('Analytics tracking error:', error);
  }
}

// ============================================================================
// Page Views
// ============================================================================

export const analytics = {
  // Page navigation
  pageView: (pageName: string, properties?: Record<string, any>) => {
    track('page_view', {
      page_name: pageName,
      ...properties,
    });
  },

  // ============================================================================
  // Quest & Side Quest Interactions
  // ============================================================================

  questStarted: (questId: string, questTitle: string, category?: string) => {
    track('quest_started', {
      quest_id: questId,
      quest_title: questTitle,
      category,
    });
  },

  questCompleted: (questId: string, questTitle: string, category?: string, pointsEarned?: number) => {
    track('quest_completed', {
      quest_id: questId,
      quest_title: questTitle,
      category,
      points_earned: pointsEarned,
    });
  },

  questAbandoned: (questId: string, questTitle: string, progress?: number) => {
    track('quest_abandoned', {
      quest_id: questId,
      quest_title: questTitle,
      progress_percentage: progress,
    });
  },

  questTrayOpened: () => {
    track('quest_tray_opened');
  },

  questTrayClosed: () => {
    track('quest_tray_closed');
  },

  // ============================================================================
  // Project Interactions
  // ============================================================================

  projectViewed: (projectId: string, projectTitle: string, creatorUsername?: string) => {
    track('project_viewed', {
      project_id: projectId,
      project_title: projectTitle,
      creator_username: creatorUsername,
    });
  },

  projectCreated: (projectId: string, projectTitle: string, category?: string) => {
    track('project_created', {
      project_id: projectId,
      project_title: projectTitle,
      category,
    });
  },

  projectLiked: (projectId: string, projectTitle: string) => {
    track('project_liked', {
      project_id: projectId,
      project_title: projectTitle,
    });
  },

  projectUnliked: (projectId: string, projectTitle: string) => {
    track('project_unliked', {
      project_id: projectId,
      project_title: projectTitle,
    });
  },

  projectShared: (projectId: string, projectTitle: string, shareMethod?: string) => {
    track('project_shared', {
      project_id: projectId,
      project_title: projectTitle,
      share_method: shareMethod,
    });
  },

  // ============================================================================
  // Explore Page Interactions
  // ============================================================================

  exploreFilterChanged: (filterType: string, filterValue: string) => {
    track('explore_filter_changed', {
      filter_type: filterType,
      filter_value: filterValue,
    });
  },

  exploreSortChanged: (sortBy: string, sortOrder?: string) => {
    track('explore_sort_changed', {
      sort_by: sortBy,
      sort_order: sortOrder,
    });
  },

  exploreSearchUsed: (searchQuery: string, resultsCount?: number) => {
    track('explore_search_used', {
      search_query: searchQuery,
      results_count: resultsCount,
    });
  },

  // ============================================================================
  // Pricing & Subscription
  // ============================================================================

  pricingPageViewed: () => {
    track('pricing_page_viewed');
  },

  pricingPlanSelected: (planName: string, billingCycle: 'monthly' | 'annual', price?: number) => {
    track('pricing_plan_selected', {
      plan_name: planName,
      billing_cycle: billingCycle,
      price,
    });
  },

  checkoutStarted: (planName: string, billingCycle: 'monthly' | 'annual', price?: number) => {
    track('checkout_started', {
      plan_name: planName,
      billing_cycle: billingCycle,
      price,
    });
  },

  checkoutCompleted: (planName: string, billingCycle: 'monthly' | 'annual', price?: number) => {
    track('checkout_completed', {
      plan_name: planName,
      billing_cycle: billingCycle,
      price,
    });
  },

  subscriptionCanceled: (planName: string, reason?: string) => {
    track('subscription_canceled', {
      plan_name: planName,
      cancelation_reason: reason,
    });
  },

  // ============================================================================
  // Battle & Competition
  // ============================================================================

  battleStarted: (battleId: string, opponentUsername?: string) => {
    track('battle_started', {
      battle_id: battleId,
      opponent_username: opponentUsername,
    });
  },

  battleCompleted: (battleId: string, won: boolean, score?: number) => {
    track('battle_completed', {
      battle_id: battleId,
      won,
      score,
    });
  },

  // ============================================================================
  // Community & Social
  // ============================================================================

  profileViewed: (username: string, isOwnProfile: boolean) => {
    track('profile_viewed', {
      username,
      is_own_profile: isOwnProfile,
    });
  },

  userFollowed: (username: string) => {
    track('user_followed', {
      username,
    });
  },

  userUnfollowed: (username: string) => {
    track('user_unfollowed', {
      username,
    });
  },

  // ============================================================================
  // Onboarding & Auth
  // ============================================================================

  signUpStarted: (method?: 'email' | 'google' | 'github') => {
    track('sign_up_started', {
      method,
    });
  },

  signUpCompleted: (method?: 'email' | 'google' | 'github') => {
    track('sign_up_completed', {
      method,
    });
  },

  loginCompleted: (method?: 'email' | 'google' | 'github') => {
    track('login_completed', {
      method,
    });
  },

  onboardingStepCompleted: (stepNumber: number, stepName: string) => {
    track('onboarding_step_completed', {
      step_number: stepNumber,
      step_name: stepName,
    });
  },

  onboardingCompleted: () => {
    track('onboarding_completed');
  },

  // ============================================================================
  // Feature Discovery
  // ============================================================================

  featureDiscovered: (featureName: string, discoveryMethod?: string) => {
    track('feature_discovered', {
      feature_name: featureName,
      discovery_method: discoveryMethod,
    });
  },

  tooltipViewed: (tooltipName: string) => {
    track('tooltip_viewed', {
      tooltip_name: tooltipName,
    });
  },

  // ============================================================================
  // Settings & Preferences
  // ============================================================================

  settingsChanged: (settingName: string, newValue: any, oldValue?: any) => {
    track('settings_changed', {
      setting_name: settingName,
      new_value: newValue,
      old_value: oldValue,
    });
  },

  // ============================================================================
  // About & Help
  // ============================================================================

  aboutPageViewed: () => {
    track('about_page_viewed');
  },

  aboutPanelOpened: () => {
    track('about_panel_opened');
  },

  helpRequested: (helpTopic?: string) => {
    track('help_requested', {
      help_topic: helpTopic,
    });
  },

  // ============================================================================
  // User Identification (call after login)
  // ============================================================================

  identifyUser: (userId: string, traits?: {
    email?: string;
    username?: string;
    role?: string;
    tier?: string;
    createdAt?: string;
    totalPoints?: number;
  }) => {
    if (!POSTHOG_KEY) return;

    try {
      posthog.identify(userId, traits);
    } catch (error) {
      console.error('User identification error:', error);
    }
  },

  // ============================================================================
  // Reset (call after logout)
  // ============================================================================

  reset: () => {
    if (!POSTHOG_KEY) return;

    try {
      posthog.reset();
    } catch (error) {
      console.error('Analytics reset error:', error);
    }
  },
};
