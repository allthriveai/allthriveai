// Metric Card Component - Smaller metric display cards
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: 'up' | 'down';
}

export function MetricCard({ title, value, subtitle, trend }: MetricCardProps) {
  return (
    <div className="glass-card p-6">
      <h4 className="text-slate-400 text-sm font-medium mb-2">{title}</h4>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-bold text-white">{value}</p>
        {trend && (
          trend === 'up' ? (
            <ArrowTrendingUpIcon className="w-5 h-5 text-green-400" />
          ) : (
            <ArrowTrendingDownIcon className="w-5 h-5 text-red-400" />
          )
        )}
      </div>
      {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
    </div>
  );
}
