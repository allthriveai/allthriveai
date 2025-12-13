/**
 * ProfileSectionRenderer - Routes profile sections to their specific renderers
 *
 * This component takes a ProfileSection and renders the appropriate
 * section component based on the section type.
 */

import { useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { PlusIcon, TrashIcon, Bars3Icon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import type {
  ProfileSection,
  ProfileSectionType,
  ProfileSectionContent,
} from '@/types/profileSections';
import { FeaturedProjectsSection } from './FeaturedProjectsSection';
import { SkillsSection } from './SkillsSection';
import { CustomSection } from './CustomSection';
import { AboutSection } from './AboutSection';
import { LinksSection } from './LinksSection';
import type { SocialLinksUpdate } from './LinksSection';
import { LearningGoalsSection } from './LearningGoalsSection';
import { StorefrontSection } from './StorefrontSection';
import { FeaturedContentSection } from './FeaturedContentSection';
import { BattleStatsSection } from './BattleStatsSection';
import { RecentBattlesSection } from './RecentBattlesSection';
import { ProfileSectionTypePicker } from '../ProfileSectionTypePicker';

// User data needed for section rendering
export interface ProfileUser {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  bio?: string;
  tagline?: string;
  location?: string;
  pronouns?: string;
  current_status?: string;
  website_url?: string;
  linkedin_url?: string;
  twitter_url?: string;
  github_url?: string;
  youtube_url?: string;
  instagram_url?: string;
  total_points?: number;
  level?: number;
  tier?: string;
  current_streak_days?: number;
  total_achievements_unlocked?: number;
  lifetime_projects_created?: number;
}

interface ProfileSectionRendererProps {
  section: ProfileSection;
  user: ProfileUser;
  isEditing?: boolean;
  onUpdate?: (content: ProfileSectionContent) => void;
  onSocialLinksUpdate?: (links: SocialLinksUpdate) => Promise<void>;
}

export function ProfileSectionRenderer({
  section,
  user,
  isEditing,
  onUpdate,
  onSocialLinksUpdate,
}: ProfileSectionRendererProps) {
  if (!section.visible && !isEditing) {
    return null;
  }

  const commonProps = { user, isEditing, onUpdate };

  switch (section.type) {
    case 'about':
      return <AboutSection content={section.content as any} {...commonProps} />;
    case 'links':
      return <LinksSection content={section.content as any} {...commonProps} onSocialLinksUpdate={onSocialLinksUpdate} />;
    case 'skills':
      return <SkillsSection content={section.content as any} {...commonProps} />;
    case 'learning_goals':
      return <LearningGoalsSection content={section.content as any} {...commonProps} />;
    case 'featured_projects':
      return <FeaturedProjectsSection content={section.content as any} {...commonProps} />;
    case 'storefront':
      return <StorefrontSection content={section.content as any} {...commonProps} />;
    case 'featured_content':
      return <FeaturedContentSection content={section.content as any} {...commonProps} />;
    case 'battle_stats':
      return <BattleStatsSection content={section.content as any} {...commonProps} />;
    case 'recent_battles':
      return <RecentBattlesSection content={section.content as any} {...commonProps} />;
    case 'custom':
      return <CustomSection content={section.content as any} title={section.title} {...commonProps} />;
    default:
      return null;
  }
}

/**
 * ProfileSections - Renders all visible sections in order with drag-and-drop reordering
 */
interface ProfileSectionsProps {
  sections: ProfileSection[];
  user: ProfileUser;
  isEditing?: boolean;
  onSectionUpdate?: (sectionId: string, content: ProfileSectionContent) => void;
  onAddSection?: (type: ProfileSectionType, afterSectionId?: string) => void;
  onDeleteSection?: (sectionId: string) => void;
  onToggleVisibility?: (sectionId: string) => void;
  onReorderSections?: (reorderedSections: ProfileSection[]) => void;
  onSocialLinksUpdate?: (links: SocialLinksUpdate) => Promise<void>;
}

export function ProfileSections({
  sections,
  user,
  isEditing,
  onSectionUpdate,
  onAddSection,
  onDeleteSection,
  onToggleVisibility,
  onReorderSections,
  onSocialLinksUpdate,
}: ProfileSectionsProps) {
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [insertAfterSectionId, setInsertAfterSectionId] = useState<string | undefined>(undefined);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  // Guard against undefined or null sections
  const safeSections = sections || [];

  // When editing, show all sections (including hidden ones), otherwise only show visible
  const displaySections = isEditing
    ? safeSections.sort((a, b) => a.order - b.order)
    : safeSections.filter(s => s.visible).sort((a, b) => a.order - b.order);

  // Get section IDs for sortable context
  const sectionIds = displaySections.map(s => s.id);

  // Find active section for drag overlay
  const activeSection = displaySections.find(s => s.id === activeSectionId);

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveSectionId(event.active.id.toString());
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveSectionId(null);

    if (over && active.id !== over.id && onReorderSections) {
      const oldIndex = displaySections.findIndex(s => s.id === active.id);
      const newIndex = displaySections.findIndex(s => s.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        // Create new array with reordered sections
        const newSections = [...displaySections];
        const [movedSection] = newSections.splice(oldIndex, 1);
        newSections.splice(newIndex, 0, movedSection);

        // Update order values
        const reorderedSections = newSections.map((s, idx) => ({ ...s, order: idx }));
        onReorderSections(reorderedSections);
      }
    }
  }, [displaySections, onReorderSections]);

  const handleAddClick = (afterSectionId?: string) => {
    setInsertAfterSectionId(afterSectionId);
    setShowTypePicker(true);
  };

  const handleSelectType = (type: ProfileSectionType) => {
    if (onAddSection) {
      onAddSection(type, insertAfterSectionId);
    }
    setShowTypePicker(false);
    setInsertAfterSectionId(undefined);
  };

  // Empty state for editing mode
  if (displaySections.length === 0) {
    if (isEditing && onAddSection) {
      return (
        <div className="py-16">
          <div className="text-center py-16 px-8 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl">
            <PlusIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No sections yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Add sections to customize your profile showcase
            </p>
            <button
              onClick={() => handleAddClick()}
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl font-medium transition-all duration-200
                bg-white/70 dark:bg-white/10 backdrop-blur-md
                text-primary-600 dark:text-primary-300
                border border-primary-200/60 dark:border-primary-500/30
                shadow-[0_4px_16px_rgba(99,102,241,0.1),inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-[0_4px_16px_rgba(99,102,241,0.15),inset_0_1px_0_rgba(255,255,255,0.1)]
                hover:bg-primary-50/80 dark:hover:bg-primary-500/20
                hover:border-primary-300/80 dark:hover:border-primary-500/50
                hover:shadow-[0_6px_24px_rgba(99,102,241,0.2),inset_0_1px_0_rgba(255,255,255,0.8)] dark:hover:shadow-[0_6px_24px_rgba(99,102,241,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]
                hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-primary-100 dark:bg-primary-500/30 text-primary-500 dark:text-primary-300">
                <PlusIcon className="w-4 h-4" />
              </span>
              Add Your First Section
            </button>
          </div>
          {showTypePicker && (
            <ProfileSectionTypePicker
              existingSections={safeSections}
              onSelect={handleSelectType}
              onClose={() => setShowTypePicker(false)}
            />
          )}
        </div>
      );
    }
    return null;
  }

  // Render sections with drag-and-drop when editing
  const renderSections = () => (
    <div className="space-y-8">
      {displaySections.map((section, index) => (
        <SortableProfileSection
          key={section.id}
          section={section}
          index={index}
          totalSections={displaySections.length}
          user={user}
          isEditing={isEditing}
          onSectionUpdate={onSectionUpdate}
          onDeleteSection={onDeleteSection}
          onToggleVisibility={onToggleVisibility}
          onAddClick={handleAddClick}
          onAddSection={onAddSection}
          onSocialLinksUpdate={onSocialLinksUpdate}
        />
      ))}
    </div>
  );

  return (
    <div className="py-8">
      {/* Add Section at Top (editing mode) */}
      {isEditing && onAddSection && (
        <AddSectionButton onClick={() => handleAddClick()} position="top" />
      )}

      {/* Sections with optional drag-and-drop */}
      {isEditing && onReorderSections ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
            {renderSections()}
          </SortableContext>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeSection ? (
              <div className="opacity-90 bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 border-2 border-primary-500">
                <div className="text-sm font-medium text-primary-600 dark:text-primary-400 mb-2">
                  Moving: {activeSection.type.replace('_', ' ')}
                </div>
                <div className="opacity-50 pointer-events-none">
                  <ProfileSectionRenderer section={activeSection} user={user} isEditing={false} />
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        renderSections()
      )}

      {/* Section Type Picker Modal */}
      {showTypePicker && (
        <ProfileSectionTypePicker
          existingSections={safeSections}
          onSelect={handleSelectType}
          onClose={() => setShowTypePicker(false)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Sortable Section Wrapper
// ============================================================================

interface SortableProfileSectionProps {
  section: ProfileSection;
  index: number;
  totalSections: number;
  user: ProfileUser;
  isEditing?: boolean;
  onSectionUpdate?: (sectionId: string, content: ProfileSectionContent) => void;
  onDeleteSection?: (sectionId: string) => void;
  onToggleVisibility?: (sectionId: string) => void;
  onAddClick: (afterSectionId?: string) => void;
  onAddSection?: (type: ProfileSectionType, afterSectionId?: string) => void;
  onSocialLinksUpdate?: (links: SocialLinksUpdate) => Promise<void>;
}

function SortableProfileSection({
  section,
  index,
  totalSections,
  user,
  isEditing,
  onSectionUpdate,
  onDeleteSection,
  onToggleVisibility,
  onAddClick,
  onAddSection,
  onSocialLinksUpdate,
}: SortableProfileSectionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isHidden = !section.visible;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group/section ${isHidden ? 'opacity-50' : ''}`}
    >
      {/* Section Controls (editing mode) */}
      {isEditing && (
        <div className="absolute -left-12 top-0 flex flex-col gap-2 opacity-0 group-hover/section:opacity-100 transition-opacity z-10">
          {/* Drag Handle */}
          <button
            {...attributes}
            {...listeners}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-grab active:cursor-grabbing shadow-sm"
            title="Drag to reorder"
          >
            <Bars3Icon className="w-4 h-4" />
          </button>

          {/* Toggle Visibility */}
          {onToggleVisibility && (
            <button
              onClick={() => onToggleVisibility(section.id)}
              className={`p-2 rounded-lg shadow-sm ${
                isHidden
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-500 hover:text-yellow-600'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
              title={isHidden ? 'Show section' : 'Hide section'}
            >
              {isHidden ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
            </button>
          )}
        </div>
      )}

      {/* Hidden Indicator */}
      {isEditing && isHidden && (
        <div className="absolute top-2 left-2 z-10 px-2 py-1 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded">
          Hidden
        </div>
      )}

      {/* Delete Section Button */}
      {isEditing && onDeleteSection && (
        <button
          onClick={() => onDeleteSection(section.id)}
          className="absolute -top-2 -right-2 z-10 p-2 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 opacity-0 group-hover/section:opacity-100 transition-opacity shadow-lg"
          title="Delete section"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      )}

      <ProfileSectionRenderer
        section={section}
        user={user}
        isEditing={isEditing}
        onUpdate={onSectionUpdate ? (content) => onSectionUpdate(section.id, content) : undefined}
        onSocialLinksUpdate={onSocialLinksUpdate}
      />

      {/* Add Section Button after each section (editing mode) */}
      {isEditing && onAddSection && (
        <AddSectionButton
          onClick={() => onAddClick(section.id)}
          position={index === totalSections - 1 ? 'bottom' : 'between'}
        />
      )}
    </div>
  );
}

// ============================================================================
// Add Section Button
// ============================================================================

interface AddSectionButtonProps {
  onClick: () => void;
  position: 'top' | 'between' | 'bottom';
}

function AddSectionButton({ onClick, position }: AddSectionButtonProps) {
  return (
    <div
      className={`group/add flex items-center justify-center ${
        position === 'top' ? 'mb-8' : position === 'bottom' ? 'mt-8' : 'my-8'
      }`}
    >
      {/* Line */}
      <div className="flex-1 h-px bg-transparent group-hover/add:bg-primary-300 dark:group-hover/add:bg-primary-700 transition-colors" />

      {/* Glass Button */}
      <button
        onClick={onClick}
        className="flex items-center gap-2 px-5 py-2.5 mx-4 text-sm font-medium rounded-xl transition-all duration-200
          bg-white/70 dark:bg-white/10 backdrop-blur-md
          text-gray-600 dark:text-gray-300
          border border-white/50 dark:border-white/20
          shadow-[0_4px_16px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]
          hover:bg-primary-50/80 dark:hover:bg-primary-500/20
          hover:text-primary-600 dark:hover:text-primary-300
          hover:border-primary-300/60 dark:hover:border-primary-500/40
          hover:shadow-[0_6px_20px_rgba(99,102,241,0.15),inset_0_1px_0_rgba(255,255,255,0.8)] dark:hover:shadow-[0_6px_20px_rgba(99,102,241,0.25),inset_0_1px_0_rgba(255,255,255,0.15)]
          hover:scale-[1.02] active:scale-[0.98]
          cursor-pointer"
      >
        <span className="flex items-center justify-center w-5 h-5 rounded-md bg-primary-100 dark:bg-primary-500/30 text-primary-500 dark:text-primary-300">
          <PlusIcon className="w-3.5 h-3.5" />
        </span>
        Add Section
      </button>

      {/* Line */}
      <div className="flex-1 h-px bg-transparent group-hover/add:bg-primary-300 dark:group-hover/add:bg-primary-700 transition-colors" />
    </div>
  );
}
