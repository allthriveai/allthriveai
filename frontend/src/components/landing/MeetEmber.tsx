/**
 * MeetEmber - Scroll-snap experience showing 3 scenarios (Learn, Share, Play)
 * Desktop: Sticky chat on right, scroll-snap scenarios on left
 * Mobile: Expandable cards
 */

import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion';
import { useRef, useState } from 'react';
import { AcademicCapIcon, ShareIcon, PuzzlePieceIcon } from '@heroicons/react/24/outline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWorm, faPlay } from '@fortawesome/free-solid-svg-icons';
import { Link } from 'react-router-dom';
import { ContextSnakeCore } from '@/components/games/ContextSnakeCore';

// ============================================
// SCENARIO DATA
// ============================================

type ScenarioId = 'learn' | 'share' | 'play';
type MessageType = 'user' | 'ember' | 'projects' | 'game' | 'cta' | 'share-cta' | 'url-input' | 'project-preview';

interface ChatMessage {
  type: MessageType;
  text?: string;
  showAvatar?: boolean; // Force show Ember avatar on this message
}

interface Scenario {
  id: ScenarioId;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  messages: ChatMessage[];
}

const scenarios: Scenario[] = [
  {
    id: 'learn',
    title: 'Learn',
    description: 'Ask questions, explore concepts',
    icon: AcademicCapIcon,
    accentColor: 'cyan',
    messages: [
      {
        type: 'user',
        text: "I don't understand what the context window is, can you help me?",
      },
      {
        type: 'ember',
        text: "Great question! The context window is what an AI can 'see' during your conversation. Here are some projects from the community:",
      },
      { type: 'projects' },
      {
        type: 'ember',
        text: 'Want to dive deeper? I made a learning path just for you:',
      },
      { type: 'cta' },
    ],
  },
  {
    id: 'share',
    title: 'Share',
    description: 'Let Ember create your project post',
    icon: ShareIcon,
    accentColor: 'purple',
    messages: [
      {
        type: 'user',
        text: "I just made my first chatbot! It's pretty basic but I'm proud of it.",
      },
      {
        type: 'ember',
        text: "That's amazing! I'd love to help you share it. Just paste a URL or upload an image!",
      },
      { type: 'url-input' },
      {
        type: 'ember',
        text: "I made a project for you! Here's what it looks like:",
        showAvatar: true,
      },
      { type: 'project-preview' },
    ],
  },
  {
    id: 'play',
    title: 'Play a Game',
    description: 'Learn through interactive games',
    icon: PuzzlePieceIcon,
    accentColor: 'emerald',
    messages: [
      {
        type: 'user',
        text: "I'm bored. Can we play something?",
      },
      {
        type: 'ember',
        text: "Absolutely! How about Context Snake? Eat tokens to grow your context window - but watch out for hallucinations!",
      },
      { type: 'game' },
      {
        type: 'ember',
        text: "Or if you're feeling competitive, try a Prompt Battle against other members!",
      },
    ],
  },
];

const exampleProjects = [
  {
    id: 1,
    title: 'Understanding Token Limits',
    creator: 'alex_learns',
    image: '/landing/project-token-limits.png',
    tool: 'ChatGPT',
  },
  {
    id: 2,
    title: 'Context in Image Prompts',
    creator: 'creative_sam',
    image: '/landing/project-context-prompts.png',
    tool: 'Midjourney',
  },
  {
    id: 3,
    title: 'Memory vs Context Window',
    creator: 'tech_jamie',
    image: '/landing/project-memory-context.png',
    tool: 'Claude',
  },
];

// ============================================
// SUB-COMPONENTS
// ============================================

function MiniProjectCard({ project, index }: { project: typeof exampleProjects[0]; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="group relative overflow-hidden rounded-xl bg-white/5 border border-white/10 hover:border-cyan-500/30 transition-all duration-300"
    >
      <div className="aspect-[4/3] overflow-hidden">
        <img
          src={project.image}
          alt={project.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>
      <div className="p-3">
        <h4 className="text-sm font-medium text-white truncate">{project.title}</h4>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-gray-400">@{project.creator}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400">
            {project.tool}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function GameCard({ onPlay }: { onPlay?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 p-4"
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
          <FontAwesomeIcon icon={faWorm} className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <h4 className="text-white font-semibold">Context Snake</h4>
          <p className="text-sm text-gray-400">Eat tokens, watch your context grow!</p>
        </div>
        {onPlay && (
          <button
            onClick={onPlay}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-sm font-medium flex items-center gap-2 hover:from-emerald-400 hover:to-cyan-400 transition-all"
          >
            <FontAwesomeIcon icon={faPlay} className="w-3 h-3" />
            Play
          </button>
        )}
      </div>
    </motion.div>
  );
}

function PlayableGame() {
  const [isPlaying, setIsPlaying] = useState(false);

  if (!isPlaying) {
    return <GameCard onPlay={() => setIsPlaying(true)} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="relative"
    >
      <ContextSnakeCore variant="mini" />
    </motion.div>
  );
}

function LearningPathCTA() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Link
        to="/learn"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-cyan-500 to-green-500 text-white font-medium hover:shadow-neon transition-all duration-300 hover:scale-105"
      >
        <AcademicCapIcon className="w-5 h-5" />
        AI Fundamentals Learning Path
      </Link>
    </motion.div>
  );
}

function ShareCTA() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Link
        to="/explore"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:shadow-neon transition-all duration-300 hover:scale-105"
      >
        <ShareIcon className="w-5 h-5" />
        Share Your Project
      </Link>
    </motion.div>
  );
}

