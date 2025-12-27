/**
 * LearningSectionEditorContext - State management for organizing learning path topics into sections
 *
 * This context provides a clean, type-safe API for organizing topics on the /learn page.
 * It handles:
 * - Section CRUD operations (create, read, update, delete, reorder)
 * - Topic management within sections (move, reorder)
 * - Auto-save with debouncing
 * - Collapse/expand state
 *
 * Design principles:
 * - Strongly typed with TypeScript
 * - Immutable state updates
 * - Optimistic UI updates
 * - Debounced autosave to prevent API spam
 * - Follows SectionEditorContext patterns
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
} from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import type {
  LearningSection,
  SectionsOrganization,
  TopicSectionData,
  LearningSectionChild,
} from '@/types/learningSections';
import {
  createEmptySection,
  createTopicRef,
  createDefaultSectionsOrganization,
  isLearningSection,
} from '@/types/learningSections';
import {
  getSectionsOrganization,
  updateSectionsOrganization,
} from '@/services/learningPaths';

// ============================================================================
// Constants
// ============================================================================

const AUTOSAVE_DEBOUNCE_MS = 1500;

// ============================================================================
// Types
// ============================================================================

/** Context value interface - the public API for consumers */
export interface LearningSectionEditorContextValue {
  // ========== Data ==========
  sectionsOrganization: SectionsOrganization | null;
  topicSections: TopicSectionData[];
  isLoading: boolean;
  error: string | null;

  // ========== Edit State ==========
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  hasUnsavedChanges: boolean;
  isSaving: boolean;

  // ========== Section CRUD ==========
  addSection: (afterId?: string) => void;
  updateSection: (id: string, updates: Partial<LearningSection>) => void;
  deleteSection: (id: string) => void;
  reorderSections: (fromIndex: number, toIndex: number) => void;
  toggleCollapse: (id: string) => void;

  // ========== Topic Management ==========
  moveTopicToSection: (topicSlug: string, targetSectionId: string) => void;
  reorderChildrenInSection: (
    sectionId: string,
    fromIndex: number,
    toIndex: number
  ) => void;

  // ========== Save ==========
  save: () => Promise<void>;
  discardChanges: () => void;
  initializeDefaultSections: () => void;
}

// ============================================================================
// Context
// ============================================================================

const LearningSectionEditorContext =
  createContext<LearningSectionEditorContextValue | null>(null);

// ============================================================================
// Hook
// ============================================================================

/**
 * Access the learning section editor context.
 * Must be used within a LearningSectionEditorProvider.
 */
