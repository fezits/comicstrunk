'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PixQrCode } from './pix-qr-code';
import { PixCountdownTimer } from './pix-countdown-timer';
import { initiatePayment, getPaymentStatus, type PaymentData } from '@/lib/api/payments';

type PaymentState = 'loading' | 'awaiting_payment' | 'processing' | 'success' | 'expired' | 'error';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function PixPaymentPage() {
  const t = useTranslations('payments');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');

  const [state, setState] = useState<PaymentState>('loading');
  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Initiate payment on mount
  useEffect(() => {
    if (!orderId) {
      router.replace(`/${locale}/orders`);
      return;
    }

    let cancelled = false;

    async function initiate() {
      try {
        const data = await initiatePayment(orderId!);
        if (cancelled) return;

        setPayment(data);

        // Already paid?
        if (data.paidAt) {
          setState('success');
          return;
        }

        // Already expired?
        if (data.pixExpiresAt && new Date(data.pixExpiresAt).getTime() < Date.now()) {
          setState('expired');
          return;
        }

        setState('awaiting_payment');
      } catch (err: unknown) {
        if (cancelled) return;
        const message =
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
            ?.error?.message || t('error');
        setErrorMessage(message);
        setState('error');
      }
    }

    initiate();

    return () => {
      cancelled = true;
    };
  }, [orderId, locale, router, t]);

  // Poll for payment status when awaiting
  useEffect(() => {
    if (state !== 'awaiting_payment' || !orderId) {
      stopPolling();
      return;
    }

    const poll = async () => {
      try {
        const data = await getPaymentStatus(orderId);
        setPayment(data);

        if (data.paidAt || data.providerStatus === 'approved') {
          setState('success');
          stopPolling();
          return;
        }

        if (
          data.providerStatus === 'rejected' ||
          data.providerStatus === 'cancelled' ||
          data.providerStatus === 'refunded'
        ) {
          setErrorMessage(t('error'));
          setState('error');
          stopPolling();
          return;
        }

        // Check if expired
        if (data.pixExpiresAt && new Date(data.pixExpiresAt).getTime() < Date.now()) {
          setState('expired');
          stopPolling();
        }
      } catch {
        // Silently ignore polling errors - will retry next interval
      }
    };

    pollingRef.current = setInterval(poll, 5000);

    return () => {
      stopPolling();
    };
  }, [state, orderId, t, stopPolling]);

  const handleExpired = useCallback(() => {
    setState('expired');
    stopPolling();
  }, [stopPolling]);

  const handleRetry = async () => {
    if (!orderId) return;

    setState('loading');
    setErrorMessage('');

    try {
      const data = await initiatePayment(orderId);
      setPayment(data);

      if (data.paidAt) {
        setState('success');
        return;
      }

      if (data.pixExpiresAt && new Date(data.pixExpiresAt).getTime() < Date.now()) {
        setState('expired');
        return;
      }

      setState('awaiting_payment');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || t('error');
      setErrorMessage(message);
      setState('error');
    }
  };

  // --- Render by state ---

  if (state === 'loading') {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex flex-col items-center gap-4 py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">{t('generating')}</p>
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="max-w-lg mx-auto">
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="flex flex-col items-center gap-6 py-12">
            <div className="rounded-full bg-green-500/10 p-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-green-500">{t('confirmed')}</h2>
              {payment && (
                <p className="text-muted-foreground">
                  {t('orderNumber')} #{payment.orderId.slice(-8).toUpperCase()}
                </p>
              )}
              {payment && (
                <p className="text-lg font-semibold">{BRL.format(payment.amount)}</p>
              )}
            </div>
            <Button
              onClick={() => router.push(`/${locale}/orders/${orderId}`)}
              className="gap-2"
              size="lg"
            >
              {t('viewOrder')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state === 'expired') {
    return (
      <div className="max-w-lg mx-auto">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-col items-center gap-6 py-12">
            <div className="rounded-full bg-destructive/10 p-4">
              <XCircle className="h-16 w-16 text-destructive" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-destructive">{t('expired')}</h2>
              <p className="text-sm text-muted-foreground">{t('expiredDescription')}</p>
            </div>
            <Button onClick={handleRetry} variant="outline" className="gap-2" size="lg">
              {t('tryAgain')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="max-w-lg mx-auto">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-col items-center gap-6 py-12">
            <div className="rounded-full bg-destructive/10 p-4">
              <AlertCircle className="h-16 w-16 text-destructive" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-destructive">{t('error')}</h2>
              {errorMessage && (
                <p className="text-sm text-muted-foreground">{errorMessage}</p>
              )}
            </div>
            <Button
              onClick={() => router.push(`/${locale}/orders/${orderId}`)}
              variant="outline"
              className="gap-2"
              size="lg"
            >
              {t('backToOrder')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // state === 'awaiting_payment'
  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Header with timer */}
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-xl font-bold tracking-tight">{t('payWithPix')}</h1>
        <PixCountdownTimer expiresAt={payment?.pixExpiresAt ?? null} onExpired={handleExpired} />
      </div>

      {/* Instructions */}
      <p className="text-center text-sm text-muted-foreground">{t('paymentInstructions')}</p>

      {/* QR Code */}
      <PixQrCode
        qrCodeBase64={payment?.pixQrCode ?? null}
        copyPasteCode={payment?.pixCopyPaste ?? null}
      />

      {/* Order summary */}
      {payment && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('orderTotal')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{BRL.format(payment.amount)}</p>
          </CardContent>
        </Card>
      )}

      {/* Polling indicator */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>{t('waitingConfirmation')}</span>
      </div>
    </div>
  );
}
