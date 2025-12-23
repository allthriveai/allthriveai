// Retention Cohort Table Component - Shows weekly retention cohort data
import type { EngagementRetention } from '@/types/analytics';

interface RetentionCohortTableProps {
  cohorts: EngagementRetention['retentionCohorts'];
}

export function RetentionCohortTable({ cohorts }: RetentionCohortTableProps) {
  const weeks = ['week0', 'week1', 'week4'].filter((w) =>
    cohorts.some((c) => w in c)
  );

  const weekLabels: { [key: string]: string } = {
    week0: 'W0',
    week1: 'W1 (D7)',
    week4: 'W4 (D30)',
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left text-slate-400 py-3 px-4">Cohort Week</th>
            <th className="text-center text-slate-400 py-3 px-4">Size</th>
            {weeks.map((w) => (
              <th key={w} className="text-center text-slate-400 py-3 px-4">
                {weekLabels[w] || w}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((cohort) => (
            <tr key={cohort.cohortWeek} className="border-b border-slate-800/50">
              <td className="text-white py-3 px-4 font-medium">{cohort.cohortWeek}</td>
              <td className="text-center text-slate-300 py-3 px-4">{cohort.size}</td>
              {weeks.map((w) => {
                const value = cohort[w] as number | undefined;
                if (value === undefined) {
                  return <td key={w} className="text-center py-3 px-4 text-slate-600">-</td>;
                }
                const intensity = value / 100;
                return (
                  <td
                    key={w}
                    className="text-center py-3 px-4 font-medium"
                    style={{
                      backgroundColor: `rgba(34, 211, 238, ${intensity * 0.4})`,
                      color: intensity > 0.5 ? '#0f172a' : '#e2e8f0',
                    }}
                  >
                    {value}%
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
