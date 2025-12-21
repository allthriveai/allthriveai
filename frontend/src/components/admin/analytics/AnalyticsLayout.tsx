// Analytics Layout Component - Wrapper for all analytics pages with shared elements
import type { ReactNode } from 'react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { KPICard } from './KPICard';
import {
  UsersIcon,
  CpuChipIcon,
  FolderIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import type { OverviewMetrics, TimePeriod } from '@/types/analytics';

interface AnalyticsLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  overview: OverviewMetrics | null;
  days: TimePeriod;
  onDaysChange: (days: TimePeriod) => void;
  loading?: boolean;
  showKPIs?: boolean;
}

export function AnalyticsLayout({
  children,
  title,
  subtitle,
  overview,
  days,
  onDaysChange,
  loading = false,
  showKPIs = true,
}: AnalyticsLayoutProps) {
  if (loading) {
    return (
      <DashboardLayout>
        <AdminLayout>
          <div className="min-h-screen flex items-center justify-center">
            <div className="flex items-center gap-3 text-cyan-bright">
              <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-bright rounded-full animate-spin" />
              <span className="text-lg">Loading analytics...</span>
            </div>
          </div>
        </AdminLayout>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <AdminLayout>
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Header */}
          <header className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
              {title}
            </h1>
            {subtitle && (
              <p className="text-slate-400">{subtitle}</p>
            )}
          </header>

          {/* Time Period Selector */}
          <div className="mb-8 flex justify-end">
            <div className="glass-subtle p-1 inline-flex rounded-xl">
              {([7, 30, 90] as TimePeriod[]).map((d) => (
                <button
                  key={d}
                  onClick={() => onDaysChange(d)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                    days === d
                      ? 'bg-cyan-500/20 text-cyan-bright shadow-neon border border-cyan-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {d} Days
                </button>
              ))}
            </div>
          </div>

          {/* KPI Cards */}
          {showKPIs && overview && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              <KPICard
                icon={UsersIcon}
                title="Total Users"
                value={(overview.totalUsers ?? 0).toLocaleString()}
                subtitle={`${(overview.activeUsers ?? 0).toLocaleString()} active`}
                color="cyan"
              />
              <KPICard
                icon={CpuChipIcon}
                title="AI Cost"
                value={`$${(overview.totalAiCost ?? 0).toFixed(2)}`}
                subtitle={`Last ${days} days`}
                color="pink"
              />
              <KPICard
                icon={FolderIcon}
                title="Projects"
                value={(overview.totalProjects ?? 0).toLocaleString()}
                subtitle="Total created"
                color="teal"
              />
              <KPICard
                icon={SparklesIcon}
                title="Active Now"
                value={(overview.activeUsers ?? 0).toLocaleString()}
                subtitle="Online users"
                color="purple"
              />
            </div>
          )}

          {/* Page Content */}
          <div className="space-y-8">
            {children}
          </div>
        </div>
      </AdminLayout>
    </DashboardLayout>
  );
}
