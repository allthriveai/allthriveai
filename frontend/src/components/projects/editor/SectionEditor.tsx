/**
 * SectionEditor - Wrapper component for editing individual sections
 *
 * This component:
 * - Provides the drag handle and section chrome (header, controls)
 * - Renders the appropriate section-specific editor based on type
 * - Handles section enable/disable toggle
 * - Handles section deletion
 *
 * Each section type has its own editor component that handles
 * the specific content editing for that type.
 */

import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Bars3Icon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DocumentTextIcon,
  SparklesIcon,
  CodeBracketIcon,
  PhotoIcon,
  CubeTransparentIcon,
  PlayCircleIcon,
  LightBulbIcon,
  LinkIcon,
  PlusCircleIcon,
  ArrowUpIcon,
} from '@heroicons/react/24/outline';
import { useSectionEditorContext } from '@/context/SectionEditorContext';
import type {
  ProjectSection,
  SectionType,
  SectionContent,
  FeaturesSectionContent,
} from '@/types/sections';
import { FeaturesSection } from '../sections/FeaturesSection';

// ============================================================================
// Section Icon Map
// ============================================================================

const SECTION_ICONS: Record<SectionType, React.ComponentType<{ className?: string }>> = {
  overview: DocumentTextIcon,
  features: SparklesIcon,
  tech_stack: CodeBracketIcon,
  gallery: PhotoIcon,
  architecture: CubeTransparentIcon,
  demo: PlayCircleIcon,
  challenges: LightBulbIcon,
  links: LinkIcon,
  slideup: ArrowUpIcon,
  custom: PlusCircleIcon,
};

const SECTION_TITLES: Record<SectionType, string> = {
  overview: 'Overview',
  features: 'Key Features',
  tech_stack: 'Tech Stack',
  gallery: 'Gallery',
  architecture: 'Architecture',
  demo: 'Demo',
  challenges: 'Challenges & Solutions',
  links: 'Resources',
  slideup: 'Slide Up',
  custom: 'Custom Section',
};

// ============================================================================
// Props Types
// ============================================================================

interface SectionEditorProps {
  section: ProjectSection;
  isDragOverlay?: boolean;
}

// ============================================================================
// Main Component
// ============================================================================

