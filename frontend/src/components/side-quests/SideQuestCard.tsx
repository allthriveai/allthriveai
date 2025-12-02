import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFire,
  faStar,
  faBolt,
  faTrophy,
  faRepeat,
  faCalendarDay,
} from '@fortawesome/free-solid-svg-icons';
import type { SideQuest } from '@/types/models';

interface SideQuestCardProps {
  quest: SideQuest;
  onStart: () => void;
  isStarting: boolean;
}

const difficultyConfig = {
  easy: {
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    gradient: 'from-emerald-400 to-teal-500',
    shadowColor: 'rgba(16, 185, 129, 0.4)',
    icon: faStar,
  },
  medium: {
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    gradient: 'from-amber-400 to-orange-500',
    shadowColor: 'rgba(245, 158, 11, 0.4)',
    icon: faBolt,
  },
  hard: {
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-100 dark:bg-rose-900/30',
    gradient: 'from-rose-400 to-red-500',
    shadowColor: 'rgba(244, 63, 94, 0.4)',
    icon: faFire,
  },
  epic: {
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-100 dark:bg-violet-900/30',
    gradient: 'from-violet-400 to-purple-600',
    shadowColor: 'rgba(139, 92, 246, 0.4)',
    icon: faTrophy,
  },
};

export function SideQuestCard({ quest, onStart, isStarting }: SideQuestCardProps) {
  const config = difficultyConfig[quest.difficulty];

  const handleAccept = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onStart();
  };

  return (
    <div
      className="group relative"
      style={{ perspective: '1000px' }}
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
          {/* Hexagon shadow/depth layer (bottom) */}
          <div
            className="absolute inset-0 opacity-60"
            style={{
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
              background: `linear-gradient(135deg, ${config.shadowColor}, transparent)`,
              transform: 'translateZ(-10px) translateY(8px)',
              filter: 'blur(4px)',
            }}
          />

          {/* Main hexagon face */}
          <div
            className={`
              relative
              bg-white dark:bg-slate-800
              transition-all duration-300
              group-hover:shadow-2xl
              overflow-hidden
            `}
            style={{
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
              aspectRatio: '1 / 1.15',
              boxShadow: `0 4px 20px ${config.shadowColor}`,
            }}
          >
            {/* Gradient border effect */}
            <div
              className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-20`}
              style={{
                clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
              }}
            />

            {/* Top edge highlight (3D effect) */}
            <div
              className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-white/40 to-transparent dark:from-white/10"
              style={{
                clipPath: 'polygon(50% 0%, 100% 25%, 0% 25%)',
              }}
            />

            {/* Inner content - with extra padding to stay within hexagon bounds */}
            <div className="absolute inset-0 flex flex-col items-center justify-center px-4 py-6 sm:px-5 sm:py-7 md:px-6 md:py-8 lg:px-8 lg:py-10">
              {/* Difficulty badge at top */}
              <div className="flex items-center gap-1 sm:gap-1.5 mb-1.5 sm:mb-2 md:mb-3">
                <div
                  className={`p-1 sm:p-1.5 md:p-2 rounded-full ${config.bgColor}`}
                  style={{
                    boxShadow: `0 2px 8px ${config.shadowColor}`,
                  }}
                >
                  <FontAwesomeIcon icon={config.icon} className={`text-xs sm:text-sm md:text-base ${config.color}`} />
                </div>
                <span className={`text-[10px] sm:text-xs md:text-sm font-bold ${config.color}`}>
                  {quest.difficultyDisplay}
                </span>
              </div>

              {/* Title */}
              <h3 className="text-xs sm:text-sm md:text-base font-bold text-center mb-1.5 sm:mb-2 md:mb-3 line-clamp-2 leading-tight text-slate-800 dark:text-white">
                {quest.title}
              </h3>

              {/* Points badge */}
              <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3 md:mb-4">
                <span
                  className={`
                    inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold
                    bg-gradient-to-r ${config.gradient} text-white shadow-md
                  `}
                >
                  <FontAwesomeIcon icon={faTrophy} className="text-[8px] sm:text-[10px]" />
                  +{quest.pointsReward}
                </span>
                {quest.isDaily && (
                  <span className="inline-flex items-center px-1.5 py-0.5 sm:px-2 sm:py-1 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full text-[8px] sm:text-[10px] font-semibold">
                    <FontAwesomeIcon icon={faCalendarDay} className="text-[7px] sm:text-[9px]" />
                  </span>
                )}
                {quest.isRepeatable && !quest.isDaily && (
                  <span className="inline-flex items-center px-1.5 py-0.5 sm:px-2 sm:py-1 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full text-[8px] sm:text-[10px] font-semibold">
                    <FontAwesomeIcon icon={faRepeat} className="text-[7px] sm:text-[9px]" />
                  </span>
                )}
              </div>

              {/* Action Button */}
              <button
                onClick={handleAccept}
                disabled={isStarting || !quest.isAvailable}
                className={`
                  px-3 py-1 sm:px-4 sm:py-1.5 md:px-5 md:py-2 text-[10px] sm:text-xs md:text-sm font-bold rounded-full
                  transition-all duration-200
                  ${quest.isAvailable
                    ? `bg-gradient-to-r ${config.gradient} hover:shadow-lg text-white`
                    : 'bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                  }
                  disabled:opacity-50
                `}
                style={{
                  boxShadow: quest.isAvailable ? `0 2px 8px ${config.shadowColor}` : 'none',
                }}
              >
                {isStarting ? (
                  <span className="flex items-center gap-1">
                    <div className="inline-block animate-spin rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 border-b-2 border-white" />
                  </span>
                ) : quest.isAvailable ? (
                  'Accept'
                ) : (
                  'Locked'
                )}
              </button>
            </div>

            {/* Side edge effects (3D depth) */}
            <div
              className={`absolute top-1/4 right-0 w-1 h-1/2 bg-gradient-to-b ${config.gradient} opacity-30`}
            />
            <div
              className={`absolute top-1/4 left-0 w-1 h-1/2 bg-gradient-to-b ${config.gradient} opacity-20`}
            />
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
          {/* Main hexagon face */}
          <div
            className={`
              relative
              bg-gradient-to-br ${config.gradient}
              overflow-hidden
            `}
            style={{
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
              aspectRatio: '1 / 1.15',
              boxShadow: `0 4px 20px ${config.shadowColor}`,
            }}
          >
            {/* Inner content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center px-5 py-8 sm:px-6 sm:py-10 md:px-8 md:py-12">
              {/* Title on back */}
              <h3 className="text-xs sm:text-sm md:text-base font-bold text-center mb-3 sm:mb-4 text-white">
                {quest.title}
              </h3>

              {/* Description */}
              <p className="text-[10px] sm:text-xs md:text-sm text-white/90 text-center leading-relaxed line-clamp-4 mb-3 sm:mb-4">
                {quest.description || 'Complete this quest to earn bonus points and unlock new achievements!'}
              </p>

              {/* Points on back */}
              <span className="inline-flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold bg-white/20 text-white mb-3 sm:mb-4">
                <FontAwesomeIcon icon={faTrophy} className="text-[8px] sm:text-[10px]" />
                +{quest.pointsReward} points
              </span>

              {/* Accept Button on back */}
              <button
                onClick={handleAccept}
                disabled={isStarting || !quest.isAvailable}
                className={`
                  px-4 py-1.5 sm:px-5 sm:py-2 text-[10px] sm:text-xs md:text-sm font-bold rounded-full
                  transition-all duration-200
                  ${quest.isAvailable
                    ? 'bg-white text-slate-800 hover:bg-white/90 hover:shadow-lg'
                    : 'bg-white/30 text-white/60 cursor-not-allowed'
                  }
                  disabled:opacity-50
                `}
              >
                {isStarting ? (
                  <span className="flex items-center gap-1">
                    <div className="inline-block animate-spin rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 border-b-2 border-slate-800" />
                  </span>
                ) : quest.isAvailable ? (
                  'Accept Quest'
                ) : (
                  'Locked'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
