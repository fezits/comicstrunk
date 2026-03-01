'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Bell, CheckCheck, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { NotificationItem } from './notification-item';
import { useNotifications } from '@/contexts/notification-context';
import {
  getNotifications,
  markAllAsRead,
  type Notification,
} from '@/lib/api/notifications';

const PAGE_SIZE = 20;

export function NotificationsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const { unreadCount, refreshUnreadCount } = useNotifications();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const fetchNotifications = useCallback(async (pageNum: number, unreadOnly: boolean) => {
    setIsLoading(true);
    try {
      const result = await getNotifications({
        page: pageNum,
        limit: PAGE_SIZE,
        unreadOnly: unreadOnly || undefined,
      });
      setNotifications(result.data);
      setTotalPages(result.pagination.totalPages);
      setTotal(result.pagination.total);
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications(page, filter === 'unread');
  }, [page, filter, fetchNotifications]);

  const handleFilterChange = (value: string) => {
    setFilter(value as 'all' | 'unread');
    setPage(1);
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })),
      );
      refreshUnreadCount();
    } catch {
      // Silently fail
    }
  };

  const handleItemRead = () => {
    refreshUnreadCount();
    // Refresh the list to reflect the updated read state
    fetchNotifications(page, filter === 'unread');
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('notifications.title')}</h1>
          {total > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {total} {t('notifications.title').toLowerCase()}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
            >
              <CheckCheck className="h-4 w-4 mr-1.5" />
              {t('notifications.markAllRead')}
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${locale}/notifications/preferences`}>
              <Settings className="h-4 w-4 mr-1.5" />
              {t('notifications.managePreferences')}
            </Link>
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <Tabs value={filter} onValueChange={handleFilterChange}>
        <TabsList>
          <TabsTrigger value="all">{t('notifications.all')}</TabsTrigger>
          <TabsTrigger value="unread">
            {t('notifications.unread')}
            {unreadCount > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Notification list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-md border">
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Bell className="h-12 w-12 mb-3 opacity-40" />
          <p className="text-base font-medium">
            {filter === 'unread'
              ? t('notifications.noUnread')
              : t('notifications.empty')}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onRead={handleItemRead}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            {t('catalog.previousPage')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('catalog.pageOf', { current: page, total: totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('catalog.nextPage')}
          </Button>
        </div>
      )}
    </div>
  );
}
