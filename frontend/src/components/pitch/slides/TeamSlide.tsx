import { motion } from 'framer-motion';
import { PitchSlide, GlassCard, GradientText } from '../PitchSlide';

const team = [
  {
    name: 'Allie Aronson',
    role: 'Founder & CEO',
    bio: 'Designer & builder passionate about AI creativity tools',
    image: null, // Placeholder - can add image path
  },
];

const advisors = [
  { name: 'AI Industry Advisor', role: 'Strategic Guidance' },
  { name: 'Growth Expert', role: 'GTM Strategy' },
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

        {/* Founder */}
        <div className="flex justify-center mb-12">
          {team.map((member, index) => (
            <motion.div
              key={member.name}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 + index * 0.15 }}
              className="max-w-md"
            >
              <GlassCard className="text-center p-8" hover>
                {/* Avatar placeholder */}
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-cyan-500/30 to-green-500/30 mx-auto mb-6 flex items-center justify-center border-2 border-white/10">
                  {member.image ? (
                    <img
                      src={member.image}
                      alt={member.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl font-bold text-white/50">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  )}
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">{member.name}</h3>
                <p className="text-cyan-400 font-medium mb-4">{member.role}</p>
                <p className="text-gray-400">{member.bio}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        {/* Advisors */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <h3 className="text-center text-lg font-semibold text-gray-400 mb-6">Advisors</h3>
          <div className="flex justify-center gap-6 flex-wrap">
            {advisors.map((advisor, index) => (
              <motion.div
                key={advisor.name}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.6 + index * 0.1 }}
              >
                <GlassCard className="text-center py-4 px-6">
                  <div className="text-white font-medium">{advisor.name}</div>
                  <div className="text-sm text-gray-500">{advisor.role}</div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Hiring note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="text-center mt-10"
        >
          <p className="text-gray-500">
            Actively hiring: <span className="text-cyan-400">Engineering</span> & <span className="text-green-400">Growth</span>
          </p>
        </motion.div>
      </div>
    </PitchSlide>
  );
}
