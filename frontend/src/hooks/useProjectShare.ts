/**
 * useProjectShare - Hook for managing project share modal state
 *
 * Simple hook to manage share modal visibility and provide
 * share-related utilities.
 */

import { useState, useCallback } from 'react';

interface UseProjectShareResult {
  isShareModalOpen: boolean;
  openShareModal: () => void;
  closeShareModal: () => void;
  toggleShareModal: () => void;
}

export function useProjectShare(): UseProjectShareResult {
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const openShareModal = useCallback(() => {
    setIsShareModalOpen(true);
  }, []);

  const closeShareModal = useCallback(() => {
    setIsShareModalOpen(false);
  }, []);

  const toggleShareModal = useCallback(() => {
    setIsShareModalOpen(prev => !prev);
  }, []);

  return {
    isShareModalOpen,
    openShareModal,
    closeShareModal,
    toggleShareModal,
  };
}
