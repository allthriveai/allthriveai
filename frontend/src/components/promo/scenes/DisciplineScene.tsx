import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import {
  faXmark,
  faCheck,
  faSpinner,
  faTerminal,
} from '@fortawesome/free-solid-svg-icons';

interface DisciplineSceneProps {
  elapsed: number;
  hidePlaceholder?: boolean;
}

// Phases (1.5s initial delay for screen recording)
// 7 scenes total, ~60s
const DELAY = 1500;
const PHASE = {
  title:      DELAY,            // Scene 0: Title card (0–1.5s)
  hook:       DELAY + 1500,     // Scene 1: Hook (1.5–5s)
  bareLoop:   DELAY + 5000,     // Scene 2: Without discipline (5–23s) — Plan mode 8s, bare loop 10s
  cicd:       DELAY + 21500,    // Scene 3: CI/CD parallel (23–31s)
  underHood:  DELAY + 29500,    // Scene 4: What agentic-loop does (31–39s)
  pipeline:   DELAY + 37500,    // Scene 5: Pipeline demo (39–49s)
  signs:      DELAY + 47500,    // Scene 6: Failures become knowledge (49–57s)
  cta:        DELAY + 55500,    // Scene 7: CTA (57–65s)
};

// --- Reusable Sub-Components ---

function TerminalBlock({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#1a1a2e] rounded-lg p-3 border border-white/10 font-mono w-full">
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-2 h-2 rounded-full bg-red-500/50" />
        <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
        <div className="w-2 h-2 rounded-full bg-green-500/50" />
        {title && <span className="text-white/40 text-xs ml-2">{title}</span>}
      </div>
      {children}
    </div>
  );
}

function ComparisonList({
  items,
  variant,
  staggerDelay = 0.15,
}: {
  items: string[];
  variant: 'bad' | 'good';
  staggerDelay?: number;
}) {
  const icon = variant === 'bad' ? faXmark : faCheck;
  const iconColor = variant === 'bad' ? 'text-rose-400' : 'text-emerald-400';

  return (
    <div className="flex flex-col gap-1.5">
      {items.map((item, i) => (
        <motion.div
          key={item}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * staggerDelay, type: 'spring', stiffness: 300, damping: 20 }}
          className="flex items-center gap-2"
        >
          <FontAwesomeIcon icon={icon} className={`w-3.5 h-3.5 ${iconColor} flex-shrink-0`} />
          <span className="text-white/50 text-sm">{item}</span>
        </motion.div>
      ))}
    </div>
  );
}

type PipelineStepStatus = 'pending' | 'running' | 'passed' | 'failed';

