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

const CircularGallery = React.forwardRef<HTMLDivElement, CircularGalleryProps>(
  ({ items, className, radius = 450, autoRotateSpeed = 0.015, ...props }, ref) => {
    const [rotation, setRotation] = useState(0);
    const animationFrameRef = useRef<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Auto-rotation effect
    useEffect(() => {
      const autoRotate = () => {
        setRotation((prev) => prev + autoRotateSpeed);
        animationFrameRef.current = requestAnimationFrame(autoRotate);
      };

      animationFrameRef.current = requestAnimationFrame(autoRotate);
      return () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      };
    }, [autoRotateSpeed]);

    const anglePerItem = 360 / items.length;

    return (
      <div
        ref={ref}
        role="region"
        aria-label="Project Gallery"
        className={cn('relative w-full h-[500px] flex items-center justify-center', className)}
        style={{ perspective: '1500px' }}
        {...props}
      >
        <div
          ref={containerRef}
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
                role="group"
                aria-label={item.title}
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
                <div className="relative w-full h-full rounded-2xl shadow-2xl overflow-hidden group border border-white/10 backdrop-blur-sm hover:shadow-neon transition-all duration-300">
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
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <h3 className="text-lg font-bold text-white mb-1 line-clamp-2 drop-shadow-md">
                      {item.title}
                    </h3>
                    {item.description && (
                      <p className="text-sm text-white/80 line-clamp-2 mb-3 drop-shadow-sm">
                        {item.description}
                      </p>
                    )}

                    {/* Tags */}
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {item.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 text-xs font-medium rounded-full bg-white/10 text-white backdrop-blur-md border border-white/10"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {/* User Avatar */}
                        <div className="w-7 h-7 rounded-full border-2 border-white/80 shadow-lg overflow-hidden bg-gradient-to-br from-cyan-400 to-green-400 flex items-center justify-center flex-shrink-0">
                          <span className="text-[#020617] font-bold text-xs">
                            {item.username?.[0]?.toUpperCase() || 'U'}
                          </span>
                        </div>
                        <span className="text-white/70 text-xs">{item.username}</span>
                      </div>

                      {/* Likes */}
                      {item.heartCount !== undefined && (
                        <div className="flex items-center gap-1 text-white/80">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
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
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);

CircularGallery.displayName = 'CircularGallery';
export { CircularGallery };
