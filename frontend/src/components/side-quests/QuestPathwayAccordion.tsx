import { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon, LockClosedIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFire,
  faStar,
  faBolt,
  faTrophy,
  faPlay,
  faCheck,
} from '@fortawesome/free-solid-svg-icons';
import type { QuestCategory, QuestCategoryProgress, SideQuest, UserSideQuest } from '@/types/models';

interface QuestPathwayAccordionProps {
  category: QuestCategory & { progress: QuestCategoryProgress | null };
  quests: SideQuest[];
  userQuests: UserSideQuest[];
  onQuestClick: (quest: SideQuest, userQuest?: UserSideQuest) => void;
  defaultOpen?: boolean;
}

const difficultyConfig = {
  easy: {
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    icon: faStar,
  },
  medium: {
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    icon: faBolt,
  },
  hard: {
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/20',
    icon: faFire,
  },
  epic: {
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/20',
    icon: faTrophy,
  },
};

export function QuestPathwayAccordion({
  category,
  quests,
  userQuests,
  onQuestClick,
  defaultOpen = false,
}: QuestPathwayAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Get user quest status for a quest
  const getUserQuestStatus = (questId: string) => {
    return userQuests.find(uq => uq.sideQuest.id === questId);
  };

  // Calculate pathway progress
  const completedCount = category.progress?.completedQuests || 0;
  const totalCount = category.progress?.totalQuests || quests.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Determine if a quest is locked (for now, simple logic - can be enhanced with prerequisites)
  const isQuestLocked = (quest: SideQuest, index: number) => {
    // First quest is always unlocked
    if (index === 0) return false;
    // If quest has specific unlock requirements, check those
    if (!quest.isAvailable) return true;
    // For pathway progression: unlock if previous quest is completed
    // This is a simplified version - could be enhanced with actual prerequisite data
    return false;
  };

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-300"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      {/* Accordion Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          {/* Expand/Collapse Icon */}
          <div className="w-6 h-6 flex items-center justify-center">
            {isOpen ? (
              <ChevronDownIcon className="w-5 h-5 text-cyan-400" />
            ) : (
              <ChevronRightIcon className="w-5 h-5 text-slate-400" />
            )}
          </div>

          {/* Category Icon */}
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
            style={{
              background: isOpen
                ? 'linear-gradient(135deg, rgba(34, 211, 238, 0.2), rgba(74, 222, 128, 0.2))'
                : 'rgba(255, 255, 255, 0.08)',
            }}
          >
            {category.icon || '🎯'}
          </div>

          {/* Category Info */}
          <div className="text-left">
            <h3 className="font-semibold text-white">{category.name}</h3>
            <p className="text-xs text-slate-400">
              {completedCount}/{totalCount} quests completed
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center gap-3">
          <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPercent}%`,
                background: 'linear-gradient(135deg, #22d3ee, #4ade80)',
              }}
            />
          </div>
          <span className="text-sm text-slate-400 w-10 text-right">
            {Math.round(progressPercent)}%
          </span>
        </div>
      </button>

      {/* Accordion Content */}
      {isOpen && (
        <div className="px-4 pb-4 space-y-2">
          {quests.length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">
              No quests in this pathway yet
            </p>
          ) : (
            quests.map((quest, index) => {
              const userQuest = getUserQuestStatus(quest.id);
              const isLocked = isQuestLocked(quest, index);
              const isCompleted = userQuest?.status === 'completed';
              const isInProgress = userQuest?.status === 'in_progress';
              const config = difficultyConfig[quest.difficulty];

              return (
                <button
                  key={quest.id}
                  onClick={() => !isLocked && onQuestClick(quest, userQuest)}
                  disabled={isLocked}
                  className={`
                    w-full p-3 rounded-lg flex items-center gap-3 transition-all duration-200
                    ${isLocked
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-white/5 cursor-pointer'
                    }
                    ${isInProgress ? 'ring-1 ring-cyan-400/50' : ''}
                  `}
                  style={{
                    background: isCompleted
                      ? 'rgba(74, 222, 128, 0.1)'
                      : isInProgress
                        ? 'rgba(34, 211, 238, 0.1)'
                        : 'rgba(255, 255, 255, 0.02)',
                  }}
                >
                  {/* Status Icon */}
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${config.bgColor}`}
                  >
                    {isLocked ? (
                      <LockClosedIcon className="w-4 h-4 text-slate-500" />
                    ) : isCompleted ? (
                      <FontAwesomeIcon icon={faCheck} className="text-green-400" />
                    ) : isInProgress ? (
                      <FontAwesomeIcon icon={faPlay} className="text-cyan-400" />
                    ) : (
                      <FontAwesomeIcon icon={config.icon} className={config.color} />
                    )}
                  </div>

                  {/* Quest Info */}
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className={`font-medium truncate ${isCompleted ? 'text-slate-400' : 'text-white'}`}>
                        {quest.title}
                      </h4>
                      {isInProgress && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-medium">
                          IN PROGRESS
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                      {quest.description || 'Complete this quest to earn rewards'}
                    </p>
                  </div>

                  {/* Points */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <FontAwesomeIcon icon={faTrophy} className="text-amber-400 text-xs" />
                    <span className="text-sm font-medium text-amber-400">
                      +{quest.pointsReward}
                    </span>
                  </div>

                  {/* Completed Check */}
                  {isCompleted && (
                    <CheckCircleIcon className="w-5 h-5 text-green-400 flex-shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
