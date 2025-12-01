/**
 * EditableContentBlock - Reusable inline-editable content block renderer
 *
 * Renders content blocks (text, image, mermaid, video) with inline editing
 * capabilities for project owners. Used across all project layouts.
 */

import { useState, useCallback } from 'react';
import { marked } from 'marked';
import { sanitizeHtml } from '@/utils/sanitize';
import { updateProject } from '@/services/projects';
import { MermaidDiagram } from './MermaidDiagram';
import { InlineEditableText } from './InlineEditable';
import { EditableColumnsBlock } from './EditableColumnsBlock';
import type { Project, ProjectBlock, ColumnBlock } from '@/types/models';

// Configure marked options
marked.setOptions({
  breaks: true,
  gfm: true,
});

// ============================================================================
// Types
// ============================================================================

interface EditableContentBlockProps {
  block: ProjectBlock;
  index: number;
  project: Project;
  isOwner: boolean;
  onProjectUpdate: (project: Project) => void;
  // Optional props for blocks nested within columns
  columnIndex?: number;
  nestedBlockIndex?: number;
  columnsBlock?: Extract<ProjectBlock, { type: 'columns' }>;
}

// ============================================================================
// Main Component
// ============================================================================

export function EditableContentBlock({
  block,
  index,
  project,
  isOwner,
  onProjectUpdate,
  columnIndex,
  nestedBlockIndex,
  columnsBlock,
}: EditableContentBlockProps) {
  const [isSaving, setIsSaving] = useState(false);

  // Check if this is a nested block within a column
  const isNestedInColumn = columnIndex !== undefined && nestedBlockIndex !== undefined && columnsBlock;

  // Handle content block updates
  const handleBlockChange = useCallback(
    async (field: string, newValue: string) => {
      setIsSaving(true);
      try {
        let updatedBlocks: ProjectBlock[];

        if (isNestedInColumn) {
          // Update a block nested within a column
          const updatedColumns = columnsBlock.columns.map((col, colIdx) => {
            if (colIdx === columnIndex) {
              return {
                ...col,
                blocks: col.blocks.map((b, blockIdx) => {
                  if (blockIdx === nestedBlockIndex) {
                    return { ...b, [field]: newValue };
                  }
                  return b;
                }),
              };
            }
            return col;
          });

          updatedBlocks = (project.content?.blocks || []).map((b, idx) => {
            if (idx === index) {
              return { ...columnsBlock, columns: updatedColumns };
            }
            return b;
          });
        } else {
          // Update a top-level block
          const currentBlocks = project.content?.blocks || [];
          updatedBlocks = currentBlocks.map((b, idx) => {
            if (idx === index) {
              return { ...b, [field]: newValue };
            }
            return b;
          });
        }

        const updated = await updateProject(project.id, {
          content: { ...project.content, blocks: updatedBlocks },
        });
        onProjectUpdate(updated);
      } catch (error) {
        console.error('Failed to update block:', error);
        throw error; // Re-throw so InlineEditableText can show error
      } finally {
        setIsSaving(false);
      }
    },
    [project.id, project.content, index, onProjectUpdate, isNestedInColumn, columnIndex, nestedBlockIndex, columnsBlock]
  );

  // Columns block - render with EditableColumnsBlock
  if (block.type === 'columns') {
    const columnsBlockTyped = block as Extract<ProjectBlock, { type: 'columns' }>;
    return (
      <EditableColumnsBlock
        block={columnsBlockTyped}
        blockIndex={index}
        project={project}
        isOwner={isOwner}
        onProjectUpdate={onProjectUpdate}
      />
    );
  }

  // Text block
  if (block.type === 'text') {
    const textBlock = block as Extract<ProjectBlock, { type: 'text' }>;
    const styleClasses =
      textBlock.style === 'heading'
        ? 'text-2xl font-bold'
        : textBlock.style === 'quote'
        ? 'border-l-4 border-primary-500 pl-6 italic'
        : '';

    if (isOwner) {
      return (
        <div className="relative">
          <InlineEditableText
            value={textBlock.content || ''}
            isEditable={isOwner}
            onChange={(newValue) => handleBlockChange('content', newValue)}
            placeholder="Click to add text..."
            className={`prose dark:prose-invert max-w-none ${styleClasses}`}
            multiline
            rows={4}
          />
          {isSaving && (
            <span className="absolute top-0 right-0 text-xs text-gray-400 animate-pulse">
              Saving...
            </span>
          )}
        </div>
      );
    }

    return (
      <div
        className={`prose dark:prose-invert max-w-none ${styleClasses}`}
        dangerouslySetInnerHTML={{
          __html: sanitizeHtml(marked.parse(textBlock.content || '') as string),
        }}
      />
    );
  }

  // Image block
  if (block.type === 'image') {
    const imageBlock = block as Extract<ProjectBlock, { type: 'image' }>;
    if (!imageBlock.url) return null;

    return (
      <figure className="flex flex-col items-center">
        <img
          src={imageBlock.url}
          alt={imageBlock.caption || ''}
          className="max-w-full lg:max-w-3xl h-auto rounded-xl shadow-lg"
        />
        {(imageBlock.caption || isOwner) &&
          (isOwner ? (
            <InlineEditableText
              value={imageBlock.caption || ''}
              isEditable={isOwner}
              onChange={(newValue) => handleBlockChange('caption', newValue)}
              placeholder="Add a caption..."
              className="mt-2 text-sm text-center text-gray-600 dark:text-gray-400"
            />
          ) : (
            <figcaption className="mt-2 text-sm text-center text-gray-600 dark:text-gray-400">
              {imageBlock.caption}
            </figcaption>
          ))}
      </figure>
    );
  }

  // Mermaid diagram block
  if (block.type === 'mermaid') {
    const mermaidBlock = block as Extract<ProjectBlock, { type: 'mermaid' }>;
    if (!mermaidBlock.code) return null;

    return (
      <div className="my-8">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-lg overflow-x-auto">
          <MermaidDiagram code={mermaidBlock.code} caption={mermaidBlock.caption} />
          {isOwner && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                Edit Mermaid Code:
              </p>
              <InlineEditableText
                value={mermaidBlock.code}
                isEditable={isOwner}
                onChange={(newValue) => handleBlockChange('code', newValue)}
                placeholder="Enter mermaid diagram code..."
                className="font-mono text-sm text-gray-800 dark:text-gray-200"
                multiline
                rows={6}
              />
            </div>
          )}
        </div>
        {(mermaidBlock.caption || isOwner) &&
          (isOwner ? (
            <InlineEditableText
              value={mermaidBlock.caption || ''}
              isEditable={isOwner}
              onChange={(newValue) => handleBlockChange('caption', newValue)}
              placeholder="Add a caption..."
              className="mt-2 text-sm text-center text-gray-600 dark:text-gray-400"
            />
          ) : mermaidBlock.caption ? (
            <p className="mt-2 text-sm text-center text-gray-600 dark:text-gray-400">
              {mermaidBlock.caption}
            </p>
          ) : null)}
      </div>
    );
  }

  // Video block
  if (block.type === 'video') {
    const videoBlock = block as Extract<ProjectBlock, { type: 'video' }>;
    if (!videoBlock.url) return null;

    return (
      <figure>
        <video
          src={videoBlock.url}
          controls
          loop
          muted
          playsInline
          className="w-full rounded-xl"
        />
        {(videoBlock.caption || isOwner) &&
          (isOwner ? (
            <InlineEditableText
              value={videoBlock.caption || ''}
              isEditable={isOwner}
              onChange={(newValue) => handleBlockChange('caption', newValue)}
              placeholder="Add a caption..."
              className="mt-2 text-sm text-center text-gray-600 dark:text-gray-400"
            />
          ) : (
            <figcaption className="mt-2 text-sm text-center text-gray-600 dark:text-gray-400">
              {videoBlock.caption}
            </figcaption>
          ))}
      </figure>
    );
  }

  return null;
}
