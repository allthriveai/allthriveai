import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useThriveCircle } from '@/hooks/useThriveCircle';
import type { User, Project } from '@/types/models';
import { getUserByUsername } from '@/services/auth';
import { getUserProjects, bulkDeleteProjects } from '@/services/projects';
import { followService } from '@/services/followService';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { getUserAchievements } from '@/services/achievements';
import type { AchievementProgressData } from '@/types/achievements';
import { ActivityInsightsTab } from '@/components/profile/ActivityInsightsTab';
import { FavoritesTab } from '@/components/profile/FavoritesTab';
import { MarketplaceTab } from '@/components/profile/MarketplaceTab';
import { LearningPathsTab } from '@/components/learning';
import { ProfileAchievementGrid } from '@/components/achievements/ProfileAchievementMini';
import { BattlesTab } from '@/components/battles';
import { ToolTray } from '@/components/tools/ToolTray';
import { MasonryGrid } from '@/components/common/MasonryGrid';
import { FollowListModal } from '@/components/profile/FollowListModal';
import { logError, parseApiError } from '@/utils/errorHandler';
import NotFoundPage from '@/pages/NotFoundPage';
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
  faGraduationCap,
  faHeart,
  faStore,
  faBolt,
} from '@fortawesome/free-solid-svg-icons';

// Helper to convert tier code to display name
function getTierDisplay(tier?: string): string {
  const tierMap: Record<string, string> = {
    seedling: 'Seedling',
    sprout: 'Sprout',
    blossom: 'Blossom',
    bloom: 'Bloom',
    evergreen: 'Evergreen',
    curation: 'Curation',
  };
  return tierMap[tier || ''] || 'Seedling';
}

// Check if user is in curation tier (AI agents/bots - no points/achievements)
function isCurationTier(tier?: string): boolean {
  return tier === 'curation';
}

