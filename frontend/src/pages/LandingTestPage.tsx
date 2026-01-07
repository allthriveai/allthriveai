/**
 * LandingTestPage - Simplified mobile landing page test
 *
 * Visual-first, text-light design for mobile users.
 * Route: /landing-test
 */

import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { SEO, SEOPresets } from '@/components/common/SEO';
import { Testimonials } from '@/components/landing/Testimonials';
import { FinalCTA } from '@/components/landing/FinalCTA';
import { Footer } from '@/components/landing/Footer';

// =============================================================================
// ANIMATED SVG COMPONENTS
// =============================================================================

// Learning Path Animation - nodes connecting with animated lines
function LearningPathAnimation() {
  const prefersReducedMotion = useReducedMotion();

  const nodes = [
    { x: 60, y: 40, label: 'Start', color: '#22d3ee' },
    { x: 160, y: 80, label: 'Basics', color: '#a855f7' },
    { x: 100, y: 140, label: 'Build', color: '#4ade80' },
    { x: 200, y: 180, label: 'Master', color: '#f472b6' },
  ];

  return (
    <svg viewBox="0 0 260 220" className="w-full h-auto">
      <defs>
        <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Animated connecting lines */}
      <motion.path
        d="M 60 40 Q 110 40 160 80 Q 130 110 100 140 Q 150 160 200 180"
        fill="none"
        stroke="url(#pathGradient)"
        strokeWidth="3"
        strokeLinecap="round"
        filter="url(#glow)"
        initial={{ pathLength: 0, opacity: 0 }}
        whileInView={{ pathLength: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 2, ease: 'easeInOut' }}
      />

      {/* Nodes */}
      {nodes.map((node, i) => (
        <motion.g key={i}>
          {/* Glow ring */}
          <motion.circle
            cx={node.x}
            cy={node.y}
            r="24"
            fill="none"
            stroke={node.color}
            strokeWidth="2"
            opacity="0.3"
            initial={{ scale: 0 }}
            whileInView={{ scale: [1, 1.2, 1] }}
            viewport={{ once: true }}
            transition={{
              delay: 0.5 + i * 0.3,
              duration: 2,
              repeat: prefersReducedMotion ? 0 : Infinity
            }}
          />
          {/* Node circle */}
          <motion.circle
            cx={node.x}
            cy={node.y}
            r="16"
            fill={node.color}
            filter="url(#glow)"
            initial={{ scale: 0, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 + i * 0.3, type: 'spring' }}
          />
          {/* Label */}
          <motion.text
            x={node.x}
            y={node.y + 35}
            textAnchor="middle"
            fill="white"
            fontSize="12"
            fontWeight="500"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 + i * 0.3 }}
          >
            {node.label}
          </motion.text>
        </motion.g>
      ))}
    </svg>
  );
}

