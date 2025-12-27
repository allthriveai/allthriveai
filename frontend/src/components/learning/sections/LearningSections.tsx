/**
 * LearningSections - Main container with DnD for organizing learning path topics
 *
 * This component renders all learning sections with drag-and-drop reordering.
 * It follows the patterns from ProfileSectionRenderer for DnD.
 */

import { useState, useCallback, useMemo } from 'react';
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { PlusIcon, PencilIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useLearningSectionEditor } from '@/context/LearningSectionEditorContext';
import { SortableLearningSection } from './SortableLearningSection';
import { LearningSectionCard } from './LearningSectionCard';
import { AddSectionButton } from './AddSectionButton';
import { UnsortedTopicsSection } from './UnsortedTopicsSection';
import {
  buildTopicProgressMap,
  getUnsortedTopics,
} from '@/utils/learningSectionProgress';

export function LearningSections() {
  const {
    sectionsOrganization,
    topicSections,
    isLoading,
    error,
    isEditing,
    setIsEditing,
    reorderSections,
    isSaving,
    initializeDefaultSections,
  } = useLearningSectionEditor();

  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  // Build topic progress map for progress calculations
  const topicProgressMap = useMemo(
    () => buildTopicProgressMap(topicSections),
    [topicSections]
  );

  // Build topic data lookup map
  const topicMap = useMemo(
    () => Object.fromEntries(topicSections.map((t) => [t.slug, t])),
    [topicSections]
  );

  // Get sections to display
  const sections = sectionsOrganization?.sections ?? [];
  const sectionIds = sections.map((s) => s.id);

  // Find active section for drag overlay
  const activeSection = sections.find((s) => s.id === activeSectionId);

  // Get unsorted topics (not in any section)
  const unsortedTopics = useMemo(
    () => getUnsortedTopics(sections, topicSections),
    [sections, topicSections]
  );

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

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveSectionId(event.active.id.toString());
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveSectionId(null);

      if (over && active.id !== over.id) {
        const oldIndex = sections.findIndex((s) => s.id === active.id);
        const newIndex = sections.findIndex((s) => s.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          reorderSections(oldIndex, newIndex);
        }
      }
    },
    [sections, reorderSections]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  // No sections yet - show "Organize" prompt
  if (!sectionsOrganization || sections.length === 0) {
    return (
      <div className="text-center py-12 px-8">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Organize Your Learning Path
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
          Create custom sections to organize your topics. Drag and drop to
          reorder them as you like.
        </p>
        <button
          onClick={initializeDefaultSections}
          className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl font-medium transition-all duration-200
            bg-gradient-to-r from-cyan-500 to-blue-500
            text-white shadow-lg shadow-cyan-500/25
            hover:shadow-xl hover:shadow-cyan-500/30
            hover:scale-[1.02] active:scale-[0.98]"
        >
          <PlusIcon className="w-5 h-5" />
          Start Organizing
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Edit Mode Toggle */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setIsEditing(!isEditing)}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
            isEditing
              ? 'bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30'
              : 'bg-white/10 text-gray-600 dark:text-gray-300 border border-gray-300/30 dark:border-gray-600/30'
          }`}
        >
          {isEditing ? (
            <>
              <CheckIcon className="w-4 h-4" />
              Done
            </>
          ) : (
            <>
              <PencilIcon className="w-4 h-4" />
              Organize
            </>
          )}
          {isSaving && (
            <span className="ml-2 text-xs text-gray-500">Saving...</span>
          )}
        </button>
      </div>

      {/* Add Section at Top (editing mode) */}
      {isEditing && <AddSectionButton position="top" />}

      {/* Sections with drag-and-drop */}
      {isEditing ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sectionIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-4">
              {sections.map((section, index) => (
                <SortableLearningSection
                  key={section.id}
                  section={section}
                  index={index}
                  topicMap={topicMap}
                  topicProgressMap={topicProgressMap}
                />
              ))}
            </div>
          </SortableContext>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeSection ? (
              <div className="opacity-90 bg-gray-900/90 rounded-xl shadow-2xl p-4 border-2 border-cyan-500">
                <div className="text-sm font-medium text-cyan-400 mb-2">
                  Moving: {activeSection.title}
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="space-y-4">
          {sections.map((section) => (
            <LearningSectionCard
              key={section.id}
              section={section}
              topicMap={topicMap}
              topicProgressMap={topicProgressMap}
            />
          ))}
        </div>
      )}

      {/* Unsorted Topics (editing mode only) */}
      {isEditing && unsortedTopics.length > 0 && (
        <UnsortedTopicsSection topics={unsortedTopics} />
      )}

      {/* Add Section at Bottom (editing mode) */}
      {isEditing && <AddSectionButton position="bottom" />}
    </div>
  );
}
