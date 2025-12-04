/**
 * SectionRenderer - Routes project sections to their specific renderers
 *
 * This component takes a ProjectSection and renders the appropriate
 * section component based on the section type.
 */

import { useState, useCallback } from 'react';
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
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { PlusIcon, TrashIcon, Bars3Icon } from '@heroicons/react/24/outline';
import type { ProjectSection, SectionType } from '@/types/sections';
import { OverviewSection } from './OverviewSection';
import { FeaturesSection } from './FeaturesSection';
import { TechStackSection } from './TechStackSection';
import { GallerySection } from './GallerySection';
import { ArchitectureSection } from './ArchitectureSection';
import { DemoSection } from './DemoSection';
import { ChallengesSection } from './ChallengesSection';
import { LinksSection } from './LinksSection';
import { CustomSection } from './CustomSection';
import { SlideUpSection } from './SlideUpSection';
import { SectionTypePicker } from '../editor/SectionTypePicker';

interface SectionRendererProps {
  section: ProjectSection;
  isEditing?: boolean;
  onUpdate?: (content: ProjectSection['content']) => void;
}

export function SectionRenderer({ section, isEditing, onUpdate }: SectionRendererProps) {
  if (!section.enabled) {
    return null;
  }

  const commonProps = { isEditing, onUpdate };

  switch (section.type) {
    case 'overview':
      return <OverviewSection content={section.content as any} {...commonProps} />;
    case 'features':
      return <FeaturesSection content={section.content as any} {...commonProps} />;
    case 'tech_stack':
      return <TechStackSection content={section.content as any} {...commonProps} />;
    case 'gallery':
      return <GallerySection content={section.content as any} {...commonProps} />;
    case 'architecture':
      return <ArchitectureSection content={section.content as any} {...commonProps} />;
    case 'demo':
      return <DemoSection content={section.content as any} {...commonProps} />;
    case 'challenges':
      return <ChallengesSection content={section.content as any} {...commonProps} />;
    case 'links':
      return <LinksSection content={section.content as any} {...commonProps} />;
    case 'slideup':
      return <SlideUpSection content={section.content as any} {...commonProps} />;
    case 'custom':
      return <CustomSection content={section.content as any} {...commonProps} />;
    default:
      return null;
  }
}

/**
 * ProjectSections - Renders all enabled sections in order with drag-and-drop reordering
 */
interface ProjectSectionsProps {
  sections: ProjectSection[];
  isEditing?: boolean;
  onSectionUpdate?: (sectionId: string, content: ProjectSection['content']) => void;
  onAddSection?: (type: SectionType, afterSectionId?: string) => void;
  onDeleteSection?: (sectionId: string) => void;
  onReorderSections?: (reorderedSections: ProjectSection[]) => void;
}

