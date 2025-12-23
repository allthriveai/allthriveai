/**
 * AboutContent - Shared content component for About Us section
 * Used in both the About page (/about) and the right panel tray
 * Ensures content is maintained in a single location
 */

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faStar,
  faLightbulb,
  faHeart,
  faRocket,
  faUsers,
  faWandMagicSparkles,
} from '@fortawesome/free-solid-svg-icons';

export function AboutContent() {
  return (
    <div className="space-y-8">
      {/* Hero Statement */}
      <div className="glass-card neon-border p-5">
        <p className="text-lg font-bold text-white leading-relaxed">
          All Thrive is a community where AI-curious members{' '}
          <span className="text-cyan-bright">explore</span>,{' '}
          <span className="text-pink-accent">build</span>, and{' '}
          <span className="text-emerald-400">grow</span> together.
        </p>
      </div>

      {/* Problem & Solution */}
      <div className="space-y-4 text-slate-300 leading-relaxed">
        <p>
          AI tools are everywhere, but finding your people and a space to actually learn and grow? That&apos;s harder.
          Most communities feel like they&apos;re made for experts, not for people still figuring things out.
        </p>
        <p>
          We built All Thrive for the curious ones. The people who want to experiment with AI, share what they&apos;re
          building (even the messy stuff), and learn alongside others who are on the same journey.
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
    </div>
  );
}