export function useLearningSectionEditor(): LearningSectionEditorContextValue {
  const context = useContext(LearningSectionEditorContext);
  if (!context) {
    throw new Error(
      'useLearningSectionEditor must be used within a LearningSectionEditorProvider'
    );
  }
  return context;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Find a section by ID in a nested structure
 */
function findSectionById(
  sections: LearningSection[],
  id: string
): LearningSection | null {
  for (const section of sections) {
    if (section.id === id) return section;
    // Check nested sections
    for (const child of section.children) {
      if (isLearningSection(child)) {
        if (child.id === id) return child;
        // Only 2 levels of nesting allowed, so no deeper recursion needed
      }
    }
  }
  return null;
}

/**
 * Update a section by ID in a nested structure
 */
function updateSectionById(
  sections: LearningSection[],
  id: string,
  updates: Partial<LearningSection>
): LearningSection[] {
  return sections.map((section) => {
    if (section.id === id) {
      return { ...section, ...updates };
    }
    // Check nested sections
    const updatedChildren = section.children.map((child) => {
      if (isLearningSection(child) && child.id === id) {
        return { ...child, ...updates };
      }
      return child;
    });
    return { ...section, children: updatedChildren };
  });
}

/**
 * Delete a section by ID from a nested structure
 */
function deleteSectionById(
  sections: LearningSection[],
  id: string
): LearningSection[] {
  // First, check if it's a top-level section
  const filtered = sections.filter((s) => s.id !== id);
  if (filtered.length !== sections.length) {
    return filtered;
  }

  // Otherwise, search in children
  return sections.map((section) => ({
    ...section,
    children: section.children.filter(
      (child) => !(isLearningSection(child) && child.id === id)
    ),
  }));
}

/**
 * Remove a topic from all sections (used before moving to a new section)
 */
function removeTopicFromSections(
  sections: LearningSection[],
  topicSlug: string
): LearningSection[] {
  return sections.map((section) => ({
    ...section,
    children: section.children
      .filter((child) => {
        if (isLearningSection(child)) return true;
        return child.topicSlug !== topicSlug;
      })
      .map((child) => {
        if (isLearningSection(child)) {
          return {
            ...child,
            children: child.children.filter((grandchild) => {
              if (isLearningSection(grandchild)) return true;
              return grandchild.topicSlug !== topicSlug;
            }),
          };
        }
        return child;
      }),
  }));
}

/**
 * Add a topic to a section
 */
function addTopicToSection(
  sections: LearningSection[],
  sectionId: string,
  topicSlug: string
): LearningSection[] {
  return sections.map((section) => {
    if (section.id === sectionId) {
      return {
        ...section,
        children: [...section.children, createTopicRef(topicSlug)],
      };
    }
    // Check nested sections
    const updatedChildren = section.children.map((child) => {
      if (isLearningSection(child) && child.id === sectionId) {
        return {
          ...child,
          children: [...child.children, createTopicRef(topicSlug)],
        };
      }
      return child;
    });
    return { ...section, children: updatedChildren };
  });
}

// ============================================================================
// Provider
// ============================================================================

interface LearningSectionEditorProviderProps {
  children: ReactNode;
}

export function LearningSectionEditorProvider({
  children,
}: LearningSectionEditorProviderProps) {
  // ========== Refs ==========
  const isInitialLoadRef = useRef(true);
  const debouncedSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ========== Data State ==========
  const [sectionsOrganization, setSectionsOrganization] =
    useState<SectionsOrganization | null>(null);
  const [originalOrganization, setOriginalOrganization] =
    useState<SectionsOrganization | null>(null);
  const [topicSections, setTopicSections] = useState<TopicSectionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ========== Edit State ==========
  const [isEditing, setIsEditing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ========== Load Data ==========
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        setError(null);
        const response = await getSectionsOrganization();
        setSectionsOrganization(response.sectionsOrganization);
        setOriginalOrganization(response.sectionsOrganization);
        setTopicSections(response.topics);
      } catch (err) {
        console.error('Failed to load sections organization:', err);
        setError('Failed to load your learning sections');
      } finally {
        setIsLoading(false);
        // Mark initial load complete after a small delay
        setTimeout(() => {
          isInitialLoadRef.current = false;
        }, 100);
      }
    }

    loadData();
  }, []);

  // ========== Mark Unsaved ==========
  const markUnsaved = useCallback(() => {
    if (!isInitialLoadRef.current) {
      setHasUnsavedChanges(true);
    }
  }, []);

  // ========== Save Handler ==========
  const save = useCallback(async () => {
    if (!sectionsOrganization) return;

    setIsSaving(true);
    try {
      await updateSectionsOrganization(sectionsOrganization);
      setHasUnsavedChanges(false);
      setOriginalOrganization(sectionsOrganization);
    } catch (err) {
      console.error('Failed to save sections organization:', err);
      setError('Failed to save your changes');
    } finally {
      setIsSaving(false);
    }
  }, [sectionsOrganization]);

  // ========== Autosave Effect ==========
  useEffect(() => {
    if (!hasUnsavedChanges || !sectionsOrganization) return;

    // Cancel any pending save
    if (debouncedSaveRef.current) {
      clearTimeout(debouncedSaveRef.current);
    }

    // Schedule new save
    debouncedSaveRef.current = setTimeout(() => {
      save();
    }, AUTOSAVE_DEBOUNCE_MS);

    // Cleanup on unmount
    return () => {
      if (debouncedSaveRef.current) {
        clearTimeout(debouncedSaveRef.current);
      }
    };
  }, [hasUnsavedChanges, sectionsOrganization, save]);

  // ========== Discard Changes ==========
  const discardChanges = useCallback(() => {
    setSectionsOrganization(originalOrganization);
    setHasUnsavedChanges(false);
  }, [originalOrganization]);

  // ========== Initialize Default Sections ==========
  const initializeDefaultSections = useCallback(() => {
    if (sectionsOrganization) return; // Already initialized

    const topicSlugs = topicSections.map((t) => t.slug);
    const defaultOrg = createDefaultSectionsOrganization(topicSlugs);
    setSectionsOrganization(defaultOrg);
    markUnsaved();
  }, [sectionsOrganization, topicSections, markUnsaved]);

  // ========== Section Operations ==========
  const addSection = useCallback(
    (afterId?: string) => {
      const newSection = createEmptySection(crypto.randomUUID());

      setSectionsOrganization((prev) => {
        if (!prev) {
          return {
            version: 1,
            sections: [newSection],
          };
        }

        const sections = [...prev.sections];
        if (afterId) {
          const index = sections.findIndex((s) => s.id === afterId);
          sections.splice(index + 1, 0, newSection);
        } else {
          sections.push(newSection);
        }

        return { ...prev, sections };
      });
      markUnsaved();
    },
    [markUnsaved]
  );

  const updateSection = useCallback(
    (id: string, updates: Partial<LearningSection>) => {
      setSectionsOrganization((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sections: updateSectionById(prev.sections, id, updates),
        };
      });
      markUnsaved();
    },
    [markUnsaved]
  );

  const deleteSection = useCallback(
    (id: string) => {
      setSectionsOrganization((prev) => {
        if (!prev) return prev;

        // When deleting a section, move its topics to an "Unsorted" section or remove them
        const sectionToDelete = findSectionById(prev.sections, id);
        if (!sectionToDelete) return prev;

        // Simply delete the section - topics will appear in "Unsorted" view
        const updatedSections = deleteSectionById(prev.sections, id);

        return { ...prev, sections: updatedSections };
      });
      markUnsaved();
    },
    [markUnsaved]
  );

  const reorderSections = useCallback(
    (fromIndex: number, toIndex: number) => {
      setSectionsOrganization((prev) => {
        if (!prev) return prev;
        const reordered = arrayMove(prev.sections, fromIndex, toIndex);
        return { ...prev, sections: reordered };
      });
      markUnsaved();
    },
    [markUnsaved]
  );

  const toggleCollapse = useCallback(
    (id: string) => {
      setSectionsOrganization((prev) => {
        if (!prev) return prev;
        const section = findSectionById(prev.sections, id);
        if (!section) return prev;
        return {
          ...prev,
          sections: updateSectionById(prev.sections, id, {
            isCollapsed: !section.isCollapsed,
          }),
        };
      });
      // Don't mark as unsaved for collapse state - it's just UI
    },
    []
  );

  // ========== Topic Management ==========
  const moveTopicToSection = useCallback(
    (topicSlug: string, targetSectionId: string) => {
      setSectionsOrganization((prev) => {
        if (!prev) return prev;

        // Remove topic from all sections first
        let sections = removeTopicFromSections(prev.sections, topicSlug);
        // Add to target section
        sections = addTopicToSection(sections, targetSectionId, topicSlug);

        return { ...prev, sections };
      });
      markUnsaved();
    },
    [markUnsaved]
  );

  const reorderChildrenInSection = useCallback(
    (sectionId: string, fromIndex: number, toIndex: number) => {
      setSectionsOrganization((prev) => {
        if (!prev) return prev;

        const updatedSections = prev.sections.map((section) => {
          if (section.id === sectionId) {
            const reorderedChildren = arrayMove(
              section.children,
              fromIndex,
              toIndex
            ) as LearningSectionChild[];
            return { ...section, children: reorderedChildren };
          }
          // Check nested sections
          const updatedChildren = section.children.map((child) => {
            if (isLearningSection(child) && child.id === sectionId) {
              const reorderedChildren = arrayMove(
                child.children,
                fromIndex,
                toIndex
              ) as LearningSectionChild[];
              return { ...child, children: reorderedChildren };
            }
            return child;
          });
          return { ...section, children: updatedChildren };
        });

        return { ...prev, sections: updatedSections };
      });
      markUnsaved();
    },
    [markUnsaved]
  );

  // ========== Memoized Context Value ==========
  const value = useMemo<LearningSectionEditorContextValue>(
    () => ({
      // Data
      sectionsOrganization,
      topicSections,
      isLoading,
      error,

      // Edit state
      isEditing,
      setIsEditing,
      hasUnsavedChanges,
      isSaving,

      // Section CRUD
      addSection,
      updateSection,
      deleteSection,
      reorderSections,
      toggleCollapse,

      // Topic management
      moveTopicToSection,
      reorderChildrenInSection,

      // Save
      save,
      discardChanges,
      initializeDefaultSections,
    }),
    [
      sectionsOrganization,
      topicSections,
      isLoading,
      error,
      isEditing,
      hasUnsavedChanges,
      isSaving,
      addSection,
      updateSection,
      deleteSection,
      reorderSections,
      toggleCollapse,
      moveTopicToSection,
      reorderChildrenInSection,
      save,
      discardChanges,
      initializeDefaultSections,
    ]
  );

  return (
    <LearningSectionEditorContext.Provider value={value}>
      {children}
    </LearningSectionEditorContext.Provider>
  );
}
