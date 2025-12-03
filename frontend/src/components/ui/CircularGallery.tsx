import React, { useState, useEffect, useRef, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type GalleryItem = {
  id: number | string;
  title: string;
  description?: string;
  imageUrl?: string;
  gradient?: { from: string; to: string };
  username?: string;
  heartCount?: number;
  tags?: string[];
};

interface CircularGalleryProps extends HTMLAttributes<HTMLDivElement> {
  items: GalleryItem[];
  radius?: number;
  autoRotateSpeed?: number;
}

// Shared card component for both views
function ProjectCard({ item, className }: { item: GalleryItem; className?: string }) {
  return (
    <div className={cn('relative rounded-2xl shadow-2xl overflow-hidden group border border-white/10 backdrop-blur-sm hover:shadow-neon transition-all duration-300', className)}>
      {/* Background - Image or Gradient */}
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt={item.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div
          className="absolute inset-0 w-full h-full"
          style={{
            background: `linear-gradient(135deg, ${item.gradient?.from || '#22d3ee'} 0%, ${item.gradient?.to || '#4ade80'} 100%)`,
          }}
        />
      )}

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
        <h3 className="text-base sm:text-lg font-bold text-white mb-1 line-clamp-2 drop-shadow-md">
          {item.title}
        </h3>
        {item.description && (
          <p className="text-xs sm:text-sm text-white/80 line-clamp-2 mb-2 sm:mb-3 drop-shadow-sm">
            {item.description}
          </p>
        )}

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 sm:gap-1.5 mb-2 sm:mb-3">
            {item.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="px-1.5 sm:px-2 py-0.5 text-xs font-medium rounded-full bg-white/10 text-white backdrop-blur-md border border-white/10"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 border-white/80 shadow-lg overflow-hidden bg-gradient-to-br from-cyan-400 to-green-400 flex items-center justify-center flex-shrink-0">
              <span className="text-[#020617] font-bold text-xs">
                {item.username?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            <span className="text-white/70 text-xs">{item.username}</span>
          </div>

          {item.heartCount !== undefined && (
            <div className="flex items-center gap-1 text-white/80">
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-xs font-medium">{item.heartCount}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Mobile horizontal scroll view
function MobileGallery({ items }: { items: GalleryItem[] }) {
  return (
    <div className="w-full overflow-x-auto scrollbar-hide -mx-6 px-6">
      <div className="flex gap-4 pb-4" style={{ width: 'max-content' }}>
        {items.map((item) => (
          <div key={item.id} className="w-[260px] h-[340px] flex-shrink-0">
            <ProjectCard item={item} className="w-full h-full cursor-pointer" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Desktop 3D circular gallery with keyboard navigation
function DesktopGallery({ items, radius, autoRotateSpeed }: { items: GalleryItem[]; radius: number; autoRotateSpeed: number }) {
  const [rotation, setRotation] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const animationFrameRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const anglePerItem = 360 / items.length;

  useEffect(() => {
    if (isPaused) return;

    const autoRotate = () => {
      setRotation((prev) => prev + autoRotateSpeed);
      animationFrameRef.current = requestAnimationFrame(autoRotate);
    };

    animationFrameRef.current = requestAnimationFrame(autoRotate);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [autoRotateSpeed, isPaused]);

  // Calculate current front item based on rotation
  useEffect(() => {
    const normalizedRotation = ((rotation % 360) + 360) % 360;
    const index = Math.round(normalizedRotation / anglePerItem) % items.length;
    const frontIndex = (items.length - index) % items.length;
    setCurrentIndex(frontIndex);
  }, [rotation, anglePerItem, items.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setRotation((prev) => prev - anglePerItem);
      setIsPaused(true);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setRotation((prev) => prev + anglePerItem);
      setIsPaused(true);
    } else if (e.key === ' ') {
      e.preventDefault();
      setIsPaused((prev) => !prev);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[500px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-4 focus:ring-offset-[#020617] rounded-2xl"
      style={{ perspective: '1500px' }}
      tabIndex={0}
      role="listbox"
      aria-label={`Project gallery. Use arrow keys to navigate. Currently showing: ${items[currentIndex]?.title}. ${isPaused ? 'Paused' : 'Auto-rotating'}. Press Space to ${isPaused ? 'resume' : 'pause'}.`}
      aria-activedescendant={`gallery-item-${items[currentIndex]?.id}`}
      onKeyDown={handleKeyDown}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      {/* Screen reader announcement */}
      <div className="sr-only" role="status" aria-live="polite">
        {items[currentIndex]?.title}
      </div>

      <div
        className="relative w-full h-full"
        style={{
          transform: `rotateY(${rotation}deg)`,
          transformStyle: 'preserve-3d',
        }}
      >
        {items.map((item, i) => {
          const itemAngle = i * anglePerItem;
          const totalRotation = rotation % 360;
          const relativeAngle = (itemAngle + totalRotation + 360) % 360;
          const normalizedAngle = Math.abs(relativeAngle > 180 ? 360 - relativeAngle : relativeAngle);
          const opacity = Math.max(0.2, 1 - normalizedAngle / 120);
          const isFront = normalizedAngle < 45;

          return (
            <div
              key={item.id}
              id={`gallery-item-${item.id}`}
              role="option"
              aria-selected={i === currentIndex}
              aria-label={`${item.title}${item.description ? `. ${item.description}` : ''}`}
              className="absolute w-[280px] h-[360px] cursor-pointer"
              style={{
                transform: `rotateY(${itemAngle}deg) translateZ(${radius}px)`,
                left: '50%',
                top: '50%',
                marginLeft: '-140px',
                marginTop: '-180px',
                opacity,
                transition: 'opacity 0.3s linear',
                pointerEvents: isFront ? 'auto' : 'none',
              }}
            >
              <ProjectCard item={item} className="w-full h-full" />
            </div>
          );
        })}
      </div>

      {/* Pause indicator */}
      {isPaused && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-xs font-medium flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          Paused - Use arrow keys to navigate
        </div>
      )}
    </div>
  );
}

const CircularGallery = React.forwardRef<HTMLDivElement, CircularGalleryProps>(
  ({ items, className, radius = 450, autoRotateSpeed = 0.015, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="region"
        aria-label="Project Gallery"
        className={cn('relative w-full', className)}
        {...props}
      >
        {/* Mobile: Horizontal scroll */}
        <div className="lg:hidden">
          <MobileGallery items={items} />
        </div>

        {/* Desktop: 3D circular gallery */}
        <div className="hidden lg:block">
          <DesktopGallery items={items} radius={radius} autoRotateSpeed={autoRotateSpeed} />
        </div>
      </div>
    );
  }
);

CircularGallery.displayName = 'CircularGallery';
export { CircularGallery };