function PipelineAnimation({ elapsed, startTime }: { elapsed: number; startTime: number }) {
  const timeSince = elapsed - startTime;

  const steps = [
    { num: '1/5', label: 'Lint', detail: 'ESLint, Ruff (auto-fix enabled)' },
    { num: '2/5', label: 'Tests', detail: 'Unit tests + test file check' },
    { num: '3/5', label: 'PRD steps', detail: 'Execute testSteps from prd.json' },
    { num: '4/5', label: 'API smoke', detail: 'curl health + endpoint contracts' },
    { num: '5/5', label: 'Frontend smoke', detail: 'Load page, check for console errors' },
  ];

  // Timeline: 2 attempts — fail once, then pass
  // 0–1.4s:     Attempt 1 — steps 1,2 pass, step 3 fails
  // 1.4–2.4s:   Failure message + saving to last_failure.txt
  // 2.4–5.0s:   Attempt 2 — all 5 pass
  // 5.0s+:      ALL CHECKS PASSED (attempt 2/5)

  // Attempt 1: fail at step 3
  const a1Speed = 500;
  const a1FailAt = 2; // step index
  const a1FailTime = a1FailAt * a1Speed + 400;
  const a1MsgTime = a1FailTime + 200;
  const a1End = 2400;

  // Attempt 2: all pass
  const a2Start = a1End;
  const a2Speed = 450;
  const a2AllPassTime = a2Start + steps.length * a2Speed + 200;

  // Determine which attempt we're on
  const attempt = timeSince < a2Start ? 1 : 2;

  const showA1Fail = timeSince >= a1MsgTime;
  const allPassed = attempt === 2 && timeSince >= a2AllPassTime;

  const statusColor = (s: PipelineStepStatus) =>
    s === 'passed' ? 'text-emerald-400' : s === 'failed' ? 'text-rose-400' : 'text-amber-400';

  // Helper to render one attempt's steps
  const renderAttemptSteps = (attemptNum: number, getStatusFn: (i: number) => PipelineStepStatus) => (
    <div className="flex flex-col">
      {steps.map((step, i) => {
        const status = getStatusFn(i);
        if (status === 'pending') return null;
        return (
          <motion.div
            key={`a${attemptNum}-${step.label}`}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2 py-0.5"
          >
            <span className="text-white/40 text-xs">[{step.num}]</span>
            <span className={`text-sm font-medium ${statusColor(status)}`}>
              {step.label}
            </span>
            {status === 'running' && (
              <FontAwesomeIcon icon={faSpinner} className="w-3 h-3 text-amber-400 animate-spin" />
            )}
            {status === 'passed' && (
              <FontAwesomeIcon icon={faCheck} className="w-3 h-3 text-emerald-400" />
            )}
            {status === 'failed' && (
              <FontAwesomeIcon icon={faXmark} className="w-3 h-3 text-rose-400" />
            )}
            <span className="text-white/40 text-xs">{step.detail}</span>
          </motion.div>
        );
      })}
    </div>
  );

  // Status getters per attempt
  const getA1Status = (index: number): PipelineStepStatus => {
    const stepStart = index * a1Speed;
    if (index > a1FailAt) return 'pending';
    if (index === a1FailAt) {
      if (timeSince < a1FailAt * a1Speed) return 'pending';
      if (timeSince < a1FailTime) return 'running';
      return 'failed';
    }
    if (timeSince < stepStart) return 'pending';
    if (timeSince < stepStart + 300) return 'running';
    return 'passed';
  };

  const getA2Status = (index: number): PipelineStepStatus => {
    const t = timeSince - a2Start;
    const stepStart = index * a2Speed;
    if (t < stepStart) return 'pending';
    if (t < stepStart + 280) return 'running';
    return 'passed';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-1 w-full"
    >
      <TerminalBlock title="CODE-CHECK.md">
        {/* Attempt 1 */}
        <div className="flex items-center justify-between mb-1 pb-1 border-b border-white/10">
          <span className="text-white/50 text-xs">
            Attempt <span className="text-amber-400">1</span>/5
          </span>
        </div>
        {renderAttemptSteps(1, getA1Status)}

        {/* Attempt 1 failure */}
        {showA1Fail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-1.5 pt-1.5 border-t border-white/10"
          >
            <span className="text-rose-400 text-xs">FAILED: </span>
            <span className="text-white/50 text-xs">PRD step failed — curl /api/v1/users returned 500, missing migration</span>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-amber-400 text-xs mt-0.5"
            >
              → saving to last_failure.txt... Claude fixes + rerunning loop
            </motion.div>
          </motion.div>
        )}

        {/* Attempt 2 — all pass */}
        {attempt >= 2 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 pt-2 border-t border-white/10"
          >
            <div className="flex items-center justify-between mb-1 pb-1 border-b border-white/10">
              <span className="text-white/50 text-xs">
                Attempt <span className="text-emerald-400">2</span>/5
              </span>
              <span className="text-white/30 text-[10px]">
                error context from 1 prior attempt
              </span>
            </div>
            {renderAttemptSteps(2, getA2Status)}

            {/* All passed */}
            {allPassed && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="mt-2 pt-2 border-t border-white/10 text-center"
              >
                <span className="text-emerald-400 font-bold text-sm tracking-wide drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]">
                  ALL CHECKS PASSED
                </span>
                <span className="text-white/40 text-xs ml-2">(attempt 2/5)</span>
              </motion.div>
            )}
          </motion.div>
        )}
      </TerminalBlock>
    </motion.div>
  );
}

