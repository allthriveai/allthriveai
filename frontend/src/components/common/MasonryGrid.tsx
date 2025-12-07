import Masonry from 'react-masonry-css';
import type { ReactNode } from 'react';

interface MasonryGridProps {
  children: ReactNode;
  className?: string;
  columnClassName?: string;
  gap?: number;
}

const defaultBreakpoints = {
  default: 4,
  1536: 4,  // 2xl
  1280: 3,  // xl
  1024: 3,  // lg
  768: 2,   // md - 2 columns starts at tablet
  767: 1,   // mobile - always 1 column below tablet
};

export function MasonryGrid({
  children,
  className = '',
  columnClassName = '',
}: MasonryGridProps) {
  return (
    <Masonry
      breakpointCols={defaultBreakpoints}
      className={`flex w-auto -ml-2 ${className}`}
      columnClassName={`pl-2 bg-clip-padding ${columnClassName}`}
    >
      {children}
    </Masonry>
  );
}

export default MasonryGrid;
