/**
 * PathLibraryGrid - Grid display of user's saved learning paths with section organization
 *
 * Shows a visual grid of learning paths with cover images, difficulty badges,
 * and quick actions (activate, delete). Users can organize paths into custom sections
 * with drag-and-drop.
 */

import { useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
  rectIntersection,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent, DragOverEvent } from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGraduationCap,
  faClock,
  faCheck,
  faTrash,
  faSpinner,
  faPlus,
  faPencil,
  faChevronDown,
  faChevronRight,
  faGripVertical,
  faFolderPlus,
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '@/hooks/useAuth';
import { useSavedPaths, useActivateSavedPath, useDeleteSavedPath, useUpdatePathSections, usePathSectionsOrganization } from '@/hooks/useLearningPaths';
import type { SavedLearningPathListItem } from '@/services/learningPaths';

interface PathLibraryGridProps {
  onCreateNew: () => void;
}

// Difficulty badge colors
const difficultyColors: Record<string, string> = {
  beginner: 'from-green-500 to-emerald-600',
  intermediate: 'from-yellow-500 to-amber-600',
  advanced: 'from-red-500 to-rose-600',
};

// Difficulty labels
const difficultyLabels: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

// ============================================================================
// Section Types
// ============================================================================

interface PathSection {
  id: string;
  title: string;
  isCollapsed: boolean;
  pathSlugs: string[]; // Ordered list of path slugs in this section
}

// Special ID for unsorted area
const UNSORTED_DROPPABLE_ID = '__unsorted__';

// ============================================================================
// Path Card Component
// ============================================================================

interface PathCardProps {
  path: SavedLearningPathListItem;
  username: string;
  onActivate: () => void;
  onDelete: () => void;
  isActivating: boolean;
  isDeleting: boolean;
  isDragging?: boolean;
  isOverlay?: boolean;
}

