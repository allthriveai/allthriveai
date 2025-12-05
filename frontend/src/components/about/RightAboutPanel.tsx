/**
 * RightAboutPanel - About Us slide-out tray with Neon Glass aesthetic
 */

import { useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';
import { AboutContent } from './AboutContent';
import { analytics } from '@/utils/analytics';

interface RightAboutPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RightAboutPanel({ isOpen, onClose }: RightAboutPanelProps) {
  useEffect(() => {
    if (isOpen) {
      analytics.aboutPanelOpened();
    }
  }, [isOpen]);

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
          <div className="p-6">
            <AboutContent />
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
