/**
 * EditableBlocksContainer - Full CRUD container for content blocks
 *
 * Provides:
 * - Inline editing of block content
 * - Add new blocks (with type picker)
 * - Delete blocks
 * - Drag-and-drop reordering
 * - Loading states and error handling
 *
 * Used on the project view page for owners.
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
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  PlusIcon,
  TrashIcon,
  Bars3Icon,
  DocumentTextIcon,
  PhotoIcon,
  FilmIcon,
  ChartBarIcon,
  ExclamationCircleIcon,
  ViewColumnsIcon,
  Squares2X2Icon,
  StarIcon,
} from '@heroicons/react/24/outline';
import { updateProject } from '@/services/projects';
import { EditableContentBlock } from './EditableContentBlock';
import type { Project, ProjectBlock } from '@/types/models';

import { generateBlockId } from '@/utils/blocks';

/**
 * Ensures all blocks have stable IDs for drag-and-drop.
 * IDs are generated client-side and not persisted to the backend.
 */
function ensureBlockIds(blocks: ProjectBlock[]): ProjectBlock[] {
  return blocks.map((block) => ({
    ...block,
    id: block.id || generateBlockId(),
  }));
}

// ============================================================================
// Types
// ============================================================================

// Mode 1: Full project mode - for use in DefaultProjectLayout
interface ProjectModeProps {
  project: Project;
  isOwner: boolean;
  onProjectUpdate: (project: Project) => void;
  // Not present in project mode
  blocks?: never;
  onBlocksChange?: never;
  isEditing?: never;
}

// Mode 2: Standalone blocks mode - for use in CustomSection
interface BlocksModeProps {
  blocks: ProjectBlock[];
  onBlocksChange: (blocks: ProjectBlock[]) => void;
  isEditing: boolean;
  // Not present in blocks mode
  project?: never;
  isOwner?: never;
  onProjectUpdate?: never;
}

type EditableBlocksContainerProps = ProjectModeProps | BlocksModeProps;

// Type guard to check which mode we're in
function isProjectMode(props: EditableBlocksContainerProps): props is ProjectModeProps {
  return 'project' in props && props.project !== undefined;
}

// ============================================================================
// Block Type Options
// ============================================================================

const BLOCK_TYPES = [
  { type: 'columns', label: '2 Columns', icon: ViewColumnsIcon, columnCount: 2 },
  { type: 'columns', label: '3 Columns', icon: Squares2X2Icon, columnCount: 3 },
  { type: 'text', label: 'Text', icon: DocumentTextIcon, style: 'body' },
  { type: 'text', label: 'Heading', icon: DocumentTextIcon, style: 'heading' },
  { type: 'text', label: 'Quote', icon: DocumentTextIcon, style: 'quote' },
  { type: 'image', label: 'Image', icon: PhotoIcon },
  { type: 'video', label: 'Video', icon: FilmIcon },
  { type: 'mermaid', label: 'Diagram', icon: ChartBarIcon },
  { type: 'icon_card', label: 'Icon Card', icon: StarIcon },
] as const;

// ============================================================================
// Delete Confirmation Modal
// ============================================================================

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

