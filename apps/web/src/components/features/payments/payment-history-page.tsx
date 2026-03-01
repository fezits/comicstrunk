'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { CreditCard, ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getPaymentHistory,
  type PaymentHistoryItem,
} from '@/lib/api/payments';
import type { PaginationMeta } from '@/lib/api/catalog';

const STATUS_OPTIONS = [
  { value: 'ALL', labelKey: 'allStatuses' },
  { value: 'approved', labelKey: 'statusConfirmed' },
  { value: 'pending', labelKey: 'statusPending' },
  { value: 'refunded', labelKey: 'statusRefunded' },
  { value: 'rejected', labelKey: 'statusRejected' },
] as const;

function formatPrice(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

function getStatusBadge(
  status: string | null,
  t: (key: string) => string,
): { label: string; className: string } {
  switch (status) {
    case 'approved':
      return {
        label: t('statusConfirmed'),
        className: 'bg-green-500/15 text-green-500 border-green-500/20',
      };
    case 'pending':
      return {
        label: t('statusPending'),
        className: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/20',
      };
    case 'refunded':
      return {
        label: t('statusRefunded'),
        className: 'bg-blue-500/15 text-blue-500 border-blue-500/20',
      };
    case 'rejected':
      return {
        label: t('statusRejected'),
        className: 'bg-red-500/15 text-red-500 border-red-500/20',
      };
    default:
      return {
        label: status ?? '-',
        className: 'bg-muted text-muted-foreground',
      };
  }
}

export function PaymentHistoryPage() {
  const t = useTranslations('paymentHistory');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [payments, setPayments] = useState<PaymentHistoryItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);

  const currentPage = Number(searchParams.get('page') ?? '1');
  const currentStatus = searchParams.get('status') ?? 'ALL';

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getPaymentHistory(currentPage, 10);
      setPayments(result.data);
      setPagination(result.pagination);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [currentPage]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const updateParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (key === 'status') {
      params.delete('page');
    }
    if (value === 'ALL' && key === 'status') {
      params.delete('status');
    } else {
      params.set(key, value);
    }
    router.push(`/${locale}/payments/history?${params.toString()}`);
  };

  // Client-side status filtering (API may not support status filter on history)
  const filteredPayments =
    currentStatus === 'ALL'
      ? payments
      : payments.filter((p) => p.providerStatus === currentStatus);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>

        <Select
          value={currentStatus}
          onValueChange={(value) => updateParams('status', value)}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder={t('status')} />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(option.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded" />
          ))}
        </div>
      ) : filteredPayments.length === 0 ? (
        /* Empty state */
        <div className="text-center py-16 space-y-4">
          <CreditCard className="h-16 w-16 text-muted-foreground/30 mx-auto" />
          <p className="text-lg text-muted-foreground">{t('noPayments')}</p>
        </div>
      ) : (
        /* Payment table */
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('date')}</TableHead>
              <TableHead>{t('order')}</TableHead>
              <TableHead>{t('amount')}</TableHead>
              <TableHead>{t('method')}</TableHead>
              <TableHead>{t('status')}</TableHead>
              <TableHead>{t('refund')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPayments.map((payment) => {
              const statusBadge = getStatusBadge(payment.providerStatus, t);
              return (
                <TableRow key={payment.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatDate(payment.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/${locale}/orders/${payment.orderId}`}
                      className="text-primary hover:underline font-medium text-sm"
                    >
                      #{payment.order.orderNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="font-semibold text-sm">
                    {formatPrice(payment.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {t('pix')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusBadge.className}>
                      {statusBadge.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {payment.refundedAmount && payment.refundedAmount > 0
                      ? formatPrice(payment.refundedAmount)
                      : '-'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => updateParams('page', String(currentPage - 1))}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {t('previousPage')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('pageOf', { current: currentPage, total: pagination.totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= pagination.totalPages}
            onClick={() => updateParams('page', String(currentPage + 1))}
          >
            {t('nextPage')}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