// Share Animation - project card assembling from pieces
function ShareAnimation() {
  return (
    <svg viewBox="0 0 260 180" className="w-full h-auto">
      <defs>
        <linearGradient id="cardGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#4ade80" stopOpacity="0.2" />
        </linearGradient>
        <filter id="cardGlow">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Card background */}
      <motion.rect
        x="40"
        y="20"
        width="180"
        height="140"
        rx="12"
        fill="url(#cardGradient)"
        stroke="#22d3ee"
        strokeWidth="1"
        strokeOpacity="0.5"
        initial={{ opacity: 0, scale: 0.8 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      />

      {/* Image placeholder flying in */}
      <motion.rect
        x="55"
        y="35"
        width="70"
        height="50"
        rx="6"
        fill="#4ade80"
        fillOpacity="0.3"
        stroke="#4ade80"
        strokeWidth="1"
        initial={{ x: -100, opacity: 0 }}
        whileInView={{ x: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 100 }}
      />

      {/* Title line */}
      <motion.rect
        x="135"
        y="40"
        width="70"
        height="10"
        rx="5"
        fill="white"
        fillOpacity="0.8"
        initial={{ width: 0 }}
        whileInView={{ width: 70 }}
        viewport={{ once: true }}
        transition={{ delay: 0.5, duration: 0.4 }}
      />

      {/* Description lines */}
      <motion.rect
        x="135"
        y="58"
        width="55"
        height="6"
        rx="3"
        fill="white"
        fillOpacity="0.4"
        initial={{ width: 0 }}
        whileInView={{ width: 55 }}
        viewport={{ once: true }}
        transition={{ delay: 0.6, duration: 0.3 }}
      />
      <motion.rect
        x="135"
        y="70"
        width="45"
        height="6"
        rx="3"
        fill="white"
        fillOpacity="0.4"
        initial={{ width: 0 }}
        whileInView={{ width: 45 }}
        viewport={{ once: true }}
        transition={{ delay: 0.7, duration: 0.3 }}
      />

      {/* Tags flying in */}
      {[0, 1, 2].map((i) => (
        <motion.rect
          key={i}
          x={55 + i * 45}
          y="100"
          width="38"
          height="18"
          rx="9"
          fill={['#a855f7', '#22d3ee', '#f472b6'][i]}
          fillOpacity="0.3"
          stroke={['#a855f7', '#22d3ee', '#f472b6'][i]}
          strokeWidth="1"
          initial={{ y: 50, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8 + i * 0.1, type: 'spring' }}
        />
      ))}

      {/* Share icon pulse */}
      <motion.g
        initial={{ scale: 0 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 1.2, type: 'spring' }}
      >
        <motion.circle
          cx="200"
          cy="140"
          r="18"
          fill="#22d3ee"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <path
          d="M195 140 L205 140 M200 135 L200 145 M196 136 L204 144 M204 136 L196 144"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          transform="translate(0, 0) rotate(45, 200, 140)"
        />
      </motion.g>
    </svg>
  );
}

// Explore Animation - constellation of projects appearing
function ExploreAnimation() {
  const projects = [
    { x: 50, y: 60, size: 30, color: '#22d3ee' },
    { x: 130, y: 40, size: 40, color: '#a855f7' },
    { x: 200, y: 70, size: 35, color: '#4ade80' },
    { x: 80, y: 130, size: 35, color: '#f472b6' },
    { x: 160, y: 150, size: 30, color: '#fbbf24' },
  ];

  return (
    <svg viewBox="0 0 260 200" className="w-full h-auto">
      <defs>
        <filter id="projectGlow">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Connection lines */}
      {projects.map((p, i) =>
        projects.slice(i + 1).map((p2, j) => (
          <motion.line
            key={`${i}-${j}`}
            x1={p.x}
            y1={p.y}
            x2={p2.x}
            y2={p2.y}
            stroke="white"
            strokeOpacity="0.1"
            strokeWidth="1"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 + (i + j) * 0.1, duration: 0.5 }}
          />
        ))
      )}

      {/* Project nodes */}
      {projects.map((p, i) => (
        <motion.g key={i}>
          {/* Glow */}
          <motion.circle
            cx={p.x}
            cy={p.y}
            r={p.size + 10}
            fill={p.color}
            opacity="0.15"
            initial={{ scale: 0 }}
            whileInView={{ scale: [0, 1.2, 1] }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.15, duration: 0.6 }}
          />
          {/* Main circle */}
          <motion.circle
            cx={p.x}
            cy={p.y}
            r={p.size}
            fill={p.color}
            fillOpacity="0.2"
            stroke={p.color}
            strokeWidth="2"
            filter="url(#projectGlow)"
            initial={{ scale: 0, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.15, type: 'spring', stiffness: 200 }}
          />
          {/* Icon placeholder */}
          <motion.rect
            x={p.x - 8}
            y={p.y - 8}
            width="16"
            height="16"
            rx="3"
            fill={p.color}
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 + i * 0.15 }}
          />
        </motion.g>
      ))}

      {/* Floating sparkles */}
      {[...Array(5)].map((_, i) => (
        <motion.circle
          key={`sparkle-${i}`}
          cx={40 + i * 50}
          cy={100 + (i % 2) * 60}
          r="2"
          fill="white"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{
            delay: i * 0.5,
            duration: 2,
            repeat: Infinity,
            repeatDelay: 1
          }}
        />
      ))}
    </svg>
  );
}

