/**
 * FeaturesSection - Visual grid of key features with icons
 */

import type { FeaturesSectionContent, Feature } from '@/types/sections';

interface FeaturesSectionProps {
  content: FeaturesSectionContent;
  isEditing?: boolean;
  onUpdate?: (content: FeaturesSectionContent) => void;
}

function FeatureCard({ feature }: { feature: Feature }) {
  const { icon, title, description } = feature;

  // Check if icon is an emoji (starts with common emoji ranges)
  const isEmoji = /^\p{Emoji}/u.test(icon);

  return (
    <div className="group relative bg-white dark:bg-gray-800/50 rounded-xl p-6 border border-gray-200 dark:border-gray-700/50 hover:border-primary-500/50 dark:hover:border-primary-500/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      {/* Icon */}
      <div className="mb-4">
        {isEmoji ? (
          <span className="text-4xl" role="img" aria-label={title}>
            {icon}
          </span>
        ) : (
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500/20 to-secondary-500/20 flex items-center justify-center">
            <span className="text-2xl text-primary-600 dark:text-primary-400">{icon}</span>
          </div>
        )}
      </div>

      {/* Title */}
      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
        {title}
      </h4>

      {/* Description */}
      <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
        {description}
      </p>

      {/* Hover Accent */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

export function FeaturesSection({ content, isEditing, onUpdate }: FeaturesSectionProps) {
  const { features } = content;

  if (!features || features.length === 0) {
    return null;
  }

  // Determine grid columns based on feature count
  const gridCols =
    features.length === 1 ? 'grid-cols-1' :
    features.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
    features.length === 4 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' :
    'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';

  return (
    <section className="project-section" data-section-type="features">
      {/* Section Header */}
      <div className="flex items-center gap-4 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Key Features</h2>
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
      </div>

      {/* Feature Grid */}
      <div className={`grid ${gridCols} gap-6`}>
        {features.map((feature, index) => (
          <FeatureCard key={index} feature={feature} />
        ))}
      </div>
    </section>
  );
}
