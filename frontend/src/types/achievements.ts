export interface Achievement {
  id: number;
  key: string;
  name: string;
  description: string;
  icon: string;
  color_from: string;
  color_to: string;
  category: string;
  category_display: string;
  points: number;
  criteria_type: string;
  criteria_type_display: string;
  criteria_value: number;
  tracking_field: string;
  rarity: string;
  rarity_display: string;
  is_secret: boolean;
  order: number;
}

export interface UserAchievement {
  id: number;
  achievement: Achievement;
  earned_at: string;
  progress_at_unlock: number | null;
}

export interface AchievementProgress {
  id: number;
  achievement: Achievement;
  current_value: number;
  percentage: number;
  is_complete: boolean;
  last_updated: string;
}

export interface AchievementProgressData {
  [category: string]: AchievementProgressItem[];
}

export interface AchievementProgressItem extends Achievement {
  is_earned: boolean;
  earned_at: string | null;
  current_value: number;
  progress_percentage: number;
}