function UrlInput() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex justify-end gap-3"
    >
      <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 flex items-center gap-3 max-w-[80%]">
        <div className="flex-1 text-sm text-cyan-400 truncate">
          https://github.com/sarah/my-first-chatbot
        </div>
        <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>
      <div className="flex-shrink-0">
        <img
          src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face"
          alt="You"
          className="w-8 h-8 rounded-full object-cover border-2 border-purple-400/50"
        />
      </div>
    </motion.div>
  );
}

function ProjectPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30"
    >
      {/* Project card preview */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-2xl flex-shrink-0">
            🤖
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-white font-semibold truncate">My First Chatbot</h4>
            <p className="text-sm text-gray-400 line-clamp-2 mt-1">
              A simple chatbot built with Python and the OpenAI API. It can answer questions and have basic conversations!
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">Python</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400">ChatGPT</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-400">Chatbot</span>
            </div>
          </div>
        </div>
      </div>
      {/* Auto-generated badge */}
      <div className="px-4 py-2 border-t border-white/10 flex items-center gap-2 text-xs text-gray-500">
        <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
        Auto-generated by Ember
      </div>
    </motion.div>
  );
}

function ChatBubble({
  type,
  children,
  showAvatar = false,
}: {
  type: 'user' | 'ember';
  children: React.ReactNode;
  showAvatar?: boolean;
}) {
  const isEmber = type === 'ember';

  return (
    <div className={`flex gap-3 ${isEmber ? '' : 'justify-end'}`}>
      {isEmber && showAvatar && (
        <div className="flex-shrink-0">
          <img
            src="/ember-avatar.png"
            alt="Ember"
            className="w-8 h-8 rounded-full border-2 border-cyan-500/50"
          />
        </div>
      )}
      {isEmber && !showAvatar && <div className="w-8" />}
      <div
        className={`max-w-[85%] px-4 py-3 rounded-2xl ${
          isEmber
            ? 'bg-white/10 border border-white/10 text-white rounded-tl-sm'
            : 'bg-cyan-600 text-white rounded-tr-sm'
        }`}
      >
        {children}
      </div>
      {!isEmber && (
        <div className="flex-shrink-0">
          <img
            src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face"
            alt="You"
            className="w-8 h-8 rounded-full object-cover border-2 border-purple-400/50"
          />
        </div>
      )}
    </div>
  );
}

// Render messages for a scenario
function ChatConversation({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="space-y-4">
      {messages.map((message, index) => {
        if (message.type === 'user') {
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <ChatBubble type="user">
                <p className="text-sm">{message.text}</p>
              </ChatBubble>
            </motion.div>
          );
        }

        if (message.type === 'ember') {
          const isFirstEmber = messages.slice(0, index).filter((m) => m.type === 'ember').length === 0;
          const shouldShowAvatar = message.showAvatar || isFirstEmber;
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <ChatBubble type="ember" showAvatar={shouldShowAvatar}>
                <p className="text-sm">{message.text}</p>
              </ChatBubble>
            </motion.div>
          );
        }

        if (message.type === 'projects') {
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              className="ml-11 grid grid-cols-3 gap-2"
            >
              {exampleProjects.map((project, pIndex) => (
                <MiniProjectCard key={project.id} project={project} index={pIndex} />
              ))}
            </motion.div>
          );
        }

        if (message.type === 'game') {
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              className="ml-11"
            >
              <PlayableGame />
            </motion.div>
          );
        }

        if (message.type === 'cta') {
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              className="ml-11"
            >
              <LearningPathCTA />
            </motion.div>
          );
        }

        if (message.type === 'share-cta') {
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              className="ml-11"
            >
              <ShareCTA />
            </motion.div>
          );
        }

        if (message.type === 'url-input') {
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <UrlInput />
            </motion.div>
          );
        }

        if (message.type === 'project-preview') {
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              className="ml-11"
            >
              <ProjectPreview />
            </motion.div>
          );
        }

        return null;
      })}
    </div>
  );
}

// Left-side scenario panel
function ScenarioSection({ scenario, isActive }: { scenario: Scenario; isActive: boolean }) {
  const Icon = scenario.icon;

  return (
    <div className="h-screen flex items-center justify-center snap-start snap-always">
      <motion.div
        animate={{ opacity: isActive ? 1 : 0.3 }}
        transition={{ duration: 0.3 }}
        className="text-center max-w-md px-8"
      >
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center border border-cyan-500/20">
          <Icon className="w-10 h-10 text-cyan-400" />
        </div>
        <h3 className="text-3xl font-bold text-white mb-3">{scenario.title}</h3>
        <p className="text-lg text-gray-400">{scenario.description}</p>
      </motion.div>
    </div>
  );
}

