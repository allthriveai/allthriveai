import { useState, useEffect, useCallback, useMemo } from 'react';
import { XMarkIcon, ArrowRightIcon, SparklesIcon, TrophyIcon, ClockIcon, PlayIcon, TagIcon } from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/24/solid';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFire, faStar, faBolt, faTrophy, faScroll, faSkull } from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from 'react-router-dom';
import type { SideQuest, UserSideQuest, QuestCategory } from '@/types/models';
import { QuestProgressMap } from './QuestProgressMap';
import { QuestStepCard } from './QuestStepCard';

// Reusable style constants
const GLASS_BORDER_SUBTLE = '1px solid var(--glass-border-subtle)';
const createLinearGradient = (colorFrom: string, colorTo: string, opacity1: number, opacity2: number) =>
  `linear-gradient(135deg, ${colorFrom.includes('rgba') ? colorFrom : `rgba(${parseInt(colorFrom.slice(1,3), 16)}, ${parseInt(colorFrom.slice(3,5), 16)}, ${parseInt(colorFrom.slice(5,7), 16)}, ${opacity1})`}, ${colorTo.includes('rgba') ? colorTo : `rgba(${parseInt(colorTo.slice(1,3), 16)}, ${parseInt(colorTo.slice(3,5), 16)}, ${parseInt(colorTo.slice(5,7), 16)}, ${opacity2})`})`;

interface QuestTrayProps {
  isOpen: boolean;
  onClose: () => void;
  // Can receive either a quest (not started) or a user quest (started/completed)
  quest?: SideQuest | null;
  userQuest?: UserSideQuest | null;
  onStartQuest?: (questId: string) => Promise<void>;
  isStarting?: boolean;
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
  easy: {
    label: 'Easy',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    icon: faStar,
  },
  medium: {
    label: 'Medium',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    icon: faBolt,
  },
  hard: {
    label: 'Hard',
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/20',
    icon: faFire,
  },
  epic: {
    label: 'Epic',
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/20',
    icon: faTrophy,
  },
};

// RPG-style quest invitation messages based on difficulty
const getQuestIntroMessages = (quest: SideQuest) => {
  const messages: string[] = [];

  // Opening lines with flavor
  messages.push('Brave adventurer...');
  messages.push('A new quest awaits.');

  // Quest title reveal
  messages.push(`"${quest.title}"`);

  // Show quest steps/objective
  if (quest.isGuided && quest.steps && quest.steps.length > 0) {
    messages.push('Your mission:');
    // Show all steps so user knows the full scope
    quest.steps.forEach((step, index) => {
      messages.push(`${index + 1}. ${step.title}`);
    });
  } else if (quest.description) {
    // For non-guided quests, show description as mission
    messages.push('Your mission:');
    messages.push(quest.description);
  }

  // Reward reveal
  messages.push(`Complete this quest to earn +${quest.pointsReward} Points`);

  // Final call to action
  messages.push('Do you accept this quest?');

  return messages;
};

