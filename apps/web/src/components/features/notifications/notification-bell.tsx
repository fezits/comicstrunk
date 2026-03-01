'use client';

import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useNotifications } from '@/contexts/notification-context';
import { NotificationDropdown } from './notification-dropdown';

export function NotificationBell() {
  const t = useTranslations();
  const { unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);

  const badgeText = unreadCount > 99 ? '99+' : String(unreadCount);
  const ariaLabel = t('notifications.bellLabel', { count: unreadCount });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={ariaLabel}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {badgeText}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3" sideOffset={8}>
        <NotificationDropdown open={open} onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
