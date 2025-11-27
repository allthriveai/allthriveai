import { useState } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { uploadImage, uploadFile } from '@/services/upload';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import type { ProjectBlock, ColumnBlock } from '@/types/models';
import {
  Bars3Icon,
  TrashIcon,
  PlusIcon,
  PhotoIcon,
  CodeBracketIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import {
  FaColumns,
  FaFont,
  FaImage,
  FaVideo,
  FaFileAlt,
  FaMousePointer,
  FaMinus,
  FaExpand,
  FaCompress,
} from 'react-icons/fa';

// Component prop interfaces
interface BlockEditorProps {
  block: ProjectBlock;
  isFocused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onChange: (updates: Partial<ProjectBlock>) => void;
  onDelete: () => void;
}

interface DraggableColumnBlockProps {
  id: string;
  block: ProjectBlock;
  onChange: (updates: Partial<ProjectBlock>) => void;
  onDelete: () => void;
  onUpload: (file: File) => Promise<void>;
}

interface ColumnBlockEditorProps {
  block: ProjectBlock;
  onChange: (updates: Partial<ProjectBlock>) => void;
  onDelete: () => void;
  onUpload: (file: File) => Promise<void>;
  dragHandleProps: any; // dnd-kit drag handle props
}

interface SlideshowImageItemProps {
  id: string;
  imageUrl: string;
  index: number;
  onRemove: () => void;
}

interface AddBlockMenuProps {
  show: boolean;
  onAdd: (type: 'text' | 'image' | 'video' | 'file' | 'button' | 'divider' | 'columns') => void;
  onToggle: () => void;
}


export function BlockEditor({ block, isFocused, onFocus, onBlur, onChange, onDelete }: BlockEditorProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  // Default to markdown mode (true = markdown, false = WYSIWYG)
  const [isMarkdownMode, setIsMarkdownMode] = useState(true);

  // Create sensors for nested drag and drop (column blocks)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const data = await uploadImage(file, 'projects', true);
      onChange({ url: data.url });
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(error.message || 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const addColumnBlock = (columnIndex: number, type: 'text' | 'image' | 'video' | 'file' | 'button' | 'divider') => {
    const newBlock: any = {
      id: crypto.randomUUID(),
      type,
    };

    // Initialize block based on type
    if (type === 'text') {
      newBlock.content = '';
      newBlock.style = 'body';
    } else if (type === 'image') {
      newBlock.url = '';
      newBlock.caption = '';
    } else if (type === 'video') {
      newBlock.url = '';
      newBlock.embedUrl = '';
      newBlock.caption = '';
    } else if (type === 'file') {
      newBlock.url = '';
      newBlock.filename = '';
      newBlock.fileType = '';
      newBlock.fileSize = 0;
      newBlock.label = 'Download File';
      newBlock.icon = 'FaDownload';
    } else if (type === 'button') {
      newBlock.text = 'Click Here';
      newBlock.url = '';
      newBlock.icon = 'FaArrowRight';
      newBlock.style = 'primary';
      newBlock.size = 'medium';
    } else if (type === 'divider') {
      newBlock.style = 'line';
    }

    const updatedColumns = [...block.columns];
    updatedColumns[columnIndex] = {
      ...updatedColumns[columnIndex],
      blocks: [...updatedColumns[columnIndex].blocks, newBlock],
    };

    onChange({ columns: updatedColumns });
  };

  const updateColumnBlock = (columnIndex: number, blockId: string, updates: any) => {
    const updatedColumns = [...block.columns];
    updatedColumns[columnIndex] = {
      ...updatedColumns[columnIndex],
      blocks: updatedColumns[columnIndex].blocks.map((b: any) =>
        b.id === blockId ? { ...b, ...updates } : b
      ),
    };
    onChange({ columns: updatedColumns });
  };

  const deleteColumnBlock = (columnIndex: number, blockId: string) => {
    const updatedColumns = [...block.columns];
    updatedColumns[columnIndex] = {
      ...updatedColumns[columnIndex],
      blocks: updatedColumns[columnIndex].blocks.filter((b: any) => b.id !== blockId),
    };
    onChange({ columns: updatedColumns });
  };

  const changeColumnCount = (count: 1 | 2 | 3) => {
    const currentColumns = block.columns || [];
    const newColumns = [];

    for (let i = 0; i < count; i++) {
      if (currentColumns[i]) {
        newColumns.push(currentColumns[i]);
      } else {
        newColumns.push({ id: crypto.randomUUID(), blocks: [] });
      }
    }

    // If reducing columns, merge extra blocks into last column
    if (count < currentColumns.length) {
      const extraBlocks = currentColumns.slice(count).flatMap((col: any) => col.blocks);
      if (extraBlocks.length > 0) {
        newColumns[count - 1].blocks = [...newColumns[count - 1].blocks, ...extraBlocks];
      }
    }

    onChange({ columnCount: count, columns: newColumns });
  };

  const toggleContainerWidth = () => {
    const newWidth = block.containerWidth === 'full' ? 'boxed' : 'full';
    onChange({ containerWidth: newWidth });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative mb-2"
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {/* Hover Toolbar - Top Right Corner */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
        {/* Toggle button for text blocks */}
        {block.type === 'text' && block.style !== 'heading' && (
          <button
            onClick={() => setIsMarkdownMode(!isMarkdownMode)}
            className="p-2 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 rounded shadow-md border border-gray-200 dark:border-gray-700"
            title={isMarkdownMode ? "Switch to WYSIWYG Editor" : "Switch to Markdown Editor"}
          >
            {isMarkdownMode ? (
              <DocumentTextIcon className="w-4 h-4" />
            ) : (
              <CodeBracketIcon className="w-4 h-4" />
            )}
          </button>
        )}
        <button {...attributes} {...listeners} className="p-2 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded shadow-md cursor-grab active:cursor-grabbing border border-gray-200 dark:border-gray-700" title="Drag to reorder">
          <Bars3Icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
        <button onClick={onDelete} className="p-2 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 rounded shadow-md border border-gray-200 dark:border-gray-700" title="Delete block">
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Block Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus-within:border-primary-500 transition-colors">
        {block.type === 'columns' ? (
          <div>
            {/* Column controls */}
            <div className="flex gap-2 mb-4 justify-between pr-20">
              {/* Container width toggle */}
              <button
                onClick={toggleContainerWidth}
                className="px-3 py-1 rounded text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-1.5"
                title={block.containerWidth === 'boxed' ? 'Switch to full width' : 'Switch to boxed container'}
              >
                {block.containerWidth === 'boxed' ? (
                  <><FaCompress className="w-3.5 h-3.5" /> Boxed</>
                ) : (
                  <><FaExpand className="w-3.5 h-3.5" /> Full Width</>
                )}
              </button>

              {/* Column count selector */}
              <div className="flex gap-2">
                <button
                  onClick={() => changeColumnCount(1)}
                  className={`px-3 py-1 rounded text-sm ${
                    block.columnCount === 1
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  1 Col
                </button>
                <button
                  onClick={() => changeColumnCount(2)}
                  className={`px-3 py-1 rounded text-sm ${
                    block.columnCount === 2
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  2 Col
                </button>
                <button
                  onClick={() => changeColumnCount(3)}
                  className={`px-3 py-1 rounded text-sm ${
                    block.columnCount === 3
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  3 Col
                </button>
              </div>
            </div>

            {/* Columns with Drag & Drop */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(event: DragEndEvent) => {
                const { active, over } = event;
                if (!over) return;

                // Parse IDs: format is "columnIndex-blockId"
                const [activeColIdx, activeBlockId] = String(active.id).split('-');
                const activeColumnIndex = parseInt(activeColIdx);

                // Handle dropping on column container (empty area)
                if (String(over.id).startsWith('column-')) {
                  const overColumnIndex = parseInt(String(over.id).replace('column-', ''));

                  if (activeColumnIndex !== overColumnIndex) {
                    // Move to different column (append to end)
                    const sourceBlocks = [...block.columns[activeColumnIndex].blocks];
                    const blockIndex = sourceBlocks.findIndex((b: any) => b.id === activeBlockId);
                    const [movedBlock] = sourceBlocks.splice(blockIndex, 1);

                    const updatedColumns = [...block.columns];
                    updatedColumns[activeColumnIndex] = {
                      ...updatedColumns[activeColumnIndex],
                      blocks: sourceBlocks,
                    };
                    updatedColumns[overColumnIndex] = {
                      ...updatedColumns[overColumnIndex],
                      blocks: [...block.columns[overColumnIndex].blocks, movedBlock],
                    };
                    onChange({ columns: updatedColumns });
                  }
                  return;
                }

                const [overColIdx, overBlockId] = String(over.id).split('-');
                const overColumnIndex = parseInt(overColIdx);

                if (activeColumnIndex === overColumnIndex) {
                  // Reorder within same column
                  const columnBlocks = block.columns[activeColumnIndex].blocks;
                  const oldIndex = columnBlocks.findIndex((b: any) => b.id === activeBlockId);
                  const newIndex = columnBlocks.findIndex((b: any) => b.id === overBlockId);

                  if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                    const updatedColumns = [...block.columns];
                    updatedColumns[activeColumnIndex] = {
                      ...updatedColumns[activeColumnIndex],
                      blocks: arrayMove(columnBlocks, oldIndex, newIndex),
                    };
                    onChange({ columns: updatedColumns });
                  }
                } else {
                  // Move between columns
                  const sourceBlocks = [...block.columns[activeColumnIndex].blocks];
                  const targetBlocks = [...block.columns[overColumnIndex].blocks];
                  const blockIndex = sourceBlocks.findIndex((b: any) => b.id === activeBlockId);

                  if (blockIndex === -1) return;

                  const [movedBlock] = sourceBlocks.splice(blockIndex, 1);

                  const targetIndex = targetBlocks.findIndex((b: any) => b.id === overBlockId);
                  targetBlocks.splice(targetIndex >= 0 ? targetIndex : targetBlocks.length, 0, movedBlock);

                  const updatedColumns = [...block.columns];
                  updatedColumns[activeColumnIndex] = {
                    ...updatedColumns[activeColumnIndex],
                    blocks: sourceBlocks,
                  };
                  updatedColumns[overColumnIndex] = {
                    ...updatedColumns[overColumnIndex],
                    blocks: targetBlocks,
                  };
                  onChange({ columns: updatedColumns });
                }
              }}
            >
              <div className={block.containerWidth === 'boxed' ? 'max-w-6xl mx-auto' : ''}>
                <div className={`grid gap-4 ${
                  block.columnCount === 1 ? 'grid-cols-1' :
                  block.columnCount === 2 ? 'grid-cols-1 md:grid-cols-2' :
                  'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                }`}>
                {block.columns?.map((column: any, colIndex: number) => (
                  <SortableContext key={`sortable-${colIndex}`} items={column.blocks.map((b: any) => `${colIndex}-${b.id}`)} strategy={verticalListSortingStrategy}>
                    <div key={column.id} id={`column-${colIndex}`} className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 min-h-[200px]">
                      {column.blocks?.length === 0 ? (
                        <div className="h-full flex flex-wrap items-center justify-center gap-1.5">
                        <button onClick={() => addColumnBlock(colIndex, 'text')} className="flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-xs"><FaFont className="w-3 h-3" /> Text</button>
                        <button onClick={() => addColumnBlock(colIndex, 'image')} className="flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-xs"><FaImage className="w-3 h-3" /> Image</button>
                        <button onClick={() => addColumnBlock(colIndex, 'video')} className="flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-xs"><FaVideo className="w-3 h-3" /> Video</button>
                        <button onClick={() => addColumnBlock(colIndex, 'file')} className="flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-xs"><FaFileAlt className="w-3 h-3" /> File</button>
                        <button onClick={() => addColumnBlock(colIndex, 'button')} className="flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-xs"><FaMousePointer className="w-3 h-3" /> Button</button>
                        <button onClick={() => addColumnBlock(colIndex, 'divider')} className="flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-xs"><FaMinus className="w-3 h-3" /> Divider</button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {column.blocks.map((colBlock: any) => (
                            <DraggableColumnBlock
                              key={colBlock.id}
                              id={`${colIndex}-${colBlock.id}`}
                              block={colBlock}
                              onChange={(updates: any) => updateColumnBlock(colIndex, colBlock.id, updates)}
                              onDelete={() => deleteColumnBlock(colIndex, colBlock.id)}
                              onUpload={handleUpload}
                            />
                          ))}
                          <div className="flex flex-wrap gap-1 justify-center pt-2 border-t border-gray-200 dark:border-gray-700">
                            <button onClick={() => addColumnBlock(colIndex, 'text')} className="flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-xs"><PlusIcon className="w-3 h-3" /> Text</button>
                            <button onClick={() => addColumnBlock(colIndex, 'image')} className="flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-xs"><PlusIcon className="w-3 h-3" /> Image</button>
                            <button onClick={() => addColumnBlock(colIndex, 'video')} className="flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-xs"><PlusIcon className="w-3 h-3" /> Video</button>
                            <button onClick={() => addColumnBlock(colIndex, 'file')} className="flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-xs"><PlusIcon className="w-3 h-3" /> File</button>
                            <button onClick={() => addColumnBlock(colIndex, 'button')} className="flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-xs"><PlusIcon className="w-3 h-3" /> Button</button>
                            <button onClick={() => addColumnBlock(colIndex, 'divider')} className="flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-xs"><PlusIcon className="w-3 h-3" /> Divider</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </SortableContext>
                ))}
                </div>
              </div>
            </DndContext>
          </div>
        ) : block.type === 'text' ? (
          <div>
            {block.style === 'heading' ? (
              <input
                type="text"
                value={block.content}
                onChange={(e) => onChange({ content: e.target.value })}
                className="w-full text-4xl font-bold bg-transparent border-none outline-none text-gray-900 dark:text-white"
                placeholder="Title"
              />
            ) : isMarkdownMode ? (
              <textarea
                value={block.content || ''}
                onChange={(e) => onChange({ content: e.target.value })}
                className="w-full min-h-[150px] px-4 py-3 font-mono text-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-y"
                placeholder="Start writing in markdown..."
              />
            ) : (
              <RichTextEditor
                content={block.content || ''}
                onChange={(content) => onChange({ content })}
                placeholder="Start writing..."
              />
            )}
          </div>
        ) : block.type === 'badgeRow' ? (
          <div>
            <div className="flex flex-wrap gap-2 p-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900">
              {block.badges?.map((badge: any, badgeIndex: number) => (
                <div key={badgeIndex} className="relative group">
                  <img
                    src={badge.url}
                    alt={badge.caption || ''}
                    className="h-auto"
                    style={{ maxHeight: '28px' }}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
              Badge Row ({block.badges?.length || 0} badges) - Read-only from GitHub import
            </p>
          </div>
        ) : (
          <div>
            {block.url ? (
              <div className="flex flex-col items-center">
                <img
                  src={block.url}
                  alt={block.caption}
                  className="max-w-full h-auto rounded-lg mb-2"
                />
                <input
                  type="text"
                  value={block.caption || ''}
                  onChange={(e) => onChange({ caption: e.target.value })}
                  className="w-full text-sm text-center bg-transparent border-none outline-none text-gray-600 dark:text-gray-400"
                  placeholder="Add a caption..."
                />
              </div>
            ) : (
              <div>
                <div className="aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg flex flex-col items-center justify-center">
                  {isUploading ? (
                    <div className="text-gray-500">Uploading...</div>
                  ) : (
                    <>
                      <PhotoIcon className="w-12 h-12 text-gray-400 mb-2" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUpload(file);
                        }}
                        className="hidden"
                        id={`upload-${block.id}`}
                      />
                      <label
                        htmlFor={`upload-${block.id}`}
                        className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg cursor-pointer"
                      >
                        Upload Image
                      </label>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Draggable Column Block Wrapper
export function DraggableColumnBlock({ id, block, onChange, onDelete, onUpload }: DraggableColumnBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ColumnBlockEditor
        block={block}
        onChange={onChange}
        onDelete={onDelete}
        onUpload={onUpload}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

// Column Block Editor
export function ColumnBlockEditor({ block, onChange, onDelete, onUpload, dragHandleProps }: ColumnBlockEditorProps) {
  const [isUploading, setIsUploading] = useState(false);
  // Default to markdown mode for column text blocks
  const [isMarkdownMode, setIsMarkdownMode] = useState(true);

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const data = await uploadImage(file, 'projects', true);
      onChange({ url: data.url });
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(error.message || 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleVideoUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const data = await uploadFile(file, 'projects/videos', true);
      onChange({ url: data.url });
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(error.message || 'Failed to upload video');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="group/col relative bg-gray-50 dark:bg-gray-900/50 rounded p-2">
      {/* Drag handle */}
      {dragHandleProps && (
        <div
          {...dragHandleProps}
          className="absolute -left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/col:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 bg-gray-300 dark:bg-gray-600 rounded"
        >
          <Bars3Icon className="w-3 h-3 text-gray-600 dark:text-gray-400" />
        </div>
      )}

      {/* Toolbar - Top Right Corner */}
      <div className="absolute -top-1 -right-1 opacity-0 group-hover/col:opacity-100 transition-opacity flex gap-1 z-10">
        {/* Toggle button for text blocks */}
        {block.type === 'text' && (
          <button
            onClick={() => setIsMarkdownMode(!isMarkdownMode)}
            className="p-1 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 rounded shadow-sm border border-gray-200 dark:border-gray-700"
            title={isMarkdownMode ? "Switch to WYSIWYG Editor" : "Switch to Markdown Editor"}
          >
            {isMarkdownMode ? (
              <DocumentTextIcon className="w-3 h-3" />
            ) : (
              <CodeBracketIcon className="w-3 h-3" />
            )}
          </button>
        )}
        <button
          onClick={onDelete}
          className="p-1 bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/30 text-red-600 rounded shadow-sm border border-red-200 dark:border-red-800"
        >
          <TrashIcon className="w-3 h-3" />
        </button>
      </div>

      {block.type === 'text' ? (
        <div>
          {isMarkdownMode ? (
            <textarea
              value={block.content || ''}
              onChange={(e) => onChange({ content: e.target.value })}
              className="w-full min-h-[100px] px-3 py-2 font-mono text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-y"
              placeholder="Start writing in markdown..."
            />
          ) : (
            <RichTextEditor
              content={block.content || ''}
              onChange={(content) => onChange({ content })}
              placeholder="Start writing..."
              className="text-sm"
            />
          )}
        </div>
      ) : block.type === 'video' ? (
        <div>
          {block.url ? (
            <div>
              <video src={block.url} controls className="w-full rounded mb-1" />
              <input
                type="text"
                value={block.caption || ''}
                onChange={(e) => onChange({ caption: e.target.value })}
                className="w-full text-xs text-center bg-transparent border-none outline-none text-gray-600 dark:text-gray-400"
                placeholder="Caption..."
              />
            </div>
          ) : (
            <div className="aspect-video bg-gray-200 dark:bg-gray-700 rounded flex flex-col items-center justify-center">
              {isUploading ? (
                <div className="text-xs text-gray-500">Uploading...</div>
              ) : (
                <>
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/ogg"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleVideoUpload(file);
                    }}
                    className="hidden"
                    id={`col-upload-${block.id}`}
                  />
                  <label
                    htmlFor={`col-upload-${block.id}`}
                    className="px-2 py-1 bg-primary-500 hover:bg-primary-600 text-white rounded text-xs cursor-pointer"
                  >
                    Upload Video
                  </label>
                </>
              )}
            </div>
          )}
        </div>
      ) : block.type === 'image' ? (
        <div>
          {block.url ? (
            <div className="flex flex-col items-center">
              <img
                src={block.url}
                alt={block.caption}
                className="max-w-full h-auto rounded mb-1"
              />
              <input
                type="text"
                value={block.caption || ''}
                onChange={(e) => onChange({ caption: e.target.value })}
                className="w-full text-xs text-center bg-transparent border-none outline-none text-gray-600 dark:text-gray-400"
                placeholder="Caption..."
              />
            </div>
          ) : (
            <div className="aspect-video bg-gray-200 dark:bg-gray-700 rounded flex flex-col items-center justify-center">
              {isUploading ? (
                <div className="text-xs text-gray-500">Uploading...</div>
              ) : (
                <>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(file);
                    }}
                    className="hidden"
                    id={`col-upload-${block.id}`}
                  />
                  <label
                    htmlFor={`col-upload-${block.id}`}
                    className="px-2 py-1 bg-primary-500 hover:bg-primary-600 text-white rounded text-xs cursor-pointer"
                  >
                    Upload Image
                  </label>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-gray-500 p-2">
          Block type "{block.type}" not supported in columns yet
        </div>
      )}
    </div>
  );
}

// Slideshow Image Item with Drag-and-Drop
export function SlideshowImageItem({ id, imageUrl, index, onRemove }: SlideshowImageItemProps) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden"
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 z-10 p-2 bg-white/90 dark:bg-gray-800/90 rounded-lg cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
        title="Drag to reorder"
      >
        <Bars3Icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
      </div>

      <img
        src={imageUrl}
        alt={`Slideshow image ${index + 1}`}
        className="w-full h-full object-cover"
        onError={(e) => {
          (e.target as HTMLImageElement).src = '/allthrive-placeholder.svg';
        }}
      />

      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        <button
          onClick={onRemove}
          className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Remove
        </button>
      </div>

      <div className="absolute top-2 left-2 bg-black/70 text-white text-xs font-medium px-2 py-1 rounded">
        {index + 1}
      </div>
    </div>
  );
}

// Add Block Menu Component
export function AddBlockMenu({ show, onAdd, onToggle }: AddBlockMenuProps) {
  return (
    <div className="relative h-12 flex items-center justify-center group">
      <button
        onClick={onToggle}
        className="opacity-30 group-hover:opacity-100 transition-opacity p-2 bg-white dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-solid hover:border-primary-500"
      >
        <PlusIcon className="w-5 h-5 text-gray-400 group-hover:text-primary-500" />
      </button>

      {show && (
        <div className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-3 grid grid-cols-4 gap-2 z-10">
          <button
            onClick={() => onAdd('columns')}
            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm whitespace-nowrap"
          >
            <FaColumns className="w-3.5 h-3.5" /> Columns
          </button>
          <button
            onClick={() => onAdd('text')}
            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm whitespace-nowrap"
          >
            <FaFont className="w-3.5 h-3.5" /> Text
          </button>
          <button
            onClick={() => onAdd('image')}
            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm whitespace-nowrap"
          >
            <FaImage className="w-3.5 h-3.5" /> Image
          </button>
          <button
            onClick={() => onAdd('video')}
            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm whitespace-nowrap"
          >
            <FaVideo className="w-3.5 h-3.5" /> Video
          </button>
          <button
            onClick={() => onAdd('file')}
            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm whitespace-nowrap"
          >
            <FaFileAlt className="w-3.5 h-3.5" /> File
          </button>
          <button
            onClick={() => onAdd('button')}
            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm whitespace-nowrap"
          >
            <FaMousePointer className="w-3.5 h-3.5" /> Button
          </button>
          <button
            onClick={() => onAdd('divider')}
            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm whitespace-nowrap"
          >
            <FaMinus className="w-3.5 h-3.5" /> Divider
          </button>
        </div>
      )}
    </div>
  );
}
