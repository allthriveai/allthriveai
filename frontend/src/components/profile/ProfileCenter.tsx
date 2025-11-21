import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import type { User, Project, ProjectType } from '@/types/models';
import { getUserProjects, createProject, bulkDeleteProjects, updateProject, deleteProject } from '@/services/projects';
import { getUserByUsername } from '@/services/auth';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { ProfileSidebar } from './ProfileSidebar';
import { ActivityFeed } from './ActivityFeed';
import { PlusIcon, TrashIcon, CheckIcon, BoltIcon } from '@heroicons/react/24/outline';
import { API_ENDPOINTS } from '@/config/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faRocket,
  faStar,
  faTrophy,
  faHeart,
  faFire,
  faLock,
} from '@fortawesome/free-solid-svg-icons';

interface ProfileCenterProps {
  username?: string; // Username from URL params
  user: User | null; // Currently logged-in user (if any)
  isAuthenticated: boolean;
  isOwnProfile: boolean;
  activeTab: 'showcase' | 'playground' | 'activity' | 'achievements';
  onTabChange: (tab: 'showcase' | 'playground' | 'activity' | 'achievements') => void;
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
  const [showBattleModal, setShowBattleModal] = useState(false);
  const [battleType, setBattleType] = useState('text_prompt');
  const [battleDuration, setBattleDuration] = useState(10);
  const [battleMessage, setBattleMessage] = useState('');
  const [battleError, setBattleError] = useState('');
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
    isShowcase: false,
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

