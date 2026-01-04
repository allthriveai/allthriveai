/**
 * UnifiedLanding - Full-page parallax scroll experience
 *
 * Structure:
 * 1. "Feeling overwhelmed by AI?" + Logo cloud (right)
 * 2. "What is All Thrive" + Ava chat appears (right, fades in from logo cloud)
 * 3-5. Learn, Share, Play scenarios + Ava chat stays sticky
 */

import { motion, useScroll, useTransform, useMotionValueEvent, AnimatePresence } from 'framer-motion';
import { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { AcademicCapIcon, ShareIcon, PuzzlePieceIcon, BookOpenIcon } from '@heroicons/react/24/outline';

// Custom hook for mobile detection
function useIsMobile(breakpoint = 1024) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < breakpoint);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [breakpoint]);

  return isMobile;
}
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWorm, faPlay, faLink, faCode, faWrench, faHammer } from '@fortawesome/free-solid-svg-icons';
import { faGithub, faGitlab, faFigma, faYoutube } from '@fortawesome/free-brands-svg-icons';
import { BattleSimulation } from './BattleSimulation';
import { Testimonials } from './Testimonials';
import { FinalCTA } from './FinalCTA';
import { Footer } from './Footer';
import { ContextSnakeCore } from '@/components/games/ContextSnakeCore';
import { getPlatformStats, formatStat, type PlatformStats } from '@/services/stats';

interface UnifiedLandingProps {
  onRequestInvite: () => void;
}

// ============================================
// TYPES & DATA
// ============================================

type SectionId = 'hero' | 'learn' | 'paths' | 'share' | 'see';
type MessageType = 'user' | 'ava' | 'projects' | 'game' | 'cta' | 'url-input' | 'project-preview' | 'battle' | 'learning-path-preview' | 'exercise-picker';

interface ChatMessage {
  type: MessageType;
  text?: string;
  showAvatar?: boolean;
}


// All messages in order - each has a section it belongs to
interface ConversationMessage extends ChatMessage {
  section: SectionId;
}

const allMessages: ConversationMessage[] = [
  // Learn section
  { section: 'learn', type: 'user', text: "Help me understand what the context window is" },
  { section: 'learn', type: 'ava', text: "The best way to learn is by playing! In Context Snake, you ARE the context window. Eat tokens → your context fills up. Grow too long → context overflow!" },
  { section: 'learn', type: 'game' },
  // Paths section
  { section: 'paths', type: 'user', text: "I want to get better at building AI apps" },
  { section: 'paths', type: 'ava', text: "Here's a personalized learning path based on your skills and interests:" },
  { section: 'paths', type: 'learning-path-preview' },
  { section: 'paths', type: 'ava', text: "Pick an exercise to get started:" },
  { section: 'paths', type: 'exercise-picker' },
  // Share section
  { section: 'share', type: 'user', text: "I just made my first chatbot! It's pretty basic but I'm proud of it." },
  { section: 'share', type: 'ava', text: "That's amazing! I'd love to help you share it. Just paste a URL or upload an image!" },
  { section: 'share', type: 'url-input' },
  { section: 'share', type: 'ava', text: "I made a project for you! Here's what it looks like:", showAvatar: true },
  { section: 'share', type: 'project-preview' },
  // See section
  { section: 'see', type: 'user', text: "Help me understand and choose a Vector Database" },
  { section: 'see', type: 'ava', text: "Great question! Here are some projects from the community that use vector databases:" },
  { section: 'see', type: 'projects' },
];


const exampleProjects = [
  { id: 1, title: 'weave-cli', creator: 'mmaximilien', image: '/weave-cli.png', tool: 'Project' },
  { id: 2, title: 'Vector DB Comparison', creator: 'allthriveai', image: '/vector-database-promo.png', tool: 'Learning Path' },
];

// ============================================
// CHAT COMPONENTS (reused from MeetAva)
// ============================================

function MiniProjectCard({ project, index }: { project: typeof exampleProjects[0]; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="group relative overflow-hidden rounded bg-white/5 border border-white/10 hover:border-cyan-500/30 transition-all duration-300"
    >
      <div className="aspect-[4/3] overflow-hidden">
        <img src={project.image} alt={project.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
      </div>
      <div className="p-2">
        <h4 className="text-xs font-medium text-white truncate">{project.title}</h4>
        <span className="text-xs text-gray-400 truncate block">@{project.creator}</span>
        <span className="inline-block mt-1 text-xs px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 truncate max-w-full">{project.tool}</span>
      </div>
    </motion.div>
  );
}

function GameCard({ onPlay }: { onPlay?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: [1, 1.02, 1] }}
      transition={{ duration: 0.4, scale: { duration: 1.5, repeat: Infinity, ease: "easeInOut" } }}
      className="relative overflow-hidden rounded bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 p-4 cursor-pointer shadow-lg shadow-emerald-500/20"
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
          <FontAwesomeIcon icon={faWorm} className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <h4 className="text-white font-semibold">Context Snake</h4>
          <p className="text-sm text-gray-400">Eat tokens, watch your context grow!</p>
        </div>
        {onPlay && (
          <button
            onClick={onPlay}
            className="px-4 py-2 rounded bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-sm font-medium flex items-center gap-2 hover:from-emerald-400 hover:to-cyan-400 transition-all shadow-lg shadow-emerald-500/25"
          >
            <FontAwesomeIcon icon={faPlay} className="w-3 h-3" />
            Play
          </button>
        )}
      </div>
    </motion.div>
  );
}

