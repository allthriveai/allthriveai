import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGift,
  faHandshake,
  faPuzzlePiece,
  faArrowRight,
  faRocket,
  faLightbulb,
  faUsers,
  faStar,
  faTimes,
  faCode,
  faGraduationCap,
  faBriefcase,
  faBullhorn,
  faFlask,
  faComments,
  faHandHoldingHeart,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

/**
 * CollectiveLandingPage - Landing page for the AI Collective concept
 *
 * Tagline: "Share what you offer. Ask for what you need. The AI Network Collective."
 *
 * Uses Framer Motion animations inspired by the mobile homepage
 * and Neon Glass design system from /styleguide
 */
export default function CollectiveLandingPage() {
  const prefersReducedMotion = useReducedMotion();

  // Section visibility states for viewport-triggered animations
  const [heroInView, setHeroInView] = useState(false);
  const [stepsInView, setStepsInView] = useState(false);
  const [profilesInView, setProfilesInView] = useState(false);
  const [personasInView, setPersonasInView] = useState(false);
  const [ctaInView, setCtaInView] = useState(false);

  // Waitlist form state
  const [showWaitlistForm, setShowWaitlistForm] = useState(false);

  const steps = [
    {
      id: 'offer',
      icon: faHandHoldingHeart,
      title: 'Share What You Offer',
      description: 'Apps you\'ve built, skills you have, courses you\'ve created, feedback you can give.',
      color: 'cyan',
      glowColor: 'rgba(34, 211, 238, 0.3)',
    },
    {
      id: 'ask',
      icon: faHandshake,
      title: 'Ask For What You Need',
      description: 'Beta testers, feedback, collaborators, advice, help learning something new.',
      color: 'green',
      glowColor: 'rgba(74, 222, 128, 0.3)',
    },
    {
      id: 'match',
      icon: faPuzzlePiece,
      title: 'Connect & Thrive',
      description: 'We match your asks with others\' offers. Everyone wins when the community thrives.',
      color: 'purple',
      glowColor: 'rgba(168, 85, 247, 0.3)',
    },
  ];

  const personas = [
    { icon: faRocket, title: 'AI Builders', description: 'Share your apps, get beta testers, find collaborators', color: 'cyan', glowColor: 'rgba(34, 211, 238, 0.3)' },
    { icon: faLightbulb, title: 'Learners', description: 'Find courses, get mentorship, accelerate your journey', color: 'green', glowColor: 'rgba(74, 222, 128, 0.3)' },
    { icon: faUsers, title: 'Founders', description: 'Find co-founders, get feedback, validate ideas', color: 'purple', glowColor: 'rgba(168, 85, 247, 0.3)' },
    { icon: faStar, title: 'Experts', description: 'Monetize knowledge, build audience, mentor others', color: 'amber', glowColor: 'rgba(251, 191, 36, 0.3)' },
  ];

  return (
    <div className="min-h-screen bg-[#020617] text-white relative overflow-hidden">
      {/* Ambient Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-green-500/10 blur-[120px]" />
        <div className="absolute top-[40%] left-[30%] w-[400px] h-[400px] rounded-full bg-purple-500/5 blur-[100px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img
              src="/all-thrvie-logo.png"
              alt="All Thrive"
              className="h-8 w-auto"
            />
          </Link>
          <Link
            to="/auth"
            className="text-sm font-medium text-slate-400 hover:text-cyan-400 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <motion.section
        className="relative z-10 px-4 sm:px-6 lg:px-8 min-h-[calc(100vh-80px)] flex items-center"
        onViewportEnter={() => setHeroInView(true)}
        viewport={{ once: true }}
      >
        <div className="max-w-6xl mx-auto w-full relative">
          {/* Background glow behind text */}
          <div className="absolute -top-20 -left-32 w-[500px] h-[400px] bg-cyan-500/20 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute top-20 right-0 w-[400px] h-[300px] bg-green-500/15 rounded-full blur-[100px] pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12 items-center relative">
            {/* Left: Text content - takes 3 of 5 columns */}
            <div className="text-center lg:text-left lg:col-span-3">
              {/* Main Tagline */}
              <motion.h1
                className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-8 leading-tight"
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 30 }}
                animate={heroInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <span className="block">
                  Share what you{' '}
                  <span className="bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent">
                    can offer
                  </span>
                </span>
                <span className="block mt-2">
                  <span className="bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent">
                    Ask for
                  </span>
                  {' '}what you need
                </span>
              </motion.h1>

              <motion.p
                className="text-lg text-slate-400 mb-8 lg:max-w-md"
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
                animate={heroInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.35 }}
              >
                Share what you're building. Find what you need.
                <span className="block mt-1">A network for everyone on their AI journey.</span>
              </motion.p>

              {/* CTA Buttons */}
              <motion.div
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
                animate={heroInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.45 }}
                className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-4"
              >
                <button
                  onClick={() => setShowWaitlistForm(true)}
                  className="px-8 py-4 rounded font-semibold text-slate-900 bg-gradient-to-r from-cyan-400 to-green-400 flex items-center gap-2 hover:shadow-[0_0_30px_rgba(34,211,238,0.4)] transition-all cursor-pointer"
                >
                  Join Waitlist
                  <FontAwesomeIcon icon={faArrowRight} />
                </button>
              </motion.div>
            </div>

            {/* Right: Animated chat demo - takes 2 of 5 columns */}
            <motion.div
              className="lg:col-span-2 min-h-[300px]"
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: 30 }}
              animate={heroInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <HeroChatAnimation prefersReducedMotion={prefersReducedMotion} />
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* How It Works */}
      <motion.section
        className="relative z-10 px-4 sm:px-6 lg:px-8 min-h-screen flex items-center bg-white/[0.02] overflow-hidden"
        onViewportEnter={() => setStepsInView(true)}
        viewport={{ once: true, margin: '-100px' }}
      >
        {/* Background gradients */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[120px]" />
          <div className="absolute bottom-[10%] right-[-10%] w-[400px] h-[400px] rounded-full bg-green-500/10 blur-[100px]" />
          <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-purple-500/5 blur-[120px]" />
        </div>
        <div className="max-w-6xl mx-auto w-full py-16 relative">
          <motion.div
            className="text-center mb-16"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 30 }}
            animate={stepsInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              How it works
            </h2>
            <p className="text-lg text-slate-400 max-w-3xl mx-auto">
              Built on a simple principle: everyone has something to offer and something they need.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <StepCard
                key={step.id}
                step={step}
                index={i}
                isInView={stepsInView}
                prefersReducedMotion={prefersReducedMotion}
              />
            ))}
          </div>
        </div>
      </motion.section>

      {/* Example Profiles */}
      <motion.section
        className="relative z-10 px-4 sm:px-6 lg:px-8 min-h-screen flex items-center"
        onViewportEnter={() => setProfilesInView(true)}
        viewport={{ once: true, margin: '-100px' }}
      >
        <div className="max-w-6xl mx-auto w-full py-16">
          <motion.div
            className="text-center mb-16"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 30 }}
            animate={profilesInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Meet the Collective
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Every member brings something unique. Here's what profiles look like.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ProfileCard
              name="Sarah Chen"
              handle="@sarahbuilds"
              avatar="SarahChen"
              avatarGradient="from-cyan-400 to-blue-500"
              offers={[
                { text: 'MeetingBot AI', badge: 'Try It', type: 'app' },
                { text: 'Build Your First Agent Course', badge: '$49', type: 'product' },
                { text: 'UX Feedback', type: 'skill' },
              ]}
              asks={[
                { text: 'Beta testers for TaskAI' },
                { text: 'Marketing co-founder' },
                { text: 'Feedback on my landing page' },
              ]}
              isInView={profilesInView}
              direction="left"
              prefersReducedMotion={prefersReducedMotion}
            />

            <ProfileCard
              name="Marcus Johnson"
              handle="@marcusai"
              avatar="MarcusJohnson"
              avatarGradient="from-purple-400 to-pink-500"
              offers={[
                { text: 'Prompt Engineering Consulting', badge: '$150/hr', type: 'service' },
                { text: '100+ Prompt Templates', badge: '$29', type: 'product' },
                { text: 'Code reviews for AI projects', type: 'skill' },
              ]}
              asks={[
                { text: 'Users for my newsletter' },
                { text: 'Help with video editing' },
                { text: 'Design feedback' },
              ]}
              isInView={profilesInView}
              direction="right"
              prefersReducedMotion={prefersReducedMotion}
            />
          </div>
        </div>
      </motion.section>

      {/* Who Is This For */}
      <motion.section
        className="relative z-10 px-4 sm:px-6 lg:px-8 min-h-screen flex items-center bg-white/[0.02]"
        onViewportEnter={() => setPersonasInView(true)}
        viewport={{ once: true, margin: '-100px' }}
      >
        <div className="max-w-6xl mx-auto w-full py-16">
          <motion.div
            className="text-center mb-16"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 30 }}
            animate={personasInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Who is the Collective for?
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {personas.map((persona, i) => (
              <PersonaCard
                key={persona.title}
                persona={persona}
                index={i}
                isInView={personasInView}
                prefersReducedMotion={prefersReducedMotion}
              />
            ))}
          </div>
        </div>
      </motion.section>

      {/* Final CTA */}
      <motion.section
        className="relative z-10 px-4 sm:px-6 lg:px-8 min-h-screen flex items-center"
        onViewportEnter={() => setCtaInView(true)}
        viewport={{ once: true, margin: '-100px' }}
      >
        <div className="max-w-3xl mx-auto text-center w-full">
          <motion.img
            src="/all-thrvie-logo.png"
            alt="All Thrive"
            className="h-16 w-auto mx-auto mb-6"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
            animate={ctaInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
          />
          <motion.h2
            className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
            animate={ctaInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Ready to join{' '}
            <span className="bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent">
              All Thrive
            </span>
            ?
          </motion.h2>

          <motion.p
            className="text-lg text-slate-400 mb-10"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
            animate={ctaInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Share what you offer. Ask for what you need.
          </motion.p>

          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
            animate={ctaInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button
              onClick={() => setShowWaitlistForm(true)}
              className="px-8 py-4 rounded font-semibold text-slate-900 bg-gradient-to-r from-cyan-400 to-green-400 flex items-center gap-2 hover:shadow-[0_0_30px_rgba(34,211,238,0.4)] transition-all cursor-pointer"
            >
              Join Waitlist
              <FontAwesomeIcon icon={faArrowRight} />
            </button>
          </motion.div>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="relative z-10 px-4 sm:px-6 lg:px-8 py-8 border-t border-white/10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img
              src="/all-thrvie-logo.png"
              alt="All Thrive"
              className="h-6 w-auto opacity-50"
            />
            <span className="text-sm text-slate-500">
              &copy; 2026 All Thrive AI
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link to="/privacy" className="hover:text-cyan-400 transition-colors">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-cyan-400 transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </footer>

      {/* Waitlist Slide-out Form */}
      <AnimatePresence>
        {showWaitlistForm && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowWaitlistForm(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />

            {/* Slide-out Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-slate-900 border-l border-white/10 z-50 overflow-y-auto"
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-white">Join the Waitlist</h2>
                  <button
                    onClick={() => setShowWaitlistForm(false)}
                    className="p-2 text-slate-400 hover:text-white transition-colors"
                  >
                    <FontAwesomeIcon icon={faTimes} className="text-xl" />
                  </button>
                </div>

                {/* Form */}
                <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Your name"
                      className="w-full px-4 py-3 rounded bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Email <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      className="w-full px-4 py-3 rounded bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      placeholder="(555) 123-4567"
                      className="w-full px-4 py-3 rounded bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
                    />
                  </div>

                  {/* Asks & Offers intro */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">Asks & Offers</h3>
                    <p className="text-sm text-slate-400">
                      Your asks and offers can be free or paid, it's up to you. We'll connect you with the right people.
                    </p>
                  </div>

                  {/* What do you need? */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-3">
                      What do you need?
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Apps or tools to try', icon: faCode },
                        { label: 'Help learning AI', icon: faGraduationCap },
                        { label: 'Tech or non-tech services', icon: faBriefcase },
                        { label: 'A mentor or advisor', icon: faComments },
                        { label: 'Beta testers or feedback', icon: faFlask },
                        { label: 'Help finding an audience', icon: faBullhorn },
                      ].map((option) => (
                        <label key={option.label} className="cursor-pointer h-full">
                          <input type="checkbox" className="peer sr-only" />
                          <div className="p-4 h-full min-h-[100px] rounded bg-white/5 border border-white/10 text-slate-300 text-center peer-checked:bg-green-500/20 peer-checked:border-green-500/50 peer-checked:text-white hover:bg-white/10 transition-all flex flex-col items-center justify-center gap-2">
                            <FontAwesomeIcon icon={option.icon} className="text-lg text-green-400 peer-checked:text-green-300" />
                            <span className="text-sm leading-tight">{option.label}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* What can you offer? */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-3">
                      What can you offer?
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'An app or tool I built', icon: faCode },
                        { label: 'Courses or tutorials', icon: faGraduationCap },
                        { label: 'Tech or non-tech services', icon: faBriefcase },
                        { label: 'Mentorship', icon: faComments },
                        { label: 'Feedback & beta testing', icon: faFlask },
                        { label: 'Promotion for great projects', icon: faBullhorn },
                      ].map((option) => (
                        <label key={option.label} className="cursor-pointer h-full">
                          <input type="checkbox" className="peer sr-only" />
                          <div className="p-4 h-full min-h-[100px] rounded bg-white/5 border border-white/10 text-slate-300 text-center peer-checked:bg-cyan-500/20 peer-checked:border-cyan-500/50 peer-checked:text-white hover:bg-white/10 transition-all flex flex-col items-center justify-center gap-2">
                            <FontAwesomeIcon icon={option.icon} className="text-lg text-cyan-400 peer-checked:text-cyan-300" />
                            <span className="text-sm leading-tight">{option.label}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Anything else? */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Anything else you'd like to share?
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Tell us about what you're working on, what you're looking for, or anything else..."
                      className="w-full px-4 py-3 rounded bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors resize-none"
                    />
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    className="w-full px-6 py-4 rounded font-semibold text-slate-900 bg-gradient-to-r from-cyan-400 to-green-400 hover:shadow-[0_0_30px_rgba(34,211,238,0.4)] transition-all"
                  >
                    Join the Waitlist
                  </button>

                  <p className="text-xs text-slate-500 text-center">
                    We're accepting people on a rolling basis.
                  </p>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* Step Card Component */
interface StepCardProps {
  step: {
    id: string;
    icon: IconDefinition;
    title: string;
    description: string;
    color: string;
    glowColor: string;
  };
  index: number;
  isInView: boolean;
  prefersReducedMotion: boolean | null;
}

function StepCard({ step, index, isInView, prefersReducedMotion }: StepCardProps) {
  const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
    cyan: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'hover:border-cyan-500/30' },
    green: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'hover:border-green-500/30' },
    purple: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'hover:border-purple-500/30' },
  };

  const colors = colorClasses[step.color] || colorClasses.cyan;

  return (
    <motion.div
      className={`text-center p-8 rounded-lg bg-white/5 border border-white/10 ${colors.border} transition-all group backdrop-blur-sm`}
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: index * 0.15, type: 'spring', stiffness: 100 }}
      whileHover={{ scale: 1.02, boxShadow: `0 0 30px ${step.glowColor}` }}
    >
      <motion.div
        className={`w-16 h-16 rounded-lg mx-auto mb-6 flex items-center justify-center ${colors.bg}`}
        whileHover={{ scale: 1.1 }}
        transition={{ type: 'spring', stiffness: 300 }}
      >
        <FontAwesomeIcon icon={step.icon} className={`text-2xl ${colors.text}`} />
      </motion.div>
      <h3 className="text-xl font-bold mb-3">{step.title}</h3>
      <p className="text-slate-400">{step.description}</p>
    </motion.div>
  );
}

/* Profile Card Component */
interface Offer {
  text: string;
  badge?: string;
  type?: 'app' | 'product' | 'service' | 'skill';
}

interface Ask {
  text: string;
}

interface ProfileCardProps {
  name: string;
  handle: string;
  avatar: string;
  avatarGradient: string;
  offers: Offer[];
  asks: Ask[];
  isInView: boolean;
  direction: 'left' | 'right';
  prefersReducedMotion: boolean | null;
}

function ProfileCard({
  name,
  handle,
  avatar,
  avatarGradient: _avatarGradient,
  offers,
  asks,
  isInView,
  direction,
  prefersReducedMotion,
}: ProfileCardProps) {
  const xOffset = direction === 'left' ? -50 : 50;

  return (
    <motion.div
      className="p-6 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-500/30 transition-all backdrop-blur-sm"
      initial={prefersReducedMotion ? { opacity: 1 } : { x: xOffset, opacity: 0 }}
      animate={isInView ? { x: 0, opacity: 1 } : {}}
      transition={{ type: 'spring', stiffness: 80, damping: 15 }}
      whileHover={{ scale: 1.01 }}
    >
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <motion.img
          src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${avatar}&skinColor=ffdbb4&mouth=smile`}
          alt={name}
          className="w-12 h-12 rounded-full bg-white/10"
          animate={isInView && !prefersReducedMotion ? {
            boxShadow: [
              '0 0 10px rgba(34, 211, 238, 0.3)',
              '0 0 20px rgba(34, 211, 238, 0.5)',
              '0 0 10px rgba(34, 211, 238, 0.3)',
            ],
          } : {}}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div>
          <h4 className="font-bold">{name}</h4>
          <p className="text-sm text-slate-500">{handle}</p>
        </div>
      </div>

      {/* Two Columns - stacked on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Offers */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <FontAwesomeIcon icon={faGift} className="text-cyan-400 text-sm" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              What I Offer
            </span>
          </div>
          <ul className="space-y-2">
            {offers.map((offer, i) => (
              <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                <span className="text-cyan-400 mt-1">•</span>
                <span className="flex-1">
                  {offer.text}
                  {offer.badge && (
                    <span className="ml-2 px-2 py-0.5 rounded text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      {offer.badge}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Asks */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <FontAwesomeIcon icon={faHandshake} className="text-green-400 text-sm" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              What I Need
            </span>
          </div>
          <ul className="space-y-2">
            {asks.map((ask, i) => (
              <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                <span className="text-green-400 mt-1">•</span>
                <span>{ask.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );
}

/* Persona Card Component */
interface PersonaCardProps {
  persona: {
    icon: IconDefinition;
    title: string;
    description: string;
    color: string;
    glowColor: string;
  };
  index: number;
  isInView: boolean;
  prefersReducedMotion: boolean | null;
}

function PersonaCard({ persona, index, isInView, prefersReducedMotion }: PersonaCardProps) {
  const colorClasses: Record<string, { bg: string; text: string }> = {
    cyan: { bg: 'bg-cyan-500/20', text: 'text-cyan-400' },
    green: { bg: 'bg-green-500/20', text: 'text-green-400' },
    purple: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
    amber: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  };

  const colors = colorClasses[persona.color] || colorClasses.cyan;

  return (
    <motion.div
      className="p-6 rounded-lg bg-white/5 border border-white/10 text-center backdrop-blur-sm"
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.8 }}
      animate={isInView ? { opacity: 1, scale: 1 } : {}}
      transition={{ delay: index * 0.1, type: 'spring', stiffness: 150 }}
      whileHover={{
        scale: 1.05,
        boxShadow: `0 0 30px ${persona.glowColor}`,
      }}
    >
      <motion.div
        className={`w-12 h-12 rounded-lg mx-auto mb-4 flex items-center justify-center ${colors.bg}`}
        whileHover={{ scale: 1.1 }}
        transition={{ type: 'spring', stiffness: 300 }}
      >
        <FontAwesomeIcon icon={persona.icon} className={`text-xl ${colors.text}`} />
      </motion.div>
      <h3 className="font-bold mb-2">{persona.title}</h3>
      <p className="text-sm text-slate-400">{persona.description}</p>
    </motion.div>
  );
}

/* Typewriter Text Component */
interface TypewriterTextProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
}

function TypewriterText({ text, speed = 40, onComplete }: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState('');
  const indexRef = useRef(0);

  useEffect(() => {
    setDisplayedText('');
    indexRef.current = 0;

    const interval = setInterval(() => {
      if (indexRef.current < text.length) {
        setDisplayedText(text.slice(0, indexRef.current + 1));
        indexRef.current++;
      } else {
        clearInterval(interval);
        onComplete?.();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, onComplete]);

  return (
    <span>
      {displayedText}
      {displayedText.length < text.length && (
        <span className="animate-pulse">|</span>
      )}
    </span>
  );
}

/* Hero Chat Animation Component */
const chatScenarios = [
  {
    // Scenario 1: Asking for help (technical)
    userMessage: 'I need beta testers for my AI Agent',
    avaResponse: { text: 'I found', highlight: '3 members', suffix: 'who can help!' },
    members: [
      { name: 'Sarah C.', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Emily&skinColor=ffdbb4&mouth=smile', response: 'Happy to test!' },
      { name: 'Marcus J.', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Mike&skinColor=ffdbb4&mouth=smile', response: "I'll give feedback" },
      { name: 'Alex T.', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Tom&skinColor=ffdbb4&mouth=smile', response: 'Count me in' },
    ],
  },
  {
    // Scenario 2: Offering a course/product
    userMessage: 'I made a prompt engineering course',
    avaResponse: { text: 'I found', highlight: '12 members', suffix: 'who need help with prompting. Want me to reach out about your course?' },
    members: [
      { name: 'Jamie L.', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Lisa&skinColor=ffdbb4&mouth=smile', response: 'Sign me up!' },
      { name: 'Chris R.', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Kevin&skinColor=ffdbb4&mouth=smile', response: 'Need this!' },
      { name: 'Dana K.', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Amy&skinColor=ffdbb4&mouth=smile', response: 'How much?' },
    ],
  },
];

interface HeroChatAnimationProps {
  prefersReducedMotion: boolean | null;
}

function HeroChatAnimation({ prefersReducedMotion }: HeroChatAnimationProps) {
  const [step, setStep] = useState(0);
  const [loopKey, setLoopKey] = useState(0);
  const [scenarioIndex, setScenarioIndex] = useState(0);

  const scenario = chatScenarios[scenarioIndex];

  useEffect(() => {
    // If reduced motion, show final state immediately
    if (prefersReducedMotion) {
      setStep(3);
      return;
    }

    // Start animation sequence
    const timers: NodeJS.Timeout[] = [];

    // Step 1: Show user message (start)
    timers.push(setTimeout(() => setStep(1), 100));

    // Step 2: Show Ava response (after typing completes ~2.5s)
    timers.push(setTimeout(() => setStep(2), 2800));

    // Step 3: Show matching members
    timers.push(setTimeout(() => setStep(3), 4000));

    // Reset and loop with next scenario (after 8s total)
    timers.push(
      setTimeout(() => {
        setStep(0);
        setScenarioIndex((i) => (i + 1) % chatScenarios.length);
        setLoopKey((k) => k + 1);
      }, 8500)
    );

    return () => timers.forEach(clearTimeout);
  }, [loopKey, prefersReducedMotion]);

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Chat container with glass effect */}
      <motion.div
        className="bg-white/5 border border-white/10 rounded p-5 backdrop-blur-sm min-h-[280px]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* User message */}
        <AnimatePresence mode="wait">
          {step >= 1 && (
            <motion.div
              key={`user-${loopKey}`}
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-start justify-end gap-3 mb-4"
            >
              <div className="bg-cyan-500/20 border border-cyan-500/30 rounded-2xl px-4 py-2.5 max-w-[75%]">
                <p className="text-sm text-white">
                  {prefersReducedMotion ? (
                    scenario.userMessage
                  ) : (
                    <TypewriterText text={scenario.userMessage} speed={60} />
                  )}
                </p>
              </div>
              <img
                src="https://api.dicebear.com/9.x/avataaars/svg?seed=Ryan&skinColor=ffdbb4&mouth=smile"
                alt="You"
                className="w-8 h-8 rounded-full bg-cyan-500/20 flex-shrink-0"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Ava response */}
        <AnimatePresence mode="wait">
          {step >= 2 && (
            <motion.div
              key={`ava-${loopKey}`}
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-start gap-3 mb-4"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-cyan-500 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-white">A</span>
              </div>
              <div className="bg-white/10 border border-white/10 rounded-2xl px-4 py-2.5">
                <p className="text-sm text-white">
                  {scenario.avaResponse.text}{' '}
                  <span className="text-cyan-400 font-semibold">{scenario.avaResponse.highlight}</span>{' '}
                  {scenario.avaResponse.suffix}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Matching members */}
        <AnimatePresence mode="wait">
          {step >= 3 && (
            <motion.div
              key={`members-${loopKey}`}
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex gap-2 justify-center"
            >
              {scenario.members.map((member, i) => (
                <motion.div
                  key={member.name}
                  initial={prefersReducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{
                    delay: prefersReducedMotion ? 0 : i * 0.15,
                    type: 'spring',
                    stiffness: 200,
                    damping: 15,
                  }}
                  className="bg-white/5 border border-white/10 rounded p-3 text-center flex-1"
                >
                  <img
                    src={member.avatar}
                    alt={member.name}
                    className="w-10 h-10 rounded-full mx-auto mb-2 bg-white/10"
                  />
                  <p className="text-xs text-white font-medium">{member.name}</p>
                  <p className="text-xs text-green-400 mt-0.5">{member.response}</p>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
