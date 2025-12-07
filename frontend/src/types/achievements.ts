export interface Achievement {
  id: number;
  key: string;
  name: string;
  description: string;
  icon: string;
  colorFrom: string;
  colorTo: string;
  category: string;
  categoryDisplay: string;
  points: number;
  criteriaType: string;
  criteriaTypeDisplay: string;
  criteriaValue: number;
  trackingField: string;
  rarity: string;
  rarityDisplay: string;
  isSecret: boolean;
  order: number;
}

export interface UserAchievement {
  id: number;
  achievement: Achievement;
  earnedAt: string;
  progressAtUnlock: number | null;
}

export interface AchievementProgress {
  id: number;
  achievement: Achievement;
  currentValue: number;
  percentage: number;
  isComplete: boolean;
  lastUpdated: string;
}

export interface AchievementProgressData {
  [category: string]: AchievementProgressItem[];
}

export interface AchievementProgressItem extends Achievement {
  isEarned: boolean;
  earnedAt: string | null;
  currentValue: number;
  progressPercentage: number;
}
