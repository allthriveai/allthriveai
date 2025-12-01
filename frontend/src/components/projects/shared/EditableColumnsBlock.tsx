/**
 * EditableColumnsBlock - Renders and edits column layout blocks
 *
 * Provides a grid layout with 1-3 columns, where each column can contain
 * nested blocks. Supports:
 * - Adding blocks to each column
 * - Inline editing of nested blocks
 * - Visual column controls for owners
 */

import { useState, useCallback } from 'react';
import {
  PlusIcon,
  TrashIcon,
  DocumentTextIcon,
  PhotoIcon,
  FilmIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { updateProject } from '@/services/projects';
import { EditableContentBlock } from './EditableContentBlock';
import { generateBlockId } from '@/utils/blocks';
import type { Project, ProjectBlock, ColumnBlock } from '@/types/models';

// ============================================================================
// Types
// ============================================================================

interface EditableColumnsBlockProps {
  block: Extract<ProjectBlock, { type: 'columns' }>;
  blockIndex: number;
  project: Project;
  isOwner: boolean;
  onProjectUpdate: (project: Project) => void;
}

// Block types available within columns
const COLUMN_BLOCK_TYPES = [
  { type: 'text', label: 'Text', icon: DocumentTextIcon, style: 'body' },
  { type: 'text', label: 'Heading', icon: DocumentTextIcon, style: 'heading' },
  { type: 'image', label: 'Image', icon: PhotoIcon },
  { type: 'video', label: 'Video', icon: FilmIcon },
  { type: 'mermaid', label: 'Diagram', icon: ChartBarIcon },
] as const;

// ============================================================================
// Column Add Block Button
// ============================================================================

interface ColumnAddBlockButtonProps {
  onAdd: (type: string, style?: string) => void;
  isAdding: boolean;
}

function ColumnAddBlockButton({ onAdd, isAdding }: ColumnAddBlockButtonProps) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className="relative flex items-center justify-center py-2">
      <button
        onClick={() => setShowPicker(!showPicker)}
        disabled={isAdding}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 bg-gray-50 dark:bg-gray-800 rounded-full transition-all hover:bg-primary-50 dark:hover:bg-primary-900/20 border border-dashed border-gray-300 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-700 disabled:opacity-50"
      >
        {isAdding ? (
          <span className="animate-spin text-xs">⏳</span>
        ) : (
          <PlusIcon className="w-3 h-3" />
        )}
        {isAdding ? 'Adding...' : 'Add'}
      </button>

      {showPicker && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowPicker(false)}
          />
          <div className="absolute z-50 top-full mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-2 min-w-[160px]">
            <p className="px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Add Block
            </p>
            {COLUMN_BLOCK_TYPES.map((blockType, idx) => {
              const Icon = blockType.icon;
              return (
                <button
                  key={idx}
                  onClick={() => {
                    onAdd(
                      blockType.type,
                      'style' in blockType ? blockType.style : undefined
                    );
                    setShowPicker(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
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
// Single Column Component
// ============================================================================

interface ColumnProps {
  column: ColumnBlock;
  columnIndex: number;
  columnsBlock: Extract<ProjectBlock, { type: 'columns' }>;
  blockIndex: number;
  project: Project;
  isOwner: boolean;
  onProjectUpdate: (project: Project) => void;
}

function Column({
  column,
  columnIndex,
  columnsBlock,
  blockIndex,
  project,
  isOwner,
  onProjectUpdate,
}: ColumnProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [deletingBlockId, setDeletingBlockId] = useState<string | null>(null);

  // Add block to this column
  const handleAddBlock = useCallback(
    async (type: string, style?: string) => {
      setIsAdding(true);

      const newBlock: ProjectBlock = {
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
      } as ProjectBlock;

      // Update the column's blocks
      const updatedColumns = columnsBlock.columns.map((col, idx) => {
        if (idx === columnIndex) {
          return { ...col, blocks: [...col.blocks, newBlock] };
        }
        return col;
      });

      // Update the parent block in the project
      const updatedBlocks = (project.content?.blocks || []).map((b, idx) => {
        if (idx === blockIndex) {
          return { ...columnsBlock, columns: updatedColumns };
        }
        return b;
      });

      try {
        const updated = await updateProject(project.id, {
          content: { ...project.content, blocks: updatedBlocks },
        });
        onProjectUpdate(updated);
      } catch (error) {
        console.error('Failed to add block to column:', error);
      } finally {
        setIsAdding(false);
      }
    },
    [columnsBlock, columnIndex, blockIndex, project, onProjectUpdate]
  );

  // Delete block from this column
  const handleDeleteBlock = useCallback(
    async (blockId: string) => {
      setDeletingBlockId(blockId);

      const updatedColumns = columnsBlock.columns.map((col, idx) => {
        if (idx === columnIndex) {
          return { ...col, blocks: col.blocks.filter((b) => b.id !== blockId) };
        }
        return col;
      });

      const updatedBlocks = (project.content?.blocks || []).map((b, idx) => {
        if (idx === blockIndex) {
          return { ...columnsBlock, columns: updatedColumns };
        }
        return b;
      });

      try {
        const updated = await updateProject(project.id, {
          content: { ...project.content, blocks: updatedBlocks },
        });
        onProjectUpdate(updated);
      } catch (error) {
        console.error('Failed to delete block from column:', error);
      } finally {
        setDeletingBlockId(null);
      }
    },
    [columnsBlock, columnIndex, blockIndex, project, onProjectUpdate]
  );

  // Handle nested block updates (for inline editing within column)
  const handleColumnBlockUpdate = useCallback(
    (updatedProject: Project) => {
      // The updated project is passed through from EditableContentBlock
      onProjectUpdate(updatedProject);
    },
    [onProjectUpdate]
  );

  return (
    <div className="flex flex-col h-full min-h-[120px] p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Column header for owner */}
      {isOwner && (
        <div className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-2 text-center">
          Column {columnIndex + 1}
        </div>
      )}

      {/* Column blocks */}
      <div className="flex-1 space-y-3">
        {column.blocks.map((nestedBlock, nestedIndex) => (
          <div key={nestedBlock.id || nestedIndex} className="group relative">
            {/* Delete button for nested block */}
            {isOwner && (
              <button
                onClick={() => nestedBlock.id && handleDeleteBlock(nestedBlock.id)}
                disabled={deletingBlockId === nestedBlock.id}
                className="absolute -top-2 -right-2 z-10 p-1 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                title="Delete block"
              >
                {deletingBlockId === nestedBlock.id ? (
                  <span className="animate-spin text-xs block w-3 h-3">⏳</span>
                ) : (
                  <TrashIcon className="w-3 h-3" />
                )}
              </button>
            )}

            {/* Nested block content - pass modified index for nested updates */}
            <EditableContentBlock
              block={nestedBlock}
              index={blockIndex} // Parent block index
              project={project}
              isOwner={isOwner}
              onProjectUpdate={handleColumnBlockUpdate}
              // Additional props for column context
              columnIndex={columnIndex}
              nestedBlockIndex={nestedIndex}
              columnsBlock={columnsBlock}
            />
          </div>
        ))}
      </div>

      {/* Add block button for column */}
      {isOwner && (
        <ColumnAddBlockButton onAdd={handleAddBlock} isAdding={isAdding} />
      )}

      {/* Empty state */}
      {column.blocks.length === 0 && !isOwner && (
        <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm italic">
          Empty column
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function EditableColumnsBlock({
  block,
  blockIndex,
  project,
  isOwner,
  onProjectUpdate,
}: EditableColumnsBlockProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  };

  return (
    <div className="my-6">
      {/* Column count indicator for owners */}
      {isOwner && (
        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
          {block.columnCount} Column{block.columnCount > 1 ? 's' : ''} Layout
        </div>
      )}

      {/* Columns grid */}
      <div className={`grid gap-4 ${gridCols[block.columnCount]}`}>
        {block.columns.map((column, columnIndex) => (
          <Column
            key={column.id}
            column={column}
            columnIndex={columnIndex}
            columnsBlock={block}
            blockIndex={blockIndex}
            project={project}
            isOwner={isOwner}
            onProjectUpdate={onProjectUpdate}
          />
        ))}
      </div>
    </div>
  );
}
