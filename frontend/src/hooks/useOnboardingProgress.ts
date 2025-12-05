import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';

export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  link: string;
  points: number;
}

export interface OnboardingProgress {
  checklist: ChecklistItem[];
  completed_count: number;
  total_count: number;
  progress_percentage: number;
  earned_points: number;
  total_points: number;
}

interface UseOnboardingProgressReturn {
  progress: OnboardingProgress | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  markExploreToolsComplete: () => void;
}

const EXPLORE_TOOLS_KEY = 'allthrive_explored_tools';

export function useOnboardingProgress(): UseOnboardingProgressReturn {
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await api.get('/me/onboarding-progress/');
      const data = response.data as OnboardingProgress;

      // Check if explore_tools was completed client-side
      const exploredTools = localStorage.getItem(EXPLORE_TOOLS_KEY) === 'true';

      // Update the explore_tools item if completed client-side
      const updatedChecklist = data.checklist.map(item => {
        if (item.id === 'explore_tools' && exploredTools) {
          return { ...item, completed: true };
        }
        return item;
      });

      // Recalculate counts if explore_tools was completed
      const completedCount = updatedChecklist.filter(item => item.completed).length;
      const earnedPoints = updatedChecklist
        .filter(item => item.completed)
        .reduce((sum, item) => sum + item.points, 0);

      setProgress({
        ...data,
        checklist: updatedChecklist,
        completed_count: completedCount,
        progress_percentage: Math.round((completedCount / data.total_count) * 100),
        earned_points: earnedPoints,
      });
    } catch (err) {
      console.error('Failed to fetch onboarding progress:', err);
      setError('Failed to load progress');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Mark explore_tools as complete (client-side tracking)
  const markExploreToolsComplete = useCallback(() => {
    localStorage.setItem(EXPLORE_TOOLS_KEY, 'true');

    // Update local state immediately
    setProgress(prev => {
      if (!prev) return prev;

      const updatedChecklist = prev.checklist.map(item => {
        if (item.id === 'explore_tools') {
          return { ...item, completed: true };
        }
        return item;
      });

      const completedCount = updatedChecklist.filter(item => item.completed).length;
      const earnedPoints = updatedChecklist
        .filter(item => item.completed)
        .reduce((sum, item) => sum + item.points, 0);

      return {
        ...prev,
        checklist: updatedChecklist,
        completed_count: completedCount,
        progress_percentage: Math.round((completedCount / prev.total_count) * 100),
        earned_points: earnedPoints,
      };
    });
  }, []);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  return {
    progress,
    isLoading,
    error,
    refetch: fetchProgress,
    markExploreToolsComplete,
  };
}
