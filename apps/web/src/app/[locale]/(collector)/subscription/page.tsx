'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Skeleton } from '@/components/ui/skeleton';
import { PlanComparison } from '@/components/features/subscription/plan-comparison';
import { SubscriptionStatusCard } from '@/components/features/subscription/subscription-status-card';
import {
  getPlans,
  getSubscriptionStatus,
  createCheckout,
  type PlanConfig,
  type SubscriptionStatus,
} from '@/lib/api/subscriptions';

export default function SubscriptionPage() {
  const t = useTranslations('subscription');

  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [plansData, statusData] = await Promise.all([
        getPlans(),
        getSubscriptionStatus(),
      ]);
      setPlans(plansData);
      setSubscription(statusData);
    } catch {
      toast.error(t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpgrade = async (planConfigId: string) => {
    setCheckoutLoading(true);
    try {
      const session = await createCheckout(planConfigId);
      window.location.href = session.url;
    } catch {
      toast.error(t('loadError'));
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-80 w-full rounded-lg" />
          <Skeleton className="h-80 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  const isPaidSubscription =
    subscription &&
    subscription.planType !== 'FREE' &&
    ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(subscription.status);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>

      {/* Show status card first for paid subscribers */}
      {isPaidSubscription && subscription && (
        <SubscriptionStatusCard
          subscription={subscription}
          onStatusChange={fetchData}
        />
      )}

      {/* Plan comparison */}
      <PlanComparison
        plans={plans}
        currentPlanType={subscription?.planType ?? 'FREE'}
        onUpgrade={handleUpgrade}
        loading={checkoutLoading}
      />
    </div>
  );
}
