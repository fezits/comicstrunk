'use client';

import { useTranslations } from 'next-intl';
import { DollarSign, TrendingUp, ArrowRightLeft } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { CommissionDashboardData } from '@/lib/api/admin-commission';

interface CommissionSummaryCardsProps {
  data: CommissionDashboardData | null;
  loading: boolean;
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

export function CommissionSummaryCards({ data, loading }: CommissionSummaryCardsProps) {
  const t = useTranslations('adminCommission');

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalCommission')}</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {formatBRL(data.totals.totalCommission)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('salesVolume')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">
              {formatBRL(data.totals.totalSales)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('transactions')}</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-500">
              {data.totals.transactionCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {data.byPlan.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t('byPlan')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('rate')}</TableHead>
                  <TableHead>{t('count')}</TableHead>
                  <TableHead>{t('commission')}</TableHead>
                  <TableHead>{t('sales')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byPlan.map((plan) => (
                  <TableRow key={plan.rate}>
                    <TableCell className="font-medium">
                      {formatPercentage(plan.rate)}
                    </TableCell>
                    <TableCell>{plan.transaction_count}</TableCell>
                    <TableCell>{formatBRL(plan.total_commission)}</TableCell>
                    <TableCell>{formatBRL(plan.total_sales)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