// Sticky Ember chat panel
function EmberChatPanel({ activeScenario }: { activeScenario: ScenarioId }) {
  const currentScenario = scenarios.find((s) => s.id === activeScenario);

  return (
    <div className="h-full flex flex-col glass-card rounded-2xl border border-white/10 overflow-hidden">
      {/* Chat header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 bg-white/5">
        <img
          src="/ember-avatar.png"
          alt="Ember"
          className="w-10 h-10 rounded-full border-2 border-cyan-500/50"
        />
        <div>
          <h3 className="text-white font-semibold">Ember</h3>
          <p className="text-xs text-green-400">Online</p>
        </div>
      </div>

      {/* Chat messages with AnimatePresence */}
      <div className="flex-1 overflow-y-auto p-5 scrollbar-hide">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeScenario}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <ChatConversation messages={currentScenario?.messages || []} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// Scenario indicator dots
function ScenarioIndicator({
  activeScenario,
  onSelect,
}: {
  activeScenario: ScenarioId;
  onSelect: (id: ScenarioId) => void;
}) {
  return (
    <div className="absolute left-8 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-20">
      {scenarios.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelect(s.id)}
          className={`w-3 h-3 rounded-full transition-all duration-300 ${
            activeScenario === s.id
              ? 'bg-cyan-400 scale-150'
              : 'bg-white/30 hover:bg-white/50'
          }`}
          aria-label={`Go to ${s.title} scenario`}
        />
      ))}
    </div>
  );
}

// Mobile expandable cards
function MobileScenarioCards() {
  const [expandedId, setExpandedId] = useState<ScenarioId | null>(null);

  return (
    <div className="space-y-4 px-6">
      {/* Section Header */}
      <div className="text-center mb-8">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          Meet{' '}
          <span className="bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent">
            Ember
          </span>
        </h2>
        <p className="text-lg text-gray-400">
          Your AI guide who knows the community and curates content just for you.
        </p>
      </div>

      {scenarios.map((scenario) => {
        const Icon = scenario.icon;
        const isExpanded = expandedId === scenario.id;

        return (
          <motion.div
            key={scenario.id}
            className="glass-card rounded-xl border border-white/10 overflow-hidden cursor-pointer"
            onClick={() => setExpandedId(isExpanded ? null : scenario.id)}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center gap-4 p-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center border border-cyan-500/20 flex-shrink-0">
                <Icon className="w-6 h-6 text-cyan-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white">{scenario.title}</h3>
                <p className="text-sm text-gray-400">{scenario.description}</p>
              </div>
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="text-gray-400"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </motion.div>
            </div>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 pt-0 border-t border-white/10">
                    <ChatConversation messages={scenario.messages} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function MeetEmber() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [activeScenario, setActiveScenario] = useState<ScenarioId>('learn');

  // Track scroll progress to determine active scenario
  const { scrollYProgress } = useScroll({
    container: scrollContainerRef,
    offset: ['start start', 'end end'],
  });

  useMotionValueEvent(scrollYProgress, 'change', (progress) => {
    if (progress < 0.33) {
      setActiveScenario('learn');
    } else if (progress < 0.66) {
      setActiveScenario('share');
    } else {
      setActiveScenario('play');
    }
  });

  // Scroll to scenario when indicator clicked
  const scrollToScenario = (id: ScenarioId) => {
    const index = scenarios.findIndex((s) => s.id === id);
    if (scrollContainerRef.current && index >= 0) {
      const scrollHeight = scrollContainerRef.current.scrollHeight;
      const targetScroll = (scrollHeight / scenarios.length) * index;
      scrollContainerRef.current.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }
  };

  return (
    <section className="relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[#020617]" />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: `
            radial-gradient(ellipse 60% 40% at 20% 50%, rgba(34, 211, 238, 0.1) 0%, transparent 50%),
            radial-gradient(ellipse 50% 30% at 80% 50%, rgba(168, 85, 247, 0.1) 0%, transparent 50%)
          `,
        }}
      />

      {/* Mobile Layout */}
      <div className="lg:hidden relative z-10 py-16">
        <MobileScenarioCards />
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:block relative z-10 h-[300vh]">
        <div className="sticky top-0 h-screen flex">
          {/* Left: Scroll-snap scenarios */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto snap-y snap-mandatory scrollbar-hide"
          >
            {scenarios.map((scenario) => (
              <ScenarioSection
                key={scenario.id}
                scenario={scenario}
                isActive={activeScenario === scenario.id}
              />
            ))}
          </div>

          {/* Right: Sticky Ember chat */}
          <div className="w-[420px] xl:w-[480px] h-screen p-6 pl-0">
            <EmberChatPanel activeScenario={activeScenario} />
          </div>

          {/* Scenario indicator dots */}
          <ScenarioIndicator activeScenario={activeScenario} onSelect={scrollToScenario} />
        </div>
      </div>
    </section>
  );
}
