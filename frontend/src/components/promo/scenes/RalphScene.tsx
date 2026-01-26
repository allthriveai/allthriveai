import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import {
  faLightbulb,
  faFileLines,
  faCode,
  faFlask,
  faBug,
  faRotate,
  faRobot,
} from '@fortawesome/free-solid-svg-icons';

interface RalphSceneProps {
  elapsed: number;
  hidePlaceholder?: boolean;
}

// Phases (1.5s initial delay for screen recording)
const DELAY = 1500;
const PHASE = {
  // Phase 1: Hook + Agents
  hook: DELAY,
  person: DELAY + 800,
  agents: DELAY + 1200,

  // Phase 2: RALPH intro
  ralph: DELAY + 3000,
  bashCode: DELAY + 4200,
  beauty: DELAY + 5500,

  // Phase 3: My flavor
  myFlavor: DELAY + 8000,
  loop: DELAY + 9000,
  cta: DELAY + 17000,
};

// Full agents animation - person scales up, then agents fan out
function AgentsAnimation({ showPerson, showAgents }: { showPerson: boolean; showAgents: boolean }) {
  const agents = [
    { color: 'from-cyan-400 to-blue-500', arrow: '↙', x: -60 },
    { color: 'from-violet-400 to-purple-500', arrow: '↓', x: -20 },
    { color: 'from-emerald-400 to-green-500', arrow: '↓', x: 20 },
    { color: 'from-amber-400 to-orange-500', arrow: '↘', x: 60 },
  ];

  return (
    <div className="flex flex-col items-center mt-6">
      {/* You - scales up */}
      <AnimatePresence>
        {showPerson && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="w-28 h-28 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center shadow-lg border border-white/30"
          >
            <span className="text-6xl">👩‍💻</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Arrows + Agents - fan out from center */}
      <div className="flex gap-3 mt-4 h-20">
        {agents.map((agent, i) => (
          <AnimatePresence key={i}>
            {showAgents && (
              <motion.div
                initial={{ opacity: 0, x: 0, y: -20 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ delay: i * 0.1, type: 'spring', stiffness: 300, damping: 20 }}
                className="flex flex-col items-center"
              >
                <span className="text-white/40 text-lg mb-2">{agent.arrow}</span>
                <div
                  className={`w-14 h-14 rounded-xl bg-gradient-to-br ${agent.color} flex items-center justify-center shadow-lg`}
                >
                  <FontAwesomeIcon icon={faRobot} className="w-7 h-7 text-white" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        ))}
      </div>
    </div>
  );
}

// Loop bubbles with synced explanations
function LoopDiagram({ elapsed, startTime }: { elapsed: number; startTime: number }) {
  const timeSince = elapsed - startTime;

  const steps = [
    { icon: faLightbulb, label: 'idea', color: 'text-amber-400', explanation: 'Brainstorm with Claude' },
    { icon: faFileLines, label: 'PRD', color: 'text-violet-400', explanation: 'AI generates test-driven tasks' },
    { icon: faCode, label: 'code', color: 'text-cyan-400', explanation: 'Claude implements each task' },
    { icon: faFlask, label: 'test', color: 'text-green-400', explanation: 'Auto-runs tests & hooks' },
    { icon: faBug, label: 'fix', color: 'text-rose-400', explanation: 'Retries with error context' },
    { icon: faRotate, label: 'repeat', color: 'text-blue-400', explanation: 'Learns and improves each loop' },
  ];

  const topRow = steps.slice(0, 3);
  const bottomRow = steps.slice(3, 6);

  // Each step gets 1.5 seconds, no repeat
  const stepDuration = 1500;
  const activeIndex = timeSince > 500 ? Math.min(5, Math.floor((timeSince - 500) / stepDuration)) : -1;
  const activeStep = activeIndex >= 0 ? steps[activeIndex] : null;

  const renderStep = (step: typeof steps[0], globalIndex: number) => {
    const isActive = globalIndex === activeIndex;
    const isPast = globalIndex < activeIndex;

    return (
      <motion.div
        key={step.label}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, delay: globalIndex * 0.1 }}
        className="flex flex-col items-center"
      >
        <motion.div
          animate={isActive ? { scale: 1.1 } : { scale: 1 }}
          transition={{ duration: 0.3 }}
          className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
            isActive ? 'bg-white/25 border-white/50' : isPast ? 'bg-white/15 border-white/20' : 'bg-white/10 border-white/10'
          }`}
        >
          <FontAwesomeIcon icon={step.icon} className={`w-5 h-5 ${step.color}`} />
        </motion.div>
        <span className={`text-sm mt-2 ${isActive ? 'text-white' : isPast ? 'text-white/60' : 'text-white/40'}`}>
          {step.label}
        </span>
      </motion.div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-3 mt-4"
    >
      <div className="flex items-center justify-center gap-3">
        {steps.map((step, i) => renderStep(step, i))}
      </div>

      {/* Stacking explanations - each line stays visible */}
      <div className="flex flex-col items-center gap-1 mt-3">
        {steps.map((step, index) => (
          <AnimatePresence key={step.label}>
            {index <= activeIndex && (
              <motion.p
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="text-white/80 text-sm text-center"
              >
                <span className={step.color}>{step.label}</span>
                <span className="text-white/50"> → </span>
                {step.explanation}
              </motion.p>
            )}
          </AnimatePresence>
        ))}
      </div>
    </motion.div>
  );
}

// Typewriter
function Type({ text, speed = 30 }: { text: string; speed?: number }) {
  return (
    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {text.split('').map((char, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * (speed / 1000) }}
        >
          {char}
        </motion.span>
      ))}
    </motion.span>
  );
}

// Bash code block
function BashCodeBlock() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mt-3"
    >
      <div className="bg-[#1a1a2e] rounded-lg p-3 border border-white/10 font-mono">
        <div className="flex items-center gap-1 mb-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500/80" />
          <div className="w-2 h-2 rounded-full bg-yellow-500/80" />
          <div className="w-2 h-2 rounded-full bg-green-500/80" />
        </div>
        <code className="text-green-400 text-sm">
          $ while :; do cat PROMPT.md | claude; done
        </code>
      </div>
    </motion.div>
  );
}

export function RalphScene({ elapsed, hidePlaceholder = false }: RalphSceneProps) {
  const phase1 = elapsed >= PHASE.hook && elapsed < PHASE.ralph;
  const phase2 = elapsed >= PHASE.ralph && elapsed < PHASE.myFlavor;
  const phase3 = elapsed >= PHASE.myFlavor;

  return (
    <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="absolute inset-0 bg-[#0a0a12]" />

      {/* Animation content - top 60% of frame */}
      <div
        className="absolute flex flex-col justify-start pt-[6%]"
        style={{
          top: '4%',
          bottom: '40%',
          left: '6%',
          right: '6%'
        }}
      >
        <AnimatePresence mode="wait">
          {/* Phase 1: Hook + Agents - text first, then person, then agents */}
          {phase1 && (
            <motion.div
              key="phase1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center"
            >
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-white/90 text-lg mb-1 text-center"
              >
                The future of coding isn't writing code.
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-2xl font-bold text-white text-center"
              >
It's directing coding agents.
              </motion.h1>
              <AgentsAnimation
                showPerson={elapsed >= PHASE.person}
                showAgents={elapsed >= PHASE.agents}
              />
            </motion.div>
          )}

          {/* Phase 2: RALPH intro */}
          {phase2 && (
            <motion.div
              key="phase2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col"
            >
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-lg text-white/80 text-center"
              >
                It's simpler than you think.
              </motion.p>
              <motion.h1
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 }}
                className="text-cyan-400 text-3xl font-bold mt-2 text-center"
              >
                RALPH Loop
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-white/50 text-xs mt-2 text-center"
              >
                by <span className="text-cyan-400">@ghuntley</span>
              </motion.p>

              {elapsed >= PHASE.bashCode && <BashCodeBlock />}

              {elapsed >= PHASE.beauty && (
                <motion.p
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-white text-base mt-4 leading-relaxed text-center"
                >
                  So what do I put in my loop?
                </motion.p>
              )}
            </motion.div>
          )}

          {/* Phase 3: My flavor - agentic-loop */}
          {phase3 && (
            <motion.div
              key="phase3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col"
            >
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-lg text-white/80 text-center"
              >
                What I put in my RALPH loop:
              </motion.p>

              {elapsed >= PHASE.loop && (
                <LoopDiagram elapsed={elapsed} startTime={PHASE.loop} />
              )}

              {elapsed >= PHASE.cta && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3"
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom section - CTA left, face right */}
      <div
        className="absolute bottom-0 left-0 right-0 flex"
        style={{ height: '40%', zIndex: 50 }}
      >
        {/* Left: CTA content - appears at 17s */}
        <div className="w-1/2 h-full flex flex-col justify-start -mt-4 pl-10 pr-4">
          <AnimatePresence>
            {elapsed >= PHASE.cta && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 mb-3 whitespace-nowrap">
                  <FontAwesomeIcon icon={faGithub} className="w-4 h-4 text-white" />
                  <span className="text-white font-medium text-xs">github.com/allierays/agentic-loop</span>
                </div>
                <p className="text-white/70 text-sm leading-relaxed">
                  Try it on your own project.<br />
                  Tweak it.<br />
                  Make it yours.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: Space for face */}
        <div className="w-1/2 h-full" />
      </div>
    </motion.div>
  );
}

export default RalphScene;
