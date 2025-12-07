import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ProjectBlock } from '@/types/models';
import {
  Bars3Icon,
  TrashIcon,
  PencilIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';
import { MermaidBlock, CodeSnippetBlock } from './MermaidBlock';

interface BlockProps {
  block: ProjectBlock & { id: string };
  onUpdate: (id: string, block: ProjectBlock) => void;
  onDelete: (id: string) => void;
}

/**
 * Wrapper for sortable blocks with drag handle
 */
function SortableBlock({
  id,
  children
}: {
  id: string;
  children: React.ReactNode;
}) {
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
      className="group relative mb-4"
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute -left-8 top-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <Bars3Icon className="w-5 h-5 text-gray-400" />
      </div>

      {children}
    </div>
  );
}

/**
 * Text Block - for headings, paragraphs, quotes
 */
export function TextBlock({ block, onUpdate, onDelete }: BlockProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(block.type === 'text' ? block.content : '');
  const [style, setStyle] = useState(block.type === 'text' ? block.style : 'body');

  const handleSave = () => {
    onUpdate(block.id, {
      type: 'text',
      content,
      style: style as 'body' | 'heading' | 'quote',
    });
    setIsEditing(false);
  };

  return (
    <SortableBlock id={block.id}>
      <div className="glass-subtle rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        {/* Controls */}
        <div className="flex items-center justify-between mb-3">
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value as 'body' | 'heading' | 'quote')}
            className="text-sm px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
          >
            <option value="body">Paragraph</option>
            <option value="heading">Heading</option>
            <option value="quote">Quote</option>
          </select>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              <PencilIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(block.id)}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 rounded"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        {isEditing ? (
          <div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={style === 'heading' ? 2 : 4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Enter text..."
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={handleSave}
                className="px-3 py-1 bg-primary-500 hover:bg-primary-600 text-white text-sm rounded"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white text-sm rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`${
              style === 'heading'
                ? 'text-2xl font-bold'
                : style === 'quote'
                ? 'border-l-4 border-primary-500 pl-4 italic'
                : ''
            } text-gray-900 dark:text-white`}
          >
            {content || <span className="text-gray-400">Empty text block</span>}
          </div>
        )}
      </div>
    </SortableBlock>
  );
}

/**
 * Image Block - single image with caption
 */
export function ImageBlock({ block, onUpdate, onDelete }: BlockProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [url, setUrl] = useState(block.type === 'image' ? block.url : '');
  const [caption, setCaption] = useState(block.type === 'image' ? (block.caption || '') : '');
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('is_public', 'true');

      const response = await fetch('/api/v1/upload/image/', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();
      setUrl(data.url);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = () => {
    onUpdate(block.id, {
      type: 'image',
      url,
      caption,
    });
    setIsEditing(false);
  };

  return (
    <SortableBlock id={block.id}>
      <div className="glass-subtle rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        {/* Controls */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Image
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              <PencilIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(block.id)}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 rounded"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Image */}
        {url ? (
          <div>
            <img
              src={url}
              alt={caption || 'Image'}
              className="w-full rounded-lg mb-2"
            />
            {caption && (
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                {caption}
              </p>
            )}
          </div>
        ) : (
          <div className="aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
            <PhotoIcon className="w-16 h-16 text-gray-400" />
          </div>
        )}

        {/* Edit Mode */}
        {isEditing && (
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                Upload Image
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                disabled={isUploading}
                className="w-full text-sm"
              />
              {isUploading && (
                <p className="text-sm text-gray-500 mt-1">Uploading...</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Caption (optional)
              </label>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                placeholder="Image caption..."
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="px-3 py-1 bg-primary-500 hover:bg-primary-600 text-white text-sm rounded"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white text-sm rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </SortableBlock>
  );
}

/**
 * Render the appropriate block component based on type
 */
export function BlockRenderer({ block, onUpdate, onDelete }: BlockProps) {
  if (block.type === 'text') {
    return <TextBlock block={block} onUpdate={onUpdate} onDelete={onDelete} />;
  } else if (block.type === 'image') {
    return <ImageBlock block={block} onUpdate={onUpdate} onDelete={onDelete} />;
  } else if (block.type === 'mermaid') {
    return <MermaidBlock block={block} onUpdate={onUpdate} onDelete={onDelete} />;
  } else if (block.type === 'code_snippet') {
    return <CodeSnippetBlock block={block} onUpdate={onUpdate} onDelete={onDelete} />;
  }

  return null;
}
