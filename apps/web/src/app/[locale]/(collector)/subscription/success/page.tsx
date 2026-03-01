'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function SubscriptionSuccessPage() {
  const t = useTranslations('subscription.checkout');
  const locale = useLocale();
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push(`/${locale}/subscription`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [locale, router]);

  return (
    <div className="max-w-lg mx-auto py-16">
      <Card>
        <CardContent className="flex flex-col items-center text-center py-12 space-y-6">
          <div className="h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold">{t('success')}</h1>
            <p className="text-muted-foreground">{t('successMessage')}</p>
          </div>

          <Button asChild className="w-full max-w-xs">
            <Link href={`/${locale}/collection`}>{t('successCta')}</Link>
          </Button>

          <p className="text-xs text-muted-foreground">
            {t('redirecting', { seconds: countdown })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
