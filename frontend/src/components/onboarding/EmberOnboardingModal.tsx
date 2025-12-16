/**
 * EmberOnboardingModal Component
 *
 * Video game-style conversational onboarding:
 * 1. Welcome screen - typewriter dialogue introducing AllThrive
 * 2. Choose Your Adventure - guided by Ember the dragon
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { XMarkIcon, SparklesIcon } from '@heroicons/react/24/solid';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDragon, faGamepad, faRocket, faCompass } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '@/hooks/useAuth';

interface Adventure {
  id: 'battle_pip' | 'add_project' | 'explore';
  title: string;
  description: string;
  icon: typeof faGamepad;
  color: string;
  gradient: string;
  path: string;
  action?: () => void;
}

interface EmberOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAdventure: (adventureId: Adventure['id']) => void;
  username?: string;
}

const adventures: Adventure[] = [
  {
    id: 'battle_pip',
    title: 'Prompt Battle',
    description: 'Test your prompting skills in a prompt battle.',
    icon: faGamepad,
    color: 'text-violet-400',
    gradient: 'from-violet-500 to-purple-600',
    path: '/battles',
  },
  {
    id: 'add_project',
    title: 'Add Your First Project',
    description: 'Use AI to automate your portfolio and projects.',
    icon: faRocket,
    color: 'text-cyan-400',
    gradient: 'from-cyan-500 to-teal-500',
    path: '/dashboard',
  },
  {
    id: 'explore',
    title: 'Explore',
    description: 'Discover AI tools, projects, and creators.',
    icon: faCompass,
    color: 'text-amber-400',
    gradient: 'from-amber-500 to-orange-500',
    path: '/explore',
  },
];

// Typewriter hook for video game dialogue effect
function useTypewriter(text: string, speed: number = 30, startDelay: number = 0) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    setDisplayedText('');
    setIsComplete(false);

    const startTimeout = setTimeout(() => {
      let index = 0;
      const interval = setInterval(() => {
        if (index < text.length) {
          setDisplayedText(text.slice(0, index + 1));
          index++;
        } else {
          setIsComplete(true);
          clearInterval(interval);
        }
      }, speed);

      return () => clearInterval(interval);
    }, startDelay);

    return () => clearTimeout(startTimeout);
  }, [text, speed, startDelay]);

  const skip = useCallback(() => {
    setDisplayedText(text);
    setIsComplete(true);
  }, [text]);

  return { displayedText, isComplete, skip };
}

export function EmberOnboardingModal({
  isOpen,
  onClose,
  onSelectAdventure,
  username = 'Adventurer',
}: EmberOnboardingModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<'welcome' | 'adventure'>('welcome');
  const [selectedAdventure, setSelectedAdventure] = useState<Adventure['id'] | null>(null);

  const handleContinue = () => {
    setStep('adventure');
  };

  const handleSelectAdventure = (adventure: Adventure) => {
    setSelectedAdventure(adventure.id);
    onSelectAdventure(adventure.id);

    setTimeout(() => {
      onClose();

      if (adventure.id === 'add_project') {
        localStorage.setItem('ember_open_chat', 'true');
        const profilePath = user?.username ? `/${user.username}` : '/dashboard';
        navigate(profilePath);
      } else {
        navigate(adventure.path);
      }
    }, 300);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        >
          {/* Ambient glow effects */}
          <div className="fixed top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none" />
          <div className="fixed bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-pink-accent/5 blur-[80px] pointer-events-none" />

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg"
          >
            {/* Skip button */}
            <button
              onClick={onClose}
              className="absolute -top-12 right-0 text-slate-500 hover:text-white transition-colors text-sm flex items-center gap-1 group"
            >
              <span className="opacity-0 group-hover:opacity-100 transition-opacity">Skip</span>
              <XMarkIcon className="w-5 h-5" />
            </button>

            {/* Main card - glass panel style */}
            <div className="glass-card overflow-hidden relative max-h-[85vh] overflow-y-auto">
              {/* Top neon accent line */}
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-bright to-transparent opacity-60" />

              <AnimatePresence mode="wait">
                {step === 'welcome' ? (
                  <WelcomeStep key="welcome" onContinue={handleContinue} />
                ) : (
                  <AdventureStep
                    key="adventure"
                    username={username}
                    adventures={adventures}
                    selectedAdventure={selectedAdventure}
                    onSelectAdventure={handleSelectAdventure}
                  />
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Dialogue bubble component - video game style
function DialogueBubble({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.25 }}
      className={`glass-subtle px-3 py-2 rounded-lg rounded-tl-sm border-l-2 border-cyan-500/50 ${className}`}
    >
      {children}
    </motion.div>
  );
}

