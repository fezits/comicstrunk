'use client';

import { useTranslations } from 'next-intl';

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
import type { CommissionTransaction } from '@/lib/api/admin-commission';
import type { PaginationMeta } from '@/lib/api/admin-payments';

interface CommissionTransactionsTableProps {
  transactions: CommissionTransaction[];
  pagination: PaginationMeta | null;
  onPageChange: (page: number) => void;
  loading: boolean;
  currentPage: number;
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatPercentage(rate: number): string {
  return `${(rate * 100).toFixed(0)}%`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'PAID':
    case 'COMPLETED':
    case 'DELIVERED':
      return 'default';
    case 'PROCESSING':
    case 'SHIPPED':
      return 'secondary';
    case 'CANCELLED':
    case 'REFUNDED':
      return 'destructive';
    default:
      return 'outline';
  }
}

export function CommissionTransactionsTable({
  transactions,
  pagination,
  onPageChange,
  loading,
  currentPage,
}: CommissionTransactionsTableProps) {
  const t = useTranslations('adminCommission');

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">{t('noTransactions')}</p>
    );
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('order')}</TableHead>
            <TableHead>{t('item')}</TableHead>
            <TableHead>{t('price')}</TableHead>
            <TableHead>{t('rate')}</TableHead>
            <TableHead>{t('commission')}</TableHead>
            <TableHead>{t('sellerNet')}</TableHead>
            <TableHead>{t('status')}</TableHead>
            <TableHead>{t('date')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow key={tx.id}>
              <TableCell className="font-medium">#{tx.orderNumber}</TableCell>
              <TableCell className="max-w-[200px] truncate">{tx.catalogTitle}</TableCell>
              <TableCell>{formatBRL(tx.priceSnapshot)}</TableCell>
              <TableCell>{formatPercentage(tx.commissionRateSnapshot)}</TableCell>
              <TableCell className="text-green-500 font-medium">
                {formatBRL(tx.commissionAmountSnapshot)}
              </TableCell>
              <TableCell>{formatBRL(tx.sellerNetSnapshot)}</TableCell>
              <TableCell>
                <Badge variant={getStatusVariant(tx.status)}>{tx.status}</Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(tx.createdAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            {t('previousPage')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {currentPage} / {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= pagination.totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            {t('nextPage')}
          </Button>
        </div>
      )}
    </div>
  );
}
