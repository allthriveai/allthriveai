/**
 * CustomSection - Free-form content blocks for profile pages
 *
 * This component uses the same EditableBlocksContainer as project pages,
 * providing full block editing capabilities including text, images, videos,
 * diagrams, columns, and more.
 */

import { useCallback } from 'react';
import { marked } from 'marked';
import { sanitizeHtml } from '@/utils/sanitize';
import type { CustomSectionContent } from '@/types/profileSections';
import type { ProjectBlock } from '@/types/models';
import { EditableBlocksContainer } from '@/components/projects/shared/EditableBlocksContainer';

interface CustomSectionProps {
  content: CustomSectionContent;
  title?: string;
  isEditing?: boolean;
  onUpdate?: (content: CustomSectionContent) => void;
}

/**
 * Renders a single block in display mode (not editing)
 */
function renderBlock(block: ProjectBlock, index: number) {
  switch (block.type) {
    case 'text':
      return (
        <div
          key={block.id || index}
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
        <figure key={block.id || index} className="flex flex-col items-center">
          <img
            src={block.url || ''}
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
        <div key={block.id || index} className="flex flex-wrap items-center justify-center gap-2 my-4">
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
        <div key={block.id || index} className="my-6">
          {block.filename && (
            <div className="bg-gray-800 text-gray-300 px-4 py-2 rounded-t-lg text-sm font-mono">
              {block.filename}
            </div>
          )}
          <pre className={`bg-gray-900 text-gray-100 p-4 overflow-x-auto ${
            block.filename ? 'rounded-b-lg' : 'rounded-lg'
          }`}>
            <code className={`language-${block.language || 'text'} text-sm`}>
              {block.code || ''}
            </code>
          </pre>
        </div>
      );

    case 'video': {
      if (!block.url) return null;
      const videoUrl = block.url;
      // Check if it's an embed URL (YouTube, Vimeo, etc.)
      const isEmbed = videoUrl?.includes('youtube') || videoUrl?.includes('vimeo') || videoUrl?.includes('embed');

      if (isEmbed) {
        return (
          <figure key={block.id || index}>
            <div className="aspect-video">
              <iframe
                src={videoUrl}
                className="w-full h-full rounded-xl"
                allowFullScreen
              />
            </div>
            {block.caption && (
              <figcaption className="mt-2 text-sm text-center text-gray-600 dark:text-gray-400">
                {block.caption}
              </figcaption>
            )}
          </figure>
        );
      }

      return (
        <figure key={block.id || index}>
          <video
            src={videoUrl}
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
    }

    case 'button':
      if (!block.url) return null;
      return (
        <div key={block.id || index} className="text-center">
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
          key={block.id || index}
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
        <div key={block.id || index}>
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
          key={block.id || index}
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

    case 'mermaid':
      // For mermaid diagrams, we'd need a mermaid renderer
      // For now, show the code or a placeholder
      return (
        <div key={block.id || index} className="my-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <pre className="text-sm text-gray-600 dark:text-gray-400">
            {block.code || 'Diagram'}
          </pre>
          {block.caption && (
            <p className="mt-2 text-sm text-center text-gray-500">{block.caption}</p>
          )}
        </div>
      );

    case 'icon_card':
      return (
        <div key={block.id || index} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-gray-700 dark:text-gray-300">{block.text}</p>
        </div>
      );

    default:
      return null;
  }
}

export function CustomSection({ content, title, isEditing, onUpdate }: CustomSectionProps) {
  const blocks = content?.blocks || [];
  const sectionTitle = content?.title || title || 'Custom Section';

  const handleBlocksUpdate = useCallback((newBlocks: ProjectBlock[]) => {
    if (onUpdate) {
      onUpdate({ ...content, blocks: newBlocks });
    }
  }, [content, onUpdate]);

  const handleTitleUpdate = useCallback((newTitle: string) => {
    if (onUpdate) {
      onUpdate({ ...content, title: newTitle });
    }
  }, [content, onUpdate]);

  // If no content and not editing, show nothing
  if (blocks.length === 0 && !isEditing) {
    return null;
  }

  return (
    <div className="py-6">
      {/* Section Title */}
      {isEditing ? (
        <div className="flex items-center gap-4 mb-6">
          <input
            type="text"
            value={sectionTitle}
            onChange={(e) => handleTitleUpdate(e.target.value)}
            placeholder="Section Title"
            className="text-xl font-bold text-gray-900 dark:text-white bg-transparent border-b-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-primary-500 focus:outline-none flex-shrink-0"
          />
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
        </div>
      ) : (
        sectionTitle && (
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {sectionTitle}
            </h2>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
          </div>
        )
      )}

      {/* Content Blocks */}
      {isEditing ? (
        <EditableBlocksContainer
          blocks={blocks}
          onBlocksChange={handleBlocksUpdate}
          isEditing={true}
        />
      ) : (
        <div className="space-y-8">
          {blocks.map((block, index) => renderBlock(block as ProjectBlock, index))}
        </div>
      )}
    </div>
  );
}
