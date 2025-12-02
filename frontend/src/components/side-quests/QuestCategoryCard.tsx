import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUsers,
  faGraduationCap,
  faPaintBrush,
  faCompass,
  faCalendarCheck,
  faStar,
  faCheck,
  faTrophy,
} from '@fortawesome/free-solid-svg-icons';
import type { QuestCategory, QuestCategoryProgress } from '@/types/models';

// Map icon names to FontAwesome icons
const iconMap: Record<string, any> = {
  faUsers,
  faGraduationCap,
  faPaintBrush,
  faCompass,
  faCalendarCheck,
  faStar,
};

// Color configurations for categories
const categoryColors: Record<string, { gradient: string; border: string; glow: string }> = {
  'community': {
    gradient: 'from-blue-500 to-cyan-500',
    border: 'border-blue-400 dark:border-blue-600',
    glow: 'shadow-blue-500/30',
  },
  'learning': {
    gradient: 'from-emerald-500 to-teal-500',
    border: 'border-emerald-400 dark:border-emerald-600',
    glow: 'shadow-emerald-500/30',
  },
  'creative': {
    gradient: 'from-pink-500 to-rose-500',
    border: 'border-pink-400 dark:border-pink-600',
    glow: 'shadow-pink-500/30',
  },
  'exploration': {
    gradient: 'from-violet-500 to-purple-500',
    border: 'border-violet-400 dark:border-violet-600',
    glow: 'shadow-violet-500/30',
  },
  'daily': {
    gradient: 'from-amber-500 to-orange-500',
    border: 'border-amber-400 dark:border-amber-600',
    glow: 'shadow-amber-500/30',
  },
  'special': {
    gradient: 'from-indigo-500 to-blue-500',
    border: 'border-indigo-400 dark:border-indigo-600',
    glow: 'shadow-indigo-500/30',
  },
};

interface QuestCategoryCardProps {
  category: QuestCategory & { progress: QuestCategoryProgress | null };
  onClick?: () => void;
}

export function QuestCategoryCard({ category, onClick }: QuestCategoryCardProps) {
  const icon = iconMap[category.icon] || faCompass;
  const progress = category.progress;
  const progressPercentage = progress?.completionPercentage || 0;
  const isComplete = progress?.isComplete || false;
  const colors = categoryColors[category.categoryType] || categoryColors['exploration'];

  const handleExplore = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onClick?.();
  };

  return (
    <div
      className="group relative"
      style={{ width: 'var(--hex-size, 260px)', perspective: '1000px' }}
    >
      {/* 3D Flip Container - flips on hover */}
      <div
        className="relative transition-transform duration-500 group-hover:[transform:rotateY(180deg)]"
        style={{
          transformStyle: 'preserve-3d',
        }}
      >
        {/* FRONT FACE */}
        <div
          className="relative"
          style={{
            backfaceVisibility: 'hidden',
          }}
        >
          {/* Large hexagon container */}
          <div
            className={`
              relative
              bg-white dark:bg-slate-800
              border-2 ${colors.border}
              hover:shadow-xl hover:${colors.glow}
              transition-all duration-300
              hover:scale-105
              overflow-hidden
            `}
            style={{
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
              aspectRatio: '1 / 1.15',
            }}
          >
            {/* Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center px-5 py-7 sm:px-6 sm:py-8 md:px-8 md:py-10">
              {/* Icon with category type */}
              <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                <div className={`p-1.5 sm:p-2 rounded-full bg-gradient-to-br ${colors.gradient}`}>
                  <FontAwesomeIcon icon={icon} className="text-sm sm:text-base text-white" />
                </div>
                <span className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 capitalize">
                  {category.categoryType}
                </span>
              </div>

              {/* Title */}
              <h3 className="text-sm sm:text-base font-bold text-center mb-2 sm:mb-3 line-clamp-2 leading-tight text-slate-800 dark:text-white">
                {category.name}
              </h3>

              {/* Quest count & bonus points */}
              <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                <span className="text-xs sm:text-sm text-muted">
                  {category.questCount} quests
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400">
                  <FontAwesomeIcon icon={faTrophy} className="text-[8px] sm:text-[10px]" />
                  +{category.completionBonusPoints}
                </span>
              </div>

              {/* Explore button */}
              <button
                onClick={handleExplore}
                className={`
                  px-4 py-1.5 sm:px-5 sm:py-2 text-xs sm:text-sm font-bold rounded-full
                  bg-gradient-to-r ${colors.gradient} text-white
                  hover:shadow-lg transition-all duration-200
                `}
              >
                Explore
              </button>

              {/* Complete badge */}
              {isComplete && (
                <div className="absolute top-6 right-6 sm:top-8 sm:right-8 p-1.5 sm:p-2 bg-green-500 rounded-full shadow-lg">
                  <FontAwesomeIcon icon={faCheck} className="text-white text-xs sm:text-sm" />
                </div>
              )}

              {/* Featured badge */}
              {category.isFeatured && (
                <div className="absolute top-6 sm:top-8 left-1/2 -translate-x-1/2">
                  <span className="px-2 py-0.5 sm:px-3 sm:py-1 bg-amber-500 text-white text-[10px] sm:text-xs font-bold rounded-full shadow-lg">
                    Featured
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BACK FACE - Description */}
        <div
          className="absolute inset-0 [pointer-events:auto]"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          <div
            className={`
              relative
              bg-gradient-to-br ${colors.gradient}
              overflow-hidden
            `}
            style={{
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
              aspectRatio: '1 / 1.15',
            }}
          >
            {/* Inner content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 py-8 sm:px-8 sm:py-10 md:px-10 md:py-12">
              {/* Title on back */}
              <h3 className="text-sm sm:text-base md:text-lg font-bold text-center mb-3 sm:mb-4 text-white">
                {category.name}
              </h3>

              {/* Description */}
              <p className="text-[10px] sm:text-xs md:text-sm text-white/90 text-center leading-relaxed line-clamp-4 mb-3 sm:mb-4">
                {category.description || `Complete all ${category.questCount} quests in this pathway to earn bonus points and master new skills!`}
              </p>

              {/* Progress on back */}
              {progress && (
                <div className="w-full px-4 mb-3 sm:mb-4">
                  <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full transition-all duration-500"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                  <p className="text-[10px] sm:text-xs text-white/80 text-center mt-1">
                    {progress.completedQuests}/{progress.totalQuests} completed
                  </p>
                </div>
              )}

              {/* Bonus points on back */}
              <span className="inline-flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold bg-white/20 text-white mb-3 sm:mb-4">
                <FontAwesomeIcon icon={faTrophy} className="text-[8px] sm:text-[10px]" />
                +{category.completionBonusPoints} bonus points
              </span>

              {/* Explore Button on back */}
              <button
                onClick={handleExplore}
                className="
                  px-4 py-1.5 sm:px-5 sm:py-2 text-xs sm:text-sm font-bold rounded-full
                  bg-white text-slate-800 hover:bg-white/90 hover:shadow-lg
                  transition-all duration-200
                "
              >
                Explore Pathway
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
