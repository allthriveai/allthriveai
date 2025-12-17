/**
 * Testimonials - User testimonials band for the landing page
 *
 * Uses Neon Glass design system:
 * - Glass card surfaces with backdrop blur
 * - Cyan/teal neon accents
 * - Gradient text and glow effects
 */

import { motion } from 'framer-motion';
import { StarIcon } from '@heroicons/react/24/solid';
import { useQuery } from '@tanstack/react-query';
import { getPlatformStats, formatStat } from '@/services/stats';

interface Testimonial {
  id: number;
  name: string;
  role: string;
  avatar: string;
  content: string;
  rating: number;
}

const testimonials: Testimonial[] = [
  {
    id: 1,
    name: 'Sarah Chen',
    role: 'AI Designer',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah&backgroundColor=0ea5e9',
    content:
      'All Thrive AI completely transformed how I showcase my work. The automated portfolio feature saved me countless hours.',
    rating: 5,
  },
  {
    id: 2,
    name: 'Marcus Johnson',
    role: 'ML Engineer',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=marcus&backgroundColor=14b8a6',
    content:
      'Finally, a platform that understands AI creators. The community here is incredibly supportive and inspiring.',
    rating: 5,
  },
  {
    id: 3,
    name: 'Elena Rodriguez',
    role: 'Prompt Artist',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=elena&backgroundColor=8b5cf6',
    content:
      'The side quests keep me motivated to learn and create. I\'ve grown more in 3 months here than in a year on my own.',
    rating: 5,
  },
  {
    id: 4,
    name: 'David Kim',
    role: 'AI Researcher',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=david&backgroundColor=ec4899',
    content:
      'Connecting with other AI enthusiasts has opened doors I never knew existed. This platform is a game changer.',
    rating: 5,
  },
];

export function Testimonials() {
  // Fetch platform stats
  const { data: stats } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: getPlatformStats,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  return (
    <section className="relative py-24 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
            Loved by{' '}
            <span className="bg-gradient-to-r from-cyan-400 via-teal-400 to-green-400 bg-clip-text text-transparent">
              AI Creators
            </span>
          </h2>
          <p className="text-lg text-gray-400 max-w-3xl mx-auto">
            Join to see what others are building, learn together, and grow your skill portfolio.
          </p>
        </motion.div>

        {/* Testimonials Ticker */}
        <div className="relative">
          {/* Fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#020617] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#020617] to-transparent z-10 pointer-events-none" />

          {/* Scrolling container */}
          <div className="overflow-hidden">
            <motion.div
              className="flex gap-6"
              animate={{ x: ['0%', '-50%'] }}
              transition={{
                x: {
                  duration: 30,
                  repeat: Infinity,
                  ease: 'linear',
                },
              }}
            >
              {/* Double the testimonials for seamless loop */}
              {[...testimonials, ...testimonials].map((testimonial, index) => (
                <div
                  key={`${testimonial.id}-${index}`}
                  className="group flex-shrink-0 w-[320px]"
                >
                  <div className="h-full p-6 rounded-sm bg-white/[0.03] backdrop-blur-xl border border-white/10 hover:border-cyan-500/30 hover:bg-white/[0.05] transition-all duration-300">
                    {/* Stars */}
                    <div className="flex gap-1 mb-4">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <StarIcon
                          key={i}
                          className="w-4 h-4 text-cyan-400"
                        />
                      ))}
                    </div>

                    {/* Content */}
                    <p className="text-gray-300 text-sm leading-relaxed mb-6">
                      "{testimonial.content}"
                    </p>

                    {/* Author */}
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img
                          src={testimonial.avatar}
                          alt={testimonial.name}
                          className="w-10 h-10 rounded-full bg-white/10"
                        />
                        <div className="absolute inset-0 rounded-full ring-2 ring-cyan-500/30 group-hover:ring-cyan-500/50 transition-all" />
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">
                          {testimonial.name}
                        </p>
                        <p className="text-gray-500 text-xs">{testimonial.role}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Bottom Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 flex flex-wrap justify-center gap-8 md:gap-16"
        >
          {stats ? (
            <>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
                  {formatStat(stats.activeCreators)}
                </div>
                <div className="text-gray-500 text-sm mt-1">Active Creators</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
                  {formatStat(stats.projectsShared)}
                </div>
                <div className="text-gray-500 text-sm mt-1">Projects Shared</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
                  {formatStat(stats.collectivePoints)}
                </div>
                <div className="text-gray-500 text-sm mt-1">Total Points Won</div>
              </div>
            </>
          ) : (
            // Loading skeleton
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent animate-pulse">
                    ...
                  </div>
                  <div className="text-gray-500 text-sm mt-1">
                    {i === 1 ? 'Active Creators' : i === 2 ? 'Projects Shared' : 'Total Points Won'}
                  </div>
                </div>
              ))}
            </>
          )}
        </motion.div>
      </div>
    </section>
  );
}
