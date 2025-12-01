/**
 * OverviewSection - Quick project summary with headline and metrics
 *
 * Supports inline editing when isEditing=true for owners.
 */

import { useCallback } from 'react';
import { marked } from 'marked';
import { sanitizeHtml } from '@/utils/sanitize';
import {
  StarIcon,
  ArrowDownTrayIcon,
  UserIcon,
  CodeBracketIcon,
  EyeIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { InlineEditableTitle, InlineEditableText } from '../shared/InlineEditable';
import type { OverviewSectionContent, Metric } from '@/types/sections';

interface OverviewSectionProps {
  content: OverviewSectionContent;
  isEditing?: boolean;
  onUpdate?: (content: OverviewSectionContent) => void;
}

const metricIcons: Record<Metric['icon'], React.ComponentType<{ className?: string }>> = {
  star: StarIconSolid,
  download: ArrowDownTrayIcon,
  user: UserIcon,
  code: CodeBracketIcon,
  fork: CodeBracketIcon,
  eye: EyeIcon,
  clock: ClockIcon,
};

export function OverviewSection({ content, isEditing, onUpdate }: OverviewSectionProps) {
  const { headline, description, metrics } = content;

  // Handle inline updates
  const handleHeadlineChange = useCallback(
    async (newHeadline: string) => {
      if (onUpdate) {
        onUpdate({ ...content, headline: newHeadline });
      }
    },
    [content, onUpdate]
  );

  const handleDescriptionChange = useCallback(
    async (newDescription: string) => {
      if (onUpdate) {
        onUpdate({ ...content, description: newDescription });
      }
    },
    [content, onUpdate]
  );

  // Allow empty content in edit mode so users can add content
  if (!headline && !description && !isEditing) {
    return null;
  }

  return (
    <section className="project-section" data-section-type="overview">
      {/* Section Header */}
      <div className="flex items-center gap-4 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Overview</h2>
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
      </div>

      {/* Content Card */}
      <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-900/50 rounded-2xl p-8 border border-gray-200 dark:border-gray-700/50">
        {/* Accent Line */}
        <div className="absolute top-0 left-8 right-8 h-1 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full" />

        {/* Headline - Inline editable for owners */}
        {isEditing ? (
          <InlineEditableTitle
            value={headline || ''}
            isEditable={true}
            onChange={handleHeadlineChange}
            placeholder="Add a headline..."
            className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4 leading-tight"
            as="h3"
          />
        ) : headline ? (
          <h3 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4 leading-tight">
            {headline}
          </h3>
        ) : null}

        {/* Description - Inline editable for owners */}
        {isEditing ? (
          <InlineEditableText
            value={description || ''}
            isEditable={true}
            onChange={handleDescriptionChange}
            placeholder="Add a description..."
            className="prose prose-lg dark:prose-invert max-w-none text-gray-600 dark:text-gray-300"
            multiline
            rows={4}
          />
        ) : description ? (
          <div
            className="prose prose-lg dark:prose-invert max-w-none text-gray-600 dark:text-gray-300"
            dangerouslySetInnerHTML={{
              __html: sanitizeHtml(marked.parse(description) as string)
            }}
          />
        ) : null}

        {/* Metrics */}
        {metrics && metrics.length > 0 && (
          <div className="flex flex-wrap gap-4 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700/50">
            {metrics.map((metric, index) => {
              const Icon = metricIcons[metric.icon] || StarIcon;
              return (
                <div
                  key={index}
                  className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700"
                >
                  <Icon className="w-5 h-5 text-primary-500" />
                  <span className="font-semibold text-gray-900 dark:text-white">{metric.value}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{metric.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
