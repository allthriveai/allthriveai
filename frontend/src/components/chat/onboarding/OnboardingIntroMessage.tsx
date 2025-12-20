/**
 * OnboardingIntroMessage - Ember's intro message with typewriter effect
 *
 * Displays the initial greeting for new users in the chat,
 * with a typewriter animation and "Create My Avatar" button.
 * The Ember icon follows alongside as new messages appear.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDragon, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';

// Typewriter hook for video game dialogue effect
// enabled: controls when typing starts (for sequencing multiple lines)
function useTypewriter(text: string, speed: number = 30, startDelay: number = 0, enabled: boolean = true) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    // Don't start until enabled
    if (!enabled) return;

    // Reset for this run
    setDisplayedText('');
    setIsComplete(false);

    let index = 0;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startTimeout = setTimeout(() => {
      intervalId = setInterval(() => {
        if (index < text.length) {
          index++;
          setDisplayedText(text.slice(0, index));
        } else {
          setIsComplete(true);
          if (intervalId) clearInterval(intervalId);
        }
      }, speed);
    }, startDelay);

    return () => {
      clearTimeout(startTimeout);
      if (intervalId) clearInterval(intervalId);
    };
  }, [text, speed, startDelay, enabled]);

  const skip = useCallback(() => {
    setDisplayedText(text);
    setIsComplete(true);
  }, [text]);

  return { displayedText, isComplete, skip };
}

// Ember avatar component - positioned to follow messages
function EmberAvatar({ isSpeaking = false }: { isSpeaking?: boolean }) {
  return (
    <motion.div
      initial={{ scale: 0, rotate: -20 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', delay: 0.1 }}
      className="relative flex-shrink-0 self-end"
    >
      {/* Outer speaking glow */}
      <motion.div
        animate={isSpeaking ? {
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        } : {}}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-orange-500/20 rounded-full blur-xl pointer-events-none"
      />
      {/* Avatar background */}
      <div className="absolute inset-[-4px] bg-black/60 rounded-full blur-md" />
      <div className="absolute inset-[-2px] bg-gradient-to-br from-orange-500/20 to-amber-500/10 rounded-full" />
      <div className="relative w-12 h-12 flex items-center justify-center bg-slate-900/80 rounded-full border border-orange-500/30">
        <motion.div
          animate={isSpeaking ? { scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 0.5, repeat: Infinity }}
        >
          <FontAwesomeIcon
            icon={faDragon}
            className="text-2xl text-orange-500 drop-shadow-[0_0_12px_rgba(249,115,22,0.6)]"
          />
        </motion.div>
      </div>
    </motion.div>
  );
}

// Dialogue bubble component - orange themed for Ember
function DialogueBubble({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`
        relative glass-subtle px-5 py-4 rounded
        bg-gradient-to-br from-orange-100/80 to-amber-50/60 dark:from-orange-500/10 dark:to-amber-500/5
        border border-orange-300/40 dark:border-orange-500/20
      `}
    >
      {children}
    </motion.div>
  );
}

interface OnboardingIntroMessageProps {
  username: string;
  onContinue: () => void;
  onSkip: () => void;
}

