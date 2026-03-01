'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { CreditCard, Loader2, Clock, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getPaymentStatus, type PaymentData } from '@/lib/api/payments';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

interface PaymentStatusSectionProps {
  orderId: string;
  orderStatus: string;
}

export function PaymentStatusSection({ orderId, orderStatus }: PaymentStatusSectionProps) {
  const t = useTranslations('orders');
  const locale = useLocale();

  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchPayment() {
      setLoading(true);
      try {
        const data = await getPaymentStatus(orderId);
        if (!cancelled) {
          setPayment(data);
          setNotFound(false);
        }
      } catch {
        if (!cancelled) {
          setNotFound(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchPayment();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const paymentPageUrl = `/${locale}/checkout/payment?orderId=${orderId}`;

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            {t('payment')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardContent>
      </Card>
    );
  }

  // No payment record found
  if (notFound || !payment) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            {t('payment')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{t('paymentNotStarted')}</span>
          </div>
          {orderStatus === 'PENDING' && (
            <Button asChild size="sm" className="gap-2">
              <Link href={paymentPageUrl}>
                <CreditCard className="h-4 w-4" />
                {t('payWithPix')}
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Determine payment state
  const isPaid = !!payment.paidAt;
  const isRefunded = (payment.refundedAmount ?? 0) > 0;
  const isExpired =
    !isPaid &&
    payment.pixExpiresAt &&
    new Date(payment.pixExpiresAt).getTime() < Date.now();
  const isPending = !isPaid && !isExpired && payment.providerStatus === 'pending';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          {t('payment')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Refunded state */}
        {isRefunded && (
          <>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="border-blue-500/50 bg-blue-500/10 text-blue-500">
                <RotateCcw className="h-3 w-3 mr-1" />
                {t('refundAmount')}: {BRL.format((payment.refundedAmount ?? 0) / 100)}
              </Badge>
            </div>
            {isPaid && payment.amount !== payment.refundedAmount && (
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  {t('paymentAmount')}: {BRL.format(payment.amount / 100)}
                </p>
                <p>
                  {t('refundAmount')}: {BRL.format((payment.refundedAmount ?? 0) / 100)}
                </p>
              </div>
            )}
          </>
        )}

        {/* Paid state (not refunded) */}
        {isPaid && !isRefunded && (
          <>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="border-green-500/50 bg-green-500/10 text-green-500">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {t('paymentConfirmed')}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                {t('paymentDate')}: {formatDate(payment.paidAt!)}
              </p>
              <p>
                {t('paymentAmount')}: {BRL.format(payment.amount / 100)}
              </p>
            </div>
          </>
        )}

        {/* Expired state */}
        {isExpired && !isPaid && (
          <>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="border-destructive/50 bg-destructive/10 text-destructive">
                <AlertCircle className="h-3 w-3 mr-1" />
                {t('pixExpired')}
              </Badge>
            </div>
            <Button asChild size="sm" variant="outline" className="gap-2">
              <Link href={paymentPageUrl}>
                <RotateCcw className="h-4 w-4" />
                {t('retryPayment')}
              </Link>
            </Button>
          </>
        )}

        {/* Pending state */}
        {isPending && (
          <>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="border-yellow-500/50 bg-yellow-500/10 text-yellow-500">
                <Clock className="h-3 w-3 mr-1" />
                {t('awaitingPayment')}
              </Badge>
            </div>
            {payment.pixExpiresAt && new Date(payment.pixExpiresAt).getTime() > Date.now() && (
              <p className="text-xs text-muted-foreground">
                {t('expiresIn')}:{' '}
                <ExpiryCountdown expiresAt={payment.pixExpiresAt} />
              </p>
            )}
            <Button asChild size="sm" className="gap-2">
              <Link href={paymentPageUrl}>
                <Loader2 className="h-4 w-4" />
                {t('goToPayment')}
              </Link>
            </Button>
          </>
        )}

        {/* Method indicator */}
        {payment.method && (
          <p className="text-xs text-muted-foreground">
            PIX
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Small inline countdown for expiry display */
function ExpiryCountdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    function update() {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining('00:00');
        return;
      }
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setRemaining(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return <span className="font-mono">{remaining}</span>;
}
