/**
 * FeaturesSection - Visual grid of key features with FontAwesome icons
 *
 * Supports inline editing when isEditing=true for owners.
 * Features can be reordered via drag-and-drop in edit mode.
 */

import { useCallback, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PlusIcon } from '@heroicons/react/24/outline';
import { IconCard, type IconCardData } from '../shared/IconCard';
import type { FeaturesSectionContent, Feature } from '@/types/sections';

interface FeaturesSectionProps {
  content: FeaturesSectionContent;
  isEditing?: boolean;
  onUpdate?: (content: FeaturesSectionContent) => void;
}

// ============================================================================
// Sortable Feature Card Wrapper
// ============================================================================

interface SortableFeatureCardProps {
  id: string;
  feature: Feature;
  isEditing: boolean;
  onUpdate: (feature: Feature) => void;
  onDelete: () => void;
}

function SortableFeatureCard({
  id,
  feature,
  isEditing,
  onUpdate,
  onDelete,
}: SortableFeatureCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleChange = useCallback(
    (data: IconCardData) => {
      onUpdate({
        icon: data.icon,
        title: data.title,
        description: data.description,
      });
    },
    [onUpdate]
  );

  return (
    <div ref={setNodeRef} style={style}>
      <IconCard
        data={{
          icon: feature.icon,
          title: feature.title,
          description: feature.description,
        }}
        isEditing={isEditing}
        onChange={handleChange}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
    </div>
  );
}

export function FeaturesSection({ content, isEditing, onUpdate }: FeaturesSectionProps) {
  const { features } = content;
  const [activeFeature, setActiveFeature] = useState<Feature | null>(null);

  // Generate stable IDs for features (using index as fallback)
  const featureIds = features?.map((_, index) => `feature-${index}`) || [];

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const index = featureIds.indexOf(active.id as string);
    if (index !== -1 && features) {
      setActiveFeature(features[index]);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveFeature(null);

    if (over && active.id !== over.id && onUpdate && features) {
      const oldIndex = featureIds.indexOf(active.id as string);
      const newIndex = featureIds.indexOf(over.id as string);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newFeatures = [...features];
        const [movedFeature] = newFeatures.splice(oldIndex, 1);
        newFeatures.splice(newIndex, 0, movedFeature);
        onUpdate({ features: newFeatures });
      }
    }
  };

  const handleFeatureUpdate = useCallback(
    (index: number, updatedFeature: Feature) => {
      if (onUpdate && features) {
        const newFeatures = [...features];
        newFeatures[index] = updatedFeature;
        onUpdate({ features: newFeatures });
      }
    },
    [features, onUpdate]
  );

  const handleFeatureDelete = useCallback(
    (index: number) => {
      if (onUpdate && features) {
        const newFeatures = features.filter((_, i) => i !== index);
        onUpdate({ features: newFeatures });
      }
    },
    [features, onUpdate]
  );

  const handleAddFeature = useCallback(() => {
    if (onUpdate) {
      const newFeature: Feature = {
        icon: 'FaRocket',
        title: 'New Feature',
        description: 'Describe this feature...',
      };
      const updatedFeatures = [...(features || []), newFeature];
      onUpdate({ features: updatedFeatures });
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

  // Read-only mode (no drag-and-drop needed)
  if (!isEditing) {
    return (
      <section className="project-section" data-section-type="features">
        <div className="flex items-center gap-4 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Key Features</h2>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
        </div>
        <div className={`grid ${gridCols} gap-6`}>
          {features?.map((feature, index) => (
            <IconCard
              key={index}
              data={{
                icon: feature.icon,
                title: feature.title,
                description: feature.description,
              }}
              isEditing={false}
            />
          ))}
        </div>
      </section>
    );
  }

  // Edit mode with drag-and-drop
  return (
    <section className="project-section" data-section-type="features">
      {/* Section Header */}
      <div className="flex items-center gap-4 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Key Features</h2>
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
      </div>

      {/* Feature Grid with Drag-and-Drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={featureIds} strategy={rectSortingStrategy}>
          <div className={`grid ${gridCols} gap-6`}>
            {features?.map((feature, index) => (
              <SortableFeatureCard
                key={featureIds[index]}
                id={featureIds[index]}
                feature={feature}
                isEditing={true}
                onUpdate={(updatedFeature) => handleFeatureUpdate(index, updatedFeature)}
                onDelete={() => handleFeatureDelete(index)}
              />
            ))}

            {/* Add Feature Card */}
            <button
              onClick={handleAddFeature}
              className="flex flex-col items-center justify-center min-h-[160px] rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-primary-500 dark:hover:border-primary-500 text-gray-400 hover:text-primary-500 transition-colors"
            >
              <PlusIcon className="w-8 h-8 mb-2" />
              <span className="text-sm font-medium">Add Feature</span>
            </button>
          </div>
        </SortableContext>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeFeature ? (
            <div className="opacity-90 transform scale-105">
              <IconCard
                data={{
                  icon: activeFeature.icon,
                  title: activeFeature.title,
                  description: activeFeature.description,
                }}
                isEditing={false}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </section>
  );
}
