'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from '@/lib/auth/use-auth';
import { getUnreadCount } from '@/lib/api/notifications';

const POLL_INTERVAL_MS = 30_000; // 30 seconds

interface NotificationContextType {
  unreadCount: number;
  isLoading: boolean;
  refreshUnreadCount: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const count = await getUnreadCount();
      setUnreadCount(count);
    } catch {
      // Silently fail - unread count is non-critical
    }
  }, []);

  // Fetch immediately when authenticated, and set up polling
  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      setUnreadCount(0);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initial fetch
    setIsLoading(true);
    fetchUnreadCount().finally(() => setIsLoading(false));

    // Start polling
    intervalRef.current = setInterval(fetchUnreadCount, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAuthenticated, authLoading, fetchUnreadCount]);

  const refreshUnreadCount = useCallback(() => {
    if (isAuthenticated) {
      fetchUnreadCount();
    }
  }, [isAuthenticated, fetchUnreadCount]);

  const value: NotificationContextType = useMemo(
    () => ({
      unreadCount,
      isLoading,
      refreshUnreadCount,
    }),
    [unreadCount, isLoading, refreshUnreadCount],
  );

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider.');
  }
  return context;
}
