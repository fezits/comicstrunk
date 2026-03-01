'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';

interface PaymentApprovalDialogProps {
  type: 'approve' | 'reject';
  orderNumber: string;
  amount: number;
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function PaymentApprovalDialog({
  type,
  orderNumber,
  amount,
  open,
  onConfirm,
  onCancel,
  loading,
}: PaymentApprovalDialogProps) {
  const t = useTranslations('adminPayments');
  const tCommon = useTranslations('common');

  const isApprove = type === 'approve';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isApprove ? t('approve') : t('reject')}
          </DialogTitle>
          <DialogDescription>
            {isApprove
              ? t('confirmApprove', { amount: formatBRL(amount), order: orderNumber })
              : t('confirmReject', { order: orderNumber })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            {tCommon('cancel')}
          </Button>
          <Button
            variant={isApprove ? 'default' : 'destructive'}
            className={isApprove ? 'bg-green-600 hover:bg-green-700' : undefined}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? tCommon('loading') : tCommon('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
