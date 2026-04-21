'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ArrowLeft, Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { PlanConfigForm } from '@/components/features/admin/plan-config-form';
import {
  adminListPlans,
  adminUpdatePlan,
  type PlanConfig,
} from '@/lib/api/admin-subscriptions';

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export default function AdminPlansRoute() {
  const t = useTranslations('adminSubscription.plans');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingPlan, setEditingPlan] = useState<PlanConfig | null>(null);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminListPlans();
      setPlans(data);
    } catch {
      toast.error(tCommon('error'));
    } finally {
      setLoading(false);
    }
  }, [tCommon]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handleCreate = () => {
    setFormMode('create');
    setEditingPlan(null);
    setFormOpen(true);
  };

  const handleEdit = (plan: PlanConfig) => {
    setFormMode('edit');
    setEditingPlan(plan);
    setFormOpen(true);
  };

  const handleToggleActive = async (plan: PlanConfig) => {
    try {
      await adminUpdatePlan(plan.id, { isActive: !plan.isActive });
      toast.success(t('updateSuccess'));
      fetchPlans();
    } catch {
      toast.error(tCommon('error'));
    }
  };

  // Group plans by planType
  const freePlans = plans.filter((p) => p.planType === 'FREE');
  const basicPlans = plans.filter((p) => p.planType === 'BASIC');

  const renderPlanCard = (plan: PlanConfig) => (
    <Card key={plan.id} className={!plan.isActive ? 'opacity-60' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{plan.name}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={plan.isActive ? 'default' : 'secondary'}>
              {plan.isActive ? t('isActive') : 'Inativo'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">{t('price')}:</span>{' '}
            <span className="font-medium">{formatBRL(plan.price)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t('billingInterval')}:</span>{' '}
            <span className="font-medium">
              {t(`intervals.${plan.billingInterval}` as 'intervals.MONTHLY' | 'intervals.QUARTERLY' | 'intervals.SEMIANNUAL' | 'intervals.ANNUAL')}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">{t('collectionLimit')}:</span>{' '}
            <span className="font-medium">{plan.collectionLimit}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t('commissionRate')}:</span>{' '}
            <span className="font-medium">{(plan.commissionRate * 100).toFixed(1)}%</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t('trialDays')}:</span>{' '}
            <span className="font-medium">{plan.trialDays}</span>
          </div>
          {plan.stripePriceId && (
            <div className="col-span-2">
              <span className="text-muted-foreground">{t('stripePriceId')}:</span>{' '}
              <span className="truncate font-mono text-xs">{plan.stripePriceId}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('isActive')}:</span>
            <Switch checked={plan.isActive} onCheckedChange={() => handleToggleActive(plan)} />
          </div>
          <Button variant="outline" size="sm" onClick={() => handleEdit(plan)}>
            {tCommon('edit')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/${locale}/admin/subscriptions`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">{t('noPlans')}</p>
      ) : (
        <div className="space-y-8">
          {/* FREE plans section */}
          {freePlans.length > 0 && (
            <div>
              <h2 className="mb-4 text-xl font-semibold">FREE</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {freePlans.map(renderPlanCard)}
              </div>
            </div>
          )}

          {/* BASIC plans section */}
          {basicPlans.length > 0 && (
            <div>
              <h2 className="mb-4 text-xl font-semibold">BASIC</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {basicPlans.map(renderPlanCard)}
              </div>
            </div>
          )}
        </div>
      )}

      <PlanConfigForm
        mode={formMode}
        plan={editingPlan}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={fetchPlans}
      />
    </div>
  );
}
