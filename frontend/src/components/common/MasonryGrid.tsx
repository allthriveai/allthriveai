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
  768: 2,   // md
  640: 2,   // sm
  0: 1,     // xs
};

export function MasonryGrid({
  children,
  className = '',
  columnClassName = '',
  gap = 8
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
