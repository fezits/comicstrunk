'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  adminCreatePlan,
  adminUpdatePlan,
  type PlanConfig,
} from '@/lib/api/admin-subscriptions';

const PLAN_TYPES = ['FREE', 'BASIC'] as const;
const BILLING_INTERVALS = ['MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL'] as const;

interface PlanConfigFormProps {
  mode: 'create' | 'edit';
  plan: PlanConfig | null;
  open: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function PlanConfigForm({ mode, plan, open, onClose, onSave }: PlanConfigFormProps) {
  const t = useTranslations('adminSubscription.plans');
  const tCommon = useTranslations('common');

  // Form state
  const [name, setName] = useState('');
  const [planType, setPlanType] = useState<string>('BASIC');
  const [billingInterval, setBillingInterval] = useState<string>('MONTHLY');
  const [price, setPrice] = useState(0);
  const [collectionLimit, setCollectionLimit] = useState(50);
  const [commissionRate, setCommissionRate] = useState(0.1);
  const [trialDays, setTrialDays] = useState(0);
  const [stripePriceId, setStripePriceId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (mode === 'edit' && plan) {
      setName(plan.name);
      setPlanType(plan.planType);
      setBillingInterval(plan.billingInterval);
      setPrice(plan.price);
      setCollectionLimit(plan.collectionLimit);
      setCommissionRate(plan.commissionRate);
      setTrialDays(plan.trialDays);
      setStripePriceId(plan.stripePriceId ?? '');
      setIsActive(plan.isActive);
    } else if (mode === 'create') {
      setName('');
      setPlanType('BASIC');
      setBillingInterval('MONTHLY');
      setPrice(0);
      setCollectionLimit(50);
      setCommissionRate(0.1);
      setTrialDays(0);
      setStripePriceId('');
      setIsActive(true);
    }
  }, [mode, plan]);

  // Commission impact calculation
  const commissionAmount = (commissionRate * 100).toFixed(2);
  const netAmount = ((1 - commissionRate) * 100).toFixed(2);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    if (price < 0) return;
    if (collectionLimit < 1) return;
    if (commissionRate < 0 || commissionRate > 1) return;

    setSaving(true);
    try {
      if (mode === 'create') {
        await adminCreatePlan({
          planType,
          name: name.trim(),
          price,
          billingInterval,
          collectionLimit,
          commissionRate,
          trialDays,
          isActive,
          ...(stripePriceId.trim() ? { stripePriceId: stripePriceId.trim() } : {}),
        });
        toast.success(t('createSuccess'));
      } else if (plan) {
        await adminUpdatePlan(plan.id, {
          name: name.trim(),
          price,
          collectionLimit,
          commissionRate,
          trialDays,
          isActive,
          stripePriceId: stripePriceId.trim() || null,
        });
        toast.success(t('updateSuccess'));
      }
      onSave();
      onClose();
    } catch {
      toast.error(tCommon('error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? t('create') : t('edit')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-2">
            <Label>{t('name')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          {/* Plan Type (create only) */}
          {mode === 'create' && (
            <div className="space-y-2">
              <Label>{t('planType')}</Label>
              <Select value={planType} onValueChange={setPlanType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_TYPES.map((pt) => (
                    <SelectItem key={pt} value={pt}>
                      {pt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Billing Interval (create only) */}
          {mode === 'create' && (
            <div className="space-y-2">
              <Label>{t('billingInterval')}</Label>
              <Select value={billingInterval} onValueChange={setBillingInterval}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BILLING_INTERVALS.map((bi) => (
                    <SelectItem key={bi} value={bi}>
                      {t(`intervals.${bi}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Price */}
          <div className="space-y-2">
            <Label>{t('price')}</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
          </div>

          {/* Collection Limit */}
          <div className="space-y-2">
            <Label>{t('collectionLimit')}</Label>
            <Input
              type="number"
              min={1}
              value={collectionLimit}
              onChange={(e) => setCollectionLimit(Number(e.target.value))}
            />
          </div>

          {/* Commission Rate */}
          <div className="space-y-2">
            <Label>{t('commissionRate')}</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              max={1}
              value={commissionRate}
              onChange={(e) => setCommissionRate(Number(e.target.value))}
            />
            {/* Commission Impact Preview */}
            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="font-medium text-muted-foreground">{t('impact')}</p>
              <p className="mt-1">
                Em uma venda de R$100: comissao R${commissionAmount}, vendedor recebe R${netAmount}
              </p>
            </div>
          </div>

          {/* Trial Days */}
          <div className="space-y-2">
            <Label>{t('trialDays')}</Label>
            <Input
              type="number"
              min={0}
              max={365}
              value={trialDays}
              onChange={(e) => setTrialDays(Number(e.target.value))}
            />
          </div>

          {/* Stripe Price ID */}
          <div className="space-y-2">
            <Label>{t('stripePriceId')}</Label>
            <Input
              value={stripePriceId}
              onChange={(e) => setStripePriceId(e.target.value)}
              placeholder="price_..."
            />
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between">
            <Label>{t('isActive')}</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !name.trim()}>
            {saving ? t('saving') : t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
