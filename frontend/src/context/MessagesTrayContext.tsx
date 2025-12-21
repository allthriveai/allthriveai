/**
 * Messages Tray Context
 *
 * Provides global state for the messages tray, allowing it to be
 * opened from anywhere in the app (profile page, nav, etc.)
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface MessagesTrayContextValue {
  isOpen: boolean;
  selectedThreadId: string | null;
  openMessagesTray: (threadId?: string) => void;
  closeMessagesTray: () => void;
  selectThread: (threadId: string) => void;
}

const MessagesTrayContext = createContext<MessagesTrayContextValue | null>(null);

export function MessagesTrayProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  const openMessagesTray = useCallback((threadId?: string) => {
    if (threadId) {
      setSelectedThreadId(threadId);
    }
    setIsOpen(true);
  }, []);

  const closeMessagesTray = useCallback(() => {
    setIsOpen(false);
  }, []);

  const selectThread = useCallback((threadId: string) => {
    setSelectedThreadId(threadId);
  }, []);

  return (
    <MessagesTrayContext.Provider
      value={{
        isOpen,
        selectedThreadId,
        openMessagesTray,
        closeMessagesTray,
        selectThread,
      }}
    >
      {children}
    </MessagesTrayContext.Provider>
  );
}

export function useMessagesTray() {
  const context = useContext(MessagesTrayContext);
  if (!context) {
    throw new Error('useMessagesTray must be used within MessagesTrayProvider');
  }
  return context;
}

// Safe version that returns null if not in provider (for optional usage)
export function useMessagesTrayOptional() {
  return useContext(MessagesTrayContext);
}
