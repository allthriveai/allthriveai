import { useState } from 'react';
import { Link } from 'react-router-dom';
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
  faCheck,
} from '@fortawesome/free-solid-svg-icons';

/**
 * CollectiveLandingPage - Test landing page for the AI Collective concept
 *
 * Tagline: "Share what you offer. Ask for what you need. The All Thrive AI Collective."
 *
 * Core concept: Everyone has what they OFFER and what they're ASKING for.
 */
export default function CollectiveLandingPage() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleWaitlistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement actual waitlist submission
    setIsSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background relative overflow-hidden">
      {/* Ambient Background Effects */}
      <div className="fixed inset-0 bg-grid-pattern opacity-10 dark:opacity-20 pointer-events-none" />
      <div className="fixed top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-cyan-500/5 dark:bg-cyan-500/10 blur-[100px] pointer-events-none" />
      <div className="fixed bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-green-500/5 dark:bg-green-500/10 blur-[120px] pointer-events-none" />

      {/* Simple Header */}
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
            className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-16 sm:pb-24">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 dark:bg-cyan-500/20 border border-cyan-500/20 dark:border-cyan-500/30 text-cyan-600 dark:text-cyan-400 text-sm font-medium mb-8">
            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
            Coming Soon
          </div>

          {/* Main Tagline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 dark:text-white mb-6 leading-tight">
            Share what you{' '}
            <span className="bg-gradient-to-r from-cyan-500 to-green-500 bg-clip-text text-transparent">
              offer
            </span>
            .
            <br />
            Ask for what you{' '}
            <span className="bg-gradient-to-r from-green-500 to-cyan-500 bg-clip-text text-transparent">
              need
            </span>
            .
          </h1>

          <p className="text-xl sm:text-2xl text-slate-600 dark:text-slate-300 mb-4 font-medium">
            The All Thrive AI Collective.
          </p>

          <p className="text-lg text-slate-500 dark:text-slate-400 mb-12 max-w-2xl mx-auto">
            A community where AI enthusiasts, builders, and learners connect through mutual exchange.
            Everyone has something to offer and something they need.
          </p>

          {/* Waitlist Form */}
          {!isSubmitted ? (
            <form onSubmit={handleWaitlistSubmit} className="max-w-md mx-auto">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="flex-1 px-4 py-3 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
                />
                <button
                  type="submit"
                  className="px-6 py-3 rounded-lg font-semibold text-slate-900 dark:text-slate-900 transition-all hover:scale-[1.02] hover:shadow-lg"
                  style={{
                    background: 'linear-gradient(135deg, #22d3ee, #4ade80)',
                  }}
                >
                  Join Waitlist
                  <FontAwesomeIcon icon={faArrowRight} className="ml-2" />
                </button>
              </div>
            </form>
          ) : (
            <div className="max-w-md mx-auto p-6 rounded-xl bg-green-500/10 dark:bg-green-500/20 border border-green-500/30">
              <div className="flex items-center justify-center gap-3 text-green-600 dark:text-green-400">
                <FontAwesomeIcon icon={faCheck} className="text-xl" />
                <span className="font-semibold">You're on the list!</span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                We'll notify you when the Collective launches.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* How It Works */}
      <section className="relative z-10 px-4 sm:px-6 lg:px-8 py-16 sm:py-24 bg-white/50 dark:bg-white/[0.02]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              How it works
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              The Collective is built on a simple idea: mutual exchange creates thriving communities.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1: Offer */}
            <div className="text-center p-8 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-cyan-500/30 transition-all group">
              <div
                className="w-16 h-16 rounded-xl mx-auto mb-6 flex items-center justify-center transition-transform group-hover:scale-110"
                style={{ background: 'linear-gradient(135deg, #22d3ee20, #22d3ee10)' }}
              >
                <FontAwesomeIcon icon={faGift} className="text-2xl text-cyan-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Share What You Offer</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Apps you've built, skills you have, courses you've created, feedback you can give.
              </p>
            </div>

            {/* Step 2: Ask */}
            <div className="text-center p-8 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-green-500/30 transition-all group">
              <div
                className="w-16 h-16 rounded-xl mx-auto mb-6 flex items-center justify-center transition-transform group-hover:scale-110"
                style={{ background: 'linear-gradient(135deg, #4ade8020, #4ade8010)' }}
              >
                <FontAwesomeIcon icon={faHandshake} className="text-2xl text-green-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Ask For What You Need</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Beta testers, feedback, collaborators, advice, help learning something new.
              </p>
            </div>

            {/* Step 3: Match */}
            <div className="text-center p-8 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-purple-500/30 transition-all group">
              <div
                className="w-16 h-16 rounded-xl mx-auto mb-6 flex items-center justify-center transition-transform group-hover:scale-110"
                style={{ background: 'linear-gradient(135deg, #a855f720, #a855f710)' }}
              >
                <FontAwesomeIcon icon={faPuzzlePiece} className="text-2xl text-purple-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Connect & Thrive</h3>
              <p className="text-slate-600 dark:text-slate-400">
                We match your asks with others' offers. Everyone wins when the community thrives.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Example Profiles */}
      <section className="relative z-10 px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Meet the Collective
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Every member brings something unique. Here's what profiles look like.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Profile Card 1 */}
            <ProfileCard
              name="Sarah Chen"
              handle="@sarahbuilds"
              avatar="SC"
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
            />

            {/* Profile Card 2 */}
            <ProfileCard
              name="Marcus Johnson"
              handle="@marcusai"
              avatar="MJ"
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
            />
          </div>
        </div>
      </section>

      {/* Who Is This For */}
      <section className="relative z-10 px-4 sm:px-6 lg:px-8 py-16 sm:py-24 bg-white/50 dark:bg-white/[0.02]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Who is the Collective for?
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <PersonaCard
              icon={faRocket}
              title="AI Builders"
              description="Share your apps, get beta testers, find collaborators"
              color="#22d3ee"
            />
            <PersonaCard
              icon={faLightbulb}
              title="Learners"
              description="Find courses, get mentorship, accelerate your journey"
              color="#4ade80"
            />
            <PersonaCard
              icon={faUsers}
              title="Founders"
              description="Find co-founders, get feedback, validate ideas"
              color="#a855f7"
            />
            <PersonaCard
              icon={faStar}
              title="Experts"
              description="Monetize knowledge, build audience, mentor others"
              color="#f59e0b"
            />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-6">
            Ready to join the Collective?
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">
            Be among the first to experience a new way of connecting in the AI community.
          </p>

          {!isSubmitted ? (
            <form onSubmit={handleWaitlistSubmit} className="max-w-md mx-auto">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="flex-1 px-4 py-3 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
                />
                <button
                  type="submit"
                  className="px-6 py-3 rounded-lg font-semibold text-slate-900 dark:text-slate-900 transition-all hover:scale-[1.02] hover:shadow-lg"
                  style={{
                    background: 'linear-gradient(135deg, #22d3ee, #4ade80)',
                  }}
                >
                  Join Waitlist
                </button>
              </div>
            </form>
          ) : (
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-green-500/10 dark:bg-green-500/20 border border-green-500/30 text-green-600 dark:text-green-400">
              <FontAwesomeIcon icon={faCheck} />
              <span className="font-semibold">You're on the list!</span>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-4 sm:px-6 lg:px-8 py-8 border-t border-slate-200 dark:border-white/10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img
              src="/all-thrvie-logo.png"
              alt="All Thrive"
              className="h-6 w-auto opacity-50"
            />
            <span className="text-sm text-slate-500 dark:text-slate-500">
              &copy; 2025 All Thrive AI
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-500 dark:text-slate-500">
            <Link to="/privacy" className="hover:text-cyan-500 transition-colors">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-cyan-500 transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
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

function ProfileCard({
  name,
  handle,
  avatar,
  avatarGradient,
  offers,
  asks,
}: {
  name: string;
  handle: string;
  avatar: string;
  avatarGradient: string;
  offers: Offer[];
  asks: Ask[];
}) {
  return (
    <div className="p-6 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-cyan-500/30 transition-all">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div
          className={`w-12 h-12 rounded-full bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-white font-bold`}
        >
          {avatar}
        </div>
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white">{name}</h4>
          <p className="text-sm text-slate-500 dark:text-slate-500">{handle}</p>
        </div>
      </div>

      {/* Two Columns */}
      <div className="grid grid-cols-2 gap-6">
        {/* Offers */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <FontAwesomeIcon icon={faGift} className="text-cyan-500 text-sm" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              What I Offer
            </span>
          </div>
          <ul className="space-y-2">
            {offers.map((offer, i) => (
              <li key={i} className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                <span className="text-cyan-500 mt-1">•</span>
                <span className="flex-1">
                  {offer.text}
                  {offer.badge && (
                    <span className="ml-2 px-2 py-0.5 rounded text-xs bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
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
            <FontAwesomeIcon icon={faHandshake} className="text-green-500 text-sm" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              What I Need
            </span>
          </div>
          <ul className="space-y-2">
            {asks.map((ask, i) => (
              <li key={i} className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                <span className="text-green-500 mt-1">•</span>
                <span>{ask.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* Persona Card Component */
function PersonaCard({
  icon,
  title,
  description,
  color,
}: {
  icon: typeof faRocket;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <div className="p-6 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-opacity-50 transition-all text-center group"
      style={{ ['--hover-color' as string]: color }}
    >
      <div
        className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center transition-transform group-hover:scale-110"
        style={{ background: `${color}20` }}
      >
        <FontAwesomeIcon icon={icon} className="text-xl" style={{ color }} />
      </div>
      <h3 className="font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>
    </div>
  );
}
