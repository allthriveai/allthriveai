import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User, Project, ProjectType } from '@/types/models';
import { getUserProjects, createProject } from '@/services/projects';
import { getUserByUsername } from '@/services/auth';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { ActivityFeed } from './ActivityFeed';
import { PlusIcon } from '@heroicons/react/24/outline';

interface ProfileCenterProps {
  username?: string; // Username from URL params
  user: User | null; // Currently logged-in user (if any)
  isAuthenticated: boolean;
  isOwnProfile: boolean;
  activeTab: 'showcase' | 'playground' | 'activity';
  onTabChange: (tab: 'showcase' | 'playground' | 'activity') => void;
  onOpenChat?: (menuItem: string) => void;
}

export function ProfileCenter({ username, user, isAuthenticated, isOwnProfile, activeTab, onTabChange, onOpenChat }: ProfileCenterProps) {
  const navigate = useNavigate();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<{ showcase: Project[]; playground: Project[] }>({ 
    showcase: [], 
    playground: [] 
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<{ 
    title: string;
    description: string;
    type: ProjectType;
    isShowcase: boolean;
    thumbnailUrl: string;
  }>({
    title: '',
    description: '',
    type: 'other',
    isShowcase: true,
    thumbnailUrl: ''
  });

  // Determine which user's profile we're viewing
  const displayUsername = username || user?.username;
  const displayUser = isOwnProfile ? user : profileUser;

  // Fetch profile user data if viewing someone else's profile
  useEffect(() => {
    // If viewing own profile, use current user
    if (isOwnProfile) {
      setProfileUser(user);
      return;
    }
    
    // Fetch public user profile by username for other users
    if (username) {
      getUserByUsername(username)
        .then(setProfileUser)
        .catch((error) => {
          console.error('Failed to load user profile:', error);
          setProfileUser(null);
        });
    } else {
      setProfileUser(user);
    }
  }, [username, user, isOwnProfile]);

  // Fetch projects when username changes
  useEffect(() => {
    async function loadProjects() {
      if (!displayUsername) return;
      
      setIsLoading(true);
      try {
        const data = await getUserProjects(displayUsername);
        setProjects(data);
      } catch (error) {
        console.error('Failed to load projects:', error);
        // For logged-out users, show empty state
        if (!isAuthenticated) {
          setProjects({ showcase: [], playground: [] });
        }
      } finally {
        setIsLoading(false);
      }
    }
    
    loadProjects();
  }, [displayUsername, isAuthenticated]);

  // Listen for project creation events from chat
  useEffect(() => {
    const handleProjectCreated = async (event: CustomEvent) => {
      console.log('Project created event received:', event.detail);
      // Refresh projects list
      if (user?.username) {
        try {
          const data = await getUserProjects(user.username);
          setProjects(data);
          // Switch to appropriate tab
          const projectId = event.detail.projectId;
          const project = data.showcase.find(p => p.id === projectId) || 
                         data.playground.find(p => p.id === projectId);
          if (project?.isShowcase) {
            onTabChange('showcase');
          } else {
            onTabChange('playground');
          }
        } catch (error) {
          console.error('Failed to refresh projects:', error);
        }
      }
    };

    window.addEventListener('project-created', handleProjectCreated as EventListener);
    return () => {
      window.removeEventListener('project-created', handleProjectCreated as EventListener);
    };
  }, [user?.username, onTabChange]);
  // Only show all tabs to authenticated users viewing their own profile
  const tabs = isAuthenticated && isOwnProfile
    ? [
        { id: 'showcase', label: 'Showcase' },
        { id: 'playground', label: 'Playground' },
        { id: 'activity', label: 'Activity' },
      ] as const
    : [{ id: 'showcase', label: 'Showcase' }] as const;

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 overflow-hidden">
      {/* Profile Header with Banner */}
      <div className="relative">
        {/* Banner Image */}
        <div className="h-64 w-full bg-gradient-to-br from-primary-500 via-primary-600 to-secondary-600 relative overflow-hidden">
          {/* Decorative pattern overlay */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
              backgroundSize: '32px 32px'
            }} />
          </div>
        </div>

        {/* Profile Info - Overlapping banner */}
        <div className="relative -mt-16 px-8 pb-6">
          <div className="flex items-end gap-6">
            {/* Profile Photo */}
            <div className="flex-shrink-0">
              <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-4xl font-bold overflow-hidden border-4 border-white dark:border-gray-900 shadow-xl">
                {displayUser?.avatarUrl ? (
                  <img
                    src={displayUser.avatarUrl}
                    alt={displayUser.firstName || 'Profile'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{(displayUser?.firstName || username?.[0]?.toUpperCase() || 'U')}</span>
                )}
              </div>
            </div>

            {/* Profile Info */}
            <div className="flex-1 pb-2">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                {displayUser?.firstName || username} {displayUser?.lastName || ''}
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                @{displayUsername}
              </p>
            </div>
          </div>

          {/* Bio */}
          {displayUser?.bio && (
            <div className="mt-6 max-w-3xl">
              <p className="text-gray-700 dark:text-gray-300">
                {displayUser.bio}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs and Actions */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-8 sticky top-0 bg-white dark:bg-gray-900 z-10">
        {/* Tabs */}
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-6 py-4 font-semibold transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Add Project Button - only show for authenticated users on their own profile */}
        {isAuthenticated && isOwnProfile && (activeTab === 'showcase' || activeTab === 'playground') && (
          <button
            onClick={async () => {
              // Create a blank project and navigate to editor
              try {
                const newProject = await createProject({
                  title: 'Untitled Project',
                  description: '',
                  type: 'other',
                  isShowcase: activeTab === 'showcase',
                  content: { blocks: [] },
                });
                navigate(`/${user?.username}/${newProject.slug}/edit`);
              } catch (error) {
                console.error('Failed to create project:', error);
                alert('Failed to create project');
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors shadow-sm"
          >
            <PlusIcon className="w-5 h-5" />
            Add Project
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="flex-1 p-8 overflow-y-auto bg-gray-50 dark:bg-gray-950">
        {activeTab === 'showcase' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Showcase
                {!isLoading && (
                  <span className="ml-3 text-sm font-normal text-gray-500 dark:text-gray-400">
                    {projects.showcase.length} {projects.showcase.length === 1 ? 'project' : 'projects'}
                  </span>
                )}
              </h2>
            </div>
            
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="glass-subtle rounded-xl p-4 animate-pulse">
                    <div className="aspect-video bg-gray-300 dark:bg-gray-700 rounded-lg mb-4" />
                    <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-full" />
                  </div>
                ))}
              </div>
            ) : projects.showcase.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.showcase.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-12 text-center">
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  {isOwnProfile ? 'No showcase projects yet' : 'No showcase projects to display'}
                </p>
                {isAuthenticated && isOwnProfile && (
                  <button
                    onClick={async () => {
                      try {
                        const newProject = await createProject({
                          title: 'Untitled Project',
                          description: '',
                          type: 'other',
                          isShowcase: true,
                          content: { blocks: [] },
                        });
                        navigate(`/${user?.username}/${newProject.slug}/edit`);
                      } catch (error) {
                        console.error('Failed to create project:', error);
                        alert('Failed to create project');
                      }
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
                  >
                    <PlusIcon className="w-5 h-5" />
                    Add Your First Project
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'playground' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Playground
                {!isLoading && (
                  <span className="ml-3 text-sm font-normal text-gray-500 dark:text-gray-400">
                    {projects.playground.length} {projects.playground.length === 1 ? 'project' : 'projects'}
                  </span>
                )}
              </h2>
            </div>
            
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="glass-subtle rounded-xl p-4 animate-pulse">
                    <div className="aspect-video bg-gray-300 dark:bg-gray-700 rounded-lg mb-4" />
                    <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-full" />
                  </div>
                ))}
              </div>
            ) : projects.playground.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {projects.playground.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-12 text-center">
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  {isOwnProfile ? 'No projects yet' : 'No projects to display'}
                </p>
                {isAuthenticated && isOwnProfile && (
                  <button
                    onClick={async () => {
                      try {
                        const newProject = await createProject({
                          title: 'Untitled Project',
                          description: '',
                          type: 'other',
                          isShowcase: false,
                          content: { blocks: [] },
                        });
                        navigate(`/${user?.username}/${newProject.slug}/edit`);
                      } catch (error) {
                        console.error('Failed to create project:', error);
                        alert('Failed to create project');
                      }
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
                  >
                    <PlusIcon className="w-5 h-5" />
                    Create Your First Project
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Activity
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                View your account activity, login history, and statistics
              </p>
            </div>
            <ActivityFeed />
          </div>
        )}
      </div>

      {/* Add Project Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="glass-strong rounded-xl p-6 max-w-lg w-full">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Create a new Project
            </h3>

            {formError && (
              <div className="mb-4 px-3 py-2 rounded-md bg-red-500/10 text-red-600 dark:text-red-400">
                {formError}
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!form.title.trim()) {
                  setFormError('Title is required');
                  return;
                }
                if (!user?.username) {
                  setFormError('You must be logged in to create a project');
                  return;
                }
                setFormError(null);
                setIsSaving(true);
                try {
                  await createProject({
                    title: form.title.trim(),
                    description: form.description.trim() || undefined,
                    type: form.type,
                    isShowcase: form.isShowcase,
                    thumbnailUrl: form.thumbnailUrl.trim() || undefined,
                  });
                  // Refresh lists
                  const data = await getUserProjects(user.username);
                  setProjects(data);
                  // Switch tab based on showcase flag
                  onTabChange(form.isShowcase ? 'showcase' : 'playground');
                  // Reset and close
                  setForm({ title: '', description: '', type: 'other', isShowcase: true, thumbnailUrl: '' });
                  setShowAddModal(false);
                } catch (err: any) {
                  setFormError(err?.error || 'Failed to create project');
                } finally {
                  setIsSaving(false);
                }
              }}
              className="space-y-4"
            >
              {/* Title */}
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. My Midjourney Showcase"
                  className="w-full rounded-lg border border-white/20 bg-white/60 dark:bg-white/5 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Briefly describe this project"
                  rows={3}
                  className="w-full rounded-lg border border-white/20 bg-white/60 dark:bg-white/5 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Row: Type and Showcase */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as ProjectType }))}
                    className="w-full rounded-lg border border-white/20 bg-white/60 dark:bg-white/5 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="github_repo">GitHub Repository</option>
                    <option value="image_collection">Image Collection</option>
                    <option value="prompt">Prompt</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="flex items-center gap-3 mt-6 md:mt-0">
                  <input
                    id="isShowcase"
                    type="checkbox"
                    checked={form.isShowcase}
                    onChange={(e) => setForm((prev) => ({ ...prev, isShowcase: e.target.checked }))}
                    className="h-4 w-4"
                  />
                  <label htmlFor="isShowcase" className="text-sm text-gray-700 dark:text-gray-300">Add to showcase</label>
                </div>
              </div>

              {/* Thumbnail URL */}
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Thumbnail URL (optional)</label>
                <input
                  type="url"
                  value={form.thumbnailUrl}
                  onChange={(e) => setForm((prev) => ({ ...prev, thumbnailUrl: e.target.value }))}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-white/20 bg-white/60 dark:bg-white/5 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-white/70 dark:bg-white/10 hover:bg-white/90 dark:hover:bg-white/20 text-gray-700 dark:text-gray-300"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
                >
                  {isSaving && <span className="w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />}
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
