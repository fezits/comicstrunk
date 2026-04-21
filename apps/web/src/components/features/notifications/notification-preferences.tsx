'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  getPreferences,
  updatePreferences,
  type NotificationPreference,
} from '@/lib/api/notifications';

// Group notification types by category
const PREFERENCE_GROUPS: Array<{
  labelKey: string;
  types: string[];
}> = [
  {
    labelKey: 'notifications.typeGroups.orders',
    types: ['PAYMENT_CONFIRMED', 'ORDER_SHIPPED', 'ITEM_SOLD'],
  },
  {
    labelKey: 'notifications.typeGroups.community',
    types: ['DISPUTE_OPENED', 'DISPUTE_RESPONDED', 'DISPUTE_RESOLVED'],
  },
  {
    labelKey: 'notifications.typeGroups.account',
    types: [
      'WELCOME',
      'PASSWORD_RESET',
      'SUBSCRIPTION_PAYMENT_FAILED',
      'SUBSCRIPTION_EXPIRED',
    ],
  },
];

// Types that cannot be disabled
const LOCKED_TYPES = new Set(['PASSWORD_RESET']);

export function NotificationPreferences() {
  const t = useTranslations();
  const locale = useLocale();
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchPreferences = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getPreferences();
      setPreferences(data);
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const handleToggle = async (type: string, enabled: boolean) => {
    if (LOCKED_TYPES.has(type)) return;

    // Optimistic update
    setPreferences((prev) =>
      prev.map((p) => (p.type === type ? { ...p, enabled } : p)),
    );

    setSaving(type);
    try {
      await updatePreferences([{ type, enabled }]);
      toast.success(t('notifications.preferenceSaved'));
    } catch {
      // Revert on error
      setPreferences((prev) =>
        prev.map((p) => (p.type === type ? { ...p, enabled: !enabled } : p)),
      );
    } finally {
      setSaving(null);
    }
  };

  const prefMap = new Map(preferences.map((p) => [p.type, p.enabled]));

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <Button variant="ghost" size="sm" className="mb-4" asChild>
          <Link href={`/${locale}/notifications`}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            {t('notifications.title')}
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">{t('notifications.preferences')}</h1>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-5 w-32" />
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="flex items-center justify-between py-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-5 w-10 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <TooltipProvider>
          <div className="space-y-8">
            {PREFERENCE_GROUPS.map((group, groupIdx) => (
              <div key={group.labelKey}>
                <h2 className="text-base font-semibold mb-3">
                  {t(group.labelKey)}
                </h2>
                <div className="space-y-1">
                  {group.types.map((type) => {
                    const isLocked = LOCKED_TYPES.has(type);
                    const enabled = prefMap.get(type) ?? true;
                    const isSaving = saving === type;
                    const typeKey = `notifications.types.${type}` as const;

                    return (
                      <div
                        key={type}
                        className="flex items-center justify-between py-3 px-1"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{t(typeKey)}</span>
                          {isLocked && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t('notifications.passwordResetRequired')}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <Switch
                          checked={isLocked ? true : enabled}
                          disabled={isLocked || isSaving}
                          onCheckedChange={(checked) => handleToggle(type, checked)}
                        />
                      </div>
                    );
                  })}
                </div>
                {groupIdx < PREFERENCE_GROUPS.length - 1 && (
                  <Separator className="mt-4" />
                )}
              </div>
            ))}
          </div>
        </TooltipProvider>
      )}
    </div>
  );
}
