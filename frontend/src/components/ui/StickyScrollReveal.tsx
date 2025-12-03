import React, { useEffect, useRef, useState } from 'react';
import { useMotionValueEvent, useScroll, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StickyScrollContent {
  title: string;
  description: string;
  content?: React.ReactNode;
}

interface StickyScrollProps {
  content: StickyScrollContent[];
  contentClassName?: string;
}

export function StickyScroll({ content, contentClassName }: StickyScrollProps) {
  const [activeCard, setActiveCard] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    container: ref,
    offset: ['start start', 'end start'],
  });
  const cardLength = content.length;

  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    const cardsBreakpoints = content.map((_, index) => index / cardLength);
    const closestBreakpointIndex = cardsBreakpoints.reduce((acc, breakpoint, index) => {
      const distance = Math.abs(latest - breakpoint);
      if (distance < Math.abs(latest - cardsBreakpoints[acc])) {
        return index;
      }
      return acc;
    }, 0);
    setActiveCard(closestBreakpointIndex);
  });

  const linearGradients = [
    'linear-gradient(to bottom right, rgb(34 211 238), rgb(74 222 128))',
    'linear-gradient(to bottom right, rgb(168 85 247), rgb(236 72 153))',
    'linear-gradient(to bottom right, rgb(249 115 22), rgb(234 179 8))',
  ];

  const [backgroundGradient, setBackgroundGradient] = useState(linearGradients[0]);

  useEffect(() => {
    setBackgroundGradient(linearGradients[activeCard % linearGradients.length]);
  }, [activeCard]);

  return (
    <motion.div
      className="h-[30rem] overflow-y-auto flex justify-center relative space-x-10 rounded-2xl p-10 scrollbar-hide"
      style={{ backgroundColor: 'rgba(2, 6, 23, 0.8)' }}
      ref={ref}
    >
      <div className="relative flex items-start px-4">
        <div className="max-w-2xl">
          {content.map((item, index) => (
            <div key={item.title + index} className="my-20">
              <motion.h2
                initial={{ opacity: 0 }}
                animate={{ opacity: activeCard === index ? 1 : 0.3 }}
                className="text-2xl font-bold text-white"
              >
                {item.title}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: activeCard === index ? 1 : 0.3 }}
                className="text-lg text-gray-400 max-w-sm mt-4"
              >
                {item.description}
              </motion.p>
            </div>
          ))}
          <div className="h-40" />
        </div>
      </div>
      <div
        style={{ background: backgroundGradient }}
        className={cn(
          'hidden lg:block h-60 w-80 rounded-2xl sticky top-10 overflow-hidden',
          contentClassName
        )}
      >
        {content[activeCard].content ?? null}
      </div>
    </motion.div>
  );
}
