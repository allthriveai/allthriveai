import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateProject } from '@/services/projects';
import { ToolSelector } from '@/components/projects/ToolSelector';
import { TopicDropdown } from '@/components/projects/TopicDropdown';
import type { Project } from '@/types/models';
import { ProjectEditor } from '@/components/projects/ProjectEditor';
import { generateSlug } from '@/utils/slug';
import {
  XMarkIcon,
  PhotoIcon,
  TrashIcon,
  ArrowTopRightOnSquareIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import {
  FaImage,
  FaVideo,
  FaQuoteLeft,
  FaImages,
  FaArrowUp,
  FaStar,
  FaLock,
} from 'react-icons/fa';

interface ProjectEditTrayProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  onProjectUpdate: (updatedProject: Project) => void;
}

type TabId = 'content' | 'hero' | 'settings';

export function ProjectEditTray({ isOpen, onClose, project, onProjectUpdate }: ProjectEditTrayProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('content');

  // Handle slug change for tray (use window.history to avoid unmounting)
  const handleSlugChange = (newSlug: string) => {
    if (project.username) {
      window.history.replaceState({}, '', `/${project.username}/${newSlug}`);
    }
  };

  // Preserve like state when updating project
  const handleProjectUpdate = (updatedProject: Project) => {
    const projectWithLikes = {
      ...updatedProject,
      isLikedByUser: project.isLikedByUser,
      heartCount: project.heartCount,
    };
    onProjectUpdate(projectWithLikes);
  };

  if (!isOpen) return null;

  return (
    <ProjectEditor
      project={project}
      onProjectUpdate={handleProjectUpdate}
      onSlugChange={handleSlugChange}
    >
      {(editorProps) => (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/20 z-40 animate-[fade-in_0.2s_ease-out]"
            onClick={onClose}
          />

          {/* Sidebar */}
          <div className="fixed top-0 right-0 h-full w-full md:w-[600px] lg:w-[700px] bg-white dark:bg-gray-900 shadow-2xl z-50 overflow-y-auto animate-[slide-in-right_0.3s_ease-out]">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between z-10">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Project</h2>
                  {editorProps.isSaving ? (
                    <p className="text-xs text-gray-500">Saving...</p>
                  ) : editorProps.lastSaved ? (
                    <p className="text-xs text-gray-500">Saved {editorProps.lastSaved.toLocaleTimeString()}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/${project.username}/${project.slug}/edit`)}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                    title="Open full editor"
                  >
                    <ArrowTopRightOnSquareIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={onClose}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="border-b border-gray-200 dark:border-gray-800 px-6">
                <nav className="flex gap-4" aria-label="Tabs">
                  {[
                    { id: 'content' as const, label: 'Content', icon: PhotoIcon },
                    { id: 'hero' as const, label: 'Hero Display', icon: FaImage },
                    { id: 'settings' as const, label: 'Settings', icon: Cog6ToothIcon },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                          activeTab === tab.id
                            ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {tab.label}
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'content' && (
                  <div className="space-y-6">
                    {/* Title */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                        Project Title
                      </label>
                      <input
                        type="text"
                        value={editorProps.projectTitle}
                        onChange={(e) => editorProps.setProjectTitle(e.target.value)}
                        placeholder="Enter your project title"
                        disabled={editorProps.isSaving}
                        className="w-full px-4 py-3 text-lg border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                        Description
                      </label>
                      <textarea
                        value={editorProps.projectDescription}
                        onChange={(e) => editorProps.setProjectDescription(e.target.value)}
                        placeholder="Brief description of your project"
                        rows={3}
                        disabled={editorProps.isSaving}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                      />
                    </div>

                    {/* Tools */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                        Tools & Technologies
                      </label>
                      <ToolSelector
                        selectedToolIds={editorProps.projectTools}
                        onChange={editorProps.setProjectTools}
                      />
                    </div>

                    {/* Topics */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                        Topics
                      </label>
                      <TopicDropdown
                        selectedTopics={editorProps.projectTopics}
                        availableTopics={editorProps.availableTopics}
                        onChange={editorProps.setProjectTopics}
                      />
                    </div>

                    {/* External URL */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                        Project URL
                      </label>
                      <input
                        type="url"
                        value={editorProps.projectUrl}
                        onChange={(e) => editorProps.setProjectUrl(e.target.value)}
                        placeholder="https://example.com"
                        disabled={editorProps.isSaving}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Link to live project, GitHub repo, or demo
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === 'hero' && (
                  <div className="space-y-6">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Choose how to showcase your project in the hero section
                    </p>

                    {/* Hero Display Mode Tabs */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => editorProps.setHeroDisplayMode('image')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                          editorProps.heroDisplayMode === 'image'
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                            : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <FaImage />
                        Image
                      </button>
                      <button
                        onClick={() => editorProps.setHeroDisplayMode('video')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                          editorProps.heroDisplayMode === 'video'
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                            : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <FaVideo />
                        Video
                      </button>
                      <button
                        onClick={() => editorProps.setHeroDisplayMode('quote')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                          editorProps.heroDisplayMode === 'quote'
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                            : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <FaQuoteLeft />
                        Quote
                      </button>
                      <button
                        onClick={() => editorProps.setHeroDisplayMode('slideshow')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                          editorProps.heroDisplayMode === 'slideshow'
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                            : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <FaImages />
                        Slideshow
                      </button>
                      <button
                        onClick={() => editorProps.setHeroDisplayMode('slideup')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                          editorProps.heroDisplayMode === 'slideup'
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                            : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <FaArrowUp />
                        Slide Up
                      </button>
                    </div>

                    {/* Mode-specific inputs */}
                    {editorProps.heroDisplayMode === 'image' && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                          Featured Image
                        </label>
                        {editorProps.featuredImageUrl ? (
                          <div className="relative group">
                            <img src={editorProps.featuredImageUrl} alt="Featured" className="w-full rounded-lg" />
                            <button
                              onClick={() => editorProps.setFeaturedImageUrl('')}
                              className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg cursor-pointer hover:border-primary-500">
                            <PhotoIcon className="w-12 h-12 text-gray-400 mb-2" />
                            <span className="text-sm text-gray-500">Click to upload image</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) editorProps.handleFeaturedImageUpload(file);
                              }}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    )}

                    {editorProps.heroDisplayMode === 'quote' && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                          Quote Text
                        </label>
                        <textarea
                          value={editorProps.heroQuote}
                          onChange={(e) => editorProps.setHeroQuote(e.target.value)}
                          placeholder="Enter your quote or key message..."
                          rows={4}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    )}

                    {editorProps.heroDisplayMode === 'video' && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                          Video URL
                        </label>
                        <input
                          type="url"
                          value={editorProps.heroVideoUrl}
                          onChange={(e) => editorProps.setHeroVideoUrl(e.target.value)}
                          placeholder="YouTube, Vimeo, or Loom URL"
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'settings' && (
                  <div className="space-y-6">
                    {/* Visibility Options */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Visibility</h3>
                      <div className="space-y-2">
                        <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
                          <div className="flex items-center gap-3">
                            <FaStar className="w-5 h-5 text-yellow-500" />
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">Showcase</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">Display in showcase section</p>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={project.isShowcase}
                            onChange={async () => {
                              try {
                                const updated = await updateProject(project.id, {
                                  isShowcase: !project.isShowcase,
                                });
                                handleProjectUpdate(updated);
                              } catch (error) {
                                console.error('Failed to update:', error);
                              }
                            }}
                            className="w-5 h-5 text-primary-500 bg-gray-100 border-gray-300 rounded focus:ring-primary-500"
                          />
                        </label>

                        <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
                          <div className="flex items-center gap-3">
                            <FaLock className="w-5 h-5 text-gray-500" />
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">Private</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">Hide from public</p>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={project.isPrivate || false}
                            onChange={async () => {
                              try {
                                const updated = await updateProject(project.id, {
                                  isPrivate: !project.isPrivate,
                                });
                                handleProjectUpdate(updated);
                              } catch (error) {
                                console.error('Failed to update:', error);
                              }
                            }}
                            className="w-5 h-5 text-primary-500 bg-gray-100 border-gray-300 rounded focus:ring-primary-500"
                          />
                        </label>
                      </div>
                    </div>

                    {/* Project Slug */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Project URL</h3>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">/{project.username}/</span>
                          <input
                            type="text"
                            value={editorProps.editableSlug}
                            onChange={(e) => {
                              editorProps.setEditableSlug(e.target.value);
                              editorProps.setCustomSlugSet(true);
                            }}
                            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                        {editorProps.customSlugSet && (
                          <button
                            onClick={() => {
                              editorProps.setCustomSlugSet(false);
                              editorProps.setEditableSlug(generateSlug(editorProps.projectTitle));
                            }}
                            className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                          >
                            Reset to auto-generate
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </ProjectEditor>
  );
}
