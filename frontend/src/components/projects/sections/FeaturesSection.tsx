/**
 * FeaturesSection - Visual grid of key features with icons
 *
 * Supports inline editing when isEditing=true for owners.
 */

import { useCallback } from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { InlineEditableTitle, InlineEditableText } from '../shared/InlineEditable';
import type { FeaturesSectionContent, Feature } from '@/types/sections';

interface FeaturesSectionProps {
  content: FeaturesSectionContent;
  isEditing?: boolean;
  onUpdate?: (content: FeaturesSectionContent) => void;
}

interface FeatureCardProps {
  feature: Feature;
  index: number;
  isEditing?: boolean;
  onUpdate?: (index: number, feature: Feature) => void;
  onDelete?: (index: number) => void;
}

function FeatureCard({ feature, index, isEditing, onUpdate, onDelete }: FeatureCardProps) {
  const { icon, title, description } = feature;

  // Check if icon is an emoji (starts with common emoji ranges)
  const isEmoji = /^\p{Emoji}/u.test(icon);

  const handleIconChange = useCallback(
    async (newIcon: string) => {
      if (onUpdate) {
        onUpdate(index, { ...feature, icon: newIcon });
      }
    },
    [index, feature, onUpdate]
  );

  const handleTitleChange = useCallback(
    async (newTitle: string) => {
      if (onUpdate) {
        onUpdate(index, { ...feature, title: newTitle });
      }
    },
    [index, feature, onUpdate]
  );

  const handleDescriptionChange = useCallback(
    async (newDescription: string) => {
      if (onUpdate) {
        onUpdate(index, { ...feature, description: newDescription });
      }
    },
    [index, feature, onUpdate]
  );

  return (
    <div className="group relative bg-white dark:bg-gray-800/50 rounded-xl p-6 border border-gray-200 dark:border-gray-700/50 hover:border-primary-500/50 dark:hover:border-primary-500/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      {/* Delete button for editing mode */}
      {isEditing && onDelete && (
        <button
          onClick={() => onDelete(index)}
          className="absolute -top-2 -right-2 z-10 p-1.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Delete feature"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      )}

      {/* Icon */}
      <div className="mb-4">
        {isEditing ? (
          <InlineEditableText
            value={icon}
            isEditable={true}
            onChange={handleIconChange}
            placeholder="🚀"
            className="text-4xl"
            showEditIcon={false}
          />
        ) : isEmoji ? (
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
      {isEditing ? (
        <InlineEditableTitle
          value={title}
          isEditable={true}
          onChange={handleTitleChange}
          placeholder="Feature title..."
          className="text-lg font-semibold text-gray-900 dark:text-white mb-2"
          as="h4"
        />
      ) : (
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
          {title}
        </h4>
      )}

      {/* Description */}
      {isEditing ? (
        <InlineEditableText
          value={description}
          isEditable={true}
          onChange={handleDescriptionChange}
          placeholder="Describe this feature..."
          className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed"
          multiline
          rows={2}
        />
      ) : (
        <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
          {description}
        </p>
      )}

      {/* Hover Accent */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

export function FeaturesSection({ content, isEditing, onUpdate }: FeaturesSectionProps) {
  const { features } = content;

  const handleFeatureUpdate = useCallback(
    (index: number, updatedFeature: Feature) => {
      if (onUpdate) {
        const newFeatures = [...features];
        newFeatures[index] = updatedFeature;
        onUpdate({ features: newFeatures });
      }
    },
    [features, onUpdate]
  );

  const handleFeatureDelete = useCallback(
    (index: number) => {
      if (onUpdate) {
        const newFeatures = features.filter((_, i) => i !== index);
        onUpdate({ features: newFeatures });
      }
    },
    [features, onUpdate]
  );

  const handleAddFeature = useCallback(() => {
    if (onUpdate) {
      const newFeature: Feature = {
        icon: '✨',
        title: 'New Feature',
        description: 'Describe this feature...',
      };
      onUpdate({ features: [...features, newFeature] });
    }
  }, [features, onUpdate]);

  // Allow empty features in edit mode so users can add them
  if ((!features || features.length === 0) && !isEditing) {
    return null;
  }

  // Determine grid columns based on feature count
  const featureCount = features?.length || 0;
  const gridCols =
    featureCount === 1 ? 'grid-cols-1' :
    featureCount === 2 ? 'grid-cols-1 md:grid-cols-2' :
    featureCount === 4 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' :
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
        {features?.map((feature, index) => (
          <FeatureCard
            key={index}
            feature={feature}
            index={index}
            isEditing={isEditing}
            onUpdate={handleFeatureUpdate}
            onDelete={handleFeatureDelete}
          />
        ))}

        {/* Add Feature Card (editing mode only) */}
        {isEditing && (
          <button
            onClick={handleAddFeature}
            className="flex flex-col items-center justify-center min-h-[160px] rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-primary-500 dark:hover:border-primary-500 text-gray-400 hover:text-primary-500 transition-colors"
          >
            <PlusIcon className="w-8 h-8 mb-2" />
            <span className="text-sm font-medium">Add Feature</span>
          </button>
        )}
      </div>
    </section>
  );
}
