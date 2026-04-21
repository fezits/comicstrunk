'use client';

import { useLocale, useTranslations } from 'next-intl';
import { XCircle } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function SubscriptionCancelPage() {
  const t = useTranslations('subscription.checkout');
  const locale = useLocale();

  return (
    <div className="max-w-lg mx-auto py-16">
      <Card>
        <CardContent className="flex flex-col items-center text-center py-12 space-y-6">
          <div className="h-20 w-20 rounded-full bg-yellow-500/10 flex items-center justify-center">
            <XCircle className="h-10 w-10 text-yellow-500" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold">{t('cancel')}</h1>
            <p className="text-muted-foreground">{t('cancelMessage')}</p>
          </div>

          <Button asChild variant="outline" className="w-full max-w-xs">
            <Link href={`/${locale}/subscription`}>{t('cancelCta')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
