'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Crown, CreditCard, Loader2, AlertTriangle, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import type { SubscriptionStatus } from '@/lib/api/subscriptions';
import { cancelSubscription, createPortalSession } from '@/lib/api/subscriptions';

interface SubscriptionStatusCardProps {
  subscription: SubscriptionStatus;
  onStatusChange: () => void;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateStr));
}

function getStatusVariant(
  status: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'ACTIVE':
      return 'default';
    case 'TRIALING':
      return 'secondary';
    case 'PAST_DUE':
      return 'destructive';
    case 'CANCELLED':
      return 'outline';
    default:
      return 'outline';
  }
}

export function SubscriptionStatusCard({
  subscription,
  onStatusChange,
}: SubscriptionStatusCardProps) {
  const t = useTranslations('subscription');
  const tCommon = useTranslations('common');
  const [cancelling, setCancelling] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);

  const isFree = subscription.planType === 'FREE';
  const isPaid = !isFree;
  const isCancelled = !!subscription.cancelledAt;
  const isPastDue = subscription.status === 'PAST_DUE';

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await cancelSubscription();
      toast.success(t('billing.cancelSuccess'));
      onStatusChange();
    } catch {
      toast.error(t('billing.cancelError'));
    } finally {
      setCancelling(false);
    }
  };

  const handleManageBilling = async () => {
    setOpeningPortal(true);
    try {
      const session = await createPortalSession();
      window.location.href = session.url;
    } catch {
      toast.error(t('loadError'));
      setOpeningPortal(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            <span>{t('currentPlan')}</span>
          </div>
          <Badge variant={getStatusVariant(subscription.status)}>
            {t(`status.${subscription.status}`)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Plan name */}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Plano</span>
          <span className="font-semibold">
            {isFree ? t('freePlan') : t('basicPlan')}
          </span>
        </div>

        {/* Limits */}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">
            {t('collectionLimit', { limit: subscription.collectionLimit })}
          </span>
        </div>

        {/* Billing info (only for paid plans) */}
        {isPaid && subscription.currentPeriodEnd && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('billing.nextBilling')}</span>
            <span>{formatDate(subscription.currentPeriodEnd)}</span>
          </div>
        )}

        {/* Cancellation warning */}
        {isCancelled && subscription.cancelledAt && (
          <div className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
            <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-500">
              {t('billing.cancelScheduled', {
                date: formatDate(subscription.currentPeriodEnd),
              })}
            </p>
          </div>
        )}

        {/* Past due warning */}
        {isPastDue && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{t('billing.pastDueWarning')}</p>
          </div>
        )}

        {/* Action buttons (only for paid subscriptions) */}
        {isPaid && (
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleManageBilling}
              disabled={openingPortal}
            >
              {openingPortal ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CreditCard className="h-4 w-4 mr-2" />
              )}
              {t('billing.manageBilling')}
            </Button>

            {!isCancelled && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="flex-1 text-destructive hover:text-destructive">
                    {t('billing.cancelSubscription')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('billing.cancelConfirm')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('billing.cancelDescription')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCancel}
                      disabled={cancelling}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {cancelling ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {t('billing.cancelSubscription')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