// Shared tab button class names
const TAB_BUTTON_ACTIVE = 'bg-teal-500 text-white shadow-md';
const TAB_BUTTON_INACTIVE = 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10';

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

  // Initialize activeTab from URL or default to 'showcase' (or 'battles' for Pip)
  const tabFromUrl = searchParams.get('tab') as 'showcase' | 'playground' | 'favorites' | 'learning' | 'activity' | 'marketplace' | 'battles' | null;
  const isPipProfile = username?.toLowerCase() === 'pip';
  const defaultTab = isPipProfile ? 'battles' : 'showcase';
  const [activeTab, setActiveTab] = useState<'showcase' | 'playground' | 'favorites' | 'learning' | 'activity' | 'marketplace' | 'battles'>(
    tabFromUrl && ['showcase', 'playground', 'favorites', 'learning', 'activity', 'marketplace', 'battles'].includes(tabFromUrl) ? tabFromUrl : defaultTab
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

  // Follow state
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [followersCount, setFollowersCount] = useState<number>(0);
  const [followingCount, setFollowingCount] = useState<number>(0);
  const [isFollowLoading, setIsFollowLoading] = useState<boolean>(false);
  const [followError, setFollowError] = useState<string | null>(null);
  const [showFollowModal, setShowFollowModal] = useState<'followers' | 'following' | null>(null);

  // Achievement state for the profile being viewed
  const [achievementsByCategory, setAchievementsByCategory] = useState<AchievementProgressData | null>(null);
  const [isAchievementsLoading, setIsAchievementsLoading] = useState(true);

  const isOwnProfile = username === user?.username;
  const displayUser = isOwnProfile ? user : profileUser;
  const isAdmin = user?.role === 'admin';
  const canManagePosts = isOwnProfile || isAdmin;

  // Special handling for Pip's profile (AI agent with special features)
  // Note: isPipProfile is already defined earlier for default tab selection
  const isPip = isPipProfile;

  // Sync activeTab with URL query parameter
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') as 'showcase' | 'playground' | 'favorites' | 'learning' | 'activity' | 'marketplace' | 'battles' | null;
    if (tabFromUrl && ['showcase', 'playground', 'favorites', 'learning', 'activity', 'marketplace', 'battles'].includes(tabFromUrl)) {
      // Security: only allow Activity and Learning tabs for authenticated users viewing their own profile
      if ((tabFromUrl === 'activity' || tabFromUrl === 'learning') && (!isAuthenticated || !isOwnProfile)) {
        setActiveTab('showcase');
        setSearchParams({ tab: 'showcase' });
        return;
      }
      // Security: only allow Marketplace tab for users with creator role
      if (tabFromUrl === 'marketplace' && displayUser?.role !== 'creator') {
        setActiveTab('showcase');
        setSearchParams({ tab: 'showcase' });
        return;
      }
      // Battles tab is only available for Pip
      if (tabFromUrl === 'battles' && !isPip) {
        setActiveTab('showcase');
        setSearchParams({ tab: 'showcase' });
        return;
      }
      setActiveTab(tabFromUrl);
    }
  }, [searchParams, isAuthenticated, isOwnProfile, setSearchParams, displayUser?.role, isPip]);

  // Track scroll position to fix sidebar after banner
  useEffect(() => {
    // Find the main scroll container from DashboardLayout
    const scrollContainer = document.querySelector('main');
    if (!scrollContainer) return;

    const handleScroll = () => {
      // Banner height is h-48 (192px) on mobile, h-64 (256px) on desktop
      // Using the smaller value ensures it triggers correctly on mobile
      const bannerHeight = 192;
      setScrolled(scrollContainer.scrollTop > bannerHeight);
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);


  // Update URL when tab changes
  const handleTabChange = (tab: 'showcase' | 'playground' | 'favorites' | 'learning' | 'activity' | 'marketplace' | 'battles') => {
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

  // Fetch achievements for the profile being viewed
  useEffect(() => {
    if (!username) {
      setAchievementsByCategory(null);
      setIsAchievementsLoading(false);
      return;
    }

    setIsAchievementsLoading(true);
    getUserAchievements(username)
      .then((data) => {
        setAchievementsByCategory(data);
      })
      .catch((error) => {
        logError('ProfilePage.fetchAchievements', error, { username });
        setAchievementsByCategory(null);
      })
      .finally(() => {
        setIsAchievementsLoading(false);
      });
  }, [username]);

  // Update follow state when profile user changes
  useEffect(() => {
    if (profileUser) {
      setIsFollowing(profileUser.isFollowing ?? false);
      setFollowersCount(profileUser.followersCount ?? 0);
      setFollowingCount(profileUser.followingCount ?? 0);
    }
  }, [profileUser]);

  // Handle follow/unfollow
  const handleToggleFollow = async () => {
    if (!username || isFollowLoading || !isAuthenticated) return;

    setIsFollowLoading(true);
    setFollowError(null);
    try {
      if (isFollowing) {
        const response = await followService.unfollowUser(username);
        setIsFollowing(false);
        setFollowersCount(response.followersCount);
      } else {
        const response = await followService.followUser(username);
        setIsFollowing(true);
        setFollowersCount(response.followersCount);
      }
    } catch (error) {
      logError('ProfilePage.handleToggleFollow', error, { username, isFollowing });
      const errorInfo = parseApiError(error);
      setFollowError(errorInfo.message);
      // Auto-clear error after 5 seconds
      setTimeout(() => setFollowError(null), 5000);
    } finally {
      setIsFollowLoading(false);
    }
  };

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
  const isCuration = isCurationTier(displayUser?.tier);
  const isCreator = displayUser?.role === 'creator';

  // Build tabs array - exclude favorites, learning, activity, and playground for curation tier users (agents)
  // Only show Shop tab for users with creator role
  // Special: Pip gets only a Battles tab (no Posts since Pip doesn't have projects)
  const tabs = (() => {
    if (isAuthenticated && isOwnProfile) {
      if (isCuration) {
        // Pip only gets Battles tab, other curation users get Posts
        if (isPip) {
          return [{ id: 'battles', label: 'Battles' }] as { id: string; label: string }[];
        }
        const baseTabs = [{ id: 'showcase', label: 'Posts' }];
        if (isCreator) baseTabs.push({ id: 'marketplace', label: 'Shop' });
        return baseTabs as { id: string; label: string }[];
      }
      const baseTabs = [
        { id: 'showcase', label: 'Showcase' },
        { id: 'playground', label: 'Playground' },
        { id: 'favorites', label: 'Favorites' },
      ];
      if (isCreator) baseTabs.push({ id: 'marketplace', label: 'Shop' });
      baseTabs.push({ id: 'learning', label: 'Learning' });
      baseTabs.push({ id: 'activity', label: 'Activity' });
      return baseTabs as { id: string; label: string }[];
    }
    if (showPlayground) {
      if (isCuration) {
        if (isPip) {
          return [{ id: 'battles', label: 'Battles' }] as { id: string; label: string }[];
        }
        const baseTabs = [{ id: 'showcase', label: 'Posts' }];
        if (isCreator) baseTabs.push({ id: 'marketplace', label: 'Shop' });
        return baseTabs as { id: string; label: string }[];
      }
      const baseTabs = [
        { id: 'showcase', label: 'Showcase' },
        { id: 'playground', label: 'Playground' },
        { id: 'favorites', label: 'Favorites' },
      ];
      if (isCreator) baseTabs.push({ id: 'marketplace', label: 'Shop' });
      return baseTabs as { id: string; label: string }[];
    }
    if (isCuration) {
      if (isPip) {
        return [{ id: 'battles', label: 'Battles' }] as { id: string; label: string }[];
      }
      const baseTabs = [{ id: 'showcase', label: 'Posts' }];
      if (isCreator) baseTabs.push({ id: 'marketplace', label: 'Shop' });
      return baseTabs as { id: string; label: string }[];
    }
    const baseTabs = [
      { id: 'showcase', label: 'Showcase' },
      { id: 'favorites', label: 'Favorites' },
    ];
    if (isCreator) baseTabs.push({ id: 'marketplace', label: 'Shop' });
    return baseTabs as { id: string; label: string }[];
  })();

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full" role="status" aria-live="polite">
          <FontAwesomeIcon icon={faSpinner} className="w-8 h-8 text-brand-primary animate-spin" aria-label="Loading profile" />
          <span className="sr-only">Loading profile...</span>
        </div>
      </DashboardLayout>
    );
  }

  // If user not found, render the 404 page directly
  if (userNotFound) {
    return <NotFoundPage />;
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col w-full relative">

        {/* Main content area */}
        <div className="w-full relative">
          {/* Mobile Sticky Header - Shows when scrolled past banner */}
          <div
            className={`lg:hidden fixed top-16 left-0 right-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-white/10 transition-all duration-300 transform ${
              scrolled ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
            }`}
          >
            <div className="flex items-center justify-between px-4 py-2 h-14">
              {/* User Info */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-gray-200 dark:ring-white/10 flex-shrink-0">
                  <img
                    src={displayUser?.avatarUrl || `https://ui-avatars.com/api/?name=${displayUser?.fullName || 'User'}&background=random`}
                    className="w-full h-full object-cover"
                    alt="Profile"
                  />
                </div>
                <span className="font-bold text-sm text-gray-900 dark:text-white truncate">
                  {displayUser?.fullName || displayUser?.username}
                </span>
              </div>

              {/* Connect Icons */}
              {socialLinks.length > 0 && (
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  {socialLinks.slice(0, 3).map((link, i) => (
                    <a
                      key={i}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-brand-primary hover:text-white transition-colors"
                      aria-label={`Visit ${displayUser?.fullName || displayUser?.username}'s ${link.label}`}
                    >
                      <FontAwesomeIcon icon={link.icon} className="w-3.5 h-3.5" aria-hidden="true" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Large Hero Banner - Scrolls with page */}
          <div className="h-48 md:h-64 w-full relative group overflow-hidden transition-all duration-500 ease-in-out">
            {/* Banner Content - Large photo and name */}
            <div className="absolute inset-0 flex items-end p-4 md:p-8 lg:p-12">
              <div className="flex items-end gap-4 md:gap-8 w-full">
                {/* Large Avatar */}
                <div className="flex-shrink-0 transition-all duration-500 ease-in-out">
                  <div className="w-24 h-24 md:w-32 md:h-32 lg:w-40 lg:h-40 rounded ring-4 ring-white dark:ring-gray-800 shadow-xl overflow-hidden bg-gray-100 dark:bg-white/5 transition-all duration-500">
                    <img
                      src={displayUser?.avatarUrl || `https://ui-avatars.com/api/?name=${displayUser?.fullName || 'User'}&background=random`}
                      className="w-full h-full object-cover"
                      alt="Profile"
                    />
                  </div>
                </div>

                {/* Name & Tagline */}
                <div className="pb-2 md:pb-4 flex-1 min-w-0 transition-all duration-500 ease-in-out">
                  <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold mb-1 md:mb-2 leading-tight truncate transition-all duration-500">
                    <span className="bg-gradient-to-r from-[#4ADEE7] to-[#22D3EE] bg-clip-text text-transparent">
                      {displayUser?.fullName || displayUser?.username || 'Portfolio'}
                    </span>
                  </h1>
                  {displayUser?.tagline && (
                    <p className="text-gray-600 dark:text-gray-300 text-sm md:text-base lg:text-lg line-clamp-2 md:line-clamp-none">
                      {displayUser.tagline}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Flex Container for Sidebar + Content */}
          <div className="flex flex-col lg:flex-row gap-6 px-4 md:px-6 lg:px-8 w-full">

            {/* Left Sidebar - Sticky on Desktop, Relative on Mobile */}
            <aside
              className={`self-start transition-all duration-300 w-full ${
                sidebarOpen ? 'lg:w-[30%]' : 'lg:w-20'
              } flex-shrink-0 z-40 mb-6 lg:mb-0 lg:sticky lg:top-20`}
              style={{ height: 'auto', minHeight: 'fit-content' }}
            >
              <div className="h-full bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl lg:rounded-none lg:border-y-0 lg:border-l-0 lg:border-r overflow-hidden flex flex-col transition-all duration-300">
                {sidebarOpen ? (
                  /* Expanded Sidebar View */
                  <div className="flex flex-col h-full p-4 overflow-y-auto">
                    {/* Toggle Button - Desktop Only */}
                    <button
                      onClick={() => setSidebarOpen(false)}
                      className="hidden lg:block absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      aria-label="Collapse sidebar"
                    >
                      <FontAwesomeIcon icon={faArrowLeft} className="w-4 h-4" aria-hidden="true" />
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

                    {/* Stats Grid - 2 columns for curation tier (no points), 3 columns for others */}
                    <div className={`grid ${isCuration ? 'grid-cols-2' : 'grid-cols-3'} gap-2 ${scrolled ? 'border-y' : 'border-b'} border-gray-200 dark:border-white/10 py-4 mb-6`}>
                      {/* Points - Hidden for curation tier */}
                      {!isCuration && (
                        <div className="text-center">
                          <div className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                            {displayUser?.totalPoints || 0}
                          </div>
                          <div className="text-[10px] uppercase tracking-wider text-gray-500">Points</div>
                        </div>
                      )}
                      <div className={`text-center ${!isCuration ? 'border-l border-gray-200 dark:border-white/10 pl-1' : ''}`}>
                        <div className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                          {projects.showcase.length + projects.playground.length}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-gray-500">Projects</div>
                      </div>
                      <div className="text-center border-l border-gray-200 dark:border-white/10 pl-1">
                        <div className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                          {isTierLoading ? '...' : (tierStatus?.tierDisplay || getTierDisplay(displayUser?.tier))}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-gray-500">Tier</div>
                      </div>
                    </div>

                    {/* Follow Section */}
                    <div className="mb-6">
                      {/* Follow/Unfollow Button - Only show for other users */}
                      {!isOwnProfile && isAuthenticated && (
                        <button
                          onClick={handleToggleFollow}
                          disabled={isFollowLoading}
                          className={`w-full py-2.5 px-4 rounded-lg font-medium transition-all mb-4 flex items-center justify-center gap-2 ${
                            isFollowing
                              ? 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400'
                              : 'bg-teal-500 text-white hover:bg-teal-600'
                          }`}
                        >
                          {isFollowLoading ? (
                            <FontAwesomeIcon icon={faSpinner} className="w-4 h-4 animate-spin" />
                          ) : isFollowing ? (
                            'Following'
                          ) : (
                            <>
                              <FontAwesomeIcon icon={faUserPlus} className="w-4 h-4" />
                              Follow
                            </>
                          )}
                        </button>
                      )}

                      {/* Follow Error Message */}
                      {followError && (
                        <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                          {followError}
                        </div>
                      )}

                      {/* Follower/Following Stats */}
                      <div className="flex gap-4 text-sm">
                        <button
                          onClick={() => setShowFollowModal('followers')}
                          className="hover:underline text-gray-700 dark:text-gray-300"
                        >
                          <span className="font-bold">{followersCount}</span>
                          <span className="text-gray-500 dark:text-gray-400 ml-1">Followers</span>
                        </button>
                        <button
                          onClick={() => setShowFollowModal('following')}
                          className="hover:underline text-gray-700 dark:text-gray-300"
                        >
                          <span className="font-bold">{followingCount}</span>
                          <span className="text-gray-500 dark:text-gray-400 ml-1">Following</span>
                        </button>
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
                        <div
                          className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed prose prose-sm dark:prose-invert max-w-none"
                          dangerouslySetInnerHTML={{ __html: displayUser.bio }}
                        />
                      </div>
                    )}

                    {/* Achievements - Hidden for curation tier, but shown for Pip */}
                    {(!isCuration || isPip) && (
                      <div className="mb-6">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Achievements</h4>
                        {achievementsByCategory && !isAchievementsLoading ? (() => {
                          const earnedAchievements = Object.values(achievementsByCategory)
                            .flat()
                            .filter(a => a.isEarned);

                          if (earnedAchievements.length === 0) {
                            return <p className="text-sm text-gray-400 italic">No badges yet</p>;
                          }

                          return (
                            <ProfileAchievementGrid
                              achievements={earnedAchievements}
                              maxDisplay={6}
                            />
                          );
                        })() : (
                          <div className="grid grid-cols-3 gap-2">
                            {[1,2,3,4,5,6].map(i => (
                              <div key={i} className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/5 animate-pulse" />
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tools - Hidden for Pip (AI opponent) */}
                    {!isPip && (
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
                                  aria-label={`View ${tool.name} tool details`}
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
                    )}
                  </div>
                ) : (
                  /* Collapsed Sidebar View - Desktop Only (Sidebar is always expanded/stacked on mobile) */
                  <div className="hidden lg:flex flex-col items-center h-full py-6 gap-6">
                    {/* Toggle Button */}
                    <button
                      onClick={() => setSidebarOpen(true)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      aria-label="Expand sidebar"
                    >
                      <FontAwesomeIcon icon={faArrowRight} className="w-4 h-4" aria-hidden="true" />
                    </button>

                    {/* Profile Circle - Only show when banner is out of view */}
                    {scrolled && (
                      <button
                        onClick={() => setSidebarOpen(true)}
                        className="w-12 h-12 rounded-full ring-2 ring-brand-primary/30 overflow-hidden bg-gray-100 dark:bg-white/5 hover:ring-brand-primary transition-all animate-fade-in"
                        aria-label={`View ${displayUser?.fullName || displayUser?.username}'s profile details`}
                      >
                        <img
                          src={displayUser?.avatarUrl || `https://ui-avatars.com/api/?name=${displayUser?.fullName || 'User'}&background=random`}
                          className="w-full h-full object-cover"
                          alt=""
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
                          activeTab === 'showcase' ? TAB_BUTTON_ACTIVE : TAB_BUTTON_INACTIVE
                        }`}
                        title="Showcase"
                      >
                        <FontAwesomeIcon icon={faTh} className="w-3 h-3" />
                      </button>

                      {/* Playground Icon - Always visible */}
                      <button
                        onClick={() => handleTabChange('playground')}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                          activeTab === 'playground' ? TAB_BUTTON_ACTIVE : TAB_BUTTON_INACTIVE
                        }`}
                        title="Playground"
                      >
                        <FontAwesomeIcon icon={faFlask} className="w-3 h-3" />
                      </button>

                      {/* Favorites Icon - Hidden for curation tier */}
                      {!isCuration && (
                        <button
                          onClick={() => handleTabChange('favorites')}
                          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                            activeTab === 'favorites'
                              ? 'bg-pink-500 text-white shadow-md'
                              : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
                          }`}
                          title="Favorites"
                        >
                          <FontAwesomeIcon icon={faHeart} className="w-3 h-3" />
                        </button>
                      )}

                      {/* Learning Icon - Only visible for profile owner */}
                      {isOwnProfile && (
                        <button
                          onClick={() => handleTabChange('learning')}
                          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                            activeTab === 'learning' ? TAB_BUTTON_ACTIVE : TAB_BUTTON_INACTIVE
                          }`}
                          title="Learning"
                        >
                          <FontAwesomeIcon icon={faGraduationCap} className="w-3 h-3" />
                        </button>
                      )}

                      {/* Activity Icon - Only visible for profile owner */}
                      {isOwnProfile && (
                        <button
                          onClick={() => handleTabChange('activity')}
                          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                            activeTab === 'activity' ? TAB_BUTTON_ACTIVE : TAB_BUTTON_INACTIVE
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
            <div className="flex-1 flex flex-col pb-10 min-w-0 max-w-7xl">

              {/* Top Header: Tabs & Actions */}
              <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200 dark:border-gray-800 mb-6 md:mb-8 pt-2 gap-4">
                <div
                  className="flex items-baseline space-x-4 md:space-x-8 overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 w-full md:w-auto"
                  role="tablist"
                  aria-label="Profile sections"
                >
                  {/* Tabs with Icons */}
                  {tabs.map((tab) => {
                    const tabIcons = {
                      showcase: faTh,
                      playground: faFlask,
                      favorites: faHeart,
                      marketplace: faStore,
                      learning: faGraduationCap,
                      activity: faChartLine,
                      battles: faBolt,
                    };

                    return (
                      <button
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id as any)}
                        role="tab"
                        aria-selected={activeTab === tab.id}
                        aria-controls={`tabpanel-${tab.id}`}
                        id={`tab-${tab.id}`}
                        tabIndex={activeTab === tab.id ? 0 : -1}
                        className={`flex items-center gap-2 py-3 px-3 text-sm font-medium transition-all ${
                          activeTab === tab.id
                            ? 'glass-subtle text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800 shadow-neon'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:shadow-neon'
                        }`}
                        style={{ borderRadius: 'var(--radius)' }}
                      >
                        <FontAwesomeIcon icon={tabIcons[tab.id as keyof typeof tabIcons]} className="w-3.5 h-3.5" aria-hidden="true" />
                        {tab.label}
                      </button>
                    );
                  })}

                  {/* Select/Delete Buttons - For profile owner or admin on Showcase/Playground tabs */}
                  {canManagePosts &&
                   ((activeTab === 'showcase' && projects.showcase.length > 0) ||
                    (activeTab === 'playground' && projects.playground.length > 0)) && (
                    <div className="flex items-center gap-2 md:ml-4 self-end md:self-auto">
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
                        aria-pressed={selectionMode}
                        aria-label={selectionMode ? 'Cancel selection mode' : 'Enter selection mode'}
                      >
                        <FontAwesomeIcon icon={faList} className="w-3 h-3" aria-hidden="true" />
                        {selectionMode ? 'Cancel' : 'Select'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Masonry Grid Content - Only for Showcase and Playground */}
              {(activeTab === 'showcase' || activeTab === 'playground') && (
                <div
                  role="tabpanel"
                  id={`tabpanel-${activeTab}`}
                  aria-labelledby={`tab-${activeTab}`}
                  className="pb-20"
                >
                <MasonryGrid>
                  {/* Showcase Tab */}
                  {activeTab === 'showcase' && (
                    projects.showcase.length > 0 ? (
                      projects.showcase.map((project) => (
                        <div key={project.id} className="break-inside-avoid mb-6">
                          <ProjectCard
                            project={project}
                            onEdit={() => navigate(`/${username}/${project.slug}/edit`)}
                            onDelete={async () => {}}
                            isOwner={canManagePosts}
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
                            isOwner={canManagePosts}
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
                </MasonryGrid>
                </div>
              )}

              {/* Favorites Tab - Full width layout */}
              {activeTab === 'favorites' && (
                <div
                  className="pb-20"
                  role="tabpanel"
                  id="tabpanel-favorites"
                  aria-labelledby="tab-favorites"
                >
                  <FavoritesTab
                    username={username || user?.username || ''}
                    isOwnProfile={isOwnProfile}
                  />
                </div>
              )}

              {/* Learning Tab - Full width layout */}
              {activeTab === 'learning' && (
                <div
                  className="pb-20"
                  role="tabpanel"
                  id="tabpanel-learning"
                  aria-labelledby="tab-learning"
                >
                  <LearningPathsTab
                    username={username || user?.username || ''}
                    isOwnProfile={isOwnProfile}
                  />
                </div>
              )}

              {/* Activity Tab - Full width layout */}
              {activeTab === 'activity' && isOwnProfile && (
                <div
                  role="tabpanel"
                  id="tabpanel-activity"
                  aria-labelledby="tab-activity"
                >
                  <ActivityInsightsTab
                    username={username || ''}
                    isOwnProfile={isOwnProfile}
                  />
                </div>
              )}

              {/* Marketplace Tab - Full width layout */}
              {activeTab === 'marketplace' && (
                <div
                  className="pb-20"
                  role="tabpanel"
                  id="tabpanel-marketplace"
                  aria-labelledby="tab-marketplace"
                >
                  <MarketplaceTab
                    username={username || user?.username || ''}
                    isOwnProfile={isOwnProfile}
                  />
                </div>
              )}

              {/* Battles Tab - Special tab for Pip to show all prompt battles */}
              {activeTab === 'battles' && isPip && (
                <div
                  className="pb-20"
                  role="tabpanel"
                  id="tabpanel-battles"
                  aria-labelledby="tab-battles"
                >
                  <BattlesTab username={username || ''} />
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
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-description"
          >
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
              <h3 id="delete-dialog-title" className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Delete {selectedProjectIds.size} project{selectedProjectIds.size > 1 ? 's' : ''}?
              </h3>
              <p id="delete-dialog-description" className="text-gray-600 dark:text-gray-400 mb-6">
                This action cannot be undone. The selected project{selectedProjectIds.size > 1 ? 's' : ''} will be permanently deleted.
                {!isOwnProfile && isAdmin && (
                  <span className="block mt-2 text-amber-600 dark:text-amber-400 font-medium">
                    ⚠️ Admin Action: You are deleting another user's projects.
                  </span>
                )}
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
                  aria-busy={isDeleting}
                >
                  {isDeleting && <FontAwesomeIcon icon={faSpinner} className="w-4 h-4 animate-spin" aria-hidden="true" />}
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Follow List Modal */}
        {showFollowModal && username && (
          <FollowListModal
            isOpen={!!showFollowModal}
            onClose={() => setShowFollowModal(null)}
            username={username}
            type={showFollowModal}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
