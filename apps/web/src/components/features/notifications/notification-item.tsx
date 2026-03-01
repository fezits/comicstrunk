'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  Gift,
  CreditCard,
  Truck,
  DollarSign,
  KeyRound,
  AlertTriangle,
  Crown,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { markAsRead } from '@/lib/api/notifications';
import type { Notification } from '@/lib/api/notifications';
import type { LucideIcon } from 'lucide-react';

const TYPE_ICON_MAP: Record<string, LucideIcon> = {
  WELCOME: Gift,
  PAYMENT_CONFIRMED: CreditCard,
  ORDER_SHIPPED: Truck,
  ITEM_SOLD: DollarSign,
  PASSWORD_RESET: KeyRound,
  DISPUTE_OPENED: AlertTriangle,
  DISPUTE_RESPONDED: AlertTriangle,
  DISPUTE_RESOLVED: AlertTriangle,
  SUBSCRIPTION_PAYMENT_FAILED: Crown,
  SUBSCRIPTION_EXPIRED: Crown,
};

function getTimeAgo(
  dateStr: string,
  t: ReturnType<typeof useTranslations>,
): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return t('notifications.timeAgo.justNow');
  if (diffMin < 60) return t('notifications.timeAgo.minutesAgo', { count: diffMin });
  if (diffHours < 24) return t('notifications.timeAgo.hoursAgo', { count: diffHours });
  if (diffDays === 1) return t('notifications.timeAgo.yesterday');
  return t('notifications.timeAgo.daysAgo', { count: diffDays });
}

function getNavigationUrl(
  notification: Notification,
  locale: string,
): string | null {
  const metadata = notification.metadata;
  if (!metadata) return null;

  if (metadata.orderId) return `/${locale}/orders/${metadata.orderId}`;
  if (metadata.catalogEntryId) return `/${locale}/catalog/${metadata.catalogEntryId}`;

  return null;
}

interface NotificationItemProps {
  notification: Notification;
  compact?: boolean;
  onRead?: () => void;
}

export function NotificationItem({
  notification,
  compact = false,
  onRead,
}: NotificationItemProps) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  const Icon = TYPE_ICON_MAP[notification.type] || Bell;
  const timeAgo = getTimeAgo(notification.createdAt, t);
  const url = getNavigationUrl(notification, locale);

  const handleClick = async () => {
    if (!notification.isRead) {
      try {
        await markAsRead(notification.id);
      } catch {
        // Non-critical - still navigate
      }
      onRead?.();
    }

    if (url) {
      router.push(url);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'w-full text-left flex items-start gap-3 rounded-md transition-colors',
        'hover:bg-accent/50',
        compact ? 'p-2' : 'p-3',
        !notification.isRead && 'border-l-2 border-l-primary bg-primary/5',
      )}
    >
      <div
        className={cn(
          'shrink-0 rounded-full flex items-center justify-center',
          compact ? 'h-8 w-8' : 'h-10 w-10',
          notification.isRead
            ? 'bg-muted text-muted-foreground'
            : 'bg-primary/10 text-primary',
        )}
      >
        <Icon className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
      </div>

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm truncate',
            !notification.isRead && 'font-semibold',
          )}
        >
          {notification.title}
        </p>
        <p
          className={cn(
            'text-muted-foreground mt-0.5',
            compact ? 'text-xs line-clamp-1' : 'text-sm line-clamp-2',
          )}
        >
          {notification.message}
        </p>
        <span className="text-xs text-muted-foreground mt-1 block">{timeAgo}</span>
      </div>

      {!notification.isRead && (
        <div className="shrink-0 mt-2">
          <div className="h-2 w-2 rounded-full bg-primary" />
        </div>
      )}
    </button>
  );
}
