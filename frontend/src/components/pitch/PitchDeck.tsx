import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { TitleSlide } from './slides/TitleSlide';
import { ProblemSlide } from './slides/ProblemSlide';
import { WhyNowSlide } from './slides/WhyNowSlide';
import { SolutionSlide } from './slides/SolutionSlide';
import { ProductSlide } from './slides/ProductSlide';
import { MarketSlide } from './slides/MarketSlide';
import { BusinessModelSlide } from './slides/BusinessModelSlide';
import { RevenueProjectionsSlide } from './slides/RevenueProjectionsSlide';
import { TractionSlide } from './slides/TractionSlide';
import { TeamSlide } from './slides/TeamSlide';
import { CompetitionSlide } from './slides/CompetitionSlide';
import { AskSlide } from './slides/AskSlide';
import { ThankYouSlide } from './slides/ThankYouSlide';

const slides = [
  TitleSlide,
  WhyNowSlide,
  ProblemSlide,
  SolutionSlide,
  ProductSlide,
  MarketSlide,
  BusinessModelSlide,
  RevenueProjectionsSlide,
  TractionSlide,
  TeamSlide,
  CompetitionSlide,
  AskSlide,
  ThankYouSlide,
];

export function PitchDeck() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0);

  const goToSlide = useCallback((index: number) => {
    if (index >= 0 && index < slides.length) {
      setDirection(index > currentSlide ? 1 : -1);
      setCurrentSlide(index);
    }
  }, [currentSlide]);

  const nextSlide = useCallback(() => {
    if (currentSlide < slides.length - 1) {
      setDirection(1);
      setCurrentSlide(prev => prev + 1);
    }
  }, [currentSlide]);

  const prevSlide = useCallback(() => {
    if (currentSlide > 0) {
      setDirection(-1);
      setCurrentSlide(prev => prev - 1);
    }
  }, [currentSlide]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevSlide();
      } else if (e.key === 'Escape') {
        // Could toggle controls visibility here
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide]);

  const CurrentSlideComponent = slides[currentSlide];

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 1000 : -1000,
      opacity: 0,
    }),
  };

  return (
    <div className="fixed inset-0 bg-[#020617] overflow-hidden">
      {/* Slide content */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentSlide}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: 'spring', stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 },
          }}
          className="absolute inset-0"
        >
          <CurrentSlideComponent />
        </motion.div>
      </AnimatePresence>

      {/* Navigation arrows */}
      <button
        onClick={prevSlide}
        disabled={currentSlide === 0}
        className={`fixed left-4 sm:left-8 top-1/2 -translate-y-1/2 z-50 p-3 rounded-full backdrop-blur-xl bg-white/5 border border-white/10 transition-all duration-300 ${
          currentSlide === 0
            ? 'opacity-30 cursor-not-allowed'
            : 'opacity-60 hover:opacity-100 hover:bg-white/10 hover:scale-110'
        }`}
        aria-label="Previous slide"
      >
        <ChevronLeftIcon className="w-6 h-6 text-white" />
      </button>

      <button
        onClick={nextSlide}
        disabled={currentSlide === slides.length - 1}
        className={`fixed right-4 sm:right-8 top-1/2 -translate-y-1/2 z-50 p-3 rounded-full backdrop-blur-xl bg-white/5 border border-white/10 transition-all duration-300 ${
          currentSlide === slides.length - 1
            ? 'opacity-30 cursor-not-allowed'
            : 'opacity-60 hover:opacity-100 hover:bg-white/10 hover:scale-110'
        }`}
        aria-label="Next slide"
      >
        <ChevronRightIcon className="w-6 h-6 text-white" />
      </button>

      {/* Slide indicators */}
      <div className="fixed bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`h-2 rounded-full transition-all duration-300 ${
              index === currentSlide
                ? 'w-8 bg-gradient-to-r from-cyan-400 to-green-400'
                : 'w-2 bg-white/30 hover:bg-white/50'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      {/* Slide counter */}
      <div className="fixed top-6 right-6 sm:top-8 sm:right-8 z-50 text-white/50 text-sm font-mono">
        {currentSlide + 1} / {slides.length}
      </div>

      {/* Navigation hint (only on first slide) */}
      {currentSlide === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 0.5 }}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 text-white/40 text-sm"
        >
          Press arrow keys or click to navigate
        </motion.div>
      )}
    </div>
  );
}