export function OnboardingIntroMessage({
  username,
  onContinue,
  onSkip,
}: OnboardingIntroMessageProps) {
  const [dialogueStep, setDialogueStep] = useState(0);
  const [hasCompletedOnce, setHasCompletedOnce] = useState(false);

  // Dialogue lines with typewriter effects
  // Each line only starts typing when its dialogue step is reached
  const line1 = useTypewriter(
    `Hi${username ? `, ${username}` : ''}! I'm Ember, your guide throughout your All Thrive journey.`,
    25,
    300,
    true // Line 1 starts immediately
  );
  const line2 = useTypewriter(
    "As you explore AI and our community, I'll be learning about you to give you a more personalized experience.",
    20,
    100,
    dialogueStep >= 1 // Line 2 starts when dialogue step 1 is reached
  );
  const line3 = useTypewriter(
    "Let's start by creating your All Thrive Avatar.",
    25,
    100,
    dialogueStep >= 2 // Line 3 starts when dialogue step 2 is reached
  );

  // Track if typing is in progress
  const isSpeaking =
    !line1.isComplete ||
    (!line2.isComplete && dialogueStep >= 1) ||
    (!line3.isComplete && dialogueStep >= 2);

  // Progress through dialogue steps
  useEffect(() => {
    if (line1.isComplete && dialogueStep === 0) {
      const timer = setTimeout(() => setDialogueStep(1), 400);
      return () => clearTimeout(timer);
    }
  }, [line1.isComplete, dialogueStep]);

  useEffect(() => {
    if (line2.isComplete && dialogueStep === 1) {
      const timer = setTimeout(() => setDialogueStep(2), 300);
      return () => clearTimeout(timer);
    }
  }, [line2.isComplete, dialogueStep]);

  useEffect(() => {
    if (line3.isComplete && dialogueStep === 2) {
      const timer = setTimeout(() => {
        setDialogueStep(3);
        setHasCompletedOnce(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [line3.isComplete, dialogueStep]);

  const handleSkip = () => {
    line1.skip();
    line2.skip();
    line3.skip();
    setDialogueStep(3);
    setHasCompletedOnce(true);
  };

  const showButton = dialogueStep >= 3;

  return (
    <motion.div
      initial={hasCompletedOnce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      className="py-4"
      onClick={!showButton ? handleSkip : undefined}
    >
      {/* Messages with Ember avatar alongside */}
      <div className="flex items-end gap-4">
        {/* Ember avatar - stays at bottom, following the last message */}
        <EmberAvatar isSpeaking={isSpeaking} />

        {/* Message bubbles stack */}
        <div className="flex-1 space-y-3 max-w-2xl">
          {/* Line 1: Greeting */}
          <DialogueBubble>
            <p className="text-slate-800 dark:text-orange-100 text-lg leading-relaxed">
              {line1.displayedText}
              {!line1.isComplete && <span className="animate-pulse text-orange-500 dark:text-orange-400 ml-0.5">|</span>}
            </p>
          </DialogueBubble>

          {/* Line 2: Personalization */}
          <AnimatePresence>
            {dialogueStep >= 1 && (
              <DialogueBubble>
                <p className="text-slate-700 dark:text-orange-100/90 text-lg leading-relaxed">
                  {line2.displayedText}
                  {!line2.isComplete && dialogueStep === 1 && (
                    <span className="animate-pulse text-orange-500 dark:text-orange-400 ml-0.5">|</span>
                  )}
                </p>
              </DialogueBubble>
            )}
          </AnimatePresence>

          {/* Line 3: CTA */}
          <AnimatePresence>
            {dialogueStep >= 2 && (
              <DialogueBubble>
                <p className="text-slate-800 dark:text-orange-100 text-lg leading-relaxed font-medium">
                  {line3.displayedText.split('All Thrive Avatar').map((part, i) =>
                    i === 0 ? (
                      part
                    ) : (
                      <span key={i}>
                        <span className="text-orange-600 dark:text-orange-300 font-semibold">All Thrive Avatar</span>
                        {part}
                      </span>
                    )
                  )}
                  {!line3.isComplete && dialogueStep === 2 && (
                    <span className="animate-pulse text-orange-500 dark:text-orange-400 ml-0.5">|</span>
                  )}
                </p>
              </DialogueBubble>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* CTA Buttons */}
      <AnimatePresence>
        {showButton && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-start gap-4 mt-5 ml-16"
          >
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onContinue}
              className="btn-primary px-8 py-3 text-base shadow-neon inline-flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faWandMagicSparkles} className="text-sm" />
              Create My Avatar
            </motion.button>
            <button
              onClick={onSkip}
              className="text-slate-500 text-sm hover:text-slate-400 transition-colors"
            >
              Skip for now
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skip hint */}
      {!showButton && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-slate-500 dark:text-slate-600 text-sm mt-4 ml-16"
        >
          Tap anywhere to skip
        </motion.p>
      )}
    </motion.div>
  );
}

export default OnboardingIntroMessage;
