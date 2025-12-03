/**
 * RightAboutPanel - About Us slide-out tray with Neon Glass aesthetic
 */

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTimes,
  faStar,
  faLightbulb,
  faHeart,
  faRocket,
  faUsers,
  faWandMagicSparkles,
} from '@fortawesome/free-solid-svg-icons';

interface RightAboutPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RightAboutPanel({ isOpen, onClose }: RightAboutPanelProps) {
  return (
    <>
      {/* Backdrop overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}

      {/* Sliding Panel */}
      <div
        className={`fixed right-0 top-0 w-full md:w-[520px] h-full flex flex-col z-50 transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          backgroundColor: 'rgba(2, 6, 23, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderLeft: '1px solid rgba(14, 165, 233, 0.2)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center shadow-neon">
              <FontAwesomeIcon icon={faWandMagicSparkles} className="text-cyan-bright" />
            </div>
            <h2 className="text-xl font-bold text-white">
              About <span className="text-cyan-bright">All Thrive</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:border-white/30 flex items-center justify-center transition-all hover:bg-white/10"
            aria-label="Close about panel"
          >
            <FontAwesomeIcon icon={faTimes} className="text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Hero Banner */}
          <div className="relative w-full h-48 bg-gradient-to-br from-cyan-500/20 via-background to-pink-accent/10 flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 bg-grid-pattern opacity-20" />
            <div className="absolute top-[-50%] right-[-20%] w-[400px] h-[400px] rounded-full bg-cyan-500/10 blur-[80px]" />
            <div className="absolute bottom-[-30%] left-[-10%] w-[300px] h-[300px] rounded-full bg-pink-accent/10 blur-[60px]" />
            <div className="relative text-center z-10">
              <div className="text-6xl mb-3">🌟</div>
              <p className="text-lg font-bold text-white">All Thrive AI</p>
              <p className="text-sm text-cyan-bright">Where creators thrive together</p>
            </div>
          </div>

          {/* Main Content */}
          <div className="p-6 space-y-8">
            {/* Hero Statement */}
            <div className="glass-card neon-border p-5">
              <p className="text-lg font-bold text-white leading-relaxed">
                All Thrive is one home where AI-curious creators{' '}
                <span className="text-cyan-bright">learn</span>,{' '}
                <span className="text-pink-accent">showcase</span>, and{' '}
                <span className="text-emerald-400">thrive</span> together.
              </p>
            </div>

            {/* Problem & Solution */}
            <div className="space-y-4 text-slate-300 leading-relaxed">
              <p>
                AI gives you hundreds of tools to create, prototype, and launch new ideas, but there&apos;s still no single
                place to consolidate, showcase, and get feedback on all your projects, no matter which tools you used.
              </p>
              <p>
                You juggle projects across platforms, struggle to decide where to start, and keep running into spaces
                that act like you need to be a senior engineer before your work is worth sharing.
              </p>
            </div>

            {/* Belief Highlight */}
            <div className="glass-card p-5 border-l-4 border-pink-accent">
              <p className="text-lg font-semibold text-white leading-relaxed">
                We believe you only need <span className="text-cyan-bright">curiosity</span>, a willingness to try, and a{' '}
                <span className="text-pink-accent">community</span> that encourages you to explore what is possible.
              </p>
            </div>

            {/* Divider */}
            <div className="border-t border-white/10" />

            {/* What We Stand For */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-5 flex items-center gap-3">
                <FontAwesomeIcon icon={faStar} className="text-yellow-400" />
                What We Stand For
              </h2>
              <ul className="space-y-3">
                {[
                  { text: 'curiosity over perfection', highlight: 'and exploration over certainty.' },
                  { text: 'experimenting and sharing', highlight: 'what we discover.' },
                  { text: 'kind, thoughtful', highlight: 'feedback that helps ideas grow.' },
                  { text: 'courage to begin', highlight: 'not just the final result.' },
                  { text: 'everyone has something worth creating', highlight: 'and sharing.' },
                  { text: 'creativity grows when supported', highlight: 'by others.' },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-300">
                    <span className="w-6 h-6 rounded-md bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-cyan-bright text-xs">✦</span>
                    </span>
                    <span>
                      We value <span className="text-white font-medium">{item.text}</span> {item.highlight}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Simple Promise */}
            <div className="glass-card p-5">
              <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <span className="text-2xl">💫</span> Simple Promise
              </h2>
              <p className="text-slate-300 leading-relaxed">
                We promise to hold space for <span className="text-cyan-bright">curiosity</span>,{' '}
                <span className="text-pink-accent">connection</span>, and <span className="text-emerald-400">shared learning</span>.
                All Thrive is a place where trying matters, ideas are welcomed, and everyone can explore what is possible with AI.
              </p>
            </div>

            {/* Divider */}
            <div className="border-t border-white/10" />

            {/* Community Values */}
            <div>
              <h2 id="our-values" className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <FontAwesomeIcon icon={faUsers} className="text-cyan-bright" />
                Community Values
              </h2>

              <div className="space-y-4">
                {[
                  {
                    icon: faLightbulb,
                    title: 'Curiosity First',
                    description: 'We champion exploration over expertise. Questions matter more than answers, and trying something new is always worth celebrating.',
                    color: 'cyan',
                  },
                  {
                    icon: faRocket,
                    title: 'Learn by Doing',
                    description: 'We believe the best way to understand AI is to build with it. Every experiment, prototype, and project is a chance to learn something new.',
                    color: 'purple',
                  },
                  {
                    icon: faUsers,
                    title: 'We Thrive Together',
                    description: "We celebrate both collaboration and healthy competition. Whether we're building together or challenging each other in hackathons, we all grow stronger by lifting each other up.",
                    color: 'pink',
                  },
                  {
                    icon: faHeart,
                    title: 'Lead with Kindness & Respect',
                    description: 'We treat others the way we want to be treated. Leading by example with empathy, thoughtfulness, and respect creates the supportive community we all deserve.',
                    color: 'rose',
                  },
                  {
                    icon: faStar,
                    title: 'Celebrate the Messy Middle',
                    description: 'We share the journey, not just the highlights. Failures, experiments, and lessons learned are just as valuable as the wins.',
                    color: 'yellow',
                  },
                  {
                    icon: faWandMagicSparkles,
                    title: 'You Belong Here',
                    description: 'You are enough as you are. You can learn this. Your perspective matters. All you need is curiosity and the willingness to start.',
                    color: 'emerald',
                  },
                ].map((value, i) => {
                  const colorMap: Record<string, string> = {
                    cyan: 'border-cyan-500/30 bg-cyan-500/10',
                    purple: 'border-purple-500/30 bg-purple-500/10',
                    pink: 'border-pink-500/30 bg-pink-500/10',
                    rose: 'border-rose-500/30 bg-rose-500/10',
                    yellow: 'border-yellow-500/30 bg-yellow-500/10',
                    emerald: 'border-emerald-500/30 bg-emerald-500/10',
                  };
                  const iconColorMap: Record<string, string> = {
                    cyan: 'text-cyan-400',
                    purple: 'text-purple-400',
                    pink: 'text-pink-400',
                    rose: 'text-rose-400',
                    yellow: 'text-yellow-400',
                    emerald: 'text-emerald-400',
                  };
                  return (
                    <div
                      key={i}
                      className={`p-4 rounded-xl border ${colorMap[value.color]} transition-all hover:scale-[1.01]`}
                    >
                      <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                        <FontAwesomeIcon icon={value.icon} className={iconColorMap[value.color]} />
                        {i + 1}. {value.title}
                      </h3>
                      <p className="text-sm text-slate-300 leading-relaxed pl-6">
                        {value.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer spacer */}
            <div className="h-6" />
          </div>
        </div>

        {/* Circuit connector decoration */}
        <div className="absolute bottom-4 left-4 circuit-connector opacity-20" />
      </div>
    </>
  );
}
