// Analytics Types - Shared type definitions for admin analytics pages

export interface OverviewMetrics {
  totalUsers: number;
  activeUsers: number;
  totalAiCost: number;
  totalProjects: number;
}

export interface UserGrowthMetrics {
  totalUsers: number;
  newUsers: number;
  avgDau: number;
  avgMau: number;
  growthRate: number;
  stickiness: number;
}

export interface ContentMetrics {
  totalProjects: number;
  totalViews: number;
  totalClicks: number;
  totalComments: number;
  engagementRate: number;
}

export interface ConversionFunnel {
  invited: number;
  joinedBattle: number;
  converted: number;
  rates: {
    inviteToJoin: number;
    joinToConvert: number;
    overallConversion: number;
  };
}

export interface GuestBattleMetrics {
  totalGuests: number;
  currentGuests: number;
  guestsConverted: number;
  conversionRate: number;
  allTimeConversionRate: number;
  battlesWithGuests: number;
  totalBattles: number;
  guestBattlePercentage: number;
  guestWins: number;
  guestLosses: number;
  guestTies: number;
  recentGuests: Array<{ id: number; username: string; dateJoined: string }>;
  conversionFunnel: ConversionFunnel;
}

export interface TimeseriesDataPoint {
  date: string;
  value: number;
}

export interface AIBreakdown {
  [key: string]: {
    requests: number;
    cost: number;
  };
}

export interface EngagementOverview {
  totalActions: number;
  uniqueActiveUsers: number;
  peakHour: number;
  d7RetentionRate: number;
}

export interface EngagementHeatmap {
  heatmap: number[][];
  dailyActions: Array<{ date: string; count: number }>;
  peakHour: number;
  peakDay: string;
  totalActions: number;
}

export interface EngagementFeature {
  name: string;
  activityType: string;
  uniqueUsers: number;
  totalActions: number;
  trend: number;
}

export interface EngagementFeatures {
  features: EngagementFeature[];
  topFeature: string | null;
  totalUniqueUsers: number;
}

export interface EngagementRetention {
  funnel: {
    signedUp: number;
    hadFirstAction: number;
    returnedDay7: number;
    returnedDay30: number;
  };
  funnelRates: {
    signupToAction: number;
    actionToDay7: number;
    day7ToDay30: number;
  };
  retentionCohorts: Array<{
    cohortWeek: string;
    size: number;
    [key: string]: number | string;
  }>;
}

export interface OnboardingPath {
  count: number;
  percentage: number;
  label: string;
}

export interface OnboardingRecent {
  username: string;
  path: string;
  pathLabel: string;
  completedAt: string;
}

export interface OnboardingTimeseries {
  date: string;
  battle_pip: number;
  add_project: number;
  explore: number;
}

export interface OnboardingStats {
  totalCompleted: number;
  paths: Record<string, OnboardingPath>;
  recent: OnboardingRecent[];
  timeseries: OnboardingTimeseries[];
}

// Analytics navigation items
export interface AnalyticsNavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Time period options
export type TimePeriod = 7 | 30 | 90;