function GatePipeline({
  items,
  staggerDelay = 0.3,
}: {
  items: string[];
  staggerDelay?: number;
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {items.map((item, i) => (
        <motion.div
          key={item}
          initial={{ opacity: 0, x: -15, scale: 0.8 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ delay: i * staggerDelay, type: 'spring', stiffness: 200, damping: 15 }}
          className="flex items-center gap-1"
        >
          <motion.div
            className="flex flex-col items-center"
            animate={{
              boxShadow: [
                '0 0 0px rgba(52,211,153,0)',
                '0 0 8px rgba(52,211,153,0.3)',
                '0 0 0px rgba(52,211,153,0)',
              ],
            }}
            transition={{ delay: i * staggerDelay + 0.3, duration: 1.2, ease: 'easeInOut' }}
          >
            <motion.span
              className="text-white/90 text-xs px-2 py-1 bg-white/10 rounded border border-white/10"
              animate={{ borderColor: ['rgba(255,255,255,0.1)', 'rgba(52,211,153,0.4)', 'rgba(255,255,255,0.1)'] }}
              transition={{ delay: i * staggerDelay + 0.3, duration: 1.2, ease: 'easeInOut' }}
            >
              {item}
            </motion.span>
            <motion.span
              className="text-emerald-400/60 text-[9px] mt-0.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * staggerDelay + 0.2 }}
            >
              gate
            </motion.span>
          </motion.div>
          {i < items.length - 1 && (
            <motion.span
              className="text-white/30 text-xs mx-0.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * staggerDelay + 0.15 }}
            >
              →
            </motion.span>
          )}
        </motion.div>
      ))}
    </div>
  );
}

// --- Main Scene ---

