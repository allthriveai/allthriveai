import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { listProjects, updateProject } from '@/services/projects';
import type { Project, ProjectBlock } from '@/types/models';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { BlockRenderer } from '@/components/editor/ContentBlocks';
import {
  ArrowLeftIcon,
  EyeIcon,
  CloudArrowUpIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

export default function ProjectEditPage() {
  const { username, projectSlug } = useParams<{ username: string; projectSlug: string }>();
  const navigate = useNavigate();
  
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  // Editor state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [blocks, setBlocks] = useState<ProjectBlock[]>([]);
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Load project
  useEffect(() => {
    async function loadProject() {
      if (!projectSlug || !username) {
        setError('Invalid project URL');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Fetch all projects and find by slug
        // TODO: Add dedicated endpoint GET /api/v1/me/projects/by-slug/:slug/
        const projects = await listProjects();
        const foundProject = projects.find(p => p.slug === projectSlug && p.username === username);
        
        if (!foundProject) {
          setError('Project not found');
          return;
        }
        
        setProject(foundProject);
      } catch (err) {
        console.error('Failed to load project:', err);
        setError('Failed to load project');
      } finally {
        setIsLoading(false);
      }
    }

    loadProject();
  }, [projectSlug, username]);

  // Initialize form when project loads
  useEffect(() => {
    if (project) {
      setTitle(project.title);
      setDescription(project.description);
      // Add IDs to blocks if they don't have them
      const blocksWithIds = (project.content.blocks || []).map((block: any) => ({
        ...block,
        id: block.id || crypto.randomUUID(),
      }));
      setBlocks(blocksWithIds);
      setCoverImageUrl(project.content.coverImage?.url || '');
      setTags(project.content.tags || []);
    }
  }, [project]);

  const handleSave = async () => {
    if (!project) return;

    setIsSaving(true);
    try {
      const updatedProject = await updateProject(project.id, {
        title,
        description,
        content: {
          coverImage: coverImageUrl ? { url: coverImageUrl } : undefined,
          blocks,
          tags,
        },
      });
      setProject(updatedProject);
      setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to save:', err);
      alert('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!project) return;

    if (!window.confirm('Publish this project? It will be visible to everyone.')) {
      return;
    }

    setIsSaving(true);
    try {
      const updatedProject = await updateProject(project.id, {
        isPublished: true,
      });
      setProject(updatedProject);
      alert('Project published successfully!');
      navigate(`/${project.username}/${project.slug}`);
    } catch (err) {
      console.error('Failed to publish:', err);
      alert('Failed to publish project');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreview = () => {
    if (project) {
      window.open(`/${project.username}/${project.slug}`, '_blank');
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading editor...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !project) {
    return (
      <DashboardLayout>
        <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900 p-8">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              {error || 'Project Not Found'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Unable to load project editor.
            </p>
            <Link
              to={`/${username}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              Back to Profile
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 overflow-hidden">
        {/* Editor Header */}
        <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to={`/${project.username}/${project.slug}`}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Edit Project
                </h1>
                {lastSaved && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Last saved {lastSaved.toLocaleTimeString()}
                  </p>
                )}
              </div>
              {!project.isPublished && (
                <span className="px-3 py-1 text-sm font-medium rounded-full bg-yellow-500/20 text-yellow-700 dark:text-yellow-400">
                  Draft
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handlePreview}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <EyeIcon className="w-5 h-5" />
                Preview
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <CloudArrowUpIcon className="w-5 h-5" />
                {isSaving ? 'Saving...' : 'Save Draft'}
              </button>
              {!project.isPublished && (
                <button
                  onClick={handlePublish}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <CheckCircleIcon className="w-5 h-5" />
                  Publish
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Editor Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 text-2xl font-bold border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Project title"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Brief description of your project"
              />
            </div>

            {/* Cover Image */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Cover Image URL
              </label>
              <input
                type="url"
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="https://example.com/image.jpg"
              />
              {coverImageUrl && (
                <div className="mt-4">
                  <img
                    src={coverImageUrl}
                    alt="Cover preview"
                    className="w-full h-64 object-cover rounded-lg"
                  />
                </div>
              )}
            </div>

            {/* Content Blocks */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Content</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const id = crypto.randomUUID();
                      setBlocks((prev) => [
                        ...(prev || []),
                        { id, type: 'text', content: 'New paragraph', style: 'body' },
                      ] as any);
                    }}
                    className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded"
                  >
                    + Text
                  </button>
                  <button
                    onClick={() => {
                      const id = crypto.randomUUID();
                      setBlocks((prev) => [
                        ...(prev || []),
                        { id, type: 'image', url: '', caption: '' },
                      ] as any);
                    }}
                    className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded"
                  >
                    + Image
                  </button>
                </div>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event) => {
                  const { active, over } = event;
                  if (!over || active.id === over.id) return;

                  const items = (blocks || []).map((b: any) => b.id ?? (b.id = crypto.randomUUID())) as any[];
                  const oldIndex = items.findIndex((b: any) => b.id === active.id);
                  const newIndex = items.findIndex((b: any) => b.id === over.id);
                  setBlocks((prev: any) => arrayMove(prev, oldIndex, newIndex));
                }}
              >
                <SortableContext
                  items={(blocks || []).map((b: any) => b.id ?? (b.id = crypto.randomUUID()))}
                  strategy={verticalListSortingStrategy}
                >
                  {(blocks && blocks.length > 0) ? (
                    <div>
                      {blocks.map((block: any) => (
                        <BlockRenderer
                          key={block.id}
                          block={block}
                          onUpdate={(id, updated) => {
                            setBlocks((prev: any) => prev.map((b: any) => (b.id === id ? { id, ...updated } : b)));
                          }}
                          onDelete={(id) => {
                            setBlocks((prev: any) => prev.filter((b: any) => b.id !== id));
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-12 text-center">
                      <p className="text-gray-500 dark:text-gray-400 mb-4">
                        No content yet. Add your first block.
                      </p>
                    </div>
                  )}
                </SortableContext>
              </DndContext>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
