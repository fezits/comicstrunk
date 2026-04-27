'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { QrCode, Copy, Check, Loader2, RefreshCw, CreditCard } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { createPixSubscription } from '@/lib/api/subscriptions';

export default function PixSubscriptionPage() {
  const t = useTranslations('subscription');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const planConfigId = searchParams.get('planConfigId');

  const [loading, setLoading] = useState(true);
  const [pixData, setPixData] = useState<{
    id: string;
    pixQrCode: string;
    pixCopyPaste: string;
    pixExpiresAt: string;
    amount: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [expired, setExpired] = useState(false);
  const [minutesLeft, setMinutesLeft] = useState(30);

  const generatePix = useCallback(async () => {
    if (!planConfigId) return;
    setLoading(true);
    setExpired(false);
    try {
      const result = await createPixSubscription(planConfigId);
      setPixData(result.payment);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      toast.error(msg || t('pixError'));
    } finally {
      setLoading(false);
    }
  }, [planConfigId, t]);

  useEffect(() => {
    generatePix();
  }, [generatePix]);

  // Countdown timer
  useEffect(() => {
    if (!pixData?.pixExpiresAt) return;
    const interval = setInterval(() => {
      const diff = new Date(pixData.pixExpiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setExpired(true);
        setMinutesLeft(0);
        clearInterval(interval);
      } else {
        setMinutesLeft(Math.ceil(diff / 60000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [pixData?.pixExpiresAt]);

  const handleCopy = async () => {
    if (!pixData?.pixCopyPaste) return;
    await navigator.clipboard.writeText(pixData.pixCopyPaste);
    setCopied(true);
    toast.success(t('pixCopied'));
    setTimeout(() => setCopied(false), 3000);
  };

  if (!planConfigId) {
    router.push(`/${locale}/subscription`);
    return null;
  }

  return (
    <div className="container max-w-lg mx-auto py-8 px-4">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <QrCode className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>{t('pixTitle')}</CardTitle>
          <CardDescription>{t('pixSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : pixData ? (
            <>
              {/* Amount */}
              <div className="text-center">
                <span className="text-2xl font-bold text-primary">
                  R$ {pixData.amount.toFixed(2).replace('.', ',')}
                </span>
              </div>

              {/* QR Code */}
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-lg">
                  <img
                    src={`data:image/png;base64,${pixData.pixQrCode}`}
                    alt="QR Code PIX"
                    className="w-64 h-64"
                  />
                </div>
              </div>

              {/* Copy-paste code */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground text-center">
                  {t('pixCopyPaste')}
                </p>
                <div className="flex gap-2">
                  <code className="flex-1 p-3 bg-muted rounded-md text-xs break-all max-h-20 overflow-y-auto">
                    {pixData.pixCopyPaste}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                    className="shrink-0"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Timer / Status */}
              {expired ? (
                <div className="text-center space-y-3">
                  <p className="text-sm text-destructive">{t('pixExpired')}</p>
                  <Button onClick={generatePix} variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {t('pixGenerateNew')}
                  </Button>
                </div>
              ) : (
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {t('pixExpires', { minutes: minutesLeft })}
                  </p>
                  <div className="flex items-center justify-center gap-2 text-sm text-yellow-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('pixPending')}
                  </div>
                </div>
              )}

              {/* Alternative */}
              <div className="text-center pt-2 border-t">
                <Link
                  href={`/${locale}/subscription`}
                  className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
                >
                  <CreditCard className="h-3 w-3" />
                  {t('orPayWithCard')}
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">{t('pixError')}</p>
              <Button onClick={generatePix} variant="outline" className="mt-4">
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('pixGenerateNew')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
