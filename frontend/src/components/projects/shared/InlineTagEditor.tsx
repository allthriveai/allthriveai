/**
 * InlineTagEditor - Admin-only component for editing project tags inline
 *
 * Allows admins to edit tools, categories, and topics for Reddit projects.
 * Once edited, tags are locked and won't be overwritten during resync.
 */

import { useState, useEffect } from 'react';
import { PencilIcon, CheckIcon, XMarkIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { CodeBracketIcon } from '@heroicons/react/24/solid';
import type { Project, Tool, Taxonomy } from '@/types/models';
import { updateProjectTags, getTools, getTaxonomies } from '@/services/projects';

// Shared styling constants
const SECTION_LABEL = 'text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider';
const TAG_CONTAINER = 'flex flex-wrap gap-2';
const EMPTY_STATE_TEXT = 'text-sm text-gray-500 dark:text-gray-400 italic';

interface InlineTagEditorProps {
  project: Project;
  onProjectUpdate: (project: Project) => void;
  isAdmin: boolean;
}

export function InlineTagEditor({ project, onProjectUpdate, isAdmin }: InlineTagEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Available options
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [availableCategories, setAvailableCategories] = useState<Taxonomy[]>([]);

  // Selected values
  const [selectedToolIds, setSelectedToolIds] = useState<number[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [newTopic, setNewTopic] = useState('');

  // Load available tools and categories when editing starts
  useEffect(() => {
    if (isEditing && availableTools.length === 0) {
      loadOptions();
    }
  }, [isEditing]);

  // Initialize selected values from project
  useEffect(() => {
    if (isEditing) {
      setSelectedToolIds(project.toolsDetails?.map(t => t.id) || []);
      setSelectedCategoryIds(project.categoriesDetails?.map(c => c.id) || []);
      setTopics(project.topics || []);
    }
  }, [isEditing, project]);

  const loadOptions = async () => {
    try {
      const [toolsData, categoriesData] = await Promise.all([
        getTools(),
        getTaxonomies('category'),
      ]);
      setAvailableTools(toolsData);
      setAvailableCategories(categoriesData);
    } catch (err) {
      console.error('Failed to load options:', err);
      setError('Failed to load available tags');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const updatedProject = await updateProjectTags(project.id, {
        tools: selectedToolIds,
        categories: selectedCategoryIds,
        topics: topics,
      });

      onProjectUpdate(updatedProject);
      setIsEditing(false);
    } catch (err: any) {
      console.error('Failed to update tags:', err);
      setError(err.response?.data?.error || 'Failed to update tags');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError(null);
    // Reset to original values
    setSelectedToolIds(project.toolsDetails?.map(t => t.id) || []);
    setSelectedCategoryIds(project.categoriesDetails?.map(c => c.id) || []);
    setTopics(project.topics || []);
  };

  const toggleTool = (toolId: number) => {
    setSelectedToolIds(prev =>
      prev.includes(toolId)
        ? prev.filter(id => id !== toolId)
        : [...prev, toolId]
    );
  };

  const toggleCategory = (categoryId: number) => {
    setSelectedCategoryIds(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const addTopic = () => {
    const trimmed = newTopic.trim().toLowerCase();
    if (trimmed && !topics.includes(trimmed) && topics.length < 15) {
      setTopics([...topics, trimmed]);
      setNewTopic('');
    }
  };

  const removeTopic = (topic: string) => {
    setTopics(prev => prev.filter(t => t !== topic));
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      {/* Header with Edit Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tags</h3>
          {project.tagsManuallyEdited && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-primary-50 dark:bg-primary-900/20 rounded-md">
              <LockClosedIcon className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
              <span className="text-xs font-medium text-primary-600 dark:text-primary-400">Manually Curated</span>
            </div>
          )}
        </div>

        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
          >
            <PencilIcon className="w-4 h-4" />
            Edit Tags
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
            >
              <XMarkIcon className="w-4 h-4" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckIcon className="w-4 h-4" />
                  Save
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Tools Section */}
      <div className="space-y-3">
        <p className={SECTION_LABEL}>Tools</p>

        {isEditing ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {availableTools.map(tool => (
              <button
                key={tool.id}
                onClick={() => toggleTool(tool.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all text-left ${
                  selectedToolIds.includes(tool.id)
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
                }`}
              >
                {tool.logoUrl ? (
                  <img src={tool.logoUrl} alt={tool.name} className="w-5 h-5 rounded object-cover" />
                ) : (
                  <CodeBracketIcon className="w-5 h-5" />
                )}
                <span className="text-sm font-medium truncate">{tool.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className={TAG_CONTAINER}>
            {project.toolsDetails && project.toolsDetails.length > 0 ? (
              project.toolsDetails.map(tool => (
                <div
                  key={tool.id}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  {tool.logoUrl ? (
                    <img src={tool.logoUrl} alt={tool.name} className="w-4 h-4 rounded object-cover" />
                  ) : (
                    <CodeBracketIcon className="w-4 h-4 text-gray-500" />
                  )}
                  <span className="text-sm text-gray-700 dark:text-gray-300">{tool.name}</span>
                </div>
              ))
            ) : (
              <p className={EMPTY_STATE_TEXT}>No tools selected</p>
            )}
          </div>
        )}
      </div>

      {/* Categories Section */}
      <div className="space-y-3">
        <p className={SECTION_LABEL}>Category</p>

        {isEditing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {availableCategories.map(category => (
              <button
                key={category.id}
                onClick={() => toggleCategory(category.id)}
                className={`px-4 py-2 rounded-lg border-2 transition-all text-left ${
                  selectedCategoryIds.includes(category.id)
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
                }`}
              >
                <span className="text-sm font-medium">{category.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className={TAG_CONTAINER}>
            {project.categoriesDetails && project.categoriesDetails.length > 0 ? (
              project.categoriesDetails.map(category => (
                <div
                  key={category.id}
                  className="px-4 py-1.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm font-medium"
                >
                  {category.name}
                </div>
              ))
            ) : (
              <p className={EMPTY_STATE_TEXT}>No category selected</p>
            )}
          </div>
        )}
      </div>

      {/* Topics Section */}
      <div className="space-y-3">
        <p className={SECTION_LABEL}>Topics</p>

        {isEditing ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addTopic()}
                placeholder="Add topic..."
                maxLength={50}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <button
                onClick={addTopic}
                disabled={!newTopic.trim() || topics.length >= 15}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
            <div className={TAG_CONTAINER}>
              {topics.map(topic => (
                <div
                  key={topic}
                  className="flex items-center gap-1.5 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm"
                >
                  <span>{topic}</span>
                  <button
                    onClick={() => removeTopic(topic)}
                    className="hover:bg-purple-200 dark:hover:bg-purple-900/50 rounded-full p-0.5 transition-colors"
                  >
                    <XMarkIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            {topics.length >= 15 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">Maximum 15 topics</p>
            )}
          </div>
        ) : (
          <div className={TAG_CONTAINER}>
            {project.topics && project.topics.length > 0 ? (
              project.topics.map(topic => (
                <div
                  key={topic}
                  className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm"
                >
                  {topic}
                </div>
              ))
            ) : (
              <p className={EMPTY_STATE_TEXT}>No topics</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
