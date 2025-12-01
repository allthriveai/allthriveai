/**
 * GitHubLanguagesComponent - Language breakdown visualization
 */

import type { GitHubLanguagesComponent as GitHubLanguagesComponentType } from '@/types/components';

interface GitHubLanguagesComponentProps {
  component: GitHubLanguagesComponentType;
}

export function GitHubLanguagesComponent({ component }: GitHubLanguagesComponentProps) {
  const { data } = component;
  const { title, languages, variant } = data;

  // Sort languages by percentage
  const sortedLanguages = [...languages].sort((a, b) => b.percentage - a.percentage);

  // Bar variant - horizontal stacked bar
  if (variant === 'bar') {
    return (
      <section className="py-8">
        {title && (
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            {title}
          </h2>
        )}

        <div className="space-y-4">
          {/* Stacked bar */}
          <div className="h-4 rounded-full overflow-hidden flex">
            {sortedLanguages.map((lang, index) => (
              <div
                key={index}
                style={{
                  width: `${lang.percentage}%`,
                  backgroundColor: lang.color,
                }}
                className="first:rounded-l-full last:rounded-r-full"
                title={`${lang.name}: ${lang.percentage.toFixed(1)}%`}
              />
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4">
            {sortedLanguages.map((lang, index) => (
              <div key={index} className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: lang.color }}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {lang.name}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {lang.percentage.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Pie variant - donut chart
  if (variant === 'pie') {
    // Calculate SVG paths for donut chart
    const total = sortedLanguages.reduce((sum, lang) => sum + lang.percentage, 0);
    let currentAngle = -90; // Start from top
    const radius = 80;
    const innerRadius = 50;
    const center = 100;

    const paths = sortedLanguages.map((lang) => {
      const startAngle = currentAngle;
      const angle = (lang.percentage / total) * 360;
      currentAngle += angle;

      const startRad = (startAngle * Math.PI) / 180;
      const endRad = ((startAngle + angle) * Math.PI) / 180;

      const x1 = center + radius * Math.cos(startRad);
      const y1 = center + radius * Math.sin(startRad);
      const x2 = center + radius * Math.cos(endRad);
      const y2 = center + radius * Math.sin(endRad);
      const x3 = center + innerRadius * Math.cos(endRad);
      const y3 = center + innerRadius * Math.sin(endRad);
      const x4 = center + innerRadius * Math.cos(startRad);
      const y4 = center + innerRadius * Math.sin(startRad);

      const largeArc = angle > 180 ? 1 : 0;

      return {
        path: `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`,
        color: lang.color,
        name: lang.name,
        percentage: lang.percentage,
      };
    });

    return (
      <section className="py-8">
        {title && (
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            {title}
          </h2>
        )}

        <div className="flex flex-col md:flex-row items-center gap-8">
          {/* Donut Chart */}
          <div className="flex-shrink-0">
            <svg width="200" height="200" viewBox="0 0 200 200">
              {paths.map((segment, index) => (
                <path
                  key={index}
                  d={segment.path}
                  fill={segment.color}
                  className="hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <title>{`${segment.name}: ${segment.percentage.toFixed(1)}%`}</title>
                </path>
              ))}
            </svg>
          </div>

          {/* Legend */}
          <div className="flex-1 grid grid-cols-2 gap-3">
            {sortedLanguages.map((lang, index) => (
              <div key={index} className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: lang.color }}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                  {lang.name}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto">
                  {lang.percentage.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // List variant - detailed list view
  return (
    <section className="py-8">
      {title && (
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          {title}
        </h2>
      )}

      <div className="space-y-3">
        {sortedLanguages.map((lang, index) => (
          <div key={index} className="flex items-center gap-4">
            <span
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: lang.color }}
            />
            <span className="font-medium text-gray-900 dark:text-white min-w-[100px]">
              {lang.name}
            </span>
            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${lang.percentage}%`,
                  backgroundColor: lang.color,
                }}
              />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400 min-w-[60px] text-right">
              {lang.percentage.toFixed(1)}%
            </span>
            {lang.bytes !== undefined && (
              <span className="text-xs text-gray-400 dark:text-gray-500 min-w-[80px] text-right">
                {formatBytes(lang.bytes)}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