export function ProjectSections({
  sections,
  isEditing,
  onSectionUpdate,
  onAddSection,
  onDeleteSection,
  onReorderSections,
}: ProjectSectionsProps) {
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [insertAfterSectionId, setInsertAfterSectionId] = useState<string | undefined>(undefined);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  // Guard against undefined or null sections
  const safeSections = sections || [];

  const enabledSections = safeSections
    .filter(s => s.enabled)
    .sort((a, b) => a.order - b.order);

  // Get section IDs for sortable context
  const sectionIds = enabledSections.map(s => s.id);

  // Find active section for drag overlay
  const activeSection = enabledSections.find(s => s.id === activeSectionId);

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

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveSectionId(null);

    if (over && active.id !== over.id && onReorderSections) {
      const oldIndex = enabledSections.findIndex(s => s.id === active.id);
      const newIndex = enabledSections.findIndex(s => s.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        // Create new array with reordered sections
        const newSections = [...enabledSections];
        const [movedSection] = newSections.splice(oldIndex, 1);
        newSections.splice(newIndex, 0, movedSection);

        // Update order values
        const reorderedSections = newSections.map((s, idx) => ({ ...s, order: idx }));
        onReorderSections(reorderedSections);
      }
    }
  }, [enabledSections, onReorderSections]);

  const handleAddClick = (afterSectionId?: string) => {
    setInsertAfterSectionId(afterSectionId);
    setShowTypePicker(true);
  };

  const handleSelectType = (type: SectionType) => {
    if (onAddSection) {
      onAddSection(type, insertAfterSectionId);
    }
    setShowTypePicker(false);
    setInsertAfterSectionId(undefined);
  };

  // Empty state for editing mode
  if (enabledSections.length === 0) {
    if (isEditing && onAddSection) {
      return (
        <div className="max-w-5xl mx-auto px-6 sm:px-8 py-16 md:py-24">
          <div className="text-center py-16 px-8 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl">
            <PlusIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No sections yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Add sections to showcase your project
            </p>
            <button
              onClick={() => handleAddClick()}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors font-medium"
            >
              <PlusIcon className="w-5 h-5" />
              Add Your First Section
            </button>
          </div>
          {showTypePicker && (
            <SectionTypePicker
              onSelect={handleSelectType}
              onClose={() => setShowTypePicker(false)}
            />
          )}
        </div>
      );
    }
    return null;
  }

  // Render sections with drag-and-drop when editing
  const renderSections = () => (
    <div className="space-y-16">
      {enabledSections.map((section, index) => (
        <SortableSection
          key={section.id}
          section={section}
          index={index}
          totalSections={enabledSections.length}
          isEditing={isEditing}
          onSectionUpdate={onSectionUpdate}
          onDeleteSection={onDeleteSection}
          onAddClick={handleAddClick}
          onAddSection={onAddSection}
        />
      ))}
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-6 sm:px-8 py-16 md:py-24">
      {/* Add Section at Top (editing mode) */}
      {isEditing && onAddSection && (
        <AddSectionButton onClick={() => handleAddClick()} position="top" />
      )}

      {/* Sections with optional drag-and-drop */}
      {isEditing && onReorderSections ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
            {renderSections()}
          </SortableContext>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeSection ? (
              <div className="opacity-90 bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 border-2 border-primary-500">
                <div className="text-sm font-medium text-primary-600 dark:text-primary-400 mb-2">
                  Moving: {activeSection.type.replace('_', ' ')}
                </div>
                <div className="opacity-50 pointer-events-none">
                  <SectionRenderer section={activeSection} isEditing={false} />
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        renderSections()
      )}

      {/* Section Type Picker Modal */}
      {showTypePicker && (
        <SectionTypePicker
          onSelect={handleSelectType}
          onClose={() => setShowTypePicker(false)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Sortable Section Wrapper
// ============================================================================

interface SortableSectionProps {
  section: ProjectSection;
  index: number;
  totalSections: number;
  isEditing?: boolean;
  onSectionUpdate?: (sectionId: string, content: ProjectSection['content']) => void;
  onDeleteSection?: (sectionId: string) => void;
  onAddClick: (afterSectionId?: string) => void;
  onAddSection?: (type: SectionType, afterSectionId?: string) => void;
}

function SortableSection({
  section,
  index,
  totalSections,
  isEditing,
  onSectionUpdate,
  onDeleteSection,
  onAddClick,
  onAddSection,
}: SortableSectionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group/section">
      {/* Drag Handle & Delete Button (editing mode) */}
      {isEditing && (
        <div className="absolute -left-10 top-0 flex flex-col gap-2 opacity-0 group-hover/section:opacity-100 transition-opacity">
          {/* Drag Handle */}
          <button
            {...attributes}
            {...listeners}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-grab active:cursor-grabbing shadow-sm"
            title="Drag to reorder"
          >
            <Bars3Icon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Delete Section Button */}
      {isEditing && onDeleteSection && (
        <button
          onClick={() => onDeleteSection(section.id)}
          className="absolute -top-2 -right-2 z-10 p-2 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 opacity-0 group-hover/section:opacity-100 transition-opacity shadow-lg"
          title="Delete section"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      )}

      <SectionRenderer
        section={section}
        isEditing={isEditing}
        onUpdate={onSectionUpdate ? (content) => onSectionUpdate(section.id, content) : undefined}
      />

      {/* Add Section Button after each section (editing mode) */}
      {isEditing && onAddSection && (
        <AddSectionButton
          onClick={() => onAddClick(section.id)}
          position={index === totalSections - 1 ? 'bottom' : 'between'}
        />
      )}
    </div>
  );
}

// ============================================================================
// Add Section Button
// ============================================================================

interface AddSectionButtonProps {
  onClick: () => void;
  position: 'top' | 'between' | 'bottom';
}

function AddSectionButton({ onClick, position }: AddSectionButtonProps) {
  return (
    <div
      className={`group/add flex items-center justify-center ${
        position === 'top' ? 'mb-8' : position === 'bottom' ? 'mt-8' : 'my-8'
      }`}
    >
      {/* Line */}
      <div className="flex-1 h-px bg-transparent group-hover/add:bg-primary-300 dark:group-hover/add:bg-primary-700 transition-colors" />

      {/* Button */}
      <button
        onClick={onClick}
        className="flex items-center gap-2 px-4 py-2 mx-4 text-sm font-medium text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 bg-gray-50 dark:bg-gray-900 rounded-full opacity-60 hover:opacity-100 transition-all hover:bg-primary-50 dark:hover:bg-primary-900/20 border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700"
      >
        <PlusIcon className="w-4 h-4" />
        Add Section
      </button>

      {/* Line */}
      <div className="flex-1 h-px bg-transparent group-hover/add:bg-primary-300 dark:group-hover/add:bg-primary-700 transition-colors" />
    </div>
  );
}
