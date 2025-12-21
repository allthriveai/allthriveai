/**
 * Points Notification Context
 *
 * Provides a global notification system for points awards.
 * Any component can trigger a points celebration popup by calling showPointsNotification().
 * Supports queueing multiple notifications to show them sequentially.
 */

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';

export interface PointsNotification {
  points: number;
  title: string;
  message: string;
  activityType: string;
}

interface PointsNotificationContextValue {
  showPointsNotification: (notification: PointsNotification) => void;
  currentNotification: PointsNotification | null;
  isOpen: boolean;
  closeNotification: () => void;
}

const PointsNotificationContext = createContext<PointsNotificationContextValue | null>(null);

export function PointsNotificationProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentNotification, setCurrentNotification] = useState<PointsNotification | null>(null);
  const queueRef = useRef<PointsNotification[]>([]);

  const showPointsNotification = useCallback((notification: PointsNotification) => {
    if (isOpen) {
      // Queue if one is already showing
      queueRef.current = [...queueRef.current, notification];
    } else {
      setCurrentNotification(notification);
      setIsOpen(true);
    }
  }, [isOpen]);

  const closeNotification = useCallback(() => {
    setIsOpen(false);
    // Show next in queue after animation completes
    setTimeout(() => {
      if (queueRef.current.length > 0) {
        const [next, ...rest] = queueRef.current;
        queueRef.current = rest;
        setCurrentNotification(next);
        setIsOpen(true);
      } else {
        setCurrentNotification(null);
      }
    }, 300);
  }, []);

  return (
    <PointsNotificationContext.Provider
      value={{
        showPointsNotification,
        currentNotification,
        isOpen,
        closeNotification,
      }}
    >
      {children}
    </PointsNotificationContext.Provider>
  );
}

export function usePointsNotification() {
  const context = useContext(PointsNotificationContext);
  if (!context) {
    throw new Error('usePointsNotification must be used within PointsNotificationProvider');
  }
  return context;
}

// Safe version that returns null if not in provider
export function usePointsNotificationOptional() {
  return useContext(PointsNotificationContext);
}
