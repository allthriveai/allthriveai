import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User, Project, ProjectType } from '@/types/models';
import { getUserProjects, createProject, bulkDeleteProjects } from '@/services/projects';
import { getUserByUsername } from '@/services/auth';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { ActivityFeed } from './ActivityFeed';
import { PlusIcon, TrashIcon, CheckIcon } from '@heroicons/react/24/outline';

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
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<number>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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
  // Helper functions for selection
  const toggleSelection = (projectId: number) => {
    const newSelected = new Set(selectedProjectIds);
    if (newSelected.has(projectId)) {
      newSelected.delete(projectId);
    } else {
      newSelected.add(projectId);
    }
    setSelectedProjectIds(newSelected);
  };

  const toggleSelectAll = () => {
    const currentProjects = activeTab === 'showcase' ? projects.showcase : projects.playground;
    if (selectedProjectIds.size === currentProjects.length) {
      setSelectedProjectIds(new Set());
    } else {
      setSelectedProjectIds(new Set(currentProjects.map(p => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProjectIds.size === 0) return;

    setIsDeleting(true);
    try {
      await bulkDeleteProjects(Array.from(selectedProjectIds));
      // Refresh projects
      if (user?.username) {
        const data = await getUserProjects(user.username);
        setProjects(data);
      }
      setSelectedProjectIds(new Set());
      setSelectionMode(false);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Failed to delete projects:', error);
      alert('Failed to delete projects');
    } finally {
      setIsDeleting(false);
    }
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedProjectIds(new Set());
  };

  // Show tabs based on authentication and privacy settings
  // Show Playground if: viewing own profile OR profile owner has made it public (default true)
  const showPlayground = isOwnProfile || (displayUser?.playgroundIsPublic !== false);
  const tabs = isAuthenticated && isOwnProfile
    ? [
        { id: 'showcase', label: 'Showcase' },
        { id: 'playground', label: 'Playground' },
        { id: 'activity', label: 'Activity' },
      ] as const
    : showPlayground
    ? [
        { id: 'showcase', label: 'Showcase' },
        { id: 'playground', label: 'Playground' },
      ] as const
    : [{ id: 'showcase', label: 'Showcase' }] as const;

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 overflow-y-auto">
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
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-8 bg-white dark:bg-gray-900">
        {/* Tabs */}
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                onTabChange(tab.id);
                // Exit selection mode when changing tabs
                if (selectionMode) {
                  exitSelectionMode();
                }
              }}
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

        {/* Action Buttons - only show for authenticated users on their own profile */}
        {isAuthenticated && isOwnProfile && (activeTab === 'showcase' || activeTab === 'playground') && (
          <div className="flex items-center gap-2">
            {selectionMode ? (
              // Selection mode controls
              <>
                <button
                  onClick={exitSelectionMode}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300 transition-colors"
                >
                  Cancel
                </button>
                {selectedProjectIds.size > 0 && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors shadow-sm"
                  >
                    <TrashIcon className="w-5 h-5" />
                    Delete ({selectedProjectIds.size})
                  </button>
                )}
              </>
            ) : (
              // Normal mode controls
              <>
                {((activeTab === 'showcase' && projects.showcase.length > 0) ||
                  (activeTab === 'playground' && projects.playground.length > 0)) && (
                  <button
                    onClick={() => setSelectionMode(true)}
                    className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg transition-colors"
                  >
                    <CheckIcon className="w-5 h-5" />
                    Select
                  </button>
                )}
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
              </>
            )}
          </div>
        )}
      </div>

      {/* Tab Content */}
      <div className="flex-1 p-8 bg-gray-50 dark:bg-gray-950">
        {activeTab === 'showcase' && (
          <div>
            {/* Profile About Section */}
            <div className="mb-8 bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">About</h2>
              {displayUser?.bio ? (
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap mb-6">
                  {displayUser.bio}
                </p>
              ) : isOwnProfile ? (
                <p className="text-gray-500 dark:text-gray-400 italic mb-6">
                  Add a bio to tell others about yourself.
                </p>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 italic mb-6">
                  No bio available.
                </p>
              )}

              {/* Social Links */}
              {(displayUser?.linkedinUrl || displayUser?.twitterUrl || displayUser?.githubUrl || displayUser?.youtubeUrl || displayUser?.instagramUrl || displayUser?.websiteUrl || displayUser?.calendarUrl) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Connect</h3>
                  <div className="flex flex-wrap gap-3">
                    {displayUser.websiteUrl && (
                      <a
                        href={displayUser.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                        Website
                      </a>
                    )}
                    {displayUser.linkedinUrl && (
                      <a
                        href={displayUser.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                        </svg>
                        LinkedIn
                      </a>
                    )}
                    {displayUser.twitterUrl && (
                      <a
                        href={displayUser.twitterUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-black hover:bg-gray-800 text-white rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        Twitter
                      </a>
                    )}
                    {displayUser.githubUrl && (
                      <a
                        href={displayUser.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                        </svg>
                        GitHub
                      </a>
                    )}
                    {displayUser.youtubeUrl && (
                      <a
                        href={displayUser.youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                        </svg>
                        YouTube
                      </a>
                    )}
                    {displayUser.instagramUrl && (
                      <a
                        href={displayUser.instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 hover:from-purple-700 hover:via-pink-700 hover:to-orange-600 text-white rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/>
                        </svg>
                        Instagram
                      </a>
                    )}
                    {displayUser.calendarUrl && (
                      <a
                        href={displayUser.calendarUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Book a Meeting
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Featured Projects */}
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Featured Projects
                {!isLoading && (
                  <span className="ml-3 text-sm font-normal text-gray-500 dark:text-gray-400">
                    {projects.showcase.length} {projects.showcase.length === 1 ? 'project' : 'projects'}
                  </span>
                )}
              </h2>
              {selectionMode && projects.showcase.length > 0 && (
                <button
                  onClick={toggleSelectAll}
                  className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                >
                  {selectedProjectIds.size === projects.showcase.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
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
                  <ProjectCard
                    key={project.id}
                    project={project}
                    selectionMode={selectionMode}
                    isSelected={selectedProjectIds.has(project.id)}
                    onSelect={toggleSelection}
                    isOwner={isOwnProfile}
                  />
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
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Playground
                {!isLoading && (
                  <span className="ml-3 text-sm font-normal text-gray-500 dark:text-gray-400">
                    {projects.playground.length} {projects.playground.length === 1 ? 'project' : 'projects'}
                  </span>
                )}
              </h2>
              {selectionMode && projects.playground.length > 0 && (
                <button
                  onClick={toggleSelectAll}
                  className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                >
                  {selectedProjectIds.size === projects.playground.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
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
                  <ProjectCard
                    key={project.id}
                    project={project}
                    selectionMode={selectionMode}
                    isSelected={selectedProjectIds.has(project.id)}
                    onSelect={toggleSelection}
                    isOwner={isOwnProfile}
                  />
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="glass-strong rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Delete Projects
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Are you sure you want to delete {selectedProjectIds.size} {selectedProjectIds.size === 1 ? 'project' : 'projects'}? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg bg-white/70 dark:bg-white/10 hover:bg-white/90 dark:hover:bg-white/20 text-gray-700 dark:text-gray-300"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                {isDeleting && <span className="w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

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
