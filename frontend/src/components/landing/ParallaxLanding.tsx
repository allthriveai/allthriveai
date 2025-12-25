/**
 * ParallaxLanding - Full-page parallax scroll experience
 * Sections: You Belong Here → What is All Thrive → Learn, Share, Play
 * Fixed header with Explore and Sign In
 */

import { motion } from 'framer-motion';
import { useState } from 'react';
import { AcademicCapIcon, ShareIcon, PuzzlePieceIcon } from '@heroicons/react/24/outline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWorm, faPlay } from '@fortawesome/free-solid-svg-icons';
import { Link } from 'react-router-dom';
import { IconCloud } from './IconCloud';
import { ContextSnakeCore } from '@/components/games/ContextSnakeCore';

interface ParallaxLandingProps {
  onRequestInvite: () => void;
}

// ============================================
// FIXED HEADER
// ============================================

function FixedHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#020617]/80 backdrop-blur-md border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <a href="/" className="inline-flex items-center gap-2 sm:gap-3">
            <img
              src="/all-thrvie-logo.png"
              alt="All Thrive"
              className="h-7 sm:h-8 w-auto"
            />
            <span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent">
              All Thrive
            </span>
          </a>
          <div className="flex items-center gap-3 sm:gap-4">
            <a
              href="/explore"
              className="text-white/70 font-medium text-sm hover:text-white transition-colors duration-300"
            >
              Explore
            </a>
            <a
              href="/auth"
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-green-500 text-white font-medium text-sm hover:from-cyan-400 hover:to-green-400 transition-all duration-300"
            >
              Sign In
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}

// ============================================
// HERO SECTION - "You Belong Here"
// ============================================

