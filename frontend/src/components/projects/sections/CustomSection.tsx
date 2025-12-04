/**
 * CustomSection - Free-form blocks for flexibility
 *
 * This section renders the legacy block types for backwards compatibility
 * and for content that doesn't fit into structured sections.
 *
 * Supports inline editing when isEditing=true for owners.
 */

import { useCallback } from 'react';
import { marked } from 'marked';
import { sanitizeHtml } from '@/utils/sanitize';
import { InlineEditableTitle } from '../shared/InlineEditable';
import { EditableBlocksContainer } from '../shared/EditableBlocksContainer';
import type { CustomSectionContent } from '@/types/sections';
import type { ProjectBlock } from '@/types/models';

interface CustomSectionProps {
  content: CustomSectionContent;
  isEditing?: boolean;
  onUpdate?: (content: CustomSectionContent) => void;
}

function renderBlock(block: ProjectBlock, index: number) {
  switch (block.type) {
    case 'text':
      return (
        <div
          key={index}
          className={`prose dark:prose-invert max-w-none ${
            block.style === 'heading' ? 'text-2xl font-bold' :
            block.style === 'quote' ? 'border-l-4 border-primary-500 pl-6 italic' :
            ''
          }`}
          dangerouslySetInnerHTML={{
            __html: sanitizeHtml(marked.parse(block.content || '') as string)
          }}
        />
      );

    case 'image':
      return (
        <figure key={index} className="flex flex-col items-center">
          <img
            src={block.url}
            alt={block.caption || ''}
            className="max-w-full lg:max-w-3xl h-auto rounded-xl shadow-lg"
          />
          {block.caption && (
            <figcaption className="mt-2 text-sm text-center text-gray-600 dark:text-gray-400">
              {block.caption}
            </figcaption>
          )}
        </figure>
      );

    case 'badgeRow':
      if (!block.badges) return null;
      return (
        <div key={index} className="flex flex-wrap items-center justify-center gap-2 my-4">
          {block.badges.map((badge: any, badgeIndex: number) => (
            <img
              key={badgeIndex}
              src={badge.url}
              alt={badge.caption || ''}
              className="h-auto"
              style={{ maxHeight: '28px' }}
            />
          ))}
        </div>
      );

    case 'code_snippet':
      return (
        <div key={index} className="my-6">
          {block.filename && (
            <div className="bg-gray-800 text-gray-300 px-4 py-2 rounded-t-lg text-sm font-mono">
              {block.filename}
            </div>
          )}
          <pre className={`bg-gray-900 text-gray-100 p-4 overflow-x-auto ${
            block.filename ? 'rounded-b-lg' : 'rounded-lg'
          }`}>
            <code className={`language-${block.language} text-sm`}>
              {block.code}
            </code>
          </pre>
        </div>
      );

    case 'video':
      if (!block.url) return null;
      return (
        <figure key={index}>
          <video
            src={block.url}
            controls
            autoPlay
            loop
            muted
            playsInline
            className="w-full rounded-xl"
          />
          {block.caption && (
            <figcaption className="mt-2 text-sm text-center text-gray-600 dark:text-gray-400">
              {block.caption}
            </figcaption>
          )}
        </figure>
      );

    case 'button':
      if (!block.url) return null;
      return (
        <div key={index} className="text-center">
          <a
            href={block.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-2 rounded-lg font-medium transition-colors ${
              block.size === 'small' ? 'px-4 py-2 text-sm' :
              block.size === 'large' ? 'px-8 py-4 text-lg' :
              'px-6 py-3'
            } ${
              block.style === 'primary' ? 'bg-primary-500 hover:bg-primary-600 text-white' :
              block.style === 'secondary' ? 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white' :
              'border-2 border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-primary-600 dark:text-primary-400'
            }`}
          >
            {block.text}
          </a>
        </div>
      );

    case 'divider':
      return (
        <hr
          key={index}
          className={`border-gray-300 dark:border-gray-700 ${
            block.style === 'dotted' ? 'border-dotted border-t-2' :
            block.style === 'dashed' ? 'border-dashed border-t-2' :
            block.style === 'space' ? 'border-transparent my-12' :
            'border-t'
          }`}
        />
      );

    case 'imageGrid':
      if (!block.images) return null;
      return (
        <div key={index}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {block.images.map((img: any, imgIndex: number) => (
              <figure key={imgIndex}>
                <img
                  src={img.url}
                  alt={img.caption || ''}
                  className="w-full h-48 object-cover rounded-lg"
                />
                {img.caption && (
                  <figcaption className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                    {img.caption}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
          {block.caption && (
            <p className="mt-4 text-sm text-center text-gray-600 dark:text-gray-400">
              {block.caption}
            </p>
          )}
        </div>
      );

    case 'columns':
      return (
        <div
          key={index}
          className={block.containerWidth === 'boxed' ? 'max-w-4xl mx-auto' : 'w-full'}
        >
          <div className={`grid gap-6 ${
            block.columnCount === 1 ? 'grid-cols-1' :
            block.columnCount === 2 ? 'grid-cols-1 md:grid-cols-2' :
            'grid-cols-1 md:grid-cols-3'
          }`}>
            {block.columns?.map((column: any, colIndex: number) => (
              <div key={colIndex} className="space-y-4">
                {column.blocks?.map((nestedBlock: any, nestedIndex: number) =>
                  renderBlock(nestedBlock, nestedIndex)
                )}
              </div>
            ))}
          </div>
        </div>
      );

    default:
      return null;
  }
}

export function CustomSection({ content, isEditing, onUpdate }: CustomSectionProps) {
  const { title, blocks } = content;

  const handleTitleChange = useCallback(
    async (newTitle: string) => {
      if (onUpdate) {
        onUpdate({ ...content, title: newTitle });
      }
    },
    [content, onUpdate]
  );

  const handleBlocksChange = useCallback(
    (newBlocks: ProjectBlock[]) => {
      if (onUpdate) {
        onUpdate({ ...content, blocks: newBlocks });
      }
    },
    [content, onUpdate]
  );

  // Allow empty in edit mode
  if ((!blocks || blocks.length === 0) && !isEditing) {
    return null;
  }

  // In edit mode, use EditableBlocksContainer for full block editing
  if (isEditing) {
    return (
      <section className="project-section" data-section-type="custom">
        {/* Section Header with editable title */}
        <div className="flex items-center gap-4 mb-8">
          <InlineEditableTitle
            value={title || 'Custom Section'}
            isEditable={isEditing}
            onChange={handleTitleChange}
            placeholder="Section title..."
            className="text-2xl font-bold text-gray-900 dark:text-white"
            as="h2"
          />
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
        </div>

        {/* Editable Blocks */}
        <EditableBlocksContainer
          blocks={blocks || []}
          onBlocksChange={handleBlocksChange}
          isEditing={isEditing}
        />
      </section>
    );
  }

  return (
    <section className="project-section" data-section-type="custom">
      {/* Section Header (optional title) */}
      {title && (
        <div className="flex items-center gap-4 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
        </div>
      )}

      {/* Blocks */}
      <div className="space-y-8">
        {blocks?.map((block, index) => renderBlock(block, index))}
      </div>
    </section>
  );
}
