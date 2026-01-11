/**
 * AllieConnectPage - Personal landing page for Allie
 *
 * Public ungated page with links to connect
 */

import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLinkedin } from '@fortawesome/free-brands-svg-icons';
import {
  faCalendarAlt,
} from '@fortawesome/free-solid-svg-icons';
import { SEO } from '@/components/common/SEO';

// Configuration - update these values
const ALLIE_CONFIG = {
  name: 'Allie Jones',
  title: 'Founder and CTO of All Thrive',
  image: '/allie-headshot-2026.png',
  blurb1: "I'm building All Thrive to make AI accessible and fun for everyone.",
  blurb2: "Whether you have something to offer or need help with AI, I'd love to connect and see how we can help each other thrive!",
  links: {
    linkedin: 'https://www.linkedin.com/in/allierays/',
    calendly: 'https://calendly.com/allie-allthrive/30min',
    allthrive: window.location.origin,
  },
};

export default function AllieConnectPage() {
  return (
    <>
      <SEO
        title={`Connect with ${ALLIE_CONFIG.name} | All Thrive`}
        description={`${ALLIE_CONFIG.blurb1} ${ALLIE_CONFIG.blurb2}`}
        image={ALLIE_CONFIG.image}
      />

      <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden px-4 py-4 sm:py-6">
        {/* Background with animated gradient - matching FinalCTA style */}
        <div className="absolute inset-0" aria-hidden="true">
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse 80% 60% at 50% 50%, rgba(34, 211, 238, 0.15) 0%, transparent 50%),
                radial-gradient(ellipse 60% 40% at 30% 30%, rgba(74, 222, 128, 0.1) 0%, transparent 50%),
                radial-gradient(ellipse 50% 50% at 70% 70%, rgba(168, 85, 247, 0.08) 0%, transparent 50%),
                linear-gradient(180deg, #020617 0%, #0a1628 50%, #020617 100%)
              `,
            }}
          />
          {/* Animated particles */}
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 rounded-full bg-cyan-400/30"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                animate={{
                  y: [-20, 20, -20],
                  opacity: [0.3, 0.8, 0.3],
                }}
                transition={{
                  duration: 3 + Math.random() * 2,
                  repeat: Infinity,
                  delay: Math.random() * 2,
                }}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <motion.div
          className="relative z-10 max-w-sm w-full text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Profile Image */}
          <motion.div
            className="mb-3 sm:mb-4"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
          >
            <div className="relative inline-block">
              <div className="absolute -inset-2 bg-gradient-to-br from-cyan-400 via-teal-500 to-cyan-600 rounded-full blur-lg opacity-40" />
              <img
                src={ALLIE_CONFIG.image}
                alt={ALLIE_CONFIG.name}
                className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-3 border-white/10 shadow-xl"
              />
            </div>
          </motion.div>

          {/* Name & Title */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h1 className="text-2xl font-bold text-white">{ALLIE_CONFIG.name}</h1>
            <p className="text-cyan-bright text-sm font-medium">{ALLIE_CONFIG.title}</p>
          </motion.div>

          {/* Blurb */}
          <motion.div
            className="mt-2 mb-4 sm:mt-3 sm:mb-6 space-y-1.5 sm:space-y-2 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <p className="text-slate-400 text-sm leading-relaxed">
              {ALLIE_CONFIG.blurb1}
            </p>
            <p className="text-slate-400 text-sm leading-relaxed">
              {ALLIE_CONFIG.blurb2}
            </p>
          </motion.div>

          {/* Links */}
          <motion.div
            className="space-y-2.5 sm:space-y-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <a
              href={ALLIE_CONFIG.links.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary w-full py-3 sm:py-4 text-base font-medium flex items-center justify-center gap-2"
            >
              <FontAwesomeIcon icon={faLinkedin} className="w-5 h-5" />
              LinkedIn
            </a>
            <a
              href={ALLIE_CONFIG.links.calendly}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary w-full py-3 sm:py-4 text-base font-medium flex items-center justify-center gap-2"
            >
              <FontAwesomeIcon icon={faCalendarAlt} className="w-5 h-5" />
              Book a Chat
            </a>
            <a
              href={ALLIE_CONFIG.links.allthrive}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary w-full py-3 sm:py-4 text-base font-semibold flex items-center justify-center gap-2 shadow-neon-strong"
            >
              <img src="/all-thrvie-logo.png" alt="" className="w-5 h-5" />
              Join All Thrive
            </a>
          </motion.div>
        </motion.div>
      </div>
    </>
  );
}