// Step 1: Welcome - Problems then Solution
function WelcomeStep({ onContinue }: { onContinue: () => void }) {
  const [dialogueStep, setDialogueStep] = useState(0);

  // Problem statements
  const problems = [
    { text: "Your AI projects are scattered across many platforms.", delay: 0 },
    { text: "There are so many AI tools it can feel overwhelming.", delay: 600 },
    { text: "Hard to learn what's valuable vs. AI hype without wasting hours.", delay: 1200 },
  ];

  const line1 = useTypewriter(problems[0].text, 20, problems[0].delay);
  const line2 = useTypewriter(problems[1].text, 20, problems[1].delay);
  const line3 = useTypewriter(problems[2].text, 20, problems[2].delay);

  // Track dialogue progress
  useEffect(() => {
    if (line1.isComplete && dialogueStep < 1) setDialogueStep(1);
    if (line2.isComplete && dialogueStep < 2) setDialogueStep(2);
    if (line3.isComplete && dialogueStep < 3) setDialogueStep(3);
  }, [line1.isComplete, line2.isComplete, line3.isComplete, dialogueStep]);

  const handleSkip = () => {
    line1.skip();
    line2.skip();
    line3.skip();
    setDialogueStep(3);
  };

  const allProblemsComplete = dialogueStep >= 3;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="p-4 sm:p-5"
      onClick={!allProblemsComplete ? handleSkip : undefined}
    >
      {/* Logo and title */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-3 sm:mb-4"
      >
        <img
          src="/all-thrvie-logo.png"
          alt="All Thrive"
          className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-1.5 sm:mb-2"
        />
        <h1 className="text-base sm:text-lg font-bold">
          Welcome to{' '}
          <span className="text-gradient-cyan">All Thrive</span>
        </h1>
      </motion.div>

      {/* Flexible content area - responsive height */}
      <div className="min-h-[280px] sm:min-h-[340px] max-h-[50vh] sm:max-h-none flex flex-col">
        {/* Problem statements - chat bubbles */}
        <div className="flex-1">
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-2 sm:mb-3">Sound familiar?</p>

          <div className="space-y-1.5 sm:space-y-2">
            {/* Message 1 */}
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="flex justify-start"
            >
              <div className="bg-slate-800/80 px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl rounded-bl-md max-w-[90%] border border-slate-700/30">
                <p className="text-slate-200 text-xs sm:text-sm leading-snug">
                  {line1.displayedText}
                  {!line1.isComplete && <span className="animate-pulse text-cyan-bright">|</span>}
                </p>
              </div>
            </motion.div>

            {/* Message 2 */}
            <AnimatePresence>
              {dialogueStep >= 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="flex justify-start"
                >
                  <div className="bg-slate-800/80 px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl rounded-bl-md max-w-[90%] border border-slate-700/30">
                    <p className="text-slate-200 text-xs sm:text-sm leading-snug">
                      {line2.displayedText}
                      {!line2.isComplete && line1.isComplete && (
                        <span className="animate-pulse text-cyan-bright">|</span>
                      )}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Message 3 */}
            <AnimatePresence>
              {dialogueStep >= 2 && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="flex justify-start"
                >
                  <div className="bg-slate-800/80 px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl rounded-bl-md max-w-[90%] border border-slate-700/30">
                    <p className="text-slate-200 text-xs sm:text-sm leading-snug">
                      {line3.displayedText}
                      {!line3.isComplete && line2.isComplete && (
                        <span className="animate-pulse text-cyan-bright">|</span>
                      )}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Bottom area - solution or skip hint */}
        <div className="mt-auto pt-3 sm:pt-4 flex-shrink-0">
          <AnimatePresence mode="wait">
            {allProblemsComplete ? (
              <motion.div
                key="solution"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-center space-y-2 sm:space-y-3"
              >
                {/* Solution message */}
                <div className="px-3 py-2 sm:px-4 sm:py-3 rounded-lg bg-gradient-to-br from-cyan-500/10 via-violet-500/5 to-amber-500/10 border border-cyan-500/20">
                  <p className="text-cyan-bright font-medium text-xs sm:text-sm mb-0.5 sm:mb-1">
                    All Thrive has you covered.
                  </p>
                  <p className="text-slate-300 text-xs sm:text-sm leading-snug">
                    A community where you can{' '}
                    <span className="text-cyan-400">explore</span>,{' '}
                    <span className="text-violet-400">play</span>,{' '}
                    and <span className="text-amber-400">showcase your AI projects</span>.
                  </p>
                  <p className="text-slate-400 text-[10px] sm:text-xs mt-1 sm:mt-2 italic">
                    Together, we All Thrive.
                  </p>
                </div>

                {/* CTA */}
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onContinue}
                  className="btn-primary px-5 py-2 sm:px-6 sm:py-2.5 text-sm shadow-neon"
                >
                  Get Started
                </motion.button>
              </motion.div>
            ) : (
              <motion.p
                key="skip"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center text-slate-600 text-xs"
              >
                Tap anywhere to skip
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// Step 2: Choose Your Adventure with Ember
function AdventureStep({
  username,
  adventures,
  selectedAdventure,
  onSelectAdventure,
}: {
  username: string;
  adventures: Adventure[];
  selectedAdventure: Adventure['id'] | null;
  onSelectAdventure: (adventure: Adventure) => void;
}) {
  const greeting = useTypewriter(`Nice to meet you, ${username}! I'm Ember.`, 30, 200);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header with Ember */}
      <div className="relative bg-gradient-to-br from-orange-500/10 via-red-500/5 to-amber-500/10 p-4 border-b border-white/10">
        <div className="flex items-start gap-3">
          {/* Ember avatar with dark glow */}
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', delay: 0.1 }}
            className="relative flex-shrink-0"
          >
            <div className="absolute inset-[-4px] bg-black/60 rounded-full blur-md" />
            <div className="absolute inset-[-2px] bg-slate-900/80 rounded-full blur-sm" />
            <div className="relative w-10 h-10 flex items-center justify-center bg-slate-900/50 rounded-full">
              <FontAwesomeIcon
                icon={faDragon}
                className="text-2xl text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]"
              />
            </div>
          </motion.div>

          {/* Ember dialogue */}
          <div className="flex-1 min-w-0">
            <DialogueBubble delay={0.2} className="bg-orange-500/5 border-orange-500/30">
              <p className="text-slate-200 text-sm">
                {greeting.displayedText}
                {!greeting.isComplete && <span className="animate-pulse text-orange-400">|</span>}
                {greeting.isComplete && (
                  <span className="text-orange-200/70"> I'll be your guide. Where would you like to start?</span>
                )}
              </p>
            </DialogueBubble>

            {/* Welcome points badge */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 }}
              className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/20"
            >
              <SparklesIcon className="w-3 h-3 text-amber-400" />
              <span className="text-amber-300 text-xs font-medium">+50 Welcome Points</span>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Adventure selection */}
      <div className="p-4">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-slate-400 text-xs mb-3"
        >
          Choose your path:
        </motion.p>

        <div className="grid gap-2">
          {adventures.map((adventure, index) => (
            <motion.button
              key={adventure.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 + index * 0.1 }}
              whileHover={{ scale: 1.01, x: 4 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onSelectAdventure(adventure)}
              disabled={selectedAdventure !== null}
              className={`
                relative w-full p-3 rounded-lg text-left transition-all
                glass-subtle hover:bg-white/[0.08] border border-white/10 hover:border-cyan-500/30
                group overflow-hidden
                ${selectedAdventure === adventure.id ? 'neon-border bg-cyan-500/10' : ''}
                ${selectedAdventure !== null && selectedAdventure !== adventure.id ? 'opacity-40' : ''}
              `}
            >
              {/* Hover gradient effect */}
              <div
                className={`absolute inset-0 bg-gradient-to-r ${adventure.gradient} opacity-0 group-hover:opacity-5 transition-opacity`}
              />

              <div className="relative flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-lg bg-gradient-to-br ${adventure.gradient} flex items-center justify-center shadow-lg group-hover:shadow-neon transition-shadow`}
                >
                  <FontAwesomeIcon icon={adventure.icon} className="text-sm text-white" />
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-white group-hover:text-cyan-bright transition-colors">
                    {adventure.title}
                  </h3>
                  <p className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors truncate">
                    {adventure.description}
                  </p>
                </div>

                <div className="text-slate-600 group-hover:text-cyan-bright transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="text-center text-slate-600 text-xs mt-3"
        >
          You can always explore the other paths later!
        </motion.p>
      </div>
    </motion.div>
  );
}

export default EmberOnboardingModal;
