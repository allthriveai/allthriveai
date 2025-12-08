import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface PitchSlideProps {
  children: ReactNode;
  className?: string;
}

export function PitchSlide({ children, className = '' }: PitchSlideProps) {
  return (
    <div className={`relative w-full h-screen overflow-hidden ${className}`}>
      {/* Dark background */}
      <div className="absolute inset-0 bg-[#020617]" />

      {/* Ambient glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-cyan-500/15 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-green-500/15 blur-[120px] pointer-events-none" />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Content */}
      <div className="relative z-10 w-full h-full flex items-center justify-center p-8 sm:p-12 lg:p-16">
        {children}
      </div>
    </div>
  );
}

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function GlassCard({ children, className = '', hover = false }: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      whileHover={hover ? { scale: 1.02, y: -5 } : undefined}
      className={`backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-6 ${
        hover ? 'transition-shadow hover:shadow-neon cursor-pointer' : ''
      } ${className}`}
    >
      {children}
    </motion.div>
  );
}

interface GradientTextProps {
  children: ReactNode;
  className?: string;
}

export function GradientText({ children, className = '' }: GradientTextProps) {
  return (
    <span className={`bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent ${className}`}>
      {children}
    </span>
  );
}

interface AnimatedListProps {
  items: ReactNode[];
  className?: string;
  itemClassName?: string;
}

export function AnimatedList({ items, className = '', itemClassName = '' }: AnimatedListProps) {
  return (
    <div className={className}>
      {items.map((item, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
          className={itemClassName}
        >
          {item}
        </motion.div>
      ))}
    </div>
  );
}