function PathCard({ path, username, onActivate, onDelete, isActivating, isDeleting, isDragging, isOverlay }: PathCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = () => {
    if (showDeleteConfirm) {
      onDelete();
      setShowDeleteConfirm(false);
    } else {
      setShowDeleteConfirm(true);
    }
  };

  return (
    <motion.div
      initial={isOverlay ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: isDragging ? 0.5 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ scale: isDragging || isOverlay ? 1 : 1.02 }}
      className={`
        relative rounded overflow-hidden
        bg-white dark:bg-slate-800/50 backdrop-blur-sm
        border transition-all duration-200
        ${isOverlay ? 'shadow-2xl ring-2 ring-emerald-500' : ''}
        ${path.isActive
          ? 'border-emerald-500/50 shadow-lg shadow-emerald-500/10'
          : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
        }
      `}
    >
      {/* Clickable Link Area */}
      <Link to={`/${username}/learn/${path.slug}`} className="block" onClick={(e) => isOverlay && e.preventDefault()}>
        {/* Cover Image */}
        <div className="relative h-40 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 overflow-hidden">
          {path.coverImage ? (
            <img
              src={path.coverImage}
              alt={path.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                <FontAwesomeIcon
                  icon={faGraduationCap}
                  className="text-3xl text-emerald-500/50 dark:text-emerald-400/50"
                />
              </div>
            </div>
          )}

          {/* Active Badge */}
          {path.isActive && (
            <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-emerald-500/90 text-white text-xs font-semibold flex items-center gap-1.5">
              <FontAwesomeIcon icon={faCheck} className="text-[10px]" />
              Active
            </div>
          )}

          {/* Difficulty Badge */}
          <div
            className={`
              absolute top-3 right-3 px-3 py-1 rounded-full text-white text-xs font-semibold
              bg-gradient-to-r ${difficultyColors[path.difficulty] || difficultyColors.beginner}
            `}
          >
            {difficultyLabels[path.difficulty] || path.difficulty}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 pb-2">
          <h3 className="font-semibold text-slate-900 dark:text-white text-lg mb-2 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
            {path.title}
          </h3>

          <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <FontAwesomeIcon icon={faClock} className="text-xs" />
              {path.estimatedHours}h
            </span>
            <span>
              {path.curriculumCount} items
            </span>
          </div>
        </div>
      </Link>

      {/* Actions - outside the link */}
      {!isOverlay && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2">
            {!path.isActive && (
              <button
                onClick={onActivate}
                disabled={isActivating}
                className="flex-1 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
              >
                {isActivating ? (
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                ) : (
                  'Set Active'
                )}
              </button>
            )}

            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className={`
                px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50
                ${showDeleteConfirm
                  ? 'bg-red-500/20 border border-red-500/50 text-red-500 dark:text-red-400'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10'
                }
              `}
            >
              {isDeleting ? (
                <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
              ) : showDeleteConfirm ? (
                'Confirm'
              ) : (
                <FontAwesomeIcon icon={faTrash} />
              )}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ============================================================================
// Draggable Path Card (for edit mode)
// ============================================================================

interface DraggablePathCardProps {
  path: SavedLearningPathListItem;
  username: string;
  onActivate: () => void;
  onDelete: () => void;
  isActivating: boolean;
  isDeleting: boolean;
}

function DraggablePathCard({ path, username, onActivate, onDelete, isActivating, isDeleting }: DraggablePathCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: path.slug });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={`relative group/drag ${isDragging ? 'z-50 opacity-50' : ''}`}>
      {/* Drag Handle - always visible in edit mode */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 p-2 rounded-lg bg-slate-600/90 text-white cursor-grab active:cursor-grabbing z-20 shadow-lg hover:bg-slate-500 transition-colors"
      >
        <FontAwesomeIcon icon={faGripVertical} />
      </div>
      <PathCard
        path={path}
        username={username}
        onActivate={onActivate}
        onDelete={onDelete}
        isActivating={isActivating}
        isDeleting={isDeleting}
        isDragging={isDragging}
      />
    </div>
  );
}

// ============================================================================
// Droppable Section Component
// ============================================================================

interface DroppableSectionProps {
  section: PathSection;
  children: React.ReactNode;
  isOver: boolean;
}

function DroppableSection({ section, children, isOver }: DroppableSectionProps) {
  const { setNodeRef } = useDroppable({
    id: section.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        min-h-[120px] p-4 rounded-lg transition-colors duration-200
        ${isOver
          ? 'bg-emerald-500/10 border-2 border-dashed border-emerald-500/50'
          : 'bg-slate-50/50 dark:bg-slate-800/30 border-2 border-dashed border-transparent'
        }
      `}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Section Header Component
// ============================================================================

interface SectionHeaderProps {
  section: PathSection;
  pathCount: number;
  isEditing: boolean;
  onToggleCollapse: () => void;
  onUpdateTitle: (title: string) => void;
  onDelete: () => void;
}

function SectionHeader({ section, pathCount, isEditing, onToggleCollapse, onUpdateTitle, onDelete }: SectionHeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState(section.title);

  const handleTitleBlur = () => {
    if (localTitle.trim() && localTitle !== section.title) {
      onUpdateTitle(localTitle.trim());
    } else {
      setLocalTitle(section.title);
    }
    setIsEditingTitle(false);
  };

  return (
    <div className="flex items-center gap-3 py-3 px-4 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg mb-2 group">
      {/* Collapse Toggle */}
      <button
        onClick={onToggleCollapse}
        className="p-1.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
      >
        <FontAwesomeIcon icon={section.isCollapsed ? faChevronRight : faChevronDown} />
      </button>

      {/* Title */}
      {isEditingTitle && isEditing ? (
        <input
          type="text"
          value={localTitle}
          onChange={(e) => setLocalTitle(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="flex-1 bg-white dark:bg-slate-700 border border-emerald-500 rounded px-2 py-1 text-slate-900 dark:text-white font-semibold focus:outline-none"
          autoFocus
        />
      ) : (
        <h2
          onClick={() => isEditing && setIsEditingTitle(true)}
          className={`flex-1 font-semibold text-slate-900 dark:text-white ${isEditing ? 'cursor-text hover:text-emerald-600 dark:hover:text-emerald-400' : ''}`}
        >
          {section.title}
        </h2>
      )}

      {/* Path Count */}
      <span className="text-sm text-slate-500 dark:text-gray-400">
        {pathCount} path{pathCount !== 1 ? 's' : ''}
      </span>

      {/* Edit Title Button (edit mode only) */}
      {isEditing && !isEditingTitle && (
        <button
          onClick={() => setIsEditingTitle(true)}
          className="p-1.5 rounded text-slate-400 hover:text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <FontAwesomeIcon icon={faPencil} className="text-xs" />
        </button>
      )}

      {/* Delete Section Button (edit mode only) */}
      {isEditing && (
        <button
          onClick={onDelete}
          className="p-1.5 rounded text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <FontAwesomeIcon icon={faTrash} className="text-xs" />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Droppable Unsorted Area
// ============================================================================

interface DroppableUnsortedAreaProps {
  children: React.ReactNode;
  isOver: boolean;
}

function DroppableUnsortedArea({ children, isOver }: DroppableUnsortedAreaProps) {
  const { setNodeRef } = useDroppable({
    id: UNSORTED_DROPPABLE_ID,
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        min-h-[200px] transition-colors duration-200 rounded-lg p-4
        ${isOver
          ? 'bg-emerald-500/10 border-2 border-dashed border-emerald-500/50'
          : ''
        }
      `}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Create New Card
// ============================================================================

function CreateNewCard({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="
        h-full min-h-[280px] rounded border border-dashed
        bg-white/50 dark:bg-slate-800/30 backdrop-blur-sm
        border-slate-300 dark:border-white/20
        hover:border-emerald-500/50 dark:hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all duration-200
        flex flex-col items-center justify-center gap-4 cursor-pointer group
      "
    >
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:border-emerald-500/40 transition-colors">
        <FontAwesomeIcon
          icon={faPlus}
          className="text-2xl text-emerald-500/60 dark:text-emerald-400/60 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors"
        />
      </div>
      <div className="text-center">
        <p className="font-medium text-slate-700 dark:text-white/80 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
          Create New Path
        </p>
        <p className="text-sm text-slate-500 dark:text-gray-500 mt-1">
          Ask Sage to build one for you
        </p>
      </div>
    </motion.button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PathLibraryGrid({ onCreateNew }: PathLibraryGridProps) {
  const { user } = useAuth();
  const { data: paths, isLoading: pathsLoading, error } = useSavedPaths();
  const { data: sectionsData } = usePathSectionsOrganization();
  const { mutate: activatePath, isPending: isActivating, variables: activatingSlug } = useActivateSavedPath();
  const { mutate: deletePath, isPending: isDeleting, variables: deletingSlug } = useDeleteSavedPath();
  const { mutate: updateSections } = useUpdatePathSections();

  const username = user?.username || '';
  // Only wait for paths to load, sections can load in background
  const isLoading = pathsLoading;

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);

  // Sections organization state - initialized from backend
  const [sections, setSections] = useState<PathSection[]>([]);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Track which droppable is being hovered
  const [activeDroppableId, setActiveDroppableId] = useState<string | null>(null);

  // Initialize sections from backend data
  useMemo(() => {
    if (!hasInitialized && sectionsData) {
      if (sectionsData.sectionsOrganization?.sections) {
        // Load sections from backend
        setSections(sectionsData.sectionsOrganization.sections);
      } else {
        // No sections saved yet, start with empty
        setSections([]);
      }
      setHasInitialized(true);
    }
  }, [sectionsData, hasInitialized]);

  // Get paths that are not in any section
  const unsortedPaths = useMemo(() => {
    if (!paths) return [];
    const organizedSlugs = new Set(sections.flatMap(s => s.pathSlugs));
    return paths.filter(p => !organizedSlugs.has(p.slug));
  }, [paths, sections]);

  // Create path lookup map
  const pathMap = useMemo(() => {
    if (!paths) return {};
    return Object.fromEntries(paths.map(p => [p.slug, p]));
  }, [paths]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Handle section operations
  const addSection = useCallback(() => {
    const newSection: PathSection = {
      id: crypto.randomUUID(),
      title: 'New Section',
      isCollapsed: false,
      pathSlugs: [],
    };
    setSections(prev => [...prev, newSection]);
  }, []);

  const updateSectionTitle = useCallback((sectionId: string, title: string) => {
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, title } : s));
  }, []);

  const toggleSectionCollapse = useCallback((sectionId: string) => {
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, isCollapsed: !s.isCollapsed } : s));
  }, []);

  const deleteSection = useCallback((sectionId: string) => {
    setSections(prev => prev.filter(s => s.id !== sectionId));
  }, []);

  // Handle drag events
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id.toString());
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    if (over) {
      // Check if hovering over a section or the unsorted area
      const isSection = sections.some(s => s.id === over.id);
      const isUnsorted = over.id === UNSORTED_DROPPABLE_ID;
      if (isSection || isUnsorted) {
        setActiveDroppableId(over.id.toString());
      } else {
        setActiveDroppableId(null);
      }
    } else {
      setActiveDroppableId(null);
    }
  }, [sections]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    setActiveDroppableId(null);

    if (!over) return;

    const draggedPathSlug = active.id.toString();
    const targetId = over.id.toString();

    // Find current location of the path
    const currentSectionIndex = sections.findIndex(s => s.pathSlugs.includes(draggedPathSlug));
    const isInUnsorted = currentSectionIndex === -1;

    // Determine target
    const targetSectionIndex = sections.findIndex(s => s.id === targetId);
    const isTargetUnsorted = targetId === UNSORTED_DROPPABLE_ID;

    // If dragging a path to a section
    if (targetSectionIndex !== -1) {
      setSections(prev => {
        const newSections = [...prev];

        // Remove from current section if it's in one
        if (!isInUnsorted && currentSectionIndex !== -1) {
          newSections[currentSectionIndex] = {
            ...newSections[currentSectionIndex],
            pathSlugs: newSections[currentSectionIndex].pathSlugs.filter(s => s !== draggedPathSlug),
          };
        }

        // Add to target section if not already there
        if (!newSections[targetSectionIndex].pathSlugs.includes(draggedPathSlug)) {
          newSections[targetSectionIndex] = {
            ...newSections[targetSectionIndex],
            pathSlugs: [...newSections[targetSectionIndex].pathSlugs, draggedPathSlug],
          };
        }

        return newSections;
      });
    }
    // If dragging to unsorted area
    else if (isTargetUnsorted && !isInUnsorted && currentSectionIndex !== -1) {
      setSections(prev => {
        const newSections = [...prev];
        newSections[currentSectionIndex] = {
          ...newSections[currentSectionIndex],
          pathSlugs: newSections[currentSectionIndex].pathSlugs.filter(s => s !== draggedPathSlug),
        };
        return newSections;
      });
    }
  }, [sections]);

  // Save sections when leaving edit mode
  const handleToggleEdit = useCallback(() => {
    if (isEditing) {
      // Save sections to backend
      updateSections({
        version: 1,
        sections: sections.map(s => ({
          id: s.id,
          title: s.title,
          isCollapsed: s.isCollapsed,
          pathSlugs: s.pathSlugs,
        })),
      });
    }
    setIsEditing(!isEditing);
  }, [isEditing, sections, updateSections]);

  // Get the dragged path for overlay
  const draggedPath = activeDragId ? pathMap[activeDragId] : null;

  // All path slugs for sortable context
  const allPathSlugs = useMemo(() => {
    return paths?.map(p => p.slug) || [];
  }, [paths]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <FontAwesomeIcon icon={faSpinner} className="text-2xl text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">Failed to load your learning paths.</p>
      </div>
    );
  }

  const hasPaths = paths && paths.length > 0;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Your Learning Paths
          </h1>
          <p className="text-slate-600 dark:text-gray-400">
            {hasPaths
              ? 'Select a path to continue learning, or create a new one with Sage.'
              : 'Get started by creating your first personalized learning path with Sage.'
            }
          </p>
        </div>

        {/* Edit/Organize Button */}
        {hasPaths && (
          <div className="flex items-center gap-2">
            {isEditing && (
              <button
                onClick={addSection}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 dark:text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-colors"
              >
                <FontAwesomeIcon icon={faFolderPlus} />
                Add Section
              </button>
            )}
            <button
              onClick={handleToggleEdit}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isEditing
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                  : 'bg-slate-200/50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-300/50 dark:hover:bg-slate-600/50'
              }`}
            >
              <FontAwesomeIcon icon={isEditing ? faCheck : faPencil} />
              {isEditing ? 'Done' : 'Organize'}
            </button>
          </div>
        )}
      </div>

      {/* Content - with or without DnD */}
      {isEditing ? (
        <DndContext
          sensors={sensors}
          collisionDetection={rectIntersection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={allPathSlugs} strategy={rectSortingStrategy}>
            {/* Empty state - prompt to create first section */}
            {sections.length === 0 && (
              <div className="mb-8 p-6 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="text-center">
                  <FontAwesomeIcon icon={faFolderPlus} className="text-4xl text-slate-400 dark:text-slate-500 mb-3" />
                  <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Organize Your Learning Paths
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-4 max-w-md mx-auto">
                    Create sections to group your paths by topic, priority, or however you like.
                  </p>
                  <button
                    onClick={addSection}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition-colors"
                  >
                    <FontAwesomeIcon icon={faFolderPlus} />
                    Create Your First Section
                  </button>
                </div>
              </div>
            )}

            {/* Sections */}
            {sections.length > 0 && (
              <div className="space-y-6 mb-8">
                {sections.map(section => {
                  const sectionPaths = section.pathSlugs
                    .map(slug => pathMap[slug])
                    .filter(Boolean) as SavedLearningPathListItem[];

                  return (
                    <div key={section.id}>
                      <SectionHeader
                        section={section}
                        pathCount={sectionPaths.length}
                        isEditing={isEditing}
                        onToggleCollapse={() => toggleSectionCollapse(section.id)}
                        onUpdateTitle={(title) => updateSectionTitle(section.id, title)}
                        onDelete={() => deleteSection(section.id)}
                      />

                      {!section.isCollapsed && (
                        <DroppableSection
                          section={section}
                          isOver={activeDroppableId === section.id}
                        >
                          {sectionPaths.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                              {sectionPaths.map(path => (
                                <DraggablePathCard
                                  key={path.slug}
                                  path={path}
                                  username={username}
                                  onActivate={() => activatePath(path.slug)}
                                  onDelete={() => deletePath(path.slug)}
                                  isActivating={isActivating && activatingSlug === path.slug}
                                  isDeleting={isDeleting && deletingSlug === path.slug}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="py-8 text-center text-slate-500 dark:text-gray-500">
                              Drag paths here to add them to this section
                            </div>
                          )}
                        </DroppableSection>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Unsorted Paths Header */}
            {sections.length > 0 && (
              <div className="mb-4">
                <h2 className="font-semibold text-slate-700 dark:text-slate-300">
                  Unsorted Paths
                </h2>
                <p className="text-sm text-slate-500 dark:text-gray-500">
                  Drag these into a section to organize them
                </p>
              </div>
            )}

            {/* Unsorted Paths Grid */}
            <DroppableUnsortedArea isOver={activeDroppableId === UNSORTED_DROPPABLE_ID}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                <AnimatePresence mode="popLayout">
                  {unsortedPaths.map(path => (
                    <DraggablePathCard
                      key={path.slug}
                      path={path}
                      username={username}
                      onActivate={() => activatePath(path.slug)}
                      onDelete={() => deletePath(path.slug)}
                      isActivating={isActivating && activatingSlug === path.slug}
                      isDeleting={isDeleting && deletingSlug === path.slug}
                    />
                  ))}
                </AnimatePresence>

                {/* Create New Card */}
                <CreateNewCard onClick={onCreateNew} />
              </div>
            </DroppableUnsortedArea>
          </SortableContext>

          {/* Drag Overlay */}
          <DragOverlay>
            {draggedPath && (
              <div className="w-[300px]">
                <PathCard
                  path={draggedPath}
                  username={username}
                  onActivate={() => {}}
                  onDelete={() => {}}
                  isActivating={false}
                  isDeleting={false}
                  isOverlay={true}
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        <>
          {/* Sections in view mode */}
          {sections.length > 0 && (
            <div className="space-y-6 mb-8">
              {sections.map(section => {
                const sectionPaths = section.pathSlugs
                  .map(slug => pathMap[slug])
                  .filter(Boolean) as SavedLearningPathListItem[];

                if (sectionPaths.length === 0) return null;

                return (
                  <div key={section.id}>
                    <SectionHeader
                      section={section}
                      pathCount={sectionPaths.length}
                      isEditing={false}
                      onToggleCollapse={() => toggleSectionCollapse(section.id)}
                      onUpdateTitle={() => {}}
                      onDelete={() => {}}
                    />

                    {!section.isCollapsed && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pl-4">
                        {sectionPaths.map(path => (
                          <PathCard
                            key={path.slug}
                            path={path}
                            username={username}
                            onActivate={() => activatePath(path.slug)}
                            onDelete={() => deletePath(path.slug)}
                            isActivating={isActivating && activatingSlug === path.slug}
                            isDeleting={isDeleting && deletingSlug === path.slug}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Grid of paths (unsorted or all if no sections) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence mode="popLayout">
              {(sections.length === 0 ? paths : unsortedPaths)?.map(path => (
                <PathCard
                  key={path.slug}
                  path={path}
                  username={username}
                  onActivate={() => activatePath(path.slug)}
                  onDelete={() => deletePath(path.slug)}
                  isActivating={isActivating && activatingSlug === path.slug}
                  isDeleting={isDeleting && deletingSlug === path.slug}
                />
              ))}
            </AnimatePresence>

            {/* Create New Card - always shown */}
            <CreateNewCard onClick={onCreateNew} />
          </div>
        </>
      )}
    </div>
  );
}

export default PathLibraryGrid;
