/**
 * useSubscribeModal Hook
 *
 * A hook to manage the Subscribe Modal state globally.
 * Makes it easy to trigger the modal from anywhere in the app,
 * especially when users hit a paywall.
 *
 * Usage:
 * ```tsx
 * const { openSubscribeModal } = useSubscribeModal();
 *
 * // When user hits a paywall:
 * openSubscribeModal({
 *   blockedFeature: 'Analytics',
 *   message: 'Upgrade to Pro Learn to access advanced analytics',
 *   selectedTierSlug: 'pro_learn',
 * });
 * ```
 */

import { create } from 'zustand';

interface SubscribeModalState {
  isOpen: boolean;
  blockedFeature?: string;
  message?: string;
  selectedTierSlug?: string;
}

interface SubscribeModalStore extends SubscribeModalState {
  openSubscribeModal: (options?: Partial<Omit<SubscribeModalState, 'isOpen'>>) => void;
  closeSubscribeModal: () => void;
}

export const useSubscribeModal = create<SubscribeModalStore>((set) => ({
  isOpen: false,
  blockedFeature: undefined,
  message: undefined,
  selectedTierSlug: undefined,

  openSubscribeModal: (options = {}) => {
    set({
      isOpen: true,
      blockedFeature: options.blockedFeature,
      message: options.message,
      selectedTierSlug: options.selectedTierSlug,
    });
  },

  closeSubscribeModal: () => {
    set({
      isOpen: false,
      blockedFeature: undefined,
      message: undefined,
      selectedTierSlug: undefined,
    });
  },
}));
