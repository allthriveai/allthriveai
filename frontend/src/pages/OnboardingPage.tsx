/**
 * Ember's Quest Board
 *
 * A gamified quest board where Ember the dragon guides users through
 * discovering all the features of AllThrive. Quests are grouped by
 * category and displayed in a grid layout.
 */

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { useOnboardingProgress, type QuestItem } from '@/hooks/useOnboardingProgress';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faDragon,
  faUser,
  faWandSparkles,
  faGraduationCap,
  faFolderPlus,
  faHeart,
  faComment,
  faUserPlus,
  faBolt,
  faPuzzlePiece,
  faLink,
  faGift,
  faWrench,
  faCompass,
  faRocket,
  faUsers,
  faFire,
  faTrophy,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import { CheckCircleIcon, SparklesIcon } from '@heroicons/react/24/solid';

// Map quest icon strings to FontAwesome icons
const iconMap: Record<string, typeof faUser> = {
  'user': faUser,
  'sparkles': faWandSparkles,
  'academic-cap': faGraduationCap,
  'folder-plus': faFolderPlus,
  'heart': faHeart,
  'chat-bubble': faComment,
  'user-plus': faUserPlus,
  'bolt': faBolt,
  'puzzle-piece': faPuzzlePiece,
  'link': faLink,
  'gift': faGift,
  'wrench': faWrench,
  'compass': faCompass,
  'rocket': faRocket,
  'users': faUsers,
};

// Category colors
const categoryColors: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
  getting_started: {
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    text: 'text-cyan-400',
    iconBg: 'bg-cyan-500/20',
  },
  create: {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    text: 'text-orange-400',
    iconBg: 'bg-orange-500/20',
  },
  engage: {
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/30',
    text: 'text-pink-400',
    iconBg: 'bg-pink-500/20',
  },
  play: {
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
    text: 'text-violet-400',
    iconBg: 'bg-violet-500/20',
  },
  connect: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    iconBg: 'bg-amber-500/20',
  },
  explore: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    iconBg: 'bg-blue-500/20',
  },
};

// Ember's messages based on progress
function getEmberMessage(progressPercent: number, completedCount: number): string {
  if (completedCount === 0) {
    return "Welcome, adventurer! I'm Ember, your guide to AllThrive. Let's start your journey!";
  }
  if (progressPercent < 25) {
    return "Great start! Every quest you complete makes you stronger. Keep going!";
  }
  if (progressPercent < 50) {
    return "You're on fire! 🔥 Half way there - I knew you had it in you!";
  }
  if (progressPercent < 75) {
    return "Impressive progress! You're becoming a true AllThrive champion!";
  }
  if (progressPercent < 100) {
    return "Almost there! Just a few more quests to complete your adventure!";
  }
  return "🎉 Legendary! You've completed all quests! You're a true AllThrive master!";
}

