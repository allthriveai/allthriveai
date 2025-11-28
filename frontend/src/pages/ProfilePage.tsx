import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useThriveCircle } from '@/hooks/useThriveCircle';
import type { User, Project } from '@/types/models';
import { getUserByUsername } from '@/services/auth';
import { getUserProjects, bulkDeleteProjects } from '@/services/projects';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { useAchievements } from '@/hooks/useAchievements';
import { ActivityFeed } from '@/components/profile/ActivityFeed';
import { getRarityColorClasses } from '@/services/achievements';
import { ToolTray } from '@/components/tools/ToolTray';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGithub,
  faLinkedin,
  faTwitter,
  faYoutube,
  faInstagram,
} from '@fortawesome/free-brands-svg-icons';
import {
  faGlobe,
  faCalendar,
  faSpinner,
  faUserPlus,
  faEnvelope,
  faTrophy,
  faTh,
  faList,
  faStar,
  faArrowLeft,
  faArrowRight,
  faMapMarkerAlt,
  faFlask,
  faChartLine,
} from '@fortawesome/free-solid-svg-icons';

// Helper to convert tier code to display name
function getTierDisplay(tier?: string): string {
  const tierMap: Record<string, string> = {
    seedling: 'Seedling',
    sprout: 'Sprout',
    blossom: 'Blossom',
    bloom: 'Bloom',
    evergreen: 'Evergreen',
  };
  return tierMap[tier || ''] || 'Seedling';
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user, isAuthenticated } = useAuth();
  const { tierStatus, isLoading: isTierLoading } = useThriveCircle();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<{ showcase: Project[]; playground: Project[] }>({
    showcase: [],
    playground: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [userNotFound, setUserNotFound] = useState(false);

  // Initialize activeTab from URL or default to 'showcase'
  const tabFromUrl = searchParams.get('tab') as 'showcase' | 'playground' | 'activity' | null;
  const [activeTab, setActiveTab] = useState<'showcase' | 'playground' | 'activity'>(
    tabFromUrl && ['showcase', 'playground', 'activity'].includes(tabFromUrl) ? tabFromUrl : 'showcase'
  );
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<number>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBattleModal, setShowBattleModal] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toolTrayOpen, setToolTrayOpen] = useState(false);
  const [selectedToolSlug, setSelectedToolSlug] = useState<string>('');

  const { achievementsByCategory, isLoading: isAchievementsLoading } = useAchievements();

  const isOwnProfile = username === user?.username;
  const displayUser = isOwnProfile ? user : profileUser;

  // Sync activeTab with URL query parameter
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') as 'showcase' | 'playground' | 'activity' | null;
    if (tabFromUrl && ['showcase', 'playground', 'activity'].includes(tabFromUrl)) {
      // Security: only allow Activity tab for own profile
      if (tabFromUrl === 'activity' && !isOwnProfile) {
        setActiveTab('showcase');
        setSearchParams({ tab: 'showcase' });
        return;
      }
      setActiveTab(tabFromUrl);
    }
  }, [searchParams, isOwnProfile, setSearchParams]);

  // Track scroll position to fix sidebar after banner
  useEffect(() => {
    const scrollContainer = document.querySelector('.flex-1.overflow-y-auto');
    if (!scrollContainer) return;

    const handleScroll = () => {
      // Banner height is 256px (h-64 = 16rem = 256px)
      const bannerHeight = 256;
      setScrolled(scrollContainer.scrollTop > bannerHeight);
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

  // Update URL when tab changes
  const handleTabChange = (tab: 'showcase' | 'playground' | 'activity') => {
    setActiveTab(tab);
    setSearchParams({ tab });
    if (selectionMode) {
      exitSelectionMode();
    }
  };

  // Fetch profile user data
  useEffect(() => {
    setUserNotFound(false);
    if (isOwnProfile) {
      setProfileUser(user);
      return;
    }
    if (username) {
      getUserByUsername(username)
        .then((userData) => {
          setProfileUser(userData);
          setUserNotFound(false);
        })
        .catch((error) => {
          console.error('Failed to load user profile:', error);
          setProfileUser(null);
          if (error?.statusCode === 404) setUserNotFound(true);
        });
    } else {
      setProfileUser(user);
    }
  }, [username, user, isOwnProfile]);

  // Fetch projects
  useEffect(() => {
    async function loadProjects() {
      if (!username && !user?.username) return;
      if (userNotFound) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const data = await getUserProjects(username || user?.username || '');
        setProjects(data);
      } catch (error) {
        console.error('Failed to load projects:', error);
        setProjects({ showcase: [], playground: [] });
      } finally {
        setIsLoading(false);
      }
    }
    loadProjects();
  }, [username, user?.username, userNotFound]);

  // Social links data
  const socialLinks = [
    { icon: faGlobe, url: displayUser?.websiteUrl, label: 'Website' },
    { icon: faLinkedin, url: displayUser?.linkedinUrl, label: 'LinkedIn' },
    { icon: faGithub, url: displayUser?.githubUrl, label: 'GitHub' },
    { icon: faTwitter, url: displayUser?.twitterUrl, label: 'Twitter' },
  ].filter(link => link.url);

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

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedProjectIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedProjectIds.size === 0) return;

    setIsDeleting(true);
    try {
      await bulkDeleteProjects(Array.from(selectedProjectIds));

      // Remove deleted projects from state
      setProjects(prev => ({
        showcase: prev.showcase.filter(p => !selectedProjectIds.has(p.id)),
        playground: prev.playground.filter(p => !selectedProjectIds.has(p.id)),
      }));

      // Exit selection mode and close modal
      exitSelectionMode();
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Failed to delete projects:', error);
      alert('Failed to delete projects. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Tabs logic
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
    : [
        { id: 'showcase', label: 'Showcase' },
      ] as const;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <FontAwesomeIcon icon={faSpinner} className="w-8 h-8 text-brand-primary animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (userNotFound) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-white">User Not Found</h1>
            <p className="text-gray-600 dark:text-gray-400">The profile you're looking for doesn't exist.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex h-full w-full relative bg-gray-50 dark:bg-[#0a0a0a]">

        {/* Scrollable main area containing banner and content */}
        <div className="flex-1 overflow-y-auto">
          {/* Large Hero Banner - Scrolls with page */}
          <div className="h-64 w-full relative group overflow-hidden bg-white dark:bg-[#0a0a0a]">
            <div className="absolute inset-0 bg-gradient-to-r from-teal-500/10 via-blue-500/10 to-purple-500/10 dark:from-teal-900/20 dark:via-blue-900/20 dark:to-purple-900/20" />
            <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
                 style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}
            />

            {/* Banner Content - Large photo and name */}
            <div className="absolute inset-0 flex items-end p-8 lg:p-12">
              <div className="flex items-end gap-8 w-full">
                {/* Large Avatar */}
                <div className="flex-shrink-0">
                  <div className="w-40 h-40 rounded ring-4 ring-white dark:ring-gray-800 shadow-xl overflow-hidden bg-gray-100 dark:bg-white/5">
                    <img
                      src={displayUser?.avatarUrl || `https://ui-avatars.com/api/?name=${displayUser?.fullName || 'User'}&background=random`}
                      className="w-full h-full object-cover"
                      alt="Profile"
                    />
                  </div>
                </div>

                {/* Name & Tagline */}
                <div className="pb-4 flex-1">
                  <h1 className="text-5xl font-bold mb-2 leading-tight">
                    <span className="bg-gradient-to-r from-teal-600 via-blue-600 to-purple-600 dark:from-teal-400 dark:via-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                      {displayUser?.fullName || displayUser?.username || 'Portfolio'}
                    </span>
                  </h1>
                  {displayUser?.tagline && (
                    <p className="text-gray-600 dark:text-gray-300 text-lg">
                      {displayUser.tagline}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Flex Container for Sidebar + Content */}
          <div className="flex gap-6 px-6 lg:px-10">

            {/* Spacer when sidebar is fixed (to prevent content shift) */}
            {scrolled && (
              <div
                className={`flex-shrink-0 ${sidebarOpen ? 'w-80' : 'w-20'}`}
                aria-hidden="true"
              />
            )}

            {/* Left Sidebar - Sticky/Fixed */}
            <aside
              className={`${
                scrolled ? 'fixed top-16 left-0' : 'sticky top-16'
              } self-start transition-all duration-300 ${
                sidebarOpen ? 'w-80' : 'w-20'
              } flex-shrink-0 z-40`}
              style={{ height: 'calc(100vh - 4rem)' }}
            >
              <div className="h-full bg-white dark:bg-gray-900/50 border-r border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col">
                {sidebarOpen ? (
                  /* Expanded Sidebar View */
                  <div className="flex flex-col h-full p-6 overflow-y-auto">
                    {/* Toggle Button */}
                    <button
                      onClick={() => setSidebarOpen(false)}
                      className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      <FontAwesomeIcon icon={faArrowLeft} className="w-4 h-4" />
                    </button>

                    {/* Avatar Section - Only show when banner is out of view */}
                    {scrolled && (
                      <div className="text-center mb-6 animate-fade-in">
                        <div className="w-24 h-24 rounded-full ring-4 ring-brand-primary/20 mx-auto mb-4 overflow-hidden bg-gray-100 dark:bg-white/5">
                          <img
                            src={displayUser?.avatarUrl || `https://ui-avatars.com/api/?name=${displayUser?.fullName || 'User'}&background=random`}
                            className="w-full h-full object-cover"
                            alt="Profile"
                          />
                        </div>
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1">
                          {displayUser?.fullName || displayUser?.username}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                          @{displayUser?.username}
                        </p>
                        {displayUser?.tagline && (
                          <p className="text-xs text-gray-600 dark:text-gray-300 italic">
                            {displayUser.tagline}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Stats Grid */}
                    <div className={`grid grid-cols-3 gap-2 ${scrolled ? 'border-y' : 'border-b'} border-gray-200 dark:border-white/10 py-4 mb-6`}>
                      <div className="text-center">
                        <div className="text-lg font-bold text-gray-900 dark:text-white">
                          {displayUser?.totalPoints || 0}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-gray-500">Points</div>
                      </div>
                      <div className="text-center border-l border-gray-200 dark:border-white/10">
                        <div className="text-lg font-bold text-gray-900 dark:text-white">
                          {projects.showcase.length + projects.playground.length}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-gray-500">Projects</div>
                      </div>
                      <div className="text-center border-l border-gray-200 dark:border-white/10">
                        <div className="text-lg font-bold text-gray-900 dark:text-white">
                          {isTierLoading ? '...' : (tierStatus?.tierDisplay || getTierDisplay(displayUser?.tier))}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-gray-500">Tier</div>
                      </div>
                    </div>

                    {/* Social Links */}
                    {socialLinks.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Connect</h4>
                        <div className="flex flex-wrap gap-2">
                          {socialLinks.map((link, i) => (
                            <a
                              key={i}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 min-w-[calc(50%-4px)] h-10 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-brand-primary hover:text-white transition-colors"
                              title={link.label}
                            >
                              <FontAwesomeIcon icon={link.icon} className="w-4 h-4" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Bio */}
                    {displayUser?.bio && (
                      <div className="mb-6">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">About</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                          {displayUser.bio}
                        </p>
                      </div>
                    )}

                    {/* Achievements */}
                    <div className="mb-6">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Achievements</h4>
                      {achievementsByCategory && !isAchievementsLoading ? (() => {
                        const earnedAchievements = Object.values(achievementsByCategory)
                          .flat()
                          .filter(a => a.is_earned)
                          .slice(0, 6);

                        if (earnedAchievements.length === 0) {
                          return <p className="text-sm text-gray-400 italic">No badges yet</p>;
                        }

                        return (
                          <div className="grid grid-cols-3 gap-2">
                            {earnedAchievements.map((achievement) => {
                              const rarityColors = getRarityColorClasses(achievement.rarity);
                              return (
                                <div
                                  key={achievement.id}
                                  className={`aspect-square rounded-lg bg-gradient-to-br ${rarityColors.from} ${rarityColors.to} flex items-center justify-center text-white shadow-sm cursor-help group relative`}
                                  title={achievement.name}
                                >
                                  <FontAwesomeIcon icon={faTrophy} className="text-sm" />
                                </div>
                              );
                            })}
                          </div>
                        );
                      })() : (
                        <div className="flex gap-2">
                          {[1,2,3].map(i => <div key={i} className="w-full h-16 rounded-lg bg-gray-100 dark:bg-white/5 animate-pulse" />)}
                        </div>
                      )}
                    </div>

                    {/* Tools */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Tools</h4>
                      <div className="flex flex-wrap gap-2">
                        {(() => {
                          const allTools = [...projects.showcase, ...projects.playground]
                            .flatMap(p => p.toolsDetails || [])
                            .filter((tool, index, self) =>
                              index === self.findIndex(t => t.id === tool.id)
                            );

                          return allTools.length > 0 ? (
                            allTools.slice(0, 8).map((tool) => (
                              <button
                                key={tool.id}
                                onClick={() => {
                                  setSelectedToolSlug(tool.slug);
                                  setToolTrayOpen(true);
                                }}
                                className="px-2 py-1 text-xs bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-md border border-gray-200 dark:border-white/10 hover:bg-teal-50 dark:hover:bg-teal-900/20 hover:border-teal-500 hover:text-teal-700 dark:hover:text-teal-300 transition-colors cursor-pointer"
                              >
                                {tool.name}
                              </button>
                            ))
                          ) : (
                            <p className="text-sm text-gray-400 italic">No tools used yet</p>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Collapsed Sidebar View */
                  <div className="flex flex-col items-center h-full py-6 gap-6">
                    {/* Toggle Button */}
                    <button
                      onClick={() => setSidebarOpen(true)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      <FontAwesomeIcon icon={faArrowRight} className="w-4 h-4" />
                    </button>

                    {/* Profile Circle - Only show when banner is out of view */}
                    {scrolled && (
                      <button
                        onClick={() => setSidebarOpen(true)}
                        className="w-12 h-12 rounded-full ring-2 ring-brand-primary/30 overflow-hidden bg-gray-100 dark:bg-white/5 hover:ring-brand-primary transition-all animate-fade-in"
                      >
                        <img
                          src={displayUser?.avatarUrl || `https://ui-avatars.com/api/?name=${displayUser?.fullName || 'User'}&background=random`}
                          className="w-full h-full object-cover"
                          alt="Profile"
                        />
                      </button>
                    )}

                    {/* Social Links */}
                    {socialLinks.length > 0 && (
                      <div className="flex flex-col gap-3">
                        {socialLinks.slice(0, 4).map((link, i) => (
                          <a
                            key={i}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-brand-primary hover:text-white transition-colors"
                            title={link.label}
                          >
                            <FontAwesomeIcon icon={link.icon} className="w-3 h-3" />
                          </a>
                        ))}
                      </div>
                    )}

                    <div className="border-t border-gray-200 dark:border-gray-800 w-full" />

                    {/* Tab Icons - Always show all icons */}
                    <div className="flex flex-col gap-3">
                      {/* Showcase Icon - Always visible */}
                      <button
                        onClick={() => handleTabChange('showcase')}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                          activeTab === 'showcase'
                            ? 'bg-teal-500 text-white shadow-md'
                            : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
                        }`}
                        title="Showcase"
                      >
                        <FontAwesomeIcon icon={faTh} className="w-3 h-3" />
                      </button>

                      {/* Playground Icon - Always visible */}
                      <button
                        onClick={() => handleTabChange('playground')}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                          activeTab === 'playground'
                            ? 'bg-teal-500 text-white shadow-md'
                            : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
                        }`}
                        title="Playground"
                      >
                        <FontAwesomeIcon icon={faFlask} className="w-3 h-3" />
                      </button>

                      {/* Activity Icon - Always visible for profile owner */}
                      {isOwnProfile && (
                        <button
                          onClick={() => handleTabChange('activity')}
                          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                            activeTab === 'activity'
                              ? 'bg-teal-500 text-white shadow-md'
                              : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
                          }`}
                          title="Activity"
                        >
                          <FontAwesomeIcon icon={faChartLine} className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col pb-10 max-w-[1600px]">

              {/* Top Header: Tabs & Actions */}
              <div className="flex items-center justify-center border-b border-gray-200 dark:border-gray-800 mb-8 pt-2">
                <div className="flex items-baseline space-x-8">
                  {/* Tabs with Icons */}
                  {tabs.map((tab) => {
                    const tabIcons = {
                      showcase: faTh,
                      playground: faFlask,
                      activity: faChartLine,
                    };

                    return (
                      <button
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id as any)}
                        className={`flex items-center gap-2 py-4 px-1 text-sm font-medium border-b-2 transition-colors ${
                          activeTab === tab.id
                            ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                        }`}
                      >
                        <FontAwesomeIcon icon={tabIcons[tab.id as keyof typeof tabIcons]} className="w-3.5 h-3.5" />
                        {tab.label}
                      </button>
                    );
                  })}

                  {/* Select/Delete Buttons - Only for profile owner on Showcase/Playground tabs */}
                  {isOwnProfile &&
                   ((activeTab === 'showcase' && projects.showcase.length > 0) ||
                    (activeTab === 'playground' && projects.playground.length > 0)) && (
                    <div className="flex items-center gap-2 ml-4">
                      {selectionMode && selectedProjectIds.size > 0 && (
                        <button
                          onClick={() => setShowDeleteConfirm(true)}
                          className="flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors text-sm font-medium bg-red-500/10 border-red-500/50 text-red-600 dark:text-red-400 hover:bg-red-500/20"
                        >
                          Delete ({selectedProjectIds.size})
                        </button>
                      )}
                      <button
                        onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
                        className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors text-sm font-medium ${
                          selectionMode
                            ? 'bg-teal-500/10 border-teal-500/50 text-teal-600 dark:text-teal-400'
                            : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10'
                        }`}
                      >
                        <FontAwesomeIcon icon={faList} className="w-3 h-3" />
                        {selectionMode ? 'Cancel' : 'Select'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Masonry Grid Content - Only for Showcase and Playground */}
              {(activeTab === 'showcase' || activeTab === 'playground') && (
                <div className="columns-1 md:columns-2 lg:columns-3 gap-6 pb-20 space-y-6">
                  {/* Showcase Tab */}
                  {activeTab === 'showcase' && (
                    projects.showcase.length > 0 ? (
                      projects.showcase.map((project) => (
                        <div key={project.id} className="break-inside-avoid mb-6">
                          <ProjectCard
                            project={project}
                            onEdit={() => navigate(`/${username}/${project.slug}/edit`)}
                            onDelete={async () => {}}
                            isOwner={isOwnProfile}
                            variant="masonry"
                            selectionMode={selectionMode}
                            isSelected={selectedProjectIds.has(project.id)}
                            onSelect={toggleSelection}
                          />
                        </div>
                      ))
                    ) : (
                      <div className="py-20 text-center">
                        <div className="w-20 h-20 bg-gray-200 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                          <FontAwesomeIcon icon={faSpinner} className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No projects yet</h3>
                        <p className="text-gray-500 dark:text-gray-400">This portfolio is waiting for its first masterpiece.</p>
                      </div>
                    )
                  )}

                  {/* Playground Tab */}
                  {activeTab === 'playground' && (
                    projects.playground.length > 0 ? (
                      projects.playground.map((project) => (
                        <div key={project.id} className="break-inside-avoid mb-6">
                          <ProjectCard
                            project={project}
                            onEdit={() => navigate(`/${username}/${project.slug}/edit`)}
                            onDelete={async () => {}}
                            isOwner={isOwnProfile}
                            variant="masonry"
                            selectionMode={selectionMode}
                            isSelected={selectedProjectIds.has(project.id)}
                            onSelect={toggleSelection}
                          />
                        </div>
                      ))
                    ) : (
                      <div className="py-20 text-center">
                        <p className="text-gray-500 dark:text-gray-400">No playground projects yet.</p>
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Activity Tab - Full width layout */}
              {activeTab === 'activity' && isOwnProfile && (
                <div className="pb-20">
                  <ActivityFeed />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tool Tray */}
        <ToolTray
          isOpen={toolTrayOpen}
          onClose={() => setToolTrayOpen(false)}
          toolSlug={selectedToolSlug}
        />

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Delete {selectedProjectIds.size} project{selectedProjectIds.size > 1 ? 's' : ''}?
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                This action cannot be undone. The selected project{selectedProjectIds.size > 1 ? 's' : ''} will be permanently deleted.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isDeleting && <FontAwesomeIcon icon={faSpinner} className="w-4 h-4 animate-spin" />}
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