export function SectionEditor({ section, isDragOverlay }: SectionEditorProps) {
  const { updateSectionContent, toggleSectionEnabled, deleteSection } = useSectionEditorContext();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Sortable hook for drag-and-drop
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: section.id.toString(),
    disabled: isDragOverlay,
  });

  // Sortable styles
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Get icon component
  const IconComponent = SECTION_ICONS[section.type];
  const sectionTitle = SECTION_TITLES[section.type];

  // Handle content change
  const handleContentChange = (content: SectionContent) => {
    updateSectionContent(section.id.toString(), content);
  };

  // Handle delete
  const handleDelete = () => {
    deleteSection(section.id.toString());
    setShowDeleteConfirm(false);
  };

  // Handle toggle enabled
  const handleToggleEnabled = () => {
    toggleSectionEnabled(section.id.toString());
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group bg-white dark:bg-gray-800 rounded-xl border-2 transition-all ${
        isDragging
          ? 'border-primary-500 shadow-2xl z-50'
          : section.enabled
          ? 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600'
          : 'border-dashed border-gray-300 dark:border-gray-600 opacity-60'
      }`}
    >
      {/* Section Header */}
      <div
        className={`flex items-center gap-3 px-4 py-3 border-b transition-colors ${
          section.enabled
            ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
            : 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800'
        } rounded-t-xl`}
      >
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          aria-label="Drag to reorder"
        >
          <Bars3Icon className="w-5 h-5" />
        </button>

        {/* Section Icon & Title */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <IconComponent className={`w-5 h-5 flex-shrink-0 ${
            section.enabled
              ? 'text-primary-500 dark:text-primary-400'
              : 'text-gray-400'
          }`} />
          <h3 className={`font-semibold truncate ${
            section.enabled
              ? 'text-gray-900 dark:text-white'
              : 'text-gray-500 dark:text-gray-400'
          }`}>
            {sectionTitle}
          </h3>
          {!section.enabled && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
              Hidden
            </span>
          )}
        </div>

        {/* Section Controls */}
        <div className="flex items-center gap-1">
          {/* Toggle Visibility */}
          <button
            onClick={handleToggleEnabled}
            className={`p-1.5 rounded-lg transition-colors ${
              section.enabled
                ? 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                : 'text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20'
            }`}
            title={section.enabled ? 'Hide section' : 'Show section'}
          >
            {section.enabled ? (
              <EyeIcon className="w-5 h-5" />
            ) : (
              <EyeSlashIcon className="w-5 h-5" />
            )}
          </button>

          {/* Collapse/Expand */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? (
              <ChevronDownIcon className="w-5 h-5" />
            ) : (
              <ChevronUpIcon className="w-5 h-5" />
            )}
          </button>

          {/* Delete */}
          {showDeleteConfirm ? (
            <div className="flex items-center gap-1">
              <button
                onClick={handleDelete}
                className="px-2 py-1 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
              title="Delete section"
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Section Content */}
      {!isCollapsed && (
        <div className="p-4">
          <SectionContentEditor
            type={section.type}
            content={section.content}
            onChange={handleContentChange}
            enabled={section.enabled}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Section Content Editor Dispatcher
// ============================================================================

interface SectionContentEditorProps {
  type: SectionType;
  content: SectionContent;
  onChange: (content: SectionContent) => void;
  enabled: boolean;
}

function SectionContentEditor({ type, content, onChange, enabled }: SectionContentEditorProps) {
  // Placeholder editors for each section type
  // These will be replaced with full implementations in Phase 2

  switch (type) {
    case 'overview':
      return <OverviewEditorPlaceholder content={content} onChange={onChange} enabled={enabled} />;
    case 'features':
      return (
        <FeaturesSection
          content={content as FeaturesSectionContent}
          isEditing={true}
          onUpdate={onChange}
        />
      );
    case 'tech_stack':
      return <TechStackEditorPlaceholder content={content} onChange={onChange} enabled={enabled} />;
    case 'gallery':
      return <GalleryEditorPlaceholder content={content} onChange={onChange} enabled={enabled} />;
    case 'architecture':
      return <ArchitectureEditorPlaceholder content={content} onChange={onChange} enabled={enabled} />;
    case 'demo':
      return <DemoEditorPlaceholder content={content} onChange={onChange} enabled={enabled} />;
    case 'challenges':
      return <ChallengesEditorPlaceholder content={content} onChange={onChange} enabled={enabled} />;
    case 'links':
      return <LinksEditorPlaceholder content={content} onChange={onChange} enabled={enabled} />;
    case 'custom':
      return <CustomEditorPlaceholder content={content} onChange={onChange} enabled={enabled} />;
    default:
      return <div className="text-gray-500">Unknown section type</div>;
  }
}

// ============================================================================
// Placeholder Editors (Phase 2 will replace these)
// ============================================================================

interface PlaceholderProps {
  content: SectionContent;
  onChange: (content: SectionContent) => void;
  enabled: boolean;
}

function OverviewEditorPlaceholder({ enabled }: PlaceholderProps) {
  return (
    <div className={`p-6 text-center border-2 border-dashed rounded-lg ${
      enabled ? 'border-gray-200 dark:border-gray-700' : 'border-gray-300 dark:border-gray-600'
    }`}>
      <DocumentTextIcon className="w-10 h-10 mx-auto mb-2 text-gray-400" />
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Overview editor coming in Phase 2
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        Headline, description, and metrics
      </p>
    </div>
  );
}

// FeaturesSection is now used directly from ../sections/FeaturesSection

function TechStackEditorPlaceholder({ enabled }: PlaceholderProps) {
  return (
    <div className={`p-6 text-center border-2 border-dashed rounded-lg ${
      enabled ? 'border-gray-200 dark:border-gray-700' : 'border-gray-300 dark:border-gray-600'
    }`}>
      <CodeBracketIcon className="w-10 h-10 mx-auto mb-2 text-gray-400" />
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Tech Stack editor coming in Phase 2
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        Categorized technology list
      </p>
    </div>
  );
}

function GalleryEditorPlaceholder({ enabled }: PlaceholderProps) {
  return (
    <div className={`p-6 text-center border-2 border-dashed rounded-lg ${
      enabled ? 'border-gray-200 dark:border-gray-700' : 'border-gray-300 dark:border-gray-600'
    }`}>
      <PhotoIcon className="w-10 h-10 mx-auto mb-2 text-gray-400" />
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Gallery editor coming in Phase 2
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        Image uploads and layout options
      </p>
    </div>
  );
}

function ArchitectureEditorPlaceholder({ enabled }: PlaceholderProps) {
  return (
    <div className={`p-6 text-center border-2 border-dashed rounded-lg ${
      enabled ? 'border-gray-200 dark:border-gray-700' : 'border-gray-300 dark:border-gray-600'
    }`}>
      <CubeTransparentIcon className="w-10 h-10 mx-auto mb-2 text-gray-400" />
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Architecture editor coming in Phase 2
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        Mermaid diagram editor
      </p>
    </div>
  );
}

function DemoEditorPlaceholder({ enabled }: PlaceholderProps) {
  return (
    <div className={`p-6 text-center border-2 border-dashed rounded-lg ${
      enabled ? 'border-gray-200 dark:border-gray-700' : 'border-gray-300 dark:border-gray-600'
    }`}>
      <PlayCircleIcon className="w-10 h-10 mx-auto mb-2 text-gray-400" />
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Demo editor coming in Phase 2
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        Video embed and CTA buttons
      </p>
    </div>
  );
}

function ChallengesEditorPlaceholder({ enabled }: PlaceholderProps) {
  return (
    <div className={`p-6 text-center border-2 border-dashed rounded-lg ${
      enabled ? 'border-gray-200 dark:border-gray-700' : 'border-gray-300 dark:border-gray-600'
    }`}>
      <LightBulbIcon className="w-10 h-10 mx-auto mb-2 text-gray-400" />
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Challenges editor coming in Phase 2
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        Problem/solution pairs
      </p>
    </div>
  );
}

function LinksEditorPlaceholder({ enabled }: PlaceholderProps) {
  return (
    <div className={`p-6 text-center border-2 border-dashed rounded-lg ${
      enabled ? 'border-gray-200 dark:border-gray-700' : 'border-gray-300 dark:border-gray-600'
    }`}>
      <LinkIcon className="w-10 h-10 mx-auto mb-2 text-gray-400" />
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Links editor coming in Phase 2
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        Resource links and documentation
      </p>
    </div>
  );
}

function CustomEditorPlaceholder({ enabled }: PlaceholderProps) {
  return (
    <div className={`p-6 text-center border-2 border-dashed rounded-lg ${
      enabled ? 'border-gray-200 dark:border-gray-700' : 'border-gray-300 dark:border-gray-600'
    }`}>
      <PlusCircleIcon className="w-10 h-10 mx-auto mb-2 text-gray-400" />
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Custom editor coming in Phase 2
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        Free-form block-based content
      </p>
    </div>
  );
}

export default SectionEditor;
