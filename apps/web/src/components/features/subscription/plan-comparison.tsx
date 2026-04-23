'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Crown, Loader2, Sparkles, QrCode } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PlanConfig } from '@/lib/api/subscriptions';

interface PlanComparisonProps {
  plans: PlanConfig[];
  currentPlanType: string;
  onUpgrade: (planConfigId: string) => void;
  onPixUpgrade?: (planConfigId: string) => void;
  loading: boolean;
}

const BILLING_INTERVAL_ORDER = ['MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL'] as const;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function PlanComparison({
  plans,
  currentPlanType,
  onUpgrade,
  onPixUpgrade,
  loading,
}: PlanComparisonProps) {
  const t = useTranslations('subscription');

  // Filter BASIC plans and sort by billing interval order
  const basicPlans = plans
    .filter((p) => p.planType === 'BASIC')
    .sort(
      (a, b) =>
        BILLING_INTERVAL_ORDER.indexOf(
          a.billingInterval as (typeof BILLING_INTERVAL_ORDER)[number],
        ) -
        BILLING_INTERVAL_ORDER.indexOf(
          b.billingInterval as (typeof BILLING_INTERVAL_ORDER)[number],
        ),
    );

  const freePlan = plans.find((p) => p.planType === 'FREE');

  const [selectedInterval, setSelectedInterval] = useState<string>(
    basicPlans[0]?.billingInterval ?? 'MONTHLY',
  );

  const selectedBasicPlan = basicPlans.find((p) => p.billingInterval === selectedInterval);
  const isCurrentFree = currentPlanType === 'FREE';
  const isCurrentBasic = currentPlanType === 'BASIC';

  const freeFeatures = [
    t('collectionLimit', { limit: freePlan?.collectionLimit ?? 50 }),
    t('commissionRate', { rate: Math.round((freePlan?.commissionRate ?? 0.1) * 100) }),
    t('catalogAccess'),
  ];

  const basicFeatures = [
    t('collectionLimit', { limit: selectedBasicPlan?.collectionLimit ?? 200 }),
    t('commissionRate', { rate: Math.round((selectedBasicPlan?.commissionRate ?? 0.08) * 100) }),
    t('catalogAccess'),
    t('prioritySupport'),
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">{t('comparePlans')}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* FREE Plan Card */}
        <Card className="relative">
          {isCurrentFree && (
            <Badge className="absolute -top-3 left-4 bg-muted text-muted-foreground">
              {t('currentPlan')}
            </Badge>
          )}
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              {t('freePlan')}
            </CardTitle>
            <div className="mt-2">
              <span className="text-3xl font-bold">{formatCurrency(0)}</span>
              <span className="text-muted-foreground text-sm">{t('perMonth')}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3">
              {freeFeatures.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {isCurrentFree && (
              <Button variant="outline" className="w-full" disabled>
                {t('currentPlan')}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* BASIC Plan Card */}
        <Card className="relative border-primary/50 shadow-lg shadow-primary/5">
          {isCurrentBasic && (
            <Badge className="absolute -top-3 left-4">{t('currentPlan')}</Badge>
          )}
          {!isCurrentBasic && selectedBasicPlan && selectedBasicPlan.trialDays > 0 && (
            <Badge className="absolute -top-3 right-4 bg-emerald-600 hover:bg-emerald-600">
              <Sparkles className="h-3 w-3 mr-1" />
              {t('trialDays', { days: selectedBasicPlan.trialDays })}
            </Badge>
          )}
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Crown className="h-5 w-5 text-primary" />
              {t('basicPlan')}
            </CardTitle>
            <div className="mt-2">
              <span className="text-3xl font-bold text-primary">
                {formatCurrency(selectedBasicPlan?.price ?? 9.9)}
              </span>
              <span className="text-muted-foreground text-sm">
                {t(`billingLabels.${selectedInterval}`)}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Billing Interval Selector */}
            {basicPlans.length > 1 && (
              <div className="flex flex-wrap gap-1.5 p-1 bg-muted rounded-lg">
                {basicPlans.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedInterval(plan.billingInterval)}
                    className={`flex-1 min-w-[70px] px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      selectedInterval === plan.billingInterval
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t(`billingIntervals.${plan.billingInterval}`)}
                  </button>
                ))}
              </div>
            )}

            <ul className="space-y-3">
              {basicFeatures.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {isCurrentBasic ? (
              <Button variant="outline" className="w-full" disabled>
                {t('currentPlan')}
              </Button>
            ) : (
              <div className="space-y-2">
                <Button
                  className="w-full"
                  onClick={() => selectedBasicPlan && onUpgrade(selectedBasicPlan.id)}
                  disabled={loading || !selectedBasicPlan}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {t('checkout.processing')}
                    </>
                  ) : (
                    t('upgradeTo', { plan: 'BASIC' })
                  )}
                </Button>
                {onPixUpgrade && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => selectedBasicPlan && onPixUpgrade(selectedBasicPlan.id)}
                    disabled={loading || !selectedBasicPlan}
                  >
                    <QrCode className="h-4 w-4 mr-2" />
                    {t('payWithPix')}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
