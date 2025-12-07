import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useSideQuests } from '@/hooks/useSideQuests';
import { useQuestCategories } from '@/hooks/useQuestCategories';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { QuestTray } from '@/components/side-quests/QuestTray';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCompass,
  faTrophy,
  faCheckCircle,
  faTimes,
  faClock,
  faArrowLeft,
  faFire,
  faStar,
  faBolt,
  faPlay,
  faCheck,
  faLock,
  faGamepad,
  faUsers,
  faScroll,
  faGraduationCap,
  faPaintBrush,
  faCalendarCheck,
  faRocket,
  faHeart,
  faLightbulb,
  faBrain,
  faCode,
  faBook,
  faPuzzlePiece,
  faChevronLeft,
  faChevronRight,
  faShieldAlt,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import { Link } from 'react-router-dom';
import type { SideQuest, UserSideQuest } from '@/types/models';
import { DEFAULT_QUEST_COLORS } from '@/utils/colors';

// Reusable style constants
const GLASS_BORDER_SUBTLE = '1px solid var(--glass-border-subtle)';

// Map icon names from backend to FontAwesome icons
const categoryIconMap: Record<string, IconDefinition> = {
  faUsers,
  faGraduationCap,
  faPaintBrush,
  faCompass,
  faCalendarCheck,
  faStar,
  faRocket,
  faHeart,
  faLightbulb,
  faBrain,
  faCode,
  faBook,
  faPuzzlePiece,
  faGamepad,
  faTrophy,
  faFire,
};

