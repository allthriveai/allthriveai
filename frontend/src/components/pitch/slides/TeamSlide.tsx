import { motion } from 'framer-motion';
import { PitchSlide, GlassCard, GradientText } from '../PitchSlide';

const team = [
  {
    name: 'Allie Jones',
    role: 'Founder & CEO/CTO',
    bio: 'Designer, engineer, and builder passionate about AI creativity tools. Over 15 years of engineering experience spanning open-source development, product design, and enterprise pre-sales engineering including 8 years at Acquia (creator of Drupal). Open-source contributor and technical leader focused on building scalable, creator-friendly AI products.',
    image: '/allie-jones.jpeg',
  },
  {
    name: 'Gina Levy',
    role: 'Founder & Chief Community & Growth Officer',
    bio: 'Community-driven marketer and growth leader. Founder of Kinlia, a 50K+ event-focused community. Hosted over 500 in-person and virtual events. Harvard graduate, and an award-winning filmmaker whose work has premiered at Sundance and been shortlisted for the Academy Awards. Expert in fostering engagement, storytelling, and vibrant user communities.',
    image: '/gina.jpeg',
  },
  {
    name: 'Imnet Worku Edossa',
    role: 'Founder & Chief AI Systems Officer',
    bio: 'Technical leader focused on turning AI and cloud infrastructure into scalable products. Senior full-stack engineer and architect with 15+ years of experience leading engineering teams in enterprise dev ops and platform automation across Kubernetes, CI/CD, and developer tooling.',
    image: '/imnet.jpeg',
  },
];

const advisors = [
  { name: 'Debbie Hudzik', role: 'Financial Advisor' },
  { name: 'TBD', role: 'Advisor' },
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
          className="text-center mb-12"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            The <GradientText>Team</GradientText>
          </h2>
          <p className="text-xl text-gray-400">
            Builders who understand AI creators
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
                {/* Avatar placeholder */}
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500/30 to-green-500/30 mx-auto mb-4 flex items-center justify-center border-2 border-white/10">
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
                <p className="text-cyan-400 font-medium text-sm mb-2">{member.role}</p>
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
