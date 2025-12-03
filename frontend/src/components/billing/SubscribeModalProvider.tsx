/**
 * Subscribe Modal Provider
 *
 * Wraps the app and provides the Subscribe Modal globally.
 * Also sets up an Axios interceptor to automatically show the modal
 * when users hit paywalls (403 responses with upgrade_required).
 *
 * Usage:
 * In App.tsx:
 * ```tsx
 * <SubscribeModalProvider>
 *   {yourAppContent}
 * </SubscribeModalProvider>
 * ```
 */

import { useEffect } from 'react';
import { SubscribeModal } from './SubscribeModal';
import { useSubscribeModal } from '@/hooks/useSubscribeModal';
import { api } from '@/services/api';

export function SubscribeModalProvider({ children }: { children: React.ReactNode }) {
  const { isOpen, closeSubscribeModal, blockedFeature, message, selectedTierSlug, openSubscribeModal } =
    useSubscribeModal();

  useEffect(() => {
    // Set up Axios interceptor to catch paywall 403 errors
    const interceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
        // Check if this is a paywall error
        if (
          error.response?.status === 403 &&
          error.response?.data?.upgrade_required === true
        ) {
          const feature = error.response.data.feature;
          const errorMessage = error.response.data.message;

          // Determine which tier is needed based on updated tier structure
          let requiredTier: string | undefined;
          if (feature === 'analytics') {
            // Analytics now available starting at Community Pro
            requiredTier = 'community_pro';
          } else if (feature === 'go1_courses') {
            // Go1 courses ONLY available in Pro Learn
            requiredTier = 'pro_learn';
          } else if (feature === 'creator_tools') {
            // Creator tools only in Creator/Mentor tier
            requiredTier = 'creator_mentor';
          } else if (feature === 'ai_quota_exceeded') {
            // AI quota exceeded - suggest upgrade based on current tier
            // Default to Community Pro (500 requests/mo)
            requiredTier = 'community_pro';
          }

          // Open subscribe modal
          openSubscribeModal({
            blockedFeature: feature,
            message: errorMessage,
            selectedTierSlug: requiredTier,
          });
        }

        // Re-throw error so calling code can handle it if needed
        return Promise.reject(error);
      }
    );

    // Cleanup interceptor on unmount
    return () => {
      api.interceptors.response.eject(interceptor);
    };
  }, [openSubscribeModal]);

  return (
    <>
      {children}
      <SubscribeModal
        isOpen={isOpen}
        onClose={closeSubscribeModal}
        blockedFeature={blockedFeature}
        message={message}
        selectedTierSlug={selectedTierSlug}
      />
    </>
  );
}
