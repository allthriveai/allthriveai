/**
 * SectionsEditorCanvas - Drag-and-drop canvas for editing project sections
 *
 * This is the main container that:
 * - Renders all sections in order
 * - Enables drag-and-drop reordering via @dnd-kit
 * - Shows "Add Section" buttons between sections
 * - Handles section CRUD operations
 *
 * Uses SectionEditor as the wrapper for each section type.
 */

import { useState } from 'react';
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
import { PlusIcon } from '@heroicons/react/24/outline';
import { useSectionEditorContext } from '@/context/SectionEditorContext';
import { SectionEditor } from './SectionEditor';
import { SectionTypePicker } from './SectionTypePicker';
import type { ProjectSection, SectionType } from '@/types/models';

// ============================================================================
// Main Component
// ============================================================================

export function SectionsEditorCanvas() {
  const { sections, reorderSections, addSection } = useSectionEditorContext();

  const [activeSection, setActiveSection] = useState<ProjectSection | null>(null);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [insertAfterIndex, setInsertAfterIndex] = useState<number | null>(null);

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const section = sections.find((s) => s.id.toString() === active.id);
    if (section) {
      setActiveSection(section);
    }
  };

  // Handle drag end - reorder sections
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveSection(null);

    if (over && active.id !== over.id) {
      const oldIndex = sections.findIndex((s) => s.id.toString() === active.id);
      const newIndex = sections.findIndex((s) => s.id.toString() === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        reorderSections(oldIndex, newIndex);
      }
    }
  };

  // Handle adding a section at a specific position
  const handleAddSection = (afterIndex: number | null) => {
    setInsertAfterIndex(afterIndex);
    setShowTypePicker(true);
  };

  // Handle section type selection
  const handleSelectSectionType = (type: SectionType) => {
    // Get the section ID to insert after, if any
    const afterId =
      insertAfterIndex !== null && insertAfterIndex >= 0 && insertAfterIndex < sections.length
        ? sections[insertAfterIndex].id.toString()
        : undefined;

    addSection(type, afterId);
    setShowTypePicker(false);
    setInsertAfterIndex(null);
  };

  // Close type picker
  const handleClosePicker = () => {
    setShowTypePicker(false);
    setInsertAfterIndex(null);
  };

  // Get sortable IDs
  const sortableIds = sections.map((s) => s.id.toString());

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Sections ({sections.length})
          </h2>
          <button
            onClick={() => handleAddSection(sections.length - 1)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <PlusIcon className="w-4 h-4" />
            Add Section
          </button>
        </div>

        {/* Add Section at Top */}
        <AddSectionDivider onAdd={() => handleAddSection(-1)} position="top" />

        {/* Drag-and-Drop Context */}
        {sections.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-4">
                {sections.map((section, index) => (
                  <div key={section.id}>
                    <SectionEditor section={section} />
                    {/* Add Section Divider after each section */}
                    <AddSectionDivider
                      onAdd={() => handleAddSection(index)}
                      position="between"
                    />
                  </div>
                ))}
              </div>
            </SortableContext>

            {/* Drag Overlay - shows the dragged item */}
            <DragOverlay>
              {activeSection ? (
                <div className="opacity-80 transform scale-[1.02]">
                  <SectionEditor section={activeSection} isDragOverlay />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <EmptySectionsState onAdd={() => handleAddSection(-1)} />
        )}
      </div>

      {/* Section Type Picker Modal */}
      {showTypePicker && (
        <SectionTypePicker onSelect={handleSelectSectionType} onClose={handleClosePicker} />
      )}
    </>
  );
}

// ============================================================================
// Add Section Divider
// ============================================================================

interface AddSectionDividerProps {
  onAdd: () => void;
  position: 'top' | 'between' | 'bottom';
}

function AddSectionDivider({ onAdd, position }: AddSectionDividerProps) {
  return (
    <div
      className={`group relative flex items-center justify-center ${
        position === 'top' ? 'mb-2' : position === 'bottom' ? 'mt-2' : 'my-2'
      }`}
    >
      {/* Line */}
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-transparent group-hover:border-primary-300 dark:group-hover:border-primary-700 transition-colors" />
      </div>

      {/* Add Button */}
      <button
        onClick={onAdd}
        className="relative z-10 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 bg-gray-50 dark:bg-gray-900 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-primary-50 dark:hover:bg-primary-900/20 border border-transparent hover:border-primary-300 dark:hover:border-primary-700"
      >
        <PlusIcon className="w-3 h-3" />
        Add section
      </button>
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

interface EmptySectionsStateProps {
  onAdd: () => void;
}

function EmptySectionsState({ onAdd }: EmptySectionsStateProps) {
  return (
    <div className="text-center py-16 px-8">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        <PlusIcon className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
        No sections yet
      </h3>
      <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
        Sections let you showcase different aspects of your project like features,
        tech stack, architecture, and more.
      </p>
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors font-medium"
      >
        <PlusIcon className="w-5 h-5" />
        Add Your First Section
      </button>
    </div>
  );
}

export default SectionsEditorCanvas;
