import { useState, useRef, useEffect, useMemo } from 'react';
import { SparklesIcon, ChevronDownIcon, XCircleIcon, TrophyIcon, TagIcon } from '@heroicons/react/24/outline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFire, faStar, faBolt, faTrophy } from '@fortawesome/free-solid-svg-icons';
import type { UserSideQuest, QuestCategory } from '@/types/models';

interface ActiveQuestIndicatorProps {
  activeQuest: UserSideQuest | null;
  onClick: () => void;
  onAbandon?: (questId: string) => void;
  isAbandoning?: boolean;
  colors?: { colorFrom: string; colorTo: string };
  category?: QuestCategory | null;
}

// Helper to convert hex to rgba
function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(34, 211, 238, ${alpha})`;
  return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})`;
}

const difficultyConfig = {
  easy: { color: 'text-emerald-400', icon: faStar },
  medium: { color: 'text-amber-400', icon: faBolt },
  hard: { color: 'text-rose-400', icon: faFire },
  epic: { color: 'text-violet-400', icon: faTrophy },
};

export function ActiveQuestIndicator({ activeQuest, onClick, onAbandon, isAbandoning, colors, category }: ActiveQuestIndicatorProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Use category colors or default to cyan-green
  const questColors = useMemo(() => {
    const colorFrom = colors?.colorFrom || '#22d3ee';
    const colorTo = colors?.colorTo || '#4ade80';
    return {
      colorFrom,
      colorTo,
      gradient: `linear-gradient(135deg, ${colorFrom}, ${colorTo})`,
      bgLight: hexToRgba(colorFrom, 0.1),
      border: hexToRgba(colorFrom, 0.3),
      glow: hexToRgba(colorFrom, 0.2),
      glowPulse: hexToRgba(colorFrom, 0.4),
      borderDropdown: hexToRgba(colorFrom, 0.2),
      borderSection: hexToRgba(colorFrom, 0.15),
    };
  }, [colors]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setShowConfirm(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!activeQuest || activeQuest.isCompleted) return null;

  const { sideQuest, stepsProgress } = activeQuest;
  const completedStepsCount = stepsProgress?.filter(s => s.isCompleted).length || 0;
  const totalSteps = sideQuest.steps?.length || 0;
  const config = difficultyConfig[sideQuest.difficulty];
  const categoryName = category?.name || sideQuest.categoryName || 'Quest';

  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleViewQuest = () => {
    setIsDropdownOpen(false);
    onClick();
  };

  const handleAbandonClick = () => {
    setShowConfirm(true);
  };

  const handleConfirmAbandon = () => {
    if (onAbandon) {
      onAbandon(sideQuest.id);
    }
    setShowConfirm(false);
    setIsDropdownOpen(false);
  };

  const handleCancelAbandon = () => {
    setShowConfirm(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Active Quest Button */}
      <button
        onClick={handleButtonClick}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-all hover:scale-105"
        style={{
          background: questColors.bgLight,
          border: `1px solid ${questColors.border}`,
          boxShadow: `0 0 15px ${questColors.glow}`,
        }}
        title={`Active Quest: ${sideQuest.title}`}
      >
        {/* Pulsing icon */}
        <div className="relative">
          <SparklesIcon className="w-4 h-4" style={{ color: questColors.colorFrom }} />
          <div
            className="absolute inset-0 rounded-full animate-ping"
            style={{
              background: questColors.glowPulse,
            }}
          />
        </div>

        {/* Label with category */}
        <span className="text-xs font-bold hidden sm:inline" style={{ color: questColors.colorFrom }}>
          {categoryName}
        </span>

        {/* Step count badge */}
        {sideQuest.isGuided && totalSteps > 0 && (
          <span className="text-xs font-bold" style={{ color: questColors.colorFrom }}>
            {completedStepsCount}/{totalSteps}
          </span>
        )}

        {/* Dropdown arrow */}
        <ChevronDownIcon
          className={`w-3 h-3 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
          style={{ color: questColors.colorFrom }}
        />
      </button>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <div
          className="absolute right-0 mt-2 w-72 rounded-xl overflow-hidden z-50 animate-fade-in"
          style={{
            backgroundColor: 'rgba(2, 6, 23, 0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: `1px solid ${questColors.borderDropdown}`,
            boxShadow: `0 10px 40px rgba(0, 0, 0, 0.5), 0 0 20px ${questColors.glow}`,
          }}
        >
          {/* Quest Info Section */}
          <div className="p-4 border-b" style={{ borderColor: questColors.borderSection }}>
            {/* Category Badge */}
            <div className="flex items-center gap-1.5 mb-2">
              <TagIcon className="w-3 h-3" style={{ color: questColors.colorFrom }} />
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{
                  background: questColors.bgLight,
                  color: questColors.colorFrom,
                  border: `1px solid ${questColors.border}`,
                }}
              >
                {categoryName}
              </span>
            </div>

            {/* Quest Title */}
            <h4
              className="font-bold text-sm mb-1"
              style={{
                background: questColors.gradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {sideQuest.title}
            </h4>

            {/* Quest Meta */}
            <div className="flex items-center gap-3 text-xs text-slate-400">
              {/* Difficulty */}
              <div className="flex items-center gap-1">
                <FontAwesomeIcon icon={config.icon} className={`text-xs ${config.color}`} />
                <span className={config.color}>{sideQuest.difficulty}</span>
              </div>

              {/* Points Reward */}
              <div className="flex items-center gap-1">
                <TrophyIcon className="w-3 h-3" style={{ color: questColors.colorFrom }} />
                <span style={{ color: questColors.colorFrom }}>+{sideQuest.pointsReward} Points</span>
              </div>
            </div>

            {/* Progress Bar */}
            {sideQuest.isGuided && totalSteps > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Progress</span>
                  <span className="font-medium" style={{ color: questColors.colorFrom }}>
                    {completedStepsCount}/{totalSteps} steps
                  </span>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(completedStepsCount / totalSteps) * 100}%`,
                      background: questColors.gradient,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-2">
            {!showConfirm ? (
              <>
                {/* View Quest Details */}
                <button
                  onClick={handleViewQuest}
                  className="w-full px-3 py-2 rounded-lg text-left text-sm font-medium text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                >
                  <SparklesIcon className="w-4 h-4" style={{ color: questColors.colorFrom }} />
                  <span>View Quest Details</span>
                </button>

                {/* Abandon Quest */}
                <button
                  onClick={handleAbandonClick}
                  className="w-full px-3 py-2 rounded-lg text-left text-sm font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center gap-2"
                >
                  <XCircleIcon className="w-4 h-4" />
                  <span>Abandon Quest</span>
                </button>
              </>
            ) : (
              /* Confirmation View */
              <div className="p-2">
                <p className="text-sm text-slate-300 mb-3 text-center">
                  Abandon this quest? Progress will be lost.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleCancelAbandon}
                    className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:bg-white/5 transition-colors"
                    style={{ border: '1px solid rgba(255, 255, 255, 0.1)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmAbandon}
                    disabled={isAbandoning}
                    className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                    style={{
                      background: 'linear-gradient(135deg, #f43f5e, #dc2626)',
                    }}
                  >
                    {isAbandoning ? 'Abandoning...' : 'Abandon'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
