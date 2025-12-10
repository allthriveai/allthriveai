import { motion } from 'framer-motion';
import { PitchSlide, GlassCard, GradientText } from '../PitchSlide';

const team = [
  {
    name: 'Allie Jones',
    role: 'CEO/CTO',
    founder: true,
    bio: 'Engineer, builder, and sales leader passionate about AI creativity tools. 15+ years in open-source and software architecture, including 8 years at Acquia.',
    image: '/allie-jones.jpeg',
  },
  {
    name: 'Gina Levy',
    role: 'Chief Community & Growth Officer',
    founder: true,
    bio: 'Community-driven marketer and growth leader. Founder of Kinlia (50K+ community). Harvard graduate and Sundance filmmaker shortlisted for the Academy Awards.',
    image: '/gina.jpeg',
  },
  {
    name: 'Imnet Worku Edossa',
    role: 'Chief AI Systems Officer',
    founder: true,
    bio: 'Technical leader turning AI and cloud infrastructure into scalable products. 15+ years leading engineering teams in enterprise DevOps and platform automation.',
    image: '/imnet.jpeg',
  },
];

const advisors = [
  { name: 'Debbie Hudzik', role: 'Financial Advisor' },
  { name: 'Thomas Wythe', role: 'Technical and Startup Advisor' },
  { name: 'TBD', role: 'Advisor' },
];

export function TeamSlide() {
  return (
    <PitchSlide>
      <div className="w-full max-w-5xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            The <GradientText>Team</GradientText>
          </h2>
          <p className="text-xl text-gray-400">
            Builders who understand AI creators and building community
          </p>
        </motion.div>

        {/* Team */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {team.map((member, index) => (
            <motion.div
              key={`${member.name}-${index}`}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 + index * 0.15 }}
            >
              <GlassCard className="text-center p-6 h-full" hover>
                {/* Avatar */}
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500/30 to-green-500/30 mx-auto mb-4 flex items-center justify-center border-2 border-white/10 overflow-hidden">
                  {member.image ? (
                    <img
                      src={member.image}
                      alt={member.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-white/50">
                      {member.name === 'TBD' ? '?' : member.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-bold text-white mb-1">{member.name}</h3>
                <p className="text-cyan-400 font-medium text-sm">{member.role}</p>
                {member.founder && <p className="text-gray-500 text-xs mb-2">Founder</p>}
                <p className="text-gray-400 text-sm">{member.bio}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        {/* Advisors */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <h3 className="text-center text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wider">Advisors</h3>
          <div className="flex justify-center gap-4 flex-wrap">
            {advisors.map((advisor, index) => (
              <motion.div
                key={`${advisor.name}-${index}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.7 + index * 0.1 }}
              >
                <GlassCard className="text-center py-3 px-5">
                  <div className="text-white font-medium text-sm">{advisor.name}</div>
                  <div className="text-xs text-gray-500">{advisor.role}</div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </motion.div>

      </div>
    </PitchSlide>
  );
}
