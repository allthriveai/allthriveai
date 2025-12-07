import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PitchDeck } from '@/components/pitch/PitchDeck';
import { SEO } from '@/components/common/SEO';

const CORRECT_PASSWORD = 'Dontpanic';
const SESSION_KEY = 'pitch_authenticated';

export default function PitchDeckPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check sessionStorage for existing auth
    const authenticated = sessionStorage.getItem(SESSION_KEY);
    if (authenticated === 'true') {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === CORRECT_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, 'true');
      setIsAuthenticated(true);
      setError(false);
    } else {
      setError(true);
      setPassword('');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <>
        <SEO
          title="Investor Deck"
          description="All Thrive investor pitch deck"
          noindex={true}
        />
        <PitchDeck />
      </>
    );
  }

  return (
    <>
      <SEO
        title="Investor Access"
        description="All Thrive investor pitch deck"
        noindex={true}
      />
      <div className="min-h-screen bg-[#020617] flex items-center justify-center relative overflow-hidden">
        {/* Ambient glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-cyan-500/20 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-green-500/20 blur-[100px] pointer-events-none" />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 w-full max-w-md px-6"
        >
          {/* Glass card */}
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 shadow-2xl">
            {/* Logo */}
            <div className="flex flex-col items-center mb-8">
              <img
                src="/all-thrvie-logo.png"
                alt="All Thrive"
                className="h-16 w-auto mb-4"
              />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent">
                All Thrive
              </h1>
              <p className="text-gray-400 mt-2">Investor Access</p>
            </div>

            {/* Password form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                  Enter Password
                </label>
                <motion.div
                  animate={error ? { x: [-10, 10, -10, 10, 0] } : {}}
                  transition={{ duration: 0.4 }}
                >
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(false);
                    }}
                    className={`w-full px-4 py-3 bg-white/5 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all ${
                      error
                        ? 'border-red-500 focus:ring-red-500/50'
                        : 'border-white/10 focus:ring-cyan-500/50 focus:border-cyan-500/50'
                    }`}
                    placeholder="Enter access code"
                    autoFocus
                  />
                </motion.div>
                <AnimatePresence>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="text-red-400 text-sm mt-2"
                    >
                      Incorrect password. Please try again.
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 bg-gradient-to-r from-cyan-400 to-green-400 text-[#020617] font-semibold rounded-lg hover:shadow-neon transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              >
                Access Deck
              </button>
            </form>

            <p className="text-center text-gray-500 text-sm mt-6">
              Contact us for access credentials
            </p>
          </div>
        </motion.div>
      </div>
    </>
  );
}