function PlayableGame({ isPlaying, onPlay }: { isPlaying: boolean; onPlay: () => void }) {
  if (!isPlaying) return <GameCard onPlay={onPlay} />;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="rounded border-2 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)] p-1"
    >
      <ContextSnakeCore variant="mini" />
    </motion.div>
  );
}

const games = [
  { id: 'context-snake', name: 'Context Snake', image: '/games/game-context-snake-promo.png', description: 'Learn how AI context windows work by playing as the context itself. Eat tokens, grow longer, but don\'t overflow!' },
  { id: 'weekly-challenge', name: 'Weekly Challenge', image: '/weekly-challenge-promo.png', description: 'Weekly community challenges about different AI concepts.' },
  { id: 'ethics-defender', name: 'Ethics Defender', image: '/games/game-ethics-defender-promo.png', description: 'Defend against AI ethics threats. Learn about bias, transparency, and responsible AI while blasting through challenges.' },
  { id: 'prompt-battle', name: 'Prompt Battle', image: '/games/game-prompt-battle-promo.png', description: 'Go head-to-head with other players. Write the best prompt to match the image and see who comes out on top.' },
];

function GameCarousel({ onPlayContextSnake }: { onPlayContextSnake: () => void }) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="flex gap-6 items-start">
      <div className="max-w-[280px] flex-shrink-0">
        <button
          onClick={activeIndex === 0 ? onPlayContextSnake : undefined}
          className={`block w-full ${activeIndex === 0 ? 'cursor-pointer hover:scale-[1.02] transition-transform' : 'cursor-default'}`}
        >
          <img
            src={games[activeIndex].image}
            alt={games[activeIndex].name}
            className="rounded border border-white/10 shadow-lg w-full"
          />
        </button>
        <div className="flex justify-center gap-2 mt-3">
          {games.map((game, index) => (
            <button
              key={game.id}
              onClick={() => setActiveIndex(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === activeIndex ? 'bg-cyan-400 w-6' : 'bg-white/30 hover:bg-white/50'
              }`}
              aria-label={`View ${game.name}`}
            />
          ))}
        </div>
      </div>
      <div className="flex-1">
        <h4 className="text-lg font-semibold text-white mb-2">{games[activeIndex].name}</h4>
        <p className="text-gray-400">{games[activeIndex].description}</p>
      </div>
    </div>
  );
}

function LearningPathPreview() {
  const topics = [
    { name: 'Understanding Embeddings', current: true },
    { name: 'Building RAG Applications', current: false },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="rounded bg-white/5 border border-cyan-500/30 p-3"
    >
      <h4 className="text-cyan-400 font-medium text-xs mb-2">Your Learning Path</h4>
      <div className="space-y-1.5">
        {topics.map((topic, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
              topic.current
                ? 'bg-cyan-500'
                : 'border border-white/30'
            }`}>
              {topic.current && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
            </div>
            <span className={`text-xs ${topic.current ? 'text-white' : 'text-gray-500'}`}>
              {topic.name}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function ExercisePicker() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="grid grid-cols-2 gap-1.5"
    >
      <div className="rounded bg-white/5 border border-white/10 p-2 hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all cursor-pointer">
        <FontAwesomeIcon icon={faCode} className="w-3 h-3 text-cyan-400 mb-1" />
        <div className="text-[10px] text-white/80">Code walkthrough</div>
      </div>
      <div className="rounded bg-white/5 border border-white/10 p-2 hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all cursor-pointer">
        <FontAwesomeIcon icon={faWrench} className="w-3 h-3 text-cyan-400 mb-1" />
        <div className="text-[10px] text-white/80">Hands-on exercise</div>
      </div>
      <div className="rounded bg-white/5 border border-white/10 p-2 hover:border-pink-500/50 hover:bg-pink-500/10 transition-all cursor-pointer">
        <FontAwesomeIcon icon={faPlay} className="w-3 h-3 text-pink-400 mb-1" />
        <div className="text-[10px] text-white/80">Video explanation</div>
      </div>
      <div className="rounded bg-white/5 border border-white/10 p-2 hover:border-pink-500/50 hover:bg-pink-500/10 transition-all cursor-pointer">
        <FontAwesomeIcon icon={faHammer} className="w-3 h-3 text-pink-400 mb-1" />
        <div className="text-[10px] text-white/80">Build a project</div>
      </div>
    </motion.div>
  );
}

function CodeWalkthroughPreview() {
  return (
    <div className="rounded-lg bg-white/5 border border-white/10 overflow-hidden max-w-xl">
      {/* Path header */}
      <div className="px-4 py-3 border-b border-white/10 bg-white/5">
        <div className="text-sm text-white font-medium mb-2">Building a RAG Chatbot</div>
        {/* Step indicators */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-[10px]">✓</div>
            <span className="text-xs text-gray-500">Setup</span>
          </div>
          <div className="w-4 h-0.5 bg-green-500/30" />
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-cyan-500 text-white flex items-center justify-center text-[10px] font-medium">2</div>
            <span className="text-xs text-white font-medium">Embeddings</span>
          </div>
          <div className="w-4 h-0.5 bg-white/10" />
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-white/10 text-gray-500 flex items-center justify-center text-[10px]">3</div>
            <span className="text-xs text-gray-500">Vector DB</span>
          </div>
          <div className="w-4 h-0.5 bg-white/10" />
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-white/10 text-gray-500 flex items-center justify-center text-[10px]">4</div>
            <span className="text-xs text-gray-500">Query</span>
          </div>
        </div>
      </div>

      {/* Content: code + quiz side by side */}
      <div className="flex">
        {/* Code side */}
        <div className="flex-1 p-4 border-r border-white/10 bg-slate-900/50">
          <div className="text-xs text-gray-400 mb-2">Step through the code:</div>
          <pre className="text-xs text-gray-400 font-mono leading-loose">
            <span className="text-purple-400">def</span> chatbot_respond(msg):{'\n'}
            {'  '}<span className="text-purple-400">if</span> <span className="text-green-400">"weather"</span> <span className="text-purple-400">in</span> msg:{'\n'}
          </pre>
          {/* Highlighted lines */}
          <div className="bg-cyan-500/20 border-l-2 border-cyan-400 -mx-4 px-4 py-1 my-1">
            <pre className="text-xs text-white font-mono leading-loose">
              {'    '}city = extract_city(msg){'\n'}
              {'    '}<span className="text-purple-400">return</span> get_weather(city)
            </pre>
          </div>
          <pre className="text-xs text-gray-400 font-mono leading-loose">
            {'  '}<span className="text-purple-400">return</span> <span className="text-green-400">"How can I help?"</span>
          </pre>
        </div>

        {/* Quiz side */}
        <div className="w-52 p-4 bg-slate-900/30">
          <div className="text-xs text-cyan-400 font-medium mb-1">Question</div>
          <div className="text-sm text-white font-medium mb-3">
            When does the chatbot call get_weather?
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer hover:text-gray-300">
              <div className="w-4 h-4 rounded-full border border-gray-600 flex-shrink-0" />
              <span>On every message</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-green-400">
              <div className="w-4 h-4 rounded-full border-2 border-green-400 bg-green-400/20 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px]">✓</span>
              </div>
              <span>When "weather" is in msg</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer hover:text-gray-300">
              <div className="w-4 h-4 rounded-full border border-gray-600 flex-shrink-0" />
              <span>Only for city names</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function UrlInput() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex justify-end gap-3">
      <div className="bg-white/10 border border-white/20 rounded px-4 py-3 flex items-center gap-3 max-w-[80%]">
        <div className="flex-1 text-sm text-cyan-400 truncate">https://github.com/sarah/my-first-chatbot</div>
        <div className="w-8 h-8 rounded bg-cyan-500 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>
      <img
        src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face"
        alt="You"
        className="w-8 h-8 rounded-full object-cover border-2 border-purple-400/50 flex-shrink-0"
      />
    </motion.div>
  );
}

function ProjectPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-16 h-16 rounded bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-2xl flex-shrink-0">🤖</div>
          <div className="flex-1 min-w-0">
            <h4 className="text-white font-semibold truncate">My First Chatbot</h4>
            <p className="text-sm text-gray-400 line-clamp-2 mt-1">A simple chatbot built with Python and the OpenAI API.</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">Python</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400">ChatGPT</span>
            </div>
          </div>
        </div>
      </div>
      <div className="px-4 py-2 border-t border-white/10 flex items-center gap-2 text-xs text-gray-500">
        <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
        Auto-generated by Ava
      </div>
    </motion.div>
  );
}

function BattlePreview() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded bg-slate-900/80 border border-white/10"
    >
      {/* Challenge prompt header */}
      <div className="p-3 border-b border-white/10 bg-gradient-to-r from-rose-500/10 to-purple-500/10">
        <p className="text-xs text-rose-400 font-medium uppercase tracking-wide mb-1">Challenge</p>
        <p className="text-sm text-white italic">"A robot cat chef cooking a pizza in a futuristic kitchen"</p>
      </div>

      {/* Two images side by side */}
      <div className="flex gap-2 p-3">
        {/* Player 1 - Winner */}
        <div className="flex-1 relative">
          <div className="aspect-square rounded overflow-hidden bg-slate-800 mb-2 ring-2 ring-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.3)] relative">
            <img
              src="/battle-robot-cat-1.png"
              alt="Robot cat chef making pizza"
              className="w-full h-full object-cover"
            />
            <div className="absolute top-1 right-1 p-1 rounded-full bg-amber-500">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z"/>
              </svg>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=alex" alt="alex" className="w-5 h-5 rounded-full border border-cyan-500" />
              <span className="text-xs text-white font-medium">alex_dev</span>
            </div>
            <span className="text-xs font-bold text-amber-400">8.7</span>
          </div>
        </div>

        {/* VS */}
        <div className="flex flex-col items-center justify-center px-1">
          <div className="w-px flex-1 bg-gradient-to-b from-transparent via-cyan-500/50 to-transparent" />
          <span className="my-2 px-2 py-0.5 rounded-full bg-slate-800 border border-cyan-500/30 text-cyan-400 font-bold text-xs">
            VS
          </span>
          <div className="w-px flex-1 bg-gradient-to-b from-transparent via-cyan-500/50 to-transparent" />
        </div>

        {/* Player 2 */}
        <div className="flex-1">
          <div className="aspect-square rounded overflow-hidden bg-slate-800 mb-2">
            <img
              src="/battle-robot-cat-2.png"
              alt="Robot cat chef with pizza"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=maya" alt="maya" className="w-5 h-5 rounded-full border border-purple-500" />
              <span className="text-xs text-white font-medium">maya_creates</span>
            </div>
            <span className="text-xs font-bold text-slate-400">7.2</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ChatBubble({ type, children, showAvatar = false }: { type: 'user' | 'ava'; children: React.ReactNode; showAvatar?: boolean }) {
  const isAva = type === 'ava';
  return (
    <div className={`flex gap-3 ${isAva ? '' : 'justify-end'}`}>
      {isAva && showAvatar && (
        <div className="flex-shrink-0">
          <img src="/ava-avatar.png" alt="Ava" className="w-8 h-8 rounded-full border-2 border-cyan-500/50" />
        </div>
      )}
      {isAva && !showAvatar && <div className="w-8" />}
      <div className={`max-w-[85%] px-4 py-3 rounded ${isAva ? 'bg-white/10 border border-white/10 text-white' : 'bg-cyan-600 text-white'}`}>
        {children}
      </div>
      {!isAva && (
        <img
          src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face"
          alt="You"
          className="w-8 h-8 rounded-full object-cover border-2 border-purple-400/50 flex-shrink-0"
        />
      )}
    </div>
  );
}

function ChatConversation({ messages, isGamePlaying, onStartGame, activeSection }: { messages: ChatMessage[]; isGamePlaying: boolean; onStartGame: () => void; activeSection: SectionId }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeSection}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="space-y-4"
      >
        {messages.map((message, index) => {
          const key = `${activeSection}-${message.type}-${index}`;

          if (message.type === 'user') {
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <ChatBubble type="user"><p className="text-base">{message.text}</p></ChatBubble>
              </motion.div>
            );
          }
          if (message.type === 'ava') {
            const isFirstAva = messages.slice(0, index).filter((m) => m.type === 'ava').length === 0;
            const shouldShowAvatar = message.showAvatar || isFirstAva;
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <ChatBubble type="ava" showAvatar={shouldShowAvatar}><p className="text-base">{message.text}</p></ChatBubble>
              </motion.div>
            );
          }
          if (message.type === 'projects') {
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="ml-11 grid grid-cols-2 gap-3"
              >
                {exampleProjects.map((project, pIndex) => <MiniProjectCard key={project.id} project={project} index={pIndex} />)}
              </motion.div>
            );
          }
          if (message.type === 'game') {
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="ml-11"
              >
                <PlayableGame isPlaying={isGamePlaying} onPlay={onStartGame} />
              </motion.div>
            );
          }
          if (message.type === 'url-input') {
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <UrlInput />
              </motion.div>
            );
          }
          if (message.type === 'project-preview') {
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="ml-11"
              >
                <ProjectPreview />
              </motion.div>
            );
          }
          if (message.type === 'battle') {
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="ml-11"
              >
                <BattlePreview />
              </motion.div>
            );
          }
          if (message.type === 'learning-path-preview') {
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="ml-11"
              >
                <LearningPathPreview />
              </motion.div>
            );
          }
          if (message.type === 'exercise-picker') {
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="ml-11"
              >
                <ExercisePicker />
              </motion.div>
            );
          }
          return null;
        })}
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================
// RIGHT SIDE COMPONENTS
// ============================================

