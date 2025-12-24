/**
 * Prompts Tab Component
 *
 * Displays all prompts the user has saved to their prompt library.
 * Prompts are projects with type='prompt' that can be shared publicly.
 */
import { useState, useEffect, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faLightbulb, faPlus, faSearch, faTimes, faPencil, faTrash } from '@fortawesome/free-solid-svg-icons';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { MasonryGrid } from '@/components/common/MasonryGrid';
import { PromptFormSidebar } from '@/components/prompts/PromptFormSidebar';
import { getPromptLibrary, deleteProjectById } from '@/services/projects';
import type { Project } from '@/types/models';

interface PromptsTabProps {
  username: string;
  isOwnProfile: boolean;
  onOpenCreateForm?: () => void;
}

/**
 * Prompt Card with Edit/Delete actions for owners
 */
function PromptCardWithActions({
  prompt,
  isOwner,
  onEdit,
  onDelete,
}: {
  prompt: Project;
  isOwner: boolean;
  onEdit: (prompt: Project) => void;
  onDelete: (promptId: number) => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this prompt?')) return;

    setIsDeleting(true);
    try {
      await deleteProjectById(prompt.id);
      onDelete(prompt.id);
    } catch (error) {
      console.error('Failed to delete prompt:', error);
      alert('Failed to delete prompt. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // For owners, clicking the card opens the edit form
  const handleCardClick = (e: React.MouseEvent) => {
    if (isOwner) {
      e.preventDefault();
      e.stopPropagation();
      onEdit(prompt);
    }
  };

  return (
    <div
      className="relative group/card"
      onClick={handleCardClick}
      style={{ cursor: isOwner ? 'pointer' : undefined }}
    >
      {/* Wrap ProjectCard to prevent its navigation for owners */}
      <div className={isOwner ? 'pointer-events-none' : ''}>
        <ProjectCard
          project={prompt}
          isOwner={isOwner}
          variant="masonry"
        />
      </div>
      {/* Owner Actions Overlay */}
      {isOwner && (
        <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover/card:opacity-100 transition-opacity z-20 pointer-events-auto">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit(prompt);
            }}
            className="p-2 rounded-full bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 shadow-lg transition-all hover:scale-110"
            title="Edit prompt"
          >
            <FontAwesomeIcon icon={faPencil} className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDelete();
            }}
            disabled={isDeleting}
            className="p-2 rounded-full bg-white/90 dark:bg-gray-800/90 hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 shadow-lg transition-all hover:scale-110 disabled:opacity-50"
            title="Delete prompt"
          >
            <FontAwesomeIcon icon={isDeleting ? faSpinner : faTrash} className={`w-3.5 h-3.5 ${isDeleting ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}
    </div>
  );
}

export function PromptsTab({
  username,
  isOwnProfile,
  onOpenCreateForm,
}: PromptsTabProps) {
  const [prompts, setPrompts] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Edit state
  const [editingPrompt, setEditingPrompt] = useState<Project | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    async function fetchPrompts() {
      if (!username) return;

      setIsLoading(true);
      setError(null);

      try {
        const promptProjects = await getPromptLibrary(username);
        setPrompts(promptProjects);
      } catch (err) {
        console.error('Failed to load prompts:', err);
        setError('Failed to load prompts');
      } finally {
        setIsLoading(false);
      }
    }

    fetchPrompts();
  }, [username]);

  // Extract unique tags from all prompts (using topicsDetails for taxonomy names)
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    prompts.forEach((prompt) => {
      prompt.topicsDetails?.forEach((topic) => {
        tagSet.add(topic.name);
      });
    });
    return Array.from(tagSet).sort();
  }, [prompts]);

  // Filter prompts based on search and tags
  const filteredPrompts = useMemo(() => {
    return prompts.filter((prompt) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = prompt.title?.toLowerCase().includes(query);
        const matchesDescription = prompt.description?.toLowerCase().includes(query);
        // Check prompt text in content (heroQuote is preferred, fallback to prompt.text)
        const promptContent = prompt.content as { prompt?: { text?: string }; heroQuote?: string };
        const promptText = promptContent?.heroQuote || promptContent?.prompt?.text || '';
        const matchesContent = promptText.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDescription && !matchesContent) {
          return false;
        }
      }

      // Tag filter
      if (selectedTags.length > 0) {
        const promptTopics = prompt.topicsDetails || [];
        const hasMatchingTag = selectedTags.some((tag) =>
          promptTopics.some((topic) => topic.name.toLowerCase() === tag.toLowerCase())
        );
        if (!hasMatchingTag) {
          return false;
        }
      }

      return true;
    });
  }, [prompts, searchQuery, selectedTags]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTags([]);
  };

  // Handle prompt save (create or update)
  const handlePromptSave = (savedPrompt: Project) => {
    if (editingPrompt) {
      // Update existing prompt in the list
      setPrompts((prev) =>
        prev.map((p) => (p.id === savedPrompt.id ? savedPrompt : p))
      );
    } else {
      // Add new prompt to the list
      setPrompts((prev) => [savedPrompt, ...prev]);
    }
    setEditingPrompt(null);
    setShowCreateForm(false);
  };

  // Handle prompt delete
  const handlePromptDelete = (promptId: number) => {
    setPrompts((prev) => prev.filter((p) => p.id !== promptId));
  };

  // Handle opening create form
  const handleOpenCreate = () => {
    setEditingPrompt(null);
    setShowCreateForm(true);
    onOpenCreateForm?.();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <FontAwesomeIcon icon={faSpinner} className="w-8 h-8 text-cyan-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 dark:text-gray-400">{error}</p>
      </div>
    );
  }

  if (prompts.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <FontAwesomeIcon icon={faLightbulb} className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          No prompts yet
        </h3>

        {isOwnProfile ? (
          <>
            <div className="max-w-md mx-auto">
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                Share prompts you use with ChatGPT, Claude, Midjourney, and other AI tools.
              </p>
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white font-medium rounded-xl transition-all shadow-[0_0_15px_rgba(14,165,233,0.3)] hover:shadow-[0_0_20px_rgba(14,165,233,0.4)]"
              >
                <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
                Add Your First Prompt
              </button>
            </div>
            {/* Create/Edit Sidebar */}
            <PromptFormSidebar
              isOpen={showCreateForm || !!editingPrompt}
              onClose={() => {
                setShowCreateForm(false);
                setEditingPrompt(null);
              }}
              onSave={handlePromptSave}
              editPrompt={editingPrompt}
            />
          </>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            {username} hasn't shared any prompts yet.
          </p>
        )}
      </div>
    );
  }

  const hasActiveFilters = searchQuery || selectedTags.length > 0;

  return (
    <div className="space-y-6">
      {/* Header with Add button and Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {isOwnProfile && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white font-medium rounded-lg transition-all shadow-[0_0_10px_rgba(14,165,233,0.25)] hover:shadow-[0_0_15px_rgba(14,165,233,0.35)]"
          >
            <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
            Add Prompt
          </button>
        )}

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <FontAwesomeIcon
            icon={faSearch}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search prompts..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tag Filters */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {allTags.slice(0, 10).map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1 text-sm rounded-full transition-all ${
                selectedTags.includes(tag)
                  ? 'bg-cyan-500 text-white shadow-[0_0_8px_rgba(14,165,233,0.25)]'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {tag}
            </button>
          ))}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Results count */}
      {hasActiveFilters && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Showing {filteredPrompts.length} of {prompts.length} prompts
        </p>
      )}

      {/* Prompts Grid */}
      {filteredPrompts.length > 0 ? (
        <MasonryGrid>
          {filteredPrompts.map((prompt) => (
            <div key={prompt.id} className="break-inside-avoid mb-6">
              <PromptCardWithActions
                prompt={prompt}
                isOwner={isOwnProfile}
                onEdit={setEditingPrompt}
                onDelete={handlePromptDelete}
              />
            </div>
          ))}
        </MasonryGrid>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">
            No prompts match your filters.
          </p>
          <button
            onClick={clearFilters}
            className="mt-2 text-cyan-500 hover:text-cyan-600"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Create/Edit Sidebar */}
      {isOwnProfile && (
        <PromptFormSidebar
          isOpen={showCreateForm || !!editingPrompt}
          onClose={() => {
            setShowCreateForm(false);
            setEditingPrompt(null);
          }}
          onSave={handlePromptSave}
          editPrompt={editingPrompt}
        />
      )}
    </div>
  );
}
