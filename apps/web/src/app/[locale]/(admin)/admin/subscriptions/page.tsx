'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Settings } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SubscriptionList } from '@/components/features/admin/subscription-list';

export default function AdminSubscriptionsRoute() {
  const t = useTranslations('adminSubscription');
  const locale = useLocale();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <Button asChild variant="outline">
          <Link href={`/${locale}/admin/subscriptions/plans`}>
            <Settings className="mr-2 h-4 w-4" />
            {t('planManagement')}
          </Link>
        </Button>
      </div>

      <SubscriptionList />
    </div>
  );
}