function DeleteConfirmModal({
  isOpen,
  onConfirm,
  onCancel,
  isDeleting,
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm mx-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Delete Block?
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg disabled:opacity-50 flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <span className="animate-spin">⏳</span>
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Error Toast
// ============================================================================

interface ErrorToastProps {
  message: string | null;
  onDismiss: () => void;
}

function ErrorToast({ message, onDismiss }: ErrorToastProps) {
  if (!message) return null;

  return (
    <div className="fixed bottom-20 right-4 z-50 flex items-center gap-2 px-4 py-3 bg-red-500 text-white rounded-lg shadow-lg animate-in slide-in-from-bottom">
      <ExclamationCircleIcon className="w-5 h-5" />
      <span className="text-sm">{message}</span>
      <button
        onClick={onDismiss}
        className="ml-2 text-white/80 hover:text-white"
      >
        ×
      </button>
    </div>
  );
}

// ============================================================================
// Sortable Block Wrapper
// ============================================================================

interface SortableBlockProps {
  block: ProjectBlock;
  blockId: string;
  index: number;
  project: Project;
  isOwner: boolean;
  onProjectUpdate: (project: Project) => void;
  onDelete: (blockId: string) => void;
}

function SortableBlock({
  block,
  blockId,
  index,
  project,
  isOwner,
  onProjectUpdate,
  onDelete,
}: SortableBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: blockId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="group relative">
      {/* Block Controls - visible on hover for owners */}
      {isOwner && (
        <div className="absolute -left-12 top-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Drag Handle */}
          <button
            {...attributes}
            {...listeners}
            className="p-1.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing"
            title="Drag to reorder"
          >
            <Bars3Icon className="w-4 h-4" />
          </button>
          {/* Delete Button */}
          <button
            onClick={() => onDelete(blockId)}
            className="p-1.5 rounded bg-red-50 dark:bg-red-900/20 text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40"
            title="Delete block"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Block Content */}
      <EditableContentBlock
        block={block}
        index={index}
        project={project}
        isOwner={isOwner}
        onProjectUpdate={onProjectUpdate}
      />
    </div>
  );
}

// ============================================================================
// Add Block Button
// ============================================================================

interface AddBlockButtonProps {
  onAdd: (type: string, style?: string, columnCount?: number) => void;
  position: 'top' | 'between' | 'bottom' | 'empty';
  isAdding?: boolean;
}

function AddBlockButton({ onAdd, position, isAdding }: AddBlockButtonProps) {
  const [showPicker, setShowPicker] = useState(false);
  const isEmptyState = position === 'empty';

  return (
    <div
      className={`group relative flex items-center justify-center ${
        showPicker ? 'z-50' : 'z-20'
      } ${
        position === 'top' ? 'mb-4' : position === 'bottom' ? 'mt-4' : position === 'empty' ? '' : 'my-4'
      }`}
    >
      {/* Divider Line - not shown in empty state */}
      {!isEmptyState && (
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-transparent group-hover:border-primary-300 dark:group-hover:border-primary-700 transition-colors" />
        </div>
      )}

      {/* Add Button */}
      <button
        onClick={() => setShowPicker(!showPicker)}
        disabled={isAdding}
        className={`relative z-10 flex items-center gap-2 font-medium transition-all disabled:opacity-50 ${
          isEmptyState
            ? 'px-4 py-2 text-sm bg-primary-500 hover:bg-primary-600 text-white rounded-lg'
            : 'px-3 py-1.5 text-xs text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 bg-white dark:bg-gray-900 rounded-full opacity-0 group-hover:opacity-100 hover:bg-primary-50 dark:hover:bg-primary-900/20 border border-transparent hover:border-primary-300 dark:hover:border-primary-700'
        }`}
      >
        {isAdding ? (
          <span className="animate-spin">⏳</span>
        ) : (
          <PlusIcon className={isEmptyState ? 'w-4 h-4' : 'w-3 h-3'} />
        )}
        {isAdding ? 'Adding...' : 'Add Block'}
      </button>

      {/* Block Type Picker */}
      {showPicker && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowPicker(false)}
          />
          {/* Picker Menu */}
          <div className="absolute z-50 top-full mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-2 min-w-[200px]">
            <p className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Add Block
            </p>
            {BLOCK_TYPES.map((blockType, idx) => {
              const Icon = blockType.icon;
              return (
                <button
                  key={idx}
                  onClick={() => {
                    onAdd(
                      blockType.type,
                      'style' in blockType ? blockType.style : undefined,
                      'columnCount' in blockType ? blockType.columnCount : undefined
                    );
                    setShowPicker(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <Icon className="w-4 h-4 text-gray-400" />
                  {blockType.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Main Container Component
// ============================================================================

export function EditableBlocksContainer(props: EditableBlocksContainerProps) {
  // All hooks must be called unconditionally before any early returns
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine which mode we're in
  const projectMode = isProjectMode(props);

  // Get blocks from either mode
  const rawBlocks = projectMode
    ? props.project?.content?.blocks || []
    : props.blocks || [];

  // Ensure all blocks have stable IDs
  const blocks = useMemo(
    () => ensureBlockIds(rawBlocks),
    [rawBlocks]
  );

  // Determine if we can edit
  const canEdit = projectMode ? props.isOwner : props.isEditing;

  // Get block IDs for sortable context
  const sortableIds = useMemo(
    () => blocks.map((block) => block.id!),
    [blocks]
  );

  // Find active block for drag overlay
  const activeBlock = useMemo(
    () => blocks.find((b) => b.id === activeBlockId) || null,
    [blocks, activeBlockId]
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

  // Helper to update blocks - handles both project mode and blocks mode
  const updateBlocks = useCallback(
    async (newBlocks: ProjectBlock[]) => {
      if (projectMode) {
        const { project, onProjectUpdate } = props as ProjectModeProps;
        const updated = await updateProject(project.id, {
          content: { ...project.content, blocks: newBlocks },
        });
        onProjectUpdate(updated);
      } else {
        const { onBlocksChange } = props as BlocksModeProps;
        // In blocks mode, just update synchronously (parent handles persistence)
        onBlocksChange(newBlocks);
      }
    },
    [projectMode, props]
  );

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveBlockId(event.active.id.toString());
  }, []);

  // Handle drag end - reorder blocks
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveBlockId(null);

      if (over && active.id !== over.id) {
        const oldIndex = blocks.findIndex((b) => b.id === active.id);
        const newIndex = blocks.findIndex((b) => b.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          const newBlocks = [...blocks];
          const [movedBlock] = newBlocks.splice(oldIndex, 1);
          newBlocks.splice(newIndex, 0, movedBlock);

          try {
            await updateBlocks(newBlocks);
          } catch (err) {
            setError('Failed to reorder blocks');
            console.error('Failed to reorder blocks:', err);
          }
        }
      }
    },
    [blocks, updateBlocks]
  );

  // Add a new block
  const handleAddBlock = useCallback(
    async (afterIndex: number, type: string, style?: string, columnCount?: number) => {
      setIsAdding(true);
      setError(null);

      let newBlock: ProjectBlock;

      if (type === 'columns' && columnCount) {
        // Create column block with empty columns
        const columns = Array.from({ length: columnCount }, () => ({
          id: generateBlockId(),
          blocks: [] as ProjectBlock[],
        }));
        newBlock = {
          id: generateBlockId(),
          type: 'columns',
          columnCount: columnCount as 1 | 2 | 3,
          containerWidth: 'full',
          columns,
        } as ProjectBlock;
      } else {
        newBlock = {
          id: generateBlockId(),
          type: type as ProjectBlock['type'],
          ...(type === 'text' && {
            style: (style || 'body') as 'body' | 'heading' | 'quote',
            content: '',
          }),
          ...(type === 'image' && { url: '', caption: '' }),
          ...(type === 'video' && { url: '', caption: '' }),
          ...(type === 'mermaid' && {
            code: 'graph TD\n    A[Start] --> B[End]',
            caption: '',
          }),
          ...(type === 'icon_card' && {
            icon: 'fas:star',
            text: '',
          }),
        } as ProjectBlock;
      }

      const newBlocks = [...blocks];
      newBlocks.splice(afterIndex + 1, 0, newBlock);

      try {
        await updateBlocks(newBlocks);
      } catch (err) {
        setError('Failed to add block');
        console.error('Failed to add block:', err);
      } finally {
        setIsAdding(false);
      }
    },
    [blocks, updateBlocks]
  );

  // Delete a block
  const handleDeleteBlock = useCallback(async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    setError(null);

    const newBlocks = blocks.filter((b) => b.id !== deleteTarget);

    try {
      await updateBlocks(newBlocks);
      setDeleteTarget(null);
    } catch (err) {
      setError('Failed to delete block');
      console.error('Failed to delete block:', err);
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, blocks, updateBlocks]);

  // Create mock project/handlers for child components when in blocks mode
  const childProject = projectMode
    ? (props as ProjectModeProps).project
    : ({ id: 0, content: { blocks } } as unknown as Project);

  const childOnProjectUpdate = projectMode
    ? (props as ProjectModeProps).onProjectUpdate
    : (updated: Project) => {
        // Extract blocks from the mock project update and pass to parent
        const { onBlocksChange } = props as BlocksModeProps;
        onBlocksChange(updated.content?.blocks || []);
      };

  // Early return if in project mode and project is undefined
  if (projectMode && !props.project) {
    return null;
  }

  // If not editable, just render blocks without editing controls
  if (!canEdit) {
    return (
      <div className="space-y-8">
        {blocks.map((block, index) => (
          <EditableContentBlock
            key={block.id}
            block={block}
            index={index}
            project={childProject}
            isOwner={false}
            onProjectUpdate={childOnProjectUpdate}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="relative pl-12">
      {/* Error Toast */}
      <ErrorToast message={error} onDismiss={() => setError(null)} />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onConfirm={handleDeleteBlock}
        onCancel={() => setDeleteTarget(null)}
        isDeleting={isDeleting}
      />

      {/* Add Block at Top */}
      <AddBlockButton
        onAdd={(type, style, columnCount) => handleAddBlock(-1, type, style, columnCount)}
        position="top"
        isAdding={isAdding}
      />

      {/* Blocks with Drag-and-Drop */}
      {blocks.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortableIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-4">
              {blocks.map((block, index) => (
                <div key={block.id}>
                  <SortableBlock
                    block={block}
                    blockId={block.id!}
                    index={index}
                    project={childProject}
                    isOwner={canEdit}
                    onProjectUpdate={childOnProjectUpdate}
                    onDelete={setDeleteTarget}
                  />
                  {/* Add Block Button after each block */}
                  <AddBlockButton
                    onAdd={(type, style, columnCount) => handleAddBlock(index, type, style, columnCount)}
                    position="between"
                    isAdding={isAdding}
                  />
                </div>
              ))}
            </div>
          </SortableContext>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeBlock ? (
              <div className="opacity-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4">
                <EditableContentBlock
                  block={activeBlock}
                  index={-1}
                  project={childProject}
                  isOwner={false}
                  onProjectUpdate={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        /* Empty State */
        <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
          <PlusIcon className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            No content blocks yet. Add your first block to get started.
          </p>
          <AddBlockButton
            onAdd={(type, style, columnCount) => handleAddBlock(-1, type, style, columnCount)}
            position="empty"
            isAdding={isAdding}
          />
        </div>
      )}
    </div>
  );
}