function AvaChatPanel({ activeSection, isGamePlaying, onStartGame }: { activeSection: SectionId; isGamePlaying: boolean; onStartGame: () => void }) {
  // Get only messages for the CURRENT section (not accumulated)
  const currentSectionMessages = useMemo(() => {
    return allMessages.filter(msg => msg.section === activeSection);
  }, [activeSection]);

  return (
    <div className="h-full flex flex-col glass-card rounded border border-white/10 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 bg-white/5">
        <img src="/ava-avatar.png" alt="Ava" className="w-10 h-10 rounded-full border-2 border-cyan-500/50" />
        <div>
          <h3 className="text-white font-semibold">All Thrive Chat</h3>
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-400"></span>
            Ava · Online
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-5 scrollbar-hide">
        {activeSection === 'hero' ? (
          <div className="h-full flex items-center justify-center text-gray-500 text-sm">
            <p>Scroll down to start chatting with Ava</p>
          </div>
        ) : (
          <ChatConversation messages={currentSectionMessages} isGamePlaying={isGamePlaying} onStartGame={onStartGame} activeSection={activeSection} />
        )}
      </div>
    </div>
  );
}

// ============================================
// LEFT SIDE SECTIONS
// ============================================

function HeroContent({ onRequestInvite }: { onRequestInvite: () => void }) {
  return (
    <div className="h-screen flex items-center">
      <div className="text-left max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <h1 className="font-bold tracking-tight mb-8">
            <span className="block text-6xl sm:text-7xl md:text-8xl leading-tight">
              <span className="text-white">Explore AI </span>
              <span
                style={{
                  background: 'linear-gradient(90deg, #22d3ee, #4ade80)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                together
              </span>
            </span>
          </h1>
          <p className="text-2xl text-gray-300 mb-10">Games and challenges. Personalized learning paths.<br />Share what you're building.</p>
          <button
            onClick={onRequestInvite}
            className="px-8 py-4 rounded bg-gradient-to-r from-cyan-400 to-green-400 text-[#020617] font-semibold text-lg shadow-neon hover:shadow-neon-strong transition-all duration-300 hover:scale-105"
          >
            Join Waitlist
          </button>
        </motion.div>
      </div>
    </div>
  );
}


function FeatureContent({ icon: Icon, title, description, children }: { icon: React.ComponentType<{ className?: string }>; title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="h-screen flex items-center justify-start">
      <div className="max-w-2xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="w-16 h-16 rounded bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center border border-cyan-500/20 mb-6">
            <Icon className="w-8 h-8 text-cyan-400" />
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">{title}</h2>
          {description && <p className="text-xl text-gray-400">{description}</p>}
          {children}
        </motion.div>
      </div>
    </div>
  );
}

// ============================================
// MOBILE COMPONENTS
// ============================================

function MobileHeroContent({ onRequestInvite }: { onRequestInvite: () => void }) {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 pt-20 pb-8">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="text-center">
        <h1 className="font-bold tracking-tight mb-6">
          <span className="block text-4xl sm:text-5xl leading-tight">
            <span className="text-white">Explore AI </span>
            <span
              style={{
                background: 'linear-gradient(90deg, #22d3ee, #4ade80)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              together
            </span>
          </span>
        </h1>
        <p className="text-lg sm:text-xl text-gray-300 mb-8">Games and challenges. Personalized learning paths. Share what you're building.</p>
        <button
          onClick={onRequestInvite}
          className="px-6 py-3 rounded bg-gradient-to-r from-cyan-400 to-green-400 text-[#020617] font-semibold text-base shadow-neon hover:shadow-neon-strong transition-all duration-300"
        >
          Join Waitlist
        </button>
      </motion.div>
      {/* Battle simulation on mobile - below hero */}
      <div className="mt-8 w-full max-w-[400px] px-2">
        <BattleSimulation />
      </div>
    </div>
  );
}

function MobileFeatureSection({
  icon: Icon,
  title,
  children,
  chatContent
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children?: React.ReactNode;
  chatContent?: React.ReactNode;
}) {
  return (
    <div className="px-6 py-12 border-t border-white/5">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.5 }}
      >
        <div className="w-12 h-12 rounded bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center border border-cyan-500/20 mb-4">
          <Icon className="w-6 h-6 text-cyan-400" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">{title}</h2>
        {children}
      </motion.div>
      {/* Chat content for this section */}
      {chatContent && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-8 p-4 rounded bg-white/5 border border-white/10"
        >
          {chatContent}
        </motion.div>
      )}
    </div>
  );
}

