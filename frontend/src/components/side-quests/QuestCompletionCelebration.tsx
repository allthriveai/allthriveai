import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReward } from 'react-rewards';
import { XMarkIcon, TrophyIcon, SparklesIcon, RocketLaunchIcon } from '@heroicons/react/24/outline';
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
import type { CompletedQuestInfo } from '@/components/quiz/types';

interface QuestCompletionCelebrationProps {
  completedQuests: CompletedQuestInfo[];
  onClose: () => void;
}

export function QuestCompletionCelebration({ completedQuests, onClose }: QuestCompletionCelebrationProps) {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [currentQuestIndex, setCurrentQuestIndex] = useState(0);
  const hasTriggeredConfetti = useRef(false);

  // Confetti reward - positioned in the tray
  const { reward: rewardConfetti } = useReward('questConfetti', 'confetti', {
    lifetime: 200,
    spread: 70,
    elementCount: 80,
    startVelocity: 30,
    colors: ['#4ade80', '#22d3ee', '#f59e0b', '#ec4899', '#8b5cf6'],
  });

  useEffect(() => {
    // Animate in
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Trigger confetti when celebration becomes visible
  useEffect(() => {
    if (isVisible && !hasTriggeredConfetti.current && completedQuests.length > 0) {
      hasTriggeredConfetti.current = true;
      setTimeout(() => rewardConfetti(), 400);
    }
  }, [isVisible, completedQuests.length, rewardConfetti]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const handleNext = () => {
    if (currentQuestIndex < completedQuests.length - 1) {
      setCurrentQuestIndex(prev => prev + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentQuestIndex > 0) {
      setCurrentQuestIndex(prev => prev - 1);
    }
  };

  const handleTryAnother = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
      navigate('/side-quests');
    }, 300);
  };

  if (completedQuests.length === 0) return null;

  const currentQuest = completedQuests[currentQuestIndex];
  const totalXP = completedQuests.reduce((sum, q) => sum + q.pointsAwarded, 0);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[99] bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={handleClose}
      />

      {/* Slide-out Tray */}
      <div
        className={`fixed right-0 top-0 bottom-0 w-full max-w-md z-[100] transform transition-transform duration-300 ease-out ${
          isVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          background: 'linear-gradient(180deg, rgba(2, 6, 23, 0.98), rgba(15, 23, 42, 0.98))',
          borderLeft: '1px solid rgba(74, 222, 128, 0.3)',
          boxShadow: '-10px 0 60px rgba(74, 222, 128, 0.15), -20px 0 120px rgba(34, 211, 238, 0.08)',
        }}
      >
        {/* Glow effect at top */}
        <div
          className="absolute top-0 left-0 right-0 h-[200px] pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center top, rgba(74, 222, 128, 0.15) 0%, transparent 70%)',
          }}
        />

        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full animate-float opacity-60"
              style={{
                background: i % 2 === 0 ? 'rgba(74, 222, 128, 0.6)' : 'rgba(34, 211, 238, 0.6)',
                left: `${15 + (i * 15)}%`,
                top: `${5 + (i % 3) * 8}%`,
                animationDelay: `${i * 0.3}s`,
                animationDuration: '3s',
              }}
            />
          ))}
        </div>

        {/* Header */}
        <div className="relative flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(74, 222, 128, 0.2), rgba(34, 211, 238, 0.2))',
                border: '1px solid rgba(74, 222, 128, 0.3)',
              }}
            >
              <TrophyIcon className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h2
                className="text-lg font-bold"
                style={{
                  background: 'linear-gradient(135deg, #4ade80, #22d3ee)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Quest Complete!
              </h2>
              {completedQuests.length > 1 && (
                <p className="text-xs text-slate-400">
                  {completedQuests.length} quests completed
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Confetti anchor */}
        <span id="questConfetti" className="absolute top-1/4 left-1/2 -translate-x-1/2" />

        {/* Scrollable Content */}
        <div className="relative flex-1 overflow-y-auto px-6 py-8" style={{ height: 'calc(100% - 180px)' }}>
          {/* Quest Card */}
          <div
            className="rounded-2xl p-6 mb-6"
            style={{
              background: 'linear-gradient(135deg, rgba(74, 222, 128, 0.08), rgba(34, 211, 238, 0.05))',
              border: '1px solid rgba(74, 222, 128, 0.2)',
            }}
          >
            {/* Trophy icon with animation */}
            <div className="flex justify-center mb-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center animate-bounce"
                style={{
                  background: 'linear-gradient(135deg, rgba(74, 222, 128, 0.2), rgba(34, 211, 238, 0.2))',
                  border: '1px solid rgba(74, 222, 128, 0.3)',
                  animationDuration: '2s',
                }}
              >
                <TrophyIcon className="w-8 h-8 text-green-400" />
              </div>
            </div>

            {/* Quest name */}
            <h3 className="text-xl font-semibold text-white text-center mb-1">
              {currentQuest.title}
            </h3>

            {/* Category */}
            {currentQuest.categoryName && (
              <p className="text-sm text-slate-400 text-center mb-4">
                {currentQuest.categoryName}
              </p>
            )}

            {/* Description if available */}
            {currentQuest.description && (
              <p className="text-sm text-slate-300 text-center mb-4 line-clamp-3">
                {currentQuest.description}
              </p>
            )}

            {/* Points Earned */}
            <div className="flex justify-center">
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
                style={{
                  background: 'linear-gradient(135deg, rgba(74, 222, 128, 0.2), rgba(74, 222, 128, 0.1))',
                  border: '1px solid rgba(74, 222, 128, 0.3)',
                }}
              >
                <SparklesIcon className="w-5 h-5 text-green-400" />
                <span className="text-green-400 font-bold text-lg">+{currentQuest.pointsAwarded} Points</span>
              </div>
            </div>
          </div>

          {/* Progress indicator for multiple quests */}
          {completedQuests.length > 1 && (
            <div className="flex items-center justify-center gap-4 mb-4">
              <button
                onClick={handlePrev}
                disabled={currentQuestIndex === 0}
                className={`p-2 rounded-lg transition-colors ${
                  currentQuestIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/10'
                }`}
              >
                <ChevronLeftIcon className="w-5 h-5 text-slate-400" />
              </button>
              <div className="flex gap-2">
                {completedQuests.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentQuestIndex(index)}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      index === currentQuestIndex
                        ? 'bg-green-400 scale-125'
                        : index < currentQuestIndex
                          ? 'bg-green-400/50'
                          : 'bg-slate-600 hover:bg-slate-500'
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={handleNext}
                disabled={currentQuestIndex === completedQuests.length - 1}
                className={`p-2 rounded-lg transition-colors ${
                  currentQuestIndex === completedQuests.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/10'
                }`}
              >
                <ChevronRightIcon className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          )}

          {/* Total Points summary for multiple quests */}
          {completedQuests.length > 1 && (
            <div
              className="rounded-xl p-4 text-center"
              style={{
                background: 'rgba(74, 222, 128, 0.05)',
                border: '1px solid rgba(74, 222, 128, 0.15)',
              }}
            >
              <p className="text-sm text-slate-400 mb-1">Total Points Earned</p>
              <p className="text-2xl font-bold text-green-400">+{totalXP}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10 bg-slate-900/80 backdrop-blur-sm">
          <div className="space-y-3">
            <button
              onClick={handleNext}
              className="w-full py-3 px-6 rounded-xl font-bold text-slate-900 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #4ade80, #22d3ee)',
              }}
            >
              {currentQuestIndex < completedQuests.length - 1 ? (
                <span>Next Quest ({currentQuestIndex + 1}/{completedQuests.length})</span>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <CheckIcon className="w-5 h-5" />
                  <span>Awesome!</span>
                </div>
              )}
            </button>

            {/* Try Another Side Quest button */}
            <button
              onClick={handleTryAnother}
              className="w-full py-3 px-6 rounded-xl font-semibold text-white/90 transition-all hover:bg-white/10 border border-white/20 flex items-center justify-center gap-2"
            >
              <RocketLaunchIcon className="w-5 h-5" />
              <span>Find More Quests</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
