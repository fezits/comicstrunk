'use client';

import { useTranslations } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { PendingPaymentOrder } from '@/lib/api/admin-payments';

interface PendingPaymentsTableProps {
  orders: PendingPaymentOrder[];
  onApprove: (orderId: string) => void;
  onReject: (orderId: string) => void;
  loading: boolean;
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getPixStatusVariant(status: string | null): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'approved':
      return 'default';
    case 'pending':
    case 'in_process':
      return 'secondary';
    case 'rejected':
    case 'cancelled':
      return 'destructive';
    default:
      return 'outline';
  }
}

export function PendingPaymentsTable({
  orders,
  onApprove,
  onReject,
  loading,
}: PendingPaymentsTableProps) {
  const t = useTranslations('adminPayments');

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <CheckCircle2 className="h-12 w-12 mb-3 text-green-500" />
        <p className="text-lg">{t('noPending')}</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('order')}</TableHead>
          <TableHead>{t('buyer')}</TableHead>
          <TableHead>{t('amount')}</TableHead>
          <TableHead>{t('date')}</TableHead>
          <TableHead>{t('pixStatus')}</TableHead>
          <TableHead className="text-right">{t('actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => {
          const payment = order.payments?.[0];
          return (
            <TableRow key={order.id}>
              <TableCell className="font-medium">#{order.orderNumber}</TableCell>
              <TableCell>
                <div>
                  <p className="font-medium text-sm">{order.buyer.name}</p>
                  <p className="text-xs text-muted-foreground">{order.buyer.email}</p>
                </div>
              </TableCell>
              <TableCell className="font-medium">{formatBRL(order.totalAmount)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(order.createdAt)}
              </TableCell>
              <TableCell>
                {payment ? (
                  <div className="space-y-1">
                    <Badge variant={getPixStatusVariant(payment.providerStatus)}>
                      {payment.providerStatus ?? 'N/A'}
                    </Badge>
                    {payment.pixExpiresAt && (
                      <p className="text-xs text-muted-foreground">
                        Expira: {formatDate(payment.pixExpiresAt)}
                      </p>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => onApprove(order.id)}
                  >
                    {t('approve')}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => onReject(order.id)}
                  >
                    {t('reject')}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
