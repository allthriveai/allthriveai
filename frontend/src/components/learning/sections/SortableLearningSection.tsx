/**
 * SortableLearningSection - Draggable section wrapper for edit mode
 *
 * This component wraps a LearningSectionCard with sortable functionality
 * using @dnd-kit, following the pattern from ProfileSectionRenderer.
 */

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Bars3Icon, TrashIcon } from '@heroicons/react/24/outline';
import type { LearningSection, TopicSectionData } from '@/types/learningSections';
import type { TopicProgressMap } from '@/utils/learningSectionProgress';
import { useLearningSectionEditor } from '@/context/LearningSectionEditorContext';
import { LearningSectionCard } from './LearningSectionCard';
import { AddSectionButton } from './AddSectionButton';

interface SortableLearningSectionProps {
  section: LearningSection;
  index: number;
  topicMap: Record<string, TopicSectionData>;
  topicProgressMap: TopicProgressMap;
}

export function SortableLearningSection({
  section,
  index,
  topicMap,
  topicProgressMap,
}: SortableLearningSectionProps) {
  const { deleteSection, sectionsOrganization } = useLearningSectionEditor();
  const totalSections = sectionsOrganization?.sections.length ?? 0;

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
    <div
      ref={setNodeRef}
      style={style}
      className="relative group/section"
    >
      {/* Section Controls (left side) */}
      <div className="absolute -left-12 top-4 flex flex-col gap-2 opacity-0 group-hover/section:opacity-100 transition-opacity z-10">
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="p-2 rounded-lg bg-gray-800/80 text-gray-400 hover:text-cyan-400 hover:bg-gray-700/80 cursor-grab active:cursor-grabbing shadow-sm backdrop-blur-sm"
          title="Drag to reorder"
        >
          <Bars3Icon className="w-4 h-4" />
        </button>
      </div>

      {/* Delete Section Button (top right) */}
      <button
        onClick={() => deleteSection(section.id)}
        className="absolute -top-2 -right-2 z-10 p-2 rounded-full bg-red-500/20 text-red-400 hover:text-red-300 hover:bg-red-500/30 opacity-0 group-hover/section:opacity-100 transition-opacity shadow-lg backdrop-blur-sm"
        title="Delete section"
      >
        <TrashIcon className="w-4 h-4" />
      </button>

      {/* Section Card */}
      <LearningSectionCard
        section={section}
        topicMap={topicMap}
        topicProgressMap={topicProgressMap}
      />

      {/* Add Section Button after each section */}
      <AddSectionButton
        afterId={section.id}
        position={index === totalSections - 1 ? 'bottom' : 'between'}
      />
    </div>
  );
}
