/**
 * AnimatedContainer - Glass container with neon glow states
 * Used as a wrapper for exercise components with animated states
 */

import { motion, type MotionProps, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

export type ContainerVariant = 'default' | 'interactive' | 'success' | 'error' | 'warning' | 'dropzone' | 'dropzoneActive';
export type GlowColor = 'cyan' | 'green' | 'pink' | 'amber' | 'purple' | 'none';

interface AnimatedContainerProps extends Omit<MotionProps, 'variants'> {
  children: React.ReactNode;
  /** Visual variant of the container */
  variant?: ContainerVariant;
  /** Glow color to apply */
  glowColor?: GlowColor;
  /** Additional CSS classes */
  className?: string;
  /** Whether to animate on mount */
  animateOnMount?: boolean;
  /** Whether the container is in a dragging state */
  isDragging?: boolean;
  /** Whether the container is a valid drop target */
  isDropTarget?: boolean;
}

const glowColors: Record<GlowColor, string> = {
  cyan: 'shadow-[0_0_20px_rgba(34,211,238,0.3)]',
  green: 'shadow-[0_0_20px_rgba(74,222,128,0.3)]',
  pink: 'shadow-[0_0_20px_rgba(251,55,255,0.3)]',
  amber: 'shadow-[0_0_20px_rgba(251,191,36,0.3)]',
  purple: 'shadow-[0_0_20px_rgba(168,85,247,0.3)]',
  none: '',
};

const variantStyles: Record<ContainerVariant, string> = {
  default: 'bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg',
  interactive: 'bg-white/8 backdrop-blur-md border border-cyan-500/20 rounded-lg hover:border-cyan-400/40 transition-colors',
  success: 'bg-emerald-500/10 backdrop-blur-sm border border-emerald-500/30 rounded-lg',
  error: 'bg-red-500/10 backdrop-blur-sm border border-red-500/30 rounded-lg',
  warning: 'bg-amber-500/10 backdrop-blur-sm border border-amber-500/30 rounded-lg',
  dropzone: 'bg-white/3 border-2 border-dashed border-white/20 rounded-lg',
  dropzoneActive: 'bg-cyan-500/10 border-2 border-dashed border-cyan-400/50 rounded-lg',
};

const containerVariants: Variants = {
  initial: {
    opacity: 0,
    y: 10,
    scale: 0.98,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: 'easeOut',
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.98,
    transition: {
      duration: 0.2,
      ease: 'easeIn',
    },
  },
  dragging: {
    scale: 1.02,
    boxShadow: '0 0 30px rgba(34, 211, 238, 0.4)',
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 25,
    },
  },
  dropTarget: {
    scale: 1.01,
    borderColor: 'rgba(34, 211, 238, 0.6)',
    transition: {
      duration: 0.2,
    },
  },
};

export function AnimatedContainer({
  children,
  variant = 'default',
  glowColor = 'none',
  className,
  animateOnMount = true,
  isDragging = false,
  isDropTarget = false,
  ...motionProps
}: AnimatedContainerProps) {
  // Determine the animation state
  const animationState = isDragging ? 'dragging' : isDropTarget ? 'dropTarget' : 'animate';

  return (
    <motion.div
      className={cn(
        'p-4 transition-all duration-300',
        variantStyles[variant],
        glowColor !== 'none' && glowColors[glowColor],
        className
      )}
      variants={containerVariants}
      initial={animateOnMount ? 'initial' : false}
      animate={animationState}
      exit="exit"
      {...motionProps}
    >
      {children}
    </motion.div>
  );
}

/**
 * AnimatedCard - A smaller version of AnimatedContainer for individual items
 */
interface AnimatedCardProps extends Omit<AnimatedContainerProps, 'variant'> {
  /** Whether the card is selected */
  isSelected?: boolean;
  /** Whether the card is disabled */
  isDisabled?: boolean;
}

export function AnimatedCard({
  children,
  isSelected = false,
  isDisabled = false,
  glowColor = 'none',
  className,
  ...props
}: AnimatedCardProps) {
  return (
    <AnimatedContainer
      variant={isSelected ? 'interactive' : 'default'}
      glowColor={isSelected ? 'cyan' : glowColor}
      className={cn(
        'cursor-pointer',
        isDisabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        className
      )}
      {...props}
    >
      {children}
    </AnimatedContainer>
  );
}

export default AnimatedContainer;
