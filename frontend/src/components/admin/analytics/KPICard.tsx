// KPI Card Component - Large metric display cards for key performance indicators

interface KPICardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
  subtitle: string;
  color: 'cyan' | 'pink' | 'teal' | 'purple';
}

export function KPICard({ icon: Icon, title, value, subtitle, color }: KPICardProps) {
  const colorClasses = {
    cyan: 'text-cyan-neon border-cyan-500/30 bg-cyan-500/10',
    pink: 'text-pink-accent border-pink-500/30 bg-pink-500/10',
    teal: 'text-teal-400 border-teal-500/30 bg-teal-500/10',
    purple: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
  };

  return (
    <div className="glass-card p-6 hover:shadow-neon transition-all duration-300">
      <div className={`w-12 h-12 rounded-xl ${colorClasses[color]} flex items-center justify-center mb-4`}>
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-slate-400 text-sm font-medium mb-2">{title}</h3>
      <p className="text-3xl font-bold text-white mb-1">{value}</p>
      <p className="text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}
