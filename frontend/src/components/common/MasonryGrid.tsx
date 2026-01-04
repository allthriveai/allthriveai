import { useEffect, useState, useRef, Children, isValidElement, type ReactNode, type ReactElement } from 'react';

interface MasonryGridProps {
  children: ReactNode;
  className?: string;
  columnClassName?: string;
  gap?: number;
}

/**
 * Get number of columns based on viewport width
 */
function getColumnCount(width: number): number {
  if (width < 768) return 1;      // mobile
  if (width < 1024) return 2;     // tablet
  if (width < 1280) return 3;     // laptop
  return 4;                        // desktop
}

/**
 * MasonryGrid - A balanced masonry layout that distributes items to the shortest column
 *
 * Unlike react-masonry-css which uses round-robin distribution, this component
 * measures actual item heights and places each new item in the shortest column,
 * resulting in more balanced columns even with varying item heights.
 */
export function MasonryGrid({
  children,
  className = '',
  columnClassName = '',
  gap = 8,
}: MasonryGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(4);
  const [columns, setColumns] = useState<ReactNode[][]>([[], [], [], []]);
  const itemHeightsRef = useRef<Map<string, number>>(new Map());
  const columnHeightsRef = useRef<number[]>([0, 0, 0, 0]);

  // Update column count on resize
  useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      const newCount = getColumnCount(width);
      if (newCount !== columnCount) {
        setColumnCount(newCount);
        // Reset heights when column count changes
        columnHeightsRef.current = Array(newCount).fill(0);
      }
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, [columnCount]);

  // Distribute children into columns using shortest-column-first algorithm
  useEffect(() => {
    const childArray = Children.toArray(children).filter(isValidElement) as ReactElement[];
    const newColumns: ReactNode[][] = Array.from({ length: columnCount }, () => []);
    const heights: number[] = Array(columnCount).fill(0);

    childArray.forEach((child, index) => {
      // Find the shortest column
      let shortestColumnIndex = 0;
      let shortestHeight = heights[0];

      for (let i = 1; i < columnCount; i++) {
        if (heights[i] < shortestHeight) {
          shortestHeight = heights[i];
          shortestColumnIndex = i;
        }
      }

      // Get estimated height for this item (use cached or estimate)
      const key = child.key?.toString() || `item-${index}`;
      const estimatedHeight = itemHeightsRef.current.get(key) || 350; // Default estimate

      // Add item to shortest column
      newColumns[shortestColumnIndex].push(
        <div
          key={key}
          className="mb-2"
          ref={(el) => {
            if (el) {
              // Measure actual height after render and cache it
              const actualHeight = el.getBoundingClientRect().height;
              if (actualHeight > 0) {
                itemHeightsRef.current.set(key, actualHeight);
              }
            }
          }}
        >
          {child}
        </div>
      );

      // Update column height
      heights[shortestColumnIndex] += estimatedHeight + gap;
    });

    columnHeightsRef.current = heights;
    setColumns(newColumns);
  }, [children, columnCount, gap]);

  return (
    <div
      ref={containerRef}
      className={`flex w-full -ml-1 ${className}`}
    >
      {columns.slice(0, columnCount).map((column, colIndex) => (
        <div
          key={colIndex}
          className={`flex-1 pl-1 ${columnClassName}`}
          style={{ minWidth: 0 }} // Prevent flex items from overflowing
        >
          {column}
        </div>
      ))}
    </div>
  );
}

export default MasonryGrid;
