// Activity Heatmap Component - Shows hourly activity across days of the week

interface ActivityHeatmapProps {
  data: number[][];
}

export function ActivityHeatmap({ data }: ActivityHeatmapProps) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const maxValue = Math.max(...data.flat(), 1);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Hour labels */}
        <div className="flex gap-1 mb-1 ml-12">
          {Array.from({ length: 24 }, (_, i) => (
            <div key={i} className="w-4 text-xs text-slate-500 text-center">
              {i % 4 === 0 ? i : ''}
            </div>
          ))}
        </div>

        {/* Heatmap rows */}
        {data.map((row, dayIndex) => (
          <div key={dayIndex} className="flex items-center gap-1 mb-1">
            <div className="w-10 text-xs text-slate-400 text-right pr-2">
              {days[dayIndex]}
            </div>
            {row.map((value, hourIndex) => {
              const intensity = value / maxValue;
              return (
                <div
                  key={hourIndex}
                  className="w-4 h-4 rounded-sm cursor-pointer hover:ring-1 hover:ring-cyan-400"
                  style={{
                    backgroundColor: `rgba(34, 211, 238, ${Math.max(0.1, intensity)})`,
                  }}
                  title={`${days[dayIndex]} ${hourIndex}:00 - ${value} actions`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
