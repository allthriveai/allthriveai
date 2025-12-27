/**
 * AddSectionButton - Button to add new learning sections
 *
 * Shown in edit mode to allow users to add sections at various positions.
 */

import { PlusIcon } from '@heroicons/react/24/outline';
import { useLearningSectionEditor } from '@/context/LearningSectionEditorContext';

interface AddSectionButtonProps {
  afterId?: string;
  position: 'top' | 'between' | 'bottom';
}

export function AddSectionButton({ afterId, position }: AddSectionButtonProps) {
  const { addSection, isEditing } = useLearningSectionEditor();

  if (!isEditing) return null;

  const handleClick = () => {
    addSection(afterId);
  };

  return (
    <div
      className={`group/add flex items-center justify-center ${
        position === 'top' ? 'mb-4' : position === 'bottom' ? 'mt-4' : 'my-4'
      }`}
    >
      {/* Divider line */}
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent opacity-0 group-hover/add:opacity-100 transition-opacity" />

      {/* Add button */}
      <button
        onClick={handleClick}
        className="mx-4 flex items-center gap-2 px-4 py-2 rounded-lg
          text-gray-500 hover:text-cyan-400
          bg-transparent hover:bg-gray-800/50
          border border-transparent hover:border-cyan-500/30
          opacity-50 hover:opacity-100
          transition-all duration-200"
      >
        <PlusIcon className="w-4 h-4" />
        <span className="text-sm font-medium">Add Section</span>
      </button>

      {/* Divider line */}
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent opacity-0 group-hover/add:opacity-100 transition-opacity" />
    </div>
  );
}
