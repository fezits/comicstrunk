'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NotificationItem } from './notification-item';
import { useNotifications } from '@/contexts/notification-context';
import {
  getRecentNotifications,
  markAllAsRead,
  type Notification,
} from '@/lib/api/notifications';

interface NotificationDropdownProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationDropdown({ open, onClose }: NotificationDropdownProps) {
  const t = useTranslations();
  const locale = useLocale();
  const { unreadCount, refreshUnreadCount } = useNotifications();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchRecent = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getRecentNotifications();
      setNotifications(data);
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch recent notifications when dropdown opens
  useEffect(() => {
    if (open) {
      fetchRecent();
    }
  }, [open, fetchRecent]);

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
      refreshUnreadCount();
    } catch {
      // Silently fail
    }
  };

  const handleItemRead = () => {
    refreshUnreadCount();
    fetchRecent();
  };

  return (
    <div className="w-80">
      {/* Header */}
      <div className="flex items-center justify-between px-1 pb-2">
        <h3 className="font-semibold text-sm">
          {t('notifications.title')}
          {unreadCount > 0 && (
            <span className="ml-2 text-xs text-muted-foreground">
              ({unreadCount})
            </span>
          )}
        </h3>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-primary hover:text-primary"
            onClick={handleMarkAllRead}
          >
            <CheckCheck className="h-3.5 w-3.5 mr-1" />
            {t('notifications.markAllRead')}
          </Button>
        )}
      </div>

      <Separator className="mb-2" />

      {/* Notifications list */}
      {isLoading ? (
        <div className="space-y-2 px-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 p-2">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-2.5 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Bell className="h-8 w-8 mb-2 opacity-50" />
          <p className="text-sm">{t('notifications.empty')}</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[320px]">
          <div className="space-y-0.5 px-1">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                compact
                onRead={handleItemRead}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      <Separator className="mt-2" />

      {/* Footer */}
      <div className="pt-2 px-1">
        <Link
          href={`/${locale}/notifications`}
          onClick={onClose}
          className="block text-center text-sm text-primary hover:text-primary/80 font-medium py-1"
        >
          {t('notifications.viewAll')}
        </Link>
      </div>
    </div>
  );
}
