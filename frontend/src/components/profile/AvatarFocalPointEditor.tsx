/**
 * AvatarFocalPointEditor - Modal for setting avatar focal point
 *
 * Allows users to drag/pan their uploaded image to position
 * the focal point (typically their face) within the circular crop.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';

interface AvatarFocalPointEditorProps {
  imageUrl: string;
  initialFocalX?: number;  // 0-1, default 0.5
  initialFocalY?: number;  // 0-1, default 0.5
  onSave: (focalX: number, focalY: number) => void;
  onCancel: () => void;
}

export function AvatarFocalPointEditor({
  imageUrl,
  initialFocalX = 0.5,
  initialFocalY = 0.5,
  onSave,
  onCancel,
}: AvatarFocalPointEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Track image natural dimensions
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

  // Position state (in pixels, relative to container center)
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });

  // Container size (the visible circular crop area)
  const CROP_SIZE = 256;

  // Calculate image display size to cover the crop area
  const getImageDisplaySize = useCallback(() => {
    if (imageDimensions.width === 0 || imageDimensions.height === 0) {
      return { width: CROP_SIZE, height: CROP_SIZE };
    }

    const imageAspect = imageDimensions.width / imageDimensions.height;

    // Image needs to cover the crop area - scale to fit the smaller dimension
    let width, height;
    if (imageAspect > 1) {
      // Landscape: height matches crop, width extends beyond
      height = CROP_SIZE;
      width = CROP_SIZE * imageAspect;
    } else {
      // Portrait or square: width matches crop, height extends beyond
      width = CROP_SIZE;
      height = CROP_SIZE / imageAspect;
    }

    return { width, height };
  }, [imageDimensions]);

  // Initialize offset from focal point when image loads
  useEffect(() => {
    if (imageDimensions.width === 0 || imageDimensions.height === 0) return;

    const { width, height } = getImageDisplaySize();

    // Convert focal point (0-1) to pixel offset
    // Focal point 0.5 = center = offset 0
    // Focal point 0 = left/top edge at center = positive offset (image moved right/down)
    // Focal point 1 = right/bottom edge at center = negative offset (image moved left/up)
    const maxOffsetX = (width - CROP_SIZE) / 2;
    const maxOffsetY = (height - CROP_SIZE) / 2;

    const x = (0.5 - initialFocalX) * 2 * maxOffsetX;
    const y = (0.5 - initialFocalY) * 2 * maxOffsetY;

    setOffset({ x, y });
  }, [imageDimensions, initialFocalX, initialFocalY, getImageDisplaySize]);

  // Handle image load to get dimensions
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
  };

  // Constrain offset to valid range
  const constrainOffset = useCallback((x: number, y: number) => {
    const { width, height } = getImageDisplaySize();
    const maxOffsetX = Math.max(0, (width - CROP_SIZE) / 2);
    const maxOffsetY = Math.max(0, (height - CROP_SIZE) / 2);

    return {
      x: Math.max(-maxOffsetX, Math.min(maxOffsetX, x)),
      y: Math.max(-maxOffsetY, Math.min(maxOffsetY, y)),
    };
  }, [getImageDisplaySize]);

  // Mouse/touch event handlers
  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    setIsDragging(true);
    dragStart.current = {
      x: clientX,
      y: clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
  }, [offset]);

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging) return;

    const deltaX = clientX - dragStart.current.x;
    const deltaY = clientY - dragStart.current.y;

    const newOffset = constrainOffset(
      dragStart.current.offsetX + deltaX,
      dragStart.current.offsetY + deltaY
    );

    setOffset(newOffset);
  }, [isDragging, constrainOffset]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      handleDragMove(e.clientX, e.clientY);
    };

    const handleMouseUp = () => {
      handleDragEnd();
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleDragStart(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleDragMove(touch.clientX, touch.clientY);
  };

  // Convert offset back to focal point and save
  const handleSave = () => {
    const { width, height } = getImageDisplaySize();
    const maxOffsetX = Math.max(1, (width - CROP_SIZE) / 2);
    const maxOffsetY = Math.max(1, (height - CROP_SIZE) / 2);

    // Convert pixel offset to focal point (0-1)
    const focalX = 0.5 - (offset.x / (2 * maxOffsetX));
    const focalY = 0.5 - (offset.y / (2 * maxOffsetY));

    // Clamp to 0-1 range
    onSave(
      Math.max(0, Math.min(1, focalX)),
      Math.max(0, Math.min(1, focalY))
    );
  };

  const { width: imgWidth, height: imgHeight } = getImageDisplaySize();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Position Your Photo
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Drag to position your face in the circle
          </p>
        </div>

        {/* Editor Area */}
        <div className="p-6 flex flex-col items-center">
          {/* Crop preview container */}
          <div
            ref={containerRef}
            className="relative overflow-hidden rounded-full cursor-grab active:cursor-grabbing select-none"
            style={{ width: CROP_SIZE, height: CROP_SIZE }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleDragEnd}
          >
            {/* The draggable image */}
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Avatar preview"
              draggable={false}
              onLoad={handleImageLoad}
              className="absolute pointer-events-none"
              style={{
                width: imgWidth,
                height: imgHeight,
                left: `calc(50% - ${imgWidth / 2}px + ${offset.x}px)`,
                top: `calc(50% - ${imgHeight / 2}px + ${offset.y}px)`,
              }}
            />

            {/* Circular overlay border */}
            <div
              className="absolute inset-0 rounded-full border-4 border-white/50 dark:border-black/50 pointer-events-none"
              style={{ boxShadow: 'inset 0 0 20px rgba(0,0,0,0.2)' }}
            />
          </div>

          {/* Instructions */}
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center">
            This is how your avatar will appear across the site
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2"
          >
            <XMarkIcon className="w-4 h-4" />
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors flex items-center gap-2"
          >
            <CheckIcon className="w-4 h-4" />
            Save Position
          </button>
        </div>
      </div>
    </div>
  );
}
