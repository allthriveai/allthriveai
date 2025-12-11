import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion, useMotionValue, useTransform, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCompass,
  faGamepad,
  faTrophy,
  faBrain,
  faGraduationCap,
  faUsers,
  faComments,
  faCalendar,
  faLightbulb,
  faRocket,
  faGift,
} from '@fortawesome/free-solid-svg-icons';
import {
  validateReferralCode,
  storeReferralCode,
  getStoredReferralCode,
  getStoredReferrerUsername,
} from '@/services/referral';
import { analytics } from '@/utils/analytics';

// App-themed icons that represent AllThrive features
const floatingIcons = [
  { icon: faCompass, color: '#22d3ee' },      // Explore
  { icon: faGamepad, color: '#4ade80' },      // Play
  { icon: faTrophy, color: '#fbbf24' },       // Achievements
  { icon: faBrain, color: '#a78bfa' },        // Quizzes/Learning
  { icon: faGraduationCap, color: '#22d3ee' }, // Learn
  { icon: faUsers, color: '#4ade80' },        // Community
  { icon: faComments, color: '#22d3ee' },     // Chat
  { icon: faCalendar, color: '#fb7185' },     // Events
  { icon: faLightbulb, color: '#fbbf24' },    // Ideas
  { icon: faRocket, color: '#a78bfa' },       // Launch
];

// Floating icon component
function FloatingIcon({ icon, color, delay, x, y, prefersReducedMotion }: {
  icon: typeof faCompass;
  color: string;
  delay: number;
  x: number;
  y: number;
  prefersReducedMotion: boolean;
}) {
  return (
    <motion.div
      className="absolute select-none pointer-events-none"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        color: color,
        opacity: 0.15,
      }}
      aria-hidden="true"
      animate={prefersReducedMotion ? {} : {
        y: [0, -20, 0],
        opacity: [0.1, 0.2, 0.1],
        scale: [0.9, 1, 0.9],
      }}
      transition={{
        duration: 6 + Math.random() * 2,
        delay: delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      <FontAwesomeIcon icon={icon} className="w-5 h-5" aria-hidden="true" />
    </motion.div>
  );
}

// Generate floating elements distributed across the page
function FloatingElements({ prefersReducedMotion }: { prefersReducedMotion: boolean }) {
  const icons = useMemo(() =>
    floatingIcons.map((item, i) => ({
      id: `icon-${i}`,
      ...item,
      delay: i * 0.4,
      x: 5 + (i % 5) * 20 + Math.random() * 8,
      y: 15 + Math.floor(i / 5) * 35 + Math.random() * 15,
    })), []
  );

  // Add extra icons for bottom area
  const bottomIcons = useMemo(() =>
    floatingIcons.slice(0, 5).map((item, i) => ({
      id: `bottom-icon-${i}`,
      ...item,
      delay: i * 0.6 + 2,
      x: 10 + i * 20 + Math.random() * 8,
      y: 70 + Math.random() * 20,
    })), []
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {icons.map((item) => (
        <FloatingIcon key={item.id} {...item} prefersReducedMotion={prefersReducedMotion} />
      ))}
      {bottomIcons.map((item) => (
        <FloatingIcon key={item.id} {...item} prefersReducedMotion={prefersReducedMotion} />
      ))}
    </div>
  );
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
    },
  },
};

const buttonVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 120,
      damping: 14,
    },
  },
  hover: {
    scale: 1.02,
    y: -2,
  },
  tap: {
    scale: 0.98,
  },
};

