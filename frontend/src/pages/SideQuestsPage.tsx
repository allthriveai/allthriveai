import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSideQuests } from '@/hooks/useSideQuests';
import { useQuestCategories } from '@/hooks/useQuestCategories';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { DailyQuestsSection } from '@/components/side-quests/DailyQuestsSection';
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
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import type { QuestCategory, QuestCategoryProgress, SideQuest, UserSideQuest } from '@/types/models';
import { DEFAULT_QUEST_COLORS } from '@/utils/colors';

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
    dailyQuests,
    isLoading: isLoadingCategories,
    isLoadingDaily,
  } = useQuestCategories();

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<(QuestCategory & { progress: QuestCategoryProgress | null }) | null>(null);

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
      const quest = availableQuests.find(q => q.id === questId) || dailyQuests.find(q => q.id === questId);

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

  // Handle daily quest start
  const handleDailyQuestStart = async (questId: string) => {
    try {
      const result = await startQuestAsync(questId);
      const quest = dailyQuests.find(q => q.id === questId);

      if (result && quest) {
        setSelectedQuest(null);
        setSelectedUserQuest(result as UserSideQuest);
        setTrayOpen(true);
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
            <p className="text-muted">Log in to discover and complete optional challenges for bonus XP</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const mainCategories = categories.filter(c => c.categoryType !== 'daily');
  const inProgressQuests = myQuests.filter(q => q.status === 'in_progress');
  const getQuestsForCategory = (categorySlug: string) => availableQuests.filter(q => q.categorySlug === categorySlug);

  // Helper to convert hex to rgba
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Expanded Category View - Game Detail Page
  if (selectedCategory) {
    const categoryQuests = getQuestsForCategory(selectedCategory.slug);
    const completedCount = selectedCategory.progress?.completedQuests || 0;
    const totalCount = selectedCategory.progress?.totalQuests || categoryQuests.length;
    const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
    const totalXP = categoryQuests.reduce((sum, q) => sum + q.pointsReward, 0);
    const earnedXP = categoryQuests.reduce((sum, q) => {
      const uq = getUserQuestStatus(q.id);
      return sum + (uq?.status === 'completed' ? q.pointsReward : 0);
    }, 0);

    // Category colors
    const catColorFrom = selectedCategory.colorFrom || DEFAULT_QUEST_COLORS.colorFrom;
    const catColorTo = selectedCategory.colorTo || DEFAULT_QUEST_COLORS.colorTo;

    return (
      <DashboardLayout>
        <div className="h-full overflow-y-auto" style={{ background: 'var(--bg-primary)' }}>
          {/* Hero Section - Game Cover */}
          <div className="relative">
            {/* Back Button - Floating */}
            <button
              onClick={() => setSelectedCategory(null)}
              className="absolute top-4 left-4 z-30 p-3 rounded-full transition-all hover:scale-110"
              style={{
                background: 'rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <FontAwesomeIcon icon={faArrowLeft} className="text-white" />
            </button>

            {/* Hero Background with Gradient Overlay */}
            <div
              className="h-64 sm:h-80 relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${hexToRgba(catColorFrom, 0.3)} 0%, ${hexToRgba(catColorTo, 0.2)} 50%, rgba(2, 6, 23, 0.9) 100%)`,
              }}
            >
              {/* Large Icon */}
              <div className="absolute inset-0 flex items-center justify-center opacity-30">
                <FontAwesomeIcon
                  icon={getCategoryIcon(selectedCategory.icon)}
                  className="text-[120px] sm:text-[150px]"
                  style={{ color: catColorFrom }}
                />
              </div>

              {/* Gradient Overlay */}
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(to bottom, transparent 0%, rgba(2, 6, 23, 0.8) 70%, rgba(2, 6, 23, 1) 100%)',
                }}
              />
            </div>

            {/* Game Info Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
              <div className="max-w-4xl mx-auto">
                {/* Category Badge */}
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                    style={{
                      background: `linear-gradient(135deg, ${hexToRgba(catColorFrom, 0.3)}, ${hexToRgba(catColorTo, 0.2)})`,
                      border: `1px solid ${hexToRgba(catColorFrom, 0.4)}`,
                      color: catColorFrom,
                    }}
                  >
                    Quest Path
                  </span>
                  {progressPercent === 100 && (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30">
                      COMPLETED
                    </span>
                  )}
                </div>

                {/* Title */}
                <h1
                  className="text-3xl sm:text-4xl font-black mb-3"
                  style={{
                    background: `linear-gradient(135deg, ${catColorFrom}, ${catColorTo})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {selectedCategory.name}
                </h1>

                {/* Description */}
                <p className="text-slate-300 text-lg mb-6 max-w-2xl">
                  {selectedCategory.description}
                </p>

                {/* Stats Row */}
                <div className="flex flex-wrap items-center gap-6">
                  {/* Quest Count */}
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faScroll} style={{ color: catColorFrom }} />
                    <span className="text-white font-medium">{totalCount} Quests</span>
                  </div>

                  {/* XP Available */}
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faTrophy} className="text-amber-400" />
                    <span className="text-white font-medium">{earnedXP}/{totalXP} XP</span>
                  </div>

                  {/* Progress */}
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-2 bg-slate-700/50 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${progressPercent}%`,
                          background: `linear-gradient(135deg, ${catColorFrom}, ${catColorTo})`,
                        }}
                      />
                    </div>
                    <span style={{ color: catColorFrom }} className="font-bold">{Math.round(progressPercent)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quests Section */}
          <div className="max-w-4xl mx-auto px-6 py-8">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
              <FontAwesomeIcon icon={faGamepad} style={{ color: catColorFrom }} />
              Available Quests
            </h2>

            {categoryQuests.length === 0 ? (
              <div
                className="text-center py-16 rounded-2xl"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <FontAwesomeIcon icon={faCompass} className="text-5xl text-slate-600 mb-4" />
                <p className="text-slate-500 text-lg">No quests available yet</p>
                <p className="text-slate-600 text-sm mt-2">Check back soon for new adventures!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {categoryQuests.map((quest, index) => {
                  const userQuest = getUserQuestStatus(quest.id);
                  const isCompleted = userQuest?.status === 'completed';
                  const isInProgress = userQuest?.status === 'in_progress';
                  const isLocked = !quest.isAvailable;
                  const config = difficultyConfig[quest.difficulty];

                  return (
                    <button
                      key={quest.id}
                      onClick={() => !isLocked && handleQuestClick(quest)}
                      disabled={isLocked}
                      className={`
                        w-full p-4 sm:p-5 rounded-xl text-left transition-all duration-200 flex items-center gap-4
                        ${isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.01] hover:shadow-lg cursor-pointer'}
                      `}
                      style={{
                        background: isCompleted
                          ? 'linear-gradient(135deg, rgba(74, 222, 128, 0.12), rgba(74, 222, 128, 0.04))'
                          : isInProgress
                            ? `linear-gradient(135deg, ${hexToRgba(catColorFrom, 0.12)}, ${hexToRgba(catColorFrom, 0.04)})`
                            : 'rgba(255, 255, 255, 0.03)',
                        border: isCompleted
                          ? '1px solid rgba(74, 222, 128, 0.25)'
                          : isInProgress
                            ? `1px solid ${hexToRgba(catColorFrom, 0.25)}`
                            : '1px solid rgba(255, 255, 255, 0.06)',
                      }}
                    >
                      {/* Quest Number / Status Icon */}
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-lg font-bold"
                        style={{
                          background: isCompleted
                            ? 'linear-gradient(135deg, rgba(74, 222, 128, 0.3), rgba(74, 222, 128, 0.1))'
                            : isInProgress
                              ? `linear-gradient(135deg, ${hexToRgba(catColorFrom, 0.3)}, ${hexToRgba(catColorFrom, 0.1)})`
                              : 'rgba(255, 255, 255, 0.05)',
                        }}
                      >
                        {isLocked ? (
                          <FontAwesomeIcon icon={faLock} className="text-slate-500" />
                        ) : isCompleted ? (
                          <FontAwesomeIcon icon={faCheck} className="text-green-400" />
                        ) : isInProgress ? (
                          <FontAwesomeIcon icon={faPlay} style={{ color: catColorFrom }} />
                        ) : (
                          <span className="text-slate-400">{index + 1}</span>
                        )}
                      </div>

                      {/* Quest Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`font-semibold truncate ${isCompleted ? 'text-slate-400' : 'text-white'}`}>
                            {quest.title}
                          </h3>
                          {isInProgress && (
                            <span
                              className="text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                              style={{
                                backgroundColor: hexToRgba(catColorFrom, 0.2),
                                color: catColorFrom,
                              }}
                            >
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 truncate">
                          {quest.description || 'Complete this quest to earn rewards'}
                        </p>

                        {/* Progress bar for in-progress */}
                        {isInProgress && userQuest && (
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${userQuest.progressPercentage}%`,
                                  background: `linear-gradient(135deg, ${catColorFrom}, ${catColorTo})`,
                                }}
                              />
                            </div>
                            <span className="text-xs" style={{ color: catColorFrom }}>{userQuest.progressPercentage}%</span>
                          </div>
                        )}
                      </div>

                      {/* Right Side - XP & Difficulty */}
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <div className="flex items-center gap-1.5">
                          <FontAwesomeIcon icon={faTrophy} className="text-amber-400 text-sm" />
                          <span className="font-bold text-amber-400">+{quest.pointsReward}</span>
                        </div>
                        <div className={`flex items-center gap-1 text-xs ${config.color}`}>
                          <FontAwesomeIcon icon={config.icon} className="text-xs" />
                          <span>{config.label}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
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

  // Main Grid View - Game Library
  return (
    <DashboardLayout>
      <div className="h-full overflow-y-auto" style={{ background: 'var(--bg-primary)' }}>
        {/* Hero Header */}
        <div
          className="relative py-8 px-6 mb-6"
          style={{
            background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.1) 0%, rgba(74, 222, 128, 0.05) 50%, transparent 100%)',
          }}
        >
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-4 mb-2">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.3), rgba(74, 222, 128, 0.2))',
                }}
              >
                <FontAwesomeIcon icon={faGamepad} className="text-xl text-cyan-400" />
              </div>
              <div>
                <h1
                  className="text-2xl sm:text-3xl font-black"
                  style={{
                    background: 'linear-gradient(135deg, #22d3ee, #4ade80)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  Quest Library
                </h1>
                <p className="text-slate-400 text-sm">Choose your adventure and earn XP</p>
              </div>
            </div>

            {/* Success notification */}
            {successMessage && (
              <div
                className="mt-4 p-3 rounded-lg flex items-center justify-between"
                style={{
                  background: 'rgba(74, 222, 128, 0.1)',
                  border: '1px solid rgba(74, 222, 128, 0.3)',
                }}
              >
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faCheckCircle} className="text-green-400" />
                  <p className="text-green-300 text-sm">{successMessage}</p>
                </div>
                <button onClick={() => setSuccessMessage(null)} className="text-green-400 hover:text-green-300">
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 pb-8 space-y-10">
          {/* Daily Quests */}
          {!isLoadingDaily && dailyQuests.length > 0 && (
            <DailyQuestsSection
              quests={dailyQuests}
              onStartQuest={handleDailyQuestStart}
              isStarting={isStartingQuest}
            />
          )}

          {/* Continue Playing - Active Quests */}
          {inProgressQuests.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <FontAwesomeIcon icon={faPlay} className="text-cyan-400" />
                <h2 className="text-lg font-bold text-white">Continue Playing</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {inProgressQuests.map((userQuest) => {
                  // Get category colors for this quest
                  const { colors: questColors } = getQuestCategoryInfo(null, userQuest);
                  const colorFrom = questColors?.colorFrom || DEFAULT_QUEST_COLORS.colorFrom;
                  const colorTo = questColors?.colorTo || DEFAULT_QUEST_COLORS.colorTo;

                  return (
                    <div
                      key={userQuest.id}
                      className="group relative overflow-hidden rounded-xl text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-xl cursor-pointer"
                      style={{
                        background: `linear-gradient(135deg, ${hexToRgba(colorFrom, 0.15)}, ${hexToRgba(colorTo, 0.05)})`,
                        border: `1px solid ${hexToRgba(colorFrom, 0.3)}`,
                      }}
                      onClick={() => {
                        setSelectedQuest(null);
                        setSelectedUserQuest(userQuest);
                        setTrayOpen(true);
                      }}
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

                      <div className="relative p-5">
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

                        <h4 className="font-bold text-white mb-1 truncate">{userQuest.sideQuest.title}</h4>
                        <p className="text-xs text-slate-400 truncate mb-3">
                          {userQuest.sideQuest.categorySlug?.replace(/-/g, ' ')}
                        </p>

                        {/* Progress */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-700/50 rounded-full overflow-hidden">
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
            <div className="flex items-center gap-3 mb-6">
              <FontAwesomeIcon icon={faCompass} className="text-cyan-400" />
              <h2 className="text-lg font-bold text-white">Quest Paths</h2>
            </div>

            {isLoadingCategories || isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400" />
              </div>
            ) : mainCategories.length === 0 ? (
              <div
                className="text-center py-16 rounded-2xl"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <FontAwesomeIcon icon={faCompass} className="text-5xl text-slate-600 mb-4" />
                <p className="text-slate-500 text-lg">No quest paths available yet</p>
                <p className="text-slate-600 text-sm mt-2">New adventures coming soon!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {mainCategories.map((category) => {
                  const categoryQuests = getQuestsForCategory(category.slug);
                  const completedCount = category.progress?.completedQuests || 0;
                  const totalCount = category.progress?.totalQuests || categoryQuests.length;
                  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
                  const totalXP = categoryQuests.reduce((sum, q) => sum + q.pointsReward, 0);
                  const isComplete = progressPercent === 100;

                  // Category colors
                  const cardColorFrom = category.colorFrom || DEFAULT_QUEST_COLORS.colorFrom;
                  const cardColorTo = category.colorTo || DEFAULT_QUEST_COLORS.colorTo;

                  return (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category)}
                      className="group relative overflow-hidden rounded-2xl text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
                      style={{
                        background: isComplete
                          ? 'linear-gradient(145deg, rgba(74, 222, 128, 0.15), rgba(74, 222, 128, 0.05))'
                          : 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))',
                        border: isComplete
                          ? '1px solid rgba(74, 222, 128, 0.3)'
                          : '1px solid rgba(255, 255, 255, 0.1)',
                      }}
                    >
                      {/* Game Cover Art Area */}
                      <div
                        className="h-32 relative overflow-hidden"
                        style={{
                          background: `linear-gradient(135deg, ${hexToRgba(cardColorFrom, 0.2)} 0%, ${hexToRgba(cardColorTo, 0.15)} 50%, rgba(2, 6, 23, 0.8) 100%)`,
                        }}
                      >
                        {/* Large Icon as Cover Art */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <FontAwesomeIcon
                            icon={getCategoryIcon(category.icon)}
                            className="text-6xl opacity-60 group-hover:scale-110 transition-transform duration-300"
                            style={{ color: cardColorFrom }}
                          />
                        </div>

                        {/* Hover Glow */}
                        <div
                          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                          style={{
                            background: `radial-gradient(circle at center, ${hexToRgba(cardColorFrom, 0.3)}, transparent 70%)`,
                          }}
                        />

                        {/* Gradient Overlay */}
                        <div
                          className="absolute inset-0"
                          style={{
                            background: 'linear-gradient(to bottom, transparent 40%, rgba(2, 6, 23, 1) 100%)',
                          }}
                        />

                        {/* Complete Badge */}
                        {isComplete && (
                          <div className="absolute top-3 right-3">
                            <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-green-500/30 text-green-400 border border-green-500/50">
                              ✓ COMPLETE
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Game Info */}
                      <div className="p-4">
                        {/* Title */}
                        <h3
                          className="font-bold text-white text-lg mb-1 transition-colors"
                          style={{ ['--hover-color' as string]: cardColorFrom }}
                        >
                          <span className="group-hover:hidden">{category.name}</span>
                          <span className="hidden group-hover:inline" style={{ color: cardColorFrom }}>{category.name}</span>
                        </h3>

                        {/* Description */}
                        <p className="text-sm text-slate-400 line-clamp-2 mb-4 min-h-[2.5rem]">
                          {category.description}
                        </p>

                        {/* Stats Row */}
                        <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                          <div className="flex items-center gap-1">
                            <FontAwesomeIcon icon={faScroll} className="text-slate-400" />
                            <span>{totalCount} Quests</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <FontAwesomeIcon icon={faTrophy} className="text-amber-400" />
                            <span className="text-amber-400 font-medium">{totalXP} XP</span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-slate-700/50 rounded-full overflow-hidden">
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
                          <span className={`text-sm font-bold ${isComplete ? 'text-green-400' : 'text-slate-400'}`}>
                            {completedCount}/{totalCount}
                          </span>
                        </div>
                      </div>
                    </button>
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