  // Smooth scroll to playground when tab changes to playground
  useEffect(() => {
    if (activeTab === 'playground') {
      const playgroundSection = document.getElementById('playground-section');
      if (playgroundSection) {
        playgroundSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [activeTab]);
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

  const handleDeleteProject = async (projectId: number) => {
    if (!window.confirm('Are you sure you want to delete this project?')) {
      return;
    }

    try {
      await deleteProject(projectId);
      // Refresh projects
      if (user?.username) {
        const data = await getUserProjects(user.username);
        setProjects(data);
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
      alert('Failed to delete project');
    }
  };

  const handleToggleShowcase = async (projectId: number) => {
    try {
      const currentProject = [...projects.showcase, ...projects.playground].find(p => p.id === projectId);
      if (!currentProject) return;

      await updateProject(projectId, {
        isShowcase: !currentProject.isShowcase,
      });

      // Refresh projects
      if (user?.username) {
        const data = await getUserProjects(user.username);
        setProjects(data);
      }
    } catch (error) {
      console.error('Failed to update showcase setting:', error);
      alert('Failed to update showcase setting');
    }
  };

  // Show tabs based on authentication and privacy settings
  // Show Playground if: viewing own profile OR profile owner has made it public (default true)
  const showPlayground = isOwnProfile || (displayUser?.playgroundIsPublic !== false);
  const tabs = isAuthenticated && isOwnProfile
    ? [
        { id: 'showcase', label: 'Showcase' },
        { id: 'playground', label: 'Playground' },
        { id: 'achievements', label: 'Achievements' },
        { id: 'activity', label: 'Activity' },
      ] as const
    : showPlayground
    ? [
        { id: 'showcase', label: 'Showcase' },
        { id: 'playground', label: 'Playground' },
        { id: 'achievements', label: 'Achievements' },
      ] as const
    : [
        { id: 'showcase', label: 'Showcase' },
        { id: 'achievements', label: 'Achievements' },
      ] as const;

  return (
    <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
      {/* Profile Header with Banner */}
      <div className="relative">
        {/* Banner Image */}
        <div className="h-32 w-full bg-gradient-to-br from-primary-500 via-primary-600 to-secondary-600 relative overflow-hidden">
          {/* Decorative pattern overlay */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
              backgroundSize: '32px 32px'
            }} />
          </div>

          {/* Add Project Button - Top Right */}
          {isAuthenticated && isOwnProfile && (
            <div className="absolute top-4 right-4 z-10">
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
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors shadow-lg font-medium"
              >
                <PlusIcon className="w-5 h-5" />
                Add Project
              </button>
            </div>
          )}
        </div>

        {/* Two-column layout: Profile Left + Hero Project Right */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative -mt-12 pb-8 grid grid-cols-1 lg:grid-cols-7 gap-8 items-center">
            {/* Left Column - Profile Info */}
            <div className="lg:col-span-3">
              {/* Profile Photo - Raised higher */}
              <div className="mb-6 -mt-12">
                <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-4xl font-bold overflow-hidden border-4 border-white dark:border-gray-900 shadow-2xl">
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

              {/* Name and Username */}
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                {displayUser?.firstName || username} {displayUser?.lastName || ''}
                {displayUser?.pronouns && (
                  <span className="text-xl font-normal text-gray-500 dark:text-gray-400 ml-2">
                    ({displayUser.pronouns})
                  </span>
                )}
              </h1>

              {/* Tagline */}
              {displayUser?.tagline && (
                <p className="text-lg text-gray-700 dark:text-gray-300 font-medium mb-4">
                  {displayUser.tagline}
                </p>
              )}

              {/* Bio */}
              {displayUser?.bio && (
                <div
                  className="text-base text-gray-600 dark:text-gray-400 mb-6 leading-relaxed prose dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: displayUser.bio }}
                />
              )}

              {/* Challenge to Battle Button - Only for Pip (Bot) */}
              {displayUser?.role === 'bot' && (
                <div className="mb-6">
                  <button
                    onClick={() => setShowBattleModal(true)}
                    className="btn-primary flex items-center gap-2"
                  >
                    <BoltIcon className="w-5 h-5" />
                    Challenge to Prompt Battle
                  </button>
                </div>
              )}

              {/* Location and Role */}
              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-6">
                {displayUser?.location && (
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {displayUser.location}
                  </div>
                )}
                {displayUser?.roleDisplay && (
                  <span className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm font-medium">
                    {displayUser.roleDisplay}
                  </span>
                )}
              </div>

              {/* Social Links */}
              {(displayUser?.linkedinUrl || displayUser?.twitterUrl || displayUser?.githubUrl || displayUser?.websiteUrl) && (
                <div className="flex items-center gap-3 mb-6">
                  {displayUser.websiteUrl && (
                    <a
                      href={displayUser.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      title="Website"
                    >
                      <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                    </a>
                  )}
                  {displayUser.linkedinUrl && (
                    <a
                      href={displayUser.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-full hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                      title="LinkedIn"
                    >
                      <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                    </a>
                  )}
                  {displayUser.twitterUrl && (
                    <a
                      href={displayUser.twitterUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      title="Twitter"
                    >
                      <svg className="w-6 h-6 text-gray-900 dark:text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                    </a>
                  )}
                  {displayUser.githubUrl && (
                    <a
                      href={displayUser.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      title="GitHub"
                    >
                      <svg className="w-6 h-6 text-gray-900 dark:text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                      </svg>
                    </a>
                  )}
                </div>
              )}

              {/* Stats - Colored pill badges */}
              <div className="flex flex-wrap items-center gap-2 py-4 border-t border-gray-200 dark:border-gray-800">
                <div className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium">
                  <span className="font-bold">{projects.showcase.length + projects.playground.length}</span> Projects
                </div>
                <div className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium">
                  <span className="font-bold">1,250</span> Points
                </div>
                <div className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm font-medium">
                  Level <span className="font-bold">8</span>
                </div>
                <div className="px-3 py-1.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full text-sm font-medium">
                  <span className="font-bold">12 🔥</span> Day Streak
                </div>
              </div>

              {/* Achievements */}
              <div className="py-4 border-t border-gray-200 dark:border-gray-800">
                <button
                  onClick={() => {
                    onTabChange('achievements');
                    // Smooth scroll to the tabs section
                    setTimeout(() => {
                      const tabsElement = document.querySelector('.flex.justify-center.border-b');
                      if (tabsElement) {
                        tabsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }, 100);
                  }}
                  className="text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors mb-3 block"
                >
                  Achievements
                </button>
                <div className="flex flex-wrap gap-2">
                  {/* Example badges - replace with actual data */}
                  <div className="group relative" title="First Project" onClick={() => {
                    onTabChange('achievements');
                    setTimeout(() => {
                      const tabsElement = document.querySelector('.flex.justify-center.border-b');
                      if (tabsElement) {
                        tabsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }, 100);
                  }}>
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-sm hover:scale-110 transition-transform cursor-pointer">
                      <FontAwesomeIcon icon={faRocket} className="text-xl" />
                    </div>
                  </div>
                  <div className="group relative" title="10 Projects" onClick={() => {
                    onTabChange('achievements');
                    setTimeout(() => {
                      const tabsElement = document.querySelector('.flex.justify-center.border-b');
                      if (tabsElement) {
                        tabsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }, 100);
                  }}>
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white shadow-sm hover:scale-110 transition-transform cursor-pointer">
                      <FontAwesomeIcon icon={faStar} className="text-xl" />
                    </div>
                  </div>
                  <div className="group relative" title="Battle Champion" onClick={() => {
                    onTabChange('achievements');
                    setTimeout(() => {
                      const tabsElement = document.querySelector('.flex.justify-center.border-b');
                      if (tabsElement) {
                        tabsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }, 100);
                  }}>
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center text-white shadow-sm hover:scale-110 transition-transform cursor-pointer">
                      <FontAwesomeIcon icon={faTrophy} className="text-xl" />
                    </div>
                  </div>
                  <div className="group relative" title="Community Helper" onClick={() => {
                    onTabChange('achievements');
                    setTimeout(() => {
                      const tabsElement = document.querySelector('.flex.justify-center.border-b');
                      if (tabsElement) {
                        tabsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }, 100);
                  }}>
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white shadow-sm hover:scale-110 transition-transform cursor-pointer">
                      <FontAwesomeIcon icon={faHeart} className="text-xl" />
                    </div>
                  </div>
                  <div className="group relative" title="Week Streak" onClick={() => {
                    onTabChange('achievements');
                    setTimeout(() => {
                      const tabsElement = document.querySelector('.flex.justify-center.border-b');
                      if (tabsElement) {
                        tabsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }, 100);
                  }}>
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white shadow-sm hover:scale-110 transition-transform cursor-pointer">
                      <FontAwesomeIcon icon={faFire} className="text-xl" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Hero Featured Project */}
            {!isLoading && projects.showcase.length > 0 && (
              <div className="lg:col-span-4">
              <div className="relative group cursor-pointer" onClick={() => {
                const heroProject = projects.showcase[0];
                navigate(`/${heroProject.username}/${heroProject.slug}`);
              }}>
                {/* Featured Badge */}
                <div className="absolute top-4 left-4 z-10">
                  <span className="px-4 py-2 bg-yellow-500 text-white text-sm font-bold rounded-full shadow-lg flex items-center gap-2">
                    ⭐ Featured
                  </span>
                </div>

                {/* Project Thumbnail */}
                <div className="relative aspect-[16/9] rounded-2xl overflow-hidden bg-gradient-to-br from-primary-500/20 to-secondary-500/20">
              {projects.showcase[0].thumbnailUrl ? (
                <img
                  src={projects.showcase[0].thumbnailUrl}
                  alt={projects.showcase[0].title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-24 h-24 text-slate-400 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
                  {/* Dark overlay on hover */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                </div>

                {/* Project Info Overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-6">
                  <h2 className="text-2xl font-bold text-white mb-1">
                    {projects.showcase[0].title}
                  </h2>
                  {projects.showcase[0].description && (
                    <p className="text-sm text-white/90 line-clamp-2">
                      {projects.showcase[0].description}
                    </p>
                  )}
                </div>
              </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content Area - Single column, centered */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div>
          {/* Tabs - Centered */}
          <div className="flex justify-center border-b border-gray-200 dark:border-gray-800 mb-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  onTabChange(tab.id);
                  if (selectionMode) {
                    exitSelectionMode();
                  }
                }}
                className={`px-8 py-4 font-semibold transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Actions (Select Mode) */}
          {isAuthenticated && isOwnProfile && (activeTab === 'showcase' || activeTab === 'playground') && (
            <div className="flex items-center justify-end gap-2 mb-8">
                {selectionMode ? (
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
                  </>
                )}
            </div>
          )}

          {/* Tab Content */}
          {activeTab === 'showcase' && (
            <div>
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
                        onDelete={handleDeleteProject}
                        onToggleShowcase={handleToggleShowcase}
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
                        Add Your First Project
                      </button>
                    )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'playground' && (
            <div id="playground-section">
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
                  <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div
                        key={i}
                        className="break-inside-avoid mb-6 rounded-2xl overflow-hidden bg-gray-200 dark:bg-gray-800 animate-pulse"
                        style={{ height: `${300 + (i % 3) * 120}px` }}
                      />
                    ))}
                  </div>
                ) : projects.playground.length > 0 ? (
                  <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
                    {projects.playground.map((project) => (
                      <div key={project.id} className="break-inside-avoid mb-6">
                        <ProjectCard
                          project={project}
                          selectionMode={selectionMode}
                          isSelected={selectedProjectIds.has(project.id)}
                          onSelect={toggleSelection}
                          isOwner={isOwnProfile}
                          variant="masonry"
                          onDelete={handleDeleteProject}
                          onToggleShowcase={handleToggleShowcase}
                        />
                      </div>
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

          {activeTab === 'achievements' && (
            <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Achievements
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Track your progress and unlock new badges
                  </p>
                </div>

                {/* Achievement Categories */}
                <div className="space-y-8">
                  {/* Project Achievements */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <FontAwesomeIcon icon={faRocket} className="text-2xl text-blue-600 dark:text-blue-400" /> Project Milestones
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* First Project */}
                      <div className="glass-subtle rounded-xl p-6 border-2 border-blue-500/30">
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-lg flex-shrink-0">
                            <FontAwesomeIcon icon={faRocket} className="text-3xl" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-gray-900 dark:text-white mb-1">First Project</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Created your first project</p>
                            <div className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              Earned
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 10 Projects */}
                      <div className="glass-subtle rounded-xl p-6 border-2 border-purple-500/30">
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white shadow-lg flex-shrink-0">
                            <FontAwesomeIcon icon={faStar} className="text-3xl" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-gray-900 dark:text-white mb-1">10 Projects</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Built 10 amazing projects</p>
                            <div className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-xs font-medium">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              Earned
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 50 Projects (Locked) */}
                      <div className="glass-subtle rounded-xl p-6 opacity-60">
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 rounded-lg bg-gray-400 dark:bg-gray-600 flex items-center justify-center text-white shadow-lg flex-shrink-0">
                            <FontAwesomeIcon icon={faLock} className="text-3xl" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-gray-900 dark:text-white mb-1">50 Projects</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Create 50 projects</p>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Progress: 12/50</div>
                            <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div className="bg-gradient-to-r from-primary-500 to-primary-600 h-2 rounded-full" style={{ width: '24%' }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Battle Achievements */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <FontAwesomeIcon icon={faTrophy} className="text-2xl text-yellow-600 dark:text-yellow-400" /> Battle Champion
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* Battle Champion */}
                      <div className="glass-subtle rounded-xl p-6 border-2 border-yellow-500/30">
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center text-white shadow-lg flex-shrink-0">
                            <FontAwesomeIcon icon={faTrophy} className="text-3xl" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-gray-900 dark:text-white mb-1">Battle Champion</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Won 5 prompt battles</p>
                            <div className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded text-xs font-medium">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              Earned
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Engagement Achievements */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <FontAwesomeIcon icon={faHeart} className="text-2xl text-green-600 dark:text-green-400" /> Community
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* Community Helper */}
                      <div className="glass-subtle rounded-xl p-6 border-2 border-green-500/30">
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white shadow-lg flex-shrink-0">
                            <FontAwesomeIcon icon={faHeart} className="text-3xl" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-gray-900 dark:text-white mb-1">Community Helper</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Helped others in the community</p>
                            <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs font-medium">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              Earned
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Week Streak */}
                      <div className="glass-subtle rounded-xl p-6 border-2 border-orange-500/30">
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white shadow-lg flex-shrink-0">
                            <FontAwesomeIcon icon={faFire} className="text-3xl" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-gray-900 dark:text-white mb-1">Week Streak</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Active for 7 days straight</p>
                            <div className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded text-xs font-medium">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              Earned
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
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

      {/* Battle Invitation Modal */}
      {showBattleModal && displayUser && (
        <>
          <div className="backdrop" onClick={() => { setShowBattleModal(false); setBattleError(''); }} />
          <div className="modal max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Challenge {displayUser.firstName || displayUser.username}
            </h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setBattleError('');

              // Check if user is authenticated
              if (!isAuthenticated || !user) {
                setBattleError('You must be logged in to send a challenge.');
                return;
              }

              try {
                console.log('API Endpoint URL:', API_ENDPOINTS.battleInvitations.create);
                console.log('Sending battle invitation:', {
                  opponent_username: displayUser.username,
                  battle_type: battleType,
                  duration_minutes: battleDuration,
                  message: battleMessage,
                });

                // Get CSRF token from cookie
                const getCookie = (name: string): string | null => {
                  const cookies = document.cookie ? document.cookie.split('; ') : [];
                  for (const cookie of cookies) {
                    if (cookie.startsWith(name + '=')) {
                      return decodeURIComponent(cookie.substring(name.length + 1));
                    }
                  }
                  return null;
                };

                const csrfToken = getCookie('csrftoken');
                const headers: Record<string, string> = {
                  'Content-Type': 'application/json',
                };
                if (csrfToken) {
                  headers['X-CSRFToken'] = csrfToken;
                }

                const response = await fetch(API_ENDPOINTS.battleInvitations.create, {
                  method: 'POST',
                  headers,
                  credentials: 'include',
                  body: JSON.stringify({
                    opponent_username: displayUser.username,
                    battle_type: battleType,
                    duration_minutes: battleDuration,
                    message: battleMessage,
                  }),
                });

                console.log('Response status:', response.status, response.statusText);
                console.log('Response headers:', Object.fromEntries(response.headers.entries()));
                console.log('Response URL:', response.url);

                if (response.ok) {
                  const data = await response.json();
                  console.log('Invitation response data:', data);

                  setShowBattleModal(false);
                  setBattleMessage('');

                  // Check if battle was auto-accepted (for bots)
                  // Handle both snake_case (battle_data) and camelCase (battleData)
                  const battleData = data.battle_data || data.battleData;
                  console.log('Battle data:', battleData);
                  console.log('Battle status:', battleData?.status);
                  console.log('Battle ID:', battleData?.id);

                  if (battleData && battleData.status === 'active') {
                    // Battle started immediately - navigate to battle page
                    console.log('Navigating to battle:', `/play/prompt-battle/${battleData.id}`);
                    navigate(`/play/prompt-battle/${battleData.id}`);
                  } else {
                    // Invitation pending - show success message
                    alert('Battle invitation sent successfully!');
                  }
                } else {
                  // Try to parse error response
                  let errorMessage = `Failed to send invitation (${response.status})`;
                  try {
                    const text = await response.text();
                    console.log('Response text:', text.substring(0, 500)); // Log first 500 chars
                    if (text) {
                      try {
                        const data = JSON.parse(text);
                        errorMessage = data.error || data.detail || errorMessage;
                      } catch {
                        // If it's HTML, try to extract the error message
                        const match = text.match(/<h1>(.*?)<\/h1>/);
                        if (match) {
                          errorMessage = match[1];
                        }
                      }
                    }
                  } catch (parseError) {
                    console.error('Error parsing response:', parseError);
                  }
                  setBattleError(errorMessage);
                }
              } catch (err) {
                console.error('Battle invitation error:', err);
                setBattleError(`Network error: ${err instanceof Error ? err.message : 'Unable to connect to server'}`);
              }
            }}>
              <div className="mb-4">
                <label className="label">
                  Battle Type
                </label>
                <select
                  value={battleType}
                  onChange={(e) => setBattleType(e.target.value)}
                  className="input"
                >
                  <option value="text_prompt">Text Prompt</option>
                  <option value="image_prompt">Image Prompt</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="label">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  value={battleDuration}
                  onChange={(e) => setBattleDuration(parseInt(e.target.value))}
                  min="1"
                  max="60"
                  className="input"
                />
              </div>
              <div className="mb-4">
                <label className="label">
                  Message (optional)
                </label>
                <textarea
                  value={battleMessage}
                  onChange={(e) => setBattleMessage(e.target.value)}
                  className="textarea"
                  rows={3}
                  placeholder="Add a personal message..."
                />
              </div>
              {battleError && (
                <div className="mb-6 p-4 glass-subtle border border-error-200 dark:border-error-800 bg-error-50 dark:bg-error-900/20 rounded-lg">
                  <p className="text-error-600 dark:text-error-400">{battleError}</p>
                </div>
              )}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowBattleModal(false);
                    setBattleError('');
                  }}
                  className="btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  Send Challenge
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
