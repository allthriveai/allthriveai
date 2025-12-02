import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCalendarCheck,
  faBolt,
  faFire,
  faTrophy,
} from '@fortawesome/free-solid-svg-icons';
import type { SideQuest } from '@/types/models';

interface DailyQuestsSectionProps {
  quests: SideQuest[];
  onStartQuest: (questId: string) => void;
  isStarting: boolean;
}

function DailyQuestCard({ quest, onStart, isStarting }: { quest: SideQuest; onStart: () => void; isStarting: boolean }) {
  const handleStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onStart();
  };

  return (
    <div
      className="group relative"
      style={{ width: 'var(--hex-size, 180px)', perspective: '1000px' }}
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
          {/* Hexagon container */}
          <div
            className="
              relative
              bg-gradient-to-br from-amber-50 to-orange-100
              dark:from-amber-900/30 dark:to-orange-900/40
              border-2 border-amber-300 dark:border-amber-700
              hover:border-amber-400 dark:hover:border-amber-500
              hover:shadow-lg hover:shadow-amber-500/20
              transition-all duration-300
              hover:scale-105
              overflow-hidden
            "
            style={{
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
              aspectRatio: '1 / 1.15',
            }}
          >
            {/* Inner content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center px-4 py-6 sm:px-5 sm:py-7 md:px-6 md:py-8 lg:px-8 lg:py-10">
              {/* Daily badge */}
              <div className="flex items-center gap-1 sm:gap-1.5 mb-1.5 sm:mb-2 md:mb-3">
                <div className="p-1 sm:p-1.5 md:p-2 bg-amber-500/20 rounded-full">
                  <FontAwesomeIcon icon={faBolt} className="text-amber-500 text-xs sm:text-sm md:text-base" />
                </div>
                <span className="text-[10px] sm:text-xs md:text-sm font-bold text-amber-600 dark:text-amber-400">
                  Daily
                </span>
              </div>

              {/* Title */}
              <h3 className="text-xs sm:text-sm md:text-base font-bold text-center mb-1.5 sm:mb-2 md:mb-3 line-clamp-2 leading-tight text-slate-800 dark:text-white">
                {quest.title}
              </h3>

              {/* Points */}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md mb-1.5 sm:mb-2">
                <FontAwesomeIcon icon={faTrophy} className="text-[8px] sm:text-[10px]" />
                +{quest.pointsReward}
              </span>

              {/* Button */}
              <button
                onClick={handleStart}
                disabled={isStarting}
                className="
                  px-3 py-1 sm:px-4 sm:py-1.5 md:px-5 md:py-2 text-[10px] sm:text-xs md:text-sm font-bold
                  bg-gradient-to-r from-amber-500 to-orange-500
                  hover:from-amber-600 hover:to-orange-600
                  text-white rounded-full
                  transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed
                  shadow-md hover:shadow-lg
                "
              >
                Start
              </button>
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
            className="
              relative
              bg-gradient-to-br from-amber-500 to-orange-500
              overflow-hidden
            "
            style={{
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
              aspectRatio: '1 / 1.15',
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
                {quest.description || 'Complete this daily challenge to keep your streak going and earn bonus points!'}
              </p>

              {/* Points on back */}
              <span className="inline-flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold bg-white/20 text-white mb-3 sm:mb-4">
                <FontAwesomeIcon icon={faTrophy} className="text-[8px] sm:text-[10px]" />
                +{quest.pointsReward} points
              </span>

              {/* Start Button on back */}
              <button
                onClick={handleStart}
                disabled={isStarting}
                className="
                  px-4 py-1.5 sm:px-5 sm:py-2 text-[10px] sm:text-xs md:text-sm font-bold rounded-full
                  bg-white text-amber-600 hover:bg-white/90 hover:shadow-lg
                  transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                {isStarting ? (
                  <span className="flex items-center gap-1">
                    <div className="inline-block animate-spin rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 border-b-2 border-amber-600" />
                  </span>
                ) : (
                  'Start Quest'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DailyQuestsSection({ quests, onStartQuest, isStarting }: DailyQuestsSectionProps) {
  if (quests.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg">
          <FontAwesomeIcon icon={faCalendarCheck} className="text-white text-lg" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-default">Daily Challenges</h2>
          <p className="text-sm text-muted">Quick tasks to keep your streak going!</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-amber-500">
          <FontAwesomeIcon icon={faFire} />
          <span className="text-sm font-medium">Resets daily</span>
        </div>
      </div>

      {/* Hexagon honeycomb grid */}
      <div className="flex flex-wrap justify-center gap-4">
        {quests.map((quest) => (
          <DailyQuestCard
            key={quest.id}
            quest={quest}
            onStart={() => onStartQuest(quest.id)}
            isStarting={isStarting}
          />
        ))}
      </div>
    </div>
  );
}