function QuestCard({ quest }: { quest: QuestItem }) {
  const colors = categoryColors[quest.category] || categoryColors.getting_started;
  const Icon = iconMap[quest.icon] || faWandSparkles;

  return (
    <Link to={quest.link}>
      <motion.div
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        className={`
          relative p-3 sm:p-4 rounded-xl border transition-all duration-200 group
          ${quest.completed
            ? 'bg-slate-800/30 border-slate-700/50 opacity-75'
            : `${colors.bg} ${colors.border} hover:shadow-lg`
          }
        `}
      >
        <div className="flex items-start gap-2 sm:gap-3">
          {/* Icon */}
          <div
            className={`
              w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0
              ${quest.completed ? 'bg-emerald-500/20' : colors.iconBg}
            `}
          >
            {quest.completed ? (
              <CheckCircleIcon className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
            ) : (
              <FontAwesomeIcon icon={Icon} className={`text-xs sm:text-sm ${colors.text}`} />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 sm:gap-2">
              <h3
                className={`font-medium text-xs sm:text-sm ${
                  quest.completed ? 'text-slate-500 line-through' : 'text-white'
                }`}
              >
                {quest.title}
              </h3>
              <span
                className={`text-[10px] sm:text-xs font-medium px-1.5 sm:px-2 py-0.5 rounded-full flex-shrink-0 ${
                  quest.completed
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : `${colors.bg} ${colors.text}`
                }`}
              >
                +{quest.points}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1 line-clamp-1">{quest.description}</p>
          </div>

          {/* Arrow */}
          {!quest.completed && (
            <FontAwesomeIcon
              icon={faChevronRight}
              className="text-slate-600 group-hover:text-white group-hover:translate-x-1 transition-all flex-shrink-0 text-xs mt-2 sm:mt-3"
            />
          )}
        </div>
      </motion.div>
    </Link>
  );
}

export default function OnboardingPage() {
  const { progress, isLoading, error } = useOnboardingProgress();

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400">Loading your quests...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !progress) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <FontAwesomeIcon icon={faDragon} className="text-4xl text-cyan-500 mb-4" />
            <p className="text-rose-400 mb-4">{error || 'Something went wrong'}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-orange-400 hover:underline"
            >
              Try again
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const isComplete = progress.progressPercentage === 100;
  const emberMessage = getEmberMessage(progress.progressPercentage, progress.completedCount);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Header with Ember */}
        <div className="mb-6 sm:mb-8">
          {/* Mobile: Stack vertically, Desktop: Row layout */}
          <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 mb-4 sm:mb-6">
            {/* Top row on mobile: Ember + Title */}
            <div className="flex items-center sm:items-start gap-3 sm:gap-4">
              {/* Ember */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.1 }}
                className="flex-shrink-0"
              >
                <FontAwesomeIcon
                  icon={faDragon}
                  className="text-4xl sm:text-5xl text-orange-500 drop-shadow-[0_0_12px_rgba(0,0,0,0.8)]"
                />
              </motion.div>

              <div className="flex-1 min-w-0">
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-0.5 sm:mb-1">
                    Ember's Quest Board
                  </h1>
                  <p className="text-slate-300 text-xs sm:text-sm line-clamp-2 sm:line-clamp-none">
                    {emberMessage}
                  </p>
                </motion.div>
              </div>
            </div>

            {/* Points Badge - Full width on mobile, auto on desktop */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="flex items-center justify-between sm:justify-start gap-2 px-3 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/30 sm:flex-shrink-0"
            >
              <FontAwesomeIcon icon={faFire} className="text-orange-400" />
              <div className="text-right">
                <p className="text-xs text-slate-400">Points Earned</p>
                <p className="text-base sm:text-lg font-bold text-orange-400">
                  {progress.earnedPoints}
                  <span className="text-slate-500 text-xs sm:text-sm font-normal"> / {progress.totalPoints}</span>
                </p>
              </div>
            </motion.div>
          </div>

          {/* Progress Bar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-panel p-3 sm:p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm text-slate-400">
                {progress.completedCount} of {progress.totalCount} quests completed
              </span>
              <span className="text-xs sm:text-sm font-medium text-orange-400">
                {progress.progressPercentage}%
              </span>
            </div>
            <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress.progressPercentage}%` }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full"
              />
            </div>
          </motion.div>
        </div>

        {/* Quest Grid by Category */}
        <div className="space-y-6 sm:space-y-8">
          {Object.entries(progress.categories).map(([categoryKey, category], catIndex) => {
            if (category.items.length === 0) return null;

            const colors = categoryColors[categoryKey] || categoryColors.getting_started;
            const categoryIcon = iconMap[category.icon] || faRocket;
            const completedInCategory = category.items.filter(i => i.completed).length;

            return (
              <motion.div
                key={categoryKey}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + catIndex * 0.1 }}
              >
                {/* Category Header */}
                <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${colors.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <FontAwesomeIcon icon={categoryIcon} className={`text-xs sm:text-sm ${colors.text}`} />
                  </div>
                  <h2 className="text-base sm:text-lg font-semibold text-white truncate">{category.title}</h2>
                  <span className="text-xs text-slate-500 flex-shrink-0">
                    {completedInCategory}/{category.items.length}
                  </span>
                  <div className="flex-1 h-px bg-slate-700/50 hidden sm:block" />
                </div>

                {/* Quest Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                  {category.items.map((quest) => (
                    <QuestCard key={quest.id} quest={quest} />
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Completion Celebration */}
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 sm:mt-12 text-center"
          >
            <div className="inline-flex flex-col sm:flex-row items-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 rounded-2xl bg-gradient-to-r from-orange-500/20 via-amber-500/20 to-yellow-500/20 border border-orange-500/30">
              <FontAwesomeIcon icon={faTrophy} className="text-2xl sm:text-3xl text-amber-400" />
              <div className="text-center sm:text-left">
                <p className="text-white font-semibold text-sm sm:text-base">Quest Master Achievement Unlocked!</p>
                <p className="text-xs sm:text-sm text-slate-300">You've completed all of Ember's quests</p>
              </div>
              <SparklesIcon className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 hidden sm:block" />
            </div>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}