const difficultyConfig = {
  easy: { color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', icon: faStar, label: 'Beginner' },
  medium: { color: 'text-amber-400', bgColor: 'bg-amber-500/20', icon: faBolt, label: 'Intermediate' },
  hard: { color: 'text-rose-400', bgColor: 'bg-rose-500/20', icon: faFire, label: 'Advanced' },
  epic: { color: 'text-violet-400', bgColor: 'bg-violet-500/20', icon: faTrophy, label: 'Epic' },
};

// Helper to get category icon
const getCategoryIcon = (iconName?: string): IconDefinition => {
  if (!iconName) return faCompass;
  return categoryIconMap[iconName] || faCompass;
};

export default function SideQuestsPage() {
  const { isAuthenticated } = useAuth();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const {
    availableQuests,
    myQuests,
    isLoading,
    startQuestAsync,
    isStartingQuest,
    abandonQuest,
    isAbandoningQuest,
  } = useSideQuests();

  const {
    categories,
    isLoading: isLoadingCategories,
  } = useQuestCategories();

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Tray state
  const [trayOpen, setTrayOpen] = useState(false);
  const [selectedQuest, setSelectedQuest] = useState<SideQuest | null>(null);
  const [selectedUserQuest, setSelectedUserQuest] = useState<UserSideQuest | null>(null);

  // Get user quest status
  const getUserQuestStatus = (questId: string) => {
    return myQuests.find(uq => uq.sideQuest.id === questId);
  };

  // Get colors and category for a quest
  const getQuestCategoryInfo = (quest: SideQuest | null, userQuest: UserSideQuest | null) => {
    const sideQuest = userQuest?.sideQuest || quest;
    if (!sideQuest?.categorySlug) return { colors: undefined, category: undefined };
    const category = categories.find(c => c.slug === sideQuest.categorySlug);
    if (!category) return { colors: undefined, category: undefined };
    return {
      colors: { colorFrom: category.colorFrom, colorTo: category.colorTo },
      category,
    };
  };

  // Get colors for the currently selected quest
  const { colors: selectedQuestColors, category: selectedQuestCategory } = getQuestCategoryInfo(selectedQuest, selectedUserQuest);

  // Handle quest click
  const handleQuestClick = (quest: SideQuest) => {
    const userQuest = getUserQuestStatus(quest.id);
    setSelectedQuest(userQuest ? null : quest);
    setSelectedUserQuest(userQuest || null);
    setTrayOpen(true);
  };

  // Handle closing the tray
  const handleCloseTray = () => {
    setTrayOpen(false);
    setTimeout(() => {
      setSelectedQuest(null);
      setSelectedUserQuest(null);
    }, 300);
  };

  // Handle starting a quest
  const handleStartQuest = async (questId: string) => {
    try {
      const result = await startQuestAsync(questId);
      const quest = availableQuests.find(q => q.id === questId);

      if (result) {
        setSelectedUserQuest(result as UserSideQuest);
        setSelectedQuest(null);
      }

      setSuccessMessage(`Quest "${quest?.title || 'Quest'}" started!`);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error) {
      console.error('Failed to start quest:', error);
    }
  };

  // Show login prompt for unauthenticated users
  if (!isAuthenticated) {
    return (
      <DashboardLayout>
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-2">Join Side Quests</h1>
            <p className="text-muted">Log in to discover and complete optional challenges for bonus Points</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Sort categories by their order field for proper progression
  const mainCategories = categories
    .filter(c => c.categoryType !== 'daily')
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  const inProgressQuests = myQuests.filter(q => q.status === 'in_progress');

  // Difficulty order for sorting (beginner to advanced progression)
  const difficultyOrder: Record<string, number> = {
    easy: 0,     // Beginner
    medium: 1,   // Intermediate
    hard: 2,     // Advanced
    epic: 3,     // Epic
  };

  // Get quests for a category, sorted by difficulty then by order field
  const getQuestsForCategory = (categorySlug: string) => {
    return availableQuests
      .filter(q => q.categorySlug === categorySlug)
      .sort((a, b) => {
        // First sort by difficulty (easy → medium → hard → epic)
        const diffA = difficultyOrder[a.difficulty] ?? 99;
        const diffB = difficultyOrder[b.difficulty] ?? 99;
        if (diffA !== diffB) return diffA - diffB;

        // Then sort by order field if available
        const orderA = a.order ?? 999;
        const orderB = b.order ?? 999;
        return orderA - orderB;
      });
  };

  // Track which category is expanded (null = none expanded)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Toggle category expansion
  const toggleCategory = (categorySlug: string) => {
    setExpandedCategory(prev => prev === categorySlug ? null : categorySlug);
  };

  // Slider for Continue Playing
  const sliderRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftStart, setScrollLeftStart] = useState(0);
  const [hasDragged, setHasDragged] = useState(false);

  const updateScrollButtons = () => {
    if (sliderRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = sliderRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const scrollSlider = (direction: 'left' | 'right') => {
    if (sliderRef.current) {
      const cardWidth = sliderRef.current.firstElementChild?.clientWidth || 300;
      const scrollAmount = direction === 'left' ? -cardWidth - 16 : cardWidth + 16;
      sliderRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      setTimeout(updateScrollButtons, 300);
    }
  };

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!sliderRef.current) return;
    setIsDragging(true);
    setHasDragged(false);
    setStartX(e.pageX - sliderRef.current.offsetLeft);
    setScrollLeftStart(sliderRef.current.scrollLeft);
    sliderRef.current.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !sliderRef.current) return;
    e.preventDefault();
    const x = e.pageX - sliderRef.current.offsetLeft;
    const walk = (x - startX) * 1.5; // Multiply for faster scroll
    // Mark as dragged if moved more than 5px
    if (Math.abs(x - startX) > 5) {
      setHasDragged(true);
    }
    sliderRef.current.scrollLeft = scrollLeftStart - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (sliderRef.current) {
      sliderRef.current.style.cursor = 'grab';
    }
    updateScrollButtons();
    // Reset hasDragged after a short delay to allow click to check it
    setTimeout(() => setHasDragged(false), 100);
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      if (sliderRef.current) {
        sliderRef.current.style.cursor = 'grab';
      }
      updateScrollButtons();
      setTimeout(() => setHasDragged(false), 100);
    }
  };

  // Handle card click - prevent if dragging
  const handleCardClick = (userQuest: UserSideQuest) => {
    if (hasDragged) return;
    setSelectedQuest(null);
    setSelectedUserQuest(userQuest);
    setTrayOpen(true);
  };

  // Initialize scroll buttons on mount
  useEffect(() => {
    updateScrollButtons();
  }, [inProgressQuests]);

  // Helper to convert hex to rgba
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Main Grid View - Game Library
  return (
    <DashboardLayout>
      <div className="h-full overflow-y-auto">
        {/* Hero Banner - Neon Glass Style */}
        <header className="relative h-64 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-900 dark:to-slate-800 overflow-hidden" aria-label="Side Quests page header">
          {/* Ambient Glow Background */}
          <div className="absolute top-1/2 left-1/4 -translate-x-1/4 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-cyan-500/20 dark:bg-cyan-500/20 blur-[120px] pointer-events-none" aria-hidden="true" />
          <div className="absolute top-1/4 right-1/4 w-[400px] h-[300px] rounded-full bg-green-500/10 dark:bg-green-500/10 blur-[100px] pointer-events-none" aria-hidden="true" />

          <div className="relative max-w-6xl mx-auto px-6 h-full flex flex-col justify-center">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-green-500 dark:from-cyan-400 dark:via-cyan-300 dark:to-green-400 bg-clip-text text-transparent">Side Quests</span>
            </h1>
            <p className="text-xl text-gray-700 dark:text-gray-300 max-w-2xl">
              Embark on quests, forge new skills, and claim legendary rewards
            </p>
          </div>
        </header>

        {/* Main Content Container */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
          {/* Success notification */}
          {successMessage && (
            <div className="bg-green-500/10 dark:bg-green-500/10 border border-green-500/30 dark:border-green-500/30 rounded-lg p-3 flex items-center justify-between" role="alert">
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faCheckCircle} className="text-green-600 dark:text-green-400" aria-hidden="true" />
                <p className="text-green-700 dark:text-green-300 text-sm">{successMessage}</p>
              </div>
              <button onClick={() => setSuccessMessage(null)} aria-label="Dismiss notification" className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300">
                <FontAwesomeIcon icon={faTimes} aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Featured Games Section */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <FontAwesomeIcon icon={faGamepad} className="text-violet-400" />
              <h2 className="text-lg font-bold text-default">Featured Games</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Ethics Defender Game Card */}
              <Link
                to="/play/ethics-defender"
                className="group relative overflow-hidden rounded-2xl transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
                style={{
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(59, 130, 246, 0.05))',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                }}
              >
                {/* Animated Background Glow */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    background: 'radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.3), transparent 70%)',
                  }}
                />

                {/* Starfield Background */}
                <div className="absolute inset-0 overflow-hidden">
                  {[...Array(20)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute rounded-full bg-white animate-pulse"
                      style={{
                        width: Math.random() * 2 + 1 + 'px',
                        height: Math.random() * 2 + 1 + 'px',
                        left: Math.random() * 100 + '%',
                        top: Math.random() * 100 + '%',
                        animationDelay: Math.random() * 2 + 's',
                        animationDuration: Math.random() * 2 + 1 + 's',
                        opacity: Math.random() * 0.5 + 0.2,
                      }}
                    />
                  ))}
                </div>

                <div className="relative p-5">
                  {/* Game Icon */}
                  <div className="w-14 h-14 rounded-xl mb-4 flex items-center justify-center bg-gradient-to-br from-violet-500/30 to-blue-500/20 border border-violet-500/30">
                    <FontAwesomeIcon icon={faShieldAlt} className="text-2xl text-violet-400" />
                  </div>

                  {/* Game Info */}
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-xl text-white group-hover:text-violet-300 transition-colors">
                      Ethics Defender
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/30 text-violet-300 border border-violet-500/30 animate-pulse">
                      NEW
                    </span>
                  </div>

                  <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                    Defend the galaxy from AI ethics threats! Shoot the correct answers to earn rewards while learning about AI bias, privacy, and more.
                  </p>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <FontAwesomeIcon icon={faRocket} className="text-cyan-400" />
                      <span className="text-gray-400">Space Shooter</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FontAwesomeIcon icon={faBrain} className="text-pink-400" />
                      <span className="text-gray-400">AI Ethics</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FontAwesomeIcon icon={faTrophy} className="text-amber-400" />
                      <span className="text-amber-400 font-medium">+50 pts</span>
                    </div>
                  </div>

                  {/* Play Button Overlay */}
                  <div className="absolute bottom-5 right-5 w-10 h-10 rounded-full bg-violet-500/30 border border-violet-400/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:scale-110">
                    <FontAwesomeIcon icon={faPlay} className="text-violet-300 text-sm ml-0.5" />
                  </div>
                </div>
              </Link>
            </div>
          </section>

          {/* Continue Playing - Active Quests */}
          {inProgressQuests.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <FontAwesomeIcon icon={faPlay} className="text-cyan-400" />
                  <h2 className="text-lg font-bold text-default">Continue Playing</h2>
                </div>
                {/* Navigation arrows - only show on desktop when there are more than 3 quests */}
                {inProgressQuests.length > 3 && (
                  <div className="hidden sm:flex items-center gap-2">
                    <button
                      onClick={() => scrollSlider('left')}
                      disabled={!canScrollLeft}
                      className="w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{ background: 'var(--glass-fill)', border: GLASS_BORDER_SUBTLE }}
                    >
                      <FontAwesomeIcon icon={faChevronLeft} className="text-muted text-sm" />
                    </button>
                    <button
                      onClick={() => scrollSlider('right')}
                      disabled={!canScrollRight}
                      className="w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{ background: 'var(--glass-fill)', border: GLASS_BORDER_SUBTLE }}
                    >
                      <FontAwesomeIcon icon={faChevronRight} className="text-muted text-sm" />
                    </button>
                  </div>
                )}
              </div>

              {/* Horizontal slider container */}
              <div
                ref={sliderRef}
                onScroll={updateScrollButtons}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                className={`flex gap-4 overflow-x-auto scrollbar-hide pb-2 ${isDragging ? '' : 'snap-x snap-mandatory'} select-none`}
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', cursor: 'grab' }}
              >
                {inProgressQuests.map((userQuest) => {
                  // Get category colors for this quest
                  const { colors: questColors } = getQuestCategoryInfo(null, userQuest);
                  const colorFrom = questColors?.colorFrom || DEFAULT_QUEST_COLORS.colorFrom;
                  const colorTo = questColors?.colorTo || DEFAULT_QUEST_COLORS.colorTo;

                  return (
                    <div
                      key={userQuest.id}
                      className="group relative overflow-hidden rounded-xl text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-xl cursor-pointer flex-shrink-0 snap-start w-[85vw] sm:w-[calc((100%-2rem)/2)] lg:w-[calc((100%-2rem)/3)]"
                      style={{
                        background: `linear-gradient(135deg, ${hexToRgba(colorFrom, 0.15)}, ${hexToRgba(colorTo, 0.05)})`,
                        border: `1px solid ${hexToRgba(colorFrom, 0.3)}`,
                      }}
                      onClick={() => handleCardClick(userQuest)}
                    >
                      {/* Delete Button - appears on hover */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          abandonQuest(userQuest.sideQuest.id);
                        }}
                        disabled={isAbandoningQuest}
                        className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 bg-red-500/80 hover:bg-red-500 text-white shadow-lg"
                        title="Cancel quest"
                      >
                        <FontAwesomeIcon icon={faTimes} className="text-xs" />
                      </button>

                      {/* Glow Effect */}
                      <div
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                        style={{
                          background: `radial-gradient(circle at center, ${hexToRgba(colorFrom, 0.2)}, transparent 70%)`,
                        }}
                      />

                      <div className="relative p-4 sm:p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{
                              background: `linear-gradient(135deg, ${hexToRgba(colorFrom, 0.4)}, ${hexToRgba(colorTo, 0.2)})`,
                            }}
                          >
                            <FontAwesomeIcon icon={faPlay} style={{ color: colorFrom }} />
                          </div>
                          <span
                            className="text-[10px] px-2 py-1 rounded-full font-bold animate-pulse"
                            style={{
                              backgroundColor: hexToRgba(colorFrom, 0.3),
                              color: colorFrom,
                            }}
                          >
                            IN PROGRESS
                          </span>
                        </div>

                        <h4 className="font-bold text-default mb-1 truncate">{userQuest.sideQuest.title}</h4>
                        <p className="text-xs text-muted truncate mb-3">
                          {userQuest.sideQuest.categorySlug?.replace(/-/g, ' ')}
                        </p>

                        {/* Progress */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--glass-fill)' }}>
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${userQuest.progressPercentage}%`,
                                background: `linear-gradient(135deg, ${colorFrom}, ${colorTo})`,
                              }}
                            />
                          </div>
                          <span className="text-sm font-bold" style={{ color: colorFrom }}>{userQuest.progressPercentage}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Quest Paths - Game Library */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <FontAwesomeIcon icon={faCompass} className="text-cyan-400" />
              <h2 className="text-lg font-bold text-default">Quest Paths</h2>
            </div>

            {isLoadingCategories || isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400" />
              </div>
            ) : mainCategories.length === 0 ? (
              <div
                className="text-center py-16 rounded-2xl glass-subtle"
              >
                <FontAwesomeIcon icon={faCompass} className="text-5xl text-muted mb-4" />
                <p className="text-secondary text-lg">No quest paths available yet</p>
                <p className="text-muted text-sm mt-2">New adventures coming soon!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {mainCategories.map((category) => {
                  const categoryQuests = getQuestsForCategory(category.slug);
                  const completedCount = category.progress?.completedQuests || 0;
                  const totalCount = category.progress?.totalQuests || categoryQuests.length;
                  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
                  const totalPoints = categoryQuests.reduce((sum, q) => sum + q.pointsReward, 0);
                  const isComplete = progressPercent === 100;
                  const isExpanded = expandedCategory === category.slug;

                  // Category colors
                  const cardColorFrom = category.colorFrom || DEFAULT_QUEST_COLORS.colorFrom;
                  const cardColorTo = category.colorTo || DEFAULT_QUEST_COLORS.colorTo;

                  return (
                    <div
                      key={category.id}
                      className="rounded-2xl overflow-hidden transition-all duration-300"
                      style={{
                        background: isComplete
                          ? 'linear-gradient(145deg, rgba(74, 222, 128, 0.1), rgba(74, 222, 128, 0.03))'
                          : isExpanded
                            ? `linear-gradient(145deg, ${hexToRgba(cardColorFrom, 0.1)}, ${hexToRgba(cardColorFrom, 0.03)})`
                            : 'var(--glass-fill-subtle)',
                        border: isComplete
                          ? '1px solid rgba(74, 222, 128, 0.3)'
                          : isExpanded
                            ? `1px solid ${hexToRgba(cardColorFrom, 0.3)}`
                            : GLASS_BORDER_SUBTLE,
                      }}
                    >
                      {/* Category Card Header - Clickable */}
                      <button
                        onClick={() => toggleCategory(category.slug)}
                        className="w-full text-left group"
                      >
                        <div className="flex items-stretch">
                          {/* Left: Cover Art Section */}
                          <div
                            className="w-24 sm:w-32 relative overflow-hidden flex-shrink-0 self-stretch"
                            style={{
                              background: isDarkMode
                                ? `linear-gradient(135deg, ${hexToRgba(cardColorFrom, 0.3)} 0%, ${hexToRgba(cardColorTo, 0.2)} 50%, rgba(2, 6, 23, 0.9) 100%)`
                                : `linear-gradient(135deg, ${hexToRgba(cardColorFrom, 0.25)} 0%, ${hexToRgba(cardColorTo, 0.15)} 50%, rgba(248, 250, 252, 0.95) 100%)`,
                            }}
                          >
                            {/* Icon */}
                            <div className="absolute inset-0 flex items-center justify-center">
                              <FontAwesomeIcon
                                icon={getCategoryIcon(category.icon)}
                                className="text-4xl sm:text-5xl opacity-70 group-hover:scale-110 transition-transform duration-300"
                                style={{ color: cardColorFrom }}
                              />
                            </div>

                            {/* Hover Glow */}
                            <div
                              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                              style={{
                                background: `radial-gradient(circle at center, ${hexToRgba(cardColorFrom, 0.4)}, transparent 70%)`,
                              }}
                            />
                          </div>

                          {/* Right: Info Section */}
                          <div className="flex-1 p-4 sm:p-5 flex flex-col justify-center min-w-0">
                            {/* Top Row: Title + Badges */}
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3
                                className="font-bold text-lg transition-colors truncate"
                                style={{ color: isExpanded ? cardColorFrom : 'var(--text-primary)' }}
                              >
                                {category.name}
                              </h3>
                              {isComplete && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30 flex-shrink-0">
                                  ✓ COMPLETE
                                </span>
                              )}
                            </div>

                            {/* Description */}
                            <p className="text-sm text-muted line-clamp-1 mb-3">
                              {category.description}
                            </p>

                            {/* Stats Row */}
                            <div className="flex items-center gap-4 flex-wrap">
                              <div className="flex items-center gap-1.5 text-xs">
                                <FontAwesomeIcon icon={faScroll} className="text-muted" />
                                <span className="text-muted">{totalCount} Quests</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs">
                                <FontAwesomeIcon icon={faTrophy} className="text-amber-400" />
                                <span className="text-amber-400 font-medium">{totalPoints} Points</span>
                              </div>
                              <div className="flex items-center gap-2 flex-1 min-w-[100px] max-w-[200px]">
                                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--glass-fill)' }}>
                                  <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                      width: `${progressPercent}%`,
                                      background: isComplete
                                        ? 'linear-gradient(135deg, #4ade80, #22c55e)'
                                        : `linear-gradient(135deg, ${cardColorFrom}, ${cardColorTo})`,
                                    }}
                                  />
                                </div>
                                <span className={`text-xs font-bold ${isComplete ? 'text-green-400' : 'text-muted'}`}>
                                  {completedCount}/{totalCount}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Expand Arrow */}
                          <div className="flex items-center px-4 sm:px-5">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300"
                              style={{
                                background: isExpanded ? hexToRgba(cardColorFrom, 0.2) : 'var(--glass-fill)',
                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                              }}
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke={isExpanded ? cardColorFrom : '#94a3b8'}
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* Expanded Quest List - Shows directly below this card */}
                      <div
                        className="overflow-hidden transition-all duration-300 ease-in-out"
                        style={{
                          maxHeight: isExpanded ? '2000px' : '0px',
                          opacity: isExpanded ? 1 : 0,
                        }}
                      >
                        <div className="px-4 sm:px-5 pb-5 pt-2 border-t border-white/5">
                          {categoryQuests.length === 0 ? (
                            <div className="text-center py-8">
                              <FontAwesomeIcon icon={faCompass} className="text-3xl text-muted mb-2" />
                              <p className="text-secondary text-sm">No quests available yet</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {categoryQuests.map((quest, index) => {
                                const userQuest = getUserQuestStatus(quest.id);
                                const isQuestCompleted = userQuest?.status === 'completed';
                                const isQuestInProgress = userQuest?.status === 'in_progress';
                                const isLocked = !quest.isAvailable;
                                const config = difficultyConfig[quest.difficulty];

                                return (
                                  <button
                                    key={quest.id}
                                    onClick={() => !isLocked && handleQuestClick(quest)}
                                    disabled={isLocked}
                                    className={`
                                      w-full p-4 rounded-xl text-left transition-all duration-200 flex items-center gap-4
                                      ${isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/[0.05] hover:scale-[1.005] cursor-pointer'}
                                    `}
                                    style={{
                                      background: isQuestCompleted
                                        ? 'rgba(74, 222, 128, 0.08)'
                                        : isQuestInProgress
                                          ? hexToRgba(cardColorFrom, 0.1)
                                          : 'var(--glass-fill-subtle)',
                                      border: isQuestCompleted
                                        ? '1px solid rgba(74, 222, 128, 0.2)'
                                        : isQuestInProgress
                                          ? `1px solid ${hexToRgba(cardColorFrom, 0.25)}`
                                          : GLASS_BORDER_SUBTLE,
                                    }}
                                  >
                                    {/* Quest Number / Status */}
                                    <div
                                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold"
                                      style={{
                                        background: isQuestCompleted
                                          ? 'rgba(74, 222, 128, 0.2)'
                                          : isQuestInProgress
                                            ? hexToRgba(cardColorFrom, 0.25)
                                            : 'var(--glass-fill)',
                                      }}
                                    >
                                      {isLocked ? (
                                        <FontAwesomeIcon icon={faLock} className="text-muted" />
                                      ) : isQuestCompleted ? (
                                        <FontAwesomeIcon icon={faCheck} className="text-green-400" />
                                      ) : isQuestInProgress ? (
                                        <FontAwesomeIcon icon={faPlay} style={{ color: cardColorFrom }} />
                                      ) : (
                                        <span className="text-muted">{index + 1}</span>
                                      )}
                                    </div>

                                    {/* Quest Info */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-0.5">
                                        <h4 className={`font-medium truncate ${isQuestCompleted ? 'text-muted' : 'text-default'}`}>
                                          {quest.title}
                                        </h4>
                                        {isQuestInProgress && (
                                          <span
                                            className="text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 animate-pulse"
                                            style={{
                                              backgroundColor: hexToRgba(cardColorFrom, 0.25),
                                              color: cardColorFrom,
                                            }}
                                          >
                                            ACTIVE
                                          </span>
                                        )}
                                      </div>

                                      {/* Progress bar for in-progress */}
                                      {isQuestInProgress && userQuest ? (
                                        <div className="flex items-center gap-2 mt-1">
                                          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--glass-fill)' }}>
                                            <div
                                              className="h-full rounded-full"
                                              style={{
                                                width: `${userQuest.progressPercentage}%`,
                                                background: `linear-gradient(135deg, ${cardColorFrom}, ${cardColorTo})`,
                                              }}
                                            />
                                          </div>
                                          <span className="text-xs font-medium" style={{ color: cardColorFrom }}>{userQuest.progressPercentage}%</span>
                                        </div>
                                      ) : (
                                        <p className="text-xs text-muted truncate">
                                          {quest.description || 'Complete this quest to earn rewards'}
                                        </p>
                                      )}
                                    </div>

                                    {/* Right Side - Points & Difficulty */}
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                      <div className={`hidden sm:flex items-center gap-1 text-xs ${config.color}`}>
                                        <FontAwesomeIcon icon={config.icon} />
                                        <span>{config.label}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <FontAwesomeIcon icon={faTrophy} className="text-amber-400 text-sm" />
                                        <span className="font-bold text-amber-400">+{quest.pointsReward}</span>
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

      </div>

      {/* Overlay - must be BEFORE tray so tray renders on top */}
      {trayOpen && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={handleCloseTray} />
      )}

      {/* Quest Tray */}
      <QuestTray
        isOpen={trayOpen}
        onClose={handleCloseTray}
        quest={selectedQuest}
        userQuest={selectedUserQuest}
        onStartQuest={handleStartQuest}
        isStarting={isStartingQuest}
        onAbandon={(questId) => {
          abandonQuest(questId);
          handleCloseTray();
        }}
        isAbandoning={isAbandoningQuest}
        colors={selectedQuestColors}
        category={selectedQuestCategory}
      />
    </DashboardLayout>
  );
}