// Streaming text hook for typewriter effect
function useStreamingText(messages: string[], isActive: boolean, speed: number = 30) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [displayedMessages, setDisplayedMessages] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setCurrentMessageIndex(0);
      setCurrentCharIndex(0);
      setDisplayedMessages([]);
      setIsComplete(false);
      return;
    }

    if (currentMessageIndex >= messages.length) {
      setIsComplete(true);
      return;
    }

    const currentMessage = messages[currentMessageIndex];

    if (currentCharIndex < currentMessage.length) {
      // Type next character
      const timer = setTimeout(() => {
        setDisplayedMessages(prev => {
          const newMessages = [...prev];
          newMessages[currentMessageIndex] = currentMessage.slice(0, currentCharIndex + 1);
          return newMessages;
        });
        setCurrentCharIndex(prev => prev + 1);
      }, speed);
      return () => clearTimeout(timer);
    } else {
      // Move to next message after a pause
      const timer = setTimeout(() => {
        setCurrentMessageIndex(prev => prev + 1);
        setCurrentCharIndex(0);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [messages, currentMessageIndex, currentCharIndex, isActive, speed]);

  const skipToEnd = useCallback(() => {
    setDisplayedMessages(messages);
    setCurrentMessageIndex(messages.length);
    setIsComplete(true);
  }, [messages]);

  return { displayedMessages, isComplete, skipToEnd };
}

export function QuestTray({ isOpen, onClose, quest, userQuest, onStartQuest, isStarting, onAbandon, isAbandoning, colors, category }: QuestTrayProps) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<'intro' | 'details'>('intro');
  const [showButtons, setShowButtons] = useState(false);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);

  // Track if tray should be rendered (for slide-out animation)
  const [shouldRender, setShouldRender] = useState(false);

  // Handle mount/unmount for animations
  useEffect(() => {
    if (isOpen && (quest || userQuest)) {
      setShouldRender(true);
    }
  }, [isOpen, quest, userQuest]);

  // Handle transition end to unmount after closing
  const handleTransitionEnd = () => {
    if (!isOpen) {
      setShouldRender(false);
    }
  };

  // Determine the quest data source
  const sideQuest = userQuest?.sideQuest || quest;
  const isStarted = !!userQuest;
  const isCompleted = userQuest?.status === 'completed';
  const isInProgress = userQuest?.status === 'in_progress';

  // Use category colors or default to cyan-green
  const questColors = useMemo(() => {
    const colorFrom = colors?.colorFrom || '#22d3ee';
    const colorTo = colors?.colorTo || '#4ade80';
    return {
      colorFrom,
      colorTo,
      gradient: `linear-gradient(135deg, ${colorFrom}, ${colorTo})`,
      bgLight: hexToRgba(colorFrom, 0.1),
      bgVeryLight: hexToRgba(colorFrom, 0.05),
      border: hexToRgba(colorFrom, 0.3),
      borderLight: hexToRgba(colorFrom, 0.2),
      glow: hexToRgba(colorFrom, 0.15),
      glowStrong: hexToRgba(colorFrom, 0.4),
      textShadow: hexToRgba(colorFrom, 0.5),
      particle1: hexToRgba(colorFrom, 0.6),
      particle2: hexToRgba(colorTo, 0.6),
      radialGlow: hexToRgba(colorFrom, 0.08),
    };
  }, [colors]);

  // Get category name
  const categoryName = category?.name || sideQuest?.categoryName || 'Quest';

  // Get intro messages for streaming (memoized to prevent infinite loop)
  const introMessages = useMemo(
    () => sideQuest ? getQuestIntroMessages(sideQuest) : [],
    [sideQuest]
  );

  // Streaming text effect - only for new quests (not started)
  const shouldShowIntro = isOpen && !isStarted && phase === 'intro';
  const { displayedMessages, isComplete: introComplete, skipToEnd } = useStreamingText(
    introMessages,
    shouldShowIntro,
    25
  );

  // Show buttons after intro completes
  useEffect(() => {
    if (introComplete && shouldShowIntro) {
      const timer = setTimeout(() => setShowButtons(true), 300);
      return () => clearTimeout(timer);
    }
  }, [introComplete, shouldShowIntro]);

  // Reset state when tray closes or quest changes
  useEffect(() => {
    if (!isOpen) {
      setPhase('intro');
      setShowButtons(false);
      setShowAbandonConfirm(false);
    }
  }, [isOpen]);

  // Skip to details phase if quest is already started
  useEffect(() => {
    if (isStarted) {
      setPhase('details');
    }
  }, [isStarted]);

  const handleNavigateToStep = (url: string) => {
    if (url) {
      onClose();
      navigate(url);
    }
  };

  const handleStartQuest = async () => {
    if (sideQuest && onStartQuest) {
      await onStartQuest(sideQuest.id);
      setPhase('details');
    }
  };

  const handleDecline = () => {
    onClose();
  };

  const handleSkipIntro = () => {
    if (!introComplete) {
      skipToEnd();
    }
  };

  if (!shouldRender || !sideQuest) {
    return null;
  }

  const config = difficultyConfig[sideQuest.difficulty];
  const stepsProgress = userQuest?.stepsProgress;
  const currentStep = userQuest?.currentStep;
  const completedStepsCount = stepsProgress?.filter(s => s.isCompleted).length || 0;
  const totalSteps = sideQuest.steps?.length || 0;

  // Cinematic Intro Phase - Video Game Style
  if (phase === 'intro' && !isStarted) {
    return (
      <div
        className={`fixed right-0 top-0 bottom-0 w-full max-w-md shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          backgroundColor: 'var(--bg-primary)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderLeft: `1px solid ${questColors.borderLight}`,
          boxShadow: `0 0 60px ${questColors.glow}`,
        }}
        onClick={handleSkipIntro}
        onTransitionEnd={handleTransitionEnd}
      >
        {/* Animated background particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute top-[10%] left-[20%] w-2 h-2 rounded-full animate-pulse"
            style={{ background: questColors.particle1, animationDelay: '0s' }}
          />
          <div
            className="absolute top-[30%] right-[15%] w-1 h-1 rounded-full animate-pulse"
            style={{ background: questColors.particle2, animationDelay: '0.5s' }}
          />
          <div
            className="absolute bottom-[40%] left-[10%] w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: questColors.particle1, animationDelay: '1s' }}
          />
          <div
            className="absolute top-[60%] right-[25%] w-1 h-1 rounded-full animate-pulse"
            style={{ background: questColors.particle2, animationDelay: '1.5s' }}
          />
        </div>

        {/* Glowing orb effect */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${questColors.radialGlow} 0%, transparent 50%)`,
          }}
        />

        {/* Close button - larger tap target for mobile */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute top-4 right-4 p-3 rounded-xl transition-all bg-white/10 dark:bg-white/10 hover:bg-white/20 dark:hover:bg-white/20 z-20"
          aria-label="Close"
        >
          <XMarkIcon className="w-6 h-6 text-white/80" />
        </button>

        {/* Cinematic content */}
        <div className="flex flex-col h-full justify-center items-center px-8 relative z-10">
          {/* Category badge */}
          <div className="mb-4 animate-fade-in">
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
              style={{
                background: questColors.bgLight,
                border: `1px solid ${questColors.border}`,
                color: questColors.colorFrom,
              }}
            >
              <TagIcon className="w-3 h-3" />
              <span>{categoryName}</span>
            </div>
          </div>

          {/* Quest scroll icon */}
          <div
            className="mb-8 animate-bounce"
            style={{ animationDuration: '2s' }}
          >
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{
                background: createLinearGradient(questColors.colorFrom, questColors.colorTo, 0.1, 0.1),
                boxShadow: `0 0 30px ${questColors.border}`,
              }}
            >
              <FontAwesomeIcon icon={faScroll} className="text-3xl" style={{ color: questColors.colorFrom }} />
            </div>
          </div>

          {/* Streaming text messages */}
          <div className="space-y-3 text-center min-h-[200px] max-w-sm">
            {displayedMessages.map((message, index) => {
              // Determine styling based on message content
              const isTitle = index === 2; // Quest title (after "Brave adventurer..." and "A new quest awaits.")
              const isReward = message.startsWith('Complete this quest');
              const isFinalQuestion = message === 'Do you accept this quest?';
              const isMissionHeader = message === 'Your mission:';
              const isStep = /^\d+\./.test(message); // Starts with number and dot

              return (
                <p
                  key={index}
                  className={`transition-opacity duration-300 ${
                    isTitle
                      ? 'text-xl font-bold'
                      : isFinalQuestion
                        ? 'text-lg font-semibold mt-4'
                        : isMissionHeader
                          ? 'text-sm font-semibold uppercase tracking-wider mt-4'
                          : isStep
                            ? 'text-sm text-left pl-4'
                            : 'text-sm leading-relaxed'
                  }`}
                  style={{
                    color: isTitle
                      ? questColors.colorFrom
                      : isReward
                        ? questColors.colorTo
                        : isMissionHeader
                          ? questColors.colorFrom
                          : isStep
                            ? 'var(--text-primary)'
                            : 'var(--text-secondary)',
                    textShadow: isTitle ? `0 0 20px ${questColors.textShadow}` : 'none',
                  }}
                >
                  {message}
                  {index === displayedMessages.length - 1 && !introComplete && (
                    <span className="animate-pulse">|</span>
                  )}
                </p>
              );
            })}
          </div>

          {/* Quest info badges */}
          {showButtons && (
            <div className="flex items-center gap-4 mt-6 mb-8 animate-fade-in">
              {/* Points Reward */}
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-full"
                style={{
                  background: createLinearGradient(questColors.colorFrom, questColors.colorTo, 0.1, 0.1),
                  border: `1px solid ${questColors.border}`,
                }}
              >
                <TrophyIcon className="w-5 h-5" style={{ color: questColors.colorFrom }} />
                <span className="font-bold" style={{ color: questColors.colorFrom }}>+{sideQuest.pointsReward} Points</span>
              </div>

              {/* Difficulty */}
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${config.bgColor}`}>
                <FontAwesomeIcon icon={config.icon} className={config.color} />
                <span className={`font-medium ${config.color}`}>{config.label}</span>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {showButtons && (
            <div className="flex flex-col gap-3 w-full max-w-xs animate-fade-in">
              {/* Accept Quest Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartQuest();
                }}
                disabled={isStarting || !sideQuest.isAvailable}
                className="w-full py-4 px-6 rounded-xl font-bold text-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
                style={{
                  background: sideQuest.isAvailable
                    ? questColors.gradient
                    : 'rgba(100, 116, 139, 0.5)',
                  color: '#0f172a',
                  boxShadow: sideQuest.isAvailable
                    ? `0 0 30px ${questColors.glowStrong}, 0 0 60px ${hexToRgba(questColors.colorTo, 0.2)}`
                    : 'none',
                }}
              >
                {isStarting ? (
                  <>
                    <div className="w-6 h-6 border-3 border-slate-900 border-t-transparent rounded-full animate-spin" />
                    <span>Accepting Quest...</span>
                  </>
                ) : sideQuest.isAvailable ? (
                  <>
                    <PlayIcon className="w-6 h-6" />
                    <span>Accept Quest</span>
                  </>
                ) : (
                  <span>Quest Locked</span>
                )}
              </button>

              {/* Decline Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDecline();
                }}
                className="w-full py-3 px-6 rounded-xl font-medium text-muted transition-all hover:text-secondary flex items-center justify-center gap-2"
                style={{
                  border: GLASS_BORDER_SUBTLE,
                  background: 'var(--glass-fill-subtle)',
                }}
              >
                <FontAwesomeIcon icon={faSkull} className="text-sm opacity-60" />
                <span>Not Today</span>
              </button>
            </div>
          )}

          {/* Skip hint */}
          {!introComplete && (
            <p className="absolute bottom-8 text-xs text-muted animate-pulse">
              Tap anywhere to skip
            </p>
          )}
        </div>
      </div>
    );
  }

  // Details Phase - Quest Progress View
  return (
    <div
      className={`fixed right-0 top-0 bottom-0 w-full max-w-md shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
      style={{
        backgroundColor: 'var(--bg-primary)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderLeft: `1px solid ${questColors.borderLight}`,
        boxShadow: `0 0 40px ${questColors.glow}`,
      }}
      onTransitionEnd={handleTransitionEnd}
    >
      {/* Ambient glow effect */}
      <div
        className="absolute top-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${hexToRgba(questColors.colorFrom, 0.15)} 0%, ${hexToRgba(questColors.colorTo, 0.1)} 50%, transparent 70%)`,
        }}
      />

      <div className="flex flex-col h-full relative z-10">
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 border-b"
          style={{ borderColor: questColors.borderLight }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: isCompleted
                  ? 'linear-gradient(135deg, rgba(74, 222, 128, 0.3), rgba(74, 222, 128, 0.1))'
                  : createLinearGradient(questColors.colorFrom, questColors.colorTo, 0.1, 0.1),
              }}
            >
              {isCompleted ? (
                <CheckIcon className="w-5 h-5 text-green-400" />
              ) : (
                <SparklesIcon className="w-5 h-5" style={{ color: questColors.colorFrom }} />
              )}
            </div>
            <div>
              {/* Category badge */}
              <div className="flex items-center gap-1.5 mb-0.5">
                <TagIcon className="w-3 h-3" style={{ color: questColors.colorFrom }} />
                <span className="text-xs font-medium" style={{ color: questColors.colorFrom }}>
                  {categoryName}
                </span>
              </div>
              <h2
                className="text-lg font-bold"
                style={{
                  background: questColors.gradient,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {sideQuest.title}
              </h2>
              <p className="text-xs text-muted">
                {isCompleted ? (
                  'Quest Completed!'
                ) : isInProgress && totalSteps > 0 ? (
                  `${completedStepsCount}/${totalSteps} steps completed`
                ) : (
                  config.label + ' Quest'
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl transition-all hover:bg-white/5 dark:hover:bg-white/5 hover:bg-black/5"
            aria-label="Close"
          >
            <XMarkIcon className="w-6 h-6 text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Quest Info Bar */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Points Reward Badge */}
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{
                background: createLinearGradient(questColors.colorFrom, questColors.colorTo, 0.1, 0.1),
                border: `1px solid ${questColors.border}`,
              }}
            >
              <TrophyIcon className="w-4 h-4" style={{ color: questColors.colorFrom }} />
              <span className="text-sm font-bold" style={{ color: questColors.colorFrom }}>+{sideQuest.pointsReward} Points</span>
            </div>

            {/* Difficulty Badge */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${config.bgColor}`}>
              <FontAwesomeIcon icon={config.icon} className={`text-sm ${config.color}`} />
              <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
            </div>

            {/* Estimated Time */}
            {sideQuest.estimatedMinutes && (
              <div className="flex items-center gap-1.5 text-muted">
                <ClockIcon className="w-4 h-4" />
                <span className="text-sm">~{sideQuest.estimatedMinutes} min</span>
              </div>
            )}
          </div>

          {/* Quest Description */}
          {sideQuest.description && (
            <div
              className="p-4 rounded-xl glass-subtle"
            >
              <p className="text-sm text-secondary leading-relaxed">
                {sideQuest.description}
              </p>
            </div>
          )}

          {/* Narrative Intro (for in-progress quests) */}
          {isInProgress && sideQuest.narrativeIntro && (
            <div
              className="p-4 rounded-xl"
              style={{
                background: questColors.bgVeryLight,
                border: `1px solid ${questColors.borderLight}`,
              }}
            >
              <p className="text-sm text-secondary leading-relaxed italic">
                "{sideQuest.narrativeIntro}"
              </p>
            </div>
          )}

          {/* Completion Message */}
          {isCompleted && (
            <div
              className="p-4 rounded-xl"
              style={{
                background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.1), rgba(74, 222, 128, 0.1))',
                border: '1px solid rgba(74, 222, 128, 0.3)',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <CheckIcon className="w-5 h-5 text-green-400" />
                <span className="font-bold text-green-400">Quest Complete!</span>
              </div>
              <p className="text-sm text-secondary leading-relaxed">
                {sideQuest.narrativeComplete || `You earned +${userQuest?.xpAwarded || sideQuest.pointsReward} Points!`}
              </p>
            </div>
          )}

          {/* Progress Map (for in-progress guided quests) */}
          {isInProgress && sideQuest.isGuided && totalSteps > 0 && stepsProgress && (
            <div className="py-2">
              <QuestProgressMap stepsProgress={stepsProgress} />
            </div>
          )}

          {/* Steps List (for in-progress guided quests) */}
          {isInProgress && sideQuest.isGuided && stepsProgress && stepsProgress.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider">
                Journey Steps
              </h3>
              <div className="space-y-2">
                {stepsProgress.map((stepProgress, index) => (
                  <QuestStepCard
                    key={stepProgress.step.id || index}
                    stepProgress={stepProgress}
                    stepNumber={index + 1}
                    onNavigate={handleNavigateToStep}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Progress bar for non-guided in-progress quests */}
          {isInProgress && !sideQuest.isGuided && userQuest && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider">
                Progress
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Current Progress</span>
                  <span className="font-medium text-default">
                    {userQuest.currentProgress} / {userQuest.targetProgress}
                  </span>
                </div>
                <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--glass-fill)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${userQuest.progressPercentage}%`,
                      background: questColors.gradient,
                    }}
                  />
                </div>
                <div className="text-xs text-muted text-right">
                  {userQuest.progressPercentage}% complete
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer with action */}
        <div
          className="p-4 border-t"
          style={{ borderColor: questColors.borderLight }}
        >
          {/* In progress with guided steps - Show Continue button */}
          {isInProgress && currentStep?.destinationUrl && (
            <button
              onClick={() => handleNavigateToStep(currentStep.destinationUrl!)}
              className="w-full py-3 px-4 rounded-xl font-bold text-slate-900 transition-all flex items-center justify-center gap-2"
              style={{
                background: questColors.gradient,
              }}
            >
              <span>Continue Journey</span>
              <ArrowRightIcon className="w-5 h-5" />
            </button>
          )}

          {/* In progress without destination - Show encouragement */}
          {isInProgress && !currentStep?.destinationUrl && (
            <div className="text-center text-muted text-sm">
              Keep exploring to complete this quest!
            </div>
          )}

          {/* Abandon Quest Button (for in-progress quests) */}
          {isInProgress && onAbandon && !showAbandonConfirm && (
            <button
              onClick={() => setShowAbandonConfirm(true)}
              className="mt-3 w-full py-2 px-4 rounded-xl text-sm font-medium text-muted hover:text-red-400 transition-colors border border-transparent hover:border-red-400/30 hover:bg-red-400/10"
            >
              Cancel Quest
            </button>
          )}

          {/* Abandon Confirmation */}
          {isInProgress && onAbandon && showAbandonConfirm && (
            <div className="mt-3 space-y-3">
              <p className="text-center text-sm text-secondary">
                Are you sure you want to cancel this quest? Your progress will be lost.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAbandonConfirm(false)}
                  className="flex-1 py-2 px-4 rounded-xl text-sm font-medium text-secondary transition-colors"
                  style={{ border: '1px solid var(--glass-border)', background: 'var(--glass-fill-subtle)' }}
                  disabled={isAbandoning}
                >
                  Keep Quest
                </button>
                <button
                  onClick={() => {
                    if (userQuest) {
                      onAbandon(userQuest.id);
                    }
                  }}
                  disabled={isAbandoning}
                  className="flex-1 py-2 px-4 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {isAbandoning ? 'Canceling...' : 'Yes, Cancel'}
                </button>
              </div>
            </div>
          )}

          {/* Completed - Show completion message */}
          {isCompleted && (
            <div className="text-center">
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
                style={{
                  background: 'linear-gradient(135deg, rgba(74, 222, 128, 0.2), rgba(74, 222, 128, 0.1))',
                  border: '1px solid rgba(74, 222, 128, 0.3)',
                }}
              >
                <CheckIcon className="w-5 h-5 text-green-400" />
                <span className="text-green-400 font-medium">+{userQuest?.xpAwarded || sideQuest.pointsReward} Points Earned</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