export function DisciplineScene({ elapsed, hidePlaceholder: _hidePlaceholder = false }: DisciplineSceneProps) {
  const sceneTitle     = elapsed >= PHASE.title     && elapsed < PHASE.hook;
  const sceneHook      = elapsed >= PHASE.hook      && elapsed < PHASE.bareLoop;
  const sceneBareLoop  = elapsed >= PHASE.bareLoop   && elapsed < PHASE.cicd;
  const sceneCicd      = elapsed >= PHASE.cicd       && elapsed < PHASE.underHood;
  const sceneUnderHood = elapsed >= PHASE.underHood  && elapsed < PHASE.pipeline;
  const scenePipeline  = elapsed >= PHASE.pipeline   && elapsed < PHASE.signs;
  const sceneSigns     = elapsed >= PHASE.signs      && elapsed < PHASE.cta;
  const sceneCta       = elapsed >= PHASE.cta;

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
          right: '6%',
        }}
      >
        <AnimatePresence mode="wait">
          {/* Scene 0: Title card (0–1.5s) */}
          {sceneTitle && (
            <motion.div
              key="title"
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center h-full"
            >
              <h1 className="text-5xl font-extrabold text-white text-center tracking-tight">
                Agentic Loop
              </h1>
              <p className="text-white/60 text-xl text-center mt-3">
                Why the <span className="text-cyan-400">loop</span> is like CI/CD for your AI Coding
              </p>
            </motion.div>
          )}

          {/* Scene 1: Hook (1.5–5s) */}
          {sceneHook && (
            <motion.div
              key="hook"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center justify-center h-full"
            >
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-white/90 text-lg mb-2 text-center"
              >
                If you're using AI to write your code...
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-2xl font-bold text-white text-center"
              >
                <motion.span
                  animate={{ color: ['#fb7185', '#ffffff', '#fb7185'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  className="font-extrabold"
                >
                  You're
                </motion.span>{' '}
                still the verification.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="text-cyan-400 text-base text-center mt-3"
              >
                This is why you need a deterministic loop.
              </motion.p>
            </motion.div>
          )}

          {/* Scene 2: Bare Loop vs agentic-loop run (5–12s) */}
          {sceneBareLoop && (() => {
            const t = elapsed - PHASE.bareLoop;
            // Loop counter starts at 1 after 0.5s, ticks every 500ms
            const loopCount = Math.max(1, Math.min(Math.floor(Math.max(0, t - 500) / 500) + 1, 14));
            // Problems appear based on time, not loop count, for reliable timing
            const problems = [
              { delay: 1500, loop: 1, text: 'no tests ran', color: 'text-rose-400/70' },
              { delay: 2500, loop: 2, text: 'committed broken migration', color: 'text-rose-400/50' },
              { delay: 3500, loop: 3, text: 'same error as loop 1', color: 'text-rose-400/90' },
              { delay: 4500, loop: 4, text: 'broke something that was working', color: 'text-rose-400' },
              { delay: 5500, loop: 5, text: 'still broken', color: 'text-rose-400' },
            ];
            return (
              <motion.div
                key="bareLoop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col gap-3"
              >
                {/* Title */}
                <motion.h2
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-rose-400 text-lg font-bold text-center"
                >
                  Without a deterministic loop, this is what that looks like.
                </motion.h2>

                {/* Plan mode — no discipline */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-amber-400 text-xs font-medium font-mono">Plan mode</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {['Structured task list', 'No verification between steps', 'Fresh context every run', 'No memory of past failures'].map((item, i) => (
                      <motion.div
                        key={item}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + i * 0.12 }}
                        className="flex items-center gap-2"
                      >
                        <span className="text-amber-400/70 text-xs">~</span>
                        <span className="text-white/60 text-xs">{item}</span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>

                {/* Bare loop running live */}
                {t > 8000 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="flex items-center gap-2 mb-1 mt-3">
                      <span className="text-amber-400 text-xs font-medium">The bare Ralph loop</span>
                    </div>
                    <TerminalBlock>
                      <div className="flex items-center justify-between mb-1">
                        <pre className="text-xs text-rose-300/70 whitespace-pre">
                          <span className="text-white/40">$ </span>{'while :; do cat PROMPT.md | claude; done'}
                        </pre>
                        <span className="text-white/30 text-[10px] font-mono">loop {loopCount}</span>
                      </div>
                      <div className="flex flex-col gap-0.5 mt-1">
                        {problems.map((p) =>
                          t >= p.delay ? (
                            <motion.div
                              key={p.text}
                              initial={{ opacity: 0, x: -5 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.2 }}
                              className={`text-xs ${p.color} flex items-center gap-1.5`}
                            >
                              <FontAwesomeIcon icon={faXmark} className="w-2.5 h-2.5" />
                              <span>loop {p.loop}: {p.text}</span>
                            </motion.div>
                          ) : null
                        )}
                      </div>
                    </TerminalBlock>
                  </motion.div>
                )}

              </motion.div>
            );
          })()}

          {/* Scene 3: CI/CD Parallel — discipline solves chaos */}
          {sceneCicd && (
            <motion.div
              key="cicd"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col gap-4"
            >
              <motion.h2
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-cyan-400 text-lg font-bold text-center"
              >
                Remember deploying before CI/CD?
              </motion.h2>

              {/* Before CI/CD */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5 text-rose-400" />
                  <span className="text-rose-400 text-xs font-medium">Before CI/CD</span>
                </div>
                <ComparisonList
                  variant="bad"
                  items={[
                    'Write code',
                    'Deploy to production',
                    'Hope it works',
                    'Fix at 3am',
                  ]}
                />
              </motion.div>

              {/* After CI/CD */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <FontAwesomeIcon icon={faCheck} className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 text-xs font-medium">After CI/CD</span>
                </div>
                <GatePipeline items={['Write', 'Build', 'Test', 'Stage', 'Deploy']} />
              </motion.div>
            </motion.div>
          )}

          {/* Scene 4: What agentic-loop actually does */}
          {sceneUnderHood && (
            <motion.div
              key="underHood"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col gap-2"
            >
              <motion.h2
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-white text-lg font-bold text-center mb-1"
              >
                What <code className="text-emerald-400">npx agentic-loop run</code> actually does
              </motion.h2>

              <TerminalBlock title="agentic-loop pipeline">
                {[
                  { text: 'PRD check — validate & auto-fix stories before coding', color: 'text-violet-400', delay: 0.2 },
                  { text: 'Inject signs — learned patterns from past failures', color: 'text-amber-400', delay: 0.5 },
                  { text: 'Claude implements the story (context carries across retries)', color: 'text-blue-400', delay: 0.8 },
                  { text: '5-step verification: lint → tests → PRD steps → API smoke → frontend smoke', color: 'text-cyan-400', delay: 1.1 },
                  { text: 'Pass → git commit → next story', color: 'text-emerald-400', delay: 1.4 },
                  { text: 'Fail → accumulate errors → retry with context', color: 'text-rose-400', delay: 1.7 },
                  { text: 'Circuit breaker — skip after 5 retries', color: 'text-rose-400', delay: 2.0 },
                ].map((step) => (
                  <motion.div
                    key={step.text}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: step.delay, type: 'spring', stiffness: 300, damping: 20 }}
                    className="flex items-center gap-2 py-0.5"
                  >
                    <span className="text-white/30 text-xs">→</span>
                    <span className={`text-xs ${step.color}`}>{step.text}</span>
                  </motion.div>
                ))}
              </TerminalBlock>
            </motion.div>
          )}

          {/* Scene 6: The loop — verify, fail, learn, retry */}
          {scenePipeline && (
            <motion.div
              key="pipeline"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col gap-2"
            >
              <motion.h2
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-cyan-400 text-base font-bold text-center"
              >
                Real integration tests. Real verification.
              </motion.h2>
              <PipelineAnimation elapsed={elapsed} startTime={PHASE.pipeline} />
            </motion.div>
          )}

          {/* Scene 6: Failures become knowledge */}
          {sceneSigns && (
            <motion.div
              key="signs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col gap-3"
            >
              <motion.h2
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-cyan-400 text-lg font-bold text-center"
              >
                Failures become knowledge
              </motion.h2>

              <TerminalBlock title="signs.json — learned patterns">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-xs leading-relaxed"
                >
                  <span className="text-amber-400">sign added:</span>{' '}
                  <span className="text-white/70">"Run migrations before tests when schema changes"</span>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="text-xs text-white/40 mt-0.5"
                >
                  → injected into every future prompt
                </motion.div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.3 }}
                  className="text-xs text-emerald-400 mt-0.5"
                >
                  → never makes this mistake again
                </motion.div>
              </TerminalBlock>
            </motion.div>
          )}

          {/* Scene 7: CTA */}
          {sceneCta && (
            <motion.div
              key="cta"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center justify-center h-full"
            >
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-3xl font-extrabold text-white text-center tracking-tight"
              >
                Agentic Loop
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="text-2xl font-bold text-white text-center mt-2"
              >
                Discipline your loop.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-xl text-cyan-400 text-center mt-2"
              >
                Automate the verification at every step.
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom section - CTA left, face right */}
      <div
        className="absolute bottom-0 left-0 right-0 flex"
        style={{ height: '40%', zIndex: 50 }}
      >
        {/* Left: CTA content */}
        <div className="w-1/2 h-full flex flex-col justify-start -mt-8 pl-10 pr-4">
          <AnimatePresence>
            {sceneCta && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.6 }}
              >
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 mb-3 whitespace-nowrap">
                  <FontAwesomeIcon icon={faGithub} className="w-4 h-4 text-white" />
                  <span className="text-white font-medium text-xs">github.com/allierays/agentic-loop</span>
                </div>

                <div className="mt-2">
                  <div className="inline-flex items-center gap-2 px-2 py-1 rounded bg-[#1a1a2e] border border-white/10 mb-2">
                    <FontAwesomeIcon icon={faTerminal} className="w-3 h-3 text-emerald-400" />
                    <code className="text-emerald-400 text-xs">npm install agentic-loop</code>
                  </div>
                  <p className="text-white/50 text-xs leading-relaxed">
                    Pre-commit hooks.<br />
                    Verification pipeline.<br />
                    Signs.
                  </p>
                </div>
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

export default DisciplineScene;