function HeroSection({ onRequestInvite }: { onRequestInvite: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center relative">
      {/* Background */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 50% 0%, rgba(34, 211, 238, 0.15) 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 80% 20%, rgba(74, 222, 128, 0.1) 0%, transparent 50%)
            `,
          }}
        />
        {/* Animated orbs */}
        <motion.div
          className="absolute w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(34, 211, 238, 0.4) 0%, transparent 70%)',
            top: '10%',
            left: '10%',
          }}
          animate={{ y: [0, -30, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-80 h-80 rounded-full blur-3xl opacity-15"
          style={{
            background: 'radial-gradient(circle, rgba(74, 222, 128, 0.4) 0%, transparent 70%)',
            bottom: '20%',
            right: '10%',
          }}
          animate={{ y: [0, 20, 0], scale: [1, 1.15, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-20">
        <div className="flex flex-col lg:flex-row items-center gap-12">
          {/* Text */}
          <div className="flex-[3] text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              <h1 className="font-bold tracking-tight mb-6">
                <span className="block text-4xl sm:text-5xl md:text-6xl text-white leading-tight">
                  Creating with AI?
                </span>
                <span
                  className="block text-5xl sm:text-6xl md:text-7xl leading-tight animate-gradient-rotate"
                  style={{
                    backgroundSize: '300% 300%',
                    background: 'linear-gradient(90deg, #22d3ee, #4ade80, #22d3ee)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  You belong here.
                </span>
              </h1>
              <p className="text-xl text-gray-300 mb-8 max-w-xl">
                Learn by playing. Share your work in progress. Thrive together.
              </p>
              <button
                onClick={onRequestInvite}
                className="px-8 py-4 rounded-lg bg-gradient-to-r from-cyan-400 to-green-400 text-[#020617] font-semibold text-lg shadow-neon hover:shadow-neon-strong transition-all duration-300 hover:scale-105"
              >
                Request Invitation
              </button>
            </motion.div>
          </div>

          {/* Icon Cloud */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex-[2] w-full max-w-md"
          >
            <div className="relative aspect-square">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-500/20 to-green-500/20 blur-3xl" />
              <div className="absolute inset-0 flex items-center justify-center z-0">
                <img src="/all-thrvie-logo.png" alt="" className="w-16 h-auto opacity-90" />
              </div>
              <div className="relative z-10">
                <IconCloud />
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <div className="w-6 h-10 rounded-full border-2 border-white/30 flex items-start justify-center p-2">
          <motion.div
            className="w-1.5 h-1.5 bg-white/50 rounded-full"
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
      </motion.div>
    </div>
  );
}

// ============================================
// WHAT IS ALL THRIVE SECTION
// ============================================

function WhatIsAllThriveSection() {
  const features = [
    {
      icon: '🎯',
      title: 'For the AI curious at any level',
      description: 'Whether you\'re just starting or already creating, there\'s a place for you here.',
    },
    {
      icon: '🌱',
      title: 'Share the messy middle',
      description: 'Post work in progress. Get encouragement, not judgment.',
    },
    {
      icon: '🎮',
      title: 'Learn by playing',
      description: 'Games, quests, and challenges that make AI concepts click.',
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center relative py-20">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-cyan-400 font-medium mb-4">What is All Thrive?</p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
            All Thrive is your space to{' '}
            <span className="bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent">
              share, learn, and play
            </span>{' '}
            with AI.
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 mt-16">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="text-center"
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-gray-400">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// FEATURE SECTIONS - Learn, Share, Play
// ============================================

const exampleProjects = [
  { id: 1, title: 'Understanding Token Limits', creator: 'alex_learns', image: '/landing/project-token-limits.png', tool: 'ChatGPT' },
  { id: 2, title: 'Context in Image Prompts', creator: 'creative_sam', image: '/landing/project-context-prompts.png', tool: 'Midjourney' },
  { id: 3, title: 'Memory vs Context Window', creator: 'tech_jamie', image: '/landing/project-memory-context.png', tool: 'Claude' },
];

function LearnSection() {
  return (
    <div className="min-h-screen flex items-center justify-center relative py-20">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left - Content */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center border border-cyan-500/20 mb-6">
              <AcademicCapIcon className="w-8 h-8 text-cyan-400" />
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">Learn</h2>
            <p className="text-xl text-gray-400 mb-6">
              Ask Ember anything. Get curated projects from the community and personalized learning paths.
            </p>
            <div className="glass-card rounded-xl p-4 border border-white/10">
              <div className="flex items-start gap-3 mb-4">
                <img src="/ember-avatar.png" alt="Ember" className="w-10 h-10 rounded-full border-2 border-cyan-500/50" />
                <div className="flex-1">
                  <p className="text-white font-medium">Ember</p>
                  <p className="text-gray-400 text-sm">Here are some projects that explain the context window:</p>
                </div>
              </div>
              <Link
                to="/learn"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-cyan-500 to-green-500 text-white font-medium text-sm hover:shadow-neon transition-all"
              >
                <AcademicCapIcon className="w-4 h-4" />
                Explore Learning Paths
              </Link>
            </div>
          </motion.div>

          {/* Right - Project cards */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid grid-cols-2 gap-4"
          >
            {exampleProjects.slice(0, 2).map((project) => (
              <div
                key={project.id}
                className="rounded-xl bg-white/5 border border-white/10 overflow-hidden"
              >
                <div className="aspect-[4/3] overflow-hidden">
                  <img src={project.image} alt={project.title} className="w-full h-full object-cover" />
                </div>
                <div className="p-3">
                  <h4 className="text-sm font-medium text-white truncate">{project.title}</h4>
                  <span className="text-xs text-gray-400">@{project.creator}</span>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function ShareSection() {
  return (
    <div className="min-h-screen flex items-center justify-center relative py-20">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left - Project preview */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="order-2 lg:order-1"
          >
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-2xl flex-shrink-0">
                    🤖
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-semibold">My First Chatbot</h4>
                    <p className="text-sm text-gray-400 mt-1">
                      A simple chatbot built with Python and the OpenAI API. It can answer questions and have basic conversations!
                    </p>
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
                Auto-generated by Ember
              </div>
            </div>
          </motion.div>

          {/* Right - Content */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="order-1 lg:order-2"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-purple-500/20 mb-6">
              <ShareIcon className="w-8 h-8 text-purple-400" />
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">Share</h2>
            <p className="text-xl text-gray-400 mb-6">
              Paste a URL or upload an image. Ember creates your project post automatically.
            </p>
            <div className="glass-card rounded-xl p-4 border border-white/10 mb-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-white/5 rounded-lg px-4 py-2 text-cyan-400 text-sm truncate border border-white/10">
                  https://github.com/sarah/my-first-chatbot
                </div>
                <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            </div>
            <Link
              to="/explore"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium text-sm hover:shadow-neon transition-all"
            >
              <ShareIcon className="w-4 h-4" />
              Share Your Project
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function PlaySection() {
  const [showGame, setShowGame] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center relative py-20">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left - Content */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center border border-emerald-500/20 mb-6">
              <PuzzlePieceIcon className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">Play</h2>
            <p className="text-xl text-gray-400 mb-6">
              Learn AI concepts through interactive games. Context Snake teaches you about token limits - try it now!
            </p>
            {!showGame && (
              <button
                onClick={() => setShowGame(true)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-medium hover:shadow-neon transition-all hover:scale-105"
              >
                <FontAwesomeIcon icon={faPlay} className="w-4 h-4" />
                Play Context Snake
              </button>
            )}
          </motion.div>

          {/* Right - Game */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex justify-center"
          >
            {showGame ? (
              <div className="glass-card rounded-2xl border border-white/10 p-4">
                <ContextSnakeCore variant="mini" />
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 p-6 w-full max-w-sm">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                    <FontAwesomeIcon icon={faWorm} className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h4 className="text-xl text-white font-semibold">Context Snake</h4>
                    <p className="text-gray-400">Eat tokens, grow your context!</p>
                  </div>
                </div>
                <p className="text-sm text-gray-500">
                  Learn how AI context windows work by playing this classic game with a twist.
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// FINAL CTA
// ============================================

function FinalCTASection({ onRequestInvite }: { onRequestInvite: () => void }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center relative py-20">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
            Ready to{' '}
            <span className="bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent">
              thrive
            </span>
            ?
          </h2>
          <p className="text-xl text-gray-400 mb-8">
            Join a community where everyone's learning journey is celebrated.
          </p>
          <button
            onClick={onRequestInvite}
            className="px-8 py-4 rounded-lg bg-gradient-to-r from-cyan-400 to-green-400 text-[#020617] font-semibold text-lg shadow-neon hover:shadow-neon-strong transition-all duration-300 hover:scale-105"
          >
            Request Invitation
          </button>
        </motion.div>
      </div>
    </div>
  );
}

// ============================================
// FOOTER
// ============================================

function Footer() {
  return (
    <footer className="border-t border-white/10 py-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/all-thrvie-logo.png" alt="All Thrive" className="h-6 w-auto" />
            <span className="text-gray-500 text-sm">Your space to share, learn, and play with AI.</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-white transition-colors">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ParallaxLanding({ onRequestInvite }: ParallaxLandingProps) {
  return (
    <div className="bg-[#020617] text-white">
      <FixedHeader />

      {/* Sections */}
      <HeroSection onRequestInvite={onRequestInvite} />
      <WhatIsAllThriveSection />
      <LearnSection />
      <ShareSection />
      <PlaySection />
      <FinalCTASection onRequestInvite={onRequestInvite} />
      <Footer />
    </div>
  );
}
