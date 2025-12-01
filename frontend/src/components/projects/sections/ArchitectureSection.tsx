/**
 * ArchitectureSection - System architecture diagram with Mermaid
 *
 * Supports inline editing when isEditing=true for owners.
 */

import { useCallback } from 'react';
import type { ArchitectureSectionContent } from '@/types/sections';
import { MermaidDiagram } from '../shared/MermaidDiagram';
import { InlineEditableTitle, InlineEditableText } from '../shared/InlineEditable';

interface ArchitectureSectionProps {
  content: ArchitectureSectionContent;
  isEditing?: boolean;
  onUpdate?: (content: ArchitectureSectionContent) => void;
}

export function ArchitectureSection({ content, isEditing, onUpdate }: ArchitectureSectionProps) {
  const { diagram, description, title } = content;

  const handleTitleChange = useCallback(
    async (newTitle: string) => {
      if (onUpdate) {
        onUpdate({ ...content, title: newTitle });
      }
    },
    [content, onUpdate]
  );

  const handleDiagramChange = useCallback(
    async (newDiagram: string) => {
      if (onUpdate) {
        onUpdate({ ...content, diagram: newDiagram });
      }
    },
    [content, onUpdate]
  );

  const handleDescriptionChange = useCallback(
    async (newDescription: string) => {
      if (onUpdate) {
        onUpdate({ ...content, description: newDescription });
      }
    },
    [content, onUpdate]
  );

  // Allow empty diagram in edit mode
  if (!diagram && !isEditing) {
    return null;
  }

  return (
    <section className="project-section" data-section-type="architecture">
      {/* Section Header */}
      <div className="flex items-center gap-4 mb-8">
        {isEditing ? (
          <InlineEditableTitle
            value={title || 'System Architecture'}
            isEditable={true}
            onChange={handleTitleChange}
            placeholder="Section title..."
            className="text-2xl font-bold text-gray-900 dark:text-white"
            as="h2"
          />
        ) : (
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {title || 'System Architecture'}
          </h2>
        )}
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
      </div>

      {/* Diagram Container */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Diagram */}
        <div className="p-6 md:p-8 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-900">
          {diagram ? (
            <MermaidDiagram code={diagram} />
          ) : isEditing ? (
            <div className="text-center py-8 text-gray-400">
              Add a Mermaid diagram below
            </div>
          ) : null}
        </div>

        {/* Mermaid Code Editor (editing mode only) */}
        {isEditing && (
          <div className="px-6 md:px-8 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-100/50 dark:bg-gray-800/50">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Mermaid Diagram Code
            </p>
            <InlineEditableText
              value={diagram || ''}
              isEditable={true}
              onChange={handleDiagramChange}
              placeholder="graph TD\n    A[Start] --> B[End]"
              className="font-mono text-sm text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
              multiline
              rows={6}
            />
          </div>
        )}

        {/* Description */}
        {(description || isEditing) && (
          <div className="px-6 md:px-8 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
            {isEditing ? (
              <InlineEditableText
                value={description || ''}
                isEditable={true}
                onChange={handleDescriptionChange}
                placeholder="Add a description of the architecture..."
                className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed"
                multiline
                rows={2}
              />
            ) : (
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                {description}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
