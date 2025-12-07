import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';

export interface QuestItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  link: string;
  points: number;
  category: string;
  icon: string;
}

// Legacy alias
export type ChecklistItem = QuestItem;

export interface QuestCategory {
  title: string;
  icon: string;
  items: QuestItem[];
}

export interface OnboardingProgress {
  checklist: QuestItem[];
  categories: Record<string, QuestCategory>;
  completedCount: number;
  totalCount: number;
  progressPercentage: number;
  earnedPoints: number;
  totalPoints: number;
}

interface UseOnboardingProgressReturn {
  progress: OnboardingProgress | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  markQuestComplete: (questId: string) => void;
  // Legacy alias
  markExploreToolsComplete: () => void;
}

const QUEST_STORAGE_KEY = 'allthrive_completed_quests';
const EXPLORE_TOOLS_KEY = 'allthrive_explored_tools'; // Legacy

export function useOnboardingProgress(): UseOnboardingProgressReturn {
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get client-side completed quests from localStorage
  const getClientCompletedQuests = useCallback((): Set<string> => {
    try {
      const stored = localStorage.getItem(QUEST_STORAGE_KEY);
      if (stored) {
        return new Set(JSON.parse(stored));
      }
      // Migrate legacy explore_tools key
      if (localStorage.getItem(EXPLORE_TOOLS_KEY) === 'true') {
        return new Set(['explore_tools']);
      }
    } catch (e) {
      console.error('Failed to load client quests:', e);
    }
    return new Set();
  }, []);

  const fetchProgress = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await api.get('/me/onboarding-progress/');
      const data = response.data as OnboardingProgress;

      // Get client-side completed quests
      const clientCompleted = getClientCompletedQuests();

      // Update items that are tracked client-side
      const clientTrackedQuests = ['explore_tools', 'install_extension'];
      const updatedChecklist = data.checklist.map(item => {
        if (clientTrackedQuests.includes(item.id) && clientCompleted.has(item.id)) {
          return { ...item, completed: true };
        }
        return item;
      });

      // Update categories with client-side completions
      const updatedCategories = { ...data.categories };
      for (const catKey of Object.keys(updatedCategories)) {
        updatedCategories[catKey] = {
          ...updatedCategories[catKey],
          items: updatedCategories[catKey].items.map(item => {
            if (clientTrackedQuests.includes(item.id) && clientCompleted.has(item.id)) {
              return { ...item, completed: true };
            }
            return item;
          }),
        };
      }

      // Recalculate counts
      const completedCount = updatedChecklist.filter(item => item.completed).length;
      const earnedPoints = updatedChecklist
        .filter(item => item.completed)
        .reduce((sum, item) => sum + item.points, 0);

      setProgress({
        ...data,
        checklist: updatedChecklist,
        categories: updatedCategories,
        completedCount: completedCount,
        progressPercentage: Math.round((completedCount / data.totalCount) * 100),
        earnedPoints: earnedPoints,
      });
    } catch (err) {
      console.error('Failed to fetch quest progress:', err);
      setError('Failed to load progress');
    } finally {
      setIsLoading(false);
    }
  }, [getClientCompletedQuests]);

  // Mark a quest as complete (client-side tracking)
  const markQuestComplete = useCallback((questId: string) => {
    // Save to localStorage
    const clientCompleted = getClientCompletedQuests();
    clientCompleted.add(questId);
    localStorage.setItem(QUEST_STORAGE_KEY, JSON.stringify([...clientCompleted]));

    // Update local state immediately
    setProgress(prev => {
      if (!prev) return prev;

      const updatedChecklist = prev.checklist.map(item => {
        if (item.id === questId) {
          return { ...item, completed: true };
        }
        return item;
      });

      // Update categories
      const updatedCategories = { ...prev.categories };
      for (const catKey of Object.keys(updatedCategories)) {
        updatedCategories[catKey] = {
          ...updatedCategories[catKey],
          items: updatedCategories[catKey].items.map(item => {
            if (item.id === questId) {
              return { ...item, completed: true };
            }
            return item;
          }),
        };
      }

      const completedCount = updatedChecklist.filter(item => item.completed).length;
      const earnedPoints = updatedChecklist
        .filter(item => item.completed)
        .reduce((sum, item) => sum + item.points, 0);

      return {
        ...prev,
        checklist: updatedChecklist,
        categories: updatedCategories,
        completedCount: completedCount,
        progressPercentage: Math.round((completedCount / prev.totalCount) * 100),
        earnedPoints: earnedPoints,
      };
    });
  }, [getClientCompletedQuests]);

  // Legacy alias
  const markExploreToolsComplete = useCallback(() => {
    markQuestComplete('explore_tools');
  }, [markQuestComplete]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  return {
    progress,
    isLoading,
    error,
    refetch: fetchProgress,
    markQuestComplete,
    markExploreToolsComplete,
  };
}
