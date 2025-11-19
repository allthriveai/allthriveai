import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { listProjects, updateProject } from '@/services/projects';
import { uploadImage } from '@/services/upload';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import type { Project, ProjectBlock } from '@/types/models';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowLeftIcon,
  EyeIcon,
  PlusIcon,
  Bars3Icon,
  TrashIcon,
  PhotoIcon,
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
  FaCompress
} from 'react-icons/fa';

export default function ProjectEditorPage() {
  const { username, projectSlug } = useParams<{ username: string; projectSlug: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Editor state - stored directly as we edit
  const [blocks, setBlocks] = useState<any[]>([]);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState<string | null>(null); // Block ID to show menu after

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Load project
  useEffect(() => {
    async function loadProject() {
      if (!projectSlug || !username) {
        setError('Invalid project URL');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const projects = await listProjects();
        const foundProject = projects.find(p => p.slug === projectSlug && p.username === username);

        if (!foundProject) {
          setError('Project not found');
          return;
        }

        setProject(foundProject);

        // Initialize blocks
        const blocksWithIds = (foundProject.content.blocks || []).map((block: any) => ({
          ...block,
          id: block.id || crypto.randomUUID(),
        }));

        // If no blocks, start with a title block
        if (blocksWithIds.length === 0) {
          blocksWithIds.push({
            id: crypto.randomUUID(),
            type: 'text',
            content: foundProject.title || 'Untitled Project',
            style: 'heading',
          });
        }

        setBlocks(blocksWithIds);
      } catch (err) {
        console.error('Failed to load project:', err);
        setError('Failed to load project');
      } finally {
        setIsLoading(false);
      }
    }

    loadProject();
  }, [projectSlug, username]);

  const handleSave = async () => {
    if (!project) return;

    setIsSaving(true);
    try {
      // Extract title from first heading block
      const titleBlock = blocks.find(b => b.type === 'text' && b.style === 'heading');
      const title = titleBlock?.content || 'Untitled Project';

      const updatedProject = await updateProject(project.id, {
        title,
        content: {
          blocks: blocks.map(({ id, ...block }) => block), // Remove IDs before saving
        },
      });
      setProject(updatedProject);
      setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to save:', err);
      alert('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!project) return;

    if (!window.confirm('Publish this project? It will be visible to everyone.')) {
      return;
    }

    await handleSave(); // Save first

    setIsSaving(true);
    try {
      const updatedProject = await updateProject(project.id, {
        isPublished: true,
      });
      setProject(updatedProject);
      alert('Project published successfully!');
      navigate(`/${project.username}/${project.slug}`);
    } catch (err) {
      console.error('Failed to publish:', err);
      alert('Failed to publish project');
    } finally {
      setIsSaving(false);
    }
  };

  const addBlock = (afterId: string | null, type: 'text' | 'image' | 'columns' | 'video' | 'file' | 'button' | 'divider') => {
    const newBlock: any = {
      id: crypto.randomUUID(),
      type,
    };

    if (type === 'text') {
      newBlock.content = '';
      newBlock.style = 'body';
    } else if (type === 'image') {
      newBlock.url = '';
      newBlock.caption = '';
    } else if (type === 'columns') {
      newBlock.columnCount = 2;
      newBlock.containerWidth = 'full';  // full or boxed
      newBlock.columns = [
        { id: crypto.randomUUID(), blocks: [] },
        { id: crypto.randomUUID(), blocks: [] },
      ];
    } else if (type === 'video') {
      newBlock.url = '';
      newBlock.embedUrl = '';  // For YouTube/Vimeo
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
      newBlock.style = 'primary';  // primary, secondary, outline
      newBlock.size = 'medium';  // small, medium, large
    } else if (type === 'divider') {
      newBlock.style = 'line';  // line, dotted, dashed, space
    }

    if (afterId === null) {
      setBlocks([...blocks, newBlock]);
    } else {
      const index = blocks.findIndex(b => b.id === afterId);
      const newBlocks = [...blocks];
      newBlocks.splice(index + 1, 0, newBlock);
      setBlocks(newBlocks);
    }

    setShowAddMenu(null);
    setTimeout(() => setFocusedBlockId(newBlock.id), 100);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading editor...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !project) {
    return (
      <DashboardLayout>
        <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900 p-8">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              {error || 'Project Not Found'}
            </h1>
            <Link
              to={`/${username}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              Back to Profile
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to={`/${username}`}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              {blocks.find(b => b.type === 'text' && b.style === 'heading')?.content || 'Untitled Project'}
            </h1>
            {lastSaved && (
              <p className="text-xs text-gray-500">Saved {lastSaved.toLocaleTimeString()}</p>
            )}
          </div>
          {!project.isPublished && (
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
              Draft
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.open(`/${project.username}/${project.slug}`, '_blank')}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <EyeIcon className="w-5 h-5" />
            Preview
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-gray-900 dark:bg-gray-700 hover:bg-gray-800 text-white rounded-lg disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          {!project.isPublished && (
            <button
              onClick={handlePublish}
              disabled={isSaving}
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg disabled:opacity-50"
            >
              Publish
            </button>
          )}
        </div>
      </div>

      {/* Editor Canvas */}
      <div className="flex-1 overflow-y-auto">
        <div className="py-12 px-8">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event) => {
              const { active, over } = event;
              if (!over || active.id === over.id) return;

              const oldIndex = blocks.findIndex(b => b.id === active.id);
              const newIndex = blocks.findIndex(b => b.id === over.id);
              setBlocks(arrayMove(blocks, oldIndex, newIndex));
            }}
          >
            <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
              {blocks.map((block, index) => (
                <div key={block.id}>
                  <BlockEditor
                    block={block}
                    isFocused={focusedBlockId === block.id}
                    onFocus={() => setFocusedBlockId(block.id)}
                    onBlur={() => setFocusedBlockId(null)}
                    onChange={(updated) => {
                      setBlocks(blocks.map(b => b.id === block.id ? { ...block, ...updated } : b));
                    }}
                    onDelete={() => {
                      if (blocks.length === 1) {
                        alert('Cannot delete the last block');
                        return;
                      }
                      setBlocks(blocks.filter(b => b.id !== block.id));
                    }}
                  />

                  {/* Add Block Menu */}
                  <AddBlockMenu
                    show={showAddMenu === block.id}
                    onAdd={(type) => addBlock(block.id, type)}
                    onToggle={() => setShowAddMenu(showAddMenu === block.id ? null : block.id)}
                  />
                </div>
              ))}
            </SortableContext>
          </DndContext>

          {/* Add block at end */}
          {blocks.length === 0 && (
            <button
              onClick={() => addBlock(null, 'text')}
              className="w-full py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-gray-500 hover:border-primary-500 hover:text-primary-500 transition-colors"
            >
              Click to add your first block
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Block Editor Component
function BlockEditor({ block, isFocused, onFocus, onBlur, onChange, onDelete }: any) {
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
      {/* Hover Toolbar */}
      <div className="absolute -left-12 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
        <button {...attributes} {...listeners} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded cursor-grab active:cursor-grabbing">
          <Bars3Icon className="w-4 h-4 text-gray-400" />
        </button>
        <button onClick={onDelete} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 rounded">
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Block Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus-within:border-primary-500 transition-colors">
        {block.type === 'columns' ? (
          <div>
            {/* Column controls */}
            <div className="flex gap-2 mb-4 justify-between">
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
                const [overColIdx, overBlockId] = String(over.id).split('-');
                const activeColumnIndex = parseInt(activeColIdx);
                const overColumnIndex = parseInt(overColIdx);

                if (activeColumnIndex === overColumnIndex) {
                  // Reorder within same column
                  const columnBlocks = block.columns[activeColumnIndex].blocks;
                  const oldIndex = columnBlocks.findIndex((b: any) => b.id === activeBlockId);
                  const newIndex = columnBlocks.findIndex((b: any) => b.id === overBlockId);

                  if (oldIndex !== newIndex) {
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
                  <div key={column.id} className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 min-h-[200px]">
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
                      <SortableContext items={column.blocks.map((b: any) => `${colIndex}-${b.id}`)} strategy={verticalListSortingStrategy}>
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
                      </SortableContext>
                    )}
                  </div>
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
            ) : (
              <RichTextEditor
                content={block.content || ''}
                onChange={(content) => onChange({ content })}
                placeholder="Start writing..."
              />
            )}
          </div>
        ) : (
          <div>
            {block.url ? (
              <div>
                <img src={block.url} alt={block.caption} className="w-full rounded-lg mb-2" />
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
function DraggableColumnBlock({ id, block, onChange, onDelete, onUpload }: any) {
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
function ColumnBlockEditor({ block, onChange, onDelete, onUpload, dragHandleProps }: any) {
  const [isUploading, setIsUploading] = useState(false);

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

      <button
        onClick={onDelete}
        className="absolute -top-1 -right-1 opacity-0 group-hover/col:opacity-100 transition-opacity p-1 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-full"
      >
        <TrashIcon className="w-3 h-3" />
      </button>

      {block.type === 'text' ? (
        <RichTextEditor
          content={block.content || ''}
          onChange={(content) => onChange({ content })}
          placeholder="Start writing..."
          className="text-sm"
        />
      ) : (
        <div>
          {block.url ? (
            <div>
              <img src={block.url} alt={block.caption} className="w-full rounded mb-1" />
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
                    Upload
                  </label>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Add Block Menu Component
function AddBlockMenu({ show, onAdd, onToggle }: any) {
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
