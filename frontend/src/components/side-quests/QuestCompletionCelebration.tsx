import { useEffect, useState, useRef } from 'react';
import { useReward } from 'react-rewards';
import { XMarkIcon, TrophyIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/24/solid';
import type { CompletedQuestInfo } from '@/components/quiz/types';

interface QuestCompletionCelebrationProps {
  completedQuests: CompletedQuestInfo[];
  onClose: () => void;
}

export function QuestCompletionCelebration({ completedQuests, onClose }: QuestCompletionCelebrationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentQuestIndex, setCurrentQuestIndex] = useState(0);
  const hasTriggeredConfetti = useRef(false);

  // Confetti reward
  const { reward: rewardConfetti } = useReward('questConfetti', 'confetti', {
    lifetime: 200,
    spread: 90,
    elementCount: 100,
    startVelocity: 35,
    colors: ['#4ade80', '#22d3ee', '#f59e0b', '#ec4899', '#8b5cf6'],
  });

  useEffect(() => {
    // Animate in
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Trigger confetti when celebration becomes visible
  useEffect(() => {
    if (isVisible && !hasTriggeredConfetti.current && completedQuests.length > 0) {
      hasTriggeredConfetti.current = true;
      // Small delay to ensure the element is rendered
      setTimeout(() => rewardConfetti(), 300);
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

  if (completedQuests.length === 0) return null;

  const currentQuest = completedQuests[currentQuestIndex];
  const totalXP = completedQuests.reduce((sum, q) => sum + q.pointsAwarded, 0);

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-all duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Celebration Card */}
      <div
        className={`relative w-full max-w-sm mx-4 transform transition-all duration-500 ${
          isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-8'
        }`}
      >
        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full animate-float"
              style={{
                background: i % 2 === 0 ? 'rgba(74, 222, 128, 0.6)' : 'rgba(34, 211, 238, 0.6)',
                left: `${10 + (i * 12)}%`,
                top: `${-10 + (i % 3) * 10}%`,
                animationDelay: `${i * 0.2}s`,
                animationDuration: '3s',
              }}
            />
          ))}
        </div>

        {/* Main card */}
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(2, 6, 23, 0.98), rgba(15, 23, 42, 0.98))',
            border: '1px solid rgba(74, 222, 128, 0.3)',
            boxShadow: '0 0 60px rgba(74, 222, 128, 0.2), 0 0 120px rgba(34, 211, 238, 0.1)',
          }}
        >
          {/* Glow effect */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[200px] pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse, rgba(74, 222, 128, 0.2) 0%, transparent 70%)',
            }}
          />

          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-xl hover:bg-white/10 transition-colors z-10"
          >
            <XMarkIcon className="w-5 h-5 text-slate-400" />
          </button>

          {/* Content */}
          <div className="relative p-6 pt-8 text-center">
            {/* Confetti anchor */}
            <span id="questConfetti" className="absolute top-1/3 left-1/2 -translate-x-1/2" />

            {/* Trophy icon */}
            <div className="mb-4 flex justify-center">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center animate-bounce"
                style={{
                  background: 'linear-gradient(135deg, rgba(74, 222, 128, 0.2), rgba(34, 211, 238, 0.2))',
                  border: '1px solid rgba(74, 222, 128, 0.3)',
                  animationDuration: '2s',
                }}
              >
                <TrophyIcon className="w-10 h-10 text-green-400" />
              </div>
            </div>

            {/* Title */}
            <h2
              className="text-2xl font-bold mb-2"
              style={{
                background: 'linear-gradient(135deg, #4ade80, #22d3ee)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Quest Complete!
            </h2>

            {/* Quest name */}
            <p className="text-lg font-semibold text-white mb-1">
              {currentQuest.title}
            </p>

            {/* Category */}
            {currentQuest.categoryName && (
              <p className="text-sm text-slate-400 mb-4">
                {currentQuest.categoryName}
              </p>
            )}

            {/* Points Earned */}
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
              style={{
                background: 'linear-gradient(135deg, rgba(74, 222, 128, 0.2), rgba(74, 222, 128, 0.1))',
                border: '1px solid rgba(74, 222, 128, 0.3)',
              }}
            >
              <SparklesIcon className="w-5 h-5 text-green-400" />
              <span className="text-green-400 font-bold text-lg">+{currentQuest.pointsAwarded} Points</span>
            </div>

            {/* Progress indicator for multiple quests */}
            {completedQuests.length > 1 && (
              <div className="flex justify-center gap-2 mb-4">
                {completedQuests.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index <= currentQuestIndex ? 'bg-green-400' : 'bg-slate-600'
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Action button */}
            <button
              onClick={handleNext}
              className="w-full py-3 px-6 rounded-xl font-bold text-slate-900 transition-all transform hover:scale-105"
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

            {/* Total Points summary for multiple quests */}
            {completedQuests.length > 1 && currentQuestIndex === completedQuests.length - 1 && (
              <p className="mt-3 text-sm text-slate-400">
                Total earned: <span className="text-green-400 font-semibold">+{totalXP} Points</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