// Reduced motion variants (no movement)
const reducedMotionVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, user } = useAuth();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Referral code state
  const [referralInfo, setReferralInfo] = useState<{
    code: string;
    referrerUsername: string;
    isValid: boolean;
  } | null>(null);
  const [isValidatingReferral, setIsValidatingReferral] = useState(false);

  // Subtle parallax effect for background (disabled if reduced motion)
  const bgX = useTransform(mouseX, [0, window.innerWidth], [5, -5]);
  const bgY = useTransform(mouseY, [0, window.innerHeight], [5, -5]);

  // Capture and validate referral code from URL or localStorage
  useEffect(() => {
    const captureReferralCode = async () => {
      // Check URL params first
      const refCode = searchParams.get('ref');

      // If we have a code in URL, validate and store it
      if (refCode) {
        setIsValidatingReferral(true);
        const result = await validateReferralCode(refCode);

        if (result.valid && result.referrerUsername) {
          storeReferralCode(refCode, result.referrerUsername);
          setReferralInfo({
            code: refCode,
            referrerUsername: result.referrerUsername,
            isValid: true,
          });
          // Track referral code captured from URL
          analytics.referralCodeCaptured(refCode, result.referrerUsername, 'url');
        }
        setIsValidatingReferral(false);
        return;
      }

      // Check localStorage for previously stored code
      const storedCode = getStoredReferralCode();
      const storedReferrer = getStoredReferrerUsername();
      if (storedCode && storedReferrer) {
        setReferralInfo({
          code: storedCode,
          referrerUsername: storedReferrer,
          isValid: true,
        });
        // Track referral code loaded from localStorage
        analytics.referralCodeCaptured(storedCode, storedReferrer, 'localStorage');
      }
    };

    captureReferralCode();
  }, [searchParams]);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY, prefersReducedMotion]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user?.username) {
      navigate('/explore');
    }
  }, [isAuthenticated, user?.username, navigate]);

  const handleOAuthLogin = (provider: 'google' | 'github' | 'linkedin_oauth2') => {
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const loginUrl = `${backendUrl}/accounts/${provider}/login/?process=login`;
    window.location.href = loginUrl;
  };

  const motionVariants = prefersReducedMotion ? reducedMotionVariants : itemVariants;
  const motionButtonVariants = prefersReducedMotion ? reducedMotionVariants : buttonVariants;

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans relative overflow-hidden">
      {/* Skip to main content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-cyan-500 focus:text-white focus:rounded-lg focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Animated gradient background */}
      <motion.div
        className="absolute inset-0"
        style={prefersReducedMotion ? {} : { x: bgX, y: bgY }}
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-background to-slate-900" />
        <motion.div
          className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-3xl"
          animate={prefersReducedMotion ? {} : {
            scale: [1, 1.1, 1],
            opacity: [0.1, 0.15, 0.1],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-green-500/10 rounded-full blur-3xl"
          animate={prefersReducedMotion ? {} : {
            scale: [1.1, 1, 1.1],
            opacity: [0.1, 0.15, 0.1],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
      </motion.div>

      {/* Subtle floating icons (decorative) */}
      <FloatingElements prefersReducedMotion={prefersReducedMotion} />

      {/* Header */}
      <motion.header
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex-shrink-0 border-b border-white/10 bg-background/60 backdrop-blur-md relative z-10"
      >
        <nav className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between" aria-label="Main navigation">
          <Link
            to="/"
            className="flex items-center gap-2 group rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-background"
            aria-label="All Thrive - Go to homepage"
          >
            <motion.img
              src="/all-thrvie-logo.png"
              alt=""
              className="h-8 w-auto"
              whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
              transition={{ duration: 0.2 }}
            />
            <span className="text-xl font-bold text-white group-hover:text-cyan-bright transition-colors">
              All Thrive
            </span>
          </Link>
          <Link
            to="/explore"
            className="text-sm text-slate-300 hover:text-white transition-colors rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-background"
          >
            Just browsing? Explore
          </Link>
        </nav>
      </motion.header>

      {/* Main Content */}
      <main id="main-content" className="flex-1 flex items-center justify-center relative z-10">
        <motion.div
          className="max-w-md mx-auto px-4 py-12 text-center"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Logo */}
          <motion.div variants={motionVariants} className="mb-8">
            <motion.img
              src="/all-thrvie-logo.png"
              alt="All Thrive logo"
              className="w-20 h-20 mx-auto mb-6"
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 15,
                delay: 0.2,
              }}
            />

            {/* Welcome text */}
            <motion.h1
              className="text-3xl font-bold text-white mb-3"
              variants={motionVariants}
            >
              Welcome to{' '}
              <span className="bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent">
                All Thrive
              </span>
            </motion.h1>
            <motion.p
              className="text-lg text-slate-200 mb-3"
              variants={motionVariants}
            >
              The gamified AI portfolio platform for creators. Automate your AI portfolio, compete in Prompt Battles, earn achievements, and level up your skills.
            </motion.p>
            <motion.p
              className="text-slate-400 text-sm"
              variants={motionVariants}
            >
              Join thousands of creators exploring AI.
            </motion.p>
          </motion.div>

          {/* Referral Banner */}
          {isValidatingReferral && (
            <motion.div
              className="mb-6 p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center justify-center gap-2 text-cyan-400">
                <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Validating referral code...</span>
              </div>
            </motion.div>
          )}

          {referralInfo?.isValid && !isValidatingReferral && (
            <motion.div
              className="mb-6 p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-green-500/10 border border-cyan-500/30"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center justify-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-400 to-green-400 flex items-center justify-center">
                  <FontAwesomeIcon icon={faGift} className="w-5 h-5 text-slate-900" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-white">
                    Referred by <span className="text-cyan-400">@{referralInfo.referrerUsername}</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    Sign up to connect with your referrer!
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* OAuth Buttons */}
          <motion.div
            className="flex flex-col sm:flex-row gap-3 mb-6"
            variants={motionVariants}
            role="group"
            aria-label="Sign in options"
          >
            <motion.button
              onClick={() => handleOAuthLogin('google')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-cyan-400/30 transition-all text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-background"
              variants={motionButtonVariants}
              whileHover={prefersReducedMotion ? {} : "hover"}
              whileTap={prefersReducedMotion ? {} : "tap"}
              aria-label="Sign in with Google"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </motion.button>
            <motion.button
              onClick={() => handleOAuthLogin('github')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-cyan-400/30 transition-all text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-background"
              variants={motionButtonVariants}
              whileHover={prefersReducedMotion ? {} : "hover"}
              whileTap={prefersReducedMotion ? {} : "tap"}
              aria-label="Sign in with GitHub"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/>
              </svg>
              GitHub
            </motion.button>
            <motion.button
              onClick={() => handleOAuthLogin('linkedin_oauth2')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-cyan-400/30 transition-all text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-background"
              variants={motionButtonVariants}
              whileHover={prefersReducedMotion ? {} : "hover"}
              whileTap={prefersReducedMotion ? {} : "tap"}
              aria-label="Sign in with LinkedIn"
            >
              <svg className="w-5 h-5" fill="#0A66C2" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              LinkedIn
            </motion.button>
          </motion.div>

          {/* Footer */}
          <motion.p
            className="text-xs text-slate-400"
            variants={motionVariants}
          >
            By continuing, you agree to our{' '}
            <Link
              to="/terms"
              className="text-cyan-bright hover:underline focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-1 focus:ring-offset-background rounded"
            >
              Terms
            </Link>
            {' '}and{' '}
            <Link
              to="/privacy"
              className="text-cyan-bright hover:underline focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-1 focus:ring-offset-background rounded"
            >
              Privacy Policy
            </Link>
          </motion.p>
        </motion.div>
      </main>
    </div>
  );
}
