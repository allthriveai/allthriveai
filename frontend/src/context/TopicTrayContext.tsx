import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { TopicTray } from '@/components/topics/TopicTray';
import { normalizeTopicSlug } from '@/services/topics';

interface TopicTrayContextValue {
  /** Open the topic tray for a specific topic */
  openTopicTray: (topic: string) => void;
  /** Close the topic tray */
  closeTopicTray: () => void;
  /** Whether the topic tray is currently open */
  isTopicTrayOpen: boolean;
  /** The current topic slug being displayed (null if closed) */
  currentTopicSlug: string | null;
}

const TopicTrayContext = createContext<TopicTrayContextValue | undefined>(undefined);

interface TopicTrayProviderProps {
  children: ReactNode;
}

/**
 * Provider component that manages the global topic tray state.
 *
 * Add this provider to your app layout (e.g., DashboardLayout) to enable
 * topic trays throughout the application.
 *
 * @example
 * ```tsx
 * // In DashboardLayout.tsx
 * import { TopicTrayProvider } from '@/context/TopicTrayContext';
 *
 * export function DashboardLayout({ children }) {
 *   return (
 *     <TopicTrayProvider>
 *       {children}
 *     </TopicTrayProvider>
 *   );
 * }
 *
 * // In any component
 * import { useTopicTray } from '@/context/TopicTrayContext';
 *
 * function TopicTag({ topic }) {
 *   const { openTopicTray } = useTopicTray();
 *   return (
 *     <button onClick={() => openTopicTray(topic)}>
 *       #{topic}
 *     </button>
 *   );
 * }
 * ```
 */
export function TopicTrayProvider({ children }: TopicTrayProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTopicSlug, setCurrentTopicSlug] = useState<string | null>(null);

  const openTopicTray = useCallback((topic: string) => {
    const slug = normalizeTopicSlug(topic);
    setCurrentTopicSlug(slug);
    setIsOpen(true);
  }, []);

  const closeTopicTray = useCallback(() => {
    setIsOpen(false);
    // Note: We don't clear currentTopicSlug immediately to allow
    // the close animation to complete with the content still visible
  }, []);

  const handleTopicChange = useCallback((newTopic: string) => {
    const slug = normalizeTopicSlug(newTopic);
    setCurrentTopicSlug(slug);
    // Keep the tray open, just change the content
  }, []);

  return (
    <TopicTrayContext.Provider
      value={{
        openTopicTray,
        closeTopicTray,
        isTopicTrayOpen: isOpen,
        currentTopicSlug,
      }}
    >
      {children}
      <TopicTray
        isOpen={isOpen}
        onClose={closeTopicTray}
        topicSlug={currentTopicSlug || ''}
        onTopicChange={handleTopicChange}
      />
    </TopicTrayContext.Provider>
  );
}

/**
 * Hook to access the topic tray context.
 *
 * Must be used within a TopicTrayProvider.
 *
 * @throws Error if used outside of TopicTrayProvider
 *
 * @example
 * ```tsx
 * const { openTopicTray } = useTopicTray();
 *
 * <button onClick={() => openTopicTray('ai-agents')}>
 *   View AI Agents
 * </button>
 * ```
 */
export function useTopicTray(): TopicTrayContextValue {
  const context = useContext(TopicTrayContext);
  if (context === undefined) {
    throw new Error('useTopicTray must be used within a TopicTrayProvider');
  }
  return context;
}
