import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useThriveCircle } from '@/hooks/useThriveCircle';
import type { User, Project } from '@/types/models';
import { getUserByUsername } from '@/services/auth';
import { getUserProjects } from '@/services/projects';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { useAchievements } from '@/hooks/useAchievements';
import { ActivityFeed } from '@/components/profile/ActivityFeed';
import { getRarityColorClasses } from '@/services/achievements';
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
  faMapMarkerAlt,
  faSpinner,
  faUserPlus,
  faEnvelope,
  faTrophy,
  faArrowRight,
  faArrowLeft,
  faTh,
  faList,
  faStar,
} from '@fortawesome/free-solid-svg-icons';

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
  const [profileTrayOpen, setProfileTrayOpen] = useState(true);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<number>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBattleModal, setShowBattleModal] = useState(false);

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
                  <div className="w-40 h-40 rounded-2xl ring-4 ring-white dark:ring-gray-800 shadow-xl overflow-hidden bg-gray-100 dark:bg-white/5">
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

          {/* Content with Sidebar */}
          <div className="flex">
            {/* Left Profile Sidebar - Initially scrolls, becomes sticky after banner */}
            <div
              className={`sticky top-0 h-screen bg-white dark:bg-[#111] border-r border-gray-200 dark:border-white/10 transition-all duration-300 ease-in-out flex flex-col z-20 shadow-lg overflow-hidden
                ${profileTrayOpen ? 'w-80 min-w-[320px]' : 'w-20 min-w-[80px]'}
              `}
            >
              {/* Tray Toggle Button */}
              <button
                onClick={() => setProfileTrayOpen(!profileTrayOpen)}
                className="absolute top-4 right-[-40px] z-30 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <FontAwesomeIcon icon={profileTrayOpen ? faArrowLeft : faArrowRight} className="w-5 h-5" />
              </button>

              {/* Expanded View */}
              {profileTrayOpen ? (
                <div className="flex flex-col h-full p-6 pt-6 animate-fade-in overflow-y-auto scrollbar-hide">

                  {/* Avatar */}
                  <div className="text-center mb-8">
                    <div className="relative inline-block mb-6">
                      <div className="w-32 h-32 rounded-full ring-4 ring-brand-primary/40 dark:ring-brand-primary/50 shadow-lg overflow-hidden bg-gray-100 dark:bg-white/5">
                        <img
                          src={displayUser?.avatarUrl || `https://ui-avatars.com/api/?name=${displayUser?.fullName || 'User'}&background=random`}
                          className="w-full h-full object-cover"
                          alt="Profile"
                        />
                      </div>
                    </div>

                    <h2 className="text-xl font-bold mb-2 text-center break-words">
                      <span className="bg-gradient-to-r from-teal-600 via-blue-600 to-purple-600 dark:from-teal-400 dark:via-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                        {displayUser?.fullName || displayUser?.username}
                      </span>
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                      @{displayUser?.username}
                    </p>
                    {displayUser?.tagline && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 italic">
                        {displayUser.tagline}
                      </p>
                    )}

                    <div className="flex items-center justify-center gap-2 text-xs text-gray-400 mb-8">
                      {displayUser?.location && (
                        <>
                          <FontAwesomeIcon icon={faMapMarkerAlt} className="w-3 h-3" />
                          <span>{displayUser.location}</span>
                        </>
                      )}
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 border-y border-gray-200 dark:border-white/10 py-4 mb-6">
                      <div className="text-center">
                        <div className="text-lg font-bold text-gray-900 dark:text-white">
                          {displayUser?.totalPoints || 0}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-gray-500">Points</div>
                      </div>
                      <div className="text-center border-l border-gray-200 dark:border-white/10">
                        <div className="text-lg font-bold text-gray-900 dark:text-white">
                          {projects.showcase.length}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-gray-500">Projects</div>
                      </div>
                      <div className="text-center border-l border-gray-200 dark:border-white/10">
                        <div className="text-lg font-bold text-gray-900 dark:text-white">
                          {isTierLoading ? '...' : (tierStatus?.tierDisplay || 'Ember')}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-gray-500">Tier</div>
                      </div>
                    </div>

                    {/* Social Links */}
                    {socialLinks.length > 0 && (
                      <div className="flex justify-center gap-3 mb-8">
                        {socialLinks.map((link, i) => (
                          <a
                            key={i}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-brand-primary hover:text-white transition-colors"
                            title={link.label}
                          >
                            <FontAwesomeIcon icon={link.icon} className="w-4 h-4" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* About */}
                  {displayUser?.bio && (
                    <div className="text-left mb-8">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">About</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                        {displayUser.bio}
                      </p>
                    </div>
                  )}

                  {/* Achievements */}
                  <div className="mb-8 text-left">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Achievements</h3>
                    {achievementsByCategory && !isAchievementsLoading ? (() => {
                      const earnedAchievements = Object.values(achievementsByCategory)
                        .flat()
                        .filter(a => a.is_earned)
                        .slice(0, 6);

                      if (earnedAchievements.length === 0) {
                        return <p className="text-sm text-gray-400 italic">No badges yet</p>;
                      }

                      return (
                        <div className="grid grid-cols-4 gap-2">
                          {earnedAchievements.map((achievement) => {
                            const rarityColors = getRarityColorClasses(achievement.rarity);
                            return (
                              <div
                                key={achievement.id}
                                className={`aspect-square rounded-lg bg-gradient-to-br ${rarityColors.from} ${rarityColors.to} flex items-center justify-center text-white shadow-sm cursor-help group relative`}
                              >
                                <FontAwesomeIcon icon={achievement.icon ? faStar : faTrophy} className="text-sm" />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 p-2 bg-black/90 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-center shadow-lg border border-white/10">
                                  {achievement.name}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })() : (
                      <div className="flex gap-2">
                        {[1,2,3,4].map(i => <div key={i} className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/5 animate-pulse" />)}
                      </div>
                    )}
                  </div>

                  {/* Tools */}
                  <div className="text-left">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Tools</h3>
                    <div className="flex flex-wrap gap-2">
                      {(() => {
                        const allTools = [...projects.showcase, ...projects.playground]
                          .flatMap(p => p.toolsDetails || [])
                          .filter((tool, index, self) =>
                            index === self.findIndex(t => t.id === tool.id)
                          );

                        return allTools.length > 0 ? (
                          allTools.slice(0, 10).map((tool) => (
                            <span
                              key={tool.id}
                              className="px-3 py-1 text-xs font-medium bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-full border border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors cursor-default"
                            >
                              {tool.name}
                            </span>
                          ))
                        ) : (
                          <p className="text-sm text-gray-400 italic">No tools used yet</p>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ) : (
                /* Collapsed View */
                <div className="flex flex-col items-center h-full py-6 pt-8 animate-fade-in gap-8">
                  {/* Tiny Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-brand-primary to-purple-600 p-[2px] cursor-pointer hover:ring-2 hover:ring-brand-primary transition-all" onClick={() => setProfileTrayOpen(true)}>
                    <img
                      src={displayUser?.avatarUrl || `https://ui-avatars.com/api/?name=${displayUser?.fullName || 'User'}&background=random`}
                      className="w-full h-full rounded-full object-cover"
                      alt="Profile"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Main Content Grid */}
            <div className="flex-1 flex flex-col px-6 lg:px-10 pb-10 max-w-[1600px] mx-auto">

              {/* Top Header: Tabs & Actions */}
              <div className="flex flex-col md:flex-row items-center justify-between border-b border-gray-200 dark:border-gray-800 mb-8 pt-2">

                {/* Centered Tabs */}
                <div className="flex-1 flex justify-center">
                  <div className="flex space-x-8">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id as any)}
                        className={`py-4 px-1 text-sm font-medium border-b-2 transition-colors ${
                          activeTab === tab.id
                            ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right Actions (Select Button) - Only for profile owner */}
                {isOwnProfile && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 hidden md:block">
                    {((activeTab === 'showcase' && projects.showcase.length > 0) || (activeTab === 'playground' && projects.playground.length > 0)) && (
                      <button
                        onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
                        className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors text-sm font-medium ${
                          selectionMode
                            ? 'bg-teal-500/10 border-teal-500/50 text-teal-600 dark:text-teal-400'
                            : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10'
                        }`}
                      >
                        <FontAwesomeIcon icon={faList} className="w-3 h-3" />
                        {selectionMode ? 'Cancel' : 'Select'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Grid Content */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 pb-20">
                {/* Showcase Tab */}
                {activeTab === 'showcase' && (
                  projects.showcase.length > 0 ? (
                    projects.showcase.map((project) => (
                      <div key={project.id} className="group">
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
                    <div className="col-span-full py-20 text-center">
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
                      <div key={project.id} className="group">
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
                    <div className="col-span-full py-20 text-center">
                      <p className="text-gray-500 dark:text-gray-400">No playground projects yet.</p>
                    </div>
                  )
                )}

                {/* Activity Tab - Only accessible to profile owner */}
                {activeTab === 'activity' && isOwnProfile && (
                  <div className="col-span-full">
                    <ActivityFeed />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