// =============================================================================
// FEATURE SECTION COMPONENT
// =============================================================================

interface FeatureSection {
  title: string;
  link: string;
  glowColor: string;
  children: React.ReactNode;
}

function FeatureSection({ title, link, glowColor, children }: FeatureSection) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <Link to={link}>
      <motion.div
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6"
      >
        {/* Glow effect */}
        {!prefersReducedMotion && (
          <motion.div
            className="absolute inset-0 pointer-events-none rounded-2xl"
            animate={{
              boxShadow: [
                `0 0 20px ${glowColor}`,
                `0 0 40px ${glowColor}`,
                `0 0 20px ${glowColor}`,
              ],
            }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        {/* Animation */}
        <div className="relative mb-4">
          {children}
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-white">{title}</h2>
      </motion.div>
    </Link>
  );
}

export default function LandingTestPage() {
  const prefersReducedMotion = useReducedMotion();

  const handleRequestInvite = () => {
    // Navigate to auth - no more waitlist
    window.location.href = '/auth';
  };

  return (
    <>
      <SEO {...SEOPresets.home} />

      <div className="min-h-screen bg-[#020617] text-white">
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
                <Link to="/explore" className="text-white/70 font-medium text-sm hover:text-white transition-colors">
                  Explore
                </Link>
                <Link
                  to="/auth"
                  className="px-3 py-1.5 rounded bg-gradient-to-r from-cyan-500 to-green-500 text-white font-medium text-sm"
                >
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <div className="relative z-10">
          {/* HERO - Simplified */}
          <section className="min-h-[70vh] flex flex-col items-center justify-center px-6 pt-20 pb-12">
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center"
            >
              <h1 className="text-5xl font-bold mb-4">
                <span className="text-white">Explore AI </span>
                <span className="bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent">
                  together
                </span>
              </h1>

              {/* Brief value prop */}
              <p className="text-xl text-gray-400 mb-8">Play. Learn. Share.</p>

              {/* CTA */}
              <Link
                to="/auth"
                className="inline-block px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-400 to-green-400 text-[#020617] font-semibold text-lg shadow-neon hover:shadow-neon-strong transition-all duration-300"
              >
                Get Started
              </Link>
            </motion.div>
          </section>

          {/* FEATURE SECTIONS - Animated SVG sections */}
          <section className="px-6 py-8 space-y-6">
            {/* PLAY - Game promo image (user approved this) */}
            <FeatureSection
              title="Learn by playing"
              link="/play/prompt-battles"
              glowColor="rgba(16, 185, 129, 0.3)"
            >
              <motion.img
                src="/games/game-context-snake-promo.png"
                alt="Learn AI by playing fun games"
                className="w-full rounded-lg"
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              />
            </FeatureSection>

            {/* LEARN - Animated learning path */}
            <FeatureSection
              title="Your path. Your pace."
              link="/learn"
              glowColor="rgba(168, 85, 247, 0.3)"
            >
              <LearningPathAnimation />
            </FeatureSection>

            {/* SHARE - Project card assembly animation */}
            <FeatureSection
              title="Share what you build"
              link="/projects/new"
              glowColor="rgba(34, 211, 238, 0.3)"
            >
              <ShareAnimation />
            </FeatureSection>

            {/* SEE - Explore constellation */}
            <FeatureSection
              title="Get inspired"
              link="/explore"
              glowColor="rgba(251, 191, 36, 0.3)"
            >
              <ExploreAnimation />
            </FeatureSection>
          </section>

          {/* Testimonials */}
          <Testimonials />

          {/* Final CTA - pass handler but it just goes to /auth now */}
          <FinalCTA onRequestInvite={handleRequestInvite} />

          {/* Footer */}
          <Footer />
        </div>
      </div>
    </>
  );
}
