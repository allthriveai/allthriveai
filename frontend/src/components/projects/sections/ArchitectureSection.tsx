/**
 * ArchitectureSection - System architecture diagram with Mermaid
 */

import type { ArchitectureSectionContent } from '@/types/sections';
import { MermaidDiagram } from '../shared';

interface ArchitectureSectionProps {
  content: ArchitectureSectionContent;
  isEditing?: boolean;
  onUpdate?: (content: ArchitectureSectionContent) => void;
}

export function ArchitectureSection({ content }: ArchitectureSectionProps) {
  const { diagram, description, title } = content;

  if (!diagram) {
    return null;
  }

  return (
    <section className="project-section" data-section-type="architecture">
      {/* Section Header */}
      <div className="flex items-center gap-4 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {title || 'System Architecture'}
        </h2>
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
      </div>

      {/* Diagram Container */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Diagram */}
        <div className="p-6 md:p-8 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-900">
          <MermaidDiagram code={diagram} />
        </div>

        {/* Description */}
        {description && (
          <div className="px-6 md:px-8 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
              {description}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