// Simplified chat messages for mobile (no panel chrome)
function MobileChatMessages({ messages, isGamePlaying, onStartGame }: { messages: ChatMessage[]; isGamePlaying: boolean; onStartGame: () => void }) {
  return (
    <div className="space-y-3">
      {messages.map((message, index) => {
        const key = `mobile-${message.type}-${index}`;

        if (message.type === 'user') {
          return (
            <div key={key} className="flex justify-end">
              <div className="max-w-[85%] px-3 py-2 rounded bg-cyan-600 text-white">
                <p className="text-base">{message.text}</p>
              </div>
            </div>
          );
        }
        if (message.type === 'ava') {
          return (
            <div key={key} className="flex gap-2">
              <img src="/ava-avatar.png" alt="Ava" className="w-6 h-6 rounded-full border border-cyan-500/50 flex-shrink-0" />
              <div className="max-w-[85%] px-3 py-2 rounded bg-white/10 border border-white/10 text-white">
                <p className="text-base">{message.text}</p>
              </div>
            </div>
          );
        }
        if (message.type === 'game') {
          return (
            <div key={key} className="ml-8">
              <PlayableGame isPlaying={isGamePlaying} onPlay={onStartGame} />
            </div>
          );
        }
        if (message.type === 'projects') {
          return (
            <div key={key} className="ml-8 grid grid-cols-2 gap-2">
              {exampleProjects.map((project, pIndex) => <MiniProjectCard key={project.id} project={project} index={pIndex} />)}
            </div>
          );
        }
        if (message.type === 'learning-path-preview') {
          return (
            <div key={key} className="ml-8">
              <LearningPathPreview />
            </div>
          );
        }
        if (message.type === 'exercise-picker') {
          return (
            <div key={key} className="ml-8">
              <ExercisePicker />
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function UnifiedLanding({ onRequestInvite }: UnifiedLandingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<SectionId>('hero');
  const [isGamePlaying, setIsGamePlaying] = useState(false);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const isMobile = useIsMobile();

  // Fetch platform stats on mount
  useEffect(() => {
    getPlatformStats()
      .then(setStats)
      .catch(console.error);
  }, []);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Map scroll progress to active section (only used on desktop for parallax)
  // Left content moves -3600px over full scroll (5 sections worth)
  // Thresholds tuned based on when sections become visible in viewport
  useMotionValueEvent(scrollYProgress, 'change', (progress) => {
    if (isMobile) return; // Skip on mobile - no parallax
    if (progress < 0.2) setActiveSection('hero');
    else if (progress < 0.4) setActiveSection('learn');
    else if (progress < 0.6) setActiveSection('paths');
    else if (progress < 0.8) setActiveSection('share');
    else setActiveSection('see');
  });

  // Transform for logo cloud opacity (fades out as you scroll) - desktop only
  const logoCloudOpacity = useTransform(scrollYProgress, [0, 0.15, 0.2], [1, 1, 0]);

  // Y transform for parallax content - desktop only
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -3600]);

  // Get messages for each section (for mobile inline display)
  const getMessagesForSection = useCallback((section: SectionId) => {
    return allMessages.filter(msg => msg.section === section);
  }, []);

  // Mobile layout - stacked, no parallax
  if (isMobile) {
    return (
      <div className="relative bg-[#020617] text-white">
        {/* Background gradients */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse 80% 50% at 50% 0%, rgba(34, 211, 238, 0.15) 0%, transparent 50%),
                radial-gradient(ellipse 60% 40% at 80% 20%, rgba(74, 222, 128, 0.1) 0%, transparent 50%)
              `,
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse 80% 50% at 50% 100%, rgba(34, 211, 238, 0.12) 0%, transparent 50%),
                radial-gradient(ellipse 60% 40% at 20% 90%, rgba(74, 222, 128, 0.08) 0%, transparent 50%)
              `,
            }}
          />
        </div>

        {/* Fixed header */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-[#020617]/80 backdrop-blur-md border-b border-white/5">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <a href="/" className="flex items-center gap-2">
                <img src="/all-thrvie-logo.png" alt="All Thrive" className="h-7 w-auto" />
                <span className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent">
                  All Thrive
                </span>
              </a>
              <div className="flex items-center gap-3">
                <a href="/explore" className="text-white/70 font-medium text-sm hover:text-white transition-colors">Explore</a>
                <a href="/auth" className="px-3 py-1.5 rounded bg-gradient-to-r from-cyan-500 to-green-500 text-white font-medium text-sm">Sign In</a>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile content - stacked sections */}
        <div className="relative z-10">
          {/* Hero with icon cloud */}
          <MobileHeroContent onRequestInvite={onRequestInvite} />

          {/* Learn section */}
          <MobileFeatureSection
            icon={PuzzlePieceIcon}
            title="The best way to learn AI?"
            chatContent={
              <MobileChatMessages
                messages={getMessagesForSection('learn')}
                isGamePlaying={isGamePlaying}
                onStartGame={() => setIsGamePlaying(true)}
              />
            }
          >
            <p className="text-base text-gray-400 mb-4">
              Play with AI concepts. Compete in weekly challenges against other community members.
            </p>
          </MobileFeatureSection>

          {/* Paths section */}
          <MobileFeatureSection
            icon={BookOpenIcon}
            title="Personalized learning paths"
            chatContent={
              <MobileChatMessages
                messages={getMessagesForSection('paths')}
                isGamePlaying={false}
                onStartGame={() => {}}
              />
            }
          >
            <p className="text-base text-gray-400 mb-4">
              Learn at your own pace with lessons personalized to your goals.
            </p>
          </MobileFeatureSection>

          {/* Share section */}
          <MobileFeatureSection
            icon={ShareIcon}
            title="Share your work in progress"
            chatContent={
              <div className="space-y-3">
                <MobileChatMessages
                  messages={getMessagesForSection('share').filter(m => m.type === 'user' || m.type === 'ava')}
                  isGamePlaying={false}
                  onStartGame={() => {}}
                />
                <div className="ml-8">
                  <ProjectPreview />
                </div>
              </div>
            }
          >
            <p className="text-base text-gray-400 mb-4">
              Every project starts somewhere. Share your progress, get feedback, and keep all your AI ideas in one place.
            </p>
          </MobileFeatureSection>

          {/* See section */}
          <MobileFeatureSection
            icon={AcademicCapIcon}
            title="See what others are creating"
            chatContent={
              <MobileChatMessages
                messages={getMessagesForSection('see')}
                isGamePlaying={false}
                onStartGame={() => {}}
              />
            }
          >
            <p className="text-base text-gray-400 mb-4">
              See what the community is building and find inspiration.
            </p>
            {/* Platform stats - mobile sized */}
            <div className="flex gap-4 mb-4">
              <div className="text-center">
                <div className="text-xl font-bold text-cyan-400">
                  {stats ? formatStat(stats.activeCreators) : '...'}
                </div>
                <div className="text-xs text-gray-400">Members</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-green-400">
                  {stats ? formatStat(stats.projectsShared) : '...'}
                </div>
                <div className="text-xs text-gray-400">Projects</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-purple-400">
                  {stats ? formatStat(stats.collectivePoints) : '...'}
                </div>
                <div className="text-xs text-gray-400">Points</div>
              </div>
            </div>
          </MobileFeatureSection>
        </div>

        {/* Testimonials and Final CTA */}
        <Testimonials />
        <FinalCTA onRequestInvite={onRequestInvite} />
        <Footer />
      </div>
    );
  }

  // Desktop layout - parallax scroll
  return (
    <div className="relative bg-[#020617] text-white">
    <div ref={containerRef} className="relative" style={{ height: '400vh' }}>
      {/* Background gradients - top and bottom teal glows */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Top glow */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 50% 0%, rgba(34, 211, 238, 0.15) 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 80% 20%, rgba(74, 222, 128, 0.1) 0%, transparent 50%)
            `,
          }}
        />
        {/* Bottom glow */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 50% 100%, rgba(34, 211, 238, 0.12) 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 20% 90%, rgba(74, 222, 128, 0.08) 0%, transparent 50%)
            `,
          }}
        />
      </div>

      {/* Fixed header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#020617]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <a href="/" className="flex items-center gap-2">
              <img src="/all-thrvie-logo.png" alt="All Thrive" className="h-8 w-auto" />
              <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent">
                All Thrive
              </span>
            </a>
            <div className="flex items-center gap-4">
              <a href="/explore" className="text-white/70 font-medium text-sm hover:text-white transition-colors">Explore</a>
              <a href="/auth" className="px-4 py-2 rounded bg-gradient-to-r from-cyan-500 to-green-500 text-white font-medium text-sm">Sign In</a>
            </div>
          </div>
        </div>
      </header>

      {/* Main sticky container */}
      <div className="sticky top-0 h-screen overflow-hidden pt-16">
        <div className="max-w-7xl mx-auto px-6 h-full flex">
        {/* Left side - scrolling content */}
        <div className="flex-1 overflow-hidden">
          <motion.div
            style={{ y: contentY }}
          >
            <HeroContent onRequestInvite={onRequestInvite} />
            <FeatureContent
              icon={PuzzlePieceIcon}
              title="The best way to learn AI?"
            >
              <p className="text-xl text-gray-400 mb-6">
                Play with AI concepts. Compete in weekly challenges against other community members.
              </p>
              <GameCarousel onPlayContextSnake={() => setIsGamePlaying(true)} />
            </FeatureContent>
            <FeatureContent
              icon={BookOpenIcon}
              title="Personalized learning paths"
            >
              <p className="text-xl text-gray-400 mb-6">
                Learn at your own pace with lessons personalized to your goals. Code walkthroughs, hands-on exercises, and project-based learning.
              </p>
              <CodeWalkthroughPreview />
            </FeatureContent>
            <FeatureContent
              icon={ShareIcon}
              title="Share your work in progress"
            >
              <p className="text-xl text-gray-400 mb-4">
                Every project starts somewhere. With so many AI tools out there, think of All Thrive as your playground to explore them all. Share your progress, get feedback, and keep all your AI ideas and projects in one place.
              </p>
              <p className="text-xl text-gray-400 mb-6">
                Sharing has never been easier. All Thrive automates creating a project page for you.
              </p>
              {/* URL input mock with integration icons */}
              <div className="max-w-md">
                <div className="flex items-center gap-3 px-4 py-3 rounded bg-white/5 border border-white/10">
                  <FontAwesomeIcon icon={faLink} className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-500 text-sm">Paste a URL...</span>
                </div>
                <div className="flex items-center gap-4 mt-4">
                  <span className="text-sm text-gray-500">Import from</span>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-white/5 border border-white/10 flex items-center justify-center">
                      <FontAwesomeIcon icon={faGithub} className="w-4 h-4 text-white" />
                    </div>
                    <div className="w-8 h-8 rounded bg-white/5 border border-white/10 flex items-center justify-center">
                      <FontAwesomeIcon icon={faGitlab} className="w-4 h-4 text-orange-400" />
                    </div>
                    <div className="w-8 h-8 rounded bg-white/5 border border-white/10 flex items-center justify-center">
                      <FontAwesomeIcon icon={faFigma} className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="w-8 h-8 rounded bg-white/5 border border-white/10 flex items-center justify-center">
                      <FontAwesomeIcon icon={faYoutube} className="w-4 h-4 text-red-500" />
                    </div>
                  </div>
                </div>
              </div>
            </FeatureContent>
            <FeatureContent
              icon={AcademicCapIcon}
              title="See what others are creating"
            >
              <p className="text-xl text-gray-400 mb-6">
                Don't know which AI tool to use for your next project? See what the community are building and learning and find inspiration for what's possible.
              </p>
              {/* Platform stats */}
              <div className="flex gap-8 mb-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-cyan-400">
                    {stats ? formatStat(stats.activeCreators) : '...'}
                  </div>
                  <div className="text-sm text-gray-400">Active Members</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-400">
                    {stats ? formatStat(stats.projectsShared) : '...'}
                  </div>
                  <div className="text-sm text-gray-400">Projects Shared</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-400">
                    {stats ? formatStat(stats.collectivePoints) : '...'}
                  </div>
                  <div className="text-sm text-gray-400">Points Earned</div>
                </div>
              </div>
              {/* Project and Learning Path examples */}
              <div className="flex gap-4 max-w-md">
                {/* User project */}
                <div className="flex-1 rounded border border-white/10 bg-white/5 p-3">
                  <img src="/weave-cli.png" alt="weave-cli" className="w-full aspect-video rounded border border-white/10 object-cover mb-2" />
                  <p className="text-white font-medium text-sm">weave-cli</p>
                  <p className="text-gray-500 text-xs">by @mmaximilien</p>
                  <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400">Project</span>
                </div>
                {/* Learning path */}
                <div className="flex-1 rounded border border-purple-500/30 bg-purple-500/10 p-3">
                  <img src="/vector-database-promo.png" alt="Vector DB Comparison" className="w-full aspect-video rounded border border-white/10 object-cover mb-2" />
                  <p className="text-white font-medium text-sm">Vector DB Comparison</p>
                  <p className="text-gray-500 text-xs">4 lessons · 20 min</p>
                  <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">Learning Path</span>
                </div>
              </div>
            </FeatureContent>
          </motion.div>
        </div>

        {/* Right side - logo cloud / Ava chat */}
        <div className="w-[420px] xl:w-[480px] h-full p-6 pl-0 relative hidden lg:block">
          {/* Battle simulation - visible on hero */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center p-4"
            style={{ opacity: logoCloudOpacity }}
          >
            <BattleSimulation />
          </motion.div>

          {/* Ava chat - fades in after hero */}
          {activeSection !== 'hero' && (
            <motion.div
              className="h-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <AvaChatPanel activeSection={activeSection} isGamePlaying={isGamePlaying} onStartGame={() => setIsGamePlaying(true)} />
            </motion.div>
          )}
        </div>
        </div>
      </div>
    </div>

      {/* Testimonials and Final CTA - after parallax */}
      <Testimonials />
      <FinalCTA onRequestInvite={onRequestInvite} />
      <Footer />
    </div>
  );
}
