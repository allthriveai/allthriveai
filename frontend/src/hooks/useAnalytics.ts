// Analytics Hooks - Shared data fetching hooks for admin analytics
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type {
  OverviewMetrics,
  UserGrowthMetrics,
  ContentMetrics,
  GuestBattleMetrics,
  TimeseriesDataPoint,
  AIBreakdown,
  EngagementOverview,
  EngagementHeatmap,
  EngagementFeatures,
  EngagementRetention,
  OnboardingStats,
  TimePeriod,
} from '@/types/analytics';

// Hook for fetching overview metrics (used on all pages for KPI cards)
export function useOverviewMetrics(days: TimePeriod) {
  const [data, setData] = useState<OverviewMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.get(`/admin/analytics/overview/?days=${days}`);
        setData(response.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to fetch overview metrics');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [days]);

  return { data, loading, error };
}

// Hook for user growth metrics
export function useUserGrowthMetrics(days: TimePeriod) {
  const [data, setData] = useState<UserGrowthMetrics | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [growthRes, timeseriesRes] = await Promise.all([
          api.get(`/admin/analytics/user-growth/?days=${days}`),
          api.get(`/admin/analytics/timeseries/?metric=users&days=${days}`),
        ]);
        setData(growthRes.data);
        setTimeseries(timeseriesRes.data.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to fetch user metrics');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [days]);

  return { data, timeseries, loading, error };
}

// Hook for AI usage metrics
export function useAIMetrics(days: TimePeriod) {
  const [breakdown, setBreakdown] = useState<AIBreakdown>({});
  const [timeseries, setTimeseries] = useState<TimeseriesDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [breakdownRes, timeseriesRes] = await Promise.all([
          api.get(`/admin/analytics/ai-breakdown/?type=feature&days=${days}`),
          api.get(`/admin/analytics/timeseries/?metric=ai_cost&days=${days}`),
        ]);
        setBreakdown(breakdownRes.data.breakdown);
        setTimeseries(timeseriesRes.data.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to fetch AI metrics');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [days]);

  return { breakdown, timeseries, loading, error };
}

// Hook for content metrics
export function useContentMetrics(days: TimePeriod) {
  const [data, setData] = useState<ContentMetrics | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [contentRes, timeseriesRes] = await Promise.all([
          api.get(`/admin/analytics/content/?days=${days}`),
          api.get(`/admin/analytics/timeseries/?metric=projects&days=${days}`),
        ]);
        setData(contentRes.data);
        setTimeseries(timeseriesRes.data.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to fetch content metrics');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [days]);

  return { data, timeseries, loading, error };
}

// Hook for guest battles metrics
export function useGuestBattlesMetrics(days: TimePeriod) {
  const [data, setData] = useState<GuestBattleMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.get(`/admin/analytics/guest-battles/?days=${days}`);
        setData(response.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to fetch battles metrics');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [days]);

  return { data, loading, error };
}

// Hook for engagement metrics
export function useEngagementMetrics(days: TimePeriod) {
  const [overview, setOverview] = useState<EngagementOverview | null>(null);
  const [heatmap, setHeatmap] = useState<EngagementHeatmap | null>(null);
  const [features, setFeatures] = useState<EngagementFeatures | null>(null);
  const [retention, setRetention] = useState<EngagementRetention | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [overviewRes, heatmapRes, featuresRes, retentionRes] = await Promise.all([
          api.get(`/admin/analytics/engagement/overview/?days=${days}`),
          api.get(`/admin/analytics/engagement/heatmap/?days=${days}`),
          api.get(`/admin/analytics/engagement/features/?days=${days}`),
          api.get(`/admin/analytics/engagement/retention/?days=${days}`),
        ]);
        setOverview(overviewRes.data);
        setHeatmap(heatmapRes.data);
        setFeatures(featuresRes.data);
        setRetention(retentionRes.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to fetch engagement metrics');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [days]);

  return { overview, heatmap, features, retention, loading, error };
}

// Hook for onboarding metrics
export function useOnboardingMetrics(days: TimePeriod) {
  const [data, setData] = useState<OnboardingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.get(`/admin/analytics/onboarding/?days=${days}`);
        // Transform snake_case keys to camelCase for frontend
        const rawData = response.data;
        setData({
          totalCompleted: rawData.total_completed,
          paths: rawData.paths,
          recent: rawData.recent.map((r: any) => ({
            username: r.username,
            path: r.path,
            pathLabel: r.path_label,
            completedAt: r.completed_at,
          })),
          timeseries: rawData.timeseries,
        });
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to fetch onboarding metrics');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [days]);

  return { data, loading, error };
}

// Hook for managing time period selection with URL params
export function useAnalyticsTimePeriod(defaultDays: TimePeriod = 30) {
  const [days, setDays] = useState<TimePeriod>(defaultDays);

  const handleSetDays = useCallback((newDays: TimePeriod) => {
    setDays(newDays);
  }, []);

  return { days, setDays: handleSetDays };
}
